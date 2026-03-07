type RouteLike = {
    agentId: string;
    sessionKey: string;
};
export declare function createInboundEnvelopeBuilder<TConfig, TEnvelope>(params: {
    cfg: TConfig;
    route: RouteLike;
    sessionStore?: string;
    resolveStorePath: (store: string | undefined, opts: {
        agentId: string;
    }) => string;
    readSessionUpdatedAt: (params: {
        storePath: string;
        sessionKey: string;
    }) => number | undefined;
    resolveEnvelopeFormatOptions: (cfg: TConfig) => TEnvelope;
    formatAgentEnvelope: (params: {
        channel: string;
        from: string;
        timestamp?: number;
        previousTimestamp?: number;
        envelope: TEnvelope;
        body: string;
    }) => string;
}): (input: {
    channel: string;
    from: string;
    body: string;
    timestamp?: number;
}) => {
    storePath: string;
    body: string;
};
export {};
