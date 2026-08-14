export interface WorkerEnv {
    JWT_SECRET: string;
    SM_API_URL?: string;
    SM_API_CLIENT_ID?: string;
    SM_API_CLIENT_SECRET?: string;
    [key: string]: string | undefined;
}
export interface SmApiClientOptions {
    baseUrl?: string;
}
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export interface SmApiClient {
    get(path: string, extraHeaders?: Record<string, string>): Promise<unknown>;
    post(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<unknown>;
    patch(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<unknown>;
    put(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<unknown>;
    del(path: string, extraHeaders?: Record<string, string>): Promise<unknown>;
    withCookie(cookieStr: string): {
        get(path: string): Promise<unknown>;
        post(path: string, body?: unknown): Promise<unknown>;
        patch(path: string, body?: unknown): Promise<unknown>;
        put(path: string, body?: unknown): Promise<unknown>;
        del(path: string): Promise<unknown>;
    };
}
export declare function signJWT(payload: Record<string, unknown>, secret: string): Promise<string>;
export declare function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null>;
export declare function getSession(request: Request, product?: string | null): string | null;
export declare function requireAuth(request: Request, env: WorkerEnv, product?: string | null): Promise<Record<string, unknown> | null>;
export declare function generateToken(): string;
export declare function generateId(prefix: string): string;
export declare function createSmApiClient(env: WorkerEnv, opts?: SmApiClientOptions): SmApiClient;
