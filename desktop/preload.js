/* eslint-disable */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  isDesktop: true,
  isOnboarding: process.env.OPENCLAW_ONBOARDING === "1",
  onboardingDone: () => ipcRenderer.send("onboarding-done"),
  setThemeBg: (color) => ipcRenderer.send("theme-bg-change", color),
});
