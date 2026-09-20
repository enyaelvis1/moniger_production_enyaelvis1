import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assertTestDataEnvironment } from "./assert-test-data-environment.mjs";

const readEnvValue = (envContents, key) => {
  const match = envContents.match(new RegExp(`^${key}="([^"]*)"$`, "m"));
  return match?.[1] ?? "";
};

const readArgValue = (flag) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
};

const envContents = readFileSync(".env", "utf8");
const projectRef = readEnvValue(envContents, "VITE_SUPABASE_PROJECT_ID");
const supabaseUrl = readEnvValue(envContents, "VITE_SUPABASE_URL");
try {
  assertTestDataEnvironment({
    allowTestData: process.env.ALLOW_TEST_DATA,
    environment: process.env.APP_ENVIRONMENT || readEnvValue(envContents, "APP_ENVIRONMENT"),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : "Refusing to create sample data.");
  process.exit(1);
}

if (!projectRef || !supabaseUrl) {
  console.error("Missing VITE_SUPABASE_PROJECT_ID or VITE_SUPABASE_URL in .env.");
  process.exit(1);
}

const email = readArgValue("--email");
const password = readArgValue("--password") || "MonigerTest123!";
const fullName = readArgValue("--name") || "moniger.net Test User";
const businessName = readArgValue("--business") || "moniger.net Test Workspace";

if (!email) {
  console.error("Usage: npm run create:test-user -- --email you@example.com [--password secret] [--name \"Full Name\"] [--business \"Business Name\"]");
  process.exit(1);
}

let serviceRoleKey = "";

try {
  const keys = JSON.parse(
    execSync(`supabase projects api-keys --project-ref ${projectRef} --output json`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );

  serviceRoleKey = keys.find((key) => key.id === "service_role")?.api_key ?? "";
} catch {
  console.error("Unable to retrieve the service role key from the Supabase CLI. Make sure you are logged in with `supabase login`.");
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("No service role key was returned for the linked Supabase project.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
    user_metadata: {
      environment: "test",
      is_test_user: true,
      name: fullName,
      business_name: businessName,
  },
});

if (error) {
  console.error(`Failed to create test user: ${error.message}`);
  process.exit(1);
}

console.log(JSON.stringify({
  email,
  password,
  userId: data.user?.id ?? null,
  confirmed: true,
  note: "This account was created through the admin API for local testing and did not consume email quota.",
}, null, 2));
