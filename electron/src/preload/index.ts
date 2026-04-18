import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const electron = require("electron") as typeof import("electron");
const { contextBridge } = electron;

function resolveConfigPath(): string {
  const explicit = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (explicit) {
    return explicit;
  }
  return path.join(os.homedir(), ".openclaw", "openclaw.json");
}

function resolveGatewayTokenFromConfig(): string | null {
  const envToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }
  try {
    const raw = fs.readFileSync(resolveConfigPath(), "utf8");
    const parsed = JSON.parse(raw) as {
      gateway?: {
        auth?: {
          token?: unknown;
        };
      };
    };
    const token = parsed.gateway?.auth?.token;
    return typeof token === "string" && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

function resolveGatewayTokenScopes(): string[] {
  if (typeof location === "undefined" || !location.host) {
    return [];
  }
  const wsProtocol =
    location.protocol === "https:"
      ? "wss:"
      : location.protocol === "http:"
        ? "ws:"
        : null;
  if (!wsProtocol) {
    return [];
  }
  const normalizedPath =
    location.pathname === "/" ? "" : location.pathname.replace(/\/+$/, "") || location.pathname;
  const scopes = [`${wsProtocol}//${location.host}`];
  if (normalizedPath) {
    scopes.push(`${wsProtocol}//${location.host}${normalizedPath}`);
  }
  return scopes;
}

function seedGatewayTokenSessionStorage(token: string | null): void {
  if (!token || typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return;
  }
  for (const scope of resolveGatewayTokenScopes()) {
    window.sessionStorage.setItem(`openclaw.control.token.v1:${scope}`, token);
  }
}

const gatewayToken = resolveGatewayTokenFromConfig();
seedGatewayTokenSessionStorage(gatewayToken);

contextBridge.exposeInMainWorld("openclawDesktop", {
  isDesktop: true,
  platform: process.platform,
  gatewayToken,
});

declare global {
  interface Window {
    openclawDesktop?: {
      isDesktop: boolean;
      platform: string;
      gatewayToken?: string | null;
    };
  }
}
