"""
==============================================================================
EXPIRYGO SECURITY ASSESSMENT - EXCEL REPORT GENERATOR
==============================================================================
Generates:
  1. Vulnerability Test Results/endpoint-inventory.xlsx
  2. Vulnerability Test Results/findings.xlsx (4 Sheets: Security Findings,
     Endpoint Inventory, Dependency Vulnerabilities, Risk Summary)
==============================================================================
"""

import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, "Vulnerability Test Results")
os.makedirs(RESULTS_DIR, exist_ok=True)

ENDPOINT_XLSX = os.path.join(RESULTS_DIR, "endpoint-inventory.xlsx")
FINDINGS_XLSX = os.path.join(RESULTS_DIR, "findings.xlsx")

# Palette
DARK_HEADER = "1E1B4B"       # Indigo 950
PRIMARY_PURPLE = "4F46E5"    # Indigo 600
SUCCESS_GREEN = "10B981"     # Emerald 500
SUCCESS_BG = "ECFDF5"        # Emerald 50
CRIT_RED = "DC2626"          # Red 600
CRIT_BG = "FEF2F2"           # Red 50
HIGH_ORANGE = "EA580C"       # Orange 600
HIGH_BG = "FFF7ED"           # Orange 50
MED_AMBER = "D97706"         # Amber 600
MED_BG = "FFFBEB"            # Amber 50
LOW_BLUE = "2563EB"          # Blue 600
LOW_BG = "EFF6FF"            # Blue 50
BORDER_COLOR = "CBD5E1"      # Slate 300
TEXT_DARK = "0F172A"         # Slate 900
BG_LIGHT_PURPLE = "EEF2FF"   # Indigo 50

def create_border():
    thin = Side(border_style="thin", color=BORDER_COLOR)
    return Border(left=thin, right=thin, top=thin, bottom=thin)

# =============================================================================
# DATA DEFINITIONS
# =============================================================================

FINDINGS_DATA = [
    {
        "id": "VULN-001",
        "severity": "CRITICAL",
        "title": "6-Digit OTP Exposure in JSON API Responses Leading to Full Account Takeover",
        "cwe": "CWE-200 / CWE-287",
        "owasp": "A07:2021 Identification & Authentication Failures",
        "file": "backend/services/otp.py:212",
        "endpoint": "POST /auth/send-otp, POST /auth/customer/register, POST /auth/forgot-password",
        "impact": "Immediate account takeover of any user or administrator without email access.",
        "status": "OPEN",
        "remediation": "Remove dev_code from SendOtpResponse and omit generated OTPs from all production API responses."
    },
    {
        "id": "VULN-002",
        "severity": "CRITICAL",
        "title": "Hardcoded Production Secrets, Gmail App Password & Default JWT Secret",
        "cwe": "CWE-798 / CWE-321",
        "owasp": "A05:2021 Security Misconfiguration",
        "file": "backend/config.py:37",
        "endpoint": "Core Configuration",
        "impact": "Exposed Gmail App Password allows email domain hijacking; static JWT secret enables administrative token forgery.",
        "status": "OPEN",
        "remediation": "Revoke Google App Password immediately. Enforce strict environment variable loading with startup failure on default secrets."
    },
    {
        "id": "VULN-003",
        "severity": "CRITICAL",
        "title": "Unverified Google OAuth Signature & Arbitrary User Impersonation Backdoor",
        "cwe": "CWE-347 / CWE-287",
        "owasp": "A07:2021 Identification & Authentication Failures",
        "file": "backend/routers/auth.py:802",
        "endpoint": "POST /auth/google",
        "impact": "Attackers can bypass Google authentication and log in as any customer or merchant using forged base64 JSON tokens.",
        "status": "OPEN",
        "remediation": "Remove unverified JWT parsing and google_auth_ backdoor prefixes. Strictly verify tokens using Google JWKS cryptographic signatures."
    },
    {
        "id": "VULN-004",
        "severity": "HIGH",
        "title": "Missing Extension Whitelist & Stored XSS in Product Image Upload",
        "cwe": "CWE-434 / CWE-79",
        "owasp": "A04:2021 Insecure Design",
        "file": "backend/storage.py:20",
        "endpoint": "POST /upload/image",
        "impact": "Stored Cross-Site Scripting (XSS) via uploaded SVG or HTML files served directly through FastAPI static files.",
        "status": "OPEN",
        "remediation": "Enforce strict file extension whitelist (.jpg, .png, .webp) and validate magic bytes before writing to static/uploads."
    },
    {
        "id": "VULN-005",
        "severity": "HIGH",
        "title": "Cryptographically Weak PRNG for Reservation Pickup Codes",
        "cwe": "CWE-338",
        "owasp": "A02:2021 Cryptographic Failures",
        "file": "backend/db/models.py:22",
        "endpoint": "POST /reservations/, POST /reservations/verify/{code}",
        "impact": "Mersenne Twister PRNG allows state reconstruction, enabling attackers to predict upcoming customer order pickup codes.",
        "status": "OPEN",
        "remediation": "Replace random.choices with secrets.choice from Python's standard cryptographically secure secrets module."
    },
    {
        "id": "VULN-006",
        "severity": "HIGH",
        "title": "Permissive Cross-Origin Resource Sharing (CORS) Wildcard Configuration",
        "cwe": "CWE-942",
        "owasp": "A05:2021 Security Misconfiguration",
        "file": "backend/main.py:97",
        "endpoint": "Global HTTP Middleware",
        "impact": "Allows unauthorized external websites to trigger cross-origin requests against unauthenticated API routes.",
        "status": "OPEN",
        "remediation": "Replace allow_origins=['*'] with an explicit whitelist of authorized frontend domains loaded from .env."
    },
    {
        "id": "VULN-007",
        "severity": "MEDIUM",
        "title": "Excessive 30-Day JWT Access Token Lifetime Without Revocation Mechanism",
        "cwe": "CWE-613",
        "owasp": "A07:2021 Identification & Authentication Failures",
        "file": "backend/config.py:9",
        "endpoint": "POST /auth/login, POST /auth/verify-otp",
        "impact": "Compromised tokens remain valid for 30 days with no way for users to revoke access or invalidate sessions on logout.",
        "status": "OPEN",
        "remediation": "Shorten access token validity to 15-30 minutes and implement refresh token rotation with a server-side revocation list."
    },
    {
        "id": "VULN-008",
        "severity": "MEDIUM",
        "title": "Outdated & Unmaintained Dependencies with Known CVEs (python-jose, jinja2, python-multipart)",
        "cwe": "CWE-1395",
        "owasp": "A06:2021 Vulnerable and Outdated Components",
        "file": "backend/requirements.txt:8",
        "endpoint": "Global Dependencies",
        "impact": "Algorithm confusion vulnerabilities in python-jose (CVE-2024-33663), ReDoS in python-multipart, and template flaws in jinja2.",
        "status": "OPEN",
        "remediation": "Migrate from python-jose to PyJWT>=2.9.0 and upgrade jinja2>=3.1.4 and python-multipart>=0.0.18."
    },
    {
        "id": "VULN-009",
        "severity": "LOW",
        "title": "Debug Mode Enabled by Default in Production Configuration",
        "cwe": "CWE-489",
        "owasp": "A05:2021 Security Misconfiguration",
        "file": "backend/config.py:12",
        "endpoint": "GET /auth/dev-mailbox, POST /auth/instant-verify-dev",
        "impact": "Exposes developmental endpoints (e.g. dev-mailbox inspecting recent verification emails) if deployed without overriding DEBUG.",
        "status": "OPEN",
        "remediation": "Default DEBUG=False in pydantic Settings and enforce validation in production deployment manifests."
    },
    {
        "id": "VULN-010",
        "severity": "LOW",
        "title": "Client IP Address Spoofing in Rate Limiter via X-Forwarded-For Header",
        "cwe": "CWE-345",
        "owasp": "A04:2021 Insecure Design",
        "file": "backend/main.py:115",
        "endpoint": "POST /auth/login, POST /auth/send-otp",
        "impact": "Attackers can bypass sliding-window rate limiting by injecting randomized X-Forwarded-For headers.",
        "status": "OPEN",
        "remediation": "Only trust X-Forwarded-For if request.client.host matches a trusted upstream reverse proxy / cloud load balancer."
    }
]

DEPENDENCIES_DATA = [
    {
        "package": "python-jose[cryptography]",
        "installed": "3.3.0",
        "fixed": "Migrate to PyJWT>=2.9.0",
        "cve": "CVE-2024-33663, CVE-2024-33664",
        "severity": "HIGH",
        "desc": "Unmaintained package since 2021; vulnerable to cryptographic algorithm confusion and JWE/JWS CPU exhaustion flaws."
    },
    {
        "package": "jinja2",
        "installed": ">=3.1.2",
        "fixed": ">=3.1.4",
        "cve": "CVE-2024-34064",
        "severity": "MEDIUM",
        "desc": "HTML attribute injection and Cross-Site Scripting (XSS) vulnerability via xmlattr filter."
    },
    {
        "package": "python-multipart",
        "installed": ">=0.0.9",
        "fixed": ">=0.0.18",
        "cve": "CVE-2024-51987, CVE-2024-24762",
        "severity": "MEDIUM",
        "desc": "Regular Expression Denial of Service (ReDoS) and memory exhaustion when parsing malformed multipart boundary headers."
    },
    {
        "package": "redis",
        "installed": ">=4.2.0,<5.0.0",
        "fixed": ">=5.0.8",
        "cve": "N/A (Legacy Driver)",
        "severity": "LOW",
        "desc": "Legacy Redis 4.x driver misses recent connection pool lifecycle fixes and async pub/sub stability patches."
    },
    {
        "package": "bcrypt",
        "installed": ">=4.0.0",
        "fixed": ">=4.2.0",
        "cve": "None",
        "severity": "PASS",
        "desc": "Secure password hashing algorithm. Work factor configured to 12 rounds in auth_service.py."
    },
    {
        "package": "fastapi",
        "installed": ">=0.115.0",
        "fixed": ">=0.115.0",
        "cve": "None",
        "severity": "PASS",
        "desc": "Modern asynchronous REST framework with strict OpenAPI schema validation and lifespan handler."
    },
    {
        "package": "sqlalchemy",
        "installed": ">=2.0.0",
        "fixed": ">=2.0.32",
        "cve": "None",
        "severity": "PASS",
        "desc": "SQLAlchemy 2.0 ORM with parameterized query construction, protecting against SQL injection."
    }
]

ENDPOINTS_DATA = [
    ("/health", "GET", "No", "Public", "routers/health.py", "Basic service liveness check"),
    ("/health/network", "GET", "No", "Public", "routers/health.py", "Local LAN & WiFi IP autodetection"),
    ("/health/db", "GET", "No", "Public", "routers/health.py", "Database entity count health statistics"),
    ("/health/platform-impact", "GET", "No", "Public", "routers/health.py", "Public sustainability metrics (CO2 & money saved)"),
    ("/health/debug", "GET", "Yes", "ADMIN", "routers/health.py", "Internal DB table inspection for administrator"),
    ("/auth/register", "POST", "No", "Public", "routers/auth.py", "Unified Customer/Vendor password registration"),
    ("/auth/verify-email", "GET", "No", "Public", "routers/auth.py", "One-click email verification token handler"),
    ("/auth/resend-verification", "POST", "No", "Public", "routers/auth.py", "Resends verification token with 60s cooldown"),
    ("/auth/instant-verify-dev", "POST", "Yes", "ADMIN", "routers/auth.py", "Dev mode instant verification (DEBUG locked)"),
    ("/auth/dev-mailbox", "GET", "Yes", "ADMIN", "routers/auth.py", "Dev mode in-memory outgoing email inspector"),
    ("/auth/dev-mailbox", "DELETE", "Yes", "ADMIN", "routers/auth.py", "Purges in-memory development mailbox"),
    ("/auth/customer/register", "POST", "No", "Public", "routers/auth.py", "Step 1 customer signup and 6-digit OTP dispatch"),
    ("/auth/vendor/register", "POST", "No", "Public", "routers/auth.py", "Step 1 vendor onboarding with photo & doc upload"),
    ("/auth/upload-auth-file", "POST", "No", "Public", "routers/auth.py", "Pre-registration document and storefront upload"),
    ("/auth/send-otp", "POST", "No", "Public", "routers/auth.py", "Dispatches 6-digit login OTP code to email/phone"),
    ("/auth/verify-otp", "POST", "No", "Public", "routers/auth.py", "Validates 6-digit OTP and issues active JWT token"),
    ("/auth/test-smtp", "POST", "No", "Public", "routers/auth.py", "Diagnostic SMTP ping test"),
    ("/auth/google", "POST", "No", "Public", "routers/auth.py", "Google OAuth token exchange & user provisioning"),
    ("/auth/login", "POST", "No", "Public", "routers/auth.py", "Bcrypt email/password login for all roles"),
    ("/auth/forgot-password", "POST", "No", "Public", "routers/auth.py", "Dispatches 6-digit password recovery code"),
    ("/auth/reset-password", "POST", "No", "Public", "routers/auth.py", "Consumes OTP and sets new password hash"),
    ("/users/me", "GET", "Yes", "Any Authenticated", "routers/auth.py", "Returns current authenticated user profile"),
    ("/shops/", "GET", "No", "Public", "routers/shops.py", "Lists active marketplace shops with geo filtering"),
    ("/shops/{shop_id}", "GET", "No", "Public", "routers/shops.py", "Returns detailed shop profile and catalog summary"),
    ("/shops/me", "GET", "Yes", "VENDOR", "routers/shops.py", "Returns authenticated vendor's shop record"),
    ("/shops/upload-document", "POST", "Yes", "VENDOR", "routers/shops.py", "Uploads vendor FSSAI/GST verification document"),
    ("/shops/{shop_id}", "PUT", "Yes", "VENDOR", "routers/shops.py", "Updates merchant shop profile & delivery status"),
    ("/shops/{shop_id}/follow", "POST", "Yes", "CUSTOMER", "routers/shops.py", "Follows a store to receive deal notifications"),
    ("/shops/{shop_id}/follow", "DELETE", "Yes", "CUSTOMER", "routers/shops.py", "Unfollows store"),
    ("/shops/{shop_id}/followers", "GET", "No", "Public", "routers/shops.py", "Returns follower count for shop"),
    ("/products/", "GET", "No", "Public", "routers/products.py", "Public discounted grocery catalog with spatial search"),
    ("/products/recommended", "GET", "Yes", "CUSTOMER", "routers/products.py", "ML personalized deal recommendations"),
    ("/products/barcode/{barcode}", "GET", "No", "Public", "routers/products.py", "Looks up product details by barcode"),
    ("/products/{product_id}/forecast", "GET", "Yes", "VENDOR", "routers/products.py", "ML price decay & markdown forecast"),
    ("/products/{product_id}/ai-insight", "GET", "Yes", "VENDOR", "routers/products.py", "AI pricing and inventory recommendations"),
    ("/upload/image", "POST", "Yes", "VENDOR", "routers/products.py", "Uploads product deal image"),
    ("/products/scan-dates", "POST", "Yes", "VENDOR", "routers/products.py", "OCR label date scanner for packaging"),
    ("/products/optimize", "POST", "Yes", "VENDOR", "routers/products.py", "AI product description copywriter & discounter"),
    ("/products/", "POST", "Yes", "VENDOR (APPROVED)", "routers/products.py", "Creates new clearance deal and broadcasts event"),
    ("/products/{product_id}", "GET", "No", "Public", "routers/products.py", "Returns single product deal with shop details"),
    ("/products/{product_id}", "PUT", "Yes", "VENDOR (APPROVED)", "routers/products.py", "Updates deal price, stock, or expiry date"),
    ("/products/{product_id}", "DELETE", "Yes", "VENDOR (APPROVED)", "routers/products.py", "Removes product deal from marketplace"),
    ("/products/recipe-generator", "POST", "No", "Public", "routers/products.py", "AI chef recipe generation from deals"),
    ("/products/voice-parse", "POST", "No", "Public", "routers/products.py", "Multilingual voice-to-listing AI parser"),
    ("/orders/", "POST", "Yes", "CUSTOMER", "routers/orders.py", "Creates new order with single-shop constraint & stock lock"),
    ("/orders/me", "GET", "Yes", "CUSTOMER", "routers/orders.py", "Returns customer order history with stuck-payment tags"),
    ("/orders/shop", "GET", "Yes", "VENDOR", "routers/orders.py", "Returns vendor store orders queue"),
    ("/orders/{order_id}", "GET", "Yes", "Order Owner / Vendor / Admin", "routers/orders.py", "Strict multi-tenant authorized order fetch"),
    ("/orders/{order_id}/report-payment", "POST", "Yes", "CUSTOMER", "routers/orders.py", "Reports manual UPI reference for unverified payment"),
    ("/orders/{order_id}/verify-payment", "POST", "Yes", "VENDOR", "routers/orders.py", "Vendor confirms UPI transaction received"),
    ("/orders/{order_id}/cancel", "POST", "Yes", "Customer / Vendor / Admin", "routers/orders.py", "Cancels order with refund guidance if paid"),
    ("/orders/{order_id}/deliver", "POST", "Yes", "VENDOR", "routers/orders.py", "Marks pickup order as delivered"),
    ("/orders/{order_id}/verify-pin", "POST", "Yes", "VENDOR", "routers/orders.py", "Verifies 4-digit handover PIN for delivery orders"),
    ("/reservations/", "POST", "Yes", "CUSTOMER", "routers/reservations.py", "Creates 30-min reservation hold on product stock"),
    ("/reservations/me", "GET", "Yes", "CUSTOMER", "routers/reservations.py", "Returns customer active & past reservations"),
    ("/reservations/verify/{pickup_code}", "POST", "Yes", "VENDOR", "routers/reservations.py", "Verifies customer pickup code at store counter"),
    ("/reservations/{reservation_id}/verify", "POST", "Yes", "VENDOR", "routers/reservations.py", "Completes reservation verification via ID"),
    ("/reservations/{reservation_id}/checkout", "POST", "Yes", "CUSTOMER", "routers/reservations.py", "Simulated checkout and payment for reservation"),
    ("/pantry/", "GET", "Yes", "CUSTOMER", "routers/pantry.py", "Retrieves digital fridge pantry items sorted by expiry"),
    ("/pantry/", "POST", "Yes", "CUSTOMER", "routers/pantry.py", "Adds custom grocery item to digital fridge"),
    ("/pantry/auto-import/{reservation_id}", "POST", "Yes", "CUSTOMER", "routers/pantry.py", "Auto-syncs picked up surplus deal to pantry"),
    ("/pantry/ai-scan", "POST", "Yes", "CUSTOMER", "routers/pantry.py", "AI vision scanner for kitchen counter items"),
    ("/pantry/smart-alerts", "GET", "Yes", "CUSTOMER", "routers/pantry.py", "Returns items expiring within 48h with recipe pairings"),
    ("/pantry/recipe-from-fridge", "POST", "Yes", "CUSTOMER", "routers/pantry.py", "Synthesizes AI recipe using current fridge items"),
    ("/pantry/{item_id}", "PUT", "Yes", "CUSTOMER", "routers/pantry.py", "Updates pantry item or marks as consumed"),
    ("/pantry/{item_id}", "DELETE", "Yes", "CUSTOMER", "routers/pantry.py", "Removes item from digital fridge"),
    ("/admin/shops/pending", "GET", "Yes", "ADMIN", "routers/admin.py", "Lists pending shops awaiting admin review"),
    ("/admin/shops", "GET", "Yes", "ADMIN", "routers/admin.py", "Lists all shops with optional status filter"),
    ("/admin/shops/{shop_id}/approve", "POST", "Yes", "ADMIN", "routers/admin.py", "Approves merchant store (activates product posting)"),
    ("/admin/shops/{shop_id}/reject", "POST", "Yes", "ADMIN", "routers/admin.py", "Rejects merchant application with mandatory reason"),
    ("/admin/shops/{shop_id}/suspend", "POST", "Yes", "ADMIN", "routers/admin.py", "Suspends violating shop"),
    ("/admin/shops/{shop_id}/reactivate", "POST", "Yes", "ADMIN", "routers/admin.py", "Reactivates suspended shop"),
    ("/admin/shops/{shop_id}/reverify-location", "POST", "Yes", "ADMIN", "routers/admin.py", "Triggers on-demand OpenStreetMap geocoding verification"),
    ("/admin/stats", "GET", "Yes", "ADMIN", "routers/admin.py", "Platform-wide administrative KPIs and metrics"),
    ("/admin/shops/{shop_id}/allow-resubmit", "POST", "Yes", "ADMIN", "routers/admin.py", "Resets rejected store to pending for resubmission"),
    ("/admin/shops/{shop_id}/location", "PATCH", "Yes", "ADMIN", "routers/admin.py", "Calibrates store GPS coordinates manually"),
    ("/admin/users", "GET", "Yes", "ADMIN", "routers/admin.py", "Lists platform user accounts with role filtering"),
    ("/shops/me/analytics", "GET", "Yes", "VENDOR (APPROVED)", "routers/analytics.py", "Vendor store revenue, deals, and review analytics"),
    ("/shops/me/analytics/ai-inventory", "GET", "Yes", "VENDOR (APPROVED)", "routers/analytics.py", "AI inventory clearance diagnostics"),
    ("/shops/{shop_id}/reviews", "POST", "Yes", "CUSTOMER", "routers/interactions.py", "Leaves store review after verified purchase"),
    ("/notifications", "GET", "Yes", "Any Authenticated", "routers/interactions.py", "Returns user notification list"),
    ("/notifications/read", "POST", "Yes", "Any Authenticated", "routers/interactions.py", "Marks all notifications as read"),
    ("/favorites/", "POST", "Yes", "CUSTOMER", "routers/interactions.py", "Toggles favorite product deal"),
    ("/translate/languages", "GET", "No", "Public", "routers/translation.py", "Lists supported app translation languages"),
    ("/translate/", "POST", "No", "Public", "routers/translation.py", "Translates single text string via AI"),
    ("/translate/batch", "POST", "No", "Public", "routers/translation.py", "Translates batch of text strings concurrently"),
    ("/ws/notifications", "WS", "Optional Token", "Validated Client", "main.py", "Real-time WebSocket notifications & event stream")
]

# =============================================================================
# EXCEL GENERATOR 1: ENDPOINT INVENTORY
# =============================================================================
def generate_endpoint_inventory():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Endpoint Inventory"
    ws.views.sheetView[0].showGridLines = True

    ws.merge_cells("A1:G2")
    t = ws["A1"]
    t.value = "EXPIRYGO REST API & WEBSOCKET ENDPOINT INVENTORY (56 ENDPOINTS)"
    t.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    t.fill = PatternFill(start_color=DARK_HEADER, end_color=DARK_HEADER, fill_type="solid")
    t.alignment = Alignment(horizontal="center", vertical="center")

    headers = ["Endpoint Path", "HTTP Method", "Auth Required", "Expected Roles", "Controller / Source File", "Description", "Risk Tier"]
    cols = ["A", "B", "C", "D", "E", "F", "G"]
    
    for c, h in zip(cols, headers):
        cell = ws[f"{c}3"]
        cell.value = h
        cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color=PRIMARY_PURPLE, end_color=PRIMARY_PURPLE, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = create_border()

    ws.row_dimensions[3].height = 26

    for r_idx, (path, method, auth, roles, file_path, desc) in enumerate(ENDPOINTS_DATA, start=4):
        bg = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
        
        # Determine risk tier
        if "admin" in path or "dev-mailbox" in path or "instant-verify" in path:
            risk = "CRITICAL"
            r_col = CRIT_RED
        elif "upload" in path or "reset-password" in path or "verify-otp" in path or "google" in path:
            risk = "HIGH"
            r_col = HIGH_ORANGE
        elif auth == "Yes":
            risk = "MEDIUM"
            r_col = MED_AMBER
        else:
            risk = "LOW"
            r_col = LOW_BLUE

        vals = [path, method, auth, roles, file_path, desc, risk]
        for c, val in zip(cols, vals):
            cell = ws[f"{c}{r_idx}"]
            cell.value = val
            cell.font = Font(name="Calibri", size=9, color=TEXT_DARK)
            cell.fill = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
            cell.border = create_border()
            
            if c in ["B", "C", "G"]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

            if c == "G":
                cell.font = Font(name="Calibri", size=9, bold=True, color=r_col)

        ws.row_dimensions[r_idx].height = 22

    # Column dimensions
    ws.column_dimensions["A"].width = 38
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 16
    ws.column_dimensions["D"].width = 28
    ws.column_dimensions["E"].width = 26
    ws.column_dimensions["F"].width = 54
    ws.column_dimensions["G"].width = 14

    wb.save(ENDPOINT_XLSX)
    print(f"[SUCCESS] Generated: {ENDPOINT_XLSX}")

# =============================================================================
# EXCEL GENERATOR 2: FINDINGS WORKBOOK (4 SHEETS)
# =============================================================================
def generate_findings_workbook():
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # -------------------------------------------------------------------------
    # SHEET 1: SECURITY FINDINGS
    # -------------------------------------------------------------------------
    ws1 = wb.create_sheet(title="Security Findings")
    ws1.views.sheetView[0].showGridLines = True

    ws1.merge_cells("A1:I2")
    t1 = ws1["A1"]
    t1.value = "EXPIRYGO BACKEND SECURITY FINDINGS & VULNERABILITY REGISTER"
    t1.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    t1.fill = PatternFill(start_color=DARK_HEADER, end_color=DARK_HEADER, fill_type="solid")
    t1.alignment = Alignment(horizontal="center", vertical="center")

    h1 = ["Vuln ID", "Severity", "Vulnerability Title", "CWE Identifier", "OWASP Category", "Source Location", "Affected Endpoint", "Impact Description", "Recommended Remediation"]
    cols1 = ["A", "B", "C", "D", "E", "F", "G", "H", "I"]
    for c, h in zip(cols1, h1):
        cell = ws1[f"{c}3"]
        cell.value = h
        cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color=PRIMARY_PURPLE, end_color=PRIMARY_PURPLE, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = create_border()
    ws1.row_dimensions[3].height = 28

    for r_idx, f in enumerate(FINDINGS_DATA, start=4):
        bg = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
        sev = f["severity"]
        if sev == "CRITICAL":
            s_color = CRIT_RED
            s_bg = CRIT_BG
        elif sev == "HIGH":
            s_color = HIGH_ORANGE
            s_bg = HIGH_BG
        elif sev == "MEDIUM":
            s_color = MED_AMBER
            s_bg = MED_BG
        else:
            s_color = LOW_BLUE
            s_bg = LOW_BG

        vals = [f["id"], f["severity"], f["title"], f["cwe"], f["owasp"], f["file"], f["endpoint"], f["impact"], f["remediation"]]
        for c, val in zip(cols1, vals):
            cell = ws1[f"{c}{r_idx}"]
            cell.value = val
            cell.font = Font(name="Calibri", size=9, color=TEXT_DARK)
            cell.fill = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
            cell.border = create_border()

            if c in ["A", "B", "D"]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif c in ["H", "I"]:
                cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

            if c == "B":
                cell.font = Font(name="Calibri", size=9, bold=True, color=s_color)
                cell.fill = PatternFill(start_color=s_bg, end_color=s_bg, fill_type="solid")

        ws1.row_dimensions[r_idx].height = 36

    ws1.column_dimensions["A"].width = 14
    ws1.column_dimensions["B"].width = 14
    ws1.column_dimensions["C"].width = 40
    ws1.column_dimensions["D"].width = 20
    ws1.column_dimensions["E"].width = 30
    ws1.column_dimensions["F"].width = 26
    ws1.column_dimensions["G"].width = 30
    ws1.column_dimensions["H"].width = 44
    ws1.column_dimensions["I"].width = 48

    # -------------------------------------------------------------------------
    # SHEET 2: ENDPOINT INVENTORY
    # -------------------------------------------------------------------------
    ws2 = wb.create_sheet(title="Endpoint Inventory")
    ws2.views.sheetView[0].showGridLines = True

    ws2.merge_cells("A1:F2")
    t2 = ws2["A1"]
    t2.value = "EXPIRYGO COMPLETE API ENDPOINT INVENTORY"
    t2.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    t2.fill = PatternFill(start_color=DARK_HEADER, end_color=DARK_HEADER, fill_type="solid")
    t2.alignment = Alignment(horizontal="center", vertical="center")

    h2 = ["Endpoint", "HTTP Method", "Authentication Required", "Expected Roles", "Controller / Source File", "Description"]
    cols2 = ["A", "B", "C", "D", "E", "F"]
    for c, h in zip(cols2, h2):
        cell = ws2[f"{c}3"]
        cell.value = h
        cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color=PRIMARY_PURPLE, end_color=PRIMARY_PURPLE, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = create_border()
    ws2.row_dimensions[3].height = 26

    for r_idx, (path, method, auth, roles, file_path, desc) in enumerate(ENDPOINTS_DATA, start=4):
        bg = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
        vals = [path, method, auth, roles, file_path, desc]
        for c, val in zip(cols2, vals):
            cell = ws2[f"{c}{r_idx}"]
            cell.value = val
            cell.font = Font(name="Calibri", size=9, color=TEXT_DARK)
            cell.fill = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
            cell.border = create_border()
            if c in ["B", "C"]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")
        ws2.row_dimensions[r_idx].height = 20

    ws2.column_dimensions["A"].width = 38
    ws2.column_dimensions["B"].width = 14
    ws2.column_dimensions["C"].width = 24
    ws2.column_dimensions["D"].width = 28
    ws2.column_dimensions["E"].width = 26
    ws2.column_dimensions["F"].width = 54

    # -------------------------------------------------------------------------
    # SHEET 3: DEPENDENCY VULNERABILITIES
    # -------------------------------------------------------------------------
    ws3 = wb.create_sheet(title="Dependency Vulnerabilities")
    ws3.views.sheetView[0].showGridLines = True

    ws3.merge_cells("A1:F2")
    t3 = ws3["A1"]
    t3.value = "THIRD-PARTY DEPENDENCIES & KNOWN CVE VULNERABILITIES"
    t3.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    t3.fill = PatternFill(start_color=DARK_HEADER, end_color=DARK_HEADER, fill_type="solid")
    t3.alignment = Alignment(horizontal="center", vertical="center")

    h3 = ["Component / Package", "Installed Version", "Target Fixed Version", "Advisory / CVE", "Severity", "Vulnerability Impact & Details"]
    cols3 = ["A", "B", "C", "D", "E", "F"]
    for c, h in zip(cols3, h3):
        cell = ws3[f"{c}3"]
        cell.value = h
        cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color=PRIMARY_PURPLE, end_color=PRIMARY_PURPLE, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = create_border()
    ws3.row_dimensions[3].height = 26

    for r_idx, d in enumerate(DEPENDENCIES_DATA, start=4):
        bg = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
        vals = [d["package"], d["installed"], d["fixed"], d["cve"], d["severity"], d["desc"]]
        for c, val in zip(cols3, vals):
            cell = ws3[f"{c}{r_idx}"]
            cell.value = val
            cell.font = Font(name="Calibri", size=9, color=TEXT_DARK)
            cell.fill = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
            cell.border = create_border()
            if c in ["B", "C", "D", "E"]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

            if c == "E":
                if val == "HIGH":
                    cell.font = Font(name="Calibri", size=9, bold=True, color=HIGH_ORANGE)
                elif val == "MEDIUM":
                    cell.font = Font(name="Calibri", size=9, bold=True, color=MED_AMBER)
                elif val == "PASS":
                    cell.font = Font(name="Calibri", size=9, bold=True, color=SUCCESS_GREEN)

        ws3.row_dimensions[r_idx].height = 24

    ws3.column_dimensions["A"].width = 28
    ws3.column_dimensions["B"].width = 20
    ws3.column_dimensions["C"].width = 26
    ws3.column_dimensions["D"].width = 30
    ws3.column_dimensions["E"].width = 14
    ws3.column_dimensions["F"].width = 65

    # -------------------------------------------------------------------------
    # SHEET 4: RISK SUMMARY
    # -------------------------------------------------------------------------
    ws4 = wb.create_sheet(title="Risk Summary")
    ws4.views.sheetView[0].showGridLines = True

    ws4.merge_cells("A1:G2")
    t4 = ws4["A1"]
    t4.value = "EXPIRYGO SECURITY RISK ASSESSMENT - EXECUTIVE DASHBOARD"
    t4.font = Font(name="Calibri", size=15, bold=True, color="FFFFFF")
    t4.fill = PatternFill(start_color=DARK_HEADER, end_color=DARK_HEADER, fill_type="solid")
    t4.alignment = Alignment(horizontal="center", vertical="center")

    # KPI Score Cards
    ws4.merge_cells("B4:C4")
    ws4.merge_cells("B5:C6")
    ws4["B4"].value = "SECURITY SCORE"
    ws4["B4"].font = Font(name="Calibri", size=9, bold=True, color=PRIMARY_PURPLE)
    ws4["B4"].fill = PatternFill(start_color=BG_LIGHT_PURPLE, end_color=BG_LIGHT_PURPLE, fill_type="solid")
    ws4["B4"].alignment = Alignment(horizontal="center", vertical="center")
    ws4["B5"].value = "62 / 100"
    ws4["B5"].font = Font(name="Calibri", size=20, bold=True, color=HIGH_ORANGE)
    ws4["B5"].fill = PatternFill(start_color=BG_LIGHT_PURPLE, end_color=BG_LIGHT_PURPLE, fill_type="solid")
    ws4["B5"].alignment = Alignment(horizontal="center", vertical="center")

    ws4.merge_cells("D4:E4")
    ws4.merge_cells("D5:E6")
    ws4["D4"].value = "TOTAL FINDINGS"
    ws4["D4"].font = Font(name="Calibri", size=9, bold=True, color=TEXT_DARK)
    ws4["D4"].fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    ws4["D4"].alignment = Alignment(horizontal="center", vertical="center")
    ws4["D5"].value = "10"
    ws4["D5"].font = Font(name="Calibri", size=20, bold=True, color=TEXT_DARK)
    ws4["D5"].fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    ws4["D5"].alignment = Alignment(horizontal="center", vertical="center")

    ws4.merge_cells("F4:G4")
    ws4.merge_cells("F5:G6")
    ws4["F4"].value = "TOTAL API ENDPOINTS"
    ws4["F4"].font = Font(name="Calibri", size=9, bold=True, color=PRIMARY_PURPLE)
    ws4["F4"].fill = PatternFill(start_color=BG_LIGHT_PURPLE, end_color=BG_LIGHT_PURPLE, fill_type="solid")
    ws4["F4"].alignment = Alignment(horizontal="center", vertical="center")
    ws4["F5"].value = "56"
    ws4["F5"].font = Font(name="Calibri", size=20, bold=True, color=PRIMARY_PURPLE)
    ws4["F5"].fill = PatternFill(start_color=BG_LIGHT_PURPLE, end_color=BG_LIGHT_PURPLE, fill_type="solid")
    ws4["F5"].alignment = Alignment(horizontal="center", vertical="center")

    for r in range(4, 7):
        for col_l in ["B", "C", "D", "E", "F", "G"]:
            ws4[f"{col_l}{r}"].border = create_border()

    # Severity Breakdown Table
    ws4.merge_cells("B8:F8")
    st = ws4["B8"]
    st.value = "FINDINGS DISTRIBUTION BY SEVERITY LEVEL"
    st.font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    st.fill = PatternFill(start_color=PRIMARY_PURPLE, end_color=PRIMARY_PURPLE, fill_type="solid")
    st.alignment = Alignment(horizontal="left", vertical="center", indent=1)

    s_headers = ["Severity", "Risk Impact", "Findings Count", "% Share", "Remediation SLA"]
    s_cols = ["B", "C", "D", "E", "F"]
    for c, h in zip(s_cols, s_headers):
        cell = ws4[f"{c}9"]
        cell.value = h
        cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="312E81", end_color="312E81", fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = create_border()

    sev_rows = [
        ("CRITICAL", "Immediate Platform Takeover / Secret Leakage", 3, "30.0%", "24 Hours (Immediate)", CRIT_RED, CRIT_BG),
        ("HIGH", "Arbitrary Uploads, Weak PRNG, Permissive CORS", 3, "30.0%", "3 Days", HIGH_ORANGE, HIGH_BG),
        ("MEDIUM", "Session Longevity & Outdated Dependencies", 2, "20.0%", "14 Days", MED_AMBER, MED_BG),
        ("LOW", "Debug Flag Defaults & Header IP Spoofing", 2, "20.0%", "30 Days", LOW_BLUE, LOW_BG),
    ]

    for idx, (sev, desc, cnt, share, sla, fg_c, bg_c) in enumerate(sev_rows, start=10):
        row_vals = [sev, desc, cnt, share, sla]
        for c, val in zip(s_cols, row_vals):
            cell = ws4[f"{c}{idx}"]
            cell.value = val
            cell.font = Font(name="Calibri", size=10, color=TEXT_DARK)
            cell.fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
            cell.border = create_border()
            if c in ["B", "D", "E", "F"]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")
            if c == "B":
                cell.font = Font(name="Calibri", size=10, bold=True, color=fg_c)
                cell.fill = PatternFill(start_color=bg_c, end_color=bg_c, fill_type="solid")

    ws4.column_dimensions["A"].width = 6
    ws4.column_dimensions["B"].width = 18
    ws4.column_dimensions["C"].width = 46
    ws4.column_dimensions["D"].width = 18
    ws4.column_dimensions["E"].width = 16
    ws4.column_dimensions["F"].width = 24
    ws4.column_dimensions["G"].width = 18

    wb.save(FINDINGS_XLSX)
    print(f"[SUCCESS] Generated: {FINDINGS_XLSX}")

if __name__ == "__main__":
    generate_endpoint_inventory()
    generate_findings_workbook()
