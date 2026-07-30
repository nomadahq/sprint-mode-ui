import { CmdKItem } from './Layout.js';
export interface WaffleItemSearchOptions {
    /** API base prefix, matching the host's proxy convention (default ''). */
    apiBase?: string;
    /** Max results shown in the palette (default 8; server caps apply). */
    limit?: number;
}
export declare function createWaffleItemSearch(opts?: WaffleItemSearchOptions): (query: string) => Promise<{
    items: CmdKItem[];
    total?: number;
}>;
