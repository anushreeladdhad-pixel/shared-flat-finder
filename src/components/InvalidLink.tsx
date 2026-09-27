export function InvalidLink({ organiserName = "Riya" }: { organiserName?: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <h1 className="text-lg font-semibold text-slate-900">
        This link isn&rsquo;t valid.
      </h1>
      <p className="text-sm text-slate-600">
        Ask {organiserName} for your link.
      </p>
    </main>
  );
}
