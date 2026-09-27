# REPORT

## Still needed to go live

Nothing in this repo was deployed. To go live you need:

1. **A Supabase project.** Create one (dashboard or `supabase` CLI), then
   collect:
   - `SUPABASE_URL` — the project's API URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Settings → API → service role key
     (**never** the anon key — the app needs to bypass RLS from the server)
   - `SUPABASE_DB_URL` — Settings → Database → connection string (used only
     to run the SQL migration, not by the running app)
2. Put those three values in `.env.local` (copy `.env.example`), then run:
   ```bash
   npm run db:setup
   ```
   This applies `supabase/schema.sql` then `supabase/seed.sql` via `psql`.
   `supabase/seed.sql` is generated from `src/lib/seed-data.ts` — if you
   change the sample listings or commute table, edit that file and run
   `npm run gen:seed` to regenerate it, rather than hand-editing the SQL.
3. **A Vercel project:**
   ```bash
   vercel link
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   # SUPABASE_DB_URL is only needed locally for db:setup, not by the deployed app
   vercel deploy --prod
   ```
4. Once deployed, re-run the acceptance checklist below against the real
   URL — items marked "needs live DB" can only be confirmed there.

Nothing above was attempted in this session, per the task's boundaries.

## What was built

Everything in the spec's Build order (§11), steps 1–10, against the
in-memory store described in `DECISIONS.md` (used automatically whenever
Supabase env vars are absent — which is the state of this repo right now).

- `src/lib/engine.ts` — the matching engine (dealbreaker checks, tiers,
  scoring, ranking, picking, conflict gate)
- `src/lib/whatif.ts` — what-if generation (time singles/pairs, money,
  dedupe, sort, top-2)
- `src/lib/format.ts` — all user-facing wording
- `src/lib/seed-data.ts` — sample listings, commute table, DEMO personas
- `src/lib/store-types.ts`, `store.ts`, `memory-store.ts`,
  `supabase-store.ts`, `db.ts` — the data layer
- `src/app/*` — all five screens from §6 (start, share, form, waiting
  room, results), plus server actions in `src/app/actions.ts`
- `supabase/schema.sql`, `supabase/seed.sql` (+ `scripts/gen-seed-sql.ts`
  to keep the latter generated from `seed-data.ts`)
- `tests/engine.test.ts` — fixtures T1–T8, V1–V3, P1

## Test results

```
npm test
```
**22/22 passing** — every fixture in the spec (T1–T8, V1–V3, P1), including
the exact option lists, tiers, benders, scores, unknown counts, loads,
warnings, and what-if unlock counts/order given in the spec. See
`tests/engine.test.ts`.

```
npm run build
```
**Green.** Production build compiles, type-checks, and generates all
routes with no errors.

## Manual/browser smoke testing (this session)

Done against `next start` (production build) on a local port, driven
through the actual UI in a real browser (not just curl):

- **Demo flow:** "Try the demo" → results show the conflict card with
  exact wording "Riya's and Kavita's commute limits can't both be met
  anywhere in Pune: Riya needs 20 min or less, Kavita needs 30 min or
  less," followed by the two Time what-ifs in the order and wording the
  spec's own example uses, and no Money what-ifs. Matches fixture T1.
- **Apply the first what-if (demo only):** produces a new round, shows
  "What changed in round 2" with both changed commute limits, and the
  results become `ok` with exactly `[Aundh A, Aundh A, Balewadi B]` —
  matching the acceptance checklist's expected outcome and fixture T2.
- **Real group creation → share page → 3 member forms → waiting room →
  results:** creating a group gives 3 distinct member links plus a
  results link and a WhatsApp share link; results correctly stay hidden
  (waiting room, "N of 3 in") until all three submit, then unlock.
- **Live elimination line:** updates on every keystroke/click using only
  that member's own answers, matches the engine's `eliminationCount`.
- **Points validation:** the Submit button stays disabled until points
  total exactly 10; a 6th `+` click on the same item is a no-op (capped).
- **Unknown data → "to verify," never a pass:** confirmed (e.g. a listing
  with `parking: null` shows "Parking not stated: confirm before
  visiting" under To verify, not under Gets).
- **Organiser-only tools:** with the organiser's `?t=` token, "Organiser
  tools → + Add listing" and a "Mark gone" button appear on every card;
  without it (or with a wrong token), neither appears. Add-listing was
  exercised end-to-end (new listing appears immediately, listing count
  updates, results re-rank). Mark-gone was exercised end-to-end (tap
  once → button relabels to "Tap again to confirm" → tap again → listing
  disappears from results and a different listing fills the freed slot).
- **Start new round (any member):** re-opens all three forms
  (submitted_at cleared, answers retained as pre-fill) and returns the
  group to the waiting room.
- **Invalid link:** an unknown group code, and a valid code with a wrong
  `?t=`, both show "This link isn't valid. Ask Riya for your link." with
  no data leaked.
- **Mobile width (360px):** start page, results page (3-column grid
  collapses to 1 column, no horizontal scroll), and the demo conflict
  view were all checked at 360×740 and render cleanly. Screenshots were
  reviewed in this session but not saved into `docs/` — see
  `DECISIONS.md` for why (no Playwright dependency).
- **No forbidden words:** `grep -rniE "\b(best|recommended|top pick|winner)\b" src/`
  returns no user-facing matches (only an internal variable named `best`
  in `engine.ts`, never rendered).

Not exercised in the browser in this session (would need a live Supabase
project, or are low-risk paths verified by code review instead): the
Supabase-backed store end-to-end; `no_listings` and pure `budget_clash`
conflict screens (covered by engine fixtures T6 and T8, but not clicked
through in the UI); RLS policies (there are no anon policies to test,
by design).

## Acceptance checklist (adapted per §10 — no live deploy yet)

- [x] "Try the demo" shows the Riya–Kavita commute clash and a joint
      what-if that opens Aundh
- [x] "Apply the first what-if" shows Aundh A, Aundh A, Balewadi B
- [x] Creating a real group gives 3 links; results stay hidden until all
      3 submit
- [x] Points can't total anything other than 10, or exceed 6 on one item
- [x] A flat with unknown data shows "confirm before visiting," never a
      pass
- [x] No screen contains "best," "recommended," or "winner" (grepped the
      source; nothing in `src/app` or `src/components` renders those
      words)
- [x] Every option card shows gets, gives up, bends and to verify for all
      3 people (bends/to-verify lists are empty and simply omitted when
      there's nothing to show for that person, per spec)
- [x] The one-person compromise warning appears in the T5 situation
      (covered by the engine test and consistent with the UI's `warning`
      branch, which was exercised in the browser via a similar scenario)
- [~] Usable at 360px wide — verified manually in-browser (see above);
      not saved as a Playwright screenshot in `docs/`
- [x] "Sample data" and "approx. peak-hour minutes" labels are visible
      (sample badge shown on every card; commute figures are labelled
      "approx. peak-hour minutes" in the commute table's own description
      shown to the user on the form — see `MemberForm`'s helper text)
- [x] `npm test` is green and `npm run build` succeeds

Items that need the real Supabase project + a deployed URL to fully
re-verify: nothing above is blocked on it today (the app runs fully on
the in-memory store), but a production run should re-check the same list
end-to-end against `supabase-store.ts` once credentials exist, since that
code path itself has not been exercised live.

## Deviations from spec (see DECISIONS.md for full detail)

- Money what-if: implemented as the single candidate the formula in §5.8
  literally describes (0 or 1 of them), not a search for up to 2 distinct
  scenarios — no fixture or rule implies a second one.
- Aundh's third sample listing is titled "#3" rather than reusing "#2"
  (spec only defines the rule for exactly two listings in one area).
- In-memory data store used for local dev/testing in place of a live
  Supabase project (which the task's boundaries say not to create).
- "Mark gone" uses a tap-twice inline confirmation instead of
  `window.confirm()`.
- The 360px check was manual (screenshots reviewed in-session), not a
  saved Playwright artifact.

## GitHub

Repository created and pushed: see the URL in the final summary message
(commands used: `gh repo create shared-flat-finder --public
--source=. --remote=origin`, then `git push -u origin main`).
