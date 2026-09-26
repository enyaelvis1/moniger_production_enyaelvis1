import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const configContents = readFileSync("supabase/config.toml", "utf8");
const projectRef = configContents.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] ?? "unknown";
const envContents = readFileSync(".env", "utf8");
const projectUrl = envContents.match(/^VITE_SUPABASE_URL="([^"]+)"/m)?.[1] ?? "configured linked project";
const confirmationPhrase = "DELETE ALL LINKED DATA";

const prompt = createInterface({ input, output });

try {
  console.warn("WARNING: This will permanently delete all data in the LINKED Supabase project.");
  console.warn(`Project ref: ${projectRef}`);
  console.warn(`Project URL: ${projectUrl}`);
  console.warn("The linked database will be reset and recreated from the repository migrations. This is irreversible.");
  console.warn("");

  const answer = (await prompt.question("Do you really want to delete all linked platform data? Type yes to continue: "))
    .trim()
    .toLowerCase();

  if (answer !== "yes") {
    console.log("Cancelled. No data was deleted.");
    process.exitCode = 0;
  } else {
    const phrase = (await prompt.question(`Type ${confirmationPhrase} to continue: `)).trim();

    if (phrase !== confirmationPhrase) {
      console.log("Cancelled. The confirmation phrase did not match. No data was deleted.");
      process.exitCode = 0;
    } else {
      const projectConfirmation = (await prompt.question(`Type the linked project ref (${projectRef}) to continue: `)).trim();

      if (projectConfirmation !== projectRef) {
        console.log("Cancelled. The project ref did not match. No data was deleted.");
        process.exitCode = 0;
      } else {
        console.log("Resetting the linked Supabase database...");
        execFileSync("supabase", ["db", "reset", "--linked", "--no-seed", "--yes"], {
          stdio: "inherit",
        });
        console.log("Linked platform data was deleted and the linked schema was recreated from migrations.");
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Local data reset failed.");
  process.exitCode = 1;
} finally {
  prompt.close();
}
