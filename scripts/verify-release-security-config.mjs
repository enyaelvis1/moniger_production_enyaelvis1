import { execSync } from "node:child_process";
import { loadEnv } from "vite";

Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), ""));

const readArgValue = (flag) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
};

const projectRef =
  readArgValue("--project-ref") ||
  process.env.VITE_SUPABASE_PROJECT_ID?.trim() ||
  process.env.SUPABASE_PROJECT_ID?.trim() ||
  "";

const expectedAppUrl =
  (readArgValue("--expected-app-url") ||
    process.env.VITE_PUBLIC_APP_URL?.trim() ||
    process.env.VITE_APP_BASE_URL?.trim() ||
    "").replace(/\/$/, "");

if (!projectRef) {
  console.error("Missing Supabase project ref. Set VITE_SUPABASE_PROJECT_ID or pass --project-ref.");
  process.exit(1);
}

if (!expectedAppUrl) {
  console.error("Missing expected app URL. Set VITE_PUBLIC_APP_URL or pass --expected-app-url.");
  process.exit(1);
}

let secrets;

try {
  secrets = JSON.parse(
    execSync(`supabase secrets list --project-ref ${projectRef} --output json`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
} catch (error) {
  console.error("Unable to inspect Supabase secrets for the linked project.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const appBaseUrlSecret = secrets.find((secret) => secret?.name === "APP_BASE_URL");

const result = {
  expectedAppUrl,
  hasAppBaseUrlSecret: Boolean(appBaseUrlSecret),
  projectRef,
  secretLastUpdatedAt: appBaseUrlSecret?.updated_at ?? null,
};

console.log(JSON.stringify(result, null, 2));

if (!appBaseUrlSecret) {
  console.error("Release blocked: APP_BASE_URL is not configured in Supabase secrets.");
  process.exit(1);
}
