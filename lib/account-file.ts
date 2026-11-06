import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readDoc, writeDoc } from "./doc-store";
import { hydrate } from "./engine";
import type { AppData } from "./types";

interface AccountRecord {
  id: string;
  name: string;
  salt: string;
  passwordHash: string;
  tokens: string[];
  data: AppData;
  updatedAt: string;
}

let chain: Promise<unknown> = Promise.resolve();

function lock<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

function passwordMatches(password: string, account: AccountRecord): boolean {
  const actual = Buffer.from(hashPassword(password, account.salt), "hex");
  const expected = Buffer.from(account.passwordHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function readIndex(): Promise<{ index: Record<string, string>; etag: string | null }> {
  const doc = await readDoc<Record<string, string>>("accounts/index.json");
  return { index: doc?.value ?? {}, etag: doc?.etag ?? null };
}

async function writeIndex(index: Record<string, string>, etag: string | null) {
  const saved = await writeDoc("accounts/index.json", index, etag);
  if (!saved) throw new Error("Could not save the account. Try again.");
}

async function readAccount(id: string): Promise<{ account: AccountRecord; etag: string | null } | null> {
  const doc = await readDoc<AccountRecord>(`accounts/${id}.json`);
  return doc ? { account: doc.value, etag: doc.etag } : null;
}

async function writeAccount(account: AccountRecord, etag: string | null) {
  const saved = await writeDoc(`accounts/${account.id}.json`, account, etag);
  if (!saved) throw new Error("Could not save the account. Try again.");
}

async function findByToken(token: string): Promise<{ account: AccountRecord; etag: string | null } | null> {
  const { index } = await readIndex();
  for (const id of Object.values(index)) {
    const loaded = await readAccount(id);
    if (loaded?.account.tokens.includes(token)) return loaded;
  }
  return null;
}

function present(account: AccountRecord, token: string) {
  return { token, name: account.name, data: hydrate(account.data) };
}

export function registerAccount(input: { name: string; password: string; data: AppData }) {
  return lock(async () => {
    const name = input.name.trim();
    const key = normalize(name);
    if (!key || key.length > 40) throw new Error("Use a name up to 40 characters.");
    if (input.password.length < 6) throw new Error("Use a password of at least 6 characters.");
    if (!input.data) throw new Error("Missing home data.");
    const { index, etag } = await readIndex();
    if (index[key]) throw new Error("That name already has an account.");
    const salt = randomBytes(16).toString("hex");
    const token = randomBytes(32).toString("hex");
    const account: AccountRecord = {
      id: randomBytes(16).toString("hex"),
      name,
      salt,
      passwordHash: hashPassword(input.password, salt),
      tokens: [token],
      data: hydrate(input.data),
      updatedAt: new Date().toISOString(),
    };
    index[key] = account.id;
    await writeAccount(account, null);
    await writeIndex(index, etag);
    return present(account, token);
  });
}

export function loginAccount(input: { name: string; password: string }) {
  return lock(async () => {
    const { index } = await readIndex();
    const id = index[normalize(input.name)];
    const loaded = id ? await readAccount(id) : null;
    if (!loaded) throw new Error("No account with that name.");
    const { account } = loaded;
    if (!passwordMatches(input.password, account)) throw new Error("Wrong password.");
    const token = randomBytes(32).toString("hex");
    account.tokens = [...account.tokens, token].slice(-8);
    await writeAccount(account, loaded.etag);
    return present(account, token);
  });
}

export function sessionAccount(token: string) {
  return lock(async () => {
    const loaded = await findByToken(token);
    if (!loaded) throw new Error("Sign in again.");
    return present(loaded.account, token);
  });
}

export function saveAccount(token: string, data: AppData) {
  return lock(async () => {
    const loaded = await findByToken(token);
    if (!loaded) throw new Error("Sign in again.");
    loaded.account.data = hydrate(data);
    loaded.account.updatedAt = new Date().toISOString();
    await writeAccount(loaded.account, loaded.etag);
    return { ok: true as const };
  });
}

export function logoutAccount(token: string) {
  return lock(async () => {
    const loaded = await findByToken(token);
    if (loaded) {
      loaded.account.tokens = loaded.account.tokens.filter((item) => item !== token);
      await writeAccount(loaded.account, loaded.etag);
    }
    return { ok: true as const };
  });
}
