import type { WhatIf } from "@/lib/engine";
import { privateWhatIfMask } from "@/lib/format";

export type AnnotatedWhatIf = WhatIf & { privateMembers: string[] };

type Viewer = { memberName: string | null };

function visibleText(whatIf: AnnotatedWhatIf, viewer: Viewer): string {
  if (whatIf.privateMembers.length === 0) return whatIf.text;
  const viewerCanSee = whatIf.privateMembers.every((name) => viewer.memberName === name);
  if (viewerCanSee) return whatIf.text;
  const name = whatIf.privateMembers[0];
  const count = whatIf.unlocks.length;
  return `${privateWhatIfMask(name)} ${count} flat${count === 1 ? "" : "s"}.`;
}

export function WhatIfSection({
  time,
  money,
  viewer,
}: {
  time: AnnotatedWhatIf[];
  money: AnnotatedWhatIf[];
  viewer: Viewer;
}) {
  if (time.length === 0 && money.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {time.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-800">Time</h4>
          <ul className="mt-1 flex flex-col gap-1.5">
            {time.map((wi, i) => (
              <li key={i} className="rounded-md bg-slate-50 p-2 text-sm text-slate-700">
                {visibleText(wi, viewer)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {money.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-800">Money</h4>
          <ul className="mt-1 flex flex-col gap-1.5">
            {money.map((wi, i) => (
              <li key={i} className="rounded-md bg-slate-50 p-2 text-sm text-slate-700">
                {visibleText(wi, viewer)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
