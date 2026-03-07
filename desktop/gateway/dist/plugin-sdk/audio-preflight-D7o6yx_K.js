import "./accounts-Dw118nCx.js";
import "./paths-DCNrSyZW.js";
import "./github-copilot-token-Df-R0zCM.js";
import "./config-qG6hVMOw.js";
import { $ as logVerbose, nt as shouldLogVerbose } from "./subsystem-D7KkLxSJ.js";
import "./command-format-D4smYdZ1.js";
import "./agent-scope-DIxVRHtU.js";
import "./dock-CB3ZKNCM.js";
import "./message-channel-BhZc-dSE.js";
import "./sessions-7NPIq8ke.js";
import "./plugins-RTxgcyf8.js";
import "./accounts-CWu4D7zt.js";
import "./accounts-DQd1QCaM.js";
import "./bindings-fPId6HIm.js";
import "./paths-DG84V_EA.js";
import "./redact-BYwaiynP.js";
import "./errors-BMOVwRE7.js";
import "./path-alias-guards-DAOAT8XV.js";
import "./fs-safe-B9RHvpq_.js";
import "./image-ops-B26WIBFn.js";
import "./ssrf-Cq05cgbH.js";
import "./fetch-guard-DR3u3PeS.js";
import "./local-roots-b9tWNzo2.js";
import "./tool-images-_ggU2YiR.js";
import { a as resolveMediaAttachmentLocalRoots, n as createMediaAttachmentCache, o as runCapability, r as normalizeMediaAttachments, t as buildProviderRegistry, u as isAudioAttachment } from "./runner-DVnpwq8i.js";
import "./skills-ev61cEkl.js";
import "./chrome-DcGB6xhw.js";
import "./store-Bzi1R9J9.js";
import "./pi-embedded-helpers-mtN4uGWC.js";
import "./thinking-BgIZOmA_.js";
import "./image-CXlcWYPr.js";
import "./pi-model-discovery-EdOxTEAN.js";
import "./api-key-rotation-BNPCJeW5.js";

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