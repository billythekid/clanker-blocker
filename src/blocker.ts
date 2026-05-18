import { ClankerEntry, BlockerConfig, BlockResult } from "./types";

const GITHUB_API = "https://api.github.com";

export async function runBlocker(
  token: string,
  orgs: string[],
  config: BlockerConfig
): Promise<BlockResult> {
  const result: BlockResult = {
    blocked: [],
    alreadyBlocked: [],
    skipped: [],
    errors: [],
  };

  const clankers = await fetchClankers(config.sourceUrl);
  const targets = filterClankers(clankers, config);

  // Add extra usernames as synthetic entries
  const extraEntries: ClankerEntry[] = config.extraUsernames.map((u) => ({
    username: u,
    total_prs: config.minPrs,
    first_pr: "",
    last_pr: "",
  }));

  const allTargets = [...targets, ...extraEntries];

  // Build exclude set
  const excludeSet = new Set(config.excludeUsernames.map((u) => u.toLowerCase()));

  console.log(
    `Found ${clankers.length} total clankers, ${targets.length} meet threshold (≥${config.minPrs} PRs)` +
    (extraEntries.length ? `, +${extraEntries.length} extra` : "") +
    (excludeSet.size ? `, ${excludeSet.size} excluded` : "")
  );

  // Determine blocking targets: list of orgs, or personal account (undefined)
  const blockingTargets: Array<string | undefined> = orgs.length > 0 ? orgs : [undefined];

  for (const org of blockingTargets) {
    const label = org ? `org/${org}` : "personal account";
    console.log(`\nBlocking on: ${label}`);

    let currentlyBlocked: string[];
    try {
      currentlyBlocked = await getBlockedUsers(token, org);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to access ${label}: ${message}. Skipping.`);
      result.errors.push({ username: `[${label}]`, error: message });
      continue;
    }
    const blockedSet = new Set(currentlyBlocked.map((u) => u.toLowerCase()));

    for (const clanker of allTargets) {
      const username = clanker.username;

      if (excludeSet.has(username.toLowerCase())) {
        result.skipped.push(username);
        continue;
      }

      if (blockedSet.has(username.toLowerCase())) {
        result.alreadyBlocked.push(username);
        continue;
      }

      if (config.dryRun) {
        console.log(`[DRY RUN] Would block: ${username} (${clanker.total_prs} PRs)`);
        result.blocked.push(username);
        continue;
      }

      try {
        await blockUser(token, username, org);
        result.blocked.push(username);
        console.log(`Blocked: ${username} (${clanker.total_prs} PRs)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ username, error: message });
        console.error(`Failed to block ${username}: ${message}`);
      }
    }
  }

  return result;
}

async function fetchClankers(sourceUrl: string): Promise<ClankerEntry[]> {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch clankers: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ClankerEntry[]>;
}

export function filterClankers(clankers: ClankerEntry[], config: BlockerConfig): ClankerEntry[] {
  let filtered = clankers.filter((c) => c.total_prs >= config.minPrs);

  if (config.activeSince) {
    const since = new Date(config.activeSince);
    filtered = filtered.filter((c) => new Date(c.last_pr) >= since);
  }

  return filtered;
}

async function getBlockedUsers(token: string, org?: string): Promise<string[]> {
  const blocked: string[] = [];
  let page = 1;

  while (true) {
    const url = org
      ? `${GITHUB_API}/orgs/${org}/blocks?per_page=100&page=${page}`
      : `${GITHUB_API}/user/blocks?per_page=100&page=${page}`;

    const res = await githubFetch(url, token);
    if (!res.ok) {
      throw new Error(`Failed to fetch blocked users: ${res.status}`);
    }

    const users: Array<{ login: string }> = await res.json();
    if (users.length === 0) {
      break;
    }
    blocked.push(...users.map((u) => u.login));
    if (users.length < 100) {
      break;
    }
    page++;
  }

  return blocked;
}

async function blockUser(token: string, username: string, org?: string): Promise<void> {
  const url = org
    ? `${GITHUB_API}/orgs/${org}/blocks/${username}`
    : `${GITHUB_API}/user/blocks/${username}`;

  const res = await githubFetch(url, token, "PUT");
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
}

function githubFetch(url: string, token: string, method = "GET"): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}
