import { BlockerConfig, DEFAULT_SOURCE_URL } from "./types";
import { runBlocker } from "./blocker";
import * as fs from "fs";

async function run(): Promise<void> {
  try {
    const token = getInput("token", true);
    const orgs = parseList(getInput("orgs") || getInput("org"));
    const minPrs = parseInt(getInput("min-prs") || "3", 10);
    const dryRun = getInput("dry-run") === "true";
    const activeSince = getInput("active-since") || undefined;
    const sourceUrl = getInput("source-url") || DEFAULT_SOURCE_URL;
    const extraUsernames = parseList(getInput("extra-usernames"));
    const excludeUsernames = parseList(getInput("exclude-usernames"));

    const config: BlockerConfig = {
      minPrs,
      dryRun,
      activeSince,
      sourceUrl,
      extraUsernames,
      excludeUsernames,
    };

    const result = await runBlocker(token, orgs, config);

    setOutput("blocked-count", String(result.blocked.length));
    setOutput("already-blocked-count", String(result.alreadyBlocked.length));
    setOutput("error-count", String(result.errors.length));
    setOutput("blocked-users", JSON.stringify(result.blocked));

    writeSummary(result, config);

    if (result.errors.length > 0) {
      console.log(
        `::warning::Failed to block ${result.errors.length} accounts. Check logs for details.`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`::error::${message}`);
    process.exitCode = 1;
  }
}

function getInput(name: string, required = false): string {
  const val = process.env[`INPUT_${name.replace(/-/g, "_").toUpperCase()}`] || "";
  if (required && !val) {
    throw new Error(`Input required and not supplied: ${name}`);
  }
  return val;
}

function parseList(input: string): string[] {
  if (!input.trim()) {
    return [];
  }
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

function setOutput(name: string, value: string): void {
  const outputFile = process.env["GITHUB_OUTPUT"];
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

function writeSummary(
  result: { blocked: string[]; alreadyBlocked: string[]; errors: Array<{ username: string; error: string }> },
  config: BlockerConfig
): void {
  const summaryFile = process.env["GITHUB_STEP_SUMMARY"];
  if (!summaryFile) {
    return;
  }

  const lines = [
    "## Clanker Blocker Results",
    "",
    "| Metric | Count |",
    "|--------|-------|",
    `| Newly blocked | ${result.blocked.length} |`,
    `| Already blocked | ${result.alreadyBlocked.length} |`,
    `| Errors | ${result.errors.length} |`,
    "",
    `Threshold: ≥${config.minPrs} PRs${config.dryRun ? " (dry run)" : ""}`,
  ];

  fs.appendFileSync(summaryFile, lines.join("\n") + "\n");
}

run();
