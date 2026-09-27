"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions";

export function ActionButton({
  action,
  label,
  pendingLabel,
  className,
  confirmMessage,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  className?: string;
  confirmMessage?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
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
      {isPending ? (pendingLabel ?? "Working...") : label}
    </button>
  );
}
