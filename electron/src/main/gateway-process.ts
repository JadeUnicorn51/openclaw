import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

export type GatewayProcessController = {
  child: ChildProcess;
  stop: () => Promise<void>;
};

const DEFAULT_GATEWAY_PORT = 18789;

function resolveRepoRoot(): string {
  return path.resolve(__dirname, "../../..");
}

function resolveGatewayEntryPath(): string {
  return path.join(resolveRepoRoot(), "openclaw.mjs");
}

function resolveNodeCommand(): string {
  const explicit = process.env.OPENCLAW_ELECTRON_NODE_PATH?.trim();
  if (explicit) {
    return explicit;
  }
  const npmNode = process.env.npm_node_execpath?.trim();
  if (npmNode) {
    return npmNode;
  }
  return "node";
}

function resolveGatewayArgs(): string[] {
  return [
    resolveGatewayEntryPath(),
    "gateway",
    "run",
    "--bind",
    "loopback",
    "--port",
    String(DEFAULT_GATEWAY_PORT),
    "--force",
  ];
}

export function resolveDashboardUrl(): string {
  return process.env.OPENCLAW_ELECTRON_DASHBOARD_URL?.trim() || "http://127.0.0.1:18789/";
}

export function shouldManageGateway(): boolean {
  const value = process.env.OPENCLAW_ELECTRON_MANAGE_GATEWAY?.trim().toLowerCase();
  if (!value) {
    return true;
  }
  return value !== "0" && value !== "false" && value !== "off";
}

export function startGatewayProcess(): GatewayProcessController | null {
  if (!shouldManageGateway()) {
    return null;
  }

  const child = spawn(resolveNodeCommand(), resolveGatewayArgs(), {
    cwd: resolveRepoRoot(),
    stdio: "inherit",
    env: {
      ...process.env,
      OPENCLAW_ELECTRON_EMBEDDED_GATEWAY: "1",
      OPENCLAW_SKIP_CHANNELS: "1",
    },
  });

  return {
    child,
    stop: async () => {
      if (child.killed || child.exitCode !== null) {
        return;
      }
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        setTimeout(() => {
          if (!child.killed && child.exitCode === null) {
            child.kill("SIGKILL");
          }
        }, 5_000);
      });
    },
  };
}
