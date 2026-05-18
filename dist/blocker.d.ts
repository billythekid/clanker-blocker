import { BlockerConfig, BlockResult } from "./types";
export declare function runBlocker(token: string, orgs: string[], config: BlockerConfig): Promise<BlockResult>;
