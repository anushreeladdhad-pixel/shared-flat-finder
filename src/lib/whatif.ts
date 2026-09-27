// What-if suggestions (spec §5.8). Pure functions: given the current
// members and listings, explore small relaxations of commute or budget
// limits and report which ones would unlock at least one Tier A flat.
// What-ifs never change anyone's actual answers — they are suggestions the
// group can choose to act on themselves, in a new round.

import type { Listing } from "./seed-data";
import type { Member, WhatIf } from "./engine";
import { compatibleAreas, rentShare, tierARowIds } from "./engine";
import { moneyWhatIfText, timeWhatIfText } from "./format";

const STEPS = [10, 20, 30];

type Candidate = {
  kind: "time";
  memberNames: string[];
  step: number;
  changes: { member: string; field: string; from: number; to: number }[];
  unlocks: number[];
};

function withCommuteChange(
  members: Member[],
  changes: { memberName: string; landmark: string; newMax: number }[]
): Member[] {
  return members.map((m) => {
    const forThisMember = changes.filter((c) => c.memberName === m.name);
    if (forThisMember.length === 0) return m;
    return {
      ...m,
      answers: {
        ...m.answers,
        commute: m.answers.commute.map((c) => {
          const change = forThisMember.find((f) => f.landmark === c.landmark);
          return change ? { ...c, max_min: change.newMax } : c;
        }),
      },
    };
  });
}

function isSuperset(big: number[], small: number[]): boolean {
  return small.every((id) => big.includes(id));
}

function memberSetKey(names: string[]): string {
  return [...names].sort().join("|");
}

function generateTimeCandidates(
  members: Member[],
  listings: Listing[]
): Candidate[] {
  const candidates: Candidate[] = [];

  // Single-person candidates: one member, one commute entry, one step.
  for (const m of members) {
    for (const c of m.answers.commute) {
      for (const step of STEPS) {
        const newMax = c.max_min + step;
        const newMembers = withCommuteChange(members, [
          { memberName: m.name, landmark: c.landmark, newMax },
        ]);
        const unlocks = tierARowIds(newMembers, listings);
        if (unlocks.length === 0) continue;
        candidates.push({
          kind: "time",
          memberNames: [m.name],
          step,
          changes: [
            { member: m.name, field: c.landmark, from: c.max_min, to: newMax },
          ],
          unlocks,
        });
      }
    }
  }

  // Pair candidates: two different members, one commute entry each, same step.
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const m1 = members[i];
      const m2 = members[j];
      for (const c1 of m1.answers.commute) {
        for (const c2 of m2.answers.commute) {
          for (const step of STEPS) {
            const newMax1 = c1.max_min + step;
            const newMax2 = c2.max_min + step;
            const newMembers = withCommuteChange(members, [
              { memberName: m1.name, landmark: c1.landmark, newMax: newMax1 },
              { memberName: m2.name, landmark: c2.landmark, newMax: newMax2 },
            ]);
            const unlocks = tierARowIds(newMembers, listings);
            if (unlocks.length === 0) continue;
            candidates.push({
              kind: "time",
              memberNames: [m1.name, m2.name],
              step,
              changes: [
                { member: m1.name, field: c1.landmark, from: c1.max_min, to: newMax1 },
                { member: m2.name, field: c2.landmark, from: c2.max_min, to: newMax2 },
              ],
              unlocks,
            });
          }
        }
      }
    }
  }

  return candidates;
}

function dedupeTimeCandidates(candidates: Candidate[]): Candidate[] {
  // Rule 2: within the same member set, drop a candidate if another
  // candidate with a smaller step unlocks a superset of its flats.
  const byMemberSet = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = memberSetKey(c.memberNames);
    const arr = byMemberSet.get(key) ?? [];
    arr.push(c);
    byMemberSet.set(key, arr);
  }

  const survivorsRule2: Candidate[] = [];
  for (const [, group] of byMemberSet) {
    const sorted = [...group].sort((a, b) => a.step - b.step);
    const accepted: Candidate[] = [];
    for (const c of sorted) {
      const dominated = accepted.some(
        (a) => a.step < c.step && isSuperset(a.unlocks, c.unlocks)
      );
      if (!dominated) accepted.push(c);
    }
    survivorsRule2.push(...accepted);
  }

  // Rule 1: drop a pair candidate if a single candidate by one of its two
  // members, with a step <= the pair's step, unlocks a superset.
  const singles = survivorsRule2.filter((c) => c.memberNames.length === 1);
  const result: Candidate[] = [];
  for (const c of survivorsRule2) {
    if (c.memberNames.length === 1) {
      result.push(c);
      continue;
    }
    const dominatedByASingle = singles.some(
      (s) =>
        c.memberNames.includes(s.memberNames[0]) &&
        s.step <= c.step &&
        isSuperset(s.unlocks, c.unlocks)
    );
    if (!dominatedByASingle) result.push(c);
  }
  return result;
}

function sortTimeCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    if (a.step !== b.step) return a.step - b.step;
    if (a.memberNames.length !== b.memberNames.length) {
      return a.memberNames.length - b.memberNames.length;
    }
    return b.unlocks.length - a.unlocks.length;
  });
}

function areasFor(ids: number[], listings: Listing[]): string[] {
  const areas = new Set<string>();
  for (const id of ids) {
    const l = listings.find((x) => x.id === id);
    if (l) areas.add(l.area);
  }
  return [...areas];
}

function computeTimeWhatIfs(members: Member[], listings: Listing[]): WhatIf[] {
  const raw = generateTimeCandidates(members, listings);
  const deduped = dedupeTimeCandidates(raw);
  const sorted = sortTimeCandidates(deduped).slice(0, 2);
  return sorted.map((c) => ({
    kind: "time" as const,
    changes: c.changes,
    unlocks: c.unlocks,
    text: timeWhatIfText(c.changes, areasFor(c.unlocks, listings), c.unlocks.length),
  }));
}

function computeMoneyWhatIfs(members: Member[], listings: Listing[]): WhatIf[] {
  const areas = compatibleAreas(members);
  const inAreaListings = listings.filter(
    (l) => l.status === "active" && areas.includes(l.area)
  );
  if (inAreaListings.length === 0) return [];

  // §5.8: need = ceil(min share among strictly-compatible-area listings / 500) * 500.
  const minShare = Math.min(...inAreaListings.map((l) => rentShare(l.rent)));
  const need = Math.ceil(minShare / 500) * 500;

  const changedMembers = members.filter((m) => m.answers.max_rent < need);
  if (changedMembers.length === 0) return [];

  const newMembers = members.map((m) =>
    m.answers.max_rent < need
      ? { ...m, answers: { ...m.answers, max_rent: need } }
      : m
  );
  const unlocks = tierARowIds(newMembers, listings);
  if (unlocks.length === 0) return [];

  return [
    {
      kind: "money",
      changes: changedMembers.map((m) => ({
        member: m.name,
        field: "max_rent",
        from: m.answers.max_rent,
        to: need,
      })),
      unlocks,
      text: moneyWhatIfText(
        changedMembers.map((m) => m.name),
        need,
        areasFor(unlocks, listings),
        unlocks.length
      ),
    },
  ];
}

export function computeWhatIfs(
  members: Member[],
  listings: Listing[]
): { time: WhatIf[]; money: WhatIf[] } {
  return {
    time: computeTimeWhatIfs(members, listings),
    money: computeMoneyWhatIfs(members, listings),
  };
}
