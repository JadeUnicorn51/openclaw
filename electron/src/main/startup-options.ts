export type DesktopStartupOptions = {
  startHidden: boolean;
  disableTray: boolean;
  minimizeToTray: boolean;
};

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

function hasFlag(argv: readonly string[], flag: string): boolean {
  return argv.includes(flag);
}

function resolveMinimizeToTray(argv: readonly string[], env: NodeJS.ProcessEnv, disableTray: boolean): boolean {
  if (disableTray) {
    return false;
  }
  if (hasFlag(argv, "--no-minimize-to-tray")) {
    return false;
  }
  if (hasFlag(argv, "--minimize-to-tray")) {
    return true;
  }
  const explicit = env.OPENCLAW_ELECTRON_MINIMIZE_TO_TRAY;
  if (typeof explicit === "string") {
    return isTruthy(explicit);
  }
  return true;
}

export function resolveDesktopStartupOptions(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
): DesktopStartupOptions {
  const startHidden = hasFlag(argv, "--start-hidden") || isTruthy(env.OPENCLAW_ELECTRON_START_HIDDEN);
  const disableTray = hasFlag(argv, "--disable-tray") || isTruthy(env.OPENCLAW_ELECTRON_DISABLE_TRAY);
  const minimizeToTray = resolveMinimizeToTray(argv, env, disableTray);
  return {
    startHidden,
    disableTray,
    minimizeToTray,
  };
}
