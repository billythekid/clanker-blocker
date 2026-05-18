import { BlockerConfig, DEFAULT_SOURCE_URL } from "./types";
import { runBlocker } from "./blocker";

function parseList(input: string): string[] {
  if (!input.trim()) {
    return [];
  }
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN environment variable is required");
    process.exit(1);
  }

  const orgs = parseList(process.env.GITHUB_ORGS || process.env.GITHUB_ORG || "");
  const minPrs = parseInt(process.env.MIN_PRS || "3", 10);
  const dryRun = process.env.DRY_RUN === "true";
  const activeSince = process.env.ACTIVE_SINCE || undefined;
  const sourceUrl = process.env.SOURCE_URL || DEFAULT_SOURCE_URL;
  const extraUsernames = parseList(process.env.EXTRA_USERNAMES || "");
  const excludeUsernames = parseList(process.env.EXCLUDE_USERNAMES || "");

  const config: BlockerConfig = {
    minPrs,
    dryRun,
    activeSince,
    sourceUrl,
    extraUsernames,
    excludeUsernames,
  };

  const target = orgs.length > 0 ? orgs.map((o) => `org/${o}`).join(", ") : "personal account";
  console.log("Clanker Blocker");
  console.log(`   Target: ${target}`);
  console.log(`   Min PRs: ${minPrs}`);
  console.log(`   Dry run: ${dryRun}`);
  console.log();

  const result = await runBlocker(token, orgs, config);

  console.log();
  console.log("=== Results ===");
  console.log(`  Newly blocked: ${result.blocked.length}`);
  console.log(`  Already blocked: ${result.alreadyBlocked.length}`);
  console.log(`  Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

main();
