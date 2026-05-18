export interface ClankerEntry {
  username: string;
  total_prs: number;
  first_pr: string;
  last_pr: string;
}

export interface BlockerConfig {
  /** Minimum PR count to qualify for blocking (default: 3) */
  minPrs: number;
  /** Source URL for clankers.json */
  sourceUrl: string;
  /** Whether to actually block or just report */
  dryRun: boolean;
  /** Optional: only block accounts active after this date */
  activeSince?: string;
  /** Additional usernames to block beyond the clankers list */
  extraUsernames: string[];
  /** Usernames to never block, even if on the list */
  excludeUsernames: string[];
}

export interface BlockResult {
  blocked: string[];
  alreadyBlocked: string[];
  skipped: string[];
  errors: Array<{ username: string; error: string }>;
}

export const DEFAULT_SOURCE_URL =
  "https://raw.githubusercontent.com/UnsafeLabs/Bounty-Hunters/main/clankers.json";
