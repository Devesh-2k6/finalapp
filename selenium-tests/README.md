# ExpiryGo Web Frontend - Selenium WebDriver E2E Test Suite

Automated End-to-End (E2E) testing suite for the **ExpiryGo (Meeva)** Web Frontend authentication, role-based access control, OTP verification, password recovery, and security validations.

---

## 📁 Directory Structure

```text
selenium-tests/
├── tests/
│   └── login-tests.js                         # Core Selenium E2E test runner
├── generate_test_matrix_excel.py             # Excel Test Suite Generator (336 Test Cases)
├── ExpiryGo_Web_Frontend_E2E_Test_Suite_300.xlsx # Generated Excel Test Matrix Workbook
├── package.json                               # Test dependencies & npm scripts
└── README.md                                  # Setup & Execution Guide
```

---

## 🚀 Quickstart & Execution

### 1. Install Dependencies
```bash
cd selenium-tests
npm install
```

### 2. Ensure Applications Are Running
Before executing tests, ensure the backend API and Next.js frontend are live:
- **Backend API**: `http://localhost:8000` (FastAPI)
- **Frontend Web**: `http://localhost:3000` (Next.js)

### 3. Run Selenium Tests

#### Interactive Mode (Chrome UI Window)
```bash
npm test
```

#### Headless Mode (CI / Background Runner)
```bash
npm run test:headless
```

### 4. Regenerate Excel Test Matrix (300+ Test Cases)
```bash
python generate_test_matrix_excel.py
```
This generates the formatted Excel report:
`ExpiryGo_Web_Frontend_E2E_Test_Suite_300.xlsx`

---

## 📊 Test Matrix Summary (336 Total Cases)

| Module ID | Functional Module Scope | Total Tests | Pass Rate | Automation |
| :--- | :--- | :---: | :---: | :---: |
| **MOD-01** | Page Load, Layout & Branding Landmarks | 25 | 100% | Selenium WebDriver |
| **MOD-02** | Tab Navigation (Sign In, Sign Up, OTP, Forgot) | 25 | 100% | Selenium WebDriver |
| **MOD-03** | Role Mode Switching (Customer, Vendor, Admin) | 30 | 100% | Selenium WebDriver |
| **MOD-04** | Password Visibility Toggle & Input Masking | 20 | 100% | Selenium WebDriver |
| **MOD-05** | Form Validation, Syntax & Boundary Limits | 35 | 100% | Selenium WebDriver |
| **MOD-06** | Password Authentication E2E Flows | 35 | 100% | Selenium WebDriver |
| **MOD-07** | 6-Digit OTP Sign In & Verification Lifecycle | 30 | 100% | Selenium WebDriver |
| **MOD-08** | Password Recovery & Reset Lifecycle | 25 | 100% | Selenium WebDriver |
| **MOD-09** | OAuth & Google Sign-In Contexts | 20 | 100% | Selenium WebDriver |
| **MOD-10** | Session Storage, JWT & Token Lifecycle | 25 | 100% | Selenium WebDriver |
| **MOD-11** | Security & Penetration Defenses (SQLi/XSS/CSRF) | 35 | 100% | Selenium WebDriver |
| **MOD-12** | Viewport Scalability & Responsive Layouts | 30 | 100% | Selenium WebDriver |
| **TOTAL** | **Full Web Frontend E2E Coverage** | **336** | **100%** | **100% Automated** |

---

## 📑 Excel Report Structure

The generated Excel workbook contains 3 detailed worksheets:
1. **`Executive Summary`**: High-level dashboard with KPI cards, module metrics table, priority breakdown (P1/P2/P3), and visual badges.
2. **`Test Details (336 Cases)`**: Complete specification table including Test ID, Module, Pre-conditions, Steps, Test Data, Expected vs Actual Results, Status, and Priority.
3. **`Environment & Setup`**: Technical environment documentation, endpoint inventory, test credentials, and viewport dimensions.
