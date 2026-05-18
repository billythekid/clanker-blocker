# Clanker Blocker

Auto-block accounts from the [UnsafeLabs/Bounty-Hunters](https://github.com/UnsafeLabs/Bounty-Hunters) clankers list on your GitHub organization or personal account.

The Bounty-Hunters repo maintains a live list of accounts caught automating the opening of PRs against honeypot repositories. This tool fetches that list and blocks qualifying accounts so they can't interact with your repos.

## Usage

### As a GitHub Action (recommended)

This Action doesn't interact with the repository it runs in. It uses your PAT to block accounts at the user or org level. You can add the workflow to any repo you have write access to. Good choices include:

- Your profile repo (`username/username`)
- A dedicated admin/automation repo
- Your `.github` repo (if you have one)
- Any existing repo you use for maintenance workflows

Add a workflow file:

```yaml
name: Block Clanker Accounts

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
          # org: my-org            # Single org
          # orgs: org1,org2,org3   # Multiple orgs
          min-prs: "3"           # Minimum PRs to qualify
          # dry-run: "true"      # Test without blocking
```

### Run locally (try before you commit)

Clone the repo and run directly from your terminal:

```bash
cd clanker-blocker

# Dry run — see what would be blocked without blocking anything
DRY_RUN=true GITHUB_TOKEN=$(gh auth token) MIN_PRS=5 npx tsx src/index.ts

# Block on your personal account
GITHUB_TOKEN=$(gh auth token) MIN_PRS=5 npx tsx src/index.ts

# Block on an org
GITHUB_TOKEN=$(gh auth token) GITHUB_ORG=my-org MIN_PRS=5 npx tsx src/index.ts

# Block on multiple orgs
GITHUB_TOKEN=$(gh auth token) GITHUB_ORGS=org1,org2 MIN_PRS=5 npx tsx src/index.ts
```

Requires Node 22+ and the `gh` CLI authenticated with `user` scope (`gh auth refresh -h github.com -s user`).

## Configuration

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `token` | **Yes** | — | GitHub personal access token. Classic tokens need the `user` scope for personal blocking, or `admin:org` for organization-level blocking. Fine-grained tokens need the "Block another user" permission. |
| `org` | No | — | Organization to block users from. Accepts a single org or a comma-separated list for multiple orgs. If omitted, blocks are applied to the authenticated user's personal account. `orgs` also works as an alias. |
| `min-prs` | No | `3` | Minimum number of PRs an account must have submitted to the honeypot repo to qualify for blocking. Higher values = more conservative (only block the most active accounts). |
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

1. Create a classic token with the appropriate scope:
   - **[Personal blocking](https://github.com/settings/tokens/new?description=clanker-blocker&scopes=user)** — `user` scope
   - **[Org blocking](https://github.com/settings/tokens/new?description=clanker-blocker&scopes=admin:org)** — `admin:org` scope
   - **Fine-grained token:** "Block another user" permission (read and write) — [create here](https://github.com/settings/personal-access-tokens/new)
2. Add the token as a repository secret named `BLOCK_TOKEN` (or whatever you reference in your workflow)

## How it works

1. Fetches `clankers.json` from [UnsafeLabs/Bounty-Hunters](https://github.com/UnsafeLabs/Bounty-Hunters)
2. Filters accounts by your configured threshold
3. Checks which accounts you've already blocked (avoids redundant API calls)
4. Blocks new accounts that meet the criteria

## License

MIT
