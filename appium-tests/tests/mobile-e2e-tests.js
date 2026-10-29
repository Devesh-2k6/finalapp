/**
 * Appium Mobile E2E Test Suite - Tests Directory Entrypoint
 */
import { executeMobileTestSuite } from "../appium-tests.js";

executeMobileTestSuite()
  .then(() => {
    console.log("Appium test suite completed.");
  })
  .catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
  });
