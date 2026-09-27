// Seed data shared by the engine tests, the app, and supabase/seed.sql.
// Keep this file and supabase/seed.sql in sync (supabase/seed.sql is
// generated from this file — see scripts/gen-seed-sql.ts).

export type Answers = {
  max_rent: number;
  no_go: string[];
  lift_above_floor: number | null;
  parking: boolean;
  pets: boolean;
  min_bathrooms: number | null;
  commute: { landmark: string; max_min: number }[];
  private: string[];
  prefs: {
    furnished: number;
    balcony: number;
    gym: number;
    near_metro: number;
    newer: number;
    lower_rent: number;
  };
};

export type Listing = {
  id: number;
  group_id?: string | null;
  title: string;
  area: string;
  rent: number;
  floor: number;
  lift: boolean | null;
  parking: boolean | null;
  pets: boolean | null;
  bathrooms: number | null;
  furnished: boolean | null;
  balcony: boolean | null;
  gym: boolean | null;
  near_metro: boolean | null;
  newer: boolean | null;
  url?: string | null;
  is_sample: boolean;
  status: "active" | "gone";
};

export const LANDMARK_KEYS = [
  "hinjewadi",
  "baner",
  "kothrud",
  "shivajinagar",
  "koregaon_park",
  "viman_nagar",
  "kharadi",
  "magarpatta",
] as const;

export const LANDMARK_LABELS: Record<string, string> = {
  hinjewadi: "Hinjewadi IT Park",
  baner: "Baner",
  kothrud: "Kothrud",
  shivajinagar: "Shivajinagar",
  koregaon_park: "Koregaon Park",
  viman_nagar: "Viman Nagar",
  kharadi: "Kharadi",
  magarpatta: "Magarpatta",
};

export const AREAS = [
  "Hinjewadi",
  "Wakad",
  "Balewadi",
  "Baner",
  "Aundh",
  "Kothrud",
  "Shivajinagar",
  "Koregaon Park",
  "Kalyani Nagar",
  "Viman Nagar",
  "Kharadi",
  "Magarpatta",
] as const;

// area -> landmark -> minutes
const COMMUTE_ROWS: [string, number[]][] = [
  ["Hinjewadi", [10, 25, 45, 45, 60, 75, 80, 70]],
  ["Wakad", [20, 20, 40, 40, 55, 65, 70, 65]],
  ["Balewadi", [30, 10, 35, 35, 50, 55, 60, 55]],
  ["Baner", [40, 5, 30, 30, 45, 50, 55, 50]],
  ["Aundh", [40, 15, 30, 20, 35, 40, 45, 40]],
  ["Kothrud", [45, 30, 5, 25, 35, 55, 55, 40]],
  ["Shivajinagar", [45, 30, 20, 5, 20, 30, 35, 30]],
  ["Koregaon Park", [60, 45, 35, 20, 5, 15, 20, 15]],
  ["Kalyani Nagar", [65, 45, 40, 25, 10, 10, 15, 20]],
  ["Viman Nagar", [75, 50, 50, 30, 15, 5, 15, 25]],
  ["Kharadi", [80, 55, 55, 35, 20, 15, 5, 20]],
  ["Magarpatta", [70, 50, 45, 30, 15, 25, 20, 5]],
];

export type CommuteRow = { area: string; landmark: string; minutes: number };

export const COMMUTE: CommuteRow[] = COMMUTE_ROWS.flatMap(([area, minutes]) =>
  LANDMARK_KEYS.map((landmark, i) => ({ area, landmark, minutes: minutes[i] }))
);

export function commuteMinutes(area: string, landmark: string): number | null {
  const row = COMMUTE.find((c) => c.area === area && c.landmark === landmark);
  return row ? row.minutes : null;
}

type SampleRow = {
  id: number;
  area: string;
  rent: number;
  floor: number;
  lift: boolean | null;
  parking: boolean | null;
  bathrooms: number | null;
  pets: boolean | null;
  furnished: boolean | null;
  balcony: boolean | null;
  gym: boolean | null;
  near_metro: boolean | null;
  newer: boolean | null;
};

const SAMPLE_ROWS: SampleRow[] = [
  { id: 1, area: "Baner", rent: 54000, floor: 3, lift: true, parking: true, bathrooms: 3, pets: true, furnished: true, balcony: true, gym: true, near_metro: false, newer: true },
  { id: 2, area: "Kothrud", rent: 42000, floor: 2, lift: true, parking: true, bathrooms: 2, pets: false, furnished: false, balcony: true, gym: false, near_metro: true, newer: false },
  { id: 3, area: "Aundh", rent: 51000, floor: 5, lift: false, parking: true, bathrooms: 3, pets: true, furnished: true, balcony: true, gym: true, near_metro: true, newer: true },
  { id: 4, area: "Wakad", rent: 39000, floor: 7, lift: true, parking: true, bathrooms: 2, pets: true, furnished: true, balcony: false, gym: true, near_metro: false, newer: true },
  { id: 5, area: "Hinjewadi", rent: 36000, floor: 11, lift: true, parking: true, bathrooms: 3, pets: false, furnished: false, balcony: true, gym: true, near_metro: false, newer: true },
  { id: 6, area: "Balewadi", rent: 48000, floor: 4, lift: true, parking: true, bathrooms: 3, pets: true, furnished: true, balcony: true, gym: true, near_metro: true, newer: true },
  { id: 7, area: "Viman Nagar", rent: 62000, floor: 6, lift: true, parking: true, bathrooms: 3, pets: true, furnished: true, balcony: true, gym: true, near_metro: true, newer: false },
  { id: 8, area: "Kalyani Nagar", rent: 68000, floor: 2, lift: true, parking: false, bathrooms: 3, pets: false, furnished: true, balcony: true, gym: false, near_metro: false, newer: true },
  { id: 9, area: "Koregaon Park", rent: 72000, floor: 3, lift: true, parking: true, bathrooms: 3, pets: true, furnished: true, balcony: true, gym: true, near_metro: true, newer: false },
  { id: 10, area: "Kharadi", rent: 47000, floor: 9, lift: true, parking: true, bathrooms: 2, pets: true, furnished: false, balcony: true, gym: true, near_metro: false, newer: true },
  { id: 11, area: "Shivajinagar", rent: 52000, floor: 1, lift: false, parking: false, bathrooms: 2, pets: false, furnished: true, balcony: false, gym: false, near_metro: true, newer: false },
  { id: 12, area: "Aundh", rent: 49500, floor: 2, lift: null, parking: true, bathrooms: 3, pets: true, furnished: false, balcony: true, gym: false, near_metro: true, newer: false },
  { id: 13, area: "Shivajinagar", rent: 57000, floor: 4, lift: true, parking: true, bathrooms: 3, pets: true, furnished: true, balcony: true, gym: false, near_metro: true, newer: false },
  { id: 14, area: "Magarpatta", rent: 45000, floor: 8, lift: true, parking: true, bathrooms: 3, pets: true, furnished: true, balcony: true, gym: true, near_metro: false, newer: true },
  { id: 15, area: "Aundh", rent: 46000, floor: 3, lift: true, parking: null, bathrooms: 2, pets: false, furnished: true, balcony: false, gym: true, near_metro: true, newer: false },
  { id: 16, area: "Baner", rent: 44000, floor: 6, lift: true, parking: true, bathrooms: 2, pets: false, furnished: false, balcony: true, gym: true, near_metro: false, newer: true },
  { id: 17, area: "Wakad", rent: 41000, floor: 2, lift: false, parking: true, bathrooms: 3, pets: true, furnished: false, balcony: true, gym: false, near_metro: false, newer: false },
  { id: 18, area: "Kothrud", rent: 39000, floor: 4, lift: true, parking: false, bathrooms: 2, pets: true, furnished: true, balcony: false, gym: false, near_metro: true, newer: false },
  { id: 19, area: "Viman Nagar", rent: 55000, floor: 12, lift: true, parking: true, bathrooms: 2, pets: true, furnished: false, balcony: true, gym: true, near_metro: false, newer: true },
  { id: 20, area: "Balewadi", rent: 58000, floor: 10, lift: true, parking: true, bathrooms: 3, pets: false, furnished: true, balcony: true, gym: true, near_metro: false, newer: true },
];

function titleFor(area: string, index: number, sameAreaCountBefore: number): string {
  // Spec only names the rule for a second listing in the same area ("#2").
  // Aundh has three sample listings (ids 3, 12, 15), so the third gets "#3"
  // by extending that same numbering (see DECISIONS.md).
  return sameAreaCountBefore > 0
    ? `3BHK in ${area} #${sameAreaCountBefore + 1}`
    : `3BHK in ${area}`;
}

export const SAMPLE_LISTINGS: Listing[] = (() => {
  const seenAreaCount: Record<string, number> = {};
  return SAMPLE_ROWS.map((row) => {
    const before = seenAreaCount[row.area] ?? 0;
    seenAreaCount[row.area] = before + 1;
    return {
      id: row.id,
      group_id: null,
      title: titleFor(row.area, row.id, before),
      area: row.area,
      rent: row.rent,
      floor: row.floor,
      lift: row.lift,
      parking: row.parking,
      pets: row.pets,
      bathrooms: row.bathrooms,
      furnished: row.furnished,
      balcony: row.balcony,
      gym: row.gym,
      near_metro: row.near_metro,
      newer: row.newer,
      url: null,
      is_sample: true,
      status: "active" as const,
    };
  });
})();

export const DEMO: { name: string; answers: Answers }[] = [
  {
    name: "Riya",
    answers: {
      max_rent: 19000,
      no_go: [],
      lift_above_floor: null,
      parking: false,
      pets: false,
      min_bathrooms: null,
      commute: [{ landmark: "viman_nagar", max_min: 20 }],
      private: [],
      prefs: { furnished: 2, balcony: 2, gym: 4, near_metro: 0, newer: 2, lower_rent: 0 },
    },
  },
  {
    name: "Meera",
    answers: {
      max_rent: 17000,
      no_go: [],
      lift_above_floor: 2,
      parking: false,
      pets: false,
      min_bathrooms: null,
      commute: [],
      private: ["lift_above_floor"],
      prefs: { furnished: 3, balcony: 3, gym: 0, near_metro: 4, newer: 0, lower_rent: 0 },
    },
  },
  {
    name: "Kavita",
    answers: {
      max_rent: 18000,
      no_go: [],
      lift_above_floor: null,
      parking: true,
      pets: false,
      min_bathrooms: null,
      commute: [{ landmark: "hinjewadi", max_min: 30 }],
      private: [],
      prefs: { furnished: 2, balcony: 2, gym: 3, near_metro: 0, newer: 3, lower_rent: 0 },
    },
  },
];
