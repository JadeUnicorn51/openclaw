import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDesktopWorkspaceService } from "./workspace-service.js";

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

describe("createDesktopWorkspaceService", () => {
  it("initializes a default workspace scaffold", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-workspaces-"));
    let activePath: string | null = null;
    const service = createDesktopWorkspaceService({
      stateDir,
      onActiveWorkspaceChanged: (workspace) => {
        activePath = workspace.path;
      },
    });

    const summary = service.list();
    expect(summary.workspaces).toHaveLength(1);
    expect(summary.activeWorkspaceId).toBe("default");
    expect(activePath).toBe(summary.workspaces[0]?.path ?? null);

    const defaultPath = summary.workspaces[0]!.path;
    expect(await exists(path.join(defaultPath, "config.json"))).toBe(true);
    expect(await exists(path.join(defaultPath, "knowledge.db"))).toBe(true);
    expect(await exists(path.join(defaultPath, "files"))).toBe(true);
    expect(await exists(path.join(defaultPath, "chunks"))).toBe(true);
    expect(await exists(path.join(defaultPath, "agents"))).toBe(true);
    expect(await exists(path.join(defaultPath, "skills"))).toBe(true);
  });

  it("creates and switches workspaces", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-workspaces-"));
    const switches: string[] = [];
    const service = createDesktopWorkspaceService({
      stateDir,
      onActiveWorkspaceChanged: (workspace) => {
        switches.push(workspace.id);
      },
    });

    const created = service.create("Procurement Team A");
    expect(created.id).toMatch(/^procurement-team-a/);
    expect((await fs.stat(created.path)).isDirectory()).toBe(true);

    service.switchTo(created.id);
    expect(service.list().activeWorkspaceId).toBe(created.id);
    expect(switches).toContain(created.id);
  });

  it("rejects deleting the active workspace", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-workspaces-"));
    const service = createDesktopWorkspaceService({
      stateDir,
      onActiveWorkspaceChanged: () => {},
    });

    expect(() => service.remove("default")).toThrow("Cannot delete the active workspace");
  });

  it("deletes a non-active workspace", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-workspaces-"));
    const service = createDesktopWorkspaceService({
      stateDir,
      onActiveWorkspaceChanged: () => {},
    });
    const created = service.create("Archive Workspace");
    expect(await exists(created.path)).toBe(true);

    service.remove(created.id);
    expect(await exists(created.path)).toBe(false);
    expect(service.list().workspaces.some((entry) => entry.id === created.id)).toBe(false);
  });
});
