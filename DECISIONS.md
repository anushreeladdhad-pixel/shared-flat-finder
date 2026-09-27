# Decisions log

Ambiguities encountered while building Shared-Flat Finder, and the simplest
resolution chosen for each. The test fixtures in the spec were authoritative
and were re-derived against until green; nothing here contradicts them.

## Engine

- **Money what-if count.** §5.8 describes a single computation (raise every
  member below `need`, where `need` comes from the *minimum* share among
  compatible-area listings) and separately says "keep at most 2 Money
  candidates." As literally specified, that computation only ever produces
  one candidate. Fixture T6 confirms exactly one Money what-if is expected.
  I implemented it as a single candidate (0 or 1), which trivially satisfies
  "at most 2." I did not invent a second scenario (e.g. from the
  second-cheapest listing) since no fixture calls for one and the spec
  gives no rule for deriving it.
- **Time what-if step direction.** Pair candidates apply the *same* step to
  both members' commute limits (never independent steps), per "every pair
  of commute limits held by two different members, both + s." Confirmed by
  T1 and T3 fixtures.
- **`private` field naming for commute entries.** The spec's `private`
  array holds field names like `"lift_above_floor"`. For commute limits
  (which come in a list, not a single field) I use `"commute:<landmark>"`
  per entry, e.g. `"commute:hinjewadi"`. This is only used for display
  masking (§5.8 privacy) and never affects engine results.
- **Multi-field private what-if masking.** The spec gives wording for a
  what-if touching a single private field ("a change to one of Meera's
  private limits would open N flats") but not for a what-if that touches
  several members' fields, some private and some not. I mask the whole
  what-if line whenever any of its changes belongs to a private field of a
  member other than the viewer, showing the generic wording for the first
  such member. This is conservative (never over-shares) rather than
  precisely specified.

## Seed data

- **Aundh has three sample listings (ids 3, 12, 15), not two.** The spec's
  naming rule only covers "the second listing in the same area" (→ ` #2`).
  I extended the same numbering to a third listing (→ ` #3`) rather than
  reusing `#2` for both, since reusing it would make two different sample
  listings share a title. Areas with exactly two listings (Baner, Kothrud,
  Wakad, Balewadi, Viman Nagar, Shivajinagar) are unaffected.

## Data layer

- **Two Store implementations behind one interface.** The boundaries
  explicitly forbid creating a Supabase project, so there is currently no
  live database to develop or test against. Rather than only writing the
  Supabase-backed code path and leaving the app unusable/untestable until
  credentials exist, I added a small in-memory `Store` implementation
  (`src/lib/memory-store.ts`) that the app uses automatically whenever
  `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset (see
  `src/lib/db.ts`). This is what "degrade gracefully" is built against: the
  app is fully functional today (create a group, fill in three forms, see
  results, add/mark-gone listings, start new rounds) without any external
  service, and every route handler and server action already runs the
  exact same business logic (validation, round-change diffing) that the
  Supabase-backed store uses, from `src/lib/store-types.ts`. This state is
  process-local and resets on server restart — it is a development/testing
  convenience, not a production data store. `src/lib/supabase-store.ts` is
  the real implementation for when credentials are supplied; it was written
  carefully against the schema but has not been exercised against a live
  Supabase project (see REPORT.md).
- **Listing ids.** The memory store assigns the next integer id itself
  (`nextListingId`), since there is no serial sequence to rely on. The
  Supabase store omits `id` on insert and lets Postgres's `serial` column
  assign it, which is simpler and can't drift from the sequence the seed
  data set with `setval(...)`.
- **`round_changes.private` column.** Not explicit in the spec's schema
  block but necessary to implement "changes to private fields show as
  '<name> changed a private limit'" without re-deriving it from the
  member's current `private` list (which may itself have changed since).
  Added as a plain boolean column.

## UI

- **Server actions passed to Client Components must be bound references.**
  A closure like `() => someServerAction(x)` cannot cross the server/client
  boundary (React only special-cases the action function itself, or a
  `.bind()` of it). All buttons that trigger a server action from inside a
  Server Component use `.bind(null, ...args)` instead of an inline arrow
  function.
- **"Mark gone" confirmation.** The spec doesn't mandate a confirmation
  step, but marking a shared sample listing gone affects the whole group,
  so some friction seemed warranted. I used a tap-twice inline pattern
  (button relabels to "Tap again to confirm" for 4 seconds) rather than
  `window.confirm()`, since native confirm dialogs are unreliable inside
  mobile in-app browsers (the whole point of this app is links opened from
  WhatsApp) and inside automated testing.
- **Group code / member token in the same URL segment style.** Routes
  match the spec's `/g/[code]/share?t=`, `/g/[code]/m/[token]`, and
  `/g/[code]` exactly. The `?t=` query param on the results route
  additionally identifies the viewer (organiser or a specific member) for
  showing organiser tools and un-masking that member's own private
  what-ifs; the spec implies but doesn't fully specify this second use, so
  I extended the same param to both purposes rather than adding a second
  query param.
- **Wording deviations.** A couple of example strings in the spec (e.g.
  "Hinjewadi limit 30 → 45 min" for the round-change line) use a shorter
  landmark name than the full display label ("Hinjewadi IT Park") used
  elsewhere on the page. I kept the full label everywhere for consistency
  rather than maintaining two label sets; the fixtures don't pin down exact
  wording for this line.

## Not done (see REPORT.md for the full list)

- No Supabase project was created and no Vercel deployment was attempted,
  per the explicit boundaries in the task.
- `supabase-store.ts` has not been run against a live project.
- The 360px mobile check was done by hand in a browser (with screenshots
  reviewed in-session) rather than via a Playwright script saved to
  `docs/`, since Playwright is not in the approved dependency list and
  installing it (plus a browser binary) for one screenshot seemed like
  more than "truly required."
