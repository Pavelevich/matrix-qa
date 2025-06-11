class JiraTicketsManager {
  constructor() {
    this.tickets = [];
    this.filteredTickets = [];
    this.modal = null;
    this.initialized = false;
    this.isLoadingTickets = false;
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
    this.modal = document.getElementById("jiraModal");
    if (!this.modal) {
      this.createErrorAlert(
        'Jira Modal not found. Verify that the HTML has the element with ID "jiraModal".',
      );
      return;
    }

    this.setupEventListeners();
    this.initialized = true;
  }

  setupEventListeners() {
    const jiraBtn = document.getElementById("jiraBtn");
    if (jiraBtn) {
      jiraBtn.removeEventListener("click", this.handleJiraBtnClick);
      this.handleJiraBtnClick = (e) => {
        e.preventDefault();
        this.openModal();
      };
      jiraBtn.addEventListener("click", this.handleJiraBtnClick);
    } else {
      this.createErrorAlert(
        'Jira button not found. Verify that the HTML has the element with ID "jiraBtn".',
      );
    }

    const closeBtn = document.querySelector(".jira-close");
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
    const searchInput = document.getElementById("jiraSearchInput");
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.filterTickets(e.target.value);
        }, 300);
      });
    }

    const statusFilter = document.getElementById("jiraStatusFilter");
    if (statusFilter) {
      statusFilter.addEventListener("change", (e) =>
        this.filterByStatus(e.target.value),
      );
    }

    const retryBtn = document.getElementById("jiraRetryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        if (!this.isLoadingTickets) {
          this.loadTickets();
        }
      });
    }
  }

  async openModal() {
    if (!this.initialized) {
      this.createErrorAlert("Error: Jira Manager not initialized");
      return;
    }

    if (!this.modal) {
      this.createErrorAlert("Error: Modal not available");
      return;
    }

    try {
      this.modal.style.display = "block";
      document.body.style.overflow = "hidden";
      await this.loadTickets();
    } catch (error) {
      this.createErrorAlert(`Error opening modal: ${error.message}`);
    }
  }

  closeModal() {
    if (this.modal) {
      this.modal.style.display = "none";
    }
    document.body.style.overflow = "auto";
    this.isLoadingTickets = false;
  }

  getAuthHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };

    let token =
      localStorage.getItem("matrix_token") ||
      localStorage.getItem("auth_token") ||
      sessionStorage.getItem("matrix_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("auth_token");

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log(
        "🔑 Using JWT token for Jira request:",
        token.substring(0, 20) + "...",
      );
      return headers;
    }

    console.warn("⚠️ No JWT token found, trying with API key fallback");
    headers["X-API-Key"] = "qa_secret_key";

    return headers;
  }

  async verifyAuthentication() {
    try {
      const headers = this.getAuthHeaders();

      const response = await fetch("/jira/status", {
        method: "GET",
        headers: headers,
      });

      if (response.ok) {
        console.log("✅ Authentication verified successfully");
        return true;
      } else if (response.status === 401) {
        console.error("❌ Authentication failed - token invalid or expired");
        this.handleAuthError();
        return false;
      } else {
        console.error(
          "❌ Server error during auth verification:",
          response.status,
        );
        return false;
      }
    } catch (error) {
      console.error("❌ Network error during auth verification:", error);
      return false;
    }
  }

  handleAuthError() {
    console.log("🔄 Handling authentication error...");

    this.showAuthErrorAlert();

    this.closeModal();

    setTimeout(() => {
      this.redirectToLogin();
    }, 3000);
  }

  showAuthErrorAlert() {
    const alertMessage = `Authentication failed. Your session may have expired.

Please try:
1. Refreshing the page and logging in again
2. Checking if you have proper permissions
3. Contacting your administrator if the problem persists`;

    this.showAlert(alertMessage, "error");
  }

  redirectToLogin() {
    const loginContainer = document.getElementById("login-container");
    const appContainer = document.getElementById("app-container");

    if (loginContainer && appContainer) {
      localStorage.removeItem("matrix_token");
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("matrix_token");
      localStorage.removeItem("token");
      sessionStorage.removeItem("auth_token");

      loginContainer.style.display = "block";
      appContainer.style.display = "none";

      console.log("👤 Redirected to login page");
    } else {
      const shouldRefresh = confirm(
        "Session expired. Would you like to refresh the page?",
      );
      if (shouldRefresh) {
        window.location.reload();
      }
    }
  }

  async loadTickets() {
    if (this.isLoadingTickets) {
      return;
    }

    this.isLoadingTickets = true;
    this.showLoading();

    try {
      console.log("🎯 Loading Jira tickets...");

      const isAuthenticated = await this.verifyAuthentication();
      if (!isAuthenticated) {
        throw new Error("Authentication verification failed");
      }

      const headers = this.getAuthHeaders();
      console.log("📤 Request headers:", headers);

      const response = await fetch("/jira/tickets", {
        method: "GET",
        headers: headers,
      });

      console.log("📥 Response status:", response.status);
      console.log("📥 Response headers:", Object.fromEntries(response.headers));

      if (!response.ok) {
        if (response.status === 401) {
          this.handleAuthError();
          throw new Error("Authentication failed. Please log in again.");
        } else if (response.status === 403) {
          throw new Error(
            "Access denied. You may not have permission to view Jira tickets.",
          );
        } else if (response.status === 503) {
          throw new Error("Jira service not initialized on server.");
        } else {
          const errorText = await response.text();
          throw new Error(
            `HTTP ${response.status}: ${errorText || response.statusText}`,
          );
        }
      }

      const data = await response.json();
      console.log("✅ Jira tickets loaded:", data);

      if (data.success) {
        this.tickets = data.tickets || [];
        this.filteredTickets = [...this.tickets];
        this.renderTickets();
        this.showTickets();

        if (this.tickets.length === 0) {
          this.showInfo("No Jira tickets found with automation labels.");
        }
      } else {
        throw new Error(data.message || "Failed to load tickets");
      }
    } catch (error) {
      console.error("❌ Error loading Jira tickets:", error);

      if (
        error.message.includes("Authentication") ||
        error.message.includes("401")
      ) {
        this.showError(`Authentication Error: ${error.message}`);
      } else {
        this.showError(`Error loading tickets: ${error.message}`);
      }
    } finally {
      this.isLoadingTickets = false;
    }
  }

  showLoading() {
    this.setElementDisplay("jiraLoading", "block");
    this.setElementDisplay("jiraTicketsContainer", "none");
    this.setElementDisplay("jiraError", "none");
  }

  showTickets() {
    this.setElementDisplay("jiraLoading", "none");
    this.setElementDisplay("jiraTicketsContainer", "block");
    this.setElementDisplay("jiraError", "none");
  }

  showError(message) {
    this.setElementDisplay("jiraLoading", "none");
    this.setElementDisplay("jiraTicketsContainer", "none");
    this.setElementDisplay("jiraError", "block");

    const errorText = document.querySelector(".error-text");
    if (errorText) {
      errorText.textContent = message;
    }
  }

  showInfo(message) {
    const container = document.getElementById("jiraTicketsList");
    if (container) {
      container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.8);">
                    <p>ℹ️ ${message}</p>
                </div>
            `;
    }
    this.showTickets();
  }

  setElementDisplay(elementId, displayValue) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = displayValue;
    }
  }

  filterTickets(searchTerm) {
    const statusFilter = document.getElementById("jiraStatusFilter");
    const statusValue = statusFilter ? statusFilter.value : "";

    this.filteredTickets = this.tickets.filter((ticket) => {
      const matchesSearch =
        !searchTerm ||
        ticket.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = !statusValue || ticket.status === statusValue;

      return matchesSearch && matchesStatus;
    });
    this.renderTickets();
  }

  filterByStatus(status) {
    const searchInput = document.getElementById("jiraSearchInput");
    const searchTerm = searchInput ? searchInput.value : "";
    this.filterTickets(searchTerm);
  }

  renderTickets() {
    const container = document.getElementById("jiraTicketsList");
    if (!container) {
      return;
    }

    if (this.filteredTickets.length === 0) {
      container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.6);">
                    <p>No tickets found matching your criteria</p>
                </div>
            `;
      return;
    }

    container.innerHTML = this.filteredTickets
      .map((ticket) => this.renderTicketItem(ticket))
      .join("");
  }

  renderTicketItem(ticket) {
    const statusClass =
      ticket.status === "Done" ? "status-done" : "status-progress";

    return `
            <div class="jira-ticket-item" data-ticket-key="${ticket.key}">
                <div class="jira-ticket-header" onclick="jiraManager.toggleTicket('${ticket.key}')">
                    <div class="jira-ticket-info">
                        <div class="jira-ticket-key">${ticket.key}</div>
                        <div class="jira-ticket-summary">${this.escapeHtml(ticket.summary)}</div>
                        <div class="jira-ticket-meta">
                            <span class="jira-ticket-status ${statusClass}">${ticket.status}</span>
                            <span>Assignee: ${this.escapeHtml(ticket.assignee)}</span>
                            <span>Priority: ${ticket.priority}</span>
                            <span>Updated: ${this.formatDate(ticket.updated)}</span>
                        </div>
                    </div>
                    <div class="jira-expand-icon">▶</div>
                </div>

                <div class="jira-ticket-details">
                    <div class="jira-ticket-description">${this.escapeHtml(ticket.description)}</div>

                    <div style="margin-bottom: 15px;">
                        <strong style="color: #00ff00;">Labels:</strong>
                        <span style="color: #ffffff;">${ticket.labels ? ticket.labels.join(", ") : "None"}</span>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <strong style="color: #00ff00;">Components:</strong>
                        <span style="color: #ffffff;">${ticket.components ? ticket.components.join(", ") : "None"}</span>
                    </div>

                    <div class="jira-ticket-actions">
                        <button class="jira-view-btn" onclick="window.open('${ticket.url}', '_blank')">
                            View in Jira
                        </button>
                        <button class="jira-execute-btn" onclick="jiraManager.executeTicket('${ticket.key}')">
                            🚀 Execute Test
                        </button>
                    </div>
                </div>
            </div>
        `;
  }

  toggleTicket(ticketKey) {
    const ticketElement = document.querySelector(
      `[data-ticket-key="${ticketKey}"]`,
    );
    if (ticketElement) {
      ticketElement.classList.toggle("expanded");
    }
  }

  async executeTicket(ticketKey) {
    const ticket = this.tickets.find((t) => t.key === ticketKey);
    if (!ticket) {
      this.showAlert("Ticket not found", "error");
      return;
    }

    try {
      const isAuthenticated = await this.verifyAuthentication();
      if (!isAuthenticated) {
        this.showAlert("Authentication failed. Please log in again.", "error");
        return;
      }

      const executeBtn = document.querySelector(
        `[data-ticket-key="${ticketKey}"] .jira-execute-btn`,
      );
      if (executeBtn) {
        executeBtn.disabled = true;
        executeBtn.textContent = "⏳ Loading...";
      }

      const headers = this.getAuthHeaders();

      const response = await fetch(`/jira/execute-ticket/${ticketKey}`, {
        method: "POST",
        headers: headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.handleAuthError();
          throw new Error("Authentication failed. Please log in again.");
        } else if (response.status === 403) {
          throw new Error(
            "Access denied. You may not have permission to execute tickets.",
          );
        } else {
          const errorText = await response.text();
          throw new Error(
            `HTTP ${response.status}: ${errorText || response.statusText}`,
          );
        }
      }

      const data = await response.json();

      if (data.success) {
        const systemInstructionsTextarea =
          document.getElementById("test-instructions");

        if (systemInstructionsTextarea) {
          systemInstructionsTextarea.value = data.instructions;
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
          `Ticket ${ticketKey} loaded successfully! Starting execution...`,
          "success",
        );

        setTimeout(() => {
          this.triggerMainExecution();
        }, 500);
      } else {
        throw new Error(data.message || "Failed to execute ticket");
      }
    } catch (error) {
      console.error("Error executing ticket:", error);
      this.showAlert(`Error executing ticket: ${error.message}`, "error");

      const executeBtn = document.querySelector(
        `[data-ticket-key="${ticketKey}"] .jira-execute-btn`,
      );
      if (executeBtn) {
        executeBtn.disabled = false;
        executeBtn.textContent = "🚀 Execute Test";
      }
    }
  }

  triggerMainExecution() {
    const selectors = [
      '#test-form button[type="submit"]',
      "button.btn.btn-primary:not(.matrix-jira-btn)",
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
        "Execution button not found. Please manually click the Execute button to start automation.",
        "warning",
      );
    }
  }

  showAlert(message, type = "info") {
    const alertDiv = document.createElement("div");
    alertDiv.className = `matrix-alert matrix-alert-${type}`;
    alertDiv.innerHTML = `
            <div class="matrix-alert-content">
                <span class="matrix-alert-icon">${type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"}</span>
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
    const jiraBtn = document.getElementById("jiraBtn");
    if (jiraBtn && this.handleJiraBtnClick) {
      jiraBtn.removeEventListener("click", this.handleJiraBtnClick);
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

  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return (
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch (error) {
      return dateString || "Invalid date";
    }
  }

  async debugJiraService() {
    try {
      const headers = this.getAuthHeaders();

      const response = await fetch("/jira/debug", {
        headers: headers,
      });

      const data = await response.json();
      console.log("🔧 Jira Service Debug Info:");
      console.table(data.debug_info || data);
      return data;
    } catch (error) {
      console.error("Failed to get Jira debug info:", error);
    }
  }

  async reloadTickets() {
    try {
      const headers = this.getAuthHeaders();

      const response = await fetch("/jira/reload-tickets", {
        method: "POST",
        headers: headers,
      });

      const data = await response.json();
      if (data.success) {
        console.log("✅ Tickets reloaded successfully");
        await this.loadTickets();
        this.showAlert("Tickets reloaded successfully!", "success");
      } else {
        throw new Error(data.message || "Failed to reload tickets");
      }
    } catch (error) {
      console.error("❌ Error reloading tickets:", error);
      this.showAlert(`Error reloading tickets: ${error.message}`, "error");
    }
  }

  async diagnoseFull() {
    console.log("🏥 === COMPLETE JIRA AUTH DIAGNOSIS ===");

    const tokens = {
      matrix_token: localStorage.getItem("matrix_token"),
      auth_token: localStorage.getItem("auth_token"),
      session_matrix: sessionStorage.getItem("matrix_token"),
    };

    console.log("📱 Available tokens:");
    Object.entries(tokens).forEach(([key, value]) => {
      console.log(
        `  ${key}: ${value ? value.substring(0, 20) + "..." : "NOT FOUND"}`,
      );
    });

    const authResult = await this.verifyAuthentication();
    console.log(
      "🔐 Authentication test:",
      authResult ? "✅ SUCCESS" : "❌ FAILED",
    );

    try {
      await this.debugJiraService();
    } catch (error) {
      console.error("❌ Debug endpoint failed:", error);
    }

    return {
      tokens,
      authResult,
      timestamp: new Date().toISOString(),
    };
  }
}

let jiraManager;

function initializeJiraManager() {
  try {
    if (typeof JiraTicketsManager === "undefined") {
      console.warn("JiraTicketsManager class not defined");
      return;
    }

    if (window.jiraManager) {
      console.log("Jira Manager already initialized");
      return;
    }

    jiraManager = new JiraTicketsManager();
    window.jiraManager = jiraManager;
    console.log("✅ Jira Manager initialized successfully");
  } catch (error) {
    console.error("Error initializing Jira Manager:", error);
  }
}

let jiraInitialized = false;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (!jiraInitialized) {
      jiraInitialized = true;
      initializeJiraManager();
    }
  });
} else {
  if (!jiraInitialized) {
    jiraInitialized = true;
    initializeJiraManager();
  }
}

window.addEventListener("load", () => {
  if (!window.jiraManager && !jiraInitialized) {
    jiraInitialized = true;
    setTimeout(initializeJiraManager, 100);
  }
});

window.addEventListener("beforeunload", () => {
  if (window.jiraManager) {
    window.jiraManager.cleanup();
  }
});

window.debugJiraService = function () {
  if (window.jiraManager) {
    return window.jiraManager.debugJiraService();
  } else {
    console.error("Jira manager not initialized");
  }
};

window.reloadJiraTickets = function () {
  if (window.jiraManager) {
    return window.jiraManager.reloadTickets();
  } else {
    console.error("Jira manager not initialized");
  }
};

window.diagnoseJiraAuth = function () {
  if (window.jiraManager) {
    return window.jiraManager.diagnoseFull();
  } else {
    console.error("Jira manager not initialized");
  }
};

window.testJiraExecution = function () {
  const instructionsField = document.getElementById("test-instructions");
  if (!instructionsField) {
    console.error("Instructions field not found");
    return;
  }

  instructionsField.value = "Test if apple.com and google.com are loading";
  instructionsField.dispatchEvent(new Event("input", { bubbles: true }));
  instructionsField.dispatchEvent(new Event("change", { bubbles: true }));

  if (window.jiraManager) {
    window.jiraManager.triggerMainExecution();
  }
};

window.emergencyJiraAuthFix = function () {
  console.log("🚨 EMERGENCY JIRA AUTH FIX");

  if (window.jiraManager) {
    window.jiraManager.getAuthHeaders = function () {
      console.log("🔧 Using emergency API key authentication");
      return {
        "Content-Type": "application/json",
        "X-API-Key": "qa_secret_key",
      };
    };

    console.log("✅ Emergency fix applied. Try opening Jira tickets now.");
    return true;
  } else {
    console.error("❌ Jira manager not found");
    return false;
  }
};

console.log("🚀 Enhanced Jira Manager with Authentication Fixes Loaded");
console.log("🔧 Available debug functions:");
console.log("   - window.debugJiraService()");
console.log("   - window.diagnoseJiraAuth()");
console.log("   - window.emergencyJiraAuthFix()");
console.log("   - window.reloadJiraTickets()");
console.log("   - window.testJiraExecution()");
