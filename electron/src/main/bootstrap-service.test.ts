import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareDesktopBootstrapState } from "./bootstrap-service.js";

async function readJsonFile(filePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
}

describe("prepareDesktopBootstrapState", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.OPENCLAW_STATE_DIR;
    delete process.env.OPENCLAW_CONFIG_PATH;
    delete process.env.OPENCLAW_GATEWAY_TOKEN;
    delete process.env.OPENCLAW_WORKSPACE;
  });

  it("creates a dedicated local-mode config for a fresh desktop install", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-desktop-bootstrap-"));
    vi.stubEnv("OPENCLAW_ELECTRON_STATE_DIR", stateDir);

    const state = prepareDesktopBootstrapState();
    const config = await readJsonFile(state.configPath);

    expect(state.stateDir).toBe(stateDir);
    expect(state.workspaceDir).toBe(path.join(stateDir, "workspace"));
    expect(config).toMatchObject({
      agents: {
        defaults: {
          workspace: path.join(stateDir, "workspace"),
        },
      },
      gateway: {
        mode: "local",
        auth: {
          mode: "token",
          token: state.gatewayToken,
        },
      },
    });
    expect(process.env.OPENCLAW_STATE_DIR).toBe(stateDir);
    expect(process.env.OPENCLAW_CONFIG_PATH).toBe(state.configPath);
    expect(process.env.OPENCLAW_GATEWAY_TOKEN).toBe(state.gatewayToken);
    expect(process.env.OPENCLAW_WORKSPACE).toBe(state.workspaceDir);
  });

  it("repairs an existing desktop config that is missing gateway.mode", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-desktop-bootstrap-"));
    const configPath = path.join(stateDir, "openclaw.json");
    const existingToken = "desktop-token";
    await fs.writeFile(
      configPath,
      JSON.stringify({
        gateway: {
          auth: {
            mode: "token",
            token: existingToken,
          },
        },
      }),
      "utf8",
    );
    vi.stubEnv("OPENCLAW_ELECTRON_STATE_DIR", stateDir);

    const state = prepareDesktopBootstrapState();
    const config = await readJsonFile(state.configPath);

    expect(state.gatewayToken).toBe(existingToken);
    expect(config).toMatchObject({
      agents: {
        defaults: {
          workspace: path.join(stateDir, "workspace"),
        },
      },
      gateway: {
        mode: "local",
        auth: {
          mode: "token",
          token: existingToken,
        },
      },
    });
  });
});
