import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../../config/paths.js";
import { normalizeOptionalString } from "../../shared/string-coerce.js";
import { readJsonFile, writeJsonAtomic } from "../../infra/json-files.js";

function normalizePack(value: string | undefined): string | null {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }
  return normalized.toLowerCase();
}

function parseLicensedPacks(raw: string | undefined): Set<string> | null {
  const normalized = normalizeOptionalString(raw);
  if (!normalized) {
    return null;
  }
  const packs = normalized
    .split(",")
    .map((value) => normalizePack(value))
    .filter((value): value is string => Boolean(value));
  return packs.length > 0 ? new Set(packs) : null;
}

export type SkillsLicenseState = {
  key?: string;
  packs: string[];
  activatedAt?: string;
};

function normalizePacks(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const out = new Set<string>();
  for (const value of values) {
    const normalized = normalizePack(typeof value === "string" ? value : undefined);
    if (normalized) {
      out.add(normalized);
    }
  }
  return [...out];
}

function normalizeLicenseState(raw: unknown): SkillsLicenseState | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const packs = normalizePacks(record.packs);
  if (packs.length === 0) {
    return null;
  }
  const key = typeof record.key === "string" ? normalizeOptionalString(record.key) : null;
  const activatedAt =
    typeof record.activatedAt === "string" ? normalizeOptionalString(record.activatedAt) : null;
  return {
    ...(key ? { key } : {}),
    packs,
    ...(activatedAt ? { activatedAt } : {}),
  };
}

export function resolveSkillsLicensePath(): string {
  return path.join(resolveStateDir(), "license", "skills-license.json");
}

export function readSkillsLicenseStateSync(): SkillsLicenseState | null {
  const filePath = resolveSkillsLicensePath();
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    return normalizeLicenseState(raw);
  } catch {
    return null;
  }
}

export async function readSkillsLicenseState(): Promise<SkillsLicenseState | null> {
  const raw = await readJsonFile<unknown>(resolveSkillsLicensePath());
  return normalizeLicenseState(raw);
}

export async function writeSkillsLicenseState(params: {
  key?: string;
  packs: string[];
}): Promise<SkillsLicenseState> {
  const packs = normalizePacks(params.packs);
  if (packs.length === 0) {
    throw new Error("skills license requires at least one pack");
  }
  const key = normalizeOptionalString(params.key);
  const next: SkillsLicenseState = {
    ...(key ? { key } : {}),
    packs,
    activatedAt: new Date().toISOString(),
  };
  await writeJsonAtomic(resolveSkillsLicensePath(), next, { mode: 0o600, trailingNewline: true });
  return next;
}

export async function clearSkillsLicenseState(): Promise<void> {
  const filePath = resolveSkillsLicensePath();
  await fs.promises.rm(filePath, { force: true });
}

export function resolveLicensedSkillPacks(): Set<string> | null {
  const envPacks =
    parseLicensedPacks(process.env.OPENCLAW_LICENSED_SKILL_PACKS) ??
    parseLicensedPacks(process.env.OPENCLAW_SKILL_PACKS);
  if (envPacks) {
    return envPacks;
  }
  const fileState = readSkillsLicenseStateSync();
  if (!fileState) {
    return null;
  }
  return new Set(fileState.packs);
}

export function isSkillPackLicensed(requiredPack: string | undefined): boolean {
  const pack = normalizePack(requiredPack);
  if (!pack) {
    return true;
  }
  const licensedPacks = resolveLicensedSkillPacks();
  if (!licensedPacks) {
    // Backward-compatible default: when no licensing config is provided,
    // keep all skills available.
    return true;
  }
  return licensedPacks.has(pack);
}
