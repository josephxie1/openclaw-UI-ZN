import "./agent-scope-DbrWek9X.js";
import "./paths-DpzIdlnz.js";
import { $ as shouldLogVerbose, X as logVerbose } from "./subsystem-BOPdQ1OK.js";
import "./model-selection-C7gVo1DU.js";
import "./github-copilot-token-DqKkG5Fl.js";
import "./env-Dd9-xtX7.js";
import "./dock-COgSf8w1.js";
import "./plugins-406Mjpfh.js";
import "./accounts-Dnvd8nR9.js";
import "./bindings-CT_7AcEe.js";
import "./accounts-C1oPU59h.js";
import "./image-ops-7oJSkoGf.js";
import "./pi-model-discovery-Cky34aEI.js";
import "./message-channel-k1bg4144.js";
import "./pi-embedded-helpers-BKvFk0Vx.js";
import "./chrome-CEoidrAW.js";
import "./skills-BY9NT_up.js";
import "./path-alias-guards-DBV4qA5K.js";
import "./redact-BbTfxkPJ.js";
import "./errors-gzROynDW.js";
import "./fs-safe-B6XGwPfR.js";
import "./ssrf-BBmpovkt.js";
import "./store-WBrqaNiQ.js";
import "./sessions-Ch9YM7Y0.js";
import "./accounts-BY7Wu4Ef.js";
import "./paths-DERLovkd.js";
import "./tool-images-Dc5VsT1U.js";
import "./thinking-BoOZzGqx.js";
import "./image-D_IYcX13.js";
import "./gemini-auth-pVwmYYZQ.js";
import "./fetch-guard-Dw5ovJqW.js";
import "./local-roots-DL0tJOu3.js";
import { a as resolveMediaAttachmentLocalRoots, n as createMediaAttachmentCache, o as runCapability, r as normalizeMediaAttachments, t as buildProviderRegistry, u as isAudioAttachment } from "./runner-BH1HcRjk.js";

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