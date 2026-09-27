"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AREAS } from "@/lib/seed-data";
import { addListingAction } from "@/app/actions";

type TriState = "yes" | "no" | "unknown";
function triToValue(t: TriState): boolean | null {
  return t === "yes" ? true : t === "no" ? false : null;
}

const TRI_FIELDS: { key: string; label: string }[] = [
  { key: "lift", label: "Lift" },
  { key: "parking", label: "Parking" },
  { key: "pets", label: "Pets allowed" },
];

const BOOL_FIELDS: { key: string; label: string }[] = [
  { key: "furnished", label: "Furnished" },
  { key: "balcony", label: "Balcony" },
  { key: "gym", label: "Gym" },
  { key: "near_metro", label: "Near metro" },
  { key: "newer", label: "Newer building" },
];

export function AddListingForm({ code, organiserToken }: { code: string; organiserToken: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<string>(AREAS[0]);
  const [rent, setRent] = useState<number>(45000);
  const [floor, setFloor] = useState<number>(1);
  const [bathrooms, setBathrooms] = useState<string>("unknown");
  const [tri, setTri] = useState<Record<string, TriState>>({
    lift: "unknown",
    parking: "unknown",
    pets: "unknown",
  });
  const [bools, setBools] = useState<Record<string, boolean>>({
    furnished: false,
    balcony: false,
    gym: false,
    near_metro: false,
    newer: false,
  });
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
      >
        + Add listing
      </button>
    );
  }

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Give the listing a title.");
      return;
    }
    startTransition(async () => {
      const result = await addListingAction(code, organiserToken, {
        title: title.trim(),
        area,
        rent,
        floor,
        lift: triToValue(tri.lift),
        parking: triToValue(tri.parking),
        pets: triToValue(tri.pets),
        bathrooms: bathrooms === "unknown" ? null : Number(bathrooms),
        furnished: bools.furnished,
        balcony: bools.balcony,
        gym: bools.gym,
        near_metro: bools.near_metro,
        newer: bools.newer,
        url: url.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-4">
      <h3 className="text-sm font-bold text-slate-900">Add a listing</h3>
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Area
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5"
        >
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Rent (total, ₹/mo)
          <input
            type="number"
            value={rent}
            onChange={(e) => setRent(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Floor
          <input
            type="number"
            value={floor}
            onChange={(e) => setFloor(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-2 py-1.5"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Bathrooms
        <select
          value={bathrooms}
          onChange={(e) => setBathrooms(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5"
        >
          <option value="unknown">Unknown</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </label>
      {TRI_FIELDS.map((f) => (
        <label key={f.key} className="flex items-center justify-between text-sm">
          {f.label}
          <select
            value={tri[f.key]}
            onChange={(e) => setTri((t) => ({ ...t, [f.key]: e.target.value as TriState }))}
            className="rounded-md border border-slate-300 px-2 py-1"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      ))}
      {BOOL_FIELDS.map((f) => (
        <label key={f.key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={bools[f.key]}
            onChange={(e) => setBools((b) => ({ ...b, [f.key]: e.target.checked }))}
          />
          {f.label}
        </label>
      ))}
      <label className="flex flex-col gap-1 text-sm">
        Listing URL (optional)
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5"
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add listing"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
