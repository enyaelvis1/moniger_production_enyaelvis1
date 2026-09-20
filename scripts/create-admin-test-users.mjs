import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { assertTestDataEnvironment } from "./assert-test-data-environment.mjs";

Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), ""));

const readEnvValue = (envContents, key) => {
  const match = envContents.match(new RegExp(`^${key}="([^"]*)"$`, "m"));
  return match?.[1] ?? "";
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
const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const memberEmail = process.env.PLAYWRIGHT_NON_ADMIN_EMAIL || "";
const memberPassword = process.env.PLAYWRIGHT_NON_ADMIN_PASSWORD || "";
const adminBusinessName = process.env.PLAYWRIGHT_ADMIN_BUSINESS_NAME || "Moniger Admin QA";
const memberBusinessName = process.env.PLAYWRIGHT_NON_ADMIN_BUSINESS_NAME || "Moniger Member QA";

if (!projectRef || !supabaseUrl) {
  console.error("Missing VITE_SUPABASE_PROJECT_ID or VITE_SUPABASE_URL in .env.");
  process.exit(1);
}

if (!adminEmail || !adminPassword || !memberEmail || !memberPassword) {
  console.error("Missing Playwright admin or non-admin credentials in .env.");
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
    autoRefreshToken: false,
    persistSession: false,
  },
});

const listAllUsers = async () => {
  const users = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    users.push(...(data?.users ?? []));
    hasNextPage = Boolean(data?.users?.length) && (data?.users?.length ?? 0) === 200;
    page += 1;
  }

  return users;
};

const ensureUser = async ({ businessName, email, fullName, password }) => {
  const existingUsers = await listAllUsers();
  const existingUser = existingUsers.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        environment: "test",
        is_test_user: true,
        business_name: businessName,
        name: fullName,
      },
    });

    if (error) {
      throw error;
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      environment: "test",
      is_test_user: true,
      business_name: businessName,
      name: fullName,
    },
  });

  if (error) {
    throw error;
  }

  return data.user;
};

const ensureProfileAndBusiness = async ({
  businessName,
  userEmail,
  userId,
  fullName,
}) => {
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        full_name: fullName,
        id: userId,
      },
      { onConflict: "id" },
    );

  if (profileError) {
    throw profileError;
  }

  const { data: existingBusiness, error: businessLookupError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (businessLookupError) {
    throw businessLookupError;
  }

  if (existingBusiness?.id) {
    const { error: businessUpdateError } = await supabase
      .from("businesses")
      .update({
        email: userEmail,
        name: businessName,
      })
      .eq("id", existingBusiness.id);

    if (businessUpdateError) {
      throw businessUpdateError;
    }

    const { error: memberUpsertError } = await supabase
      .from("business_members")
      .upsert(
        {
          business_id: existingBusiness.id,
          invited_by: userId,
          joined_at: new Date().toISOString(),
          role: "owner",
          status: "active",
          user_id: userId,
        },
        { onConflict: "business_id,user_id" },
      );

    if (memberUpsertError) {
      throw memberUpsertError;
    }

    const { error: preferenceUpsertError } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          business_id: existingBusiness.id,
          user_id: userId,
        },
        { onConflict: "business_id,user_id" },
      );

    if (preferenceUpsertError) {
      throw preferenceUpsertError;
    }

    const { error: overrideDeleteError } = await supabase
      .from("business_admin_overrides")
      .delete()
      .eq("business_id", existingBusiness.id);

    if (overrideDeleteError) {
      throw overrideDeleteError;
    }

    return existingBusiness.id;
  }

  throw new Error(`No workspace exists for user ${userEmail}. Recreate the user so the auth trigger can provision one.`);
};

try {
  const adminUser = await ensureUser({
    businessName: adminBusinessName,
    email: adminEmail,
    fullName: "Moniger Playwright Admin",
    password: adminPassword,
  });

  const memberUser = await ensureUser({
    businessName: memberBusinessName,
    email: memberEmail,
    fullName: "Moniger Playwright Member",
    password: memberPassword,
  });

  const adminBusinessId = await ensureProfileAndBusiness({
    businessName: adminBusinessName,
    fullName: "Moniger Playwright Admin",
    userEmail: adminEmail,
    userId: adminUser.id,
  });

  const memberBusinessId = await ensureProfileAndBusiness({
    businessName: memberBusinessName,
    fullName: "Moniger Playwright Member",
    userEmail: memberEmail,
    userId: memberUser.id,
  });

  const { error: adminUpsertError } = await supabase
    .from("admin_users")
    .upsert(
      {
        role: "super_admin",
        user_id: adminUser.id,
      },
      { onConflict: "user_id" },
    );

  if (adminUpsertError) {
    throw adminUpsertError;
  }

  const { error: memberDeleteError } = await supabase
    .from("admin_users")
    .delete()
    .eq("user_id", memberUser.id);

  if (memberDeleteError) {
    throw memberDeleteError;
  }

  console.log(JSON.stringify({
    admin: {
      businessId: adminBusinessId,
      businessName: adminBusinessName,
      email: adminEmail,
      password: adminPassword,
      role: "super_admin",
      userId: adminUser.id,
    },
    member: {
      businessId: memberBusinessId,
      businessName: memberBusinessName,
      email: memberEmail,
      password: memberPassword,
      role: "non_admin",
      userId: memberUser.id,
    },
    note: "Playwright admin access credentials are now ensured in the linked Supabase project.",
  }, null, 2));
} catch (error) {
  console.error(`Failed to prepare Playwright admin test users: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exit(1);
}
