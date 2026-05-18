# Clanker Blocker

Auto-block identified bot accounts from the [UnsafeLabs/Bounty-Hunters](https://github.com/UnsafeLabs/Bounty-Hunters) clankers list on your GitHub organization or personal account.

The Bounty-Hunters repo maintains a live list of accounts caught engaging in automated PR farming against honeypot repositories. This tool fetches that list and blocks qualifying accounts so they can't interact with your repos.

## Usage

### As a GitHub Action (recommended)

Add a workflow to your repo:

```yaml
name: Block Clanker Bots

on:
  schedule:
    - cron: "0 6 * * *"  # Daily at 06:00 UTC
  workflow_dispatch:

jobs:
  block:
    runs-on: ubuntu-latest
    steps:
      - name: Block clanker accounts
        uses: billythekid/clanker-blocker@v1
        with:
          token: ${{ secrets.BLOCK_TOKEN }}
          # org: my-org          # For org-level blocking
          min-prs: "3"           # Minimum PRs to qualify
          # dry-run: "true"      # Test without blocking
```

### As a CLI tool

```bash
export GITHUB_TOKEN=ghp_xxx
export GITHUB_ORG=my-org    # Optional: omit for personal account
export MIN_PRS=3            # Optional: default 3
export DRY_RUN=true         # Optional: test mode

npx clanker-blocker
```

### As a library

```typescript
import { runBlocker } from "clanker-blocker";

const result = await runBlocker({
  token: "ghp_xxx",
  org: "my-org",
  config: { minPrs: 5, dryRun: false },
});

console.log(`Blocked ${result.blocked.length} accounts`);
```

## Configuration

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `token` | **Yes** | — | GitHub personal access token. Needs `user:block` scope for personal account blocking, or `admin:org` scope for organization-level blocking. |
| `org` | No | — | The organization to block users from. If omitted, blocks are applied to the authenticated user's personal account. |
| `min-prs` | No | `3` | Minimum number of PRs an account must have submitted to the honeypot repo to qualify for blocking. Higher values = more conservative (only block the most prolific bots). |
| `dry-run` | No | `false` | When set to `"true"`, reports which accounts would be blocked without actually blocking them. Useful for previewing the impact before committing. |
| `active-since` | No | — | ISO 8601 date string (e.g., `2026-05-01`). Only blocks accounts whose most recent PR to the honeypot repo was on or after this date. Useful for ignoring old/stale accounts that may have already been suspended. |
| `source-url` | No | UnsafeLabs list | Override the clankers.json source URL. Use this to point at your own fork or a custom blocklist that follows the same JSON format. |
| `extra-usernames` | No | — | Comma-separated list of additional usernames to block beyond what appears in the clankers list. These are always blocked regardless of threshold. |
| `exclude-usernames` | No | — | Comma-separated list of usernames to never block, even if they appear on the clankers list. Use for known false positives. |

### Outputs

| Output | Description |
|--------|-------------|
| `blocked-count` | Number of accounts newly blocked in this run. |
| `already-blocked-count` | Number of accounts that were already blocked (skipped). |
| `error-count` | Number of accounts that failed to block (e.g., account suspended, rate limit). |
| `blocked-users` | JSON array of usernames that were newly blocked. |

### Token setup

1. Go to [GitHub Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Create a fine-grained or classic token with the appropriate scope:
   - **Personal account blocking:** `user:block`
   - **Organization blocking:** `admin:org`
3. Add the token as a repository secret named `BLOCK_TOKEN` (or whatever you reference in your workflow)

## How it works

1. Fetches `clankers.json` from [UnsafeLabs/Bounty-Hunters](https://github.com/UnsafeLabs/Bounty-Hunters)
2. Filters accounts by your configured threshold
3. Checks which accounts you've already blocked (avoids redundant API calls)
4. Blocks new accounts that meet the criteria

## License

MIT
