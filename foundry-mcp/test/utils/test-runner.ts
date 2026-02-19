/**
 * Shared test runner utility
 * Provides consistent test tracking, colored output, and summary reporting.
 */

// ANSI colors
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export class TestRunner {
  private results: TestResult[] = [];

  /** Log a colored message */
  log(message: string, type: "info" | "pass" | "fail" | "header" = "info"): void {
    const colors = { info: RESET, pass: GREEN, fail: RED, header: CYAN };
    const prefix = type === "pass" ? "✓" : type === "fail" ? "✗" : "→";
    console.log(`${colors[type]}${prefix} ${message}${RESET}`);
  }

  /** Record a test result and log it */
  addResult(name: string, passed: boolean, message: string): void {
    this.results.push({ name, passed, message });
    this.log(`${name}: ${message}`, passed ? "pass" : "fail");
  }

  /** Convenience: record a pass */
  pass(name: string, message: string): void {
    this.addResult(name, true, message);
  }

  /** Convenience: record a fail */
  fail(name: string, message: string): void {
    this.addResult(name, false, message);
  }

  /** Print summary and return counts */
  printSummary(): { passed: number; failed: number; total: number } {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log("");
    this.log(`Passed: ${passed}/${total}`, passed === total ? "pass" : "info");
    if (failed > 0) {
      this.log(`Failed: ${failed}/${total}`, "fail");
      console.log("");
      this.log("Failed tests:", "fail");
      for (const r of this.results.filter(r => !r.passed)) {
        this.log(`  ${r.name}: ${r.message}`, "fail");
      }
    }

    return { passed, failed, total };
  }

  /** Get all results */
  getResults(): TestResult[] {
    return [...this.results];
  }
}
