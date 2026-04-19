import type { DesktopWorkspaceService } from "./workspace-service.js";
const electron = require("electron") as typeof import("electron");
const { ipcMain, shell } = electron;
type ElectronBrowserWindow = InstanceType<typeof electron.BrowserWindow>;

export type DesktopIpcHandlersOptions = {
  getMainWindow: () => ElectronBrowserWindow | null;
  quitApp: () => void;
  workspaceService: () => DesktopWorkspaceService | null;
};

function resolveMainWindow(getMainWindow: () => ElectronBrowserWindow | null): ElectronBrowserWindow {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) {
    throw new Error("Desktop window is not available");
  }
  return window;
}

function normalizeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function installDesktopIpcHandlers(options: DesktopIpcHandlersOptions): () => void {
  const handleShow = () => {
    const window = resolveMainWindow(options.getMainWindow);
    if (window.isMinimized()) {
      window.restore();
    }
    if (!window.isVisible()) {
      window.show();
    }
    window.focus();
  };

  const handleHide = () => {
    resolveMainWindow(options.getMainWindow).hide();
  };

  const handleVisible = () => resolveMainWindow(options.getMainWindow).isVisible();

  const handleOpenExternal = async (_event: unknown, rawUrl: unknown) => {
    const nextUrl = normalizeExternalUrl(rawUrl);
    if (!nextUrl) {
      throw new Error("Invalid external URL");
    }
    await shell.openExternal(nextUrl);
  };

  const handleQuit = () => {
    options.quitApp();
  };

  const handleWorkspaceList = () => {
    const service = options.workspaceService();
    if (!service) {
      throw new Error("Workspace service is not available");
    }
    return service.list();
  };

  const handleWorkspaceCreate = (_event: unknown, name: unknown) => {
    if (typeof name !== "string") {
      throw new Error("Workspace name is required");
    }
    const service = options.workspaceService();
    if (!service) {
      throw new Error("Workspace service is not available");
    }
    return service.create(name);
  };

  const handleWorkspaceSwitch = (_event: unknown, workspaceId: unknown) => {
    if (typeof workspaceId !== "string" || !workspaceId.trim()) {
      throw new Error("Workspace id is required");
    }
    const service = options.workspaceService();
    if (!service) {
      throw new Error("Workspace service is not available");
    }
    const workspace = service.switchTo(workspaceId);
    return {
      workspace,
      requiresRestart: true,
    };
  };

  const handleWorkspaceDelete = (_event: unknown, workspaceId: unknown) => {
    if (typeof workspaceId !== "string" || !workspaceId.trim()) {
      throw new Error("Workspace id is required");
    }
    const service = options.workspaceService();
    if (!service) {
      throw new Error("Workspace service is not available");
    }
    service.remove(workspaceId);
    return service.list();
  };

  ipcMain.handle("desktop.window.show", handleShow);
  ipcMain.handle("desktop.window.hide", handleHide);
  ipcMain.handle("desktop.window.isVisible", handleVisible);
  ipcMain.handle("desktop.shell.openExternal", handleOpenExternal);
  ipcMain.handle("desktop.app.quit", handleQuit);
  ipcMain.handle("desktop.workspace.list", handleWorkspaceList);
  ipcMain.handle("desktop.workspace.create", handleWorkspaceCreate);
  ipcMain.handle("desktop.workspace.switch", handleWorkspaceSwitch);
  ipcMain.handle("desktop.workspace.delete", handleWorkspaceDelete);

  return () => {
    ipcMain.removeHandler("desktop.window.show");
    ipcMain.removeHandler("desktop.window.hide");
    ipcMain.removeHandler("desktop.window.isVisible");
    ipcMain.removeHandler("desktop.shell.openExternal");
    ipcMain.removeHandler("desktop.app.quit");
    ipcMain.removeHandler("desktop.workspace.list");
    ipcMain.removeHandler("desktop.workspace.create");
    ipcMain.removeHandler("desktop.workspace.switch");
    ipcMain.removeHandler("desktop.workspace.delete");
  };
}
