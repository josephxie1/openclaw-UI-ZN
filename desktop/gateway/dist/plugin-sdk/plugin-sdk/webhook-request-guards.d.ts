import type { IncomingMessage, ServerResponse } from "node:http";
import type { FixedWindowRateLimiter } from "./webhook-memory-guards.js";
export declare function isJsonContentType(value: string | string[] | undefined): boolean;
export declare function applyBasicWebhookRequestGuards(params: {
    req: IncomingMessage;
    res: ServerResponse;
    allowMethods?: readonly string[];
    rateLimiter?: FixedWindowRateLimiter;
    rateLimitKey?: string;
    nowMs?: number;
    requireJsonContentType?: boolean;
}): boolean;
export declare function readJsonWebhookBodyOrReject(params: {
    req: IncomingMessage;
    res: ServerResponse;
    maxBytes: number;
    timeoutMs?: number;
    emptyObjectOnEmpty?: boolean;
    invalidJsonMessage?: string;
}): Promise<{
    ok: true;
    value: unknown;
} | {
    ok: false;
}>;
