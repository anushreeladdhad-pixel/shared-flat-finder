// Wording helpers for gets / gives up / bends / to-verify and what-if text.
// Kept separate from engine.ts so the engine stays pure data-in data-out and
// all user-facing strings live in one place.

import { LANDMARK_LABELS } from "./seed-data";
import type { CheckResult } from "./engine";

const PREF_LABELS: Record<string, string> = {
  furnished: "Furnished",
  balcony: "Balcony",
  gym: "Gym",
  near_metro: "Near metro",
  newer: "Newer building",
  lower_rent: "Lower rent",
};

export function prefLabel(key: string): string {
  return PREF_LABELS[key] ?? key;
}

export function landmarkLabel(key: string): string {
  return LANDMARK_LABELS[key] ?? key;
}

function money(n: number | string): string {
  return `₹${Math.round(Number(n)).toLocaleString("en-IN")}`;
}

export function getsLine(check: CheckResult): string | null {
  if (check.status !== "pass") return null;
  switch (check.field) {
    case "rent":
      return `Rent ${money(check.detail.share)} each (within ${money(check.detail.maxRent)})`;
    case "lift":
      return `Lift available (needed above floor ${check.detail.floorLimit})`;
    case "parking":
      return "Parking";
    case "pets":
      return "Pets allowed";
    case "bathrooms":
      return `${check.detail.bathrooms} bathrooms (needs ${check.detail.min}+)`;
    case "commute":
      return `Commute to ${landmarkLabel(String(check.detail.landmark))} ${check.detail.minutes} min (limit ${check.detail.maxMin})`;
    default:
      return null;
  }
}

export function bendLine(check: CheckResult): string {
  if (check.field === "rent") {
    const share = Number(check.detail.share);
    const maxRent = Number(check.detail.maxRent);
    const pct = Math.round(((share - maxRent) / maxRent) * 100);
    return `Rent share ${money(share)} vs ${money(maxRent)} limit (+${pct}%)`;
  }
  if (check.field === "commute") {
    const landmark = String(check.detail.landmark);
    const minutes = Number(check.detail.minutes);
    const maxMin = Number(check.detail.maxMin);
    return `Commute to ${landmarkLabel(landmark)} ${minutes} min vs limit ${maxMin} (+${minutes - maxMin})`;
  }
  return "A limit was bent";
}

export function toVerifyLine(check: CheckResult): string {
  const label: Record<string, string> = {
    lift: "Lift",
    parking: "Parking",
    pets: "Pets",
    bathrooms: "Bathrooms",
  };
  const l = label[check.field] ?? check.field;
  return `${l} not stated: confirm before visiting`;
}

export function metPrefLine(key: string, points: number): string {
  return `${prefLabel(key)} (+${points} pts)`;
}

export function missedPrefLine(key: string, points: number): string {
  return `${prefLabel(key)} (−${points} pts)`;
}

export function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

export function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function tierTag(tier: "A" | "B", bender: string | null): string {
  if (tier === "A") return "Everyone's limits met";
  return `Needs a compromise from ${bender}`;
}

export type ChangeRecord = { member: string; field: string; from: number; to: number };

export function timeWhatIfText(
  changes: ChangeRecord[],
  unlockedAreas: string[],
  flatCount: number
): string {
  const segs = changes.map((c, i) => {
    const verb = i === 0 ? "goes from" : "from";
    return `${c.member} ${verb} ${c.from} to ${c.to} min to ${landmarkLabel(c.field)}`;
  });
  const sentence =
    segs.length === 1
      ? segs[0]
      : `${segs.slice(0, -1).join(", ")} and ${segs[segs.length - 1]}`;
  const flatsWord = pluralize(flatCount, "flat", "flats");
  const verb2 = pluralize(flatCount, "opens", "open");
  return `If ${sentence}, ${flatCount} ${flatsWord} ${verb2} up (${unlockedAreas.join(", ")}).`;
}

export function moneyWhatIfText(
  changedNames: string[],
  need: number,
  unlockedAreas: string[],
  flatCount: number
): string {
  const names = joinNames(changedNames);
  const flatsWord = pluralize(flatCount, "flat", "flats");
  const verb2 = pluralize(flatCount, "opens", "open");
  return `If ${names} each go up to ${money(need)}, ${flatCount} ${flatsWord} ${verb2} up (${unlockedAreas.join(", ")}).`;
}

export function privateWhatIfMask(memberName: string): string {
  return `a change to one of ${memberName}'s private limits would open`;
}
