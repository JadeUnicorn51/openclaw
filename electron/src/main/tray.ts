import path from "node:path";
import fs from "node:fs";
const electron = require("electron") as typeof import("electron");
const { Menu, Tray, nativeImage } = electron;

export type DesktopTrayOptions = {
  openMainWindow: () => void;
  hideMainWindow: () => void;
  quitApp: () => void;
};

export type DesktopTrayController = {
  destroy: () => void;
};

function resolveTrayIconPath(): string | null {
  const explicit = process.env.OPENCLAW_ELECTRON_TRAY_ICON?.trim();
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }
  const candidate = path.resolve(__dirname, "../../../assets/logo.png");
  return fs.existsSync(candidate) ? candidate : null;
}

export function createDesktopTray(options: DesktopTrayOptions): DesktopTrayController {
  const iconPath = resolveTrayIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  const tray = new Tray(icon);

  tray.setToolTip("PurchaseAI");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open PurchaseAI",
        click: () => options.openMainWindow(),
      },
      {
        label: "Hide Window",
        click: () => options.hideMainWindow(),
      },
      {
        type: "separator",
      },
      {
        label: "Quit",
        click: () => options.quitApp(),
      },
    ]),
  );
  tray.on("click", () => options.openMainWindow());

  return {
    destroy: () => tray.destroy(),
  };
}
