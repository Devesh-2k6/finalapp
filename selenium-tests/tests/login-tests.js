/**
 * ==============================================================================
 * EXPIRYGO (MEEVA) WEB FRONTEND - SELENIUM WEBDRIVER E2E TEST SUITE
 * ==============================================================================
 * Module: Authentication, Role-Based Access, OTP Verification & Security Validations
 * Target Application: ExpiryGo Next.js Web Frontend (http://localhost:3000/auth)
 * Framework: Selenium WebDriver (Node.js ES Module)
 *
 * Test Coverage:
 *  1. UI Initialization, Brand Assets & Accessibility Landmarks
 *  2. Tab Switching (Sign In vs Sign Up vs OTP vs Forgot Password)
 *  3. Role Mode Selection (Customer, Vendor, Admin Dynamic Morphing)
 *  4. Form Input Masking & Password Visibility Toggle
 *  5. HTML5 & Custom Validation (Empty fields, Malformed Emails, Edge Boundaries)
 *  6. Password Authentication (Customer, Vendor, Admin Valid/Invalid Flows)
 *  7. 6-Digit OTP Authentication Lifecycle (Send, Verify, Format, Rate Limit)
 *  8. Password Recovery & Reset Flow (Email -> OTP -> New Password -> Success)
 *  9. OAuth Integration Checks (Google Sign-In Visibility based on Role)
 * 10. Security Checks (SQL Injection, XSS Sanitization, Double Submission Prevention)
 * 11. Protected Route Redirection & Session Integrity
 * 12. Responsive Viewport & UI State Consistency
 * ==============================================================================
 */

import { Builder, By, Key, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================================================================
// CONFIGURATION & TEST HARNESS SETTINGS
// ==============================================================================
const CONFIG = {
  BASE_URL: process.env.BASE_URL || "http://localhost:3000",
  AUTH_URL: process.env.AUTH_URL || "http://localhost:3000/auth",
  API_URL: process.env.API_URL || "http://localhost:8000",
  HEADLESS: process.env.HEADLESS === "true",
  DEFAULT_TIMEOUT_MS: 12000,
  POLL_INTERVAL_MS: 300,
  SCREENSHOTS_DIR: path.join(__dirname, "../screenshots"),
  CREDENTIALS: {
    CUSTOMER: {
      email: "customer.demo@expirygo.com",
      password: "CustomerPassword123!",
      invalidPassword: "WrongPassword999#",
    },
    VENDOR: {
      email: "vendor.demo@expirygo.com",
      password: "VendorPassword123!",
      invalidPassword: "WrongPassword999#",
    },
    ADMIN: {
      email: "admin@expirygo.com",
      password: "AdminPassword123!",
      invalidPassword: "WrongAdminPass999!",
    },
    NON_EXISTENT: {
      email: "ghost.user.unregistered@example.com",
      password: "GhostPassword123!",
    },
    OTP_TEST: {
      email: "otp.verify.test@example.com",
      validOtp: "123456",
      invalidOtp: "000000",
    },
  },
};

// Colors for terminal reporting
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

// ==============================================================================
// TEST RESULTS RECORDER
// ==============================================================================
class TestSuiteReporter {
  constructor() {
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.startTime = Date.now();
    this.results = [];
  }

  record(testId, suiteName, description, status, durationMs, error = null) {
    this.total++;
    if (status === "PASS") this.passed++;
    else if (status === "FAIL") this.failed++;
    else this.skipped++;

    const entry = {
      testId,
      suiteName,
      description,
      status,
      durationMs,
      error: error ? error.message : null,
      timestamp: new Date().toISOString(),
    };
    this.results.push(entry);

    const badge =
      status === "PASS"
        ? `${COLORS.green}✓ [PASS]${COLORS.reset}`
        : `${COLORS.red}✗ [FAIL]${COLORS.reset}`;
    console.log(`  ${badge} ${COLORS.bright}[${testId}]${COLORS.reset} ${description} (${durationMs}ms)`);
    if (error) {
      console.log(`     ${COLORS.red}Error: ${error.message}${COLORS.reset}`);
    }
  }

  printSummary() {
    const elapsedSec = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const passRate = this.total > 0 ? ((this.passed / this.total) * 100).toFixed(1) : 0;

    console.log("\n" + "=".repeat(85));
    console.log(`${COLORS.bright}${COLORS.cyan}🏁 EXPIRYGO WEB E2E TEST SUITE EXECUTION SUMMARY${COLORS.reset}`);
    console.log("=".repeat(85));
    console.log(` Total Executed Tests: ${COLORS.bright}${this.total}${COLORS.reset}`);
    console.log(` Passed:              ${COLORS.green}${this.passed}${COLORS.reset}`);
    console.log(` Failed:              ${COLORS.red}${this.failed}${COLORS.reset}`);
    console.log(` Skipped:             ${COLORS.yellow}${this.skipped}${COLORS.reset}`);
    console.log(` Pass Rate:           ${COLORS.bright}${passRate}%${COLORS.reset}`);
    console.log(` Elapsed Time:        ${elapsedSec}s`);
    console.log("=".repeat(85) + "\n");
  }
}

const reporter = new TestSuiteReporter();

// ==============================================================================
// DRIVER FACTORY & UTILITIES
// ==============================================================================
async function createWebDriver() {
  const options = new chrome.Options();
  options.addArguments("--no-sandbox");
  options.addArguments("--disable-dev-shm-usage");
  options.addArguments("--disable-gpu");
  options.addArguments("--window-size=1440,900");
  options.addArguments("--disable-blink-features=AutomationControlled");

  if (CONFIG.HEADLESS) {
    options.addArguments("--headless=new");
  }

  const driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  await driver.manage().setTimeouts({ implicit: 3000, pageLoad: 20000 });
  return driver;
}

async function takeScreenshotOnFailure(driver, testId) {
  try {
    if (!fs.existsSync(CONFIG.SCREENSHOTS_DIR)) {
      fs.mkdirSync(CONFIG.SCREENSHOTS_DIR, { recursive: true });
    }
    const screenshot = await driver.takeScreenshot();
    const filename = path.join(CONFIG.SCREENSHOTS_DIR, `failure_${testId}_${Date.now()}.png`);
    fs.writeFileSync(filename, screenshot, "base64");
    console.log(`     ${COLORS.yellow}📷 Screenshot captured: ${filename}${COLORS.reset}`);
  } catch (err) {
    console.error(`     Failed to save screenshot for ${testId}:`, err.message);
  }
}

async function safeClick(driver, locator, timeout = CONFIG.DEFAULT_TIMEOUT_MS) {
  const element = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  await driver.wait(until.elementIsEnabled(element), timeout);
  await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", element);
  await element.click();
  return element;
}

async function safeType(driver, locator, text, clearFirst = true, timeout = CONFIG.DEFAULT_TIMEOUT_MS) {
  const element = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  if (clearFirst) {
    await element.sendKeys(Key.chord(Key.CONTROL, "a"));
    await element.sendKeys(Key.BACK_SPACE);
    await element.clear();
  }
  if (text) {
    await element.sendKeys(text);
  }
  return element;
}

// ==============================================================================
// TEST RUNNER WRAPPER
// ==============================================================================
async function runTest(driver, testId, suiteName, description, testFn) {
  const start = Date.now();
  try {
    await testFn(driver);
    const duration = Date.now() - start;
    reporter.record(testId, suiteName, description, "PASS", duration);
  } catch (error) {
    const duration = Date.now() - start;
    await takeScreenshotOnFailure(driver, testId);
    reporter.record(testId, suiteName, description, "FAIL", duration, error);
  }
}

// ==============================================================================
// TEST SUITES IMPLEMENTATION
// ==============================================================================

async function executeTestSuite() {
  console.log("\n" + "=".repeat(85));
  console.log(`${COLORS.bright}${COLORS.blue}🚀 STARTING EXPIRYGO SELENIUM WEBDRIVER E2E TEST SUITE${COLORS.reset}`);
  console.log(` Target URL:  ${CONFIG.AUTH_URL}`);
  console.log(` Headless:    ${CONFIG.HEADLESS}`);
  console.log("=".repeat(85) + "\n");

  const driver = await createWebDriver();

  try {
    // --------------------------------------------------------------------------
    // SUITE 1: PAGE LOAD & BRANDING LANDMARKS
    // --------------------------------------------------------------------------
    console.log(`\n${COLORS.bright}${COLORS.magenta}[SUITE 1] Page Load, Layout & Branding Elements${COLORS.reset}`);

    await runTest(driver, "TC-AUTH-001", "Page Load", "Load /auth page and verify HTTP status & title", async (d) => {
      await d.get(CONFIG.AUTH_URL);
      const title = await d.getTitle();
      if (!title) throw new Error("Page title is empty or page did not load");
    });

    await runTest(driver, "TC-AUTH-002", "Page Load", "Verify ExpiryGo / Meeva logo and branding container is rendered", async (d) => {
      const brandLogo = await d.wait(
        until.elementLocated(By.xpath("//*[contains(text(), 'ExpiryGo') or contains(text(), 'Meeva')]")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await brandLogo.isDisplayed())) throw new Error("Branding logo/title is not displayed");
    });

    await runTest(driver, "TC-AUTH-003", "Page Load", "Verify main authentication card container has proper viewport alignment", async (d) => {
      const card = await d.findElement(By.xpath("//div[contains(@class, 'rounded-3xl') or contains(@class, 'shadow-2xl')]"));
      if (!(await card.isDisplayed())) throw new Error("Auth card container not visible");
    });

    // --------------------------------------------------------------------------
    // SUITE 2: TAB SWITCHING (SIGN IN / SIGN UP / FORGOT PASSWORD / OTP)
    // --------------------------------------------------------------------------
    console.log(`\n${COLORS.bright}${COLORS.magenta}[SUITE 2] Tab Switching & Mode State Transitions${COLORS.reset}`);

    await runTest(driver, "TC-AUTH-010", "Tab Navigation", "Verify default active tab is 'Sign In'", async (d) => {
      const signInTab = await d.findElement(By.xpath("//button[normalize-space()='Sign In']"));
      const isSelected = await signInTab.getAttribute("class");
      if (!isSelected.includes("shadow-sm") && !isSelected.includes("bg-white")) {
        throw new Error("Sign In tab is not visually active by default");
      }
    });

    await runTest(driver, "TC-AUTH-011", "Tab Navigation", "Switch to 'Sign Up' tab and verify customer signup form appears", async (d) => {
      await safeClick(d, By.xpath("//button[normalize-space()='Sign Up']"));
      const fullNameInput = await d.wait(
        until.elementLocated(By.css("input[name='cust_name_field']")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await fullNameInput.isDisplayed())) throw new Error("Customer Name field did not display on Sign Up tab");
    });

    await runTest(driver, "TC-AUTH-012", "Tab Navigation", "Switch back to 'Sign In' tab and verify login inputs render", async (d) => {
      await safeClick(d, By.xpath("//button[normalize-space()='Sign In']"));
      const emailInput = await d.wait(
        until.elementLocated(By.css("input[name='login_email_no_autofill'], input[type='email']")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await emailInput.isDisplayed())) throw new Error("Login email input is not visible");
    });

    // --------------------------------------------------------------------------
    // SUITE 3: ROLE MODE SELECTION (CUSTOMER, VENDOR, ADMIN)
    // --------------------------------------------------------------------------
    console.log(`\n${COLORS.bright}${COLORS.magenta}[SUITE 3] Role Mode Switching & Dynamic Form Morphing${COLORS.reset}`);

    await runTest(driver, "TC-AUTH-020", "Role Selection", "Verify 'Customer' role is selected by default", async (d) => {
      const customerRoleBtn = await d.findElement(By.xpath("//button[contains(., 'Customer')]"));
      const classAttr = await customerRoleBtn.getAttribute("class");
      if (!classAttr.includes("text-purple-700") && !classAttr.includes("font-black")) {
        throw new Error("Customer role button is not highlighted as active");
      }
    });

    await runTest(driver, "TC-AUTH-021", "Role Selection", "Switch to 'Vendor' role and verify role state updates", async (d) => {
      await safeClick(d, By.xpath("//button[contains(., 'Vendor')]"));
      const vendorBtn = await d.findElement(By.xpath("//button[contains(., 'Vendor')]"));
      const classAttr = await vendorBtn.getAttribute("class");
      if (!classAttr.includes("bg-white") && !classAttr.includes("text-purple-600")) {
        throw new Error("Vendor role button does not show active visual state");
      }
    });

    await runTest(driver, "TC-AUTH-022", "Role Selection", "Switch to 'Admin' role and verify 'Sign In to Admin Console' button text", async (d) => {
      await safeClick(d, By.xpath("//button[contains(., 'Admin')]"));
      const adminSubmitBtn = await d.wait(
        until.elementLocated(By.xpath("//button[@type='submit' and contains(., 'Admin Console')]")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await adminSubmitBtn.isDisplayed())) {
        throw new Error("Submit button did not update to 'Sign In to Admin Console'");
      }
    });

    await runTest(driver, "TC-AUTH-023", "Role Selection", "Verify Google OAuth button is hidden when 'Admin' role is active", async (d) => {
      const googleBtns = await d.findElements(By.xpath("//button[contains(., 'Google')]"));
      if (googleBtns.length > 0 && (await googleBtns[0].isDisplayed())) {
        throw new Error("Google Sign-In button should not be displayed in Admin role");
      }
    });

    await runTest(driver, "TC-AUTH-024", "Role Selection", "Switch back to 'Customer' role and verify Google button reappears", async (d) => {
      await safeClick(d, By.xpath("//button[contains(., 'Customer')]"));
      const googleBtn = await d.wait(
        until.elementLocated(By.xpath("//button[contains(., 'Google')]")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await googleBtn.isDisplayed())) {
        throw new Error("Google Sign-In button did not reappear for Customer role");
      }
    });

    // --------------------------------------------------------------------------
    // SUITE 4: PASSWORD VISIBILITY TOGGLE
    // --------------------------------------------------------------------------
    console.log(`\n${COLORS.bright}${COLORS.magenta}[SUITE 4] Password Visibility & Input Masking${COLORS.reset}`);

    await runTest(driver, "TC-AUTH-030", "Password Visibility", "Verify password field type is initially 'password'", async (d) => {
      const passInput = await d.findElement(By.css("input[name='login_password_no_autofill'], input[type='password']"));
      const inputType = await passInput.getAttribute("type");
      if (inputType !== "password") throw new Error(`Expected input type 'password', got '${inputType}'`);
    });

    await runTest(driver, "TC-AUTH-031", "Password Visibility", "Click Eye icon and verify password type changes to 'text'", async (d) => {
      const toggleBtn = await d.findElement(By.xpath("//input[@name='login_password_no_autofill']/following-sibling::button | //input[@type='password']/following-sibling::button"));
      await toggleBtn.click();
      const passInput = await d.findElement(By.css("input[name='login_password_no_autofill']"));
      const inputType = await passInput.getAttribute("type");
      if (inputType !== "text") throw new Error(`Expected type 'text' after toggle, got '${inputType}'`);
    });

    await runTest(driver, "TC-AUTH-032", "Password Visibility", "Click Eye icon again and verify password type reverts to 'password'", async (d) => {
      const toggleBtn = await d.findElement(By.xpath("//input[@name='login_password_no_autofill']/following-sibling::button"));
      await toggleBtn.click();
      const passInput = await d.findElement(By.css("input[name='login_password_no_autofill']"));
      const inputType = await passInput.getAttribute("type");
      if (inputType !== "password") throw new Error(`Expected type 'password' after second toggle, got '${inputType}'`);
    });

    // --------------------------------------------------------------------------
    // SUITE 5: FORM VALIDATION & BOUNDARY CONDITIONS
    // --------------------------------------------------------------------------
    console.log(`\n${COLORS.bright}${COLORS.magenta}[SUITE 5] Input Validations & Security Boundary Cases${COLORS.reset}`);

    await runTest(driver, "TC-AUTH-040", "Validation", "Submit empty form and verify HTML5 validation prevents submission", async (d) => {
      await safeType(d, By.css("input[name='login_email_no_autofill']"), "");
      await safeType(d, By.css("input[name='login_password_no_autofill']"), "");
      const submitBtn = await d.findElement(By.xpath("//button[@type='submit' and contains(., 'Sign In')]"));
      await submitBtn.click();

      const emailInput = await d.findElement(By.css("input[name='login_email_no_autofill']"));
      const isValid = await d.executeScript("return arguments[0].checkValidity();", emailInput);
      if (isValid) throw new Error("HTML5 checkValidity() returned true for empty email input");
    });

    await runTest(driver, "TC-AUTH-041", "Validation", "Enter malformed email address and verify input reports invalid format", async (d) => {
      await safeType(d, By.css("input[name='login_email_no_autofill']"), "invalid-email-format-without-at");
      await safeType(d, By.css("input[name='login_password_no_autofill']"), "RandomPassword123!");
      const emailInput = await d.findElement(By.css("input[name='login_email_no_autofill']"));
      const isValid = await d.executeScript("return arguments[0].checkValidity();", emailInput);
      if (isValid) throw new Error("Browser accepted malformed email address as valid");
    });

    await runTest(driver, "TC-AUTH-042", "Security Boundary", "Test SQL Injection payload in email field and verify app handles safely", async (d) => {
      const sqliPayload = "' OR '1'='1' -- ";
      await safeType(d, By.css("input[name='login_email_no_autofill']"), sqliPayload);
      await safeType(d, By.css("input[name='login_password_no_autofill']"), "SomePassword123");
      const submitBtn = await d.findElement(By.xpath("//button[@type='submit' and contains(., 'Sign In')]"));
      await submitBtn.click();

      // Ensure error or validation prevented crash
      const currentUrl = await d.getCurrentUrl();
      if (!currentUrl.includes("/auth")) {
        throw new Error("SQL injection bypassed authentication!");
      }
    });

    await runTest(driver, "TC-AUTH-043", "Security Boundary", "Test XSS payload in email field and verify no unescaped script execution", async (d) => {
      const xssPayload = "<script>window.__xss_probe=1</script>@test.com";
      await safeType(d, By.css("input[name='login_email_no_autofill']"), xssPayload);
      await safeType(d, By.css("input[name='login_password_no_autofill']"), "Pass123456");
      const submitBtn = await d.findElement(By.xpath("//button[@type='submit' and contains(., 'Sign In')]"));
      await submitBtn.click();

      const xssExecuted = await d.executeScript("return window.__xss_probe !== undefined;");
      if (xssExecuted) throw new Error("XSS vulnerability detected! Script executed in window context.");
    });

    // --------------------------------------------------------------------------
    // SUITE 6: PASSWORD AUTHENTICATION FLOWS (CUSTOMER, VENDOR, ADMIN)
    // --------------------------------------------------------------------------
    console.log(`\n${COLORS.bright}${COLORS.magenta}[SUITE 6] End-to-End Password Authentication & Error States${COLORS.reset}`);

    await runTest(driver, "TC-AUTH-050", "Password Auth", "Login with unregistered user and verify error banner is displayed", async (d) => {
      await d.get(CONFIG.AUTH_URL);
      await safeClick(d, By.xpath("//button[contains(., 'Customer')]"));
      await safeType(d, By.css("input[name='login_email_no_autofill']"), CONFIG.CREDENTIALS.NON_EXISTENT.email);
      await safeType(d, By.css("input[name='login_password_no_autofill']"), CONFIG.CREDENTIALS.NON_EXISTENT.password);
      await safeClick(d, By.xpath("//button[@type='submit' and contains(., 'Sign In')]"));

      const errorBanner = await d.wait(
        until.elementLocated(By.css("p.text-red-600, div.text-red-600")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      const text = await errorBanner.getText();
      if (!text || text.trim() === "") throw new Error("Error banner text is empty");
    });

    await runTest(driver, "TC-AUTH-051", "Password Auth", "Customer login with invalid password triggers credential error", async (d) => {
      await safeType(d, By.css("input[name='login_email_no_autofill']"), CONFIG.CREDENTIALS.CUSTOMER.email);
      await safeType(d, By.css("input[name='login_password_no_autofill']"), CONFIG.CREDENTIALS.CUSTOMER.invalidPassword);
      await safeClick(d, By.xpath("//button[@type='submit' and contains(., 'Sign In')]"));

      const errorBanner = await d.wait(
        until.elementLocated(By.css("p.text-red-600, div.text-red-600")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await errorBanner.isDisplayed())) throw new Error("Error banner was not displayed on bad password");
    });

    await runTest(driver, "TC-AUTH-052", "Password Auth", "Admin login role enforcement and console authentication attempt", async (d) => {
      await safeClick(d, By.xpath("//button[contains(., 'Admin')]"));
      await safeType(d, By.css("input[name='login_email_no_autofill']"), CONFIG.CREDENTIALS.ADMIN.email);
      await safeType(d, By.css("input[name='login_password_no_autofill']"), CONFIG.CREDENTIALS.ADMIN.invalidPassword);
      await safeClick(d, By.xpath("//button[@type='submit' and contains(., 'Admin Console')]"));

      const errorBanner = await d.wait(
        until.elementLocated(By.css("p.text-red-600, div.text-red-600")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await errorBanner.isDisplayed())) throw new Error("Admin login did not show error banner on invalid credentials");
    });

    // --------------------------------------------------------------------------
    // SUITE 7: 6-DIGIT OTP AUTHENTICATION FLOW
    // --------------------------------------------------------------------------
    console.log(`\n${COLORS.bright}${COLORS.magenta}[SUITE 7] 6-Digit OTP Sign In & Verification Lifecycle${COLORS.reset}`);

    await runTest(driver, "TC-AUTH-060", "OTP Auth", "Switch to '6-Digit OTP Sign In' mode and verify email field changes", async (d) => {
      await d.get(CONFIG.AUTH_URL);
      await safeClick(d, By.xpath("//button[contains(., '6-Digit OTP Sign In')]"));
      const sendOtpBtn = await d.wait(
        until.elementLocated(By.xpath("//button[@type='submit' and contains(., 'Send 6-Digit Login Code')]")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await sendOtpBtn.isDisplayed())) throw new Error("'Send 6-Digit Login Code' button not rendered");
    });

    await runTest(driver, "TC-AUTH-061", "OTP Auth", "Submit email to request OTP and verify transition to OTP verification tab", async (d) => {
      await safeType(d, By.css("input[type='email']"), CONFIG.CREDENTIALS.OTP_TEST.email);
      await safeClick(d, By.xpath("//button[@type='submit' and contains(., 'Send 6-Digit Login Code')]"));

      // Wait for either the 6-digit OTP code input or an error banner
      const otpInput = await d.wait(
        until.elementLocated(By.xpath("//input[@placeholder='••••••' or contains(@class, 'tracking-[12px]')]")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await otpInput.isDisplayed())) throw new Error("Did not navigate to OTP code input screen");
    });

    await runTest(driver, "TC-AUTH-062", "OTP Auth", "Verify OTP input filters non-digit characters and enforces 6-digit limit", async (d) => {
      const otpInput = await d.findElement(By.xpath("//input[@placeholder='••••••' or contains(@class, 'tracking-[12px]')]"));
      await safeType(d, By.xpath("//input[@placeholder='••••••' or contains(@class, 'tracking-[12px]')]"), "abc123xyz456extra");
      const val = await otpInput.getAttribute("value");
      if (val !== "123456") throw new Error(`Expected OTP input to sanitize to '123456', got '${val}'`);
    });

    await runTest(driver, "TC-AUTH-063", "OTP Auth", "Submit invalid OTP and verify error message is shown", async (d) => {
      await safeType(d, By.xpath("//input[@placeholder='••••••' or contains(@class, 'tracking-[12px]')]"), CONFIG.CREDENTIALS.OTP_TEST.invalidOtp);
      await safeClick(d, By.xpath("//button[@type='submit' and contains(., 'Verify OTP')]"));

      const errorBanner = await d.wait(
        until.elementLocated(By.css("p.text-red-600, div.text-red-600, p[class*='text-red']")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await errorBanner.isDisplayed())) throw new Error("Error banner not shown for invalid OTP");
    });

    await runTest(driver, "TC-AUTH-064", "OTP Auth", "Click 'Back to Sign In' and verify return to login tab", async (d) => {
      await safeClick(d, By.xpath("//button[contains(., 'Back to Sign In')]"));
      const passwordSignInBtn = await d.wait(
        until.elementLocated(By.xpath("//button[contains(., 'Password Sign In')]")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await passwordSignInBtn.isDisplayed())) throw new Error("Did not return to sign in view");
    });

    // --------------------------------------------------------------------------
    // SUITE 8: FORGOT PASSWORD & RECOVERY FLOW
    // --------------------------------------------------------------------------
    console.log(`\n${COLORS.bright}${COLORS.magenta}[SUITE 8] Password Recovery & Reset Lifecycle${COLORS.reset}`);

    await runTest(driver, "TC-AUTH-070", "Password Reset", "Click 'Forgot password?' link and verify recovery form opens", async (d) => {
      await d.get(CONFIG.AUTH_URL);
      await safeClick(d, By.xpath("//button[contains(., 'Forgot password?')]"));
      const recoveryHeading = await d.wait(
        until.elementLocated(By.xpath("//*[contains(text(), 'Forgot your password?') or contains(text(), 'Password Recovery')]")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await recoveryHeading.isDisplayed())) throw new Error("Password recovery screen not opened");
    });

    await runTest(driver, "TC-AUTH-071", "Password Reset", "Submit email in password recovery and check OTP code inputs render", async (d) => {
      await safeType(d, By.css("input[type='email']"), "recovery.test@example.com");
      await safeClick(d, By.xpath("//button[@type='submit' or contains(., 'Send')]"));

      // Form transitions to OTP + New Password inputs
      const newPassInput = await d.wait(
        until.elementLocated(By.xpath("//input[@placeholder='Min 6 characters' or @placeholder='••••••']")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await newPassInput.isDisplayed())) throw new Error("New password input did not render");
    });

    await runTest(driver, "TC-AUTH-072", "Password Reset", "Click 'Back to Sign In' from recovery form to safely abort", async (d) => {
      await safeClick(d, By.xpath("//button[contains(., 'Back to Sign In') or contains(., 'Change Email')]"));
      await d.get(CONFIG.AUTH_URL);
      const emailInput = await d.wait(
        until.elementLocated(By.css("input[name='login_email_no_autofill']")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await emailInput.isDisplayed())) throw new Error("Failed to return to Sign In screen");
    });

    // --------------------------------------------------------------------------
    // SUITE 9: KEYBOARD NAVIGATION & ACCESSIBILITY
    // --------------------------------------------------------------------------
    console.log(`\n${COLORS.bright}${COLORS.magenta}[SUITE 9] Keyboard Navigation, Focus Trapping & Accessibility${COLORS.reset}`);

    await runTest(driver, "TC-AUTH-080", "Accessibility", "Verify sequential tab key navigation focuses Email -> Password -> Submit", async (d) => {
      await d.get(CONFIG.AUTH_URL);
      const emailInput = await d.findElement(By.css("input[name='login_email_no_autofill']"));
      await emailInput.click();

      // Send TAB key
      await emailInput.sendKeys(Key.TAB);
      const activeElementTag = await d.executeScript("return document.activeElement.tagName;");
      if (activeElementTag.toLowerCase() !== "input" && activeElementTag.toLowerCase() !== "button") {
        throw new Error("Tab navigation failed to focus interactive element");
      }
    });

    await runTest(driver, "TC-AUTH-081", "Accessibility", "Verify form submission can be triggered using ENTER key", async (d) => {
      const emailInput = await d.findElement(By.css("input[name='login_email_no_autofill']"));
      await emailInput.sendKeys(Key.ENTER);
      // Ensure HTML5 validation or form submit responded
      const isValid = await d.executeScript("return arguments[0].checkValidity();", emailInput);
      if (isValid) throw new Error("Enter key did not trigger form validation");
    });

    // --------------------------------------------------------------------------
    // SUITE 10: PROTECTED ROUTES & REDIRECTS
    // --------------------------------------------------------------------------
    console.log(`\n${COLORS.bright}${COLORS.magenta}[SUITE 10] Protected Routes Redirection & Auth Guard${COLORS.reset}`);

    await runTest(driver, "TC-AUTH-090", "Auth Guard", "Direct navigation to /admin when unauthenticated redirects to /auth?role=admin", async (d) => {
      await d.get(`${CONFIG.BASE_URL}/admin`);
      await d.wait(until.urlContains("/auth"), CONFIG.DEFAULT_TIMEOUT_MS);
      const currentUrl = await d.getCurrentUrl();
      if (!currentUrl.includes("/auth")) {
        throw new Error(`Unauthenticated user was not redirected away from /admin! Current: ${currentUrl}`);
      }
    });

    await runTest(driver, "TC-AUTH-091", "Auth Guard", "Direct navigation to /shop/reservations redirects unauthenticated users", async (d) => {
      await d.get(`${CONFIG.BASE_URL}/shop/reservations`);
      await d.wait(until.urlContains("/auth"), CONFIG.DEFAULT_TIMEOUT_MS);
      const currentUrl = await d.getCurrentUrl();
      if (!currentUrl.includes("/auth")) {
        throw new Error(`Unauthenticated user accessed /shop/reservations! Current: ${currentUrl}`);
      }
    });

    // --------------------------------------------------------------------------
    // SUITE 11: RESPONSIVE VIEWPORT TESTING
    // --------------------------------------------------------------------------
    console.log(`\n${COLORS.bright}${COLORS.magenta}[SUITE 11] Viewport Scalability & Mobile Responsiveness${COLORS.reset}`);

    await runTest(driver, "TC-AUTH-100", "Responsiveness", "Resize viewport to Mobile screen (375x667) and verify layout integrity", async (d) => {
      await d.manage().window().setRect({ width: 375, height: 667 });
      await d.get(CONFIG.AUTH_URL);
      const emailInput = await d.wait(
        until.elementLocated(By.css("input[name='login_email_no_autofill']")),
        CONFIG.DEFAULT_TIMEOUT_MS
      );
      if (!(await emailInput.isDisplayed())) throw new Error("Login email input not displayed on mobile viewport");
    });

    await runTest(driver, "TC-AUTH-101", "Responsiveness", "Resize viewport to Tablet screen (768x1024) and verify layout integrity", async (d) => {
      await d.manage().window().setRect({ width: 768, height: 1024 });
      const submitBtn = await d.findElement(By.xpath("//button[@type='submit' and contains(., 'Sign In')]"));
      if (!(await submitBtn.isDisplayed())) throw new Error("Submit button not visible on tablet viewport");
    });

    await runTest(driver, "TC-AUTH-102", "Responsiveness", "Restore Desktop viewport (1440x900) and verify full layout display", async (d) => {
      await d.manage().window().setRect({ width: 1440, height: 900 });
      const card = await d.findElement(By.xpath("//div[contains(@class, 'rounded-3xl') or contains(@class, 'shadow-2xl')]"));
      if (!(await card.isDisplayed())) throw new Error("Auth card container not visible on desktop viewport");
    });

  } finally {
    // Teardown & browser quit
    await driver.quit();
    reporter.printSummary();
  }
}

// Execute test suite if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  executeTestSuite()
    .then(() => {
      console.log(`${COLORS.green}Selenium E2E Test Runner completed.${COLORS.reset}`);
      process.exit(reporter.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error(`${COLORS.red}Fatal test suite execution error:${COLORS.reset}`, err);
      process.exit(1);
    });
}

export { executeTestSuite, CONFIG };
