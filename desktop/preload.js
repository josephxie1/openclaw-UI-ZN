/* eslint-disable */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  isDesktop: true,
  isOnboarding: process.env.OPENCLAW_ONBOARDING === "1",
});
