"use client";

import { useMemo, useState, useTransition } from "react";
import { AREAS, LANDMARK_KEYS, LANDMARK_LABELS, type Answers } from "@/lib/seed-data";
import { eliminationCount, biggestCutLabel, type Member } from "@/lib/engine";
import type { Listing } from "@/lib/seed-data";
import { submitAnswersAction } from "@/app/actions";

const PREF_ITEMS: { key: keyof Answers["prefs"]; label: string }[] = [
  { key: "furnished", label: "Furnished" },
  { key: "balcony", label: "Balcony" },
  { key: "gym", label: "Gym" },
  { key: "near_metro", label: "Near metro" },
  { key: "newer", label: "Newer building" },
  { key: "lower_rent", label: "Lower rent" },
];

const LIFT_OPTIONS = [
  { value: "none", label: "Not needed" },
  { value: "0", label: "Needed above floor 0" },
  { value: "1", label: "Needed above floor 1" },
  { value: "2", label: "Needed above floor 2" },
  { value: "3", label: "Needed above floor 3" },
];

const BATHROOM_OPTIONS = [
  { value: "none", label: "No minimum" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
];

function blank(): Answers {
  return {
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
}

export function MemberForm({
  code,
  token,
  memberName,
  initialAnswers,
  listings,
  readOnly,
  alreadySubmitted = false,
  resultsUrl,
}: {
  code: string;
  token: string;
  memberName: string;
  initialAnswers: Answers | null;
  listings: Listing[];
  readOnly: boolean;
  alreadySubmitted?: boolean;
  resultsUrl?: string;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers ?? blank());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalPoints = PREF_ITEMS.reduce((sum, p) => sum + (answers.prefs[p.key] ?? 0), 0);
  const canSubmit = totalPoints === 10 && answers.max_rent > 0;

  const currentMember: Member = useMemo(
    () => ({ name: memberName, answers }),
    [memberName, answers]
  );
  const elimination = useMemo(
    () => eliminationCount(currentMember, listings),
    [currentMember, listings]
  );
  const cut = biggestCutLabel(elimination.byField);

  function isPrivate(field: string) {
    return answers.private.includes(field);
  }
  function togglePrivate(field: string) {
    setAnswers((a) => ({
      ...a,
      private: a.private.includes(field)
        ? a.private.filter((f) => f !== field)
        : [...a.private, field],
    }));
  }

  function updatePref(key: keyof Answers["prefs"], delta: number) {
    setAnswers((a) => {
      const current = a.prefs[key] ?? 0;
      const next = Math.max(0, Math.min(6, current + delta));
      return { ...a, prefs: { ...a.prefs, [key]: next } };
    });
  }

  function toggleNoGo(area: string) {
    setAnswers((a) => ({
      ...a,
      no_go: a.no_go.includes(area)
        ? a.no_go.filter((x) => x !== area)
        : [...a.no_go, area],
    }));
  }

  function setCommuteLandmark(index: number, landmark: string) {
    setAnswers((a) => {
      const commute = [...a.commute];
      commute[index] = { ...commute[index], landmark };
      return { ...a, commute };
    });
  }
  function setCommuteMax(index: number, max_min: number) {
    setAnswers((a) => {
      const commute = [...a.commute];
      commute[index] = { ...commute[index], max_min };
      return { ...a, commute };
    });
  }
  function addCommute() {
    if (answers.commute.length >= 2) return;
    setAnswers((a) => ({
      ...a,
      commute: [...a.commute, { landmark: LANDMARK_KEYS[0], max_min: 30 }],
    }));
  }
  function removeCommute(index: number) {
    setAnswers((a) => ({
      ...a,
      commute: a.commute.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitAnswersAction(code, token, answers);
      if (!result.ok) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  if (readOnly) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Your form is in for this round.</p>
        <p className="mt-1">
          Results are open. If the group wants to change anything, start a new
          round from{" "}
          {resultsUrl ? (
            <a href={resultsUrl} className="underline">
              the results page
            </a>
          ) : (
            "the results page"
          )}
          .
        </p>
      </div>
    );
  }

  if (saved || alreadySubmitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        Thanks, {memberName} &mdash; your answers are in. Results open once
        everyone has submitted.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-28">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Part 1 &middot; Dealbreakers</h2>
          <p className="mt-1 text-xs text-slate-500">
            A dealbreaker means you&rsquo;d say no even if everything else is
            perfect.
          </p>
        </div>

        <Field
          label="Max rent share, per person (₹)"
          private={isPrivate("max_rent")}
          onTogglePrivate={() => togglePrivate("max_rent")}
        >
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            value={answers.max_rent || ""}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, max_rent: Number(e.target.value) || 0 }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            aria-label="Max rent share per person in rupees"
          />
        </Field>

        <Field
          label="No-go areas"
          private={isPrivate("no_go")}
          onTogglePrivate={() => togglePrivate("no_go")}
        >
          <div className="grid grid-cols-2 gap-2">
            {AREAS.map((area) => (
              <label key={area} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={answers.no_go.includes(area)}
                  onChange={() => toggleNoGo(area)}
                  aria-label={`No-go: ${area}`}
                />
                {area}
              </label>
            ))}
          </div>
        </Field>

        <Field
          label="Lift"
          private={isPrivate("lift_above_floor")}
          onTogglePrivate={() => togglePrivate("lift_above_floor")}
        >
          <select
            value={answers.lift_above_floor === null ? "none" : String(answers.lift_above_floor)}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                lift_above_floor: e.target.value === "none" ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            aria-label="Lift requirement"
          >
            {LIFT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Parking"
          private={isPrivate("parking")}
          onTogglePrivate={() => togglePrivate("parking")}
        >
          <Toggle
            checked={answers.parking}
            onChange={(v) => setAnswers((a) => ({ ...a, parking: v }))}
            label="I need parking"
          />
        </Field>

        <Field
          label="Pets"
          private={isPrivate("pets")}
          onTogglePrivate={() => togglePrivate("pets")}
        >
          <Toggle
            checked={answers.pets}
            onChange={(v) => setAnswers((a) => ({ ...a, pets: v }))}
            label="Pets must be allowed"
          />
        </Field>

        <Field
          label="Minimum bathrooms"
          private={isPrivate("min_bathrooms")}
          onTogglePrivate={() => togglePrivate("min_bathrooms")}
        >
          <select
            value={answers.min_bathrooms === null ? "none" : String(answers.min_bathrooms)}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                min_bathrooms: e.target.value === "none" ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            aria-label="Minimum bathrooms"
          >
            {BATHROOM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">
              Commute limits (up to 2)
            </span>
            {answers.commute.length < 2 && (
              <button
                type="button"
                onClick={addCommute}
                className="text-xs font-semibold text-slate-700 underline"
              >
                + Add a limit
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">Pick the landmark nearest to the place.</p>
          {answers.commute.map((c, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <select
                  value={c.landmark}
                  onChange={(e) => setCommuteLandmark(i, e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 px-2 py-2 text-sm"
                  aria-label={`Landmark ${i + 1}`}
                >
                  {LANDMARK_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {LANDMARK_LABELS[k]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeCommute(i)}
                  className="text-xs text-red-600"
                  aria-label={`Remove commute limit ${i + 1}`}
                >
                  Remove
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span>Max</span>
                <select
                  value={c.max_min}
                  onChange={(e) => setCommuteMax(i, Number(e.target.value))}
                  className="rounded-md border border-slate-300 px-2 py-1"
                  aria-label={`Max minutes for landmark ${i + 1}`}
                >
                  {Array.from({ length: (90 - 15) / 5 + 1 }, (_, k) => 15 + k * 5).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <span>min</span>
                <span className="ml-auto flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={isPrivate(`commute:${c.landmark}`)}
                    onChange={() => togglePrivate(`commute:${c.landmark}`)}
                  />
                  Keep private
                </span>
              </label>
            </div>
          ))}
        </div>
      </section>

      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        aria-live="polite"
      >
        Your dealbreakers rule out {elimination.total} of {listings.length} flats.
        {cut && cut.count > 0 && (
          <> Biggest cut: {cut.label} ({cut.count}).</>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Part 2 &middot; Preferences</h2>
          <p className="mt-1 text-xs text-slate-500">
            Split 10 points across what matters to you. Max 6 on any one item.
          </p>
        </div>
        <div
          className={`rounded-md px-3 py-2 text-sm font-semibold ${
            totalPoints === 10
              ? "bg-green-50 text-green-800"
              : "bg-slate-100 text-slate-700"
          }`}
          aria-live="polite"
        >
          {totalPoints} of 10 points used
        </div>
        <div className="flex flex-col gap-3">
          {PREF_ITEMS.map((p) => (
            <div
              key={p.key}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
            >
              <span className="text-sm font-medium text-slate-800">{p.label}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => updatePref(p.key, -1)}
                  aria-label={`Decrease ${p.label}`}
                  className="h-8 w-8 rounded-full border border-slate-300 text-lg leading-none"
                >
                  &minus;
                </button>
                <span className="w-4 text-center text-sm font-semibold">
                  {answers.prefs[p.key]}
                </span>
                <button
                  type="button"
                  onClick={() => updatePref(p.key, 1)}
                  aria-label={`Increase ${p.label}`}
                  className="h-8 w-8 rounded-full border border-slate-300 text-lg leading-none"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            disabled={!canSubmit || isPending}
            onClick={handleSubmit}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {isPending ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  private: isPrivateField,
  onTogglePrivate,
  children,
}: {
  label: string;
  private: boolean;
  onTogglePrivate: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <input type="checkbox" checked={isPrivateField} onChange={onTogglePrivate} />
          Keep private
        </label>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      {label}
    </label>
  );
}
