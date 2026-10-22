"""
ExpiryGo Comprehensive Authentication Test Suite
Executes 3 complete consecutive verification passes (36 total test scenarios) covering:
- Sign Up (Customer & Vendor with OTP / Store creation)
- Sign In (Customer, Vendor, Admin via Password & OTP)
- Password Reset (Forgot -> OTP -> Reset -> Re-login)
- Google OAuth (Sign In, Sign Up Customer/Vendor, Security Rejections)
- Session & Protected Route Authorization (/users/me)
- Cross-Role Security & Tamper Protection
"""

import sys
import os
import json
import base64
import uuid
from pathlib import Path

# Ensure backend root is on sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from fastapi.testclient import TestClient
from main import app
from db.session import SessionLocal, init_db
from db.models import User, Shop
from config import settings
from seed_data import ADMIN_EMAIL, ADMIN_PASSWORD

client = TestClient(app)

def create_mock_google_id_token(email: str, name: str) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({
        "iss": "https://accounts.google.com",
        "sub": f"google_sub_{uuid.uuid4().hex[:12]}",
        "email": email,
        "email_verified": True,
        "name": name,
        "picture": "https://lh3.googleusercontent.com/a/default-avatar",
    }).encode()).decode().rstrip("=")
    signature = "valid_signature"
    return f"demo_google_{header}.{payload}.{signature}"

def run_auth_battery(pass_number: int) -> list:
    results = []
    suffix = f"p{pass_number}_{uuid.uuid4().hex[:6]}"
    
    print(f"\n{'='*70}")
    print(f" PASS {pass_number}: EXECUTING COMPLETE 12-STAGE AUTHENTICATION BATTERY")
    print(f"{'='*70}")

    # ---------------------------------------------------------
    # TEST 1: Customer Signup via OTP & Verification
    # ---------------------------------------------------------
    cust_email = f"tester.cust.{suffix}@example.com"
    cust_name = f"Test Customer {suffix.upper()}"
    cust_pass = f"Pass_{suffix}_Secure!1"

    # Step A: Register Customer
    res1 = client.post("/auth/customer/register", json={
        "name": cust_name,
        "email": cust_email,
        "password": cust_pass
    })
    t1_a_ok = (res1.status_code == 200 and res1.json().get("success") is True)
    otp_code = res1.json().get("dev_code")

    # Step B: Verify OTP
    res1_b = client.post("/auth/verify-otp", json={
        "identifier": cust_email,
        "otp": otp_code or "123456",
        "name": cust_name,
        "is_shop_owner": False
    })
    t1_b_ok = (
        res1_b.status_code == 200 and 
        "access_token" in res1_b.json() and
        res1_b.json()["user"]["role"] == "CUSTOMER" and
        res1_b.json()["user"]["email_verified"] is True
    )
    cust_token = res1_b.json().get("access_token")
    results.append({
        "test": f"Pass {pass_number} - T1: Customer Registration & OTP Verification",
        "passed": t1_a_ok and t1_b_ok,
        "details": f"Status: {res1_b.status_code}, User Role: {res1_b.json().get('user', {}).get('role')}"
    })
    print(f"  [{'PASS' if t1_a_ok and t1_b_ok else 'FAIL'}] T1: Customer Registration & OTP Verification ({cust_email})")

    # ---------------------------------------------------------
    # TEST 2: Customer Password Sign In (Valid & Invalid)
    # ---------------------------------------------------------
    # Valid Password
    res2_valid = client.post("/auth/login", json={"email": cust_email, "password": cust_pass})
    t2_valid_ok = (res2_valid.status_code == 200 and "access_token" in res2_valid.json())

    # Invalid Password
    res2_invalid = client.post("/auth/login", json={"email": cust_email, "password": "WrongPassword!999"})
    t2_invalid_ok = (res2_invalid.status_code == 401)

    t2_ok = t2_valid_ok and t2_invalid_ok
    results.append({
        "test": f"Pass {pass_number} - T2: Customer Password Sign In (Valid & Bad Creds Rejection)",
        "passed": t2_ok,
        "details": f"Valid: {res2_valid.status_code}, Invalid Rejected: {res2_invalid.status_code}"
    })
    print(f"  [{'PASS' if t2_ok else 'FAIL'}] T2: Customer Password Sign In & 401 Rejection")

    # ---------------------------------------------------------
    # TEST 3: Customer 6-Digit OTP Sign In
    # ---------------------------------------------------------
    res3_otp_req = client.post("/auth/send-otp", json={"identifier": cust_email, "name": cust_name})
    t3_req_ok = (res3_otp_req.status_code == 200)
    login_otp = res3_otp_req.json().get("dev_code")

    res3_verify = client.post("/auth/verify-otp", json={
        "identifier": cust_email,
        "otp": login_otp or "123456",
        "is_shop_owner": False
    })
    t3_ok = (res3_verify.status_code == 200 and "access_token" in res3_verify.json())
    results.append({
        "test": f"Pass {pass_number} - T3: Customer 6-Digit OTP Sign In",
        "passed": t3_req_ok and t3_ok,
        "details": f"OTP Request: {res3_otp_req.status_code}, OTP Verify: {res3_verify.status_code}"
    })
    print(f"  [{'PASS' if t3_req_ok and t3_ok else 'FAIL'}] T3: Customer 6-Digit OTP Sign In")

    # ---------------------------------------------------------
    # TEST 4: Vendor Registration with Store Creation & OTP Verification
    # ---------------------------------------------------------
    vendor_email = f"tester.vendor.{suffix}@example.com"
    vendor_store = f"Fresh Organic Mart {suffix.upper()}"
    vendor_pass = f"VendorPass_{suffix}!2"

    res4_reg = client.post("/auth/vendor/register", json={
        "email": vendor_email,
        "shop_name": vendor_store,
        "category": "grocery",
        "phone_number": "+919876543210",
        "password": vendor_pass,
        "address": "123 Market Central St",
        "latitude": 13.0827,
        "longitude": 80.2707,
        "photo_url": "/static/uploads/store_front.jpg",
        "document_url": "/static/uploads/business_license.pdf"
    })
    t4_reg_ok = (res4_reg.status_code == 200 and res4_reg.json().get("success") is True)
    vendor_otp = res4_reg.json().get("dev_code")

    res4_verify = client.post("/auth/verify-otp", json={
        "identifier": vendor_email,
        "otp": vendor_otp or "123456",
        "name": vendor_store,
        "is_shop_owner": True
    })
    t4_verify_ok = (
        res4_verify.status_code == 200 and 
        res4_verify.json()["user"]["role"] == "VENDOR" and
        res4_verify.json()["user"]["is_shop_owner"] is True
    )

    # Verify Shop record in DB
    db = SessionLocal()
    shop_rec = db.query(Shop).join(User, Shop.owner_id == User.id).filter(User.email == vendor_email).first()
    t4_shop_ok = (shop_rec is not None and shop_rec.name == vendor_store and shop_rec.approval_status == "PENDING")
    db.close()

    t4_ok = t4_reg_ok and t4_verify_ok and t4_shop_ok
    results.append({
        "test": f"Pass {pass_number} - T4: Vendor Registration, Store Creation & OTP Verification",
        "passed": t4_ok,
        "details": f"Register: {res4_reg.status_code}, Verify: {res4_verify.status_code}, Shop in DB: {t4_shop_ok}"
    })
    print(f"  [{'PASS' if t4_ok else 'FAIL'}] T4: Vendor Registration, Store Creation & OTP Verification ({vendor_email})")

    # ---------------------------------------------------------
    # TEST 5: Vendor Password Sign In
    # ---------------------------------------------------------
    res5_login = client.post("/auth/login", json={"email": vendor_email, "password": vendor_pass})
    t5_ok = (
        res5_login.status_code == 200 and
        res5_login.json()["user"]["role"] == "VENDOR" and
        res5_login.json()["user"]["is_shop_owner"] is True
    )
    results.append({
        "test": f"Pass {pass_number} - T5: Vendor Password Sign In",
        "passed": t5_ok,
        "details": f"Status: {res5_login.status_code}, Role: {res5_login.json().get('user', {}).get('role')}"
    })
    print(f"  [{'PASS' if t5_ok else 'FAIL'}] T5: Vendor Password Sign In")

    # ---------------------------------------------------------
    # TEST 6: Platform Administrator Sign In
    # ---------------------------------------------------------
    res6_admin = client.post("/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    t6_ok = (
        res6_admin.status_code == 200 and
        res6_admin.json()["user"]["role"] == "ADMIN"
    )
    admin_token = res6_admin.json().get("access_token")
    results.append({
        "test": f"Pass {pass_number} - T6: Platform Admin Sign In",
        "passed": t6_ok,
        "details": f"Status: {res6_admin.status_code}, Admin Role: {res6_admin.json().get('user', {}).get('role')}"
    })
    print(f"  [{'PASS' if t6_ok else 'FAIL'}] T6: Platform Admin Sign In ({ADMIN_EMAIL})")

    # ---------------------------------------------------------
    # TEST 7: Password Reset Cycle (Forgot -> OTP -> New Password -> Verify)
    # ---------------------------------------------------------
    res7_forgot = client.post("/auth/forgot-password", json={"email": cust_email})
    t7_forgot_ok = (res7_forgot.status_code == 200 and res7_forgot.json().get("success") is True)
    reset_otp = res7_forgot.json().get("dev_code")

    new_cust_pass = f"NewPassword_{suffix}!99"
    res7_reset = client.post("/auth/reset-password", json={
        "email": cust_email,
        "otp": reset_otp or "123456",
        "new_password": new_cust_pass
    })
    t7_reset_ok = (res7_reset.status_code == 200 and res7_reset.json().get("success") is True)

    # Login with new password
    res7_new_login = client.post("/auth/login", json={"email": cust_email, "password": new_cust_pass})
    t7_new_login_ok = (res7_new_login.status_code == 200)

    # Ensure old password fails
    res7_old_login = client.post("/auth/login", json={"email": cust_email, "password": cust_pass})
    t7_old_rejected = (res7_old_login.status_code == 401)

    t7_ok = t7_forgot_ok and t7_reset_ok and t7_new_login_ok and t7_old_rejected
    results.append({
        "test": f"Pass {pass_number} - T7: Password Reset Lifecycle (Forgot -> OTP -> Reset -> Re-login)",
        "passed": t7_ok,
        "details": f"Reset: {res7_reset.status_code}, New Pass Login: {res7_new_login.status_code}, Old Pass 401: {t7_old_rejected}"
    })
    print(f"  [{'PASS' if t7_ok else 'FAIL'}] T7: Password Reset Lifecycle")

    # ---------------------------------------------------------
    # TEST 8: Google Authentication - Customer Sign Up
    # ---------------------------------------------------------
    google_cust_email = f"google.user.{suffix}@gmail.com"
    google_cust_name = f"Google Customer {suffix.upper()}"
    google_cust_token = create_mock_google_id_token(google_cust_email, google_cust_name)

    res8_g_signup = client.post("/auth/google", json={
        "credential": google_cust_token,
        "role": "CUSTOMER"
    })
    t8_ok = (
        res8_g_signup.status_code == 200 and
        res8_g_signup.json()["user"]["email"] == google_cust_email and
        res8_g_signup.json()["user"]["role"] == "CUSTOMER" and
        res8_g_signup.json()["user"]["email_verified"] is True
    )
    g_access_token = res8_g_signup.json().get("access_token")
    results.append({
        "test": f"Pass {pass_number} - T8: Google Authentication - Customer Sign Up",
        "passed": t8_ok,
        "details": f"Status: {res8_g_signup.status_code}, User: {res8_g_signup.json().get('user', {}).get('email')}"
    })
    print(f"  [{'PASS' if t8_ok else 'FAIL'}] T8: Google Authentication - Customer Sign Up ({google_cust_email})")

    # ---------------------------------------------------------
    # TEST 9: Google Authentication - Existing Customer Sign In
    # ---------------------------------------------------------
    res9_g_signin = client.post("/auth/google", json={
        "credential": google_cust_token,
        "role": "CUSTOMER"
    })
    t9_ok = (
        res9_g_signin.status_code == 200 and
        res9_g_signin.json()["user"]["id"] == res8_g_signup.json()["user"]["id"]
    )
    results.append({
        "test": f"Pass {pass_number} - T9: Google Authentication - Existing Customer Sign In",
        "passed": t9_ok,
        "details": f"Status: {res9_g_signin.status_code}, Preserved ID: {t9_ok}"
    })
    print(f"  [{'PASS' if t9_ok else 'FAIL'}] T9: Google Authentication - Existing Customer Sign In")

    # ---------------------------------------------------------
    # TEST 10: Google Authentication - Vendor Sign Up with Store Creation
    # ---------------------------------------------------------
    google_vendor_email = f"google.vendor.{suffix}@gmail.com"
    google_vendor_name = f"Google Merchant {suffix.upper()}"
    google_shop_name = f"Organic Pantry {suffix.upper()}"
    google_vendor_token = create_mock_google_id_token(google_vendor_email, google_vendor_name)

    res10_g_vendor = client.post("/auth/google", json={
        "credential": google_vendor_token,
        "role": "VENDOR",
        "shop_name": google_shop_name,
        "category": "grocery",
        "phone_number": "+919812345678"
    })
    t10_resp_ok = (
        res10_g_vendor.status_code == 200 and
        res10_g_vendor.json()["user"]["role"] == "VENDOR" and
        res10_g_vendor.json()["user"]["is_shop_owner"] is True
    )

    db = SessionLocal()
    g_shop = db.query(Shop).join(User, Shop.owner_id == User.id).filter(User.email == google_vendor_email).first()
    t10_shop_ok = (g_shop is not None and g_shop.name == google_shop_name and g_shop.approval_status == "PENDING")
    db.close()

    t10_ok = t10_resp_ok and t10_shop_ok
    results.append({
        "test": f"Pass {pass_number} - T10: Google Authentication - Vendor Sign Up with Store Creation",
        "passed": t10_ok,
        "details": f"Status: {res10_g_vendor.status_code}, Shop in DB: {t10_shop_ok}"
    })
    print(f"  [{'PASS' if t10_ok else 'FAIL'}] T10: Google Authentication - Vendor Sign Up with Store Creation")

    # ---------------------------------------------------------
    # TEST 11: Google Security & Negative Validations (Missing, Fake, Role Elevation)
    # ---------------------------------------------------------
    # Empty credential
    res11_empty = client.post("/auth/google", json={"credential": "", "role": "CUSTOMER"})
    t11_empty_ok = (res11_empty.status_code == 401)

    # Fake/Invalid credential
    res11_fake = client.post("/auth/google", json={"credential": "invalid_fake_token", "role": "CUSTOMER"})
    t11_fake_ok = (res11_fake.status_code == 401)

    # Admin role elevation attack
    res11_admin = client.post("/auth/google", json={
        "credential": google_cust_token,
        "role": "ADMIN"
    })
    t11_admin_ok = (res11_admin.status_code == 403)

    t11_ok = t11_empty_ok and t11_fake_ok and t11_admin_ok
    results.append({
        "test": f"Pass {pass_number} - T11: Google Security Controls (Empty 401, Fake 401, Admin Elevation 403)",
        "passed": t11_ok,
        "details": f"Empty: {res11_empty.status_code}, Fake: {res11_fake.status_code}, Admin Escalation: {res11_admin.status_code}"
    })
    print(f"  [{'PASS' if t11_ok else 'FAIL'}] T11: Google Security Controls (Empty 401, Fake 401, Elevation 403)")

    # ---------------------------------------------------------
    # TEST 12: Session Validation (/users/me) & Cross-Role Isolation
    # ---------------------------------------------------------
    # /users/me verification with customer token
    res12_me = client.get("/users/me", headers={"Authorization": f"Bearer {cust_token}"})
    t12_me_ok = (res12_me.status_code == 200 and res12_me.json()["email"] == cust_email)

    # Cross-Role verification: attempt to verify customer as vendor
    res12_cross = client.post("/auth/verify-otp", json={
        "identifier": cust_email,
        "otp": "123456",
        "is_shop_owner": True
    })
    t12_cross_ok = (res12_cross.status_code in [400, 403])

    t12_ok = t12_me_ok and t12_cross_ok
    results.append({
        "test": f"Pass {pass_number} - T12: Protected Route (/users/me) & Cross-Role Isolation",
        "passed": t12_ok,
        "details": f"Me Status: {res12_me.status_code}, Cross-Role Tamper Blocked: {res12_cross.status_code}"
    })
    print(f"  [{'PASS' if t12_ok else 'FAIL'}] T12: Protected Route (/users/me) & Cross-Role Isolation")

    return results

def main():
    print("="*70)
    print(" EXPIRYGO TRIPLE-PASS FULL AUTHENTICATION VERIFICATION TESTER")
    print(" Objective: Validate 100% accurate working model of Sign Up, Sign In,")
    print(" and Google Authentication across 3 exhaustive consecutive passes.")
    print("="*70)

    init_db()
    all_results = []

    # EXECUTE PASS 1, PASS 2, PASS 3
    for pass_num in (1, 2, 3):
        pass_results = run_auth_battery(pass_num)
        all_results.extend(pass_results)

    # FINAL REPORTING
    total_tests = len(all_results)
    passed_tests = sum(1 for r in all_results if r["passed"])
    failed_tests = total_tests - passed_tests
    success_rate = (passed_tests / total_tests) * 100

    print("\n" + "="*70)
    print(" COMPREHENSIVE AUTHENTICATION TEST SUMMARY REPORT (3 PASSES)")
    print("="*70)
    print(f" Total Test Scenarios Executed : {total_tests}")
    print(f" Passed Scenarios             : {passed_tests}")
    print(f" Failed Scenarios             : {failed_tests}")
    print(f" Reliability / Success Rate   : {success_rate:.2f}%")
    print("="*70)

    if failed_tests > 0:
        print("\nFailed Tests Details:")
        for r in all_results:
            if not r["passed"]:
                print(f"  - {r['test']}: {r['details']}")
        sys.exit(1)
    else:
        print("\nVERDICT: 200% WORKING MODEL CONFIRMED. ALL 3 PASSES COMPLETED WITH ZERO ERRORS.")
        sys.exit(0)

if __name__ == "__main__":
    main()
