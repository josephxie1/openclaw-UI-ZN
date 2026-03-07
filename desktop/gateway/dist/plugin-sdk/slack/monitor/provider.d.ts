import { resolveOpenProviderRuntimeGroupPolicy, resolveDefaultGroupPolicy } from "../../config/runtime-group-policy.js";
import type { MonitorSlackOpts } from "./types.js";
type SlackSocketDisconnectEvent = "disconnect" | "unable_to_socket_mode_start" | "error";
type EmitterLike = {
    on: (event: string, listener: (...args: unknown[]) => void) => unknown;
    off: (event: string, listener: (...args: unknown[]) => void) => unknown;
};
declare function getSocketEmitter(app: unknown): EmitterLike | null;
declare function waitForSlackSocketDisconnect(app: unknown, abortSignal?: AbortSignal): Promise<{
    event: SlackSocketDisconnectEvent;
    error?: unknown;
}>;
export declare function monitorSlackProvider(opts?: MonitorSlackOpts): Promise<void>;
export declare const __testing: {
    resolveSlackRuntimeGroupPolicy: typeof resolveOpenProviderRuntimeGroupPolicy;
    resolveDefaultGroupPolicy: typeof resolveDefaultGroupPolicy;
    getSocketEmitter: typeof getSocketEmitter;
    waitForSlackSocketDisconnect: typeof waitForSlackSocketDisconnect;
};
export {};
