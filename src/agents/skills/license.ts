import { normalizeOptionalString } from "../../shared/string-coerce.js";

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

export function resolveLicensedSkillPacks(): Set<string> | null {
  return (
    parseLicensedPacks(process.env.OPENCLAW_LICENSED_SKILL_PACKS) ??
    parseLicensedPacks(process.env.OPENCLAW_SKILL_PACKS)
  );
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
