// Real Supabase-backed Store. Only used when SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set (see db.ts). Server-only: this file
// must never be imported from a Client Component, since it uses the
// service role key which bypasses RLS.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO, type Answers, type Listing } from "./seed-data";
import type { WhatIf } from "./engine";
import {
  diffAnswers,
  validateAnswers,
  NotFoundError,
  type GroupRecord,
  type MemberRecord,
} from "./store-types";
import { generateGroupCode, generateMemberToken } from "./ids";
import type { Store } from "./store";

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type ListingRow = {
  id: number;
  group_id: string | null;
  title: string;
  area: string;
  rent: number;
  floor: number;
  lift: boolean | null;
  parking: boolean | null;
  pets: boolean | null;
  bathrooms: number | null;
  furnished: boolean | null;
  balcony: boolean | null;
  gym: boolean | null;
  near_metro: boolean | null;
  newer: boolean | null;
  url: string | null;
  is_sample: boolean;
  status: "active" | "gone";
};

function rowToListing(r: ListingRow): Listing {
  return { ...r };
}

async function activeListingsFor(sb: SupabaseClient, groupId: string): Promise<Listing[]> {
  const [{ data: listingRows, error: lErr }, { data: overrideRows, error: oErr }] =
    await Promise.all([
      sb.from("listings").select("*").or(`group_id.is.null,group_id.eq.${groupId}`),
      sb.from("group_listing_status").select("listing_id,status").eq("group_id", groupId),
    ]);
  if (lErr) throw lErr;
  if (oErr) throw oErr;
  const overrides = new Map((overrideRows ?? []).map((o) => [o.listing_id, o.status]));
  return ((listingRows ?? []) as ListingRow[])
    .map((r) => {
      const override = overrides.get(r.id);
      return override ? { ...rowToListing(r), status: override as "active" | "gone" } : rowToListing(r);
    })
    .filter((l) => l.status === "active");
}

function memberRow(row: any): MemberRecord {
  return {
    id: row.id,
    group_id: row.group_id,
    name: row.name,
    position: row.position,
    token: row.token,
    is_organiser: row.is_organiser,
    answers: row.answers,
    submitted_at: row.submitted_at,
  };
}

function groupRow(row: any): GroupRecord {
  return {
    id: row.id,
    code: row.code,
    round: row.round,
    locked_at: row.locked_at,
    created_at: row.created_at,
    is_demo: row.is_demo,
  };
}

export const supabaseStore: Store = {
  async createGroup([n0, n1, n2]) {
    const sb = client();
    const code = generateGroupCode();
    const { data: groupData, error: gErr } = await sb
      .from("groups")
      .insert({ code, round: 1, is_demo: false })
      .select()
      .single();
    if (gErr) throw gErr;
    const group = groupRow(groupData);

    const names = [n0, n1, n2];
    const memberInserts = names.map((name, i) => ({
      group_id: group.id,
      name,
      position: i,
      token: generateMemberToken(),
      is_organiser: i === 0,
    }));
    const { data: memberData, error: mErr } = await sb
      .from("members")
      .insert(memberInserts)
      .select();
    if (mErr) throw mErr;
    const members = (memberData ?? []).map(memberRow);
    return { code, group, members };
  },

  async createDemoGroup() {
    const sb = client();
    const code = generateGroupCode();
    const nowIso = new Date().toISOString();
    const { data: groupData, error: gErr } = await sb
      .from("groups")
      .insert({ code, round: 1, is_demo: true, locked_at: nowIso })
      .select()
      .single();
    if (gErr) throw gErr;
    const group = groupRow(groupData);

    const memberInserts = DEMO.map((d, i) => ({
      group_id: group.id,
      name: d.name,
      position: i,
      token: generateMemberToken(),
      is_organiser: i === 0,
      answers: d.answers,
      submitted_at: nowIso,
    }));
    const { data: memberData, error: mErr } = await sb
      .from("members")
      .insert(memberInserts)
      .select();
    if (mErr) throw mErr;
    const members = (memberData ?? []).map(memberRow);
    return { code, group, members };
  },

  async getGroupFull(code) {
    const sb = client();
    const { data: groupData, error: gErr } = await sb
      .from("groups")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (gErr) throw gErr;
    if (!groupData) return null;
    const group = groupRow(groupData);

    const { data: memberData, error: mErr } = await sb
      .from("members")
      .select("*")
      .eq("group_id", group.id)
      .order("position");
    if (mErr) throw mErr;
    const members = (memberData ?? []).map(memberRow);

    const listings = await activeListingsFor(sb, group.id);

    const { data: changeData, error: cErr } = await sb
      .from("round_changes")
      .select("*")
      .eq("group_id", group.id)
      .eq("round", group.round);
    if (cErr) throw cErr;
    const roundChanges = (changeData ?? []).map((r: any) => ({
      id: r.id,
      group_id: r.group_id,
      round: r.round,
      member_id: r.member_id,
      member_name: members.find((m) => m.id === r.member_id)?.name ?? "",
      field: r.field,
      old_value: r.old_value,
      new_value: r.new_value,
      changed_at: r.changed_at,
      private: r.private ?? false,
    }));

    return { group, members, listings, roundChanges };
  },

  async getMemberByToken(code, token) {
    const sb = client();
    const { data: groupData, error: gErr } = await sb
      .from("groups")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (gErr) throw gErr;
    if (!groupData) return null;
    const group = groupRow(groupData);

    const { data: memberData, error: mErr } = await sb
      .from("members")
      .select("*")
      .eq("group_id", group.id)
      .eq("token", token)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!memberData) return null;
    const member = memberRow(memberData);
    const listings = await activeListingsFor(sb, group.id);
    return { group, member, listings };
  },

  async submitAnswers(code, token, answers) {
    validateAnswers(answers);
    const sb = client();
    const found = await supabaseStore.getMemberByToken(code, token);
    if (!found) throw new NotFoundError("member not found");
    const { group, member } = found;

    const changes = diffAnswers(member.answers, answers);
    if (changes.length > 0) {
      const inserts = changes.map((c) => ({
        group_id: group.id,
        round: group.round,
        member_id: member.id,
        field: c.field,
        old_value: c.old_value,
        new_value: c.new_value,
        private: c.private,
      }));
      const { error } = await sb.from("round_changes").insert(inserts);
      if (error) throw error;
    }

    const nowIso = new Date().toISOString();
    const { error: uErr } = await sb
      .from("members")
      .update({ answers, submitted_at: nowIso })
      .eq("id", member.id);
    if (uErr) throw uErr;

    const { data: allMembers, error: amErr } = await sb
      .from("members")
      .select("submitted_at")
      .eq("group_id", group.id);
    if (amErr) throw amErr;
    const allSubmitted = (allMembers ?? []).every((m: any) => m.submitted_at !== null);
    if (allSubmitted && !group.locked_at) {
      const { error: lErr } = await sb
        .from("groups")
        .update({ locked_at: nowIso })
        .eq("id", group.id);
      if (lErr) throw lErr;
    }
  },

  async startNewRound(code) {
    const sb = client();
    const full = await supabaseStore.getGroupFull(code);
    if (!full) throw new NotFoundError("group not found");
    if (!full.group.locked_at) throw new Error("results are not open yet");

    const { error: gErr } = await sb
      .from("groups")
      .update({ round: full.group.round + 1, locked_at: null })
      .eq("id", full.group.id);
    if (gErr) throw gErr;

    const { error: mErr } = await sb
      .from("members")
      .update({ submitted_at: null })
      .eq("group_id", full.group.id);
    if (mErr) throw mErr;
  },

  async addListing(code, organiserToken, input) {
    const sb = client();
    const full = await supabaseStore.getGroupFull(code);
    if (!full) throw new NotFoundError("group not found");
    const organiser = full.members.find((m) => m.is_organiser);
    if (!organiser || organiser.token !== organiserToken) {
      throw new Error("only the organiser can add a listing");
    }
    const { error } = await sb.from("listings").insert({
      ...input,
      group_id: full.group.id,
      is_sample: false,
      status: "active",
    });
    if (error) throw error;
  },

  async markListingGone(code, organiserToken, listingId) {
    const sb = client();
    const full = await supabaseStore.getGroupFull(code);
    if (!full) throw new NotFoundError("group not found");
    const organiser = full.members.find((m) => m.is_organiser);
    if (!organiser || organiser.token !== organiserToken) {
      throw new Error("only the organiser can mark a listing gone");
    }
    const { data: listingRow, error: lErr } = await sb
      .from("listings")
      .select("id,group_id")
      .eq("id", listingId)
      .maybeSingle();
    if (lErr) throw lErr;
    if (listingRow && listingRow.group_id === full.group.id) {
      const { error } = await sb
        .from("listings")
        .update({ status: "gone" })
        .eq("id", listingId);
      if (error) throw error;
      return;
    }
    const { error } = await sb
      .from("group_listing_status")
      .upsert({ group_id: full.group.id, listing_id: listingId, status: "gone" });
    if (error) throw error;
  },

  async applyWhatIf(code, whatIf: WhatIf) {
    const sb = client();
    const full = await supabaseStore.getGroupFull(code);
    if (!full) throw new NotFoundError("group not found");
    if (!full.group.is_demo) {
      throw new Error("what-ifs can only be auto-applied on demo groups");
    }

    const nextRound = full.group.round + 1;
    const { error: gErr } = await sb
      .from("groups")
      .update({ round: nextRound, locked_at: null })
      .eq("id", full.group.id);
    if (gErr) throw gErr;

    const nowIso = new Date().toISOString();
    for (const member of full.members) {
      const change = whatIf.changes.find((c) => c.member === member.name);
      let nextAnswers: Answers = member.answers as Answers;
      if (change && member.answers) {
        nextAnswers = JSON.parse(JSON.stringify(member.answers));
        if (change.field === "max_rent") {
          nextAnswers.max_rent = change.to;
        } else {
          const entry = nextAnswers.commute.find((c) => c.landmark === change.field);
          if (entry) entry.max_min = change.to;
        }
        const diffs = diffAnswers(member.answers, nextAnswers);
        if (diffs.length > 0) {
          const inserts = diffs.map((d) => ({
            group_id: full.group.id,
            round: nextRound,
            member_id: member.id,
            field: d.field,
            old_value: d.old_value,
            new_value: d.new_value,
            private: d.private,
          }));
          const { error } = await sb.from("round_changes").insert(inserts);
          if (error) throw error;
        }
      }
      const { error: uErr } = await sb
        .from("members")
        .update({ answers: nextAnswers, submitted_at: nowIso })
        .eq("id", member.id);
      if (uErr) throw uErr;
    }

    const { error: lErr } = await sb
      .from("groups")
      .update({ locked_at: nowIso })
      .eq("id", full.group.id);
    if (lErr) throw lErr;
  },
};
