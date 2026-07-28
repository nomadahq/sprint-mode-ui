import { default as React, CSSProperties } from 'react';
export interface BugPanelSession {
    contact_id?: string;
    display_name?: string;
    email?: string;
}
export interface BugPanelProps {
    isAdmin?: boolean;
    apiBase?: string;
    product?: string;
    label?: string;
    session?: BugPanelSession | null;
    offsetFab?: boolean;
    onClose?: () => void;
    visible?: boolean;
    focusBugId?: string | null;
    /** BUG-PANEL-STANDALONE-1: When true, renders as a full-viewport page instead of a side panel */
    standalone?: boolean;
}
export interface BugPanelHeaderButtonProps {
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
}
export interface BugComment {
    id: string;
    author_name?: string;
    body?: string;
    created_at?: string;
}
export interface BugAttachment {
    id: string;
    type: 'image' | 'file';
    filename: string;
    r2_key?: string;
    size?: number;
    mime?: string;
}
export interface VerificationResult {
    id: string;
    status: 'pass' | 'fail';
    screenshots?: string[];
    error?: string;
    duration_ms?: number;
}
export interface Bug {
    id: string;
    title: string;
    description?: string;
    type?: string;
    product?: string;
    status: string;
    priority?: string;
    page_url?: string;
    created_at?: string;
    submitted_by_name?: string;
    ai_classification?: string | Record<string, unknown>;
    fire_prompt?: string;
    close_reason?: string;
    verified_status?: string | null;
    verified_at?: string | null;
    verification_run_id?: string | null;
    test_spec?: string | Record<string, unknown> | null;
    verification_results?: VerificationResult[] | null;
    comments?: BugComment[];
    attachments?: BugAttachment[];
    assigned_to?: string | null;
    subsystem?: string | null;
    due_date?: string | null;
    tags?: string | null;
}
export interface ThreadItem {
    id: string;
    title: string;
    body?: string;
    product?: string;
    thread_id?: string;
    priority?: string;
    status?: string;
    tags?: string;
    created_at?: string;
}
export interface BugCounts {
    queue: number;
    mine: number;
    closed: number;
    verified: number;
    deferred: number;
    total: number;
}
export interface MyDayData {
    overdue: Bug[];
    due_today: Bug[];
    in_progress_mine: Bug[];
    newly_assigned: Bug[];
    recent_activity: Array<Bug & {
        kind?: string;
    }>;
    unassigned_on_my_products: Bug[];
}
export interface ProductCount {
    product: string;
    queue: number;
    open: number;
    in_progress: number;
    blocked: number;
    verified: number;
    deferred: number;
    total: number;
}
export declare function BugPanel(props: BugPanelProps): React.JSX.Element | null;
export declare function BugPanelHeaderButton({ onClick }: BugPanelHeaderButtonProps): React.DetailedReactHTMLElement<{
    onClick: React.MouseEventHandler<HTMLButtonElement> | undefined;
    'aria-label': string;
    title: string;
    style: CSSProperties;
}, HTMLElement>;
