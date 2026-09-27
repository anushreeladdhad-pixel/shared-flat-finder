// Pure, rule-based matching engine. No AI, no network calls, no side
// effects. Every exported function is deterministic given its inputs so it
// can be unit tested (see tests/engine.test.ts) and re-run cheaply by the
// what-if explorer (src/lib/whatif.ts).

import type { Answers, Listing } from "./seed-data";
import { AREAS, LANDMARK_LABELS, commuteMinutes } from "./seed-data";
import {
  bendLine,
  getsLine,
  joinNames,
  metPrefLine,
  missedPrefLine,
  toVerifyLine,
} from "./format";
import { computeWhatIfs } from "./whatif";

export type Member = { name: string; answers: Answers };

export type CheckField =
  | "rent"
  | "no_go"
  | "lift"
  | "parking"
  | "pets"
  | "bathrooms"
  | "commute";

export type CheckResult = {
  field: CheckField;
  status: "pass" | "fail" | "unknown";
  bendable: boolean;
  bendPass: boolean;
  // Extra data used only for wording (src/lib/format.ts).
  detail: Record<string, number | string>;
};

export const PREF_KEYS = [
  "furnished",
  "balcony",
  "gym",
  "near_metro",
  "newer",
  "lower_rent",
] as const;
export type PrefKey = (typeof PREF_KEYS)[number];

export function rentShare(rent: number): number {
  return Math.round(rent / 3);
}

/** All dealbreaker checks that *apply* for this member on this listing. */
export function runChecks(member: Member, listing: Listing): CheckResult[] {
  const a = member.answers;
  const results: CheckResult[] = [];
  const share = rentShare(listing.rent);

  // rent: always applies
  results.push({
    field: "rent",
    status: share <= a.max_rent ? "pass" : "fail",
    bendable: true,
    bendPass: share <= a.max_rent * 1.1,
    detail: { share, maxRent: a.max_rent },
  });

  // no_go: applies only when the listing's area is on the no-go list
  if (a.no_go.includes(listing.area)) {
    results.push({
      field: "no_go",
      status: "fail",
      bendable: false,
      bendPass: false,
      detail: { area: listing.area },
    });
  }

  // lift: applies when a limit is set AND the floor exceeds it
  if (a.lift_above_floor !== null && listing.floor > a.lift_above_floor) {
    const status =
      listing.lift === null ? "unknown" : listing.lift ? "pass" : "fail";
    results.push({
      field: "lift",
      status,
      bendable: false,
      bendPass: false,
      detail: { floorLimit: a.lift_above_floor, floor: listing.floor },
    });
  }

  // parking: applies when the member requires it
  if (a.parking) {
    const status =
      listing.parking === null ? "unknown" : listing.parking ? "pass" : "fail";
    results.push({
      field: "parking",
      status,
      bendable: false,
      bendPass: false,
      detail: {},
    });
  }

  // pets: applies when the member requires it
  if (a.pets) {
    const status = listing.pets === null ? "unknown" : listing.pets ? "pass" : "fail";
    results.push({
      field: "pets",
      status,
      bendable: false,
      bendPass: false,
      detail: {},
    });
  }

  // bathrooms: applies when a minimum is set
  if (a.min_bathrooms !== null) {
    const status =
      listing.bathrooms === null
        ? "unknown"
        : listing.bathrooms >= a.min_bathrooms
          ? "pass"
          : "fail";
    results.push({
      field: "bathrooms",
      status,
      bendable: false,
      bendPass: false,
      detail: { bathrooms: listing.bathrooms ?? 0, min: a.min_bathrooms },
    });
  }

  // commute: every stated entry always applies
  for (const c of a.commute) {
    const minutes = commuteMinutes(listing.area, c.landmark);
    if (minutes === null) continue; // area/landmark not in the table
    results.push({
      field: "commute",
      status: minutes <= c.max_min ? "pass" : "fail",
      bendable: true,
      bendPass: minutes <= c.max_min + 15,
      detail: { landmark: c.landmark, minutes, maxMin: c.max_min },
    });
  }

  return results;
}

/** Raw (unrounded) preference score in [0, 1]. */
export function prefScore(member: Member, listing: Listing): number {
  const p = member.answers.prefs;
  const share = rentShare(listing.rent);
  let sum = 0;
  if (listing.furnished === true) sum += p.furnished;
  if (listing.balcony === true) sum += p.balcony;
  if (listing.gym === true) sum += p.gym;
  if (listing.near_metro === true) sum += p.near_metro;
  if (listing.newer === true) sum += p.newer;
  if (share <= 0.9 * member.answers.max_rent) sum += p.lower_rent;
  return sum / 10;
}

export function roundScore(x: number): number {
  return Math.round(x * 10) / 10;
}

export type Tier = "A" | "B";

export type ClassifiedRow = {
  listing: Listing;
  tier: Tier;
  bender: string | null;
  perMember: { member: Member; checks: CheckResult[] }[];
  minScore: number;
  totalScore: number;
  hasUnknown: boolean;
  unknownCount: number;
};

/** Classify one listing against all 3 members. Returns null if excluded. */
export function classifyListing(
  members: Member[],
  listing: Listing
): ClassifiedRow | null {
  const perMember = members.map((member) => ({
    member,
    checks: runChecks(member, listing),
  }));

  const fails: { member: Member; check: CheckResult }[] = [];
  for (const { member, checks } of perMember) {
    for (const check of checks) {
      if (check.status === "fail") fails.push({ member, check });
    }
  }

  let tier: Tier | null = null;
  let bender: string | null = null;

  if (fails.length === 0) {
    tier = "A";
  } else if (fails.length === 1) {
    const f = fails[0];
    if (f.check.bendable && f.check.bendPass) {
      tier = "B";
      bender = f.member.name;
    }
  }

  if (!tier) return null;

  const scores = perMember.map(({ member }) => prefScore(member, listing));
  const minScore = roundScore(Math.min(...scores));
  const totalScore = roundScore(scores.reduce((a, b) => a + b, 0));
  const unknowns = perMember.flatMap(({ checks }) =>
    checks.filter((c) => c.status === "unknown")
  );

  return {
    listing,
    tier,
    bender,
    perMember,
    minScore,
    totalScore,
    hasUnknown: unknowns.length > 0,
    unknownCount: unknowns.length,
  };
}

export function compareRows(a: ClassifiedRow, b: ClassifiedRow): number {
  if (a.tier !== b.tier) return a.tier === "A" ? -1 : 1;
  if (a.minScore !== b.minScore) return b.minScore - a.minScore;
  if (a.hasUnknown !== b.hasUnknown) return a.hasUnknown ? 1 : -1;
  if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
  return a.listing.rent - b.listing.rent;
}

export function pickOptions(sortedRows: ClassifiedRow[]): ClassifiedRow[] {
  const picked: ClassifiedRow[] = [];

  for (const tier of ["A", "B"] as Tier[]) {
    const T = sortedRows.filter((r) => r.tier === tier);
    if (T.length === 0) continue;
    const distinctAreas = new Set(T.map((r) => r.listing.area)).size;
    const cap = distinctAreas >= 3 ? 1 : 2;

    for (const r of T) {
      if (picked.length === 3) break;
      if (picked.includes(r)) continue;
      const sameAreaCount = picked.filter(
        (p) => p.tier === tier && p.listing.area === r.listing.area
      ).length;
      if (sameAreaCount >= cap) continue;
      if (tier === "B") {
        const pickedBenders = new Set(
          picked.filter((p) => p.tier === "B").map((p) => p.bender)
        );
        if (r.bender && pickedBenders.has(r.bender)) {
          const otherAvailable = T.some(
            (o) =>
              o !== r &&
              !picked.includes(o) &&
              o.bender &&
              !pickedBenders.has(o.bender)
          );
          if (otherAvailable) continue;
        }
      }
      picked.push(r);
    }

    // Top up any gaps the caps left, still within this tier.
    for (const r of T) {
      if (picked.length === 3) break;
      if (!picked.includes(r)) picked.push(r);
    }
  }

  return picked.slice(0, 3);
}

export type OptionPerMember = {
  gets: string[];
  gives_up: string[];
  bends: string[];
  to_verify: string[];
  score: number;
};

export type Option = {
  listing: Listing;
  tier: Tier;
  bender: string | null;
  per_member: Record<string, OptionPerMember>;
  min_score: number;
  total_score: number;
  unknown_count: number;
};

export function buildOption(row: ClassifiedRow): Option {
  const per_member: Record<string, OptionPerMember> = {};

  for (const { member, checks } of row.perMember) {
    const gets: string[] = [];
    const gives_up: string[] = [];
    const bends: string[] = [];
    const to_verify: string[] = [];

    for (const check of checks) {
      if (check.status === "pass") {
        const line = getsLine(check);
        if (line) gets.push(line);
      } else if (check.status === "unknown") {
        to_verify.push(toVerifyLine(check));
      } else if (check.status === "fail") {
        // Only the bender should ever have a fail on a picked option; it is
        // by construction the single bendable fail that qualified Tier B.
        bends.push(bendLine(check));
      }
    }

    const p = member.answers.prefs;
    const listing = row.listing;
    const has: Record<string, boolean> = {
      furnished: listing.furnished === true,
      balcony: listing.balcony === true,
      gym: listing.gym === true,
      near_metro: listing.near_metro === true,
      newer: listing.newer === true,
      lower_rent: rentShare(listing.rent) <= 0.9 * member.answers.max_rent,
    };
    for (const key of PREF_KEYS) {
      const pts = p[key];
      if (pts <= 0) continue;
      if (has[key]) gets.push(metPrefLine(key, pts));
      else gives_up.push(missedPrefLine(key, pts));
    }

    per_member[member.name] = {
      gets,
      gives_up,
      bends,
      to_verify,
      score: roundScore(prefScore(member, row.listing)),
    };
  }

  return {
    listing: row.listing,
    tier: row.tier,
    bender: row.bender,
    per_member,
    min_score: row.minScore,
    total_score: row.totalScore,
    unknown_count: row.unknownCount,
  };
}

export function computeLoad(
  members: Member[],
  picked: ClassifiedRow[]
): Record<string, number> {
  const load: Record<string, number> = {};
  for (const m of members) load[m.name] = 0;
  for (const r of picked) {
    if (r.tier === "B" && r.bender) load[r.bender] = (load[r.bender] ?? 0) + 1;
  }
  return load;
}

export function computeWarning(
  load: Record<string, number>,
  pickedCount: number
): boolean {
  if (pickedCount === 0) return false;
  const withLoad = Object.entries(load).filter(([, v]) => v > 0);
  if (withLoad.length !== 1) return false;
  return withLoad[0][1] === pickedCount;
}

/** Areas where every member's no-go list and commute limits are satisfied,
 * at strict thresholds (no bend allowance). Used for the conflict gate and
 * for the money what-if. */
export function compatibleAreas(members: Member[]): string[] {
  return AREAS.filter((area) => members.every((m) => memberOkWithArea(m, area)));
}

function memberOkWithArea(member: Member, area: string): boolean {
  if (member.answers.no_go.includes(area)) return false;
  return member.answers.commute.every((c) => {
    const mins = commuteMinutes(area, c.landmark);
    return mins !== null && mins <= c.max_min;
  });
}

export function findClashingMembers(members: Member[]): string[] {
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const m1 = members[i];
      const m2 = members[j];
      if (m1.answers.commute.length === 0 && m2.answers.commute.length === 0) {
        continue;
      }
      const ok = AREAS.some(
        (area) => memberOkWithArea(m1, area) && memberOkWithArea(m2, area)
      );
      if (!ok) return [m1.name, m2.name];
    }
  }
  return members.filter((m) => m.answers.commute.length > 0).map((m) => m.name);
}

export type ConflictReport = {
  area_clash: boolean;
  budget_clash: boolean;
  clashing_members: string[];
};

export function conflictReport(
  members: Member[],
  activeListings: Listing[]
): ConflictReport {
  const areas = compatibleAreas(members);
  const area_clash = areas.length === 0;
  if (area_clash) {
    return {
      area_clash,
      budget_clash: false,
      clashing_members: findClashingMembers(members),
    };
  }
  const minMax = Math.min(...members.map((m) => m.answers.max_rent));
  const inAreaListings = activeListings.filter((l) => areas.includes(l.area));
  const budget_clash = !inAreaListings.some((l) => rentShare(l.rent) <= minMax);
  return { area_clash: false, budget_clash, clashing_members: [] };
}

export function tierARowIds(members: Member[], listings: Listing[]): number[] {
  const ids: number[] = [];
  for (const l of listings) {
    if (l.status !== "active") continue;
    const row = classifyListing(members, l);
    if (row && row.tier === "A") ids.push(l.id);
  }
  return ids;
}

export function activeListingSet(
  listings: Listing[],
  groupId: string | null,
  goneOverrides: Record<number, "gone"> = {}
): Listing[] {
  return listings
    .filter((l) => l.group_id === null || l.group_id === groupId)
    .map((l) => {
      const override = goneOverrides[l.id];
      return override ? { ...l, status: override } : l;
    })
    .filter((l) => l.status === "active");
}

export type WhatIf = {
  kind: "time" | "money";
  changes: { member: string; field: string; from: number; to: number }[];
  unlocks: number[];
  text: string;
};

export type Result =
  | { status: "no_listings" }
  | ({
      status: "conflict";
    } & ConflictReport & { what_ifs: { time: WhatIf[]; money: WhatIf[] } })
  | {
      status: "ok";
      options: Option[];
      load: Record<string, number>;
      warning: boolean;
      what_ifs?: { time: WhatIf[]; money: WhatIf[] };
    };

export function matchGroup(members: Member[], listings: Listing[]): Result {
  const active = listings.filter((l) => l.status === "active");
  if (active.length === 0) return { status: "no_listings" };

  const rows = active
    .map((l) => classifyListing(members, l))
    .filter((r): r is ClassifiedRow => r !== null);

  if (rows.length === 0) {
    const report = conflictReport(members, active);
    const what_ifs = computeWhatIfs(members, active);
    return { status: "conflict", ...report, what_ifs };
  }

  const sorted = [...rows].sort(compareRows);
  const picked = pickOptions(sorted);
  const options = picked.map(buildOption);
  const load = computeLoad(members, picked);
  const warning = computeWarning(load, picked.length);

  const needsWhatIfs = options.length < 2 || warning;
  const what_ifs = needsWhatIfs ? computeWhatIfs(members, active) : undefined;

  return {
    status: "ok",
    options,
    load,
    warning,
    ...(what_ifs ? { what_ifs } : {}),
  };
}

/** How many of the given listings a single member's dealbreakers alone rule
 * out, at strict thresholds (never bends, unknown never fails). Used for the
 * live elimination line on the form and the "why other flats didn't make
 * it" section on results. */
export function eliminationCount(
  member: Member,
  listings: Listing[]
): { total: number; byField: Record<string, number> } {
  const byField: Record<string, number> = {};
  let total = 0;
  for (const listing of listings) {
    const checks = runChecks(member, listing);
    let excluded = false;
    for (const c of checks) {
      if (c.status === "fail") {
        excluded = true;
        const key =
          c.field === "commute" ? `commute:${c.detail.landmark}` : c.field;
        byField[key] = (byField[key] ?? 0) + 1;
      }
    }
    if (excluded) total++;
  }
  return { total, byField };
}

export function biggestCutLabel(
  byField: Record<string, number>
): { label: string; count: number } | null {
  let best: { key: string; count: number } | null = null;
  for (const [key, count] of Object.entries(byField)) {
    if (!best || count > best.count) best = { key, count };
  }
  if (!best) return null;
  const [field, landmark] = best.key.split(":");
  const label =
    field === "commute"
      ? `commute to ${LANDMARK_LABELS[landmark] ?? landmark}`
      : fieldLabelFor(field);
  return { label, count: best.count };
}

function fieldLabelFor(field: string): string {
  const labels: Record<string, string> = {
    rent: "rent",
    no_go: "no-go areas",
    lift: "lift",
    parking: "parking",
    pets: "pets",
    bathrooms: "bathrooms",
  };
  return labels[field] ?? field;
}

export { joinNames };
