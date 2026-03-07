import "./paths-B9jPXz5d.js";
import "./subsystem-D2eqGDrA.js";
import { P as shouldLogVerbose, j as logVerbose } from "./utils-XeuG5BG2.js";
import "./boolean-DtWR5bt3.js";
import "./auth-profiles-RMFSmOj7.js";
import "./agent-scope-COhyYBj2.js";
import "./openclaw-root-DCL9Lxet.js";
import "./exec-CSag7MO2.js";
import "./github-copilot-token-CHThtPpe.js";
import "./host-env-security-DWcSD4kP.js";
import "./version-DR9Qjj6f.js";
import "./env-vars-tQ4AIdQq.js";
import "./manifest-registry-CzECnBMm.js";
import "./zod-schema.sensitive-DWhkVThK.js";
import "./dock-_2Xc_sWH.js";
import "./pi-model-discovery-CQjcLgj_.js";
import "./frontmatter-CyFnddo-.js";
import "./skills-CWPHLMBH.js";
import "./path-alias-guards-DrwR0-rx.js";
import "./message-channel-yd0kgwA7.js";
import "./sessions-BAuzX1xb.js";
import "./plugins-J6qmW3qe.js";
import "./accounts-BO8r9fJE.js";
import "./accounts-BhFRzzTA.js";
import "./logging-D-Jq2wIo.js";
import "./accounts-DRk7WX7o.js";
import "./bindings-Dfvr3L3x.js";
import "./paths-BUjNRwj7.js";
import "./chat-envelope-n7RmUTHV.js";
import "./net-Duul8c99.js";
import "./tailnet-DEjyMQ9E.js";
import "./image-ops-BFVQq2P9.js";
import "./pi-embedded-helpers-YBP7teTK.js";
import "./sandbox-BM07unsK.js";
import "./tool-catalog-DfXt8uIy.js";
import "./chrome-C-D969Uy.js";
import "./tailscale-BVHEqtVC.js";
import "./auth-nkfk5JNc.js";
import "./server-context-ClHlUo0H.js";
import "./paths-C9r2V5Z5.js";
import "./redact-BGmCI-cn.js";
import "./errors-BFjy26zi.js";
import "./fs-safe-BneEG0zv.js";
import "./ssrf-9RrpSxUl.js";
import "./store-BPRXklPJ.js";
import "./ports-CSXkmkNM.js";
import "./trash-Cv3xOBdi.js";
import "./server-middleware-C7BWmtT3.js";
import "./tool-images-DrD0u23L.js";
import "./thinking-DuXsFbTV.js";
import "./models-config-V10T0QET.js";
import "./gemini-auth-MTBwjEsL.js";
import "./fetch-guard-8nU7xYtq.js";
import "./local-roots-ENJED6HX.js";
import "./image-CvVCyyID.js";
import "./tool-display-TYTccNWv.js";
import { a as resolveMediaAttachmentLocalRoots, n as createMediaAttachmentCache, o as runCapability, r as normalizeMediaAttachments, s as isAudioAttachment, t as buildProviderRegistry } from "./runner-oFiVwzHl.js";
import "./model-catalog-BrJHG3wZ.js";

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