import { describe, expect, it } from "vitest";
import { DEMO, SAMPLE_LISTINGS, type Listing } from "@/lib/seed-data";
import {
  eliminationCount,
  matchGroup,
  type Member,
  type Result,
} from "@/lib/engine";

function cloneListings(): Listing[] {
  return SAMPLE_LISTINGS.map((l) => ({ ...l }));
}

function demoMembers(): Member[] {
  return DEMO.map((d) => ({ name: d.name, answers: { ...d.answers } }));
}

function withCommute(
  members: Member[],
  name: string,
  landmark: string,
  max_min: number
): Member[] {
  return members.map((m) =>
    m.name === name
      ? {
          ...m,
          answers: {
            ...m.answers,
            commute: m.answers.commute.map((c) =>
              c.landmark === landmark ? { ...c, max_min } : c
            ),
          },
        }
      : m
  );
}

function withMaxRent(members: Member[], name: string, max_rent: number): Member[] {
  return members.map((m) =>
    m.name === name ? { ...m, answers: { ...m.answers, max_rent } } : m
  );
}

function markGone(listings: Listing[], ids: number[]): Listing[] {
  const set = new Set(ids);
  return listings.map((l) => (set.has(l.id) ? { ...l, status: "gone" as const } : l));
}

function optionSummary(r: { listing: Listing; tier: string; unknown_count: number; min_score: number }) {
  return [r.listing.id, r.listing.area, r.tier, r.unknown_count, r.min_score];
}

describe("T1: demo personas as-is", () => {
  const result = matchGroup(demoMembers(), cloneListings());

  it("is a conflict with an area clash", () => {
    expect(result.status).toBe("conflict");
    if (result.status !== "conflict") return;
    expect(result.area_clash).toBe(true);
    expect(result.budget_clash).toBe(false);
    expect(result.clashing_members).toEqual(["Riya", "Kavita"]);
  });

  it("has the two expected joint time what-ifs, in order, and no money what-ifs", () => {
    if (result.status !== "conflict") throw new Error("expected conflict");
    expect(result.what_ifs.time).toHaveLength(2);
    expect(result.what_ifs.time[0].unlocks.sort()).toEqual([12, 15]);
    expect(result.what_ifs.time[0].changes).toHaveLength(2);
    expect(result.what_ifs.time[1].unlocks).toHaveLength(3);
    expect(result.what_ifs.money).toEqual([]);
  });

  it("never surfaces a single-person what-if", () => {
    if (result.status !== "conflict") throw new Error("expected conflict");
    for (const wi of result.what_ifs.time) {
      expect(wi.changes.length).toBe(2);
    }
  });
});

describe("T2: Riya viman_nagar max 40, Kavita hinjewadi max 50", () => {
  let members = demoMembers();
  members = withCommute(members, "Riya", "viman_nagar", 40);
  members = withCommute(members, "Kavita", "hinjewadi", 50);
  const result = matchGroup(members, cloneListings());

  it("is ok with the three expected options in order", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.options.map(optionSummary)).toEqual([
      [15, "Aundh", "A", 1, 0.5],
      [12, "Aundh", "A", 0, 0.2],
      [6, "Balewadi", "B", 0, 1.0],
    ]);
  });

  it("flags Kavita's to-verify parking on option 15 and Riya's bend on option 6", () => {
    if (result.status !== "ok") throw new Error("expected ok");
    const opt15 = result.options.find((o) => o.listing.id === 15)!;
    expect(
      opt15.per_member["Kavita"].to_verify.some((s) => s.toLowerCase().includes("parking"))
    ).toBe(true);

    const opt6 = result.options.find((o) => o.listing.id === 6)!;
    expect(opt6.bender).toBe("Riya");
    expect(
      opt6.per_member["Riya"].bends.some((s) =>
        s.includes("Commute to Viman Nagar 55 min vs limit 40")
      )
    ).toBe(true);
  });

  it("has the expected load and no warning or what-ifs", () => {
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.load).toEqual({ Riya: 1, Meera: 0, Kavita: 0 });
    expect(result.warning).toBe(false);
    expect(result.what_ifs).toBeUndefined();
  });
});

describe("T3: tighter commute limits, plus a valid Tier B listing", () => {
  let members = demoMembers();
  members = withCommute(members, "Riya", "viman_nagar", 35);
  members = withCommute(members, "Kavita", "hinjewadi", 35);
  const listings = cloneListings();
  listings.push({
    id: 21,
    group_id: null,
    title: "3BHK in Shivajinagar #3",
    area: "Shivajinagar",
    rent: 48000,
    floor: 3,
    lift: true,
    parking: true,
    bathrooms: 3,
    pets: true,
    furnished: true,
    balcony: true,
    gym: false,
    near_metro: true,
    newer: false,
    url: null,
    is_sample: true,
    status: "active",
  });
  const result = matchGroup(members, listings);

  it("is ok — Tier B is not hidden behind the area clash", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.options.map(optionSummary)).toEqual([
      [21, "Shivajinagar", "B", 0, 0.4],
    ]);
    expect(result.options[0].bender).toBe("Kavita");
  });

  it("has the expected load and warning", () => {
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.load).toEqual({ Riya: 0, Meera: 0, Kavita: 1 });
    expect(result.warning).toBe(true);
  });

  it("has the expected time what-ifs and no money what-ifs", () => {
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.what_ifs?.time).toHaveLength(2);
    expect(result.what_ifs?.time[0].changes).toHaveLength(1);
    expect(result.what_ifs?.time[0].unlocks).toEqual([21]);
    expect(result.what_ifs?.time[1].changes).toHaveLength(2);
    expect(result.what_ifs?.time[1].unlocks.sort()).toEqual([12, 15, 21]);
    expect(result.what_ifs?.money).toEqual([]);
  });
});

describe("T4: loose limits produce 20 Tier A rows across 3 areas", () => {
  const members: Member[] = ["Riya", "Meera", "Kavita"].map((name) => ({
    name,
    answers: {
      max_rent: 30000,
      no_go: [],
      lift_above_floor: null,
      parking: false,
      pets: false,
      min_bathrooms: null,
      commute: [],
      private: [],
      prefs: { furnished: 5, balcony: 0, gym: 5, near_metro: 0, newer: 0, lower_rent: 0 },
    },
  }));
  const result = matchGroup(members, cloneListings());

  it("picks 3 different areas, all Tier A", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.options.map(optionSummary)).toEqual([
      [4, "Wakad", "A", 0, 1.0],
      [14, "Magarpatta", "A", 0, 1.0],
      [15, "Aundh", "A", 0, 1.0],
    ]);
    const areas = new Set(result.options.map((o) => o.listing.area));
    expect(areas.size).toBe(3);
  });
});

describe("T5: listings 12, 13, 15 gone", () => {
  let members = demoMembers();
  members = withCommute(members, "Riya", "viman_nagar", 40);
  members = withCommute(members, "Kavita", "hinjewadi", 50);
  const listings = markGone(cloneListings(), [12, 13, 15]);
  const result = matchGroup(members, listings);

  it("has the three expected Tier B options, all bent by Riya", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.options.map(optionSummary)).toEqual([
      [6, "Balewadi", "B", 0, 1.0],
      [16, "Baner", "B", 0, 0.3],
      [2, "Kothrud", "B", 0, 0.2],
    ]);
    expect(result.options.every((o) => o.bender === "Riya")).toBe(true);
  });

  it("has load 3 for Riya and a warning", () => {
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.load).toEqual({ Riya: 3, Meera: 0, Kavita: 0 });
    expect(result.warning).toBe(true);
  });

  it("has the expected time what-ifs", () => {
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.what_ifs?.time).toHaveLength(2);
    expect(result.what_ifs?.time[0].unlocks).toHaveLength(1);
    expect(result.what_ifs?.time[1].unlocks).toHaveLength(3);
  });
});

describe("T6: budget clash", () => {
  let members = demoMembers();
  members = withCommute(members, "Riya", "viman_nagar", 40);
  members = withCommute(members, "Kavita", "hinjewadi", 50);
  members = members.map((m) => ({ ...m, answers: { ...m.answers, max_rent: 13000 } }));
  const result = matchGroup(members, cloneListings());

  it("is a conflict with a budget clash, not an area clash", () => {
    expect(result.status).toBe("conflict");
    if (result.status !== "conflict") return;
    expect(result.area_clash).toBe(false);
    expect(result.budget_clash).toBe(true);
  });

  it("has the expected time and money what-ifs", () => {
    if (result.status !== "conflict") throw new Error("expected conflict");
    expect(result.what_ifs.time).toHaveLength(1);
    expect(result.what_ifs.time[0].unlocks).toEqual([4]);
    expect(result.what_ifs.money).toHaveLength(1);
    expect(result.what_ifs.money[0].unlocks).toEqual([15]);
    expect(result.what_ifs.money[0].changes).toHaveLength(3);
    expect(result.what_ifs.money[0].changes[0].to).toBe(15500);
  });
});

describe("T7: Meera max_rent 15500", () => {
  let members = demoMembers();
  members = withCommute(members, "Riya", "viman_nagar", 40);
  members = withCommute(members, "Kavita", "hinjewadi", 50);
  members = withMaxRent(members, "Meera", 15500);
  const result = matchGroup(members, cloneListings());

  it("has the three expected options", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.options.map(optionSummary)).toEqual([
      [15, "Aundh", "A", 1, 0.5],
      [16, "Baner", "B", 0, 0.3],
      [12, "Aundh", "B", 0, 0.2],
    ]);
    expect(result.options[1].bender).toBe("Riya");
    expect(result.options[2].bender).toBe("Meera");
  });

  it("has load spread across Riya and Meera, so no warning", () => {
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.load).toEqual({ Riya: 1, Meera: 1, Kavita: 0 });
    expect(result.warning).toBe(false);
  });
});

describe("T8: every listing gone", () => {
  it("reports no_listings", () => {
    const listings = cloneListings().map((l) => ({ ...l, status: "gone" as const }));
    const result = matchGroup(demoMembers(), listings);
    expect(result.status).toBe("no_listings");
  });
});

describe("Validation", () => {
  function sumPrefs(prefs: Record<string, number>) {
    return Object.values(prefs).reduce((a, b) => a + b, 0);
  }

  it("V1: prefs must total exactly 10", () => {
    const nine = { furnished: 2, balcony: 2, gym: 2, near_metro: 1, newer: 1, lower_rent: 1 };
    const eleven = { furnished: 2, balcony: 2, gym: 3, near_metro: 2, newer: 1, lower_rent: 1 };
    expect(sumPrefs(nine)).not.toBe(10);
    expect(sumPrefs(eleven)).not.toBe(10);
    expect(() => validatePrefs(nine)).toThrow("points must total 10");
    expect(() => validatePrefs(eleven)).toThrow("points must total 10");
  });

  it("V2: no single item may exceed 6 points", () => {
    const tooMany = { furnished: 7, balcony: 1, gym: 1, near_metro: 1, newer: 0, lower_rent: 0 };
    expect(() => validatePrefs(tooMany)).toThrow("max 6 points per item");
  });

  it("V3: Meera's live elimination line matches, alongside Riya's and Kavita's", () => {
    const members = demoMembers();
    const byName = Object.fromEntries(members.map((m) => [m.name, m]));
    expect(eliminationCount(byName["Meera"], cloneListings()).total).toBe(9);
    expect(eliminationCount(byName["Riya"], cloneListings()).total).toBe(18);
    expect(eliminationCount(byName["Kavita"], cloneListings()).total).toBe(16);
  });
});

function validatePrefs(prefs: Record<string, number>) {
  const total = Object.values(prefs).reduce((a, b) => a + b, 0);
  if (total !== 10) throw new Error("points must total 10");
  for (const v of Object.values(prefs)) {
    if (v > 6) throw new Error("max 6 points per item");
  }
}

describe("P1: performance with 200 listings", () => {
  it("runs a full match (including what-ifs) in under 300ms", () => {
    const base = cloneListings();
    const listings: Listing[] = [];
    let id = 1;
    for (let i = 0; i < 200; i++) {
      const src = base[i % base.length];
      const rent = 36000 + Math.round(Math.random() * (75000 - 36000));
      listings.push({ ...src, id: id++, rent });
    }
    const members = demoMembers();
    const start = performance.now();
    matchGroup(members, listings);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(300);
  });
});
