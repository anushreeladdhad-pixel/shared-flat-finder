// The Store interface both persistence adapters implement (see
// memory-store.ts for local dev without Supabase, supabase-store.ts for a
// real project). Pages and server actions only ever talk to this interface
// via getStore() in db.ts, so swapping adapters never touches UI code.

import type { Answers, Listing } from "./seed-data";
import type { WhatIf } from "./engine";
import type {
  GroupRecord,
  MemberRecord,
  NewListingInput,
  RoundChange,
} from "./store-types";

export type GroupFull = {
  group: GroupRecord;
  members: MemberRecord[];
  listings: Listing[]; // this group's active listing set (samples + own, minus gone)
  roundChanges: RoundChange[]; // changes recorded for the *current* round
};

export type NewGroupResult = {
  code: string;
  group: GroupRecord;
  members: MemberRecord[];
};

export interface Store {
  createGroup(names: [string, string, string]): Promise<NewGroupResult>;
  createDemoGroup(): Promise<NewGroupResult>;
  getGroupFull(code: string): Promise<GroupFull | null>;
  getMemberByToken(
    code: string,
    token: string
  ): Promise<{ group: GroupRecord; member: MemberRecord; listings: Listing[] } | null>;
  submitAnswers(code: string, token: string, answers: Answers): Promise<void>;
  startNewRound(code: string): Promise<void>;
  addListing(code: string, organiserToken: string, input: NewListingInput): Promise<void>;
  markListingGone(code: string, organiserToken: string, listingId: number): Promise<void>;
  applyWhatIf(code: string, whatIf: WhatIf): Promise<void>;
}
