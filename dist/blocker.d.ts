import { BlockerConfig, BlockResult } from "./types";
export declare function runBlocker(token: string, org: string | undefined, config: BlockerConfig): Promise<BlockResult>;
