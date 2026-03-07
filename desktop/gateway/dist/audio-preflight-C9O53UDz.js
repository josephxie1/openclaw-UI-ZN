import "./paths-B4BZAPZh.js";
import { F as shouldLogVerbose, M as logVerbose } from "./utils-BKDT474X.js";
import "./thinking-BB3zi8pq.js";
import "./agent-scope-D_zGtnox.js";
import "./subsystem-VTlWhMKb.js";
import "./openclaw-root-rn0A27By.js";
import "./exec-vwrJesku.js";
import "./model-selection-82PVSbGK.js";
import "./github-copilot-token-nncItI8D.js";
import "./boolean-CE7i9tBR.js";
import "./env-U62qLjIp.js";
import "./host-env-security-CJMD0__Z.js";
import "./env-vars-gp4sxqr7.js";
import "./manifest-registry-2uOrD3Lr.js";
import "./zod-schema.sensitive-CDAit1Bm.js";
import "./dock-WgTQYXEa.js";
import "./message-channel-Kgna1vBs.js";
import { a as resolveMediaAttachmentLocalRoots, n as createMediaAttachmentCache, o as runCapability, r as normalizeMediaAttachments, s as isAudioAttachment, t as buildProviderRegistry } from "./runner-DipyKcrz.js";
import "./image-BmjqZVsr.js";
import "./models-config-CAdryvBR.js";
import "./pi-model-discovery-Bu5v15pj.js";
import "./pi-embedded-helpers-Sl6s9PvE.js";
import "./sandbox-BPirxlgj.js";
import "./tool-catalog-IBWCA-2a.js";
import "./chrome-CLxBG4X0.js";
import "./tailscale-B75FY02i.js";
import "./tailnet-_mVv0dKW.js";
import "./ws-DJ7x-04t.js";
import "./auth-B5QWqm-f.js";
import "./server-context-B7q1THBo.js";
import "./frontmatter-BmSW8Z0-.js";
import "./skills-DCB7NmWY.js";
import "./path-alias-guards-BtU22bLe.js";
import "./paths-DvqGb6xa.js";
import "./redact-CHv3ivPV.js";
import "./errors-Djy9l-lu.js";
import "./fs-safe-CYw4dFPj.js";
import "./ssrf-BXDXzZL_.js";
import "./image-ops-BBXywopb.js";
import "./store-w7wgV-e1.js";
import "./ports-csNzxb2D.js";
import "./trash-BBJmn2wY.js";
import "./server-middleware-BZlz_kXM.js";
import "./sessions-eZVPDvN6.js";
import "./plugins-BOMr5br8.js";
import "./accounts-BI0c9qZz.js";
import "./accounts-DxlJH0sT.js";
import "./logging-w5jq5901.js";
import "./accounts-B5sqOlIj.js";
import "./bindings-2Hl6Kz2z.js";
import "./paths-ENyTm-5-.js";
import "./chat-envelope-C9vncoSN.js";
import "./tool-images-Bm-L66dQ.js";
import "./tool-display-BQ86Un7Q.js";
import "./fetch-guard-zSeQ1p2e.js";
import "./api-key-rotation-C2F8NGeW.js";
import "./local-roots-DFBNlTMB.js";
import "./model-catalog-DfitMhOD.js";

//#region src/media-understanding/audio-preflight.ts
/**
* Transcribes the first audio attachment BEFORE mention checking.
* This allows voice notes to be processed in group chats with requireMention: true.
* Returns the transcript or undefined if transcription fails or no audio is found.
*/
async function transcribeFirstAudio(params) {
	const { ctx, cfg } = params;
	const audioConfig = cfg.tools?.media?.audio;
	if (!audioConfig || audioConfig.enabled === false) return;
	const attachments = normalizeMediaAttachments(ctx);
	if (!attachments || attachments.length === 0) return;
	const firstAudio = attachments.find((att) => att && isAudioAttachment(att) && !att.alreadyTranscribed);
	if (!firstAudio) return;
	if (shouldLogVerbose()) logVerbose(`audio-preflight: transcribing attachment ${firstAudio.index} for mention check`);
	const providerRegistry = buildProviderRegistry(params.providers);
	const cache = createMediaAttachmentCache(attachments, { localPathRoots: resolveMediaAttachmentLocalRoots({
		cfg,
		ctx
	}) });
	try {
		const result = await runCapability({
			capability: "audio",
			cfg,
			ctx,
			attachments: cache,
			media: attachments,
			agentDir: params.agentDir,
			providerRegistry,
			config: audioConfig,
			activeModel: params.activeModel
		});
		if (!result || result.outputs.length === 0) return;
		const audioOutput = result.outputs.find((output) => output.kind === "audio.transcription");
		if (!audioOutput || !audioOutput.text) return;
		firstAudio.alreadyTranscribed = true;
		if (shouldLogVerbose()) logVerbose(`audio-preflight: transcribed ${audioOutput.text.length} chars from attachment ${firstAudio.index}`);
		return audioOutput.text;
	} catch (err) {
		if (shouldLogVerbose()) logVerbose(`audio-preflight: transcription failed: ${String(err)}`);
		return;
	} finally {
		await cache.cleanup();
	}
}

//#endregion
export { transcribeFirstAudio };