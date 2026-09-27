import { getStore } from "@/lib/db";
import { InvalidLink } from "@/components/InvalidLink";
import { MemberForm } from "@/components/MemberForm";

export default async function MemberFormPage({
  params,
}: {
  params: { code: string; token: string };
}) {
  const store = getStore();
  const found = await store.getMemberByToken(params.code, params.token);
  if (!found) return <InvalidLink />;

  const { group, member, listings } = found;
  const resultsOpen = group.locked_at !== null;
  const alreadySubmitted = member.submitted_at !== null;

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-8">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Shared-Flat Finder &middot; Round {group.round}
      </p>
      <h1 className="mb-6 text-xl font-bold text-slate-900">
        Hi {member.name}, let&rsquo;s find your dealbreakers
      </h1>
      <MemberForm
        code={params.code}
        token={params.token}
        memberName={member.name}
        initialAnswers={member.answers}
        listings={listings}
        readOnly={resultsOpen}
        alreadySubmitted={alreadySubmitted}
        resultsUrl={`/g/${params.code}`}
      />
    </main>
  );
}
