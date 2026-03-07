import type { AssistantMessage, StopReason, Usage } from "@mariozechner/pi-ai";
export type StreamModelDescriptor = {
    api: string;
    provider: string;
    id: string;
};
export declare function buildZeroUsage(): Usage;
export declare function buildAssistantMessageWithZeroUsage(params: {
    model: StreamModelDescriptor;
    content: AssistantMessage["content"];
    stopReason: StopReason;
    timestamp?: number;
}): AssistantMessage;
export declare function buildStreamErrorAssistantMessage(params: {
    model: StreamModelDescriptor;
    errorMessage: string;
    timestamp?: number;
}): AssistantMessage & {
    stopReason: "error";
    errorMessage: string;
};
