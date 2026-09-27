import { getStore } from "@/lib/db";
import { baseUrl } from "@/lib/url";
import { CopyButton } from "@/components/CopyButton";
import { InvalidLink } from "@/components/InvalidLink";

export default async function SharePage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { t?: string };
}) {
  const store = getStore();
  const full = await store.getGroupFull(params.code);
  if (!full) return <InvalidLink />;

  const organiser = full.members.find((m) => m.is_organiser);
  if (!organiser || organiser.token !== searchParams.t) {
    return <InvalidLink organiserName={organiser?.name} />;
  }

  const origin = baseUrl();
  const resultsUrl = `${origin}/g/${params.code}`;
  const memberUrls = full.members.map((m) => ({
    name: m.name,
    url: `${origin}/g/${params.code}/m/${m.token}`,
  }));

  const waMessage = encodeURIComponent(
    `Shared-Flat Finder: fill in your form (2 min) so we can see flats that work for all of us.\n` +
      memberUrls.map((m) => `${m.name}: ${m.url}`).join("\n") +
      `\n\nResults (open once everyone's in): ${resultsUrl}`
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Send each person her own link</h1>
        <p className="mt-2 text-sm text-slate-600">
          Answers stay private until all three are in.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {memberUrls.map((m) => (
          <li
            key={m.url}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{m.name}</div>
              <div className="truncate text-xs text-slate-500">{m.url}</div>
            </div>
            <CopyButton text={m.url} />
          </li>
        ))}
        <li className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">Results</div>
            <div className="truncate text-xs text-slate-500">{resultsUrl}</div>
          </div>
          <CopyButton text={resultsUrl} />
        </li>
      </ul>

      <a
        href={`https://wa.me/?text=${waMessage}`}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg bg-green-600 px-4 py-3 text-center text-sm font-semibold text-white active:bg-green-700"
      >
        Share on WhatsApp
      </a>
    </main>
  );
}
