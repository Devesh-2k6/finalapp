import sys
import os
import base64
import json

sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from main import app
from db.models import User, Shop
from db.session import SessionLocal

client = TestClient(app)

def make_demo_google_credential(email: str, name: str) -> str:
    payload = json.dumps({"email": email, "name": name, "email_verified": True})
    b64 = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")
    return f"demo_google_{b64}"

print("=" * 60)
print("TESTING GOOGLE AUTHENTICATION (ACCURATE WORKING MODEL)")
print("=" * 60)

# Test 1: Empty credential rejected
res1 = client.post("/auth/google", json={"credential": ""})
assert res1.status_code == 401, f"Expected 401, got {res1.status_code}: {res1.text}"
print("[PASS] Test 1: Empty/missing Google credential correctly rejected (401)")

# Test 2: Invalid/fake credential rejected
res2 = client.post("/auth/google", json={"credential": "invalid_fake_token_12345"})
assert res2.status_code == 401, f"Expected 401, got {res2.status_code}: {res2.text}"
print("[PASS] Test 2: Invalid Google credential correctly rejected (401)")

# Test 3: Customer Sign Up via Google
test_email = "alex.google.customer@gmail.com"
test_name = "Alex Google Explorer"
cred = make_demo_google_credential(test_email, test_name)

res3 = client.post("/auth/google", json={
    "credential": cred,
    "role": "CUSTOMER"
})
assert res3.status_code == 200, f"Expected 200, got {res3.status_code}: {res3.text}"
data3 = res3.json()
assert "access_token" in data3
assert data3["user"]["email"] == test_email
assert data3["user"]["name"] == test_name
assert data3["user"]["role"] == "CUSTOMER"
assert data3["user"]["email_verified"] is True
print(f"[PASS] Test 3: Customer Google Sign-Up succeeded (Token issued, email verified: {data3['user']['email']})")

# Test 4: Existing Customer Sign In via Google
res4 = client.post("/auth/google", json={"credential": cred})
assert res4.status_code == 200, f"Expected 200, got {res4.status_code}: {res4.text}"
data4 = res4.json()
assert data4["user"]["email"] == test_email
assert "access_token" in data4
print(f"[PASS] Test 4: Existing Customer Google Sign-In succeeded without duplicate account creation")

# Test 5: Vendor Sign Up via Google with Store Creation
vendor_email = "greenvalley.google.vendor@gmail.com"
vendor_name = "Green Valley Mart"
vendor_cred = make_demo_google_credential(vendor_email, vendor_name)

res5 = client.post("/auth/google", json={
    "credential": vendor_cred,
    "role": "VENDOR",
    "shop_name": "Green Valley Organic Mart",
    "category": "grocery",
    "phone_number": "9876543210",
    "address": "45 Central Market Road, Bangalore",
    "latitude": 12.9716,
    "longitude": 77.5946
})
assert res5.status_code == 200, f"Expected 200, got {res5.status_code}: {res5.text}"
data5 = res5.json()
assert data5["user"]["email"] == vendor_email
assert data5["user"]["role"] == "VENDOR"
assert data5["user"]["is_shop_owner"] is True

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == vendor_email).first()
    assert user is not None
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    assert shop is not None
    assert shop.name == "Green Valley Organic Mart"
    assert shop.approval_status == "PENDING"
    print(f"[PASS] Test 5: Vendor Google Sign-Up created user and shop: '{shop.name}'")
finally:
    db.close()

# Test 6: Admin impersonation / elevation blocked
admin_cred = make_demo_google_credential("admin.impersonator@gmail.com", "Malicious Admin Try")
res6 = client.post("/auth/google", json={
    "credential": admin_cred,
    "role": "ADMIN"
})
assert res6.status_code == 403, f"Expected 403, got {res6.status_code}: {res6.text}"
print("[PASS] Test 6: Admin role elevation via Google strictly blocked (403 Forbidden)")

print("=" * 60)
print("ALL 6 GOOGLE AUTHENTICATION TESTS PASSED SUCCESSFULLY!")
print("=" * 60)
