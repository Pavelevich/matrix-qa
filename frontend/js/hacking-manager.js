class HackingTestsManager {
  constructor() {
    this.tests = [];
    this.filteredTests = [];
    this.modal = null;
    this.initialized = false;
    this.isLoadingTests = false;
    this.init();
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.initializeElements(),
      );
    } else {
      this.initializeElements();
    }
  }

  initializeElements() {
    this.modal = document.getElementById("hackingModal");
    if (!this.modal) {
      this.createErrorAlert(
        'Hacking Modal not found. Verify that the HTML has the element with ID "hackingModal".',
      );
      return;
    }

    this.setupEventListeners();
    this.initialized = true;
  }

  setupEventListeners() {
    const hackingBtn = document.getElementById("hackingBtn");
    if (hackingBtn) {
      hackingBtn.removeEventListener("click", this.handleHackingBtnClick);
      this.handleHackingBtnClick = (e) => {
        e.preventDefault();
        this.openModal();
      };
      hackingBtn.addEventListener("click", this.handleHackingBtnClick);
    } else {
      this.createErrorAlert(
        'Hacking button not found. Verify that the HTML has the element with ID "hackingBtn".',
      );
    }

    const closeBtn = document.querySelector(".hacking-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.closeModal();
      });
    }

    this.handleOutsideClick = (event) => {
      if (event.target === this.modal) {
        this.closeModal();
      }
    };
    window.addEventListener("click", this.handleOutsideClick);

    this.handleEscapeKey = (e) => {
      if (
        e.key === "Escape" &&
        this.modal &&
        this.modal.style.display === "block"
      ) {
        this.closeModal();
      }
    };
    document.addEventListener("keydown", this.handleEscapeKey);

    this.setupModalEventListeners();
  }

  setupModalEventListeners() {
    const searchInput = document.getElementById("hackingSearchInput");
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.filterTests();
        }, 300);
      });
    }

    const categoryFilter = document.getElementById("hackingCategoryFilter");
    if (categoryFilter) {
      categoryFilter.addEventListener("change", () => this.filterTests());
    }

    const severityFilter = document.getElementById("hackingSeverityFilter");
    if (severityFilter) {
      severityFilter.addEventListener("change", () => this.filterTests());
    }

    const retryBtn = document.getElementById("hackingRetryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        if (!this.isLoadingTests) {
          this.loadTests();
        }
      });
    }
  }

  async openModal() {
    if (!this.initialized) {
      this.createErrorAlert("Error: Hacking Manager not initialized");
      return;
    }

    if (!this.modal) {
      this.createErrorAlert("Error: Modal not available");
      return;
    }

    try {
      this.modal.style.display = "block";
      document.body.style.overflow = "hidden";
      await this.loadTests();
    } catch (error) {
      this.createErrorAlert(`Error opening modal: ${error.message}`);
    }
  }

  closeModal() {
    if (this.modal) {
      this.modal.style.display = "none";
    }
    document.body.style.overflow = "auto";
    this.isLoadingTests = false;
  }

  async loadTests() {
    if (this.isLoadingTests) {
      return;
    }

    this.isLoadingTests = true;
    this.showLoading();

    try {
      const userToken = localStorage.getItem("matrix_token");

      if (!userToken) {
        throw new Error("Authentication token not found. Please log in.");
      }

      const response = await fetch("/hacking/tests", {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `Authentication failed: Server responded with status ${response.status}`,
          );
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        this.tests = data.tests || [];
        this.filteredTests = [...this.tests];
        this.renderTests();
        this.showTests();
      } else {
        throw new Error(data.message || "Failed to load security tests");
      }
    } catch (error) {
      this.showError(
        `Could not load tests from server: ${error.message}. Using local fallback.`,
      );

      this.loadHardcodedTests();
      this.renderTests();
      this.showTests();
    } finally {
      this.isLoadingTests = false;
    }
  }

  loadHardcodedTests() {
    this.tests = [
      {
        key: "HACK-005",
        summary: "Authentication and Session Management Testing",
        description: "Test login functionality for security weaknesses",
        category: "Authentication & Session Management",
        severity: "High",
        testing_type: "Security Assessment",
        target: "Authentication systems",
        instructions:
          "Navigate to the target website's login page. Test the following authentication security aspects: 1) Password policy - try creating accounts with weak passwords like '123', 'password', 'admin' 2) Account lockout - attempt 10+ failed login attempts with username 'admin' and random passwords 3) Common credentials - try combinations like admin/admin, admin/password, user/user, test/test 4) Session testing - after successful login, check if session cookies are secure by examining browser developer tools (F12) -> Application -> Cookies. 5) Password reset - if available, test the password reset functionality for information disclosure. 6) Brute force protection - test if there are any rate limiting mechanisms. Document any successful logins, weak password acceptance, or security misconfigurations.",
      },
      {
        key: "HACK-014",
        summary: "Clickjacking Vulnerability Testing",
        description:
          "Test for clickjacking vulnerabilities and frame protection",
        category: "Clickjacking Testing",
        severity: "Medium",
        testing_type: "UI Security Assessment",
        target: "Frame protection mechanisms",
        instructions:
          "Navigate to the target website and test for clickjacking vulnerabilities: 1) Check X-Frame-Options header in browser developer tools (F12) -> Network tab 2) Create a test iframe by opening browser console and executing: var iframe = document.createElement('iframe'); iframe.src = 'https://target-site.com'; iframe.style.width='100%'; iframe.style.height='500px'; document.body.appendChild(iframe); 3) Check if the site loads in the iframe 4) Test Content Security Policy frame-ancestors directive 5) Try embedding login pages in iframes to test if authentication forms are protected 6) Test different frame options like frame-src and child-src in CSP 7) Create a simple HTML page that attempts to frame the target site. Document whether the site can be embedded in frames, which could allow clickjacking attacks where attackers overlay invisible frames to trick users into clicking malicious links.",
      },
      {
        key: "HACK-001",
        summary: "SQL Injection Testing",
        description: "Test for SQL injection vulnerabilities in input fields",
        category: "Input Validation",
        severity: "High",
        testing_type: "Injection Testing",
        target: "Database interactions",
        instructions:
          "Navigate to the target website and test for SQL injection vulnerabilities: 1) Identify input fields (login forms, search boxes, contact forms, URL parameters) 2) Test basic SQL injection payloads: ' OR '1'='1' --, admin'-- , ' UNION SELECT NULL-- , '; DROP TABLE users-- 3) Test numeric injection: 1 OR 1=1, 1' OR '1'='1 4) Test time-based blind SQL injection: '; WAITFOR DELAY '00:00:05'-- , ' OR (SELECT SLEEP(5))-- 5) Check for error messages that reveal database information 6) Test URL parameters by adding ' or \" characters 7) Use browser developer tools to inspect responses for database errors or unusual behavior. Document any successful injections, error messages, or suspicious responses that indicate SQL injection vulnerabilities.",
      },
      {
        key: "HACK-002",
        summary: "Cross-Site Scripting (XSS) Testing",
        description: "Test for XSS vulnerabilities in user input fields",
        category: "Input Validation",
        severity: "High",
        testing_type: "Injection Testing",
        target: "User input processing",
        instructions:
          "Navigate to the target website and test for XSS vulnerabilities: 1) Identify all input fields (forms, search boxes, comments, profile fields) 2) Test basic XSS payloads: <script>alert('XSS')</script>, <img src=x onerror=alert('XSS')>, <svg onload=alert('XSS')> 3) Test reflected XSS in URL parameters: ?search=<script>alert('XSS')</script> 4) Test stored XSS by submitting payloads in forms that save data 5) Test DOM-based XSS by manipulating URL fragments 6) Use payload variations: \"><script>alert('XSS')</script>, javascript:alert('XSS'), <iframe src=javascript:alert('XSS')> 7) Check if the payloads execute or are reflected in the page source 8) Test filter bypasses with encoding or obfuscation. Document any successful XSS execution, reflected inputs, or filter bypass techniques that work.",
      },
      {
        key: "HACK-003",
        summary: "CSRF Token Validation Testing",
        description: "Test Cross-Site Request Forgery protection mechanisms",
        category: "Authentication & Session Management",
        severity: "Medium",
        testing_type: "CSRF Testing",
        target: "Form submissions",
        instructions:
          "Navigate to the target website and test CSRF protection: 1) Log into the application and identify forms that perform sensitive actions (password change, profile update, money transfer, etc.) 2) Use browser developer tools (F12) -> Network tab to capture form submissions 3) Look for CSRF tokens in forms or headers 4) Test CSRF protection by: a) Removing CSRF tokens from requests, b) Using old/expired CSRF tokens, c) Using CSRF tokens from different user sessions, d) Testing if CSRF tokens are validated server-side 5) Create a simple HTML page with a form that submits to the target application without CSRF tokens 6) Test if the application accepts requests without proper CSRF validation 7) Check if anti-CSRF measures like SameSite cookies are implemented. Document any successful CSRF attacks or missing protection mechanisms.",
      },
      {
        key: "HACK-006",
        summary: "Directory Traversal Testing",
        description:
          "Test for directory traversal vulnerabilities in file operations",
        category: "Input Validation",
        severity: "High",
        testing_type: "Path Traversal Testing",
        target: "File handling mechanisms",
        instructions:
          "Navigate to the target website and test for directory traversal vulnerabilities: 1) Identify file download, upload, or include functionality 2) Test path traversal payloads in file parameters: ../../../etc/passwd, ..\\..\\..\\windows\\system32\\drivers\\etc\\hosts, ....//....//....//etc/passwd 3) Test URL-encoded versions: %2e%2e%2f, %2e%2e%5c 4) Test double encoding: %252e%252e%252f 5) Look for file inclusion in URL parameters like ?file=, ?page=, ?include= 6) Test local file inclusion: ?file=../../../etc/passwd, ?page=../../../../windows/win.ini 7) Test for remote file inclusion if applicable 8) Use browser developer tools to check responses for system files or error messages. Document any successful file access, system information disclosure, or path traversal bypasses.",
      },
    ];
    this.filteredTests = [...this.tests];
  }

  showLoading() {
    this.setElementDisplay("hackingLoading", "block");
    this.setElementDisplay("hackingTestsContainer", "none");
    this.setElementDisplay("hackingError", "none");
  }

  showTests() {
    this.setElementDisplay("hackingLoading", "none");
    this.setElementDisplay("hackingTestsContainer", "block");
    this.setElementDisplay("hackingError", "none");
  }

  showError(message) {
    this.setElementDisplay("hackingLoading", "none");
    this.setElementDisplay("hackingTestsContainer", "none");
    this.setElementDisplay("hackingError", "block");

    const errorText = document.querySelector(".error-text");
    if (errorText) {
      errorText.textContent = message;
    }
  }

  setElementDisplay(elementId, displayValue) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = displayValue;
    }
  }

  filterTests() {
    const searchInput = document.getElementById("hackingSearchInput");
    const categoryFilter = document.getElementById("hackingCategoryFilter");
    const severityFilter = document.getElementById("hackingSeverityFilter");

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const categoryValue = categoryFilter ? categoryFilter.value : "";
    const severityValue = severityFilter ? severityFilter.value : "";

    this.filteredTests = this.tests.filter((test) => {
      const matchesSearch =
        !searchTerm ||
        test.key.toLowerCase().includes(searchTerm) ||
        test.summary.toLowerCase().includes(searchTerm) ||
        test.description.toLowerCase().includes(searchTerm) ||
        test.instructions.toLowerCase().includes(searchTerm);

      const matchesCategory = !categoryValue || test.category === categoryValue;
      const matchesSeverity = !severityValue || test.severity === severityValue;

      return matchesSearch && matchesCategory && matchesSeverity;
    });

    this.renderTests();
  }

  renderTests() {
    const container = document.getElementById("hackingTestsList");
    if (!container) {
      return;
    }

    if (this.filteredTests.length === 0) {
      container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.6);">
                    <p>No security tests found matching your criteria</p>
                </div>
            `;
      return;
    }

    container.innerHTML = this.filteredTests
      .map((test) => this.renderTestItem(test))
      .join("");
  }

  renderTestItem(test) {
    const severityClass = `severity-${test.severity.toLowerCase()}`;

    return `
            <div class="hacking-test-item" data-test-key="${test.key}">
                <div class="hacking-test-header" onclick="hackingManager.toggleTest('${test.key}')">
                    <div class="hacking-test-info">
                        <div class="hacking-test-key">${test.key}</div>
                        <div class="hacking-test-summary">${this.escapeHtml(test.summary)}</div>
                        <div class="hacking-test-meta">
                            <span class="hacking-test-severity ${severityClass}">${test.severity}</span>
                            <span>Category: ${this.escapeHtml(test.category)}</span>
                            <span>Type: ${test.testing_type}</span>
                        </div>
                    </div>
                    <div class="hacking-expand-icon">▶</div>
                </div>

                <div class="hacking-test-details">
                    <div class="hacking-test-description">${this.escapeHtml(test.instructions)}</div>

                    <div style="margin-bottom: 15px;">
                        <strong style="color: #ff6666;">Target:</strong>
                        <span style="color: #ffffff;">${this.escapeHtml(test.target)}</span>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <strong style="color: #ff6666;">Description:</strong>
                        <span style="color: #ffffff;">${this.escapeHtml(test.description)}</span>
                    </div>

                    <div class="hacking-test-actions">
                        <button class="hacking-execute-btn" onclick="hackingManager.executeTest('${test.key}')">
                            🛡️ Execute Security Test
                        </button>
                    </div>
                </div>
            </div>
        `;
  }

  toggleTest(testKey) {
    const testElement = document.querySelector(`[data-test-key="${testKey}"]`);
    if (testElement) {
      testElement.classList.toggle("expanded");
    }
  }

  async executeTest(testKey) {
    const test = this.tests.find((t) => t.key === testKey);
    if (!test) {
      this.showAlert("Security test not found", "error");
      return;
    }

    const targetUrlInput = document.getElementById("hackingTargetUrl");
    if (!targetUrlInput || !targetUrlInput.value.trim()) {
      this.showAlert("Please enter a target URL", "error");
      targetUrlInput?.focus();
      return;
    }

    const targetUrl = targetUrlInput.value.trim();

    try {
      new URL(targetUrl);
    } catch (e) {
      this.showAlert(
        "Please enter a valid URL (e.g., https://example.com)",
        "error",
      );
      return;
    }

    try {
      const executeBtn = document.querySelector(
        `[data-test-key="${testKey}"] .hacking-execute-btn`,
      );
      if (executeBtn) {
        executeBtn.disabled = true;
        executeBtn.textContent = "⏳ Loading...";
      }

      const fullInstructions = `TARGET URL: ${targetUrl}\n\nSECURITY TEST: ${test.summary}\n\nINSTRUCTIONS:\n${test.instructions}`;

      const systemInstructionsTextarea =
        document.getElementById("test-instructions");

      if (systemInstructionsTextarea) {
        systemInstructionsTextarea.value = fullInstructions;
        systemInstructionsTextarea.dispatchEvent(
          new Event("input", { bubbles: true }),
        );
        systemInstructionsTextarea.dispatchEvent(
          new Event("change", { bubbles: true }),
        );
      } else {
        this.showAlert("Error: System Instructions field not found", "error");
        return;
      }

      this.closeModal();
      this.showAlert(
        `Security test ${testKey} loaded successfully! Starting execution on ${targetUrl}...`,
        "success",
      );

      setTimeout(() => {
        this.triggerMainExecution();
      }, 500);
    } catch (error) {
      this.showAlert(
        `Error executing security test: ${error.message}`,
        "error",
      );

      const executeBtn = document.querySelector(
        `[data-test-key="${testKey}"] .hacking-execute-btn`,
      );
      if (executeBtn) {
        executeBtn.disabled = false;
        executeBtn.textContent = "🛡️ Execute Security Test";
      }
    }
  }

  triggerMainExecution() {
    const selectors = [
      '#test-form button[type="submit"]',
      "button.btn.btn-primary:not(.matrix-hacking-btn)",
      "#test-form .btn-primary",
      'form#test-form button[type="submit"]',
    ];

    let mainExecuteBtn = null;

    for (const selector of selectors) {
      mainExecuteBtn = document.querySelector(selector);
      if (mainExecuteBtn && mainExecuteBtn.textContent.trim() === "EXECUTE") {
        break;
      }
    }

    if (mainExecuteBtn) {
      if (mainExecuteBtn.disabled) {
        this.showAlert(
          "The execution button is disabled. Please check if all fields are filled correctly.",
          "warning",
        );
        return;
      }

      const instructionsField = document.getElementById("test-instructions");
      if (!instructionsField || !instructionsField.value.trim()) {
        this.showAlert(
          "Instructions field is empty. Cannot start execution.",
          "error",
        );
        return;
      }

      const form = document.getElementById("test-form");
      if (form) {
        form.requestSubmit(mainExecuteBtn);
      } else {
        mainExecuteBtn.click();
      }
    } else {
      this.showAlert(
        "Execution button not found. Please manually click the Execute button to start security testing.",
        "warning",
      );
    }
  }

  showAlert(message, type = "info") {
    const alertDiv = document.createElement("div");
    alertDiv.className = `matrix-alert matrix-alert-${type}`;
    alertDiv.innerHTML = `
            <div class="matrix-alert-content">
                <span class="matrix-alert-icon">${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}</span>
                <span class="matrix-alert-message">${this.escapeHtml(message)}</span>
                <button class="matrix-alert-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
    this.ensureAlertStyles();
    document.body.appendChild(alertDiv);

    setTimeout(() => {
      if (alertDiv.parentElement) {
        alertDiv.remove();
      }
    }, 5000);
  }

  createErrorAlert(message) {
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            background: rgba(100, 0, 0, 0.9);
            border: 2px solid #ff4444;
            color: #ffffff;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            max-width: 400px;
        `;
    errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2em;">❌</span>
                <span style="flex: 1;">${this.escapeHtml(message)}</span>
                <button onclick="this.parentElement.parentElement.remove()"
                        style="background: none; border: none; color: #ffffff; font-size: 1.2em; cursor: pointer;">×</button>
            </div>
        `;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 8000);
  }

  ensureAlertStyles() {
    if (!document.getElementById("matrixAlertStyles")) {
      const styles = document.createElement("style");
      styles.id = "matrixAlertStyles";
      styles.textContent = `
                .matrix-alert {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10001;
                    max-width: 400px;
                    border-radius: 8px;
                    box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
                    animation: slideInRight 0.3s ease;
                }
                .matrix-alert-success { background: rgba(0, 100, 0, 0.9); border: 2px solid #00ff00; }
                .matrix-alert-error { background: rgba(100, 0, 0, 0.9); border: 2px solid #ff4444; }
                .matrix-alert-info { background: rgba(0, 50, 100, 0.9); border: 2px solid #4488ff; }
                .matrix-alert-warning { background: rgba(100, 50, 0, 0.9); border: 2px solid #ff8844; }
                .matrix-alert-content {
                    padding: 15px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #ffffff;
                    font-family: 'Courier New', monospace;
                }
                .matrix-alert-icon { font-size: 1.2em; }
                .matrix-alert-message { flex: 1; white-space: pre-line; }
                .matrix-alert-close {
                    background: none;
                    border: none;
                    color: #ffffff;
                    font-size: 1.2em;
                    cursor: pointer;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
      document.head.appendChild(styles);
    }
  }

  cleanup() {
    const hackingBtn = document.getElementById("hackingBtn");
    if (hackingBtn && this.handleHackingBtnClick) {
      hackingBtn.removeEventListener("click", this.handleHackingBtnClick);
    }

    if (this.handleOutsideClick) {
      window.removeEventListener("click", this.handleOutsideClick);
    }

    if (this.handleEscapeKey) {
      document.removeEventListener("keydown", this.handleEscapeKey);
    }
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

let hackingManager;

function initializeHackingManager() {
  try {
    if (typeof HackingTestsManager === "undefined") {
      return;
    }

    if (window.hackingManager) {
      return;
    }

    hackingManager = new HackingTestsManager();
    window.hackingManager = hackingManager;
  } catch (error) {
    console.error("Error initializing Hacking Manager:", error);
  }
}

let hackingInitialized = false;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (!hackingInitialized) {
      hackingInitialized = true;
      initializeHackingManager();
    }
  });
} else {
  if (!hackingInitialized) {
    hackingInitialized = true;
    initializeHackingManager();
  }
}

window.addEventListener("load", () => {
  if (!window.hackingManager && !hackingInitialized) {
    hackingInitialized = true;
    setTimeout(initializeHackingManager, 100);
  }
});

window.addEventListener("beforeunload", () => {
  if (window.hackingManager) {
    window.hackingManager.cleanup();
  }
});

window.debugHacking = function () {
  console.log("Hacking Manager Debug Info:");
  console.log("- Manager initialized:", !!window.hackingManager);
  console.log("- Tests loaded:", window.hackingManager?.tests?.length || 0);
  console.log("- Modal element:", !!document.getElementById("hackingModal"));
};

window.testHackingExecution = function () {
  const instructionsField = document.getElementById("test-instructions");
  if (!instructionsField) {
    console.error("Instructions field not found");
    return;
  }

  instructionsField.value =
    "TARGET URL: https://example.com\n\nSECURITY TEST: SQL Injection Testing\n\nINSTRUCTIONS:\nTest for SQL injection vulnerabilities in the target website...";
  instructionsField.dispatchEvent(new Event("input", { bubbles: true }));

  if (window.hackingManager) {
    window.hackingManager.triggerMainExecution();
  }
};
