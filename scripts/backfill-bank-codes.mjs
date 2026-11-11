#!/usr/bin/env node

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const PAYSTACK_PAGE_SIZE = 100;
const MAX_PAYSTACK_PAGES = 25;

const normalizeBankName = (value) => value
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/\([^)]*\)/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\b(nigeria|bank|microfinance|mfb|plc|limited)\b/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const normalizeLiteralName = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const parseArguments = () => {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== "--apply" && arg !== "--help");

  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown[0]}`);
  }

  return { apply: args.includes("--apply"), help: args.includes("--help") };
};

const printHelp = () => {
  console.log(`Usage: node scripts/backfill-bank-codes.mjs [--apply]

Default mode is read-only and prints unique exact-normalized Paystack matches.
Pass --apply to update only rows with a unique match, after typing the displayed
confirmation phrase. Fuzzy matches and rows outside Nigeria are never updated.

Required environment variables:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  PAYSTACK_SECRET_KEY`);
};

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const fetchJson = async (url, { headers = {}, method = "GET", body } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.status === false) {
      throw new Error(payload?.message || `Request failed with HTTP ${response.status}`);
    }

    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("A provider request timed out after 15 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const getBankRows = async ({ supabaseUrl, serviceRoleKey }) => {
  const url = new URL("/rest/v1/banks", supabaseUrl);
  url.searchParams.set("select", "id,name,bank_code,country_code");
  url.searchParams.set("order", "name.asc");
  url.searchParams.set("limit", "1000");

  const payload = await fetchJson(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!Array.isArray(payload)) {
    throw new Error("Supabase returned an unexpected bank-directory response.");
  }

  return payload;
};

const getPaystackBanks = async (paystackSecretKey) => {
  const banks = [];

  for (let page = 1; page <= MAX_PAYSTACK_PAGES; page += 1) {
    const url = new URL("https://api.paystack.co/bank");
    url.searchParams.set("country", "nigeria");
    url.searchParams.set("currency", "NGN");
    url.searchParams.set("perPage", String(PAYSTACK_PAGE_SIZE));
    url.searchParams.set("page", String(page));

    const payload = await fetchJson(url, {
      headers: { Authorization: `Bearer ${paystackSecretKey}` },
    });

    if (!Array.isArray(payload.data)) {
      throw new Error("Paystack returned an unexpected bank-directory response.");
    }

    banks.push(...payload.data);
    const pageCount = Number(payload.meta?.pageCount);
    if (!Number.isFinite(pageCount) || payload.data.length < PAYSTACK_PAGE_SIZE || page >= pageCount) {
      return banks;
    }
  }

  throw new Error(`Paystack returned more than ${MAX_PAYSTACK_PAGES} pages; refusing an incomplete match.`);
};

const resolveExactMatches = (bankRows, paystackBanks) => {
  const providersByLiteralName = new Map();
  const providersByDeclaredAlias = new Map();
  const providersByName = new Map();
  const existingCodes = new Set(
    bankRows.map((row) => String(row.bank_code ?? "").trim()).filter(Boolean),
  );

  for (const bank of paystackBanks) {
    const code = String(bank.code ?? "").trim();
    const name = String(bank.name ?? "").trim();
    const key = normalizeBankName(name);
    if (!key || !code || bank.active === false) continue;

    const literalKey = normalizeLiteralName(name);
    const literalMatches = providersByLiteralName.get(literalKey) ?? [];
    literalMatches.push({ code, name });
    providersByLiteralName.set(literalKey, literalMatches);

    for (const [, alias] of name.matchAll(/\(([^)]+)\)/g)) {
      const aliasKey = normalizeLiteralName(alias);
      const aliasMatches = providersByDeclaredAlias.get(aliasKey) ?? [];
      aliasMatches.push({ code, name });
      providersByDeclaredAlias.set(aliasKey, aliasMatches);
    }

    const matches = providersByName.get(key) ?? [];
    matches.push({ code, name });
    providersByName.set(key, matches);
  }

  const candidates = [];
  const skipped = [];

  for (const row of bankRows) {
    if (String(row.bank_code ?? "").trim()) continue;

    const name = String(row.name ?? "").trim();
    if (String(row.country_code ?? "").trim().toUpperCase() !== "NG") {
      skipped.push({ name, reason: `country is ${row.country_code ?? "unset"}, not NG` });
      continue;
    }

    const literalMatches = providersByLiteralName.get(normalizeLiteralName(name)) ?? [];
    const aliasMatches = providersByDeclaredAlias.get(normalizeLiteralName(name)) ?? [];
    const normalizedMatches = providersByName.get(normalizeBankName(name)) ?? [];
    const selectedMatches = literalMatches.length > 0
      ? { matches: literalMatches, matchType: "literal" }
      : aliasMatches.length > 0
        ? { matches: aliasMatches, matchType: "provider-declared alias" }
        : { matches: normalizedMatches, matchType: "normalized" };
    const { matches, matchType } = selectedMatches;
    if (matches.length !== 1) {
      skipped.push({ name, reason: matches.length === 0 ? "no exact normalized Paystack match" : "ambiguous Paystack bank name" });
      continue;
    }

    const [provider] = matches;
    if (existingCodes.has(provider.code)) {
      skipped.push({ name, reason: `Paystack code ${provider.code} is already assigned to another bank row` });
      continue;
    }

    candidates.push({ bankId: row.id, bankName: name, matchType, providerCode: provider.code, providerName: provider.name });
  }

  const candidateCodeCounts = new Map();
  for (const candidate of candidates) {
    candidateCodeCounts.set(candidate.providerCode, (candidateCodeCounts.get(candidate.providerCode) ?? 0) + 1);
  }

  const uniqueCandidates = candidates.filter((candidate) => {
    const count = candidateCodeCounts.get(candidate.providerCode) ?? 0;
    if (count === 1) return true;
    skipped.push({ bankName: candidate.bankName, reason: `Paystack code ${candidate.providerCode} matches multiple directory rows` });
    return false;
  });

  return { candidates: uniqueCandidates, skipped };
};

const applyCandidate = async ({ candidate, supabaseUrl, serviceRoleKey, originalCode }) => {
  const url = new URL("/rest/v1/banks", supabaseUrl);
  url.searchParams.set("id", `eq.${candidate.bankId}`);
  url.searchParams.set("bank_code", originalCode == null ? "is.null" : "eq.");
  url.searchParams.set("select", "id,name,bank_code");

  const payload = await fetchJson(url, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: { bank_code: candidate.providerCode },
  });

  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new Error(`Bank row changed during backfill or was not updated: ${candidate.bankName}`);
  }

  return payload[0];
};

const confirmApply = async (count, projectHost) => {
  const phrase = `APPLY ${count} BANK CODE UPDATES`;
  console.log(`\nTarget Supabase host: ${projectHost}`);
  console.log(`This will update ${count} bank rows. Existing bank codes will not be overwritten.`);

  const terminal = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await terminal.question(`Type "${phrase}" to continue: `);
    return answer === phrase;
  } finally {
    terminal.close();
  }
};

const main = async () => {
  const { apply, help } = parseArguments();
  if (help) {
    printHelp();
    return;
  }

  const supabaseUrl = new URL(requiredEnv("SUPABASE_URL"));
  if (supabaseUrl.protocol !== "https:" || !supabaseUrl.hostname.endsWith(".supabase.co")) {
    throw new Error("SUPABASE_URL must be an HTTPS Supabase project URL.");
  }

  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecretKey = requiredEnv("PAYSTACK_SECRET_KEY");
  const bankRows = await getBankRows({ supabaseUrl: supabaseUrl.origin, serviceRoleKey });
  const missingCount = bankRows.filter((row) => !String(row.bank_code ?? "").trim()).length;
  const paystackBanks = await getPaystackBanks(paystackSecretKey);
  const { candidates, skipped } = resolveExactMatches(bankRows, paystackBanks);

  console.log(`Bank directory rows: ${bankRows.length}`);
  console.log(`Rows missing a bank code: ${missingCount}`);
  console.log(`Unique exact matches ready: ${candidates.length}`);
  console.log(`Skipped for review: ${skipped.length}`);

  for (const candidate of candidates) {
    console.log(`MATCH (${candidate.matchType}) | ${candidate.bankName} -> ${candidate.providerName} | ${candidate.providerCode}`);
  }
  for (const row of skipped) {
    console.log(`REVIEW | ${row.name ?? row.bankName} | ${row.reason}`);
  }

  if (!apply) {
    console.log("\nDry run only; production data was not changed. Add --apply to request updates.");
    return;
  }

  if (candidates.length === 0) {
    console.log("No safe updates are available.");
    return;
  }

  if (!(await confirmApply(candidates.length, supabaseUrl.host))) {
    console.log("Confirmation did not match; no changes were made.");
    process.exitCode = 1;
    return;
  }

  const originalById = new Map(bankRows.map((row) => [row.id, row.bank_code]));
  let updated = 0;
  for (const candidate of candidates) {
    await applyCandidate({
      candidate,
      originalCode: originalById.get(candidate.bankId),
      serviceRoleKey,
      supabaseUrl: supabaseUrl.origin,
    });
    updated += 1;
    console.log(`UPDATED | ${candidate.bankName} | ${candidate.providerCode}`);
  }

  console.log(`\nBackfill complete: ${updated} bank codes updated; ${skipped.length} rows remain for manual review.`);
};

main().catch((error) => {
  console.error(`Bank-code backfill failed: ${error instanceof Error ? error.message : "Unexpected error"}`);
  process.exitCode = 1;
});
