# Shared-Flat Finder

Three friends. One form each. A rule-based matching engine, not an AI product.
The tool narrows the options; the people decide.

## What this is

Riya, Meera and Kavita have been flat-hunting in Pune for months without
agreeing on anything, because nobody wrote down their dealbreakers before
looking at listings. This app collects each person's dealbreakers and
preferences privately, then — once all three have submitted — shows up to
three flats that survive everyone's hard limits, with a clear breakdown of
what each person gets, gives up, and is asked to bend on.

No logins, no AI calls, no scraping, no chat. See `DECISIONS.md` for the
non-goals and the calls made on ambiguous points, and `REPORT.md` for test
results, the acceptance checklist, and what's still needed to go live
(a real Supabase project and a Vercel deployment).

## Stack

- Next.js 14 (App Router, TypeScript, `src/`)
- Tailwind CSS
- Supabase Postgres, server-only access (route handlers / server actions)
- Vitest for the engine tests
- `nanoid` for group codes and member tokens

## Getting started

```bash
npm install
npm test        # engine tests (no DB required)
npm run build   # production build
npm run dev     # local dev server
```

The app runs and renders without a database configured — pages that need
data show a clear "not configured" message instead of crashing. To connect
a real Supabase project, fill in `.env.local` (copy `.env.example`) and run:

```bash
npm run db:setup   # applies supabase/schema.sql and supabase/seed.sql
```

## Project layout

```
src/lib/engine.ts        pure matching engine
src/lib/whatif.ts         what-if suggestions
src/lib/format.ts         wording helpers for gets/gives up/bends/to verify
src/lib/seed-data.ts      sample listings, commute table, demo personas
src/lib/db.ts             server-only Supabase client + queries
src/app/...               routes (start, share, form, waiting room, results)
tests/engine.test.ts      engine fixtures (must all pass)
supabase/schema.sql       table definitions
supabase/seed.sql         seed data, generated to match seed-data.ts
```

## Principles

- **Dealbreakers first** — no listing is shown until all three sets of
  answers are in.
- **No winner** — the tool never labels a flat as the best one.
- **Explainable** — every pass, fail and score traces back to a stated rule.
- **Fair** — ranking protects the worst-off person, not the average.
