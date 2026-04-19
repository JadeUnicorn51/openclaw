import { describe, expect, it } from "vitest";
import { resolveDesktopStartupOptions } from "./startup-options.js";

describe("resolveDesktopStartupOptions", () => {
  it("uses defaults when no flags are provided", () => {
    const options = resolveDesktopStartupOptions(["electron", "."], {});
    expect(options).toEqual({
      startHidden: false,
      disableTray: false,
      minimizeToTray: true,
    });
  });

  it("reads command-line switches", () => {
    const options = resolveDesktopStartupOptions(
      ["electron", ".", "--start-hidden", "--disable-tray", "--minimize-to-tray"],
      {},
    );
    expect(options).toEqual({
      startHidden: true,
      disableTray: true,
      minimizeToTray: false,
    });
  });

  it("supports disabling minimize-to-tray explicitly", () => {
    const options = resolveDesktopStartupOptions(["electron", ".", "--no-minimize-to-tray"], {});
    expect(options.minimizeToTray).toBe(false);
  });

  it("reads environment switches", () => {
    const options = resolveDesktopStartupOptions(["electron", "."], {
      OPENCLAW_ELECTRON_START_HIDDEN: "1",
      OPENCLAW_ELECTRON_MINIMIZE_TO_TRAY: "false",
    });
    expect(options).toEqual({
      startHidden: true,
      disableTray: false,
      minimizeToTray: false,
    });
  });
});
