"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions";

export function ActionButton({
  action,
  label,
  pendingLabel,
  className,
  confirmLabel,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  className?: string;
  /** When set, the first click arms the button (showing this label) and a
   * second click within a few seconds actually runs the action. Avoids
   * native confirm() dialogs, which behave inconsistently across mobile
   * WhatsApp in-app browsers. */
  confirmLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  function handleClick() {
    if (confirmLabel && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        window.alert(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        className ??
        "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50"
      }
    >
      {isPending ? (pendingLabel ?? "Working...") : armed ? (confirmLabel ?? label) : label}
    </button>
  );
}
