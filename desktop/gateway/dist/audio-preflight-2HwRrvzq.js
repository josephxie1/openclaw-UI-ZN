import "./agent-scope-DOGlT2cV.js";
import "./paths-B9lBY6-m.js";
import { $ as shouldLogVerbose, X as logVerbose } from "./subsystem-mPRezpll.js";
import "./workspace-5k-UUhQ1.js";
import "./model-selection-CwOrP4rO.js";
import "./github-copilot-token-BgKF-7S1.js";
import "./env-DijpAkAH.js";
import "./boolean-M-esQJt6.js";
import "./dock-DUCzi1P7.js";
import "./plugins-tZMHqQXn.js";
import "./accounts-CaRtAz_2.js";
import "./bindings-CVne_Hrz.js";
import "./accounts-8ZWbw0Zq.js";
import "./image-ops-BTLRgXTA.js";
import "./pi-model-discovery-CbFUCNZ5.js";
import "./message-channel-DKXv9Xa_.js";
import "./pi-embedded-helpers-CARAh64z.js";
import "./chrome-Dq0GBg4b.js";
import "./frontmatter-eHCuq81z.js";
import "./skills-ZeFEhkWa.js";
import "./path-alias-guards-BrkOkEP6.js";
import "./redact-B5RjPWCN.js";
import "./errors-BB1m5Yna.js";
import "./fs-safe-SlzoHURm.js";
import "./ssrf-l8l1dk4l.js";
import "./store-C_9XVp6p.js";
import "./sessions-Cq6vzHzY.js";
import "./accounts-BKkVzHhg.js";
import "./paths-C8TW5zqh.js";
import "./tool-images-BvOekDK7.js";
import "./thinking-DEPKewmZ.js";
import "./image-DfDK_FPR.js";
import "./gemini-auth-Dr1Iw07P.js";
import "./fetch-guard-BXwXup_j.js";
import "./local-roots-SwYJVbml.js";
import { a as resolveMediaAttachmentLocalRoots, n as createMediaAttachmentCache, o as runCapability, r as normalizeMediaAttachments, t as buildProviderRegistry, u as isAudioAttachment } from "./runner-B-7Z-D8H.js";

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