const electron = require("electron") as typeof import("electron");
import {
  resolveDashboardUrl,
  startGatewayProcess,
  type GatewayProcessController,
} from "./gateway-process.js";
import { prepareDesktopBootstrapState } from "./bootstrap-service.js";
import { createMainWindow, resolvePreloadPath } from "./window.js";

const { app, BrowserWindow } = electron;
type ElectronBrowserWindow = InstanceType<typeof BrowserWindow>;

let mainWindow: ElectronBrowserWindow | null = null;
let gatewayController: GatewayProcessController | null = null;

function openMainWindow() {
  mainWindow = createMainWindow({
    dashboardUrl: resolveDashboardUrl(),
    preloadPath: resolvePreloadPath(),
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function shutdownGateway() {
  const controller = gatewayController;
  gatewayController = null;
  if (!controller) {
    return;
  }
  await controller.stop();
}

void app.whenReady().then(() => {
  prepareDesktopBootstrapState();
  gatewayController = startGatewayProcess();
  openMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });
});

app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    await shutdownGateway();
    app.quit();
  }
});

app.on("before-quit", async () => {
  await shutdownGateway();
});
