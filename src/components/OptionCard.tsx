import type { Option } from "@/lib/engine";
import { tierTag } from "@/lib/format";
import { ActionButton } from "./ActionButton";
import { markListingGoneAction } from "@/app/actions";

function yesNo(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return "?";
  return v ? "Yes" : "No";
}

export function OptionCard({
  option,
  isOrganiser,
  code,
  organiserToken,
}: {
  option: Option;
  isOrganiser: boolean;
  code: string;
  organiserToken: string;
}) {
  const l = option.listing;
  const share = Math.round(l.rent / 3);
  const names = Object.keys(option.per_member);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">{l.title}</h3>
          <p className="text-sm text-slate-600">
            {l.area} &middot; ₹{l.rent.toLocaleString("en-IN")}/mo &middot; ₹
            {share.toLocaleString("en-IN")} each
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Floor {l.floor} &middot; Lift {yesNo(l.lift)} &middot; Parking{" "}
            {yesNo(l.parking)} &middot; Bathrooms {l.bathrooms ?? "?"} &middot; Pets{" "}
            {yesNo(l.pets)}
          </p>
        </div>
        {l.is_sample && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            Sample data
          </span>
        )}
      </div>

      <div
        className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
          option.tier === "A"
            ? "bg-green-100 text-green-800"
            : "bg-amber-100 text-amber-800"
        }`}
      >
        {tierTag(option.tier, option.bender)}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {names.map((name) => {
          const pm = option.per_member[name];
          return (
            <div key={name} className="rounded-lg bg-slate-50 p-3">
              <div className="mb-2 text-sm font-bold text-slate-900">{name}</div>
              <ListBlock label="Gets" icon="✅" items={pm.gets} />
              <ListBlock label="Gives up" icon="⚠️" items={pm.gives_up} />
              <ListBlock label="Bends" icon="↔️" items={pm.bends} />
              <ListBlock label="To verify" icon="❓" items={pm.to_verify} />
            </div>
          );
        })}
      </div>

      {isOrganiser && (
        <div className="mt-4 flex justify-end">
          <ActionButton
            action={() => markListingGoneAction(code, organiserToken, l.id)}
            label="Mark gone"
            pendingLabel="Marking..."
            confirmMessage={`Mark "${l.title}" as gone? This affects everyone in the group.`}
          />
        </div>
      )}
    </div>
  );
}

function ListBlock({ label, icon, items }: { label: string; icon: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-xs font-semibold text-slate-500">
        {icon} {label}
      </div>
      <ul className="mt-0.5 list-inside list-disc text-xs text-slate-700">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
