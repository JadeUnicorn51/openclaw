/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { ThemeMode, ThemeName } from "../theme.ts";
import { renderQuickSettings, type QuickSettingsProps } from "./config-quick.ts";

function baseProps(): QuickSettingsProps {
  return {
    currentModel: "gpt-5.4",
    thinkingLevel: "medium",
    fastMode: false,
    onModelChange: vi.fn(),
    onThinkingChange: vi.fn(),
    onFastModeToggle: vi.fn(),
    channels: [],
    onChannelConfigure: vi.fn(),
    apiKeys: [],
    onApiKeyChange: vi.fn(),
    automation: {
      cronJobCount: 0,
      skillCount: 0,
      mcpServerCount: 0,
    },
    onManageCron: vi.fn(),
    onBrowseSkills: vi.fn(),
    onConfigureMcp: vi.fn(),
    security: {
      gatewayAuth: "token",
      execPolicy: "allowlist",
      deviceAuth: true,
    },
    onSecurityConfigure: vi.fn(),
    theme: "claw" as ThemeName,
    themeMode: "system" as ThemeMode,
    borderRadius: 50,
    setTheme: vi.fn(),
    setThemeMode: vi.fn(),
    setBorderRadius: vi.fn(),
    configObject: {},
    onApplyPreset: vi.fn(),
    onAdvancedSettings: vi.fn(),
    desktopSetup: null,
    workspaceManagement: null,
    connected: true,
    gatewayUrl: "ws://127.0.0.1:18789",
    assistantName: "OpenClaw",
    version: "2026.4.16",
  };
}

describe("quick settings", () => {
  it("renders the desktop setup checklist when provided", () => {
    const container = document.createElement("div");
    render(
      renderQuickSettings({
        ...baseProps(),
        desktopSetup: {
          title: "Desktop Setup Checklist",
          summary: "Finish the remaining setup tasks before rollout.",
          completedCount: 1,
          totalCount: 3,
          steps: [
            {
              id: "models",
              label: "Configure Models",
              description: "Add a provider key.",
              status: "active",
              actionLabel: "Open AI & Agents",
              onAction: vi.fn(),
            },
          ],
        },
      }),
      container,
    );

    const banner = container.querySelector('[data-testid="desktop-setup-card"]');
    expect(banner).not.toBeNull();
    expect(container.textContent).toContain("Desktop Setup Checklist");
    expect(container.textContent).toContain("1/3 complete");
    expect(container.textContent).toContain("Open AI & Agents");
  });

  it("renders workspace management when provided", () => {
    const container = document.createElement("div");
    render(
      renderQuickSettings({
        ...baseProps(),
        workspaceManagement: {
          loading: false,
          error: null,
          notice: "Workspace switched. Restart required.",
          activeWorkspaceId: "default",
          workspaces: [
            {
              id: "default",
              name: "Default Workspace",
              path: "C:/Users/test/.purchaseai-desktop/workspaces/default",
              createdAtMs: Date.now(),
              updatedAtMs: Date.now(),
            },
          ],
          createName: "",
          busyWorkspaceId: null,
          onCreateNameChange: vi.fn(),
          onRefresh: vi.fn(),
          onCreate: vi.fn(),
          onSwitch: vi.fn(),
          onDelete: vi.fn(),
          onRestart: vi.fn(),
        },
      }),
      container,
    );

    const card = container.querySelector('[data-testid="workspace-management-card"]');
    expect(card).not.toBeNull();
    expect(container.textContent).toContain("Workspaces");
    expect(container.textContent).toContain("Default Workspace");
    expect(container.textContent).toContain("Restart App");
  });
});
