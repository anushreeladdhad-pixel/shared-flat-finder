import { getStore } from "@/lib/db";
import { eliminationCount, matchGroup, type WhatIf } from "@/lib/engine";
import { toEngineMembers } from "@/lib/store-types";
import { InvalidLink } from "@/components/InvalidLink";
import { OptionCard } from "@/components/OptionCard";
import { WhatIfSection, type AnnotatedWhatIf } from "@/components/WhatIfSection";
import { ActionButton } from "@/components/ActionButton";
import { AddListingForm } from "@/components/AddListingForm";
import { startNewRoundAction, applyWhatIfAction } from "@/app/actions";
import type { MemberRecord } from "@/lib/store-types";

function annotate(whatIf: WhatIf, members: MemberRecord[]): AnnotatedWhatIf {
  const privateMembers = new Set<string>();
  for (const change of whatIf.changes) {
    const member = members.find((m) => m.name === change.member);
    const priv = member?.answers?.private ?? [];
    const field = change.field === "max_rent" ? "max_rent" : `commute:${change.field}`;
    if (priv.includes(field) || priv.includes("commute")) {
      privateMembers.add(change.member);
    }
  }
  return { ...whatIf, privateMembers: [...privateMembers] };
}

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { t?: string };
}) {
  let full;
  try {
    const store = getStore();
    full = await store.getGroupFull(params.code);
  } catch (err) {
    return (
      <ErrorScreen message="Couldn't load this group. If you just set up Supabase, double-check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." />
    );
  }
  if (!full) return <InvalidLink />;

  const { group, members, listings, roundChanges } = full;
  const viewerMember = searchParams.t
    ? members.find((m) => m.token === searchParams.t) ?? null
    : null;
  const isOrganiser = viewerMember?.is_organiser ?? false;
  const organiserToken = members.find((m) => m.is_organiser)?.token ?? "";

  const submittedCount = members.filter((m) => m.submitted_at !== null).length;

  if (submittedCount < 3 || !group.locked_at) {
    const notYet = members.find((m) => m.submitted_at === null);
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-10">
        <h1 className="text-xl font-bold text-slate-900">Waiting room</h1>
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm"
            >
              <span className="font-medium text-slate-800">{m.name}</span>
              <span
                className={
                  m.submitted_at
                    ? "font-semibold text-green-700"
                    : "font-semibold text-slate-400"
                }
              >
                {m.submitted_at ? "Submitted" : "Not yet"}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-600">
          {submittedCount} of 3 in.{" "}
          {notYet
            ? `Results open when ${notYet.name} submits.`
            : "Results will open shortly."}
        </p>
        <Footer />
      </main>
    );
  }

  const engineMembers = toEngineMembers(members);
  const result = matchGroup(engineMembers, listings);
  const organiserName = members.find((m) => m.position === 0)?.name ?? "the organiser";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">Results</h1>
        <ActionButton
          action={() => startNewRoundAction(params.code)}
          label="Start new round"
          pendingLabel="Starting..."
        />
      </div>

      {group.round > 1 && roundChanges.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <h2 className="font-semibold text-slate-800">What changed in round {group.round}</h2>
          <ul className="mt-1 list-inside list-disc text-slate-600">
            {roundChanges.map((c) => (
              <li key={c.id}>
                {c.private
                  ? `${c.member_name} changed a private limit`
                  : `${c.member_name}: ${describeRoundChange(c.field, c.old_value, c.new_value)}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {group.is_demo && result.status === "conflict" && result.what_ifs.time.length > 0 && (
        <ActionButton
          action={() => applyWhatIfAction(params.code, result.what_ifs.time[0])}
          label="Apply the first what-if"
          pendingLabel="Applying..."
          className="w-fit rounded-md border border-slate-900 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
        />
      )}

      {result.status === "no_listings" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          No active listings. {organiserName}, add some to continue.
        </div>
      )}

      {result.status === "conflict" && (
        <div className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">
            {conflictHeadline(result, engineMembers)}
          </p>
          <WhatIfSection
            time={result.what_ifs.time.map((w) => annotate(w, members))}
            money={result.what_ifs.money.map((w) => annotate(w, members))}
            viewer={{ memberName: viewerMember?.name ?? null }}
          />
          <p className="text-sm text-red-800">
            Talk it through; each person updates her own form in a new round.
          </p>
        </div>
      )}

      {result.status === "ok" && (
        <>
          <div className="flex flex-col gap-4">
            {result.options.map((opt) => (
              <OptionCard
                key={opt.listing.id}
                option={opt}
                isOrganiser={isOrganiser}
                code={params.code}
                organiserToken={organiserToken}
              />
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            Compromises across these options:{" "}
            {engineMembers.map((m) => `${m.name} ${result.load[m.name] ?? 0}`).join(" · ")}
          </div>

          {result.warning && (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Every option asks {warningMember(result.load)} to bend. Here are changes
                that could spread it:
              </p>
              {result.what_ifs && (
                <WhatIfSection
                  time={result.what_ifs.time.map((w) => annotate(w, members))}
                  money={result.what_ifs.money.map((w) => annotate(w, members))}
                  viewer={{ memberName: viewerMember?.name ?? null }}
                />
              )}
            </div>
          )}

          {!result.warning && result.what_ifs && (
            <WhatIfSection
              time={result.what_ifs.time.map((w) => annotate(w, members))}
              money={result.what_ifs.money.map((w) => annotate(w, members))}
              viewer={{ memberName: viewerMember?.name ?? null }}
            />
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <h3 className="font-semibold text-slate-800">Why other flats didn&rsquo;t make it</h3>
            <ul className="mt-1 flex flex-col gap-0.5 text-slate-600">
              {engineMembers.map((m) => {
                const count = eliminationCount(m, listings).total;
                return (
                  <li key={m.name}>
                    {m.name}&rsquo;s dealbreakers rule out {count} of {listings.length} flats.
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      {isOrganiser && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Organiser tools</h3>
          <AddListingForm code={params.code} organiserToken={organiserToken} />
        </div>
      )}

      <Footer />
    </main>
  );
}

function describeRoundChange(field: string, oldValue: unknown, newValue: unknown): string {
  if (field === "max_rent") return `max rent ₹${oldValue} → ₹${newValue}`;
  if (field.startsWith("commute:")) {
    const landmark = field.split(":")[1];
    return `${landmark} limit ${oldValue} → ${newValue} min`;
  }
  return `${field} ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`;
}

function conflictHeadline(
  result: Extract<ReturnType<typeof matchGroup>, { status: "conflict" }>,
  members: { name: string; answers: { commute: { landmark: string; max_min: number }[] } }[]
): string {
  if (result.area_clash) {
    const [a, b] = result.clashing_members;
    if (a && b) {
      const ma = members.find((m) => m.name === a);
      const mb = members.find((m) => m.name === b);
      const ca = ma?.answers.commute[0];
      const cb = mb?.answers.commute[0];
      if (ca && cb) {
        return `${a}'s and ${b}'s commute limits can't both be met anywhere in Pune: ${a} needs ${ca.max_min} min or less, ${b} needs ${cb.max_min} min or less.`;
      }
    }
    return "Commute limits can't all be met anywhere in Pune.";
  }
  if (result.budget_clash) {
    return "Your budgets are below every compatible flat.";
  }
  return "No flat meets everyone's limits yet.";
}

function warningMember(load: Record<string, number>): string {
  const entry = Object.entries(load).find(([, v]) => v > 0);
  return entry ? entry[0] : "someone";
}

function Footer() {
  return (
    <p className="mt-4 text-center text-xs text-slate-400">
      This tool narrows options. The decision is yours: talk through the tradeoffs together.
    </p>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Something&rsquo;s not set up yet</h1>
      <p className="text-sm text-slate-600">{message}</p>
    </main>
  );
}
