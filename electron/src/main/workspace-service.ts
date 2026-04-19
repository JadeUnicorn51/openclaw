import fs from "node:fs";
import path from "node:path";

export type DesktopWorkspace = {
  id: string;
  name: string;
  path: string;
  createdAtMs: number;
  updatedAtMs: number;
};

type WorkspaceState = {
  activeWorkspaceId: string;
  workspaces: DesktopWorkspace[];
};

export type DesktopWorkspaceSummary = {
  activeWorkspaceId: string;
  workspaces: DesktopWorkspace[];
};

export type DesktopWorkspaceService = {
  list: () => DesktopWorkspaceSummary;
  create: (name: string) => DesktopWorkspace;
  switchTo: (workspaceId: string) => DesktopWorkspace;
  remove: (workspaceId: string) => void;
  resolveActiveWorkspace: () => DesktopWorkspace;
};

export type DesktopWorkspaceServiceOptions = {
  stateDir: string;
  legacyWorkspaceDir?: string;
  onActiveWorkspaceChanged: (workspace: DesktopWorkspace) => void;
};

const WORKSPACES_ROOT_NAME = "workspaces";
const WORKSPACES_STATE_FILE_NAME = "workspaces.json";
const DEFAULT_WORKSPACE_ID = "default";
const DEFAULT_WORKSPACE_NAME = "Default Workspace";
const WORKSPACE_ID_REGEX = /^[a-z0-9][a-z0-9-]{1,62}$/;

function resolveWorkspacesRoot(stateDir: string): string {
  return path.join(stateDir, WORKSPACES_ROOT_NAME);
}

function resolveWorkspacesStatePath(stateDir: string): string {
  return path.join(resolveWorkspacesRoot(stateDir), WORKSPACES_STATE_FILE_NAME);
}

function normalizeWorkspaceName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Workspace name is required");
  }
  return trimmed;
}

function slugifyWorkspaceId(input: string): string {
  const normalized = input.trim().toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  const nextId = slug.length >= 2 ? slug : `ws-${Date.now().toString(36)}`;
  if (!WORKSPACE_ID_REGEX.test(nextId)) {
    return `ws-${Date.now().toString(36)}`;
  }
  return nextId;
}

function ensureWorkspaceScaffold(workspacePath: string): void {
  fs.mkdirSync(workspacePath, { recursive: true });
  for (const relativeDir of ["files", "chunks", "agents", "skills"]) {
    fs.mkdirSync(path.join(workspacePath, relativeDir), { recursive: true });
  }
  const configPath = path.join(workspacePath, "config.json");
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, "{}\n", "utf8");
  }
  const knowledgeDbPath = path.join(workspacePath, "knowledge.db");
  if (!fs.existsSync(knowledgeDbPath)) {
    fs.closeSync(fs.openSync(knowledgeDbPath, "w"));
  }
}

function readWorkspaceState(statePath: string): WorkspaceState | null {
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw) as WorkspaceState;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.workspaces)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeWorkspaceState(statePath: string, state: WorkspaceState): void {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function assertWorkspacePathInRoot(workspacesRoot: string, workspacePath: string): void {
  const resolvedRoot = path.resolve(workspacesRoot);
  const resolvedTarget = path.resolve(workspacePath);
  if (resolvedTarget === resolvedRoot) {
    throw new Error("Refusing to operate on workspaces root");
  }
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Workspace path is outside workspaces root");
  }
}

function findWorkspace(state: WorkspaceState, workspaceId: string): DesktopWorkspace {
  const workspace = state.workspaces.find((entry) => entry.id === workspaceId);
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
  return workspace;
}

function initializeState(
  workspacesRoot: string,
  statePath: string,
  legacyWorkspaceDir?: string,
): WorkspaceState {
  const existing = readWorkspaceState(statePath);
  if (existing && existing.workspaces.length > 0) {
    for (const workspace of existing.workspaces) {
      ensureWorkspaceScaffold(workspace.path);
    }
    const hasActive = existing.workspaces.some((workspace) => workspace.id === existing.activeWorkspaceId);
    if (hasActive) {
      return existing;
    }
    return {
      ...existing,
      activeWorkspaceId: existing.workspaces[0]!.id,
    };
  }

  const now = Date.now();
  const defaultWorkspacePath =
    legacyWorkspaceDir && fs.existsSync(legacyWorkspaceDir)
      ? legacyWorkspaceDir
      : path.join(workspacesRoot, DEFAULT_WORKSPACE_ID);
  ensureWorkspaceScaffold(defaultWorkspacePath);
  return {
    activeWorkspaceId: DEFAULT_WORKSPACE_ID,
    workspaces: [
      {
        id: DEFAULT_WORKSPACE_ID,
        name: DEFAULT_WORKSPACE_NAME,
        path: defaultWorkspacePath,
        createdAtMs: now,
        updatedAtMs: now,
      },
    ],
  };
}

export function createDesktopWorkspaceService(
  options: DesktopWorkspaceServiceOptions,
): DesktopWorkspaceService {
  const workspacesRoot = resolveWorkspacesRoot(options.stateDir);
  const statePath = resolveWorkspacesStatePath(options.stateDir);
  fs.mkdirSync(workspacesRoot, { recursive: true });

  let state = initializeState(workspacesRoot, statePath, options.legacyWorkspaceDir);
  writeWorkspaceState(statePath, state);
  options.onActiveWorkspaceChanged(findWorkspace(state, state.activeWorkspaceId));

  const list = (): DesktopWorkspaceSummary => ({
    activeWorkspaceId: state.activeWorkspaceId,
    workspaces: [...state.workspaces],
  });

  const create = (name: string): DesktopWorkspace => {
    const normalizedName = normalizeWorkspaceName(name);
    const idBase = slugifyWorkspaceId(normalizedName);
    let candidateId = idBase;
    let suffix = 2;
    while (state.workspaces.some((workspace) => workspace.id === candidateId)) {
      candidateId = `${idBase}-${suffix}`;
      suffix += 1;
    }
    const now = Date.now();
    const workspacePath = path.join(workspacesRoot, candidateId);
    ensureWorkspaceScaffold(workspacePath);
    const workspace: DesktopWorkspace = {
      id: candidateId,
      name: normalizedName,
      path: workspacePath,
      createdAtMs: now,
      updatedAtMs: now,
    };
    state = {
      ...state,
      workspaces: [...state.workspaces, workspace],
    };
    writeWorkspaceState(statePath, state);
    return workspace;
  };

  const switchTo = (workspaceId: string): DesktopWorkspace => {
    const workspace = findWorkspace(state, workspaceId);
    if (state.activeWorkspaceId === workspaceId) {
      return workspace;
    }
    state = {
      ...state,
      activeWorkspaceId: workspaceId,
      workspaces: state.workspaces.map((entry) =>
        entry.id === workspaceId
          ? {
              ...entry,
              updatedAtMs: Date.now(),
            }
          : entry,
      ),
    };
    writeWorkspaceState(statePath, state);
    const nextWorkspace = findWorkspace(state, workspaceId);
    options.onActiveWorkspaceChanged(nextWorkspace);
    return nextWorkspace;
  };

  const remove = (workspaceId: string): void => {
    if (state.activeWorkspaceId === workspaceId) {
      throw new Error("Cannot delete the active workspace");
    }
    if (state.workspaces.length <= 1) {
      throw new Error("Cannot delete the last workspace");
    }
    const workspace = findWorkspace(state, workspaceId);
    assertWorkspacePathInRoot(workspacesRoot, workspace.path);
    fs.rmSync(workspace.path, { recursive: true, force: false });
    state = {
      ...state,
      workspaces: state.workspaces.filter((entry) => entry.id !== workspaceId),
    };
    writeWorkspaceState(statePath, state);
  };

  const resolveActiveWorkspace = (): DesktopWorkspace => findWorkspace(state, state.activeWorkspaceId);

  return {
    list,
    create,
    switchTo,
    remove,
    resolveActiveWorkspace,
  };
}
