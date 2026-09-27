import { customAlphabet, nanoid } from "nanoid";

const codeAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
const newGroupCode = customAlphabet(codeAlphabet, 8);

export function generateGroupCode(): string {
  return newGroupCode();
}

export function generateMemberToken(): string {
  // nanoid() defaults to 21 characters, matching the spec.
  return nanoid();
}
