/* eslint-disable */
// @ts-nocheck
const { app, BrowserWindow, Tray, Menu, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

// ── Config ──────────────────────────────────────
const GATEWAY_PORT = 18789;
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}`;
const POLL_INTERVAL = 500;
const MAX_WAIT = 30000;

let mainWindow = null;
let tray = null;
let gatewayProcess = null;
let isQuitting = false;
let externalGateway = false; // true if we connected to an already-running gateway

// ── Check if gateway is already running ─────────

function isGatewayRunning() {
  return new Promise((resolve) => {
    const req = http.get(GATEWAY_URL, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// ── Gateway lifecycle ───────────────────────────

function startGateway() {
  const bin = "openclaw";
  console.log(`[desktop] Starting gateway: ${bin} gateway`);

  gatewayProcess = spawn(bin, ["gateway"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: Object.assign({}, process.env),
    detached: false,
  });

  gatewayProcess.stdout.on("data", (data) => {
    process.stdout.write("[gateway] " + data);
  });

  gatewayProcess.stderr.on("data", (data) => {
    process.stderr.write("[gateway] " + data);
  });

  gatewayProcess.on("error", (err) => {
    console.error("[desktop] Failed to start gateway:", err.message);
    dialog.showErrorBox(
      "OpenClaw 启动失败",
      "无法启动 openclaw gateway：" + err.message + "\n\n请确保已安装 openclaw 并在 PATH 中。",
    );
  });

  gatewayProcess.on("exit", (code) => {
    console.log("[desktop] Gateway exited with code " + code);
    gatewayProcess = null;
    if (!isQuitting) {
      dialog.showErrorBox(
        "OpenClaw 网关已退出",
        "openclaw gateway 进程意外退出 (code: " + code + ")。\n应用将关闭。",
      );
      app.quit();
    }
  });
}

function stopGateway() {
  if (gatewayProcess) {
    console.log("[desktop] Stopping gateway...");
    gatewayProcess.kill("SIGTERM");
    gatewayProcess = null;
  }
}

// ── Wait for gateway to be ready ────────────────

function waitForGateway() {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function poll() {
      const req = http.get(GATEWAY_URL, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > MAX_WAIT) {
          reject(new Error("Gateway did not start within 30s"));
        } else {
          setTimeout(poll, POLL_INTERVAL);
        }
      });
    }

    poll();
  });
}

// ── Window ──────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: "OpenClaw",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    backgroundColor: "#0f1117",
  });

  mainWindow.loadURL(GATEWAY_URL);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── Tray ────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, "icon.png");
  try {
    tray = new Tray(iconPath);
  } catch (e) {
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示 OpenClaw",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "在浏览器中打开",
      click: () => shell.openExternal(GATEWAY_URL),
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("OpenClaw 中文版");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── App lifecycle ───────────────────────────────

app
  .whenReady()
  .then(async () => {
    // Check if gateway is already running
    const alreadyRunning = await isGatewayRunning();

    if (alreadyRunning) {
      console.log("[desktop] Gateway already running on port " + GATEWAY_PORT + ", connecting...");
      externalGateway = true;
    } else {
      // Start our own gateway
      startGateway();
      try {
        await waitForGateway();
      } catch (err) {
        dialog.showErrorBox(
          "OpenClaw 启动超时",
          "网关未能在 30 秒内启动。\n请检查 openclaw 是否已正确安装。",
        );
        app.quit();
        return;
      }
    }

    createWindow();
    createTray();

    app.on("activate", () => {
      if (mainWindow) {
        mainWindow.show();
      }
    });
  })
  .catch((err) => {
    console.error("[desktop] Fatal error:", err);
    app.quit();
  });

app.on("before-quit", () => {
  isQuitting = true;
  if (!externalGateway) {
    stopGateway();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    isQuitting = true;
    if (!externalGateway) {
      stopGateway();
    }
    app.quit();
  }
});
