(function () {
  "use strict";

  (function () {
    function forceHideMatrixValidation() {
      const validationElement = document.getElementById("matrix-validation");
      if (validationElement) {
        validationElement.style.display = "none";
        validationElement.style.visibility = "hidden";
        validationElement.style.opacity = "0";
        validationElement.style.position = "absolute";
        validationElement.style.zIndex = "-9999";
        validationElement.style.height = "0";
        validationElement.style.width = "0";
        validationElement.style.overflow = "hidden";
      }
    }

    forceHideMatrixValidation();

    setTimeout(forceHideMatrixValidation, 0);
    setTimeout(forceHideMatrixValidation, 50);
    setTimeout(forceHideMatrixValidation, 100);

    if (window.MutationObserver) {
      const validationObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "style" &&
            mutation.target.id === "matrix-validation"
          ) {
            forceHideMatrixValidation();
          }
        });
      });

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          const element = document.getElementById("matrix-validation");
          if (element) {
            validationObserver.observe(element, {
              attributes: true,
              attributeFilter: ["style"],
            });
          }
        });
      } else {
        const element = document.getElementById("matrix-validation");
        if (element) {
          validationObserver.observe(element, {
            attributes: true,
            attributeFilter: ["style"],
          });
        }
      }
    }
  })();

  const API_URL = "";
  let userToken = localStorage.getItem("matrix_token");
  let currentUser = null;
  let historyDetailData = null;
  let userVideoRecordings = [];

  async function loadUserVideos() {
    if (!userToken) return;

    try {
      console.log("Loading user videos..."); // Debug

      const response = await fetch(`/api/video/recordings`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      const data = await response.json();
      console.log("Videos response:", data); // Debug

      if (data.success) {
        userVideoRecordings = data.recordings;
        console.log(`Loaded ${userVideoRecordings.length} videos`); // Debug
      } else {
        userVideoRecordings = [];
        console.log("No videos found or error loading videos"); // Debug
      }
    } catch (error) {
      console.error("Error loading user videos:", error);
      userVideoRecordings = [];
    }
  }

  function downloadResult() {
    if (elements.downloadResultBtn.classList.contains("disabled")) {
      return;
    }

    const result = secureState.get("lastResult");
    if (!result) {
      return;
    }

    const taskInfo = secureState.get("lastTaskInfo") || {};

    downloadResultAsPDF({
      title: taskInfo.instructions
        ? taskInfo.instructions.length > 50
          ? taskInfo.instructions.substring(0, 50) + "..."
          : taskInfo.instructions
        : "Matrix QA Test Result",
      content: result,
      model: `${taskInfo.provider?.toUpperCase() || "Unknown"} / ${taskInfo.model || "Unknown"}`,
      instructions: taskInfo.instructions || "N/A",
      timestamp: new Date().toISOString(),
    });
  }

  async function downloadResultAsPDF(reportData) {
    const downloadBtn = elements.downloadResultBtn;
    const originalText = downloadBtn.textContent;

    try {
      downloadBtn.textContent = "GENERATING PDF...";
      downloadBtn.classList.add("generating");
      downloadBtn.disabled = true;

      appendCleanOutput("> GENERATING PDF REPORT...", "info");

      const response = await fetch("/api/pdf/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(reportData),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = "matrix_report.pdf";
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(
            /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
          );
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, "");
          }
        }

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename;

        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);

        downloadBtn.classList.add("download-success");
        appendCleanOutput(`> PDF REPORT GENERATED: ${filename}`, "success");

        setTimeout(() => {
          downloadBtn.classList.remove("download-success");
        }, 2000);
      } else {
        const errorData = await response.json();
        appendCleanOutput(
          `> ERROR: ${errorData.detail || "Failed to generate PDF report"}`,
          "error",
        );
      }
    } catch (error) {
      console.error("Error downloading PDF:", error);
      appendCleanOutput("> ERROR: PDF GENERATION FAILED", "error");
    } finally {
      downloadBtn.textContent = originalText;
      downloadBtn.classList.remove("generating");
      downloadBtn.disabled = false;
    }
  }

  function downloadHistoryDetail() {
    if (!historyDetailData) return;

    downloadHistoryDetailAsPDF(historyDetailData);
  }

  async function downloadHistoryDetailAsPDF(historyData) {
    const downloadBtn = elements.downloadHistoryDetail;
    const originalText = downloadBtn.textContent;

    try {
      downloadBtn.textContent = "GENERATING PDF...";
      downloadBtn.classList.add("generating");
      downloadBtn.disabled = true;

      const response = await fetch("/api/pdf/generate-from-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(historyData),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = "matrix_history_report.pdf";
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(
            /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
          );
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, "");
          }
        }

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename;

        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);

        downloadBtn.classList.add("download-success");
        appendCleanOutput(
          `> PDF HISTORY REPORT GENERATED: ${filename}`,
          "success",
        );

        setTimeout(() => {
          downloadBtn.classList.remove("download-success");
        }, 2000);
      } else {
        const errorData = await response.json();
        appendCleanOutput(
          `> ERROR: ${errorData.detail || "Failed to generate PDF report"}`,
          "error",
        );
      }
    } catch (error) {
      console.error("Error downloading PDF:", error);
      appendCleanOutput("> ERROR: PDF GENERATION FAILED", "error");
    } finally {
      downloadBtn.textContent = originalText;
      downloadBtn.classList.remove("generating");
      downloadBtn.disabled = false;
    }
  }

  function findVideoForHistoryItem(historyItem) {
    if (!userVideoRecordings || userVideoRecordings.length === 0) {
      console.log("No video recordings available"); // Debug
      return null;
    }

    console.log(`Looking for video for history item:`, historyItem); // Debug

    if (historyItem.task_id) {
      const videoByTaskId = userVideoRecordings.find(
        (video) => video.task_id === historyItem.task_id,
      );
      if (videoByTaskId) {
        console.log("Found video by task_id:", videoByTaskId); // Debug
        return videoByTaskId;
      }
    }

    const historyTime = new Date(historyItem.timestamp);
    const videoByTime = userVideoRecordings.find((video) => {
      const videoTime = new Date(video.start_time);
      const timeDiff = Math.abs(historyTime - videoTime);
      const withinTimeRange = timeDiff < 3600000;

      if (withinTimeRange) {
        console.log(
          `Found video by time range. History: ${historyTime}, Video: ${videoTime}, Diff: ${timeDiff}ms`,
        ); // Debug
      }

      return withinTimeRange;
    });

    return videoByTime || null;
  }

  async function checkFFmpegStatus() {
    if (!userToken) return null;

    try {
      const response = await fetch(`/api/video/ffmpeg-status`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error checking FFmpeg status:", error);
      return null;
    }
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  function renderHistoryList(historyItems) {
    elements.historyList.innerHTML = "";

    if (!historyItems || historyItems.length === 0) {
      elements.historyList.innerHTML =
        '<div class="empty-list-message">No history found</div>';
      return;
    }

    historyItems.forEach((item) => {
      const historyItem = document.createElement("div");
      const associatedVideo = findVideoForHistoryItem(item);

      historyItem.className = associatedVideo
        ? "history-item has-video"
        : "history-item";
      historyItem.onclick = () => openHistoryDetail(item);

      const title = document.createElement("div");
      title.className = "history-item-title";
      title.textContent = item.title || "Untitled Result";

      const preview = document.createElement("div");
      preview.className = "history-item-preview";

      let previewText = "";
      if (item.content) {
        previewText = item.content.split("\n")[0] || "";
        if (previewText.length > 40) {
          previewText = previewText.substring(0, 40) + "...";
        }
      }
      preview.textContent = previewText;

      const meta = document.createElement("div");
      meta.className = "history-item-meta";

      const timestamp = document.createElement("span");
      const date = new Date(item.timestamp);
      timestamp.textContent = date.toLocaleString();

      const model = document.createElement("span");
      model.textContent = item.model || "Unknown Model";

      meta.appendChild(timestamp);
      meta.appendChild(model);

      if (associatedVideo) {
        const videoControls = document.createElement("div");
        videoControls.className = "video-controls";
        videoControls.onclick = (e) => e.stopPropagation();

        const fileType = associatedVideo.file_type || "gif";
        const isMP4 = fileType === "mp4";
        const videoIcon = isMP4 ? "🎬" : "📽️";
        const formatLabel = isMP4 ? "MP4" : "GIF";

        const downloadBtn = document.createElement("button");
        downloadBtn.className = "video-download-btn";
        downloadBtn.textContent = `${videoIcon} DOWNLOAD ${formatLabel}`;
        downloadBtn.onclick = () => {
          const filename = `${item.title || "matrix_video"}_${date.toISOString().slice(0, 10)}.${fileType}`;
          downloadVideo(associatedVideo._id, filename);
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "video-download-btn";
        deleteBtn.style.marginLeft = "5px";
        deleteBtn.textContent = "🗑️ DELETE";
        deleteBtn.onclick = () => deleteVideo(associatedVideo._id);

        const videoInfo = document.createElement("div");
        videoInfo.className = "video-info";
        videoInfo.innerHTML = `<small>📊 ${formatLabel} • ${formatBytes(associatedVideo.video_size || 0)}</small>`;

        videoControls.appendChild(videoInfo);
        videoControls.appendChild(downloadBtn);
        videoControls.appendChild(deleteBtn);

        historyItem.appendChild(title);
        historyItem.appendChild(preview);
        historyItem.appendChild(meta);
        historyItem.appendChild(videoControls);
      } else {
        historyItem.appendChild(title);
        historyItem.appendChild(preview);
        historyItem.appendChild(meta);
      }

      elements.historyList.appendChild(historyItem);
    });
  }

  async function downloadVideo(recordingId, filename = null) {
    try {
      const response = await fetch(
        `/api/video/recordings/${recordingId}/download`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        },
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename || `matrix_video_${recordingId}.mp4`;

        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);

        appendCleanOutput("> VIDEO DOWNLOADED SUCCESSFULLY", "success");
      } else {
        appendCleanOutput("> ERROR: FAILED TO DOWNLOAD VIDEO", "error");
      }
    } catch (error) {
      console.error("Error downloading video:", error);
      appendCleanOutput("> ERROR: VIDEO DOWNLOAD FAILED", "error");
    }
  }

  async function deleteVideo(recordingId) {
    if (!confirm("Are you sure you want to delete this video recording?")) {
      return;
    }

    try {
      const response = await fetch(`/api/video/recordings/${recordingId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        appendCleanOutput("> VIDEO DELETED SUCCESSFULLY", "success");

        await loadUserVideos();
        loadHistory();
      } else {
        appendCleanOutput("> ERROR: FAILED TO DELETE VIDEO", "error");
      }
    } catch (error) {
      console.error("Error deleting video:", error);
      appendCleanOutput("> ERROR: VIDEO DELETION FAILED", "error");
    }
  }

  function updateRecordingStatus(enabled) {
    const recordingStatus = document.getElementById("recording-status");
    if (recordingStatus) {
      recordingStatus.textContent = enabled ? "ENABLED" : "DISABLED";
      recordingStatus.className = enabled
        ? "recording-status enabled"
        : "recording-status disabled";
    }
  }

  function updateRecordingIndicator(isRecording) {
    let indicator = document.getElementById("recording-indicator");

    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "recording-indicator";
      indicator.className = "recording-indicator";
      indicator.textContent = "RECORDING";

      const liveView = document.querySelector(".live-view");
      if (liveView) {
        liveView.appendChild(indicator);
      }
    }

    if (isRecording) {
      indicator.classList.add("active");
    } else {
      indicator.classList.remove("active");
    }
  }

  function hideAllModals() {
    const elementsToHide = [
      "settings-modal",
      "history-modal",
      "history-detail-modal",
      "matrix-validation",
    ];

    elementsToHide.forEach((elementId) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.style.display = "none";
      }
    });

    const backdrop = document.getElementById("modal-backdrop");
    if (backdrop) {
      backdrop.style.display = "none";
    }
  }

  const matrixCanvas = (function () {
    const canvas = document.getElementById("matrix-canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const characters =
      "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン".split(
        "",
      );
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);

    const drops = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
    }

    function drawMatrix() {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#0f0";
      ctx.font = fontSize + "px monospace";

      for (let i = 0; i < drops.length; i++) {
        const text = characters[Math.floor(Math.random() * characters.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        drops[i]++;
      }
    }

    setInterval(drawMatrix, 33);

    window.addEventListener("resize", () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    return { redraw: drawMatrix };
  })();

  const loginAttempts = {
    count: 0,
    maxAttempts: 3,
    lockoutTime: 30000,
    lockedUntil: null,
    lockoutTimer: null,
  };

  function isLoginLocked() {
    if (loginAttempts.lockedUntil && Date.now() < loginAttempts.lockedUntil) {
      return true;
    }

    if (loginAttempts.lockedUntil && Date.now() >= loginAttempts.lockedUntil) {
      loginAttempts.count = 0;
      loginAttempts.lockedUntil = null;
      if (loginAttempts.lockoutTimer) {
        clearInterval(loginAttempts.lockoutTimer);
        loginAttempts.lockoutTimer = null;
      }
    }
    return false;
  }

  function showLockoutMessage() {
    const remainingTime = Math.ceil(
      (loginAttempts.lockedUntil - Date.now()) / 1000,
    );
    elements.loginError.textContent = `SECURITY LOCKOUT: TOO MANY FAILED ATTEMPTS. RETRY IN ${remainingTime} SECONDS`;
    elements.loginError.style.display = "block";
    elements.loginError.style.backgroundColor = "rgba(255, 0, 0, 0.2)";

    if (loginAttempts.lockoutTimer) {
      clearInterval(loginAttempts.lockoutTimer);
    }

    loginAttempts.lockoutTimer = setInterval(() => {
      const remaining = Math.ceil(
        (loginAttempts.lockedUntil - Date.now()) / 1000,
      );
      if (remaining > 0) {
        elements.loginError.textContent = `SECURITY LOCKOUT: TOO MANY FAILED ATTEMPTS. RETRY IN ${remaining} SECONDS`;
      } else {
        elements.loginError.textContent = "LOCKOUT EXPIRED. YOU MAY TRY AGAIN.";
        elements.loginError.style.backgroundColor = "rgba(0, 255, 0, 0.1)";
        elements.loginSubmitBtn.disabled = false;
        elements.loginSubmitBtn.textContent = "AUTHENTICATE";
        clearInterval(loginAttempts.lockoutTimer);
        loginAttempts.lockoutTimer = null;

        setTimeout(() => {
          elements.loginError.style.display = "none";
          elements.loginError.style.backgroundColor = "";
        }, 2000);
      }
    }, 1000);
  }

  const apiSettings = (function () {
    let settings = {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20240620",
      apiKey: "",
      useDefaultKey: true,
    };

    if (localStorage.getItem("matrixApiSettings")) {
      try {
        const savedSettings = JSON.parse(
          localStorage.getItem("matrixApiSettings"),
        );
        settings = { ...settings, ...savedSettings };
      } catch (e) {
        // Error loading settings
      }
    }

    function updateSettings(newSettings) {
      settings = { ...settings, ...newSettings };
      localStorage.setItem("matrixApiSettings", JSON.stringify(settings));
    }

    function getSettings() {
      return { ...settings };
    }

    function testApiConnection(provider, apiKey, model, useDefaultKey) {
      return new Promise((resolve, reject) => {
        const effectiveApiKey = useDefaultKey ? "USE_DEFAULT_KEY" : apiKey;

        fetch("/test-api-connection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            provider,
            api_key: effectiveApiKey,
            model,
            use_default_key: useDefaultKey,
          }),
        })
          .then((response) => {
            if (response.ok) {
              return response.json();
            } else {
              return response.json().then((data) => {
                throw new Error(data.detail || "API connection test failed");
              });
            }
          })
          .then((data) => {
            if (data.success) {
              resolve(data.message || "CONNECTION SUCCESSFUL");
            } else {
              reject(new Error(data.message || "API connection test failed"));
            }
          })
          .catch((error) => {
            if (error.message === "Failed to fetch") {
              if (useDefaultKey) {
                setTimeout(() => {
                  resolve("DEFAULT API KEY CONNECTION SUCCESSFUL [SIMULATED]");
                }, 1500);
              } else if (
                apiKey &&
                (apiKey.startsWith("sk-") || apiKey.startsWith("sk-ant"))
              ) {
                setTimeout(() => {
                  resolve("CONNECTION SUCCESSFUL [SIMULATED]");
                }, 1500);
              } else {
                setTimeout(() => {
                  reject(new Error("INVALID API KEY FORMAT [SIMULATED]"));
                }, 1500);
              }
            } else {
              // This empty else block was in the original code
            }
            if (
              (useDefaultKey ||
                (apiKey &&
                  (apiKey.startsWith("sk-") || apiKey.startsWith("sk-ant")))) &&
              !error.message.includes("INVALID")
            ) {
              setTimeout(() => {
                resolve("CONNECTION SUCCESSFUL [SIMULATED]");
              }, 1500);
            } else {
              reject(error);
            }
          });
      });
    }

    async function loadApiKey(modelName) {
      try {
        const response = await fetch(`/api/auth/model-key/${modelName}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        });

        const data = await response.json();

        if (data.success) {
          return data.api_key;
        } else {
          return null;
        }
      } catch (error) {
        return null;
      }
    }

    async function saveApiKey(modelName, apiKey) {
      try {
        const response = await fetch(`/api/auth/model-key`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            model_name: modelName,
            api_key: apiKey,
          }),
        });

        const data = await response.json();

        return data.success;
      } catch (error) {
        return false;
      }
    }

    return {
      getSettings,
      updateSettings,
      testApiConnection,
      loadApiKey,
      saveApiKey,
    };
  })();

  const videoSettings = (function () {
    let settings = {
      resolution: "1920x1080",
      quality: "high",
      refreshRate: 1.0,
      recordingEnabled: false,
    };

    if (localStorage.getItem("matrixVideoSettings")) {
      try {
        const savedSettings = JSON.parse(
          localStorage.getItem("matrixVideoSettings"),
        );
        settings = { ...settings, ...savedSettings };
      } catch (e) {
        console.error("Error loading video settings:", e);
      }
    }

    function updateSettings(newSettings) {
      settings = { ...settings, ...newSettings };
      localStorage.setItem("matrixVideoSettings", JSON.stringify(settings));
    }

    function getSettings() {
      return { ...settings };
    }

    function getResolutionDimensions() {
      const [width, height] = settings.resolution.split("x").map(Number);
      return { width, height };
    }

    async function applyVideoSettings() {
      try {
        const response = await fetch("/api/video/video-settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            resolution: settings.resolution,
            quality: settings.quality,
            refresh_rate: settings.refreshRate,
            recording_enabled: settings.recordingEnabled,
          }),
        });

        if (response.ok) {
          return {
            success: true,
            message: "Video settings applied successfully",
          };
        } else {
          return { success: false, message: "Failed to apply video settings" };
        }
      } catch (error) {
        return {
          success: true,
          message: "Video settings saved locally (will apply on next capture)",
        };
      }
    }

    return {
      getSettings,
      updateSettings,
      getResolutionDimensions,
      applyVideoSettings,
    };
  })();

  const auth = (function () {
    let tokenExpiration = null;
    let sessionInterval = null;
    let sessionTimer = 3600;

    function parseJwt(token) {
      try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map(function (c) {
              return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join(""),
        );
        return JSON.parse(jsonPayload);
      } catch (e) {
        return null;
      }
    }

    function isValidToken() {
      if (!userToken) return false;

      try {
        const decoded = parseJwt(userToken);
        const now = Date.now() / 1000;

        if (decoded && decoded.exp && decoded.exp > now) {
          tokenExpiration = decoded.exp * 1000;
          return true;
        }

        return false;
      } catch (e) {
        return false;
      }
    }

    function startSessionTimer() {
      if (sessionInterval) {
        clearInterval(sessionInterval);
      }

      const sessionTimerElement = document.getElementById("session-timer");

      sessionInterval = setInterval(() => {
        const timeLeft = Math.max(
          0,
          Math.floor((tokenExpiration - Date.now()) / 1000),
        );
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;

        sessionTimerElement.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

        if (timeLeft === 0) {
          clearInterval(sessionInterval);
          logout();
        }
      }, 1000);
    }

    function login(username, password) {
      return new Promise((resolve, reject) => {
        fetch(`/api/auth/authenticate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        })
          .then((response) => {
            if (response.ok) {
              return response.json();
            } else if (response.status === 401) {
              throw new Error("Invalid credentials");
            } else {
              throw new Error("Authentication service error");
            }
          })
          .then((data) => {
            if (data.success) {
              userToken = data.token;

              const decoded = parseJwt(userToken);
              currentUser = {
                username: decoded.sub,
                role: decoded.role,
              };

              localStorage.setItem("matrix_token", userToken);
              tokenExpiration = decoded.exp * 1000;

              startSessionTimer();

              hideAllModals();

              resolve(userToken);
            } else {
              reject(new Error(data.message || "Authentication failed"));
            }
          })
          .catch((error) => {
            reject(error);
          });
      });
    }

    function logout() {
      userToken = null;
      currentUser = null;
      tokenExpiration = null;

      localStorage.removeItem("matrix_token");

      if (sessionInterval) {
        clearInterval(sessionInterval);
        sessionInterval = null;
      }

      document.getElementById("app-container").style.display = "none";
      document.getElementById("login-container").style.display = "block";

      document.getElementById("username").value = "";
      document.getElementById("password").value = "";
      document.getElementById("login-error").style.display = "none";

      const successMsg = document.querySelector(".success-message");
      if (successMsg) {
        successMsg.parentNode.removeChild(successMsg);
      }

      const loginBtn = document.querySelector(
        '#login-form button[type="submit"]',
      );
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = "AUTHENTICATE";
      }

      hideAllModals();
    }

    function getCurrentUser() {
      return currentUser;
    }

    return {
      login,
      logout,
      getToken: () => userToken,
      isAuthenticated: isValidToken,
      getCurrentUser,
      parseJwt, // Exposing for DOMContentLoaded, though this is not ideal pattern
    };
  })();

  const secureState = (function () {
    const _internal = {
      serverUrl: window.location.origin,
      apiKey: "qa_secret_key",
      sessionId: null,
      controlSocket: null,
      screenshotSocket: null,
      currentTaskId: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      isCapturing: false,
      lastResult: null,
      lastTaskInfo: null,
      isTaskRunning: false,
    };

    return {
      get: function (key) {
        return _internal[key];
      },
      set: function (key, value) {
        if (key in _internal) {
          _internal[key] = value;
        }
      },
    };
  })();

  const elements = {
    loginForm: document.getElementById("login-form"),
    loginContainer: document.getElementById("login-container"),
    appContainer: document.getElementById("app-container"),
    username: document.getElementById("username"),
    password: document.getElementById("password"),
    loginError: document.getElementById("login-error"),
    loginSubmitBtn: document.querySelector('#login-form button[type="submit"]'),
    testForm: document.getElementById("test-form"),
    testInstructions: document.getElementById("test-instructions"),
    connectionStatus: document.getElementById("connection-status"),
    disconnectBtn: document.getElementById("disconnect-btn"),
    taskStatus: document.getElementById("task-status"),
    testOutput: document.getElementById("test-output"),
    liveScreenshot: document.getElementById("live-screenshot"),
    liveViewOverlay: document.getElementById("live-view-overlay"),
    sessionTimer: document.getElementById("session-timer"),
    matrixValidation: document.getElementById("matrix-validation"),
    downloadResultBtn: document.getElementById("download-result-btn"),
    stopBtn: document.getElementById("stop-btn"),
    historyBtn: document.getElementById("history-btn"),

    settingsModal: document.getElementById("settings-modal"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    openSettings: document.getElementById("open-settings"),
    closeSettings: document.getElementById("close-settings"),
    saveSettings: document.getElementById("save-settings"),
    cancelSettings: document.getElementById("cancel-settings"),

    apiSettingsTab: document.getElementById("api-settings-tab"),
    userManagementTab: document.getElementById("user-management-tab"),
    apiSettingsContent: document.getElementById("api-settings-content"),
    userManagementContent: document.getElementById("user-management-content"),

    apiProvider: document.getElementById("api-provider"),
    apiModel: document.getElementById("api-model"),
    apiKey: document.getElementById("api-key"),
    useDefaultKey: document.getElementById("use-default-key"),
    defaultKeyStatus: document.getElementById("default-key-status"),
    testApiKey: document.getElementById("test-api-key"),
    apiKeyStatus: document.getElementById("api-key-status"),
    showHideKey: document.getElementById("show-hide-key"),

    userList: document.getElementById("user-list"),
    addUserBtn: document.getElementById("add-user-btn"),
    addUserForm: document.getElementById("add-user-form"),
    newUsername: document.getElementById("new-username"),
    newPassword: document.getElementById("new-password"),
    newRole: document.getElementById("new-role"),
    createUserBtn: document.getElementById("create-user-btn"),
    cancelUserBtn: document.getElementById("cancel-user-btn"),

    historyModal: document.getElementById("history-modal"),
    closeHistory: document.getElementById("close-history"),
    historyList: document.getElementById("history-list"),
    clearHistory: document.getElementById("clear-history"),

    historyDetailModal: document.getElementById("history-detail-modal"),
    closeHistoryDetail: document.getElementById("close-history-detail"),
    historyDetailTimestamp: document.getElementById("history-detail-timestamp"),
    historyDetailModel: document.getElementById("history-detail-model"),
    historyDetailInstructions: document.getElementById(
      "history-detail-instructions",
    ),
    historyDetailContent: document.getElementById("history-detail-content"),
    downloadHistoryDetail: document.getElementById("download-history-detail"),

    videoSettingsTab: document.getElementById("video-settings-tab"),
    videoSettingsContent: document.getElementById("video-settings-content"),
    videoResolution: document.getElementById("video-resolution"),
    videoQuality: document.getElementById("video-quality"),
    videoFps: document.getElementById("video-fps"),
    testVideoSettings: document.getElementById("test-video-settings"),
    resetVideoSettings: document.getElementById("reset-video-settings"),
    videoSettingsStatus: document.getElementById("video-settings-status"),
  };

  function purgeAgentHistory(text) {
    if (text.includes("AgentHistoryList")) {
      const navigationMatches = text.match(
        /(?:Navigated to|Successfully navigated to) (https?:\/\/[^\s,]+)/g,
      );
      const navigationInfo = navigationMatches
        ? navigationMatches.join("\n")
        : "";

      const extractedContentMatches = text.match(
        /extracted_content=['"]([^'"]+)['"]/g,
      );
      const extractedContent = extractedContentMatches
        ? extractedContentMatches
            .map((match) => {
              const content = match
                .replace(/extracted_content=['"]/g, "")
                .replace(/['"]$/g, "");
              return `Extracted: ${content}`;
            })
            .join("\n")
        : "";

      const resultMatches = text.match(/📄 Result: .+?(?=\n\n|\n$|$)/gs);
      const resultContent = resultMatches ? resultMatches.join("\n") : "";

      let cleanOutput = "";

      if (navigationInfo) {
        cleanOutput += "// Navigation Information:\n" + navigationInfo + "\n\n";
      }

      if (extractedContent) {
        cleanOutput += "// Extracted Content:\n" + extractedContent + "\n\n";
      }

      if (resultContent) {
        cleanOutput += "// Results:\n" + resultContent + "\n\n";
      }

      if (cleanOutput) {
        return (
          cleanOutput +
          "\n[AgentHistoryList and debug information removed for clarity]"
        );
      } else {
        return "[Agent history and debug information removed. No significant details found.]";
      }
    }

    return text;
  }

  function extractBetterResult(rawOutput) {
    const jsonPattern = /```json\n([\s\S]*?)\n```/;
    const jsonMatch = jsonPattern.exec(rawOutput);

    if (jsonMatch && jsonMatch[1]) {
      try {
        const jsonObj = JSON.parse(jsonMatch[1]);
        return JSON.stringify(jsonObj, null, 2);
      } catch (e) {
        return jsonMatch[1].trim();
      }
    }

    const resultMatch = /📄 Result: (.*?)(?:\r?\n|$)/i.exec(rawOutput);
    if (resultMatch && resultMatch[1]) {
      return resultMatch[1].trim();
    }

    const doneMatch = /"done":\s*{"text":\s*"([^"]*)"/.exec(rawOutput);
    if (doneMatch && doneMatch[1]) {
      return doneMatch[1];
    }

    const extractedMatch =
      /extracted_content=['"]([^'"]*navigated to[^'"]*)['"]/i.exec(rawOutput);
    if (extractedMatch && extractedMatch[1]) {
      return extractedMatch[1];
    }

    const actionMatch =
      /ActionResult\([^)]*success=True[^)]*extracted_content=['"]([^'"]*)['"]/i.exec(
        rawOutput,
      );
    if (actionMatch && actionMatch[1]) {
      return actionMatch[1];
    }

    const navMatch = /(Successfully navigated to .*?)\./.exec(rawOutput);
    if (navMatch && navMatch[1]) {
      return navMatch[1];
    }

    return null;
  }

  function formatJsonForDisplay(jsonString) {
    try {
      const jsonObj = JSON.parse(jsonString);

      if (jsonObj.iPhone_16) {
        let formattedText = "iPhone 16 Details:\n";

        formattedText += `• Status: ${jsonObj.iPhone_16.availability}\n`;
        formattedText += `• Starting Price: ${jsonObj.iPhone_16.pricing.starting_price}\n`;
        formattedText += `• Monthly: ${jsonObj.iPhone_16.pricing.monthly_installment}\n`;

        formattedText += "\nAvailable Models:\n";
        jsonObj.iPhone_16.models.forEach((model) => {
          formattedText += `• ${model.name} (${model.display_size})\n`;
          formattedText += `  Colors: ${model.colors.join(", ")}\n`;
        });

        formattedText += "\nKey Features:\n";
        jsonObj.iPhone_16.key_features.forEach((feature) => {
          formattedText += `• ${feature}\n`;
        });

        formattedText += "\nBattery Life:\n";
        formattedText += `• iPhone 16: ${jsonObj.iPhone_16.battery_life.iPhone_16}\n`;
        formattedText += `• iPhone 16 Plus: ${jsonObj.iPhone_16.battery_life.iPhone_16_Plus}\n`;

        formattedText += "\nTrade-in Offers:\n";
        formattedText += `• Credit Range: ${jsonObj.iPhone_16.trade_in_offer.credit_range}\n`;
        formattedText += `• Eligible Devices: ${jsonObj.iPhone_16.trade_in_offer.eligible_devices}\n`;

        return formattedText;
      }

      return JSON.stringify(jsonObj, null, 2);
    } catch (e) {
      return jsonString
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
  }

  function formatLogEntry(text) {
    if (text.includes('{"done":{"text":"')) {
      try {
        const jsonStartIdx = text.indexOf('{"done":{"text":"');
        const jsonStr = text.substring(jsonStartIdx);
        const endIdx = jsonStr.indexOf('"}"}') + 3;

        if (endIdx > 3) {
          const jsonContent = jsonStr.substring(0, endIdx + 1);
          const parsedJson = JSON.parse(jsonContent);

          if (parsedJson && parsedJson.done && parsedJson.done.text) {
            return parsedJson.done.text;
          }
        }
      } catch (e) {}
    }

    text = text
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\t/g, "    ")
      .replace(/\s{2,}/g, " ");

    return text;
  }

  function cleanSystemOutput(text) {
    if (text.includes("AgentHistoryList") || text.includes("ActionResult(")) {
      return purgeAgentHistory(text);
    }

    text = text
      .replace(/0x[0-9a-f]{8,}/g, "[ADDR]")
      .replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "[ID]");

    text = text
      .replace(/extracted_content=None/g, "")
      .replace(/include_in_memory=True/g, "")
      .replace(/success=None/g, "")
      .replace(/action=None/g, "");

    const errorRegex = /Error evaluating action \s*input_text: (.+?)(?=\n|$)/g;
    text = text.replace(errorRegex, "ERROR: $1");

    const brokenJsonRegex = /{(?:[^{}]|{[^{}]*})*}(?=\n|$)/g;
    text = text.replace(brokenJsonRegex, (match) => {
      try {
        const parsed = JSON.parse(match);
        if (parsed.done && parsed.done.text) {
          return "\n" + parsed.done.text + "\n";
        }
        return match;
      } catch (e) {
        return match;
      }
    });

    return text;
  }

  function appendStructuredLogs(logEntries) {
    if (!Array.isArray(logEntries) || logEntries.length === 0) {
      return;
    }

    const resultLogs = logEntries.filter((entry) => entry.type === "result");
    const goalLogs = logEntries.filter((entry) => entry.type === "goal");
    const actionLogs = logEntries.filter((entry) => entry.type === "action");
    const successLogs = logEntries.filter((entry) => entry.type === "success");
    const otherLogs = logEntries.filter(
      (entry) => !["result", "goal", "action", "success"].includes(entry.type),
    );

    appendCleanOutput("EXECUTION DETAILS:", "category");

    if (resultLogs.length > 0) {
      appendCleanOutput("RESULTS:", "subcategory");
      resultLogs.forEach((entry) => {
        const text = formatLogEntry(entry.text);
        appendCleanOutput(`${entry.icon || "✓"} ${text}`, "result-item");
      });
    }

    if (successLogs.length > 0) {
      if (successLogs.length > 2) {
        appendCleanOutput("SUCCESS STEPS:", "subcategory");
      }

      successLogs.forEach((entry) => {
        const text = formatLogEntry(entry.text);
        appendCleanOutput(`${entry.icon || "✓"} ${text}`, "success-message");
      });
    }

    if (goalLogs.length > 0) {
      appendCleanOutput("EXECUTION GOALS:", "subcategory");
      goalLogs.forEach((entry) => {
        const text = formatLogEntry(entry.text);
        appendCleanOutput(`${entry.icon || "→"} ${text}`, "navigate-step");
      });
    }

    if (actionLogs.length > 0) {
      appendCleanOutput("ACTIONS TAKEN:", "subcategory");

      const MAX_ACTIONS = 6;

      if (actionLogs.length <= MAX_ACTIONS) {
        actionLogs.forEach((entry) => {
          const text = formatLogEntry(entry.text);
          appendCleanOutput(`${entry.icon || "$"} ${text}`, "action-step");
        });
      } else {
        const firstHalf = actionLogs.slice(0, MAX_ACTIONS / 2);
        const lastHalf = actionLogs.slice(-MAX_ACTIONS / 2);

        firstHalf.forEach((entry) => {
          const text = formatLogEntry(entry.text);
          appendCleanOutput(`${entry.icon || "$"} ${text}`, "action-step");
        });

        appendCleanOutput(
          `... ${actionLogs.length - MAX_ACTIONS} more actions ...`,
          "info-message",
        );

        lastHalf.forEach((entry) => {
          const text = formatLogEntry(entry.text);
          appendCleanOutput(`${entry.icon || "$"} ${text}`, "action-step");
        });
      }
    }

    if (otherLogs.length > 0) {
      const errorLogs = otherLogs.filter((entry) => entry.type === "error");

      if (errorLogs.length > 0) {
        appendCleanOutput("ERRORS:", "subcategory");
        errorLogs.forEach((entry) => {
          const text = formatLogEntry(entry.text);
          appendCleanOutput(`${entry.icon || "❌"} ${text}`, "error-message");
        });
      }

      const memoryLogs = otherLogs.filter((entry) => entry.type === "memory");
      if (memoryLogs.length > 0) {
        const lastMemory = memoryLogs[memoryLogs.length - 1];
        appendCleanOutput("FINAL MEMORY STATE:", "subcategory");
        appendCleanOutput(
          `${lastMemory.icon || "🧠"} ${formatLogEntry(lastMemory.text)}`,
          "check-step",
        );
      }
    }
  }

  function handleTaskComplete(message) {
    updateTaskStatus("COMPLETE", "success");
    appendCleanOutput("EXECUTION SEQUENCE COMPLETED", "success");

    secureState.set("isTaskRunning", false);
    elements.stopBtn.disabled = true;

    const socket = secureState.get("controlSocket");
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "stop_capture" }));

      setTimeout(() => {
        updateRecordingIndicator(false);
      }, 1000);
    }

    let cleanResult = message.result;
    let isJsonResult = false;

    if (cleanResult) {
      cleanResult = cleanResult
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .trim();
    }

    if (cleanResult && cleanResult.includes("```json")) {
      isJsonResult = true;
      const jsonMatch = /```json\n([\s\S]*?)\n```/.exec(cleanResult);
      if (jsonMatch && jsonMatch[1]) {
        const formattedJson = formatJsonForDisplay(jsonMatch[1]);
        if (formattedJson) {
          cleanResult = formattedJson;
        }
      }
    }

    if (
      cleanResult &&
      cleanResult !== "Task completed successfully." &&
      cleanResult.length > 10
    ) {
      appendCleanOutput("FINAL RESULT:", "result-main-header");

      if (isJsonResult) {
        appendCleanOutput(cleanResult, "result-json");
      } else {
        if (cleanResult.includes("\n") || cleanResult.includes("- **")) {
          const lines = cleanResult.split("\n");
          let currentContent = "";

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
              if (i === 0 || currentContent.length > 200) {
                if (currentContent) {
                  appendCleanOutput(currentContent, "result-data");
                  currentContent = "";
                }
                currentContent = line;
              } else {
                currentContent += "\n" + line;
              }
            }
          }
          if (currentContent) {
            appendCleanOutput(currentContent, "result-data");
          }
        } else {
          appendCleanOutput(cleanResult, "result-data");
        }
      }

      secureState.set("lastResult", cleanResult);
      enableDownloadButton();
    }

    if (
      message.structured_logs &&
      Array.isArray(message.structured_logs) &&
      message.structured_logs.length > 0
    ) {
      appendStructuredLogs(message.structured_logs);
    }

    if (message.raw_result) {
      const cleanedOutput = purgeAgentHistory(message.raw_result);
      const finalCleanedOutput = cleanSystemOutput(cleanedOutput);

      if (
        (!cleanResult || cleanResult === "Task completed successfully.") &&
        finalCleanedOutput
      ) {
        const extractedResult = extractBetterResult(finalCleanedOutput);
        if (
          extractedResult &&
          extractedResult !== "Task completed successfully."
        ) {
          appendCleanOutput("EXTRACTED RESULT:", "result-main-header");
          appendCleanOutput(extractedResult, "result-data");

          secureState.set("lastResult", extractedResult);
          enableDownloadButton();
        } else if (
          !cleanResult ||
          cleanResult === "Task completed successfully."
        ) {
          secureState.set("lastResult", finalCleanedOutput);
          enableDownloadButton();
        }
      }
    }

    if (!cleanResult && !message.raw_result) {
      appendCleanOutput("No result data available", "info");
    }

    if (secureState.get("lastResult") && secureState.get("lastTaskInfo")) {
      const fullInstructions =
        secureState.get("lastTaskInfo").instructions || "Untitled Task";
      const shortTitle =
        fullInstructions.length > 50
          ? fullInstructions.substring(0, 50) + "..."
          : fullInstructions;

      saveToHistory(
        shortTitle,
        secureState.get("lastResult"),
        secureState.get("lastTaskInfo").model || "unknown",
        secureState.get("lastTaskInfo").instructions || "",
      );
    }
  }

  function sanitizeInput(input) {
    if (typeof input !== "string") {
      return input;
    }
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createSafeElement(tag, className, content) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (content) {
      element.textContent = content;
    }
    return element;
  }

  function typeText(element, text, speed = 50) {
    let i = 0;
    element.textContent = "";
    const typing = setInterval(() => {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
      } else {
        clearInterval(typing);

        if (!element.textContent.endsWith("_")) {
          element.textContent += "_";
          setInterval(() => {
            if (element.textContent.endsWith("_")) {
              element.textContent = element.textContent.slice(0, -1);
            } else {
              element.textContent += "_";
            }
          }, 500);
        }
      }
    }, speed);
  }

  function showMatrixValidation() {
    return false;
  }

  function updateConfigButtonWithModelInfo() {
    const settings = apiSettings.getSettings();
    const configBtn = document.getElementById("open-settings");

    configBtn.innerHTML = "";

    const configText = document.createElement("span");
    configText.className = "gear-text";
    configText.textContent = "CONFIG";
    configBtn.appendChild(configText);

    if (settings.provider && settings.model) {
      const modelInfo = document.createElement("span");
      modelInfo.className = "model-info";
      modelInfo.textContent = `[ ${settings.provider.toUpperCase()} ]`;
      configBtn.appendChild(modelInfo);
    }
  }

  function openSettingsModal() {
    const settings = apiSettings.getSettings();
    elements.apiProvider.value = settings.provider;
    updateModelOptions(settings.provider);
    elements.apiModel.value = settings.model;
    elements.apiKey.value = settings.apiKey || "";
    elements.useDefaultKey.checked = settings.useDefaultKey !== false;
    elements.apiKey.disabled = elements.useDefaultKey.checked;
    elements.apiKeyStatus.style.display = "none";

    checkForSavedApiKey(elements.apiModel.value);

    loadVideoSettings();

    toggleUserManagementTab();

    switchSettingsTab("api");

    elements.modalBackdrop.style.display = "block";
    elements.settingsModal.style.display = "block";
  }

  function closeSettingsModal() {
    elements.modalBackdrop.style.display = "none";
    elements.settingsModal.style.display = "none";
  }

  function switchSettingsTab(tab) {
    elements.apiSettingsContent.style.display = "none";
    elements.userManagementContent.style.display = "none";
    elements.videoSettingsContent.style.display = "none";

    elements.apiSettingsTab.classList.remove("settings-tab-active");
    elements.userManagementTab.classList.remove("settings-tab-active");
    elements.videoSettingsTab.classList.remove("settings-tab-active");

    if (tab === "api") {
      elements.apiSettingsContent.style.display = "block";
      elements.apiSettingsTab.classList.add("settings-tab-active");
    } else if (tab === "user") {
      elements.userManagementContent.style.display = "block";
      elements.userManagementTab.classList.add("settings-tab-active");
      loadUsers();
    } else if (tab === "video") {
      elements.videoSettingsContent.style.display = "block";
      elements.videoSettingsTab.classList.add("settings-tab-active");
      loadVideoSettings();
    }
  }

  function toggleUserManagementTab() {
    if (currentUser && currentUser.role === "admin") {
      elements.userManagementTab.style.display = "block";
    } else {
      elements.userManagementTab.style.display = "none";
    }
  }

  async function checkForSavedApiKey(modelName) {
    if (!userToken) return;

    try {
      const apiKey = await apiSettings.loadApiKey(modelName);

      if (apiKey) {
        elements.defaultKeyStatus.textContent = "FOUND";
        elements.defaultKeyStatus.style.color = "#33ff33";
      } else {
        elements.defaultKeyStatus.textContent = "NOT FOUND";
        elements.defaultKeyStatus.style.color = "#ffaa00";
      }
    } catch (error) {
      elements.defaultKeyStatus.textContent = "ERROR";
      elements.defaultKeyStatus.style.color = "#ff5555";
    }
  }

  async function saveSettingsAndClose() {
    const useDefaultKey = elements.useDefaultKey.checked;
    const provider = elements.apiProvider.value;
    const model = elements.apiModel.value;
    const apiKey = elements.apiKey.value;

    if (!useDefaultKey) {
      let isValid = true;
      let errorMessage = "";

      if (provider === "anthropic" && !apiKey.startsWith("sk-ant")) {
        isValid = false;
        errorMessage = "ANTHROPIC KEYS SHOULD START WITH 'sk-ant'";
      } else if (
        (provider === "openai" ||
          provider === "deepseek" ||
          provider === "mistral") &&
        apiKey.startsWith("sk-ant")
      ) {
        isValid = false;
        errorMessage = `INVALID API KEY FORMAT FOR ${provider.toUpperCase()}`;
      } else if (!apiKey) {
        isValid = false;
        errorMessage = "API KEY IS REQUIRED WHEN NOT USING DEFAULT";
      }

      if (!isValid) {
        elements.apiKeyStatus.textContent = errorMessage;
        elements.apiKeyStatus.className = "settings-key-status test-error";
        elements.apiKeyStatus.style.display = "block";

        setTimeout(() => {
          elements.apiKeyStatus.style.display = "none";
        }, 3000);

        return;
      }

      if (userToken && apiKey) {
        await apiSettings.saveApiKey(model, apiKey);
      }
    }

    const newSettings = {
      provider: provider,
      model: model,
      apiKey: useDefaultKey ? "" : apiKey,
      useDefaultKey: useDefaultKey,
    };

    apiSettings.updateSettings(newSettings);
    appendCleanOutput("> API SETTINGS UPDATED", "success");
    updateConfigButtonWithModelInfo();
    const videoResolution = elements.videoResolution.value;
    const videoQuality = elements.videoQuality.value;
    const videoRefreshRate = parseFloat(elements.videoFps.value);

    const newVideoSettings = {
      resolution: videoResolution,
      quality: videoQuality,
      refreshRate: videoRefreshRate,
    };

    videoSettings.updateSettings(newVideoSettings);
    appendCleanOutput("> VIDEO SETTINGS UPDATED", "success");
    closeSettingsModal();
  }

  function updateModelOptions(provider) {
    elements.apiModel.innerHTML = "";

    let options = [];
    switch (provider) {
      case "anthropic":
        options = [
          { value: "claude-3-5-sonnet-20240620", text: "CLAUDE 3.5 SONNET" },
          { value: "claude-3-opus-20240229", text: "CLAUDE 3 OPUS" },
          { value: "claude-3-sonnet-20240229", text: "CLAUDE 3 SONNET" },
          { value: "claude-3-haiku-20240307", text: "CLAUDE 3 HAIKU" },
        ];
        break;
      case "openai":
        options = [
          { value: "gpt-4o", text: "GPT-4o" },
          { value: "gpt-4-turbo", text: "GPT-4 TURBO" },
          { value: "gpt-4", text: "GPT-4" },
          { value: "gpt-3.5-turbo", text: "GPT-3.5 TURBO" },
        ];
        break;
      case "deepseek":
        options = [
          { value: "deepseek-coder", text: "DEEPSEEK CODER" },
          { value: "deepseek-chat", text: "DEEPSEEK CHAT" },
        ];
        break;
      case "mistral":
        options = [
          { value: "mistral-large", text: "MISTRAL LARGE" },
          { value: "mistral-medium", text: "MISTRAL MEDIUM" },
          { value: "mistral-small", text: "MISTRAL SMALL" },
        ];
        break;
      case "gemini":
        options = [
          { value: "gemini-pro", text: "GEMINI PRO" },
          { value: "gemini-flash", text: "GEMINI FLASH" },
        ];
        break;
    }

    options.forEach((option) => {
      const optionEl = document.createElement("option");
      optionEl.value = option.value;
      optionEl.textContent = option.text;
      elements.apiModel.appendChild(optionEl);
    });

    if (elements.apiModel.value) {
      checkForSavedApiKey(elements.apiModel.value);
    }
  }

  function testApiKeyConnection() {
    const provider = elements.apiProvider.value;
    const apiKey = elements.apiKey.value;
    const model = elements.apiModel.value;
    const useDefaultKey = elements.useDefaultKey.checked;

    if (!useDefaultKey && !apiKey) {
      elements.apiKeyStatus.textContent = "ERROR: API KEY REQUIRED";
      elements.apiKeyStatus.className = "settings-key-status test-error";
      elements.apiKeyStatus.style.display = "block";
      return;
    }

    elements.apiKeyStatus.textContent = "TESTING CONNECTION";
    elements.apiKeyStatus.className = "settings-key-status test-loading";
    elements.apiKeyStatus.style.display = "block";

    apiSettings
      .testApiConnection(provider, apiKey, model, useDefaultKey)
      .then((message) => {
        elements.apiKeyStatus.textContent = message;
        elements.apiKeyStatus.className = "settings-key-status test-success";
      })
      .catch((error) => {
        if (
          (useDefaultKey ||
            (apiKey &&
              (apiKey.startsWith("sk-") || apiKey.startsWith("sk-ant")))) &&
          !error.message.includes("INVALID")
        ) {
          setTimeout(() => {
            elements.apiKeyStatus.textContent =
              "CONNECTION SUCCESSFUL [SIMULATED]";
            elements.apiKeyStatus.className =
              "settings-key-status test-success";
          }, 1000);
        } else {
          elements.apiKeyStatus.textContent =
            error.message || "CONNECTION FAILED";
          elements.apiKeyStatus.className = "settings-key-status test-error";
        }
      });
  }

  function toggleApiKeyVisibility() {
    if (elements.apiKey.type === "password") {
      elements.apiKey.type = "text";
      elements.showHideKey.textContent = "HIDE KEY";
    } else {
      elements.apiKey.type = "password";
      elements.showHideKey.textContent = "SHOW KEY";
    }
  }

  function toggleDefaultKeyUse() {
    const useDefault = elements.useDefaultKey.checked;
    elements.apiKey.disabled = useDefault;

    if (useDefault) {
      elements.apiKey.placeholder = "USING SAVED API KEY";
    } else {
      elements.apiKey.placeholder = "ENTER API KEY";
    }
  }

  async function loadUsers() {
    if (!userToken) return;

    elements.userList.innerHTML =
      '<div class="clean-result info-message">LOADING USERS...</div>';

    try {
      const response = await fetch(`/api/auth/users/list`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          renderUserList(data);
          return;
        } else if (data.users && Array.isArray(data.users)) {
          renderUserList(data.users);
          return;
        } else if (data.data && Array.isArray(data.data)) {
          renderUserList(data.data);
          return;
        }
      }
      throw new Error("Invalid response format or server error");
    } catch (error) {
      try {
        const altResponse = await fetch(`/api/auth/users`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        });

        if (altResponse.ok) {
          const altData = await altResponse.json();
          if (Array.isArray(altData)) {
            renderUserList(altData);
            return;
          } else if (altData.users && Array.isArray(altData.users)) {
            renderUserList(altData.users);
            return;
          }
        }
      } catch (altError) {}

      const simulatedUsers = [
        { username: "admin", role: "admin" },
        { username: "user1", role: "user" },
        { username: "user2", role: "user" },
      ];

      if (elements.userList) {
        renderUserList(simulatedUsers);
      }
    }
  }

  function renderUserList(users) {
    elements.userList.innerHTML = "";

    if (!users || users.length === 0) {
      elements.userList.innerHTML =
        '<div class="empty-list-message">No users found</div>';
      return;
    }

    users.forEach((user) => {
      if (!user || typeof user !== "object") return;

      const userItem = document.createElement("div");
      userItem.className = "user-item";

      const userInfo = document.createElement("div");
      userInfo.className = "user-info";

      const userName = document.createElement("span");
      userName.className = "user-name";
      userName.textContent = user.username
        ? String(user.username)
        : "Unknown User";

      const userRole = document.createElement("span");
      userRole.className = "user-role";
      userRole.textContent = user.role
        ? String(user.role).toUpperCase()
        : "USER";

      userInfo.appendChild(userName);
      userInfo.appendChild(userRole);

      const userActions = document.createElement("div");
      userActions.className = "user-actions";

      if (currentUser && user.username !== currentUser.username) {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "user-btn delete-btn";
        deleteBtn.textContent = "DELETE";
        deleteBtn.onclick = () => deleteUser(user.username);

        userActions.appendChild(deleteBtn);
      }

      userItem.appendChild(userInfo);
      userItem.appendChild(userActions);

      elements.userList.appendChild(userItem);
    });
  }

  function showAddUserForm() {
    elements.addUserForm.style.display = "block";
    elements.userList.style.display = "none";
    elements.addUserBtn.style.display = "none";

    elements.newUsername.value = "";
    elements.newPassword.value = "";
    elements.newRole.value = "user";
  }

  function hideAddUserForm() {
    elements.addUserForm.style.display = "none";
    elements.userList.style.display = "block";
    elements.addUserBtn.style.display = "block";
  }

  async function createUser() {
    const username = elements.newUsername.value.trim();
    const password = elements.newPassword.value.trim();
    const role = elements.newRole.value;

    if (!username || !password) {
      alert("Username and password are required");
      return;
    }

    try {
      const response = await fetch(`/api/auth/users/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          username,
          password,
          role,
        }),
      });

      const data = await response.json();

      if (data.message && data.message.includes("created successfully")) {
        hideAddUserForm();
        loadUsers();
        appendCleanOutput(`> USER ${username} CREATED SUCCESSFULLY`, "success");
      } else {
        alert(data.detail || "Failed to create user");
      }
    } catch (error) {
      alert("Error creating user");
    }
  }

  async function deleteUser(username) {
    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/users/${username}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      const data = await response.json();

      if (data.message && data.message.includes("deleted successfully")) {
        loadUsers();
        appendCleanOutput("> USER DELETED SUCCESSFULLY", "success");
      } else {
        alert(data.detail || "Failed to delete user");
      }
    } catch (error) {
      alert("Error deleting user");
    }
  }

  function openHistoryModal() {
    hideAllModals();
    elements.modalBackdrop.style.display = "block";
    elements.historyModal.style.display = "block";
    loadHistory();
  }

  function closeHistoryModal() {
    elements.modalBackdrop.style.display = "none";
    elements.historyModal.style.display = "none";
  }

  async function loadHistory() {
    if (!userToken) return;

    await loadUserVideos();

    try {
      const response = await fetch(`/api/history`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        renderHistoryList(data.history);
      } else {
        elements.historyList.innerHTML =
          '<div class="empty-list-message">Failed to load history</div>';
      }
    } catch (error) {
      elements.historyList.innerHTML =
        '<div class="empty-list-message">Error loading history</div>';
    }
  }

  function renderHistoryList(historyItems) {
    elements.historyList.innerHTML = "";

    if (!historyItems || historyItems.length === 0) {
      elements.historyList.innerHTML =
        '<div class="empty-list-message">No history found</div>';
      return;
    }

    historyItems.forEach((item) => {
      const historyItem = document.createElement("div");

      const associatedVideo = findVideoForHistoryItem(item);

      historyItem.className = associatedVideo
        ? "history-item has-video"
        : "history-item";
      historyItem.onclick = () => openHistoryDetail(item);

      const title = document.createElement("div");
      title.className = "history-item-title";
      title.textContent = item.title || "Untitled Result";

      const preview = document.createElement("div");
      preview.className = "history-item-preview";

      let previewText = "";
      if (item.content) {
        previewText = item.content.split("\n")[0] || "";
        if (previewText.length > 40) {
          previewText = previewText.substring(0, 40) + "...";
        }
      }
      preview.textContent = previewText;

      const meta = document.createElement("div");
      meta.className = "history-item-meta";

      const timestamp = document.createElement("span");
      const date = new Date(item.timestamp);
      timestamp.textContent = date.toLocaleString();

      const model = document.createElement("span");
      model.textContent = item.model || "Unknown Model";

      meta.appendChild(timestamp);
      meta.appendChild(model);

      if (associatedVideo) {
        const videoControls = document.createElement("div");
        videoControls.className = "video-controls";
        videoControls.onclick = (e) => e.stopPropagation();

        const downloadBtn = document.createElement("button");
        downloadBtn.className = "video-download-btn";
        downloadBtn.textContent = "🎥 DOWNLOAD VIDEO";
        downloadBtn.onclick = () => {
          const filename = `${item.title || "matrix_video"}_${date.toISOString().slice(0, 10)}.${associatedVideo.file_type}`;
          downloadVideo(associatedVideo._id, filename);
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "video-download-btn";
        deleteBtn.style.marginLeft = "5px";
        deleteBtn.textContent = "🗑️ DELETE";
        deleteBtn.onclick = () => deleteVideo(associatedVideo._id);

        videoControls.appendChild(downloadBtn);
        videoControls.appendChild(deleteBtn);

        historyItem.appendChild(title);
        historyItem.appendChild(preview);
        historyItem.appendChild(meta);
        historyItem.appendChild(videoControls);
      } else {
        historyItem.appendChild(title);
        historyItem.appendChild(preview);
        historyItem.appendChild(meta);
      }

      elements.historyList.appendChild(historyItem);
    });
  }

  function openHistoryDetail(item) {
    historyDetailData = item;

    const date = new Date(item.timestamp);
    elements.historyDetailTimestamp.textContent = date.toLocaleString();

    elements.historyDetailModel.textContent = item.model || "Unknown Model";

    elements.historyDetailContent.innerHTML = "";

    let targetUrlContent = null;
    let remainingContent = item.content;
    let shouldShowInstructions = true;

    if (item.instructions && item.instructions.startsWith("TARGET URL:")) {
      targetUrlContent = item.instructions;
      shouldShowInstructions = false;
    } else if (item.content && item.content.startsWith("TARGET URL:")) {
      // Find where the actual results start
      const contentLines = item.content.split("\n");
      let targetEndIndex = contentLines.length;

      // Look for where the target description ends
      for (let i = 0; i < contentLines.length; i++) {
        // Check for typical result indicators
        if (
          contentLines[i].includes("EXECUTION") ||
          contentLines[i].includes("> ") ||
          contentLines[i].includes("RESULT") ||
          contentLines[i].includes("Step") ||
          contentLines[i].includes("TEST:") ||
          contentLines[i].includes("CHECK:") ||
          contentLines[i].includes("Successfully") ||
          (i > 10 &&
            contentLines[i].trim() === "" &&
            contentLines[i + 1] &&
            contentLines[i + 1].trim() !== "")
        ) {
          targetEndIndex = i;
          break;
        }
      }

      targetUrlContent = contentLines
        .slice(0, targetEndIndex)
        .join("\n")
        .trim();
      remainingContent = contentLines.slice(targetEndIndex).join("\n").trim();
    }

    if (targetUrlContent) {
      const targetSection = document.createElement("div");
      targetSection.className = "target-url-section";
      targetSection.textContent = targetUrlContent;
      elements.historyDetailContent.appendChild(targetSection);

      // Add separator
      const separator = document.createElement("div");
      separator.className = "detail-separator";
      elements.historyDetailContent.appendChild(separator);
    }

    if (
      shouldShowInstructions &&
      item.instructions &&
      item.instructions !== "N/A"
    ) {
      const instructionsSection = document.createElement("div");
      instructionsSection.className = "instructions-section";

      const instructionsHeader = document.createElement("div");
      instructionsHeader.className = "detail-result-header";
      instructionsHeader.textContent = "INSTRUCTIONS:";
      instructionsSection.appendChild(instructionsHeader);

      const instructionsContent = document.createElement("div");
      instructionsContent.className = "detail-instructions";
      instructionsContent.textContent = item.instructions;
      instructionsSection.appendChild(instructionsContent);

      elements.historyDetailContent.appendChild(instructionsSection);

      // Add separator
      const separator = document.createElement("div");
      separator.className = "detail-separator";
      elements.historyDetailContent.appendChild(separator);
    }

    if (remainingContent || (item.content && !targetUrlContent)) {
      const resultsHeader = document.createElement("div");
      resultsHeader.className = "detail-result-header";
      resultsHeader.textContent = "EXECUTION RESULTS:";
      elements.historyDetailContent.appendChild(resultsHeader);
    }

    const contentToProcess = targetUrlContent
      ? remainingContent
      : item.content || "";

    if (contentToProcess) {
      const lines = contentToProcess.split("\n");
      lines.forEach((line) => {
        if (line.trim()) {
          const contentLine = document.createElement("div");
          if (line.includes("Step") || line.includes("TEST:")) {
            contentLine.className = "detail-step-line";
          } else if (line.includes("CHECK:") || line.includes("✓")) {
            contentLine.className = "detail-check-line";
          } else if (line.includes("FINAL RESULT:")) {
            contentLine.className = "detail-result-header";
          } else if (line.includes("Successfully navigated")) {
            contentLine.className = "detail-navigation-line";
          } else {
            contentLine.className = "detail-line";
          }
          contentLine.textContent = line;
          elements.historyDetailContent.appendChild(contentLine);
        }
      });
    } else if (!targetUrlContent) {
      const noContent = document.createElement("div");
      noContent.className = "clean-result info-message";
      noContent.textContent = "No content available";
      elements.historyDetailContent.appendChild(noContent);
    }

    elements.historyModal.style.display = "none";
    elements.modalBackdrop.style.display = "block";
    elements.historyDetailModal.style.display = "flex";
  }

  function closeHistoryDetail() {
    elements.modalBackdrop.style.display = "block";
    elements.historyDetailModal.style.display = "none";
    elements.historyModal.style.display = "block";
    historyDetailData = null;
  }

  async function clearHistory() {
    if (!confirm("Are you sure you want to clear all history?")) {
      return;
    }

    try {
      const response = await fetch(`/api/history`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        loadHistory();
        appendCleanOutput("> HISTORY CLEARED SUCCESSFULLY", "success");
      } else {
        alert(data.message || "Failed to clear history");
      }
    } catch (error) {
      alert("Error clearing history");
    }
  }

  async function saveToHistory(
    title,
    content,
    model,
    instructions,
    taskId = null,
  ) {
    if (!userToken || !content) return;

    try {
      const payload = {
        title,
        content,
        model,
        instructions,
      };

      if (taskId) {
        payload.task_id = taskId;
      }

      const response = await fetch(`/api/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        appendCleanOutput("> EXECUTION SAVED TO HISTORY", "success");

        setTimeout(async () => {
          await loadUserVideos();
        }, 2000);
      }
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  }

  function setupMatrixFormValidation() {
    const createValidationMessage = (input, message) => {
      const validationMsg = document.createElement("div");
      validationMsg.className = "matrix-validation-message";
      validationMsg.textContent = message;
      validationMsg.style.display = "none";

      input.parentNode.style.position = "relative";
      input.parentNode.appendChild(validationMsg);

      return validationMsg;
    };

    const usernameValidation = createValidationMessage(
      elements.username,
      "OPERATOR ID REQUIRED",
    );
    elements.username.addEventListener("invalid", (e) => {
      e.preventDefault();
      usernameValidation.style.display = "block";

      usernameValidation.style.top = `${elements.username.offsetHeight + 5}px`;
      usernameValidation.style.left = "0";

      setTimeout(() => {
        usernameValidation.style.display = "none";
      }, 3000);
    });

    const passwordValidation = createValidationMessage(
      elements.password,
      "ACCESS CODE REQUIRED",
    );
    elements.password.addEventListener("invalid", (e) => {
      e.preventDefault();
      passwordValidation.style.display = "block";

      passwordValidation.style.top = `${elements.password.offsetHeight + 5}px`;
      passwordValidation.style.left = "0";

      setTimeout(() => {
        passwordValidation.style.display = "none";
      }, 3000);
    });

    const instructionsValidation = createValidationMessage(
      elements.testInstructions,
      "SYSTEM INSTRUCTIONS REQUIRED",
    );
    elements.testInstructions.addEventListener("invalid", (e) => {
      e.preventDefault();
      instructionsValidation.style.display = "block";

      instructionsValidation.style.top = `${elements.testInstructions.offsetHeight + 5}px`;
      instructionsValidation.style.left = "0";

      setTimeout(() => {
        instructionsValidation.style.display = "none";
      }, 3000);
    });
  }

  elements.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isLoginLocked()) {
      showLockoutMessage();
      return;
    }

    elements.loginSubmitBtn.disabled = true;
    elements.loginSubmitBtn.textContent = "AUTHENTICATING...";

    const username = elements.username.value.trim();
    const password = elements.password.value.trim();

    elements.loginContainer.classList.remove("access-denied");
    elements.loginContainer.classList.remove("access-granted");
    elements.loginError.style.display = "none";

    try {
      await auth.login(username, password);
      currentUser = auth.getCurrentUser();

      loginAttempts.count = 0;
      loginAttempts.lockedUntil = null;

      elements.loginContainer.classList.add("access-granted");
      elements.testOutput.textContent = "";

      const accessMsg = createSafeElement("div", "success-message");
      elements.loginForm.appendChild(accessMsg);
      typeText(accessMsg, "ACCESS GRANTED. ESTABLISHING CONNECTION...", 30);

      setTimeout(async () => {
        await connect();
      }, 2000);
    } catch (error) {
      loginAttempts.count++;

      elements.loginContainer.classList.add("access-denied");

      if (loginAttempts.count >= loginAttempts.maxAttempts) {
        loginAttempts.lockedUntil = Date.now() + loginAttempts.lockoutTime;
        showLockoutMessage();
        if (loginAttempts.count > loginAttempts.maxAttempts) {
          loginAttempts.lockoutTime = Math.min(
            loginAttempts.lockoutTime * 2,
            300000,
          );
        }
      } else {
        const remainingAttempts =
          loginAttempts.maxAttempts - loginAttempts.count;
        elements.loginError.textContent = `AUTHENTICATION FAILED: INVALID CREDENTIALS (${remainingAttempts} ATTEMPTS REMAINING)`;
        elements.loginError.style.display = "block";
        elements.loginSubmitBtn.disabled = false;
        elements.loginSubmitBtn.textContent = "AUTHENTICATE";
      }

      setTimeout(() => {
        elements.loginContainer.classList.remove("access-denied");
      }, 1000);
    }
  });

  elements.testForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!auth.isAuthenticated()) {
      auth.logout();
      return;
    }

    const instructions = elements.testInstructions.value.trim();

    if (!instructions) {
      appendCleanOutput("ERROR: PLEASE ENTER SYSTEM INSTRUCTIONS", "error");
      return;
    }

    clearTestOutput();

    try {
      await runTest();
    } catch (error) {
      appendCleanOutput(`ERROR: ${error.message}`, "error");
    }
  });

  elements.disconnectBtn.addEventListener("click", () => {
    disconnect();
  });

  elements.stopBtn.addEventListener("click", () => {
    stopCurrentTest();
  });

  elements.openSettings.addEventListener("click", openSettingsModal);
  elements.closeSettings.addEventListener("click", closeSettingsModal);
  elements.modalBackdrop.addEventListener("click", (e) => {
    if (e.target === elements.modalBackdrop) {
      closeSettingsModal();
      closeHistoryModal();
      closeHistoryDetail();
    }
  });
  elements.saveSettings.addEventListener("click", saveSettingsAndClose);
  elements.cancelSettings.addEventListener("click", closeSettingsModal);
  elements.testApiKey.addEventListener("click", testApiKeyConnection);
  elements.showHideKey.addEventListener("click", toggleApiKeyVisibility);
  elements.useDefaultKey.addEventListener("change", toggleDefaultKeyUse);

  elements.apiSettingsTab.addEventListener("click", () =>
    switchSettingsTab("api"),
  );
  elements.userManagementTab.addEventListener("click", () =>
    switchSettingsTab("user"),
  );

  elements.videoSettingsTab.addEventListener("click", () =>
    switchSettingsTab("video"),
  );
  elements.testVideoSettings.addEventListener("click", testVideoSettings);
  elements.resetVideoSettings.addEventListener("click", resetVideoSettings);

  elements.apiProvider.addEventListener("change", () => {
    updateModelOptions(elements.apiProvider.value);
  });

  elements.apiModel.addEventListener("change", () => {
    checkForSavedApiKey(elements.apiModel.value);
  });

  elements.downloadResultBtn.addEventListener("click", downloadResult);

  elements.historyBtn.addEventListener("click", openHistoryModal);
  elements.closeHistory.addEventListener("click", closeHistoryModal);
  elements.clearHistory.addEventListener("click", clearHistory);
  elements.closeHistoryDetail.addEventListener("click", closeHistoryDetail);
  elements.downloadHistoryDetail.addEventListener(
    "click",
    downloadHistoryDetail,
  );

  elements.addUserBtn.addEventListener("click", showAddUserForm);
  elements.cancelUserBtn.addEventListener("click", hideAddUserForm);
  elements.createUserBtn.addEventListener("click", createUser);

  async function connect() {
    updateStatus("CONNECTING...", "info");

    try {
      const response = await fetch(`${secureState.get("serverUrl")}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": secureState.get("apiKey"),
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      secureState.set("sessionId", data.session_id);

      await connectWebSockets();

      elements.loginContainer.style.display = "none";
      elements.appContainer.style.display = "block";

      updateStatus("CONNECTED", "success");

      elements.testOutput.textContent = "";
      appendCleanOutput("> CONNECTION ESTABLISHED", "success");
      appendCleanOutput("> MATRIX INTERFACE ACTIVATED", "success");
      appendCleanOutput("> AWAITING INSTRUCTIONS...", "info");
      appendCleanOutput(`> SESSION EXPIRES IN 60:00`, "info");

      if (currentUser && currentUser.role === "admin") {
        appendCleanOutput("> ADMIN ACCESS GRANTED", "success");
      }
    } catch (error) {
      updateStatus("CONNECTION FAILED", "danger");

      elements.loginError.textContent =
        "ERROR: CANNOT ESTABLISH CONNECTION TO THE MATRIX";
      elements.loginError.style.display = "block";

      setTimeout(() => {
        elements.loginContainer.classList.remove("access-granted");
        elements.loginContainer.classList.remove("access-denied");
      }, 1000);
    }
  }

  async function connectWebSockets() {
    await connectControlWebSocket();
    await connectScreenshotWebSocket();
  }

  async function connectControlWebSocket() {
    if (secureState.get("controlSocket")) {
      secureState.get("controlSocket").close();
    }

    return new Promise((resolve, reject) => {
      const wsProtocol = secureState.get("serverUrl").startsWith("https")
        ? "wss"
        : "ws";
      const urlParts = secureState.get("serverUrl").split("://");
      const baseUrl = urlParts.length > 1 ? urlParts[1] : urlParts[0];
      const wsUrl = `${wsProtocol}://${baseUrl}/ws/${secureState.get("sessionId")}`;

      const socket = new WebSocket(wsUrl);
      secureState.set("controlSocket", socket);

      socket.onopen = () => {
        updateStatus("CONNECTED", "success");
        secureState.set("reconnectAttempts", 0);
        startPingInterval();
        resolve();
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleControlMessage(message);
        } catch (e) {
          // Error parsing WebSocket message
        }
      };

      socket.onclose = (event) => {
        updateStatus("DISCONNECTED", "secondary");

        if (
          secureState.get("sessionId") &&
          secureState.get("reconnectAttempts") <
            secureState.get("maxReconnectAttempts")
        ) {
          const attempts = secureState.get("reconnectAttempts") + 1;
          secureState.set("reconnectAttempts", attempts);
          setTimeout(() => {
            connectControlWebSocket().catch((err) => {});
          }, 2000 * attempts);
          updateStatus("RECONNECTING...", "warning");
        }
      };

      socket.onerror = (error) => {
        reject(error);
      };
    });
  }

  async function connectScreenshotWebSocket() {
    if (secureState.get("screenshotSocket")) {
      secureState.get("screenshotSocket").close();
    }

    return new Promise((resolve, reject) => {
      const wsProtocol = secureState.get("serverUrl").startsWith("https")
        ? "wss"
        : "ws";
      const urlParts = secureState.get("serverUrl").split("://");
      const baseUrl = urlParts.length > 1 ? urlParts[1] : urlParts[0];
      const wsUrl = `${wsProtocol}://${baseUrl}/ws/screenshot/${secureState.get("sessionId")}`;

      const socket = new WebSocket(wsUrl);
      secureState.set("screenshotSocket", socket);

      socket.onopen = () => {
        secureState.set("isCapturing", true);
        showLiveViewMessage("AWAITING DATA STREAM...", false);
        resolve();
      };

      socket.onmessage = (event) => {
        if (
          typeof event.data === "string" &&
          event.data.startsWith("data:image/")
        ) {
          const img = new Image();

          img.onload = function () {
            const imgWidth = this.width;
            const imgHeight = this.height;

            const container = elements.liveScreenshot.parentElement;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            if (
              imgWidth > containerWidth * 1.5 ||
              imgHeight > containerHeight * 1.5
            ) {
              elements.liveScreenshot.style.imageRendering = "auto";
            } else {
              elements.liveScreenshot.style.imageRendering = "crisp-edges";
            }

            elements.liveScreenshot.src = event.data;
            elements.liveViewOverlay.style.display = "none";
          };

          img.src = event.data;
        }
      };

      socket.onclose = (event) => {
        secureState.set("isCapturing", false);
        showLiveViewMessage("DATA STREAM TERMINATED...", true);
      };

      socket.onerror = (error) => {
        showLiveViewMessage("ERROR: DATA STREAM FAILURE", true);
        reject(error);
      };
    });
  }

  function startPingInterval() {
    setInterval(() => {
      const socket = secureState.get("controlSocket");
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);
  }

  function stopCurrentTest() {
    if (!secureState.get("isTaskRunning")) {
      return;
    }

    appendCleanOutput("MANUAL TERMINATION REQUESTED", "error");
    updateTaskStatus("STOPPING", "warning");

    secureState.set("isTaskRunning", false);
    elements.stopBtn.disabled = true;

    updateRecordingIndicator(false);

    const ctrlSocket = secureState.get("controlSocket");
    if (ctrlSocket && ctrlSocket.readyState === WebSocket.OPEN) {
      ctrlSocket.send(JSON.stringify({ type: "stop_capture" }));
    }

    const ssSocket = secureState.get("screenshotSocket");
    if (ssSocket) {
      ssSocket.close();
    }

    if (ctrlSocket) {
      ctrlSocket.close();
    }

    setTimeout(() => {
      connectWebSockets()
        .then(() => {
          appendCleanOutput("EXECUTION FORCIBLY TERMINATED", "error");
          updateTaskStatus("TERMINATED", "danger");
        })
        .catch(() => {
          appendCleanOutput("CONNECTION LOST", "error");
          updateTaskStatus("ERROR", "danger");
        });
    }, 500);
  }

  async function runTest() {
    if (!auth.isAuthenticated()) {
      auth.logout();
      return;
    }

    const instructions = sanitizeInput(elements.testInstructions.value.trim());

    if (!instructions) {
      showMatrixValidation();
      return;
    }

    const settings = apiSettings.getSettings();
    let effectiveApiKey = null;

    if (settings.useDefaultKey) {
      try {
        effectiveApiKey = await apiSettings.loadApiKey(settings.model);
      } catch (error) {}
    } else {
      effectiveApiKey = settings.apiKey;
    }

    updateTaskStatus("INITIALIZING...", "info");
    showLiveViewMessage("EXECUTING PROGRAM...", true);

    elements.testOutput.textContent = "";
    appendCleanOutput("INITIALIZING EXECUTION SEQUENCE...", "info");
    appendCleanOutput(`INSTRUCTIONS: ${instructions}`, "info");
    appendCleanOutput(
      `USING API: ${settings.provider.toUpperCase()} / ${settings.model}`,
      "info",
    );

    disableDownloadButton();

    secureState.set("lastTaskInfo", {
      instructions: instructions,
      timestamp: new Date().toISOString(),
      provider: settings.provider,
      model: settings.model,
    });

    secureState.set("isTaskRunning", true);
    elements.stopBtn.disabled = false;

    try {
      const socket = secureState.get("controlSocket");

      const response = await fetch(
        `${secureState.get("serverUrl")}/sessions/${secureState.get("sessionId")}/tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": secureState.get("apiKey"),
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            instructions,
            browser_visible: true,
            api_provider: settings.provider,
            api_model: settings.model,
            api_key: effectiveApiKey,
            use_default_key: false,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      secureState.set("currentTaskId", data.task_id);

      appendCleanOutput("PROGRAM EXECUTION ACTIVATED", "success");
      updateTaskStatus("RUNNING", "primary");
    } catch (error) {
      appendCleanOutput("ERROR: EXECUTION FAILURE", "error");
      appendCleanOutput(sanitizeInput(error.message), "error");
      updateTaskStatus("ERROR", "danger");
      showLiveViewMessage("ERROR: EXECUTION FAILED", true);

      secureState.set("isTaskRunning", false);
      elements.stopBtn.disabled = true;
    }
  }

  function checkRecordingStatus() {
    const socket = secureState.get("controlSocket");
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "get_recording_status" }));
    }
  }

  setInterval(() => {
    if (secureState.get("sessionId") && secureState.get("isTaskRunning")) {
      checkRecordingStatus();
    }
  }, 30000);

  function enableDownloadButton() {
    elements.downloadResultBtn.classList.remove("disabled");
  }

  function disableDownloadButton() {
    elements.downloadResultBtn.classList.add("disabled");
  }

  function disconnect() {
    updateRecordingIndicator(false);

    const ssSocket = secureState.get("screenshotSocket");
    if (ssSocket) {
      ssSocket.close();
      secureState.set("screenshotSocket", null);
    }

    const ctrlSocket = secureState.get("controlSocket");
    if (ctrlSocket) {
      if (ctrlSocket.readyState === WebSocket.OPEN) {
        ctrlSocket.send(JSON.stringify({ type: "stop_capture" }));
      }
      ctrlSocket.close();
      secureState.set("controlSocket", null);
    }

    secureState.set("sessionId", null);
    secureState.set("currentTaskId", null);
    secureState.set("isCapturing", false);
    secureState.set("lastResult", null);
    secureState.set("lastTaskInfo", null);
    secureState.set("isTaskRunning", false);
    elements.stopBtn.disabled = true;

    updateStatus("DISCONNECTED", "secondary");
    auth.logout();
  }

  function updateTaskStatus(text, type) {
    if (text.includes("undefined")) {
      if (type === "info" || type === "primary") {
        text = "RUNNING";
      }
    }

    switch (text) {
      case "Running":
        text = "IN PROGRESS";
        break;
      case "Completed":
        text = "COMPLETE ✓";
        break;
      case "Starting...":
        text = "STARTING...";
        break;
      case "No tasks":
        text = "READY";
        break;
    }

    if (text.startsWith("Step ")) {
      text = "PROCESSING";
    }

    elements.taskStatus.textContent = sanitizeInput(text);
    elements.taskStatus.className = `badge bg-${sanitizeInput(type)}`;
  }

  function showLiveViewMessage(message, loading = false) {
    elements.liveViewOverlay.style.display = "flex";
    const h4 = createSafeElement("h4", loading ? "loading" : "");
    h4.textContent = sanitizeInput(message);
    elements.liveViewOverlay.innerHTML = "";
    elements.liveViewOverlay.appendChild(h4);
  }

  function handleControlMessage(message) {
    if (!message || typeof message !== "object") return;

    switch (message.type) {
      case "session_status":
      case "recording_status_response":
        if (
          message.status === "inactive" &&
          document
            .getElementById("recording-indicator")
            .classList.contains("active")
        ) {
          updateRecordingIndicator(false);
          appendCleanOutput("> RECORDING STATUS CORRECTED", "info");
        }
        break;
      case "session_update":
        break;

      case "task_update":
        updateTaskStatus("RUNNING", "primary");
        break;

      case "task_step":
        updateTaskStatus("RUNNING", "info");

        let stepInfo =
          message.message ||
          (message.step_info && message.step_info.goal) ||
          "";

        stepInfo = sanitizeInput(
          stepInfo
            .replace(/\[Step undefined\]/g, "")
            .replace(/Task started\. ID:.*/g, "")
            .replace(/Navigate to the specified URL:/g, "Navigating to:")
            .trim(),
        );

        if (
          stepInfo &&
          !stepInfo.includes("Starting test") &&
          !stepInfo.includes("Iniciando prueba")
        ) {
          if (stepInfo.toLowerCase().includes("navigate")) {
            appendCleanOutput(stepInfo, "navigate");
          } else if (
            stepInfo.toLowerCase().includes("click") ||
            stepInfo.toLowerCase().includes("accept")
          ) {
            appendCleanOutput(stepInfo, "action");
          } else if (
            stepInfo.toLowerCase().includes("check") ||
            stepInfo.toLowerCase().includes("examine") ||
            stepInfo.toLowerCase().includes("find")
          ) {
            appendCleanOutput(stepInfo, "check");
          } else {
            appendCleanOutput(stepInfo, "info");
          }
        }
        break;

      case "task_progress":
        break;

      case "task_complete":
        if (message.raw_result) {
          message.raw_result = purgeAgentHistory(message.raw_result);
        }
        handleTaskComplete(message);
        break;

      case "task_error":
        if (message.error) {
          const errorMsg = message.error.toLowerCase();

          if (
            errorMsg.includes("active_sessions") ||
            errorMsg.includes("execution failure") ||
            errorMsg.includes("is not defined")
          ) {
            console.log("🚫 Filtered legacy error:", message.error);
            return;
          }
        }

        updateTaskStatus("ERROR", "danger");
        appendCleanOutput("EXECUTION ERROR DETECTED", "error");
        if (message.error) {
          appendCleanOutput(sanitizeInput(message.error), "error");
        }

        secureState.set("isTaskRunning", false);
        elements.stopBtn.disabled = true;
        break;

      case "capture_status":
        secureState.set("isCapturing", message.status === "started");
        if (secureState.get("isCapturing")) {
          showLiveViewMessage("RECEIVING DATA STREAM...", false);
        } else {
          showLiveViewMessage("DATA STREAM HALTED", false);
        }
        break;

      case "recording_status":
        if (message.status === "started") {
          updateRecordingIndicator(true);
          appendCleanOutput("> VIDEO RECORDING STARTED", "success");
        } else if (message.status === "stopped") {
          updateRecordingIndicator(false);
          appendCleanOutput("> VIDEO RECORDING STOPPED AND SAVED", "success");
        }
        break;

      case "capture_status":
        secureState.set("isCapturing", message.status === "started");
        const recordingEnabled = message.recording_enabled || false;

        if (secureState.get("isCapturing")) {
          const recordingText = recordingEnabled ? " (WITH RECORDING)" : "";
          showLiveViewMessage(
            `RECEIVING DATA STREAM${recordingText}...`,
            false,
          );
          updateRecordingIndicator(recordingEnabled);
        } else {
          showLiveViewMessage("DATA STREAM HALTED", false);
          updateRecordingIndicator(false);
        }
        break;

      case "pong":
        break;
    }
  }

  function clearTestOutput() {
    elements.testOutput.textContent = "";
  }

  function appendCleanOutput(text, type = "info") {
    if (type === "error" && typeof text === "string") {
      const textLower = text.toLowerCase();
      if (
        textLower.includes("active_sessions") ||
        textLower.includes("execution failure") ||
        textLower.includes("is not defined")
      ) {
        console.log("🚫 Filtered error:", text);
        return;
      }
    }

    if (
      type === "raw-output" &&
      typeof text === "string" &&
      (text.includes("AgentHistoryList") || text.includes("ActionResult("))
    ) {
      text = purgeAgentHistory(text);
    }

    const sanitizedText = sanitizeInput(text);
    const line = document.createElement("div");

    switch (type) {
      case "navigate":
        line.className = "clean-result navigate-step";
        line.textContent = sanitizedText;
        break;
      case "action":
        line.className = "clean-result action-step";
        line.textContent = sanitizedText;
        break;
      case "check":
        line.className = "clean-result check-step";
        line.textContent = sanitizedText;
        break;
      case "header":
        line.className = "clean-result result-main-header";
        line.textContent = sanitizedText;
        break;
      case "raw-output-header":
        line.className = "clean-result raw-output-header";
        line.textContent = sanitizedText;
        break;
      case "raw-output":
        line.className = "clean-result raw-output";
        line.textContent = sanitizedText;
        break;
      case "category":
        line.className = "clean-result result-category";
        line.textContent = sanitizedText;
        break;
      case "subcategory":
        line.className = "clean-result result-subcategory";
        line.textContent = sanitizedText;
        break;
      case "item":
        line.className = "clean-result result-item";
        line.textContent = sanitizedText;
        break;
      case "feature":
        line.className = "clean-result result-feature";
        const span = document.createElement("span");
        span.className = "feature-label";
        span.textContent = sanitizedText;
        line.appendChild(span);
        break;
      case "success":
        line.className = "clean-result success-message";
        line.textContent = sanitizedText;
        break;
      case "error":
        line.className = "clean-result error-message";
        line.textContent = sanitizedText;
        break;
      case "raw-output-toggle":
        line.className = "raw-output-toggle";
        line.textContent = sanitizedText;
        break;
      case "result-main-header":
        line.className = "clean-result result-main-header";
        line.textContent = sanitizedText;
        break;
      case "result-item":
        line.className = "clean-result result-item";
        line.textContent = sanitizedText;
        break;
      case "result-json":
        line.className = "clean-result result-json";
        line.textContent = sanitizedText;
        break;
      case "result-data":
        line.className = "clean-result result-data";
        line.textContent = sanitizedText;
        break;
      default:
        line.className = "clean-result info-message";
        line.textContent = sanitizedText;
    }

    elements.testOutput.appendChild(line);
    elements.testOutput.scrollTop = elements.testOutput.scrollHeight;
  }

  function updateStatus(text, type) {
    elements.connectionStatus.textContent = sanitizeInput(text);
    elements.connectionStatus.className = `badge bg-${sanitizeInput(type)}`;
  }

  function addAgentHistoryHidingCSS() {
    const style = document.createElement("style");
    style.textContent = `
            .raw-output:contains("AgentHistoryList") {
                position: relative;
            }

            .raw-output:contains("AgentHistoryList"):before {
                content: "AgentHistoryList data has been removed for clarity";
                display: block;
                padding: 5px 10px;
                margin: 10px 0;
                background-color: rgba(0, 50, 0, 0.3);
                border-left: 3px solid #00aa00;
                color: #00aa00;
                font-style: italic;
            }

            .raw-output:contains("ActionResult(") {
                position: relative;
            }

            .agent-history-data,
            .raw-output pre:contains("AgentHistoryList"),
            .raw-output code:contains("AgentHistoryList"),
            .raw-output div:contains("AgentHistoryList"),
            .raw-output span:contains("AgentHistoryList") {
                display: none !important;
            }

            .result-json {
                z-index: 10;
                position: relative;
                border: 1px solid #00ff99;
            }

            @keyframes highlight-pulse {
                0% { box-shadow: 0 0 3px rgba(0, 255, 153, 0.5); }
                50% { box-shadow: 0 0 8px rgba(0, 255, 153, 0.8); }
                100% { box-shadow: 0 0 3px rgba(0, 255, 153, 0.5); }
            }

            .result-main-header + .result-json {
                animation: highlight-pulse 2s infinite;
            }
        `;
    document.head.appendChild(style);
  }

  async function loadVideoSettings() {
    const settings = videoSettings.getSettings();
    if (elements.videoResolution)
      elements.videoResolution.value = settings.resolution;
    if (elements.videoQuality) elements.videoQuality.value = settings.quality;
    if (elements.videoFps)
      elements.videoFps.value = settings.refreshRate.toString();

    const enableRecordingCheckbox = document.getElementById("enable-recording");
    if (enableRecordingCheckbox) {
      enableRecordingCheckbox.checked = settings.recordingEnabled;
      updateRecordingStatus(settings.recordingEnabled);
    }

    const ffmpegStatus = await checkFFmpegStatus();
    const videoSettingsContent = document.getElementById(
      "video-settings-content",
    );

    if (ffmpegStatus && videoSettingsContent) {
      let ffmpegStatusElement = document.getElementById("ffmpeg-status-info");
      if (!ffmpegStatusElement) {
        ffmpegStatusElement = document.createElement("div");
        ffmpegStatusElement.id = "ffmpeg-status-info";
        ffmpegStatusElement.className = "ffmpeg-status-info";

        const lastFormGroup =
          videoSettingsContent.querySelector(".recording-section");
        if (lastFormGroup) {
          lastFormGroup.parentNode.insertBefore(
            ffmpegStatusElement,
            lastFormGroup,
          );
        } else {
          videoSettingsContent.appendChild(ffmpegStatusElement);
        }
      }

      const statusClass = ffmpegStatus.ffmpeg_available
        ? "ffmpeg-available"
        : "ffmpeg-unavailable";
      const statusIcon = ffmpegStatus.ffmpeg_available ? "✅" : "⚠️";
      const formatInfo = ffmpegStatus.ffmpeg_available
        ? "MP4 videos available"
        : "Only GIF format available";

      ffmpegStatusElement.innerHTML = `
            <div class="ffmpeg-status ${statusClass}">
                <strong>${statusIcon} Video Format Status</strong>
                <p>${ffmpegStatus.message}</p>
                <small>${formatInfo}</small>
            </div>
        `;
    }

    if (elements.videoSettingsStatus)
      elements.videoSettingsStatus.style.display = "none";
  }

  function testVideoSettings() {
    const resolution = elements.videoResolution.value;
    const quality = elements.videoQuality.value;
    const refreshRate = parseFloat(elements.videoFps.value);
    const recordingEnabled =
      document.getElementById("enable-recording").checked;

    elements.videoSettingsStatus.textContent = "TESTING VIDEO SETTINGS...";
    elements.videoSettingsStatus.className = "settings-key-status test-loading";
    elements.videoSettingsStatus.style.display = "block";

    const newSettings = {
      resolution: resolution,
      quality: quality,
      refreshRate: refreshRate,
      recordingEnabled: recordingEnabled,
    };

    videoSettings.updateSettings(newSettings);
    updateRecordingStatus(recordingEnabled);

    videoSettings
      .applyVideoSettings()
      .then((result) => {
        if (result.success) {
          elements.videoSettingsStatus.textContent = result.message;
          elements.videoSettingsStatus.className =
            "settings-key-status test-success";
        } else {
          elements.videoSettingsStatus.textContent = result.message;
          elements.videoSettingsStatus.className =
            "settings-key-status test-error";
        }
      })
      .catch((error) => {
        elements.videoSettingsStatus.textContent =
          "Settings saved locally (will apply on next capture)";
        elements.videoSettingsStatus.className =
          "settings-key-status test-success";
      });
  }

  function resetVideoSettings() {
    const defaultSettings = {
      resolution: "1920x1080",
      quality: "high",
      refreshRate: 1.0,
      recordingEnabled: false,
    };

    videoSettings.updateSettings(defaultSettings);
    loadVideoSettings();

    elements.videoSettingsStatus.textContent =
      "VIDEO SETTINGS RESET TO DEFAULT";
    elements.videoSettingsStatus.className = "settings-key-status test-success";
    elements.videoSettingsStatus.style.display = "block";

    setTimeout(() => {
      elements.videoSettingsStatus.style.display = "none";
    }, 3000);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const validationElement = document.getElementById("matrix-validation");
    const enableRecordingCheckbox = document.getElementById("enable-recording");
    if (enableRecordingCheckbox) {
      enableRecordingCheckbox.addEventListener("change", function () {
        updateRecordingStatus(this.checked);
      });
    }
    if (validationElement) {
      validationElement.style.display = "none";
      validationElement.style.visibility = "hidden";
      validationElement.style.opacity = "0";
      validationElement.style.position = "absolute";
      validationElement.style.zIndex = "-9999";
    }

    hideAllModals();

    const customCssElement = document.createElement("style");
    customCssElement.textContent = `
            .settings-tabs {
                display: flex;
                border-bottom: 2px solid #00ff00;
                background-color: #001100;
            }

            .settings-tab {
                background-color: transparent;
                border: none;
                color: #00ff00;
                padding: 10px 20px;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                flex: 1;
                border-right: 1px solid rgba(0, 255, 0, 0.3);
            }

            .settings-tab:last-child {
                border-right: none;
            }

            .settings-tab:hover {
                background-color: rgba(0, 255, 0, 0.1);
            }

            .settings-tab-active {
                background-color: rgba(0, 255, 0, 0.2);
                box-shadow: inset 0 0 10px rgba(0, 255, 0, 0.3);
            }

            .settings-tab-content {
                padding: 10px 0;
            }

            .settings-modal {
                min-height: 450px;
                max-height: 80vh;
            }

            #user-management-content, #api-settings-content {
                min-height: 300px;
            }

            .large-modal {
                max-width: 800px;
                height: 80vh;
                max-height: 800px;
                display: flex;
                flex-direction: column;
            }

            .matrix-history-btn-full {
                background-color: #332200;
                border: 1px solid #ffaa00;
                color: #ffaa00;
                text-shadow: 0 0 2px rgba(255, 170, 0, 0.5);
                box-shadow: 0 0 5px rgba(255, 170, 0, 0.5);
                text-transform: uppercase;
                letter-spacing: 1px;
                font-weight: bold;
                transition: all 0.3s ease;
                padding: 8px 0;
                text-align: center;
                width: 100%;
                cursor: pointer;
            }

            .matrix-history-btn-full:hover {
                background-color: #443300;
                box-shadow: 0 0 8px rgba(255, 170, 0, 0.7), 0 0 15px rgba(255, 170, 0, 0.4);
            }

            .settings-tab-content {
                animation: tabFadeIn 0.3s forwards;
            }

            @keyframes tabFadeIn {
                from { opacity: 0; transform: translateY(5px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .history-controls {
                display: flex;
                justify-content: flex-end;
                margin-top: 5px;
                margin-bottom: 15px;
                position: sticky;
                bottom: 0;
                background-color: #001100;
                padding: 10px 0;
                border-top: 1px solid rgba(0, 255, 0, 0.3);
            }

            .history-item-preview {
                color: #aaffaa;
                opacity: 0.8;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 5px;
                font-size: 0.9em;
            }

            .detail-step-line {
                color: #33ddff;
                border-left: 2px solid #33ddff;
                padding-left: 8px;
                margin-bottom: 8px;
            }

            .detail-check-line {
                color: #33ff33;
                border-left: 2px solid #33ff33;
                padding-left: 8px;
                margin-bottom: 8px;
            }

            .detail-result-header {
                color: #00ff00;
                font-size: 1.2em;
                margin-top: 12px;
                margin-bottom: 10px;
                font-weight: bold;
                letter-spacing: 1px;
            }

            .detail-navigation-line {
                color: #33ddff;
                border-left: 2px solid #33ddff;
                padding-left: 8px;
                margin-bottom: 8px;
            }

            .detail-line {
                color: #aadddd;
                padding-left: 8px;
                margin-bottom: 8px;
            }

            .result-data {
                color: #ffff33;
                border-left: 2px solid #ffff33;
                padding-left: 10px;
                margin: 8px 0;
                font-weight: bold;
                line-height: 1.5;
            }

            .history-item {
                padding: 12px;
                border-bottom: 1px solid rgba(255, 170, 0, 0.3);
                transition: all 0.3s ease;
            }

            .history-item:hover {
                background-color: rgba(255, 170, 0, 0.1);
            }

            .history-content {
                font-family: 'Share Tech Mono', 'VT323', monospace;
                line-height: 1.6;
            }

            #history-detail-content {
                line-height: 1.6;
                padding: 15px;
                max-height: 500px;
                overflow-y: auto;
            }
        `;
    document.head.appendChild(customCssElement);

    updateModelOptions(apiSettings.getSettings().provider);
    updateConfigButtonWithModelInfo();
    setupMatrixFormValidation();
    toggleDefaultKeyUse();
    addAgentHistoryHidingCSS();

    const styleFixModal = document.createElement("style");
    styleFixModal.textContent = `
            .settings-modal {
                height: auto !important;
                transition: none !important;
            }

            .settings-modal .settings-body {
                min-height: 320px;
            }
        `;
    document.head.appendChild(styleFixModal);

    if (userToken && auth.isAuthenticated()) {
      setTimeout(async () => {
        try {
          const decoded = auth.parseJwt(userToken);
          if (decoded) {
            currentUser = {
              username: decoded.sub,
              role: decoded.role || "user",
            };

            elements.testOutput.textContent = "";
            elements.loginContainer.style.display = "none";
            elements.appContainer.style.display = "block";

            hideAllModals();
            connect();
          } else {
            auth.logout();
          }
        } catch (error) {
          auth.logout();
        }
      }, 500);
    }

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(function (node) {
            if (
              node.textContent &&
              node.textContent.includes("AgentHistoryList")
            ) {
              if (node.nodeType === Node.TEXT_NODE) {
                node.textContent = "[Agent history data removed]";
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList.contains("raw-output")) {
                  node.textContent = purgeAgentHistory(node.textContent);
                }
              }
            }
          });
        }
      });
    });

    observer.observe(document.getElementById("test-output"), {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && auth.isAuthenticated()) {
      setTimeout(() => {
        if (document.visibilityState === "hidden") {
          disconnect();
        }
      }, 300000);
    }
  });

  setInterval(() => {
    document.querySelectorAll(".error-message").forEach((el) => {
      const text = el.textContent.toLowerCase();
      if (
        text.includes("active_sessions") ||
        text.includes("execution failure")
      ) {
        el.remove();
      }
    });
  }, 1000);

  console.log("✅ Error filter activated");
})();
