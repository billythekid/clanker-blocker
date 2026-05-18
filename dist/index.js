require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 929:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
const types_1 = __nccwpck_require__(522);
const blocker_1 = __nccwpck_require__(685);
const fs = __importStar(__nccwpck_require__(896));
async function run() {
    try {
        const token = getInput("token", true);
        const orgs = parseList(getInput("orgs") || getInput("org"));
        const minPrs = parseInt(getInput("min-prs") || "3", 10);
        const dryRun = getInput("dry-run") === "true";
        const activeSince = getInput("active-since") || undefined;
        const sourceUrl = getInput("source-url") || types_1.DEFAULT_SOURCE_URL;
        const extraUsernames = parseList(getInput("extra-usernames"));
        const excludeUsernames = parseList(getInput("exclude-usernames"));
        const config = {
            minPrs,
            dryRun,
            activeSince,
            sourceUrl,
            extraUsernames,
            excludeUsernames,
        };
        const result = await (0, blocker_1.runBlocker)(token, orgs, config);
        setOutput("blocked-count", String(result.blocked.length));
        setOutput("already-blocked-count", String(result.alreadyBlocked.length));
        setOutput("error-count", String(result.errors.length));
        setOutput("blocked-users", JSON.stringify(result.blocked));
        writeSummary(result, config);
        if (result.errors.length > 0) {
            console.log(`::warning::Failed to block ${result.errors.length} accounts. Check logs for details.`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`::error::${message}`);
        process.exitCode = 1;
    }
}
function getInput(name, required = false) {
    const val = process.env[`INPUT_${name.replace(/-/g, "_").toUpperCase()}`] || "";
    if (required && !val) {
        throw new Error(`Input required and not supplied: ${name}`);
    }
    return val;
}
function parseList(input) {
    if (!input.trim()) {
        return [];
    }
    return input.split(",").map((s) => s.trim()).filter(Boolean);
}
function setOutput(name, value) {
    const outputFile = process.env["GITHUB_OUTPUT"];
    if (outputFile) {
        fs.appendFileSync(outputFile, `${name}=${value}\n`);
    }
}
function writeSummary(result, config) {
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


/***/ }),

/***/ 685:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.runBlocker = runBlocker;
const GITHUB_API = "https://api.github.com";
async function runBlocker(token, orgs, config) {
    const result = {
        blocked: [],
        alreadyBlocked: [],
        skipped: [],
        errors: [],
    };
    const clankers = await fetchClankers(config.sourceUrl);
    const targets = filterClankers(clankers, config);
    // Add extra usernames as synthetic entries
    const extraEntries = config.extraUsernames.map((u) => ({
        username: u,
        total_prs: config.minPrs,
        first_pr: "",
        last_pr: "",
    }));
    const allTargets = [...targets, ...extraEntries];
    // Build exclude set
    const excludeSet = new Set(config.excludeUsernames.map((u) => u.toLowerCase()));
    console.log(`Found ${clankers.length} total clankers, ${targets.length} meet threshold (≥${config.minPrs} PRs)` +
        (extraEntries.length ? `, +${extraEntries.length} extra` : "") +
        (excludeSet.size ? `, ${excludeSet.size} excluded` : ""));
    // Determine blocking targets: list of orgs, or personal account (undefined)
    const blockingTargets = orgs.length > 0 ? orgs : [undefined];
    for (const org of blockingTargets) {
        const label = org ? `org/${org}` : "personal account";
        console.log(`\nBlocking on: ${label}`);
        let currentlyBlocked;
        try {
            currentlyBlocked = await getBlockedUsers(token, org);
        }
        catch (err) {
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
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                result.errors.push({ username, error: message });
                console.error(`Failed to block ${username}: ${message}`);
            }
        }
    }
    return result;
}
async function fetchClankers(sourceUrl) {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
        throw new Error(`Failed to fetch clankers: ${res.status} ${res.statusText}`);
    }
    return res.json();
}
function filterClankers(clankers, config) {
    let filtered = clankers.filter((c) => c.total_prs >= config.minPrs);
    if (config.activeSince) {
        const since = new Date(config.activeSince);
        filtered = filtered.filter((c) => new Date(c.last_pr) >= since);
    }
    return filtered;
}
async function getBlockedUsers(token, org) {
    const blocked = [];
    let page = 1;
    while (true) {
        const url = org
            ? `${GITHUB_API}/orgs/${org}/blocks?per_page=100&page=${page}`
            : `${GITHUB_API}/user/blocks?per_page=100&page=${page}`;
        const res = await githubFetch(url, token);
        if (!res.ok) {
            throw new Error(`Failed to fetch blocked users: ${res.status}`);
        }
        const users = await res.json();
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
async function blockUser(token, username, org) {
    const url = org
        ? `${GITHUB_API}/orgs/${org}/blocks/${username}`
        : `${GITHUB_API}/user/blocks/${username}`;
    const res = await githubFetch(url, token, "PUT");
    if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
    }
}
function githubFetch(url, token, method = "GET") {
    return fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });
}


/***/ }),

/***/ 522:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DEFAULT_SOURCE_URL = void 0;
exports.DEFAULT_SOURCE_URL = "https://raw.githubusercontent.com/UnsafeLabs/Bounty-Hunters/main/clankers.json";


/***/ }),

/***/ 896:
/***/ ((module) => {

module.exports = require("fs");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(929);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=index.js.map