const electron = require("electron") as typeof import("electron");
const { Menu } = electron;

export type DesktopMenuOptions = {
  openMainWindow: () => void;
  quitApp: () => void;
};

export function installDesktopMenu(options: DesktopMenuOptions): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "PurchaseAI",
      submenu: [
        {
          label: "Open PurchaseAI",
          click: () => options.openMainWindow(),
        },
        {
          type: "separator",
        },
        {
          role: "quit",
          click: () => options.quitApp(),
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        {
          role: "minimize",
        },
        {
          role: "close",
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
