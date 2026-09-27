// In-memory Store used when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// not set. This lets the whole app run and be tested locally (per the
// task's "degrade gracefully" instruction) without a live database. State
// lives in module scope for the lifetime of the dev server process and is
// never used once real Supabase credentials are configured (see db.ts).

import { randomUUID } from "crypto";
import { DEMO, SAMPLE_LISTINGS, type Answers, type Listing } from "./seed-data";
import type { WhatIf } from "./engine";
import {
  diffAnswers,
  nextListingId,
  validateAnswers,
  NotFoundError,
  type GroupRecord,
  type MemberRecord,
  type RoundChange,
} from "./store-types";
import { generateGroupCode, generateMemberToken } from "./ids";
import type { Store } from "./store";

type GroupListingStatus = Map<number, "gone">; // listingId -> status override

type Db = {
  groups: Map<string, GroupRecord>; // by code
  members: Map<string, MemberRecord[]>; // by group id
  ownListings: Map<string, Listing[]>; // by group id
  sampleOverrides: Map<string, GroupListingStatus>; // by group id
  roundChanges: Map<string, RoundChange[]>; // by group id
};

const globalForStore = globalThis as unknown as { __sffMemoryDb?: Db };

function getDb(): Db {
  if (!globalForStore.__sffMemoryDb) {
    globalForStore.__sffMemoryDb = {
      groups: new Map(),
      members: new Map(),
      ownListings: new Map(),
      sampleOverrides: new Map(),
      roundChanges: new Map(),
    };
  }
  return globalForStore.__sffMemoryDb;
}

function now(): string {
  return new Date().toISOString();
}

function activeListingsFor(db: Db, groupId: string): Listing[] {
  const overrides = db.sampleOverrides.get(groupId) ?? new Map();
  const own = db.ownListings.get(groupId) ?? [];
  const samples = SAMPLE_LISTINGS.map((l) => {
    const override = overrides.get(l.id);
    return override ? { ...l, status: override } : l;
  });
  return [...samples, ...own].filter((l) => l.status === "active");
}

function makeMember(
  groupId: string,
  name: string,
  position: 0 | 1 | 2
): MemberRecord {
  return {
    id: randomUUID(),
    group_id: groupId,
    name,
    position,
    token: generateMemberToken(),
    is_organiser: position === 0,
    answers: null,
    submitted_at: null,
  };
}

export const memoryStore: Store = {
  async createGroup([n0, n1, n2]) {
    const db = getDb();
    const id = randomUUID();
    const code = generateGroupCode();
    const group: GroupRecord = {
      id,
      code,
      round: 1,
      locked_at: null,
      created_at: now(),
      is_demo: false,
    };
    const members = [
      makeMember(id, n0, 0),
      makeMember(id, n1, 1),
      makeMember(id, n2, 2),
    ];
    db.groups.set(code, group);
    db.members.set(id, members);
    db.ownListings.set(id, []);
    db.sampleOverrides.set(id, new Map());
    db.roundChanges.set(id, []);
    return { code, group, members };
  },

  async createDemoGroup() {
    const db = getDb();
    const id = randomUUID();
    const code = generateGroupCode();
    const group: GroupRecord = {
      id,
      code,
      round: 1,
      locked_at: now(),
      created_at: now(),
      is_demo: true,
    };
    const members = DEMO.map((d, i) => {
      const m = makeMember(id, d.name, i as 0 | 1 | 2);
      m.answers = d.answers;
      m.submitted_at = now();
      return m;
    });
    db.groups.set(code, group);
    db.members.set(id, members);
    db.ownListings.set(id, []);
    db.sampleOverrides.set(id, new Map());
    db.roundChanges.set(id, []);
    return { code, group, members };
  },

  async getGroupFull(code) {
    const db = getDb();
    const group = db.groups.get(code);
    if (!group) return null;
    const members = db.members.get(group.id) ?? [];
    const listings = activeListingsFor(db, group.id);
    const roundChanges = (db.roundChanges.get(group.id) ?? []).filter(
      (c) => c.round === group.round
    );
    return { group, members, listings, roundChanges };
  },

  async getMemberByToken(code, token) {
    const db = getDb();
    const group = db.groups.get(code);
    if (!group) return null;
    const members = db.members.get(group.id) ?? [];
    const member = members.find((m) => m.token === token);
    if (!member) return null;
    const listings = activeListingsFor(db, group.id);
    return { group, member, listings };
  },

  async submitAnswers(code, token, answers) {
    validateAnswers(answers);
    const db = getDb();
    const group = db.groups.get(code);
    if (!group) throw new NotFoundError("group not found");
    const members = db.members.get(group.id) ?? [];
    const member = members.find((m) => m.token === token);
    if (!member) throw new NotFoundError("member not found");

    const prev = member.answers;
    const changes = diffAnswers(prev, answers);
    if (changes.length > 0) {
      const list = db.roundChanges.get(group.id) ?? [];
      for (const c of changes) {
        list.push({
          id: randomUUID(),
          group_id: group.id,
          round: group.round,
          member_id: member.id,
          member_name: member.name,
          field: c.field,
          old_value: c.old_value,
          new_value: c.new_value,
          changed_at: now(),
          private: c.private,
        });
      }
      db.roundChanges.set(group.id, list);
    }

    member.answers = answers;
    member.submitted_at = now();

    const allSubmitted = members.every((m) => m.submitted_at !== null);
    if (allSubmitted && !group.locked_at) {
      group.locked_at = now();
    }
  },

  async startNewRound(code) {
    const db = getDb();
    const group = db.groups.get(code);
    if (!group) throw new NotFoundError("group not found");
    if (!group.locked_at) {
      throw new Error("results are not open yet");
    }
    group.round += 1;
    group.locked_at = null;
    const members = db.members.get(group.id) ?? [];
    for (const m of members) m.submitted_at = null;
  },

  async addListing(code, organiserToken, input) {
    const db = getDb();
    const group = db.groups.get(code);
    if (!group) throw new NotFoundError("group not found");
    const members = db.members.get(group.id) ?? [];
    const organiser = members.find((m) => m.is_organiser);
    if (!organiser || organiser.token !== organiserToken) {
      throw new Error("only the organiser can add a listing");
    }
    const own = db.ownListings.get(group.id) ?? [];
    const allExisting = [...SAMPLE_LISTINGS, ...own];
    const listing: Listing = {
      ...input,
      id: nextListingId(allExisting),
      group_id: group.id,
      is_sample: false,
      status: "active",
    };
    own.push(listing);
    db.ownListings.set(group.id, own);
  },

  async markListingGone(code, organiserToken, listingId) {
    const db = getDb();
    const group = db.groups.get(code);
    if (!group) throw new NotFoundError("group not found");
    const members = db.members.get(group.id) ?? [];
    const organiser = members.find((m) => m.is_organiser);
    if (!organiser || organiser.token !== organiserToken) {
      throw new Error("only the organiser can mark a listing gone");
    }
    const own = db.ownListings.get(group.id) ?? [];
    const ownListing = own.find((l) => l.id === listingId);
    if (ownListing) {
      ownListing.status = "gone";
      return;
    }
    const overrides = db.sampleOverrides.get(group.id) ?? new Map();
    overrides.set(listingId, "gone");
    db.sampleOverrides.set(group.id, overrides);
  },

  async applyWhatIf(code, whatIf: WhatIf) {
    const db = getDb();
    const group = db.groups.get(code);
    if (!group) throw new NotFoundError("group not found");
    if (!group.is_demo) {
      throw new Error("what-ifs can only be auto-applied on demo groups");
    }
    const members = db.members.get(group.id) ?? [];

    group.round += 1;
    group.locked_at = null;

    for (const change of whatIf.changes) {
      const member = members.find((m) => m.name === change.member);
      if (!member || !member.answers) continue;
      const prevAnswers: Answers = member.answers;
      const nextAnswers: Answers = JSON.parse(JSON.stringify(prevAnswers));
      if (change.field === "max_rent") {
        nextAnswers.max_rent = change.to;
      } else {
        const entry = nextAnswers.commute.find((c) => c.landmark === change.field);
        if (entry) entry.max_min = change.to;
      }
      const diffs = diffAnswers(prevAnswers, nextAnswers);
      if (diffs.length > 0) {
        const list = db.roundChanges.get(group.id) ?? [];
        for (const d of diffs) {
          list.push({
            id: randomUUID(),
            group_id: group.id,
            round: group.round,
            member_id: member.id,
            member_name: member.name,
            field: d.field,
            old_value: d.old_value,
            new_value: d.new_value,
            changed_at: now(),
            private: d.private,
          });
        }
        db.roundChanges.set(group.id, list);
      }
      member.answers = nextAnswers;
      member.submitted_at = now();
    }

    // Members not part of the what-if simply re-submit their unchanged answers.
    for (const m of members) {
      if (!m.submitted_at) m.submitted_at = now();
    }
    if (members.every((m) => m.submitted_at !== null)) {
      group.locked_at = now();
    }
  },
};

export function _resetMemoryStoreForTests() {
  globalForStore.__sffMemoryDb = undefined;
}
