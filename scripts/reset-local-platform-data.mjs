import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const confirmationPhrase = "DELETE ALL LOCAL DATA";

const prompt = createInterface({ input, output });

try {
  console.warn("WARNING: This will permanently delete all data in the LOCAL Supabase database.");
  console.warn("It will reset the local database and reapply migrations. It does not target the linked production project.");
  console.warn("");

  const answer = (await prompt.question("Do you really want to delete all local platform data? Type yes to continue: "))
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
      console.log("Resetting the local Supabase database...");
      execFileSync("supabase", ["db", "reset", "--local", "--yes"], {
        stdio: "inherit",
      });
      console.log("Local platform data was deleted and the local schema was recreated from migrations.");
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Local data reset failed.");
  process.exitCode = 1;
} finally {
  prompt.close();
}
