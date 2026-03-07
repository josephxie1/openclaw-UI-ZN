/* eslint-disable */
// @ts-nocheck
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  shell,
  dialog,
  globalShortcut,
  ipcMain,
} = require("electron");
const { fork, execFile } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

// Suppress EPIPE errors (harmless, happens when pipes close during shutdown)
process.stdout.on("error", () => {});
process.stderr.on("error", () => {});
process.on("uncaughtException", (err) => {
  if (err.code === "EPIPE") return;
  console.error("[desktop] Uncaught exception:", err);
});

// ── Config ──────────────────────────────────────
const GATEWAY_PORT = 18789;
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}`;
let GATEWAY_URL_ACTUAL = GATEWAY_URL;
const POLL_INTERVAL = 500;
const MAX_WAIT = 30000;

let mainWindow = null;
let tray = null;
let gatewayProcess = null;
let isQuitting = false;
let externalGateway = false;
let lastGatewayArgs = [];
let lastGatewayHome = null;
let isRestarting = false;

// ── Resolve bundled gateway path ────────────────

function getGatewayPath() {
  // In packaged app: resources/gateway/
  // In dev: ./gateway/
  const candidates = [
    path.join(process.resourcesPath || "", "gateway"),
    path.join(__dirname, "gateway"),
  ];
  for (const dir of candidates) {
    const entry = path.join(dir, "openclaw.mjs");
    if (fs.existsSync(entry)) {
      return { dir, entry };
    }
  }
  return null;
}

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
// ── Ensure minimal config on fresh machines ─────

function buildMinimalConfig(workspaceDir) {
  return {
    $schema: "https://openclaw.com/schema.json",
    meta: {
      lastTouchedVersion: "2026.3.2",
      lastTouchedAt: new Date().toISOString(),
    },
    gateway: {
      mode: "local",
      bind: "loopback",
    },
    agents: {
      defaults: {
        workspace: workspaceDir,
        skipBootstrap: true,
      },
      list: [
        {
          id: "main",
          default: true,
          workspace: workspaceDir,
          identity: {
            name: "OpenClaw",
            emoji: "🦞",
          },
        },
      ],
    },
    commands: {
      native: "auto",
      restart: true,
    },
    channels: {
      telegram: { enabled: true },
      whatsapp: { enabled: true },
      discord: { enabled: true },
      slack: { enabled: true },
      signal: { enabled: true },
      imessage: { enabled: true },
      googlechat: { enabled: true },
      feishu: { enabled: true },
    },
    plugins: {
      entries: {
        feishu: {
          enabled: true,
        },
      },
    },
  };
}

function ensureMinimalConfig() {
  const home = app.getPath("home");
  const configDir = path.join(home, ".openclaw");
  const configPath = path.join(configDir, "openclaw.json");

  if (fs.existsSync(configPath)) {
    // Config exists — check if models are configured
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw);
      const providers = config?.models?.providers;
      if (!providers || Object.keys(providers).length === 0) {
        console.log("[desktop] Config exists but no models configured, showing onboarding");
        return true;
      }
    } catch {
      // Parse error, skip
    }
    return false;
  }

  console.log("[desktop] No config found, creating minimal config at:", configPath);

  const workspaceDir = path.join(configDir, "workspace");
  const minimalConfig = buildMinimalConfig(workspaceDir);

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(minimalConfig, null, 2) + "\n");
    console.log("[desktop] Created minimal config successfully");
    return true;
  } catch (err) {
    console.error("[desktop] Failed to create config:", err.message);
    return false;
  }
}

// ── Gateway lifecycle ───────────────────────────

function startGateway(extraArgs = [], customHome = null) {
  lastGatewayArgs = extraArgs;
  lastGatewayHome = customHome;
  const bundled = getGatewayPath();

  if (bundled) {
    // ── Standalone mode: use Electron's Node to run bundled gateway ──
    console.log("[desktop] Starting bundled gateway from:", bundled.dir);

    const { spawn, execSync } = require("child_process");

    // Resolve node binary: bundled node-bin > system node > Electron node (last resort)
    let nodeBin = "node";
    let useElectronNode = false;
    if (app.isPackaged) {
      const bundledNode = path.join(process.resourcesPath, "node-bin", "node");
      if (fs.existsSync(bundledNode)) {
        nodeBin = bundledNode;
        console.log("[desktop] Using bundled node:", bundledNode);
      } else {
        try {
          execSync("node --version", { stdio: "ignore" });
          console.log("[desktop] Using system node");
        } catch {
          nodeBin = process.execPath;
          useElectronNode = true;
          console.log("[desktop] Falling back to Electron node");
        }
      }
    }
    const env = Object.assign({}, process.env, {
      NODE_PATH: path.join(bundled.dir, "node_modules"),
    });
    // Remove npm env vars and set correct gateway version
    delete env.npm_package_version;
    delete env.npm_package_name;
    try {
      const gwPkg = JSON.parse(fs.readFileSync(path.join(bundled.dir, "package.json"), "utf8"));
      env.OPENCLAW_BUNDLED_VERSION = gwPkg.version;
      env.OPENCLAW_VERSION = gwPkg.version;
    } catch {}

    if (useElectronNode) {
      env.ELECTRON_RUN_AS_NODE = "1";
      env.ELECTRON_NO_ATTACH_CONSOLE = "1";
    }
    // Point gateway to bundled plugins (e.g. feishu plugin)
    const extensionsDir = path.join(bundled.dir, "extensions");
    if (fs.existsSync(extensionsDir)) {
      env.OPENCLAW_BUNDLED_PLUGINS_DIR = extensionsDir;
    }
    if (customHome) env.OPENCLAW_HOME = customHome;

    gatewayProcess = spawn(
      nodeBin,
      [
        "--no-warnings",
        bundled.entry,
        "gateway",
        "--allow-unconfigured",
        "--auth",
        "none",
        ...extraArgs,
      ],
      {
        cwd: bundled.dir,
        stdio: ["ignore", "pipe", "pipe"],
        env,
      },
    );
  } else {
    // ── Fallback: use system openclaw command ──
    console.log("[desktop] No bundled gateway found, using system openclaw");
    const { spawn } = require("child_process");
    const fallbackEnv = Object.assign({}, process.env);
    if (customHome) fallbackEnv.OPENCLAW_HOME = customHome;
    gatewayProcess = spawn(
      "openclaw",
      ["gateway", "--allow-unconfigured", "--auth", "none", ...extraArgs],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: fallbackEnv,
        detached: false,
      },
    );
  }

  if (gatewayProcess.stdout) {
    gatewayProcess.stdout.on("data", (data) => {
      try {
        process.stdout.write("[gateway] " + data);
      } catch {}
    });
  }
  if (gatewayProcess.stderr) {
    gatewayProcess.stderr.on("data", (data) => {
      try {
        process.stderr.write("[gateway] " + data);
      } catch {}
    });
  }

  gatewayProcess.on("error", (err) => {
    console.error("[desktop] Failed to start gateway:", err.message);
    dialog.showErrorBox(
      "OpenClaw 启动失败",
      "无法启动网关：" + err.message + "\n\n请检查应用是否完整。",
    );
  });

  gatewayProcess.on("exit", (code) => {
    console.log("[desktop] Gateway exited with code " + code);
    gatewayProcess = null;
    if (!isQuitting && !isRestarting) {
      console.log("[desktop] Gateway crashed, auto-restarting in 2s...");
      setTimeout(() => {
        if (!isQuitting) {
          startGateway(lastGatewayArgs, lastGatewayHome);
        }
      }, 2000);
    }
  });
}

function stopGateway() {
  return new Promise((resolve) => {
    if (!gatewayProcess) return resolve();
    console.log("[desktop] Stopping gateway...");
    const proc = gatewayProcess;
    gatewayProcess = null;

    const timeout = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {}
      resolve();
    }, 5000);

    proc.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    try {
      proc.kill("SIGTERM");
    } catch {}
  });
}

// ── Wait for gateway to be ready ────────────────

function waitForGateway(url = GATEWAY_URL) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function poll() {
      const req = http.get(url, (res) => {
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

// Set dock icon (for dev mode; packaged apps use the built icon)
if (process.platform === "darwin" && app.dock) {
  const { nativeImage } = require("electron");
  app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname, "icon.png")));
}

function createWindow() {
  const isDark = require("electron").nativeTheme.shouldUseDarkColors;
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "OpenClaw Desktop",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    backgroundColor: isDark ? "#0a0a14" : "#f5f5f7",
  });

  // IPC: sync window background color when web theme changes
  ipcMain.on("theme-bg-change", (_, color) => {
    if (mainWindow) mainWindow.setBackgroundColor(color);
  });

  // Show splash screen while gateway starts
  mainWindow.loadFile(path.join(__dirname, "splash.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();

    // Inject version override: show "Desktop X.X.X + OC Y.Y.Y"
    const desktopVersion = require("./package.json").version;
    mainWindow.webContents.executeJavaScript(`
      (function() {
        function patchVersion() {
          const pills = document.querySelectorAll('.pill .mono');
          for (const el of pills) {
            const prev = el.previousElementSibling;
            if (prev && prev.textContent.includes('版本')) {
              const gwVersion = el.textContent.trim();
              if (!gwVersion || gwVersion === '不适用' || gwVersion === 'N/A') return false;
              if (el.dataset.patched) return true;
              el.textContent = 'Desktop ${desktopVersion} + OC ' + gwVersion;
              el.dataset.patched = '1';
              return true;
            }
          }
          return false;
        }
        const obs = new MutationObserver(() => { if (patchVersion()) obs.disconnect(); });
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        setTimeout(() => obs.disconnect(), 30000);
      })();
    `);
  });

  // DevTools shortcut: Cmd+Shift+I (macOS) / Ctrl+Shift+I (others)
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "I" && input.shift && (input.meta || input.control)) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      if (mainWindow) mainWindow.hide();
    }
  });
}

// ── Tray ────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, "icon-trayTemplate.png");
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
      click: () => shell.openExternal(GATEWAY_URL_ACTUAL),
    },
    { type: "separator" },
    {
      label: "重启网关",
      click: async () => {
        if (externalGateway) {
          dialog.showMessageBox({ message: "当前连接的是外部网关，无法从桌面端重启。" });
          return;
        }
        console.log("[desktop] Restarting gateway...");
        isRestarting = true;

        // Show loading overlay with animated claw
        if (mainWindow) {
          mainWindow.webContents.executeJavaScript(`
            (function() {
              let ov = document.getElementById('__restart_overlay');
              if (ov) ov.remove();
              ov = document.createElement('div');
              ov.id = '__restart_overlay';
              ov.innerHTML = \`
                <style>
                  @keyframes oc-breathe { 0%,100% { transform:scale(1); filter:drop-shadow(0 0 20px rgba(99,102,241,0.4)) } 50% { transform:scale(1.08); filter:drop-shadow(0 0 40px rgba(167,139,250,0.7)) } }
                  @keyframes oc-rotate { 0% { transform:rotate(-3deg) } 50% { transform:rotate(3deg) } 100% { transform:rotate(-3deg) } }
                  @keyframes oc-pulse-ring { 0% { transform:scale(0.8); opacity:0.6 } 100% { transform:scale(2.5); opacity:0 } }
                  @keyframes oc-text-glow { 0%,100% { opacity:0.7; text-shadow:0 0 8px rgba(99,102,241,0.3) } 50% { opacity:1; text-shadow:0 0 20px rgba(167,139,250,0.6) } }
                  @keyframes oc-progress { 0% { background-position:200% 0 } 100% { background-position:-200% 0 } }
                  @keyframes oc-dot { 0%,80%,100% { transform:scale(0) } 40% { transform:scale(1) } }
                </style>
                <div style="position:fixed;inset:0;background:rgba(10,10,20,0.88);backdrop-filter:blur(12px);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;gap:20px;">
                  <div style="position:relative;width:120px;height:120px;display:flex;align-items:center;justify-content:center;">
                    <div style="position:absolute;width:80px;height:80px;border-radius:50%;background:rgba(99,102,241,0.15);animation:oc-pulse-ring 2s ease-out infinite;"></div>
                    <div style="position:absolute;width:80px;height:80px;border-radius:50%;background:rgba(99,102,241,0.1);animation:oc-pulse-ring 2s ease-out 0.5s infinite;"></div>
                    <svg width="64" height="64" viewBox="0 0 512 512" style="animation:oc-breathe 2s ease-in-out infinite;">
                      <g style="animation:oc-rotate 3s ease-in-out infinite;" transform-origin="256 256">
                        <path fill="rgba(255,255,255,0.9)" d="M175.656 22.375l-48.47 82.094c-23.017 4.384-43.547 11.782-60.124 22.374-24.436 15.613-40.572 37.414-45.5 67.875-4.79 29.62 1.568 68.087 24.125 116.093 93.162 22.88 184.08-10.908 257.25-18.813 37.138-4.012 71.196-.898 96.344 22.97 22.33 21.19 36.21 56.808 41.908 113.436 29.246-35.682 44.538-69.065 49.343-99.594 5.543-35.207-2.526-66.97-20.31-95.593-8.52-13.708-19.368-26.618-32-38.626l14.217-33-41.218 10.625c-8.637-6.278-17.765-12.217-27.314-17.782l-7.03-59.782-38.157 37.406c-12.418-5.186-25.184-9.804-38.158-13.812l-8.375-71.28-57.625 56.5c-9.344-1.316-18.625-2.333-27.812-2.97l-31.094-78.125zM222 325.345c-39.146 7.525-82.183 14.312-127.156 11.686 47.403 113.454 207.056 224.082 260.125 87-101.18 33.84-95.303-49.595-132.97-98.686z"/>
                      </g>
                    </svg>
                  </div>
                  <div style="color:#fff;font-size:15px;font-weight:500;letter-spacing:0.5px;animation:oc-text-glow 2s ease-in-out infinite;">正在重启网关</div>
                  <div style="display:flex;gap:6px;margin-top:-8px;">
                    <div style="width:6px;height:6px;background:#a78bfa;border-radius:50%;animation:oc-dot 1.4s infinite ease-in-out;"></div>
                    <div style="width:6px;height:6px;background:#a78bfa;border-radius:50%;animation:oc-dot 1.4s infinite ease-in-out 0.2s;"></div>
                    <div style="width:6px;height:6px;background:#a78bfa;border-radius:50%;animation:oc-dot 1.4s infinite ease-in-out 0.4s;"></div>
                  </div>
                  <div style="width:180px;height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;margin-top:4px;">
                    <div style="width:100%;height:100%;background:linear-gradient(90deg,transparent,#6366f1,#a78bfa,#6366f1,transparent);background-size:200% 100%;border-radius:2px;animation:oc-progress 1.5s linear infinite;"></div>
                  </div>
                </div>
              \`;
              document.body.appendChild(ov);
            })();
          `);
        }

        // Unload LaunchAgent to prevent auto-restart
        const { execSync } = require("child_process");
        try {
          execSync(
            "launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.openclaw.gateway.plist 2>/dev/null || true",
          );
          console.log("[desktop] LaunchAgent unloaded");
        } catch {}

        await stopGateway();

        // Also kill any lingering process on the port
        try {
          const portNum = GATEWAY_URL_ACTUAL.match(/:(\d+)/)?.[1];
          if (portNum) execSync(`lsof -ti:${portNum} | xargs kill -9 2>/dev/null || true`);
        } catch {}

        // Wait for the port to be released
        const portUrl = GATEWAY_URL_ACTUAL;
        const portFreeTimeout = Date.now() + 10000;
        while (Date.now() < portFreeTimeout) {
          const still = await new Promise((resolve) => {
            const req = http.get(portUrl + "/health", () => resolve(true));
            req.on("error", () => resolve(false));
            req.setTimeout(500, () => {
              req.destroy();
              resolve(false);
            });
          });
          if (!still) break;
          await new Promise((r) => setTimeout(r, 300));
        }
        console.log("[desktop] Port released, starting new gateway...");
        startGateway(lastGatewayArgs, lastGatewayHome);
        try {
          await waitForGateway(GATEWAY_URL_ACTUAL);
          if (mainWindow) mainWindow.reload();
          console.log("[desktop] Gateway restarted successfully");
        } catch (err) {
          dialog.showErrorBox("OpenClaw 重启失败", "网关未能在 30 秒内重新启动。");
        } finally {
          isRestarting = false;
        }
      },
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

// ── launchctl (macOS auto-start) ────────────────

function installLaunchAgent() {
  if (process.platform !== "darwin") return;

  const plistName = "com.openclaw.gateway";
  const plistDir = path.join(app.getPath("home"), "Library", "LaunchAgents");
  const plistPath = path.join(plistDir, plistName + ".plist");
  const appPath = app.getPath("exe");

  // Only install if not already present
  if (fs.existsSync(plistPath)) return;

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${plistName}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${appPath}</string>
        <string>--hidden</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/openclaw-gateway.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/openclaw-gateway.err</string>
</dict>
</plist>`;

  try {
    if (!fs.existsSync(plistDir)) {
      fs.mkdirSync(plistDir, { recursive: true });
    }
    fs.writeFileSync(plistPath, plist);
    console.log("[desktop] Installed LaunchAgent:", plistPath);
  } catch (err) {
    console.error("[desktop] Failed to install LaunchAgent:", err.message);
  }
}

// ── App lifecycle ───────────────────────────────

const startHidden = process.argv.includes("--hidden");

app
  .whenReady()
  .then(async () => {
    let isFirstLaunch = false;
    // Check if gateway is already running
    const alreadyRunning = await isGatewayRunning();

    if (alreadyRunning) {
      // Ask user what to do
      const { nativeImage } = require("electron");
      const dialogIcon = nativeImage.createFromPath(path.join(__dirname, "icon.png"));
      const { response } = await dialog.showMessageBox({
        type: "question",
        icon: dialogIcon,
        title: "OpenClaw Desktop",
        message: `检测到端口 ${GATEWAY_PORT} 已有网关在运行`,
        detail: "你可以连接到已有的网关，或者启动一个新的独立网关。",
        buttons: ["连接已有网关", "启动新网关", "退出"],
        defaultId: 0,
        cancelId: 2,
      });

      if (response === 2) {
        app.quit();
        return;
      }

      if (response === 0) {
        // Connect to existing
        console.log("[desktop] Connecting to existing gateway on port " + GATEWAY_PORT);
        externalGateway = true;
      } else {
        // Start new independent gateway on a different port with separate config
        const newPort = GATEWAY_PORT + 1;
        const independentHome = path.join(app.getPath("home"), ".openclaw-desktop");
        console.log(
          "[desktop] Starting independent gateway on port " +
            newPort +
            " with home: " +
            independentHome,
        );
        GATEWAY_URL_ACTUAL = `http://127.0.0.1:${newPort}`;

        // Create minimal config for independent instance
        const independentConfigDir = path.join(independentHome, ".openclaw");
        if (!fs.existsSync(independentConfigDir)) {
          fs.mkdirSync(independentConfigDir, { recursive: true });
        }
        const independentConfig = path.join(independentConfigDir, "openclaw.json");
        if (!fs.existsSync(independentConfig)) {
          const independentWorkspace = path.join(independentHome, "workspace");
          if (!fs.existsSync(independentWorkspace)) {
            fs.mkdirSync(independentWorkspace, { recursive: true });
          }
          fs.writeFileSync(
            independentConfig,
            JSON.stringify(buildMinimalConfig(independentWorkspace), null, 2) + "\n",
          );
          isFirstLaunch = true;
        } else {
          // Config exists — check if models are configured
          try {
            const raw = fs.readFileSync(independentConfig, "utf-8");
            const config = JSON.parse(raw);
            const providers = config?.models?.providers;
            if (!providers || Object.keys(providers).length === 0) {
              console.log("[desktop] Independent config exists but no models, showing onboarding");
              isFirstLaunch = true;
            }
          } catch {
            // Parse error, skip
          }
        }
      }
    } else {
      isFirstLaunch = ensureMinimalConfig();
    }

    // Pass onboarding flag to renderer via env → preload
    if (isFirstLaunch) {
      process.env.OPENCLAW_ONBOARDING = "1";
    }

    // Show window with splash immediately
    createWindow();
    createTray();

    // If started with --hidden (e.g. from launchctl), don't show window
    if (startHidden && mainWindow) {
      mainWindow.hide();
    }

    // Start gateway (splash is already showing)
    if (!externalGateway) {
      if (alreadyRunning) {
        // Independent gateway on new port
        const newPort = GATEWAY_PORT + 1;
        const independentHome = path.join(app.getPath("home"), ".openclaw-desktop");
        startGateway(["--port", String(newPort)], independentHome);
      } else {
        startGateway();
      }
      try {
        await waitForGateway(GATEWAY_URL_ACTUAL);
      } catch (err) {
        dialog.showErrorBox("OpenClaw 启动超时", "网关未能在 30 秒内启动。\n请检查应用是否完整。");
        app.quit();
        return;
      }
    }

    // Navigate to gateway URL
    if (mainWindow) {
      // Show welcome text on splash before navigating
      await mainWindow.webContents.executeJavaScript(`
        (function() {
          document.querySelector('.subtitle').textContent = '';
          document.querySelector('.dots').style.display = 'none';
          document.querySelector('.progress-track').style.display = 'none';
          var welcome = document.createElement('div');
          welcome.textContent = '嗨，准备好和龙虾一起探索世界了吗？🦞';
          welcome.style.cssText = 'color:var(--title-color);font-size:36px;font-weight:600;opacity:0;transform:translateY(8px);transition:all 0.5s ease;margin-top:-8px;';
          document.querySelector('.subtitle').after(welcome);
          requestAnimationFrame(function() {
            welcome.style.opacity = '1';
            welcome.style.transform = 'translateY(0)';
          });
        })();
      `);
      await new Promise((r) => setTimeout(r, 1500));

      // Prevent HTML <title> from overriding window title
      mainWindow.on("page-title-updated", (e) => e.preventDefault());
      const url = isFirstLaunch
        ? GATEWAY_URL_ACTUAL + (GATEWAY_URL_ACTUAL.includes("?") ? "&" : "?") + "onboarding=true"
        : GATEWAY_URL_ACTUAL;
      mainWindow.loadURL(url);

      // Inject desktop-specific CSS and theme sync after page loads
      mainWindow.webContents.on("did-finish-load", () => {
        mainWindow.webContents.executeJavaScript(`
          (function() {
            // Add CSS for traffic light area and draggable title bar
            const style = document.createElement('style');
            style.textContent = \`
              /* Topbar is the window drag region */
              .topbar { -webkit-app-region: drag; padding-left: 80px !important; }
              /* All interactive content inside topbar = clickable, not draggable */
              .topbar * { -webkit-app-region: no-drag; }
              /* Setup wizard overlay must not be blocked by topbar drag */
              .setup-wizard, .setup-wizard * { -webkit-app-region: no-drag; }
              /* Leave room for traffic lights in nav */
              .nav { padding-top: 40px !important; }
            \`;
            document.head.appendChild(style);

            // Sync Electron window background color when theme changes
            const syncBg = () => {
              const theme = document.documentElement.getAttribute('data-theme');
              const bg = theme === 'light' ? '#f5f5f7' : '#0a0a14';
              if (window.desktop && window.desktop.setThemeBg) window.desktop.setThemeBg(bg);
            };
            syncBg();
            const obs = new MutationObserver(syncBg);
            obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
          })();
        `);
      });
    }

    installLaunchAgent();

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

app.on("before-quit", async () => {
  isQuitting = true;
  if (!externalGateway) {
    await stopGateway();
    // Force-kill anything still on the port
    try {
      const { execSync } = require("child_process");
      const portNum = GATEWAY_URL_ACTUAL.match(/:(\d+)/)?.[1];
      if (portNum) execSync(`lsof -ti:${portNum} | xargs kill -9 2>/dev/null || true`);
    } catch {}
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

// Handle Ctrl+C / terminal kill — clean up gateway before exit
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[desktop] Received ${sig}, cleaning up...`);
    isQuitting = true;
    if (gatewayProcess) {
      try {
        gatewayProcess.kill("SIGKILL");
      } catch {}
    }
    try {
      const { execSync } = require("child_process");
      const portNum = GATEWAY_URL_ACTUAL.match(/:(\d+)/)?.[1];
      if (portNum) execSync(`lsof -ti:${portNum} | xargs kill -9 2>/dev/null || true`);
    } catch {}
    app.quit();
  });
}
