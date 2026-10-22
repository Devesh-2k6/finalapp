import pytest
import base64
import json
from fastapi.testclient import TestClient
from main import app
from db.models import User, Shop
from db.session import SessionLocal

client = TestClient(app)


def make_demo_google_credential(email: str, name: str) -> str:
    payload = json.dumps({"email": email, "name": name, "email_verified": True})
    b64 = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")
    return f"demo_google_{b64}"


def test_google_auth_missing_credential():
    response = client.post("/auth/google", json={"credential": ""})
    assert response.status_code == 401
    assert "Google OAuth token required" in response.json()["detail"]


def test_google_auth_invalid_credential():
    response = client.post("/auth/google", json={"credential": "invalid_fake_token_xyz"})
    assert response.status_code == 401
    assert "Invalid or expired Google OAuth token" in response.json()["detail"]


def test_google_auth_customer_signup_and_login():
    test_email = "test.google.customer@gmail.com"
    test_name = "Google Customer User"
    cred = make_demo_google_credential(test_email, test_name)

    # 1. First time -> registers new customer
    res = client.post("/auth/google", json={
        "credential": cred,
        "role": "CUSTOMER"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == test_email
    assert data["user"]["name"] == test_name
    assert data["user"]["role"] == "CUSTOMER"
    assert data["user"]["email_verified"] is True

    # Verify user in database
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == test_email).first()
        assert user is not None
        assert user.email_verified is True
        assert user.is_shop_owner is False
    finally:
        db.close()

    # 2. Second time with same Google credential -> logs in seamlessly
    res_login = client.post("/auth/google", json={"credential": cred})
    assert res_login.status_code == 200
    login_data = res_login.json()
    assert login_data["user"]["email"] == test_email
    assert login_data["access_token"] is not None


def test_google_auth_vendor_signup():
    vendor_email = "test.google.vendor@gmail.com"
    vendor_name = "Organic Green Store"
    cred = make_demo_google_credential(vendor_email, vendor_name)

    res = client.post("/auth/google", json={
        "credential": cred,
        "role": "VENDOR",
        "shop_name": "Organic Green Store",
        "category": "grocery",
        "phone_number": "9876543210",
        "upi_id": "organic@upi",
        "address": "123 Market Street, Chennai",
        "latitude": 13.0827,
        "longitude": 80.2707
    })
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["email"] == vendor_email
    assert data["user"]["role"] == "VENDOR"
    assert data["user"]["is_shop_owner"] is True

    # Verify shop was created
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == vendor_email).first()
        assert user is not None
        shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
        assert shop is not None
        assert shop.name == "Organic Green Store"
        assert shop.approval_status == "PENDING"
    finally:
        db.close()


def test_google_auth_blocks_admin_escalation():
    cred = make_demo_google_credential("admin.try@gmail.com", "Admin Impersonator")
    res = client.post("/auth/google", json={
        "credential": cred,
        "role": "ADMIN"
    })
    assert res.status_code == 403
    assert "Platform Administrator must authenticate using administrator credentials" in res.json()["detail"]
