const electron = require("electron") as typeof import("electron");
import {
  resolveDashboardUrl,
  startGatewayProcess,
  type GatewayProcessController,
} from "./gateway-process.js";
import { prepareDesktopBootstrapState, syncDesktopWorkspaceConfig } from "./bootstrap-service.js";
import { createMainWindow, resolvePreloadPath } from "./window.js";
import { resolveDesktopStartupOptions } from "./startup-options.js";
import { createDesktopTray, type DesktopTrayController } from "./tray.js";
import { installDesktopMenu } from "./menu.js";
import { installDesktopIpcHandlers } from "./ipc-handlers.js";
import { createDesktopWorkspaceService, type DesktopWorkspaceService } from "./workspace-service.js";

const { app, BrowserWindow } = electron;
type ElectronBrowserWindow = InstanceType<typeof BrowserWindow>;

let mainWindow: ElectronBrowserWindow | null = null;
let gatewayController: GatewayProcessController | null = null;
let trayController: DesktopTrayController | null = null;
let removeIpcHandlers: (() => void) | null = null;
let isQuitting = false;
let workspaceService: DesktopWorkspaceService | null = null;

const startupOptions = resolveDesktopStartupOptions();

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    openMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.hide();
}

function quitDesktopApp() {
  isQuitting = true;
  app.quit();
}

function openMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    focusMainWindow();
    return;
  }

  mainWindow = createMainWindow({
    dashboardUrl: resolveDashboardUrl(),
    preloadPath: resolvePreloadPath(),
    startHidden: startupOptions.startHidden,
  });

  if (startupOptions.minimizeToTray) {
    mainWindow.on("close", (event) => {
      if (isQuitting) {
        return;
      }
      event.preventDefault();
      mainWindow?.hide();
    });
  }

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
  const bootstrapState = prepareDesktopBootstrapState();
  workspaceService = createDesktopWorkspaceService({
    stateDir: bootstrapState.stateDir,
    legacyWorkspaceDir: bootstrapState.workspaceDir,
    onActiveWorkspaceChanged: (workspace) => {
      const token = syncDesktopWorkspaceConfig(bootstrapState.configPath, workspace.path);
      process.env.OPENCLAW_CONFIG_PATH = bootstrapState.configPath;
      process.env.OPENCLAW_STATE_DIR = bootstrapState.stateDir;
      process.env.OPENCLAW_GATEWAY_TOKEN = token;
      process.env.OPENCLAW_WORKSPACE = workspace.path;
    },
  });
  gatewayController = startGatewayProcess();

  removeIpcHandlers = installDesktopIpcHandlers({
    getMainWindow: () => mainWindow,
    quitApp: quitDesktopApp,
    workspaceService: () => workspaceService,
  });
  installDesktopMenu({
    openMainWindow: focusMainWindow,
    quitApp: quitDesktopApp,
  });

  if (!startupOptions.disableTray) {
    trayController = createDesktopTray({
      openMainWindow: focusMainWindow,
      hideMainWindow,
      quitApp: quitDesktopApp,
    });
  }

  openMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });
});

app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    if (startupOptions.minimizeToTray && !isQuitting) {
      return;
    }
    await shutdownGateway();
    app.quit();
  }
});

app.on("before-quit", async () => {
  isQuitting = true;
  trayController?.destroy();
  trayController = null;
  removeIpcHandlers?.();
  removeIpcHandlers = null;
  await shutdownGateway();
});
