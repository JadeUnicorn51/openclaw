import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withEnvAsync } from "../../test-utils/env.js";
import {
  clearSkillsLicenseState,
  isSkillPackLicensed,
  readSkillsLicenseState,
  resolveLicensedSkillPacks,
  resolveSkillsLicensePath,
  writeSkillsLicenseState,
} from "./license.js";

const tempDirs: string[] = [];

async function makeStateDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skills-license-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("skills license", () => {
  it("writes and reads local license state", async () => {
    const stateDir = await makeStateDir();
    await withEnvAsync({ OPENCLAW_STATE_DIR: stateDir }, async () => {
      const written = await writeSkillsLicenseState({
        key: "KEY-123",
        packs: ["bidding-pro", "cost-pro"],
      });
      expect(written.packs).toEqual(["bidding-pro", "cost-pro"]);
      expect(resolveSkillsLicensePath()).toContain(path.join("license", "skills-license.json"));
      const loaded = await readSkillsLicenseState();
      expect(loaded).not.toBeNull();
      expect(loaded?.packs).toEqual(["bidding-pro", "cost-pro"]);
    });
  });

  it("prefers explicit environment packs over file state", async () => {
    const stateDir = await makeStateDir();
    await withEnvAsync({ OPENCLAW_STATE_DIR: stateDir }, async () => {
      await writeSkillsLicenseState({ packs: ["bidding-pro"] });
      await withEnvAsync({ OPENCLAW_LICENSED_SKILL_PACKS: "env-pro" }, async () => {
        expect(resolveLicensedSkillPacks()).toEqual(new Set(["env-pro"]));
        expect(isSkillPackLicensed("env-pro")).toBe(true);
        expect(isSkillPackLicensed("bidding-pro")).toBe(false);
      });
    });
  });

  it("clears local license state", async () => {
    const stateDir = await makeStateDir();
    await withEnvAsync({ OPENCLAW_STATE_DIR: stateDir }, async () => {
      await writeSkillsLicenseState({ packs: ["bidding-pro"] });
      await clearSkillsLicenseState();
      expect(await readSkillsLicenseState()).toBeNull();
    });
  });
});
