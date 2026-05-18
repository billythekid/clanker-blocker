import { ClankerEntry, BlockerConfig, BlockResult } from "./types";
export declare function runBlocker(token: string, orgs: string[], config: BlockerConfig): Promise<BlockResult>;
export declare function filterClankers(clankers: ClankerEntry[], config: BlockerConfig): ClankerEntry[];
