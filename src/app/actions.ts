"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStore, ValidationError } from "@/lib/db";
import type { Answers } from "@/lib/seed-data";
import type { NewListingInput } from "@/lib/store-types";
import type { WhatIf } from "@/lib/engine";

export type ActionResult = { ok: true } | { ok: false; error: string };

function friendlyError(err: unknown): string {
  if (err instanceof ValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export async function createGroupAction(formData: FormData) {
  const names = [
    String(formData.get("name-0") ?? "").trim(),
    String(formData.get("name-1") ?? "").trim(),
    String(formData.get("name-2") ?? "").trim(),
  ];
  if (names.some((n) => n.length === 0)) {
    throw new Error("Enter all three names.");
  }
  const store = getStore();
  const { code, members } = await store.createGroup([
    names[0],
    names[1],
    names[2],
  ]);
  const organiserToken = members.find((m) => m.is_organiser)!.token;
  redirect(`/g/${code}/share?t=${organiserToken}`);
}

export async function createDemoAction() {
  const store = getStore();
  const { code } = await store.createDemoGroup();
  redirect(`/g/${code}`);
}

export async function submitAnswersAction(
  code: string,
  token: string,
  answers: Answers
): Promise<ActionResult> {
  try {
    const store = getStore();
    await store.submitAnswers(code, token, answers);
    revalidatePath(`/g/${code}`);
    revalidatePath(`/g/${code}/m/${token}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

export async function startNewRoundAction(code: string): Promise<ActionResult> {
  try {
    const store = getStore();
    await store.startNewRound(code);
    revalidatePath(`/g/${code}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

export async function addListingAction(
  code: string,
  organiserToken: string,
  input: NewListingInput
): Promise<ActionResult> {
  try {
    const store = getStore();
    await store.addListing(code, organiserToken, input);
    revalidatePath(`/g/${code}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

export async function markListingGoneAction(
  code: string,
  organiserToken: string,
  listingId: number
): Promise<ActionResult> {
  try {
    const store = getStore();
    await store.markListingGone(code, organiserToken, listingId);
    revalidatePath(`/g/${code}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

export async function applyWhatIfAction(
  code: string,
  whatIf: WhatIf
): Promise<ActionResult> {
  try {
    const store = getStore();
    await store.applyWhatIf(code, whatIf);
    revalidatePath(`/g/${code}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}
