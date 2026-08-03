import { CmdKItem } from './Layout.js';
interface WaffleSearchRow {
    id?: string;
    display_id?: string | null;
    title?: string;
    status?: string;
    product?: string;
    subsystem?: string | null;
    tags?: string | null;
    submitted_by_name?: string | null;
}
export interface WaffleItemSearchOptions {
    /** API base prefix, matching the host's proxy convention (default ''). */
    apiBase?: string;
    /** Max results shown in the palette (default 8; server caps apply). */
    limit?: number;
    /** BUG-1151/1150 (WAFFLE-FIX-1B): build the navigation target per row.
     *  The waffle web app passes rows to /items/<display_id||display_number>
     *  (its canonical item URLs); every other portal keeps the ?bug= default
     *  (legacy compat, still honored everywhere). */
    itemHref?: (row: WaffleSearchRow) => string;
}
export declare function createWaffleItemSearch(opts?: WaffleItemSearchOptions): (query: string) => Promise<{
    items: CmdKItem[];
    total?: number;
}>;
export {};
