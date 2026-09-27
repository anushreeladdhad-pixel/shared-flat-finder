// Shared domain types + pure (DB-agnostic) business logic used by both the
// in-memory store (local dev, no Supabase configured) and the Supabase
// store. Keeping this logic here means the two persistence adapters stay
// thin CRUD shims and can't drift apart on validation or wording.

import type { Answers, Listing } from "./seed-data";
import { LANDMARK_LABELS } from "./seed-data";
import { PREF_KEYS, type Member } from "./engine";

export type GroupRecord = {
  id: string;
  code: string;
  round: number;
  locked_at: string | null;
  created_at: string;
  is_demo: boolean;
};

export type MemberRecord = {
  id: string;
  group_id: string;
  name: string;
  position: 0 | 1 | 2;
  token: string;
  is_organiser: boolean;
  answers: Answers | null;
  submitted_at: string | null;
};

export type RoundChange = {
  id: string;
  group_id: string;
  round: number;
  member_id: string;
  member_name: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
  private: boolean;
};

export type NewListingInput = Omit<
  Listing,
  "id" | "group_id" | "is_sample" | "status"
>;

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

const DEFAULT_ANSWERS: Answers = {
  max_rent: 0,
  no_go: [],
  lift_above_floor: null,
  parking: false,
  pets: false,
  min_bathrooms: null,
  commute: [],
  private: [],
  prefs: { furnished: 0, balcony: 0, gym: 0, near_metro: 0, newer: 0, lower_rent: 0 },
};

export function blankAnswers(): Answers {
  return JSON.parse(JSON.stringify(DEFAULT_ANSWERS));
}

export function validateAnswers(answers: Answers): void {
  const total = PREF_KEYS.reduce((sum, k) => sum + (answers.prefs[k] ?? 0), 0);
  if (total !== 10) {
    throw new ValidationError("points must total 10");
  }
  for (const k of PREF_KEYS) {
    if ((answers.prefs[k] ?? 0) > 6) {
      throw new ValidationError("max 6 points per item");
    }
    if ((answers.prefs[k] ?? 0) < 0) {
      throw new ValidationError("points cannot be negative");
    }
  }
  if (typeof answers.max_rent !== "number" || answers.max_rent <= 0) {
    throw new ValidationError("max rent is required");
  }
  if (answers.commute.length > 2) {
    throw new ValidationError("at most 2 commute limits");
  }
  for (const c of answers.commute) {
    if (c.max_min < 15 || c.max_min > 90) {
      throw new ValidationError("commute minutes must be between 15 and 90");
    }
  }
}

const FIELD_LABELS: Record<string, string> = {
  max_rent: "max rent",
  no_go: "no-go areas",
  lift_above_floor: "lift limit",
  parking: "parking",
  pets: "pets",
  min_bathrooms: "min bathrooms",
};

function describeChange(field: string, oldValue: unknown, newValue: unknown): string {
  if (field === "max_rent") return `max rent ₹${oldValue} → ₹${newValue}`;
  if (field.startsWith("commute:")) {
    const landmark = field.split(":")[1];
    const label = LANDMARK_LABELS[landmark] ?? landmark;
    return `${label} limit ${oldValue} → ${newValue} min`;
  }
  const label = FIELD_LABELS[field] ?? field;
  return `${label} ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`;
}

/** Compute the list of round_changes rows produced by re-submitting
 * `next` when the previous round's answers were `prev` (or null on a first
 * submission, in which case nothing is logged). */
export function diffAnswers(
  prev: Answers | null,
  next: Answers
): { field: string; old_value: unknown; new_value: unknown; private: boolean; text: string }[] {
  if (!prev) return [];
  const isPrivate = (field: string) => next.private.includes(field);
  const changes: {
    field: string;
    old_value: unknown;
    new_value: unknown;
    private: boolean;
    text: string;
  }[] = [];

  const simpleFields: (keyof Answers)[] = [
    "max_rent",
    "lift_above_floor",
    "parking",
    "pets",
    "min_bathrooms",
  ];
  for (const f of simpleFields) {
    if (JSON.stringify(prev[f]) !== JSON.stringify(next[f])) {
      changes.push({
        field: f,
        old_value: prev[f],
        new_value: next[f],
        private: isPrivate(f),
        text: describeChange(f, prev[f], next[f]),
      });
    }
  }
  if (JSON.stringify(prev.no_go) !== JSON.stringify(next.no_go)) {
    changes.push({
      field: "no_go",
      old_value: prev.no_go,
      new_value: next.no_go,
      private: isPrivate("no_go"),
      text: describeChange("no_go", prev.no_go, next.no_go),
    });
  }

  const prevByLandmark = new Map(prev.commute.map((c) => [c.landmark, c.max_min]));
  const nextByLandmark = new Map(next.commute.map((c) => [c.landmark, c.max_min]));
  const landmarks = new Set([...prevByLandmark.keys(), ...nextByLandmark.keys()]);
  for (const landmark of landmarks) {
    const before = prevByLandmark.get(landmark);
    const after = nextByLandmark.get(landmark);
    if (before !== after) {
      const field = `commute:${landmark}`;
      changes.push({
        field,
        old_value: before ?? null,
        new_value: after ?? null,
        private: isPrivate(field) || isPrivate("commute"),
        text: describeChange(field, before ?? "none", after ?? "none"),
      });
    }
  }

  return changes;
}

export function nextListingId(existing: Listing[]): number {
  return existing.reduce((max, l) => Math.max(max, l.id), 0) + 1;
}

export type PublicMember = {
  name: string;
  position: 0 | 1 | 2;
  is_organiser: boolean;
  submitted: boolean;
};

export function toPublicMember(m: MemberRecord): PublicMember {
  return {
    name: m.name,
    position: m.position,
    is_organiser: m.is_organiser,
    submitted: m.submitted_at !== null,
  };
}

export function toEngineMembers(members: MemberRecord[]): Member[] {
  return members
    .filter((m) => m.answers !== null)
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ name: m.name, answers: m.answers as Answers }));
}
