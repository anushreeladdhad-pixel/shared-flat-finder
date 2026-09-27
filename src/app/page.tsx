import { createDemoAction, createGroupAction } from "./actions";

export default function StartPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold leading-tight text-slate-900">
          One form each. No listing until everyone&rsquo;s limits are in.
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Three friends, three private forms. Once all three are in, you get
          up to three flats worth discussing &mdash; with a clear view of
          what each person gets and gives up. No AI, no scraping, no chat.
          This tool narrows the options; you decide.
        </p>
      </div>

      <form action={createGroupAction} className="flex flex-col gap-4">
        <NameFields />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white active:bg-slate-700"
        >
          Create group
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        or
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form action={createDemoAction}>
        <button
          type="submit"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 active:bg-slate-100"
        >
          Try the demo
        </button>
      </form>
      <p className="text-xs text-slate-500">
        The demo loads Riya, Meera and Kavita&rsquo;s answers already
        submitted, so you can see a results screen right away.
      </p>
    </main>
  );
}

function NameFields() {
  const defaults = ["Riya", "Meera", "Kavita"];
  return (
    <div className="flex flex-col gap-3">
      {defaults.map((d, i) => (
        <label key={i} className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">
            Person {i + 1} {i === 0 ? "(organiser)" : ""}
          </span>
          <input
            name={`name-${i}`}
            defaultValue={d}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-base"
            aria-label={`Name for person ${i + 1}`}
          />
        </label>
      ))}
    </div>
  );
}
