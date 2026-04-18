import path from "node:path";
const electron = require("electron") as typeof import("electron");
const { BrowserWindow, shell } = electron;
type ElectronBrowserWindow = InstanceType<typeof BrowserWindow>;

const RETRY_DELAY_MS = 1_000;
const BOOTSTRAP_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PurchaseAI</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, rgba(214, 167, 74, 0.2), transparent 38%),
          linear-gradient(180deg, #15181c 0%, #0d0f12 100%);
        color: #f5f0e7;
      }
      main {
        width: min(460px, calc(100vw - 48px));
        padding: 32px 28px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        background: rgba(10, 12, 15, 0.84);
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.35);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
        font-weight: 650;
      }
      p {
        margin: 0;
        line-height: 1.6;
        color: rgba(245, 240, 231, 0.78);
      }
      .accent {
        display: inline-block;
        margin-bottom: 16px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(214, 167, 74, 0.16);
        color: #f1d18a;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="accent">Desktop bootstrap</div>
      <h1>PurchaseAI is starting</h1>
      <p>The local gateway is warming up. The desktop shell will connect automatically once the service is ready.</p>
    </main>
  </body>
</html>`;

export type MainWindowOptions = {
  dashboardUrl: string;
  preloadPath: string;
};

function isTrustedWindowUrl(url: string, dashboardUrl: string): boolean {
  if (url.startsWith("data:")) {
    return true;
  }
  try {
    const nextUrl = new URL(url);
    const allowedUrl = new URL(dashboardUrl);
    return nextUrl.origin === allowedUrl.origin;
  } catch {
    return false;
  }
}

function shouldLogDesktopBootstrapDebug(): boolean {
  const value = process.env.OPENCLAW_ELECTRON_DEBUG_BOOTSTRAP?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "on";
}

function attachDesktopBootstrapDebug(window: ElectronBrowserWindow): void {
  if (!shouldLogDesktopBootstrapDebug()) {
    return;
  }

  const logSnapshot = (label: string) => {
    void window.webContents
      .executeJavaScript(
        `(() => {
          const readSessionStorage = () => {
            try {
              return Object.keys(window.sessionStorage)
                .filter((key) => key.startsWith("openclaw.control"))
                .reduce((acc, key) => ({ ...acc, [key]: window.sessionStorage.getItem(key) }), {});
            } catch {
              return null;
            }
          };
          const app = document.querySelector("openclaw-app");
          return JSON.stringify({
            href: window.location.href,
            openclawDesktop: window.openclawDesktop ?? null,
            sessionStorage: readSessionStorage(),
            appState: app
              ? {
                  connected: app.connected ?? null,
                  lastError: app.lastError ?? null,
                  lastErrorCode: app.lastErrorCode ?? null,
                  hello: app.hello ?? null,
                  gatewayUrl: app.settings?.gatewayUrl ?? null,
                  tokenLength: typeof app.settings?.token === "string" ? app.settings.token.length : null,
                  clientConnected: app.client?.connected ?? null,
                  hasClient: Boolean(app.client),
                  connectGeneration: app.connectGeneration ?? null,
                  clientState: app.client
                    ? {
                        pendingSize: app.client.pending?.size ?? null,
                        connectSent: app.client.connectSent ?? null,
                        connectNonce: app.client.connectNonce ?? null,
                        lastSeq: app.client.lastSeq ?? null,
                        pendingConnectError: app.client.pendingConnectError ?? null,
                        optsTokenLength:
                          typeof app.client.opts?.token === "string" ? app.client.opts.token.length : null,
                      }
                    : null,
                }
              : null,
          });
        })()`,
        true,
      )
      .then((value) => {
        console.error(`[desktop-bootstrap:${label}] ${value}`);
      })
      .catch((error) => {
        console.error(`[desktop-bootstrap:${label}] failed: ${String(error)}`);
      });
  };

  window.webContents.on("did-finish-load", () => {
    logSnapshot("load");
    setTimeout(() => {
      if (window.isDestroyed()) {
        return;
      }
      logSnapshot("load+5000ms");
    }, 5_000);
  });
}

function resolveBootstrapPageUrl(): string {
  return `data:text/html;charset=UTF-8,${encodeURIComponent(BOOTSTRAP_PAGE)}`;
}

function attachDashboardRetryLoop(
  window: ElectronBrowserWindow,
  dashboardUrl: string,
): void {
  let retryTimer: NodeJS.Timeout | null = null;
  let dashboardLoaded = false;

  const clearRetry = () => {
    if (!retryTimer) {
      return;
    }
    clearTimeout(retryTimer);
    retryTimer = null;
  };

  const scheduleRetry = () => {
    if (dashboardLoaded || window.isDestroyed() || retryTimer) {
      return;
    }
    retryTimer = setTimeout(() => {
      retryTimer = null;
      loadDashboard();
    }, RETRY_DELAY_MS);
  };

  const loadDashboard = () => {
    if (dashboardLoaded || window.isDestroyed()) {
      return;
    }
    void window.webContents.loadURL(dashboardUrl).then(
      () => {
        dashboardLoaded = true;
        clearRetry();
      },
      () => {
        scheduleRetry();
      },
    );
  };

  window.on("closed", clearRetry);

  window.webContents.on("did-fail-load", (_event, _errorCode, _errorDescription, url, isMainFrame) => {
    if (dashboardLoaded || !isMainFrame || url.startsWith("data:")) {
      return;
    }
    scheduleRetry();
  });

  void window.webContents.loadURL(resolveBootstrapPageUrl()).finally(() => {
    loadDashboard();
  });
}

export function createMainWindow(options: MainWindowOptions): ElectronBrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#111111",
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      // The desktop preload seeds local gateway auth from on-disk config and
      // exposes a narrow bridge to the Control UI, which requires the
      // non-sandboxed preload environment.
      sandbox: false,
      spellcheck: false,
    },
    title: "PurchaseAI",
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedWindowUrl(url, options.dashboardUrl)) {
      void shell.openExternal(url);
      return { action: "deny" };
    }
    void window.webContents.loadURL(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isTrustedWindowUrl(url, options.dashboardUrl)) {
      return;
    }
    event.preventDefault();
    void shell.openExternal(url);
  });

  attachDashboardRetryLoop(window, options.dashboardUrl);
  attachDesktopBootstrapDebug(window);

  return window;
}

export function resolvePreloadPath(): string {
  return path.join(__dirname, "../preload/index.js");
}
