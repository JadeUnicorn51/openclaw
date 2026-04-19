/* @vitest-environment jsdom */

import { render } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "../../i18n/index.ts";
import { getSafeLocalStorage } from "../../local-storage.ts";
import { renderOverview, type OverviewProps } from "./overview.ts";

function createOverviewProps(overrides: Partial<OverviewProps> = {}): OverviewProps {
  return {
    warnQueryToken: false,
    connected: false,
    hello: null,
    settings: {
      gatewayUrl: "",
      token: "",
      sessionKey: "main",
      lastActiveSessionKey: "main",
      theme: "claw",
      themeMode: "system",
      chatFocusMode: false,
      chatShowThinking: true,
      chatShowToolCalls: true,
      splitRatio: 0.6,
      navCollapsed: false,
      navWidth: 220,
      navGroupsCollapsed: {},
      borderRadius: 50,
      locale: "en",
    },
    password: "",
    lastError: null,
    lastErrorCode: null,
    presenceCount: 0,
    sessionsCount: null,
    cronEnabled: null,
    cronNext: null,
    lastChannelsRefresh: null,
    modelAuthStatus: null,
    usageResult: null,
    sessionsResult: null,
    skillsReport: null,
    cronJobs: [],
    cronStatus: null,
    attentionItems: [],
    eventLog: [],
    overviewLogLines: [],
    showGatewayToken: false,
    showGatewayPassword: false,
    onSettingsChange: () => undefined,
    onPasswordChange: () => undefined,
    onSessionKeyChange: () => undefined,
    onToggleGatewayTokenVisibility: () => undefined,
    onToggleGatewayPasswordVisibility: () => undefined,
    onConnect: () => undefined,
    onRefresh: () => undefined,
    onNavigate: () => undefined,
    onRefreshLogs: () => undefined,
    workspaceSummary: null,
    workspaceLoading: false,
    workspaceError: null,
    onOpenWorkspaceSettings: () => undefined,
    onRestartDesktop: () => undefined,
    ...overrides,
  };
}

function setDesktopSetupState(value: Window["openclawDesktop"] | undefined) {
  if (value == null) {
    delete window.openclawDesktop;
    return;
  }
  Object.defineProperty(window, "openclawDesktop", {
    value,
    writable: true,
    configurable: true,
  });
}

describe("overview view rendering", () => {
  afterEach(() => {
    setDesktopSetupState(undefined);
  });

  it("keeps the persisted overview locale selected before i18n hydration finishes", async () => {
    const container = document.createElement("div");
    const props = createOverviewProps({
      settings: {
        ...createOverviewProps().settings,
        locale: "zh-CN",
      },
    });

    getSafeLocalStorage()?.clear();
    await i18n.setLocale("en");

    render(renderOverview(props), container);
    await Promise.resolve();

    let select = container.querySelector<HTMLSelectElement>("select");
    expect(i18n.getLocale()).toBe("en");
    expect(select?.value).toBe("zh-CN");
    expect(select?.selectedOptions[0]?.textContent?.trim()).toBe("简体中文 (Simplified Chinese)");

    await i18n.setLocale("zh-CN");
    render(renderOverview(props), container);
    await Promise.resolve();

    select = container.querySelector<HTMLSelectElement>("select");
    expect(select?.value).toBe("zh-CN");
    expect(select?.selectedOptions[0]?.textContent?.trim()).toBe("简体中文 (简体中文)");

    await i18n.setLocale("en");
  });

  it("renders the desktop setup card when the embedded desktop app still needs setup", async () => {
    const container = document.createElement("div");
    setDesktopSetupState({
      isDesktop: true,
      platform: "win32",
      gatewayToken: "desktop-token",
      configPath: "C:/PurchaseAI/openclaw.json",
      stateDir: "C:/PurchaseAI",
      workspaceDir: "C:/PurchaseAI/workspace",
      needsSetup: true,
    });

    render(renderOverview(createOverviewProps()), container);
    await Promise.resolve();

    expect(container.querySelector('[data-testid="desktop-setup-card"]')?.textContent).toContain(
      "Finish Desktop Setup",
    );
    expect(container.textContent).toContain("C:/PurchaseAI/workspace");
    expect(container.textContent).toContain("Configure Models");
  });

  it("renders active workspace summary when provided", async () => {
    const container = document.createElement("div");
    setDesktopSetupState({
      isDesktop: true,
      platform: "win32",
      gatewayToken: "desktop-token",
      configPath: "C:/PurchaseAI/openclaw.json",
      stateDir: "C:/PurchaseAI",
      workspaceDir: "C:/PurchaseAI/workspace",
      needsSetup: true,
    });

    render(
      renderOverview(
        createOverviewProps({
          workspaceSummary: {
            activeWorkspaceId: "project-a",
            workspaces: [
              {
                id: "project-a",
                name: "Project A",
                path: "C:/PurchaseAI/workspaces/project-a",
                createdAtMs: Date.now(),
                updatedAtMs: Date.now(),
              },
            ],
          },
        }),
      ),
      container,
    );
    await Promise.resolve();

    expect(container.textContent).toContain("Workspace Summary");
    expect(container.textContent).toContain("Project A");
    expect(container.textContent).toContain("Open Workspace Settings");
  });
});
