import { a as resolveAgentEffectiveModelPrimary, c as resolveDefaultAgentId, i as resolveAgentDir, s as resolveAgentWorkspaceDir } from "./agent-scope-DOGlT2cV.js";
import "./paths-B9lBY6-m.js";
import { t as createSubsystemLogger } from "./subsystem-mPRezpll.js";
import "./workspace-5k-UUhQ1.js";
import { Fn as DEFAULT_MODEL, In as DEFAULT_PROVIDER, l as parseModelRef } from "./model-selection-CwOrP4rO.js";
import "./github-copilot-token-BgKF-7S1.js";
import "./env-DijpAkAH.js";
import "./boolean-M-esQJt6.js";
import "./dock-DUCzi1P7.js";
import "./tokens-DhiG-E4H.js";
import { t as runEmbeddedPiAgent } from "./pi-embedded-DzwMw9AI.js";
import "./plugins-tZMHqQXn.js";
import "./accounts-CaRtAz_2.js";
import "./bindings-CVne_Hrz.js";
import "./send-BskUYrI3.js";
import "./send-BCfiMncE.js";
import "./deliver-BxUiV_vG.js";
import "./diagnostic-DyMX0VmB.js";
import "./diagnostic-session-state-C0Sxjfox.js";
import "./accounts-8ZWbw0Zq.js";
import "./send-CTFqW4gs.js";
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
import "./reply-prefix-p0bozZ_o.js";
import "./manager-CFDN2xPr.js";
import "./gemini-auth-Dr1Iw07P.js";
import "./fetch-guard-BXwXup_j.js";
import "./query-expansion-C-tgLuSk.js";
import "./retry-jbRR-O4V.js";
import "./target-errors-C2altkcu.js";
import "./local-roots-SwYJVbml.js";
import "./chunk-CUWJkNYS.js";
import "./markdown-tables-jLSCvVYT.js";
import "./ir-DRPkXdbz.js";
import "./render-B1VqYyvo.js";
import "./commands-registry-LudbxuF3.js";
import "./skill-commands-CeG-aWN8.js";
import "./retry-policy-CfyF02Fr.js";
import "./runner-B-7Z-D8H.js";
import "./fetch-seh5wWer.js";
import "./tables-L0adxSs6.js";
import "./send-DE5rVgPQ.js";
import "./outbound-attachment-LB4puxUc.js";
import "./send-CLVMvcCc.js";
import "./resolve-route-CHtY5MFC.js";
import "./proxy-XyLLh-Ux.js";
import "./replies-CgUvKtvR.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

//#region src/hooks/llm-slug-generator.ts
/**
* LLM-based slug generator for session memory filenames
*/
const log = createSubsystemLogger("llm-slug-generator");
/**
* Generate a short 1-2 word filename slug from session content using LLM
*/
async function generateSlugViaLLM(params) {
	let tempSessionFile = null;
	try {
		const agentId = resolveDefaultAgentId(params.cfg);
		const workspaceDir = resolveAgentWorkspaceDir(params.cfg, agentId);
		const agentDir = resolveAgentDir(params.cfg, agentId);
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-slug-"));
		tempSessionFile = path.join(tempDir, "session.jsonl");
		const prompt = `Based on this conversation, generate a short 1-2 word filename slug (lowercase, hyphen-separated, no file extension).

Conversation summary:
${params.sessionContent.slice(0, 2e3)}

Reply with ONLY the slug, nothing else. Examples: "vendor-pitch", "api-design", "bug-fix"`;
		const modelRef = resolveAgentEffectiveModelPrimary(params.cfg, agentId);
		const parsed = modelRef ? parseModelRef(modelRef, DEFAULT_PROVIDER) : null;
		const provider = parsed?.provider ?? DEFAULT_PROVIDER;
		const model = parsed?.model ?? DEFAULT_MODEL;
		const result = await runEmbeddedPiAgent({
			sessionId: `slug-generator-${Date.now()}`,
			sessionKey: "temp:slug-generator",
			agentId,
			sessionFile: tempSessionFile,
			workspaceDir,
			agentDir,
			config: params.cfg,
			prompt,
			provider,
			model,
			timeoutMs: 15e3,
			runId: `slug-gen-${Date.now()}`
		});
		if (result.payloads && result.payloads.length > 0) {
			const text = result.payloads[0]?.text;
			if (text) return text.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || null;
		}
		return null;
	} catch (err) {
		const message = err instanceof Error ? err.stack ?? err.message : String(err);
		log.error(`Failed to generate slug: ${message}`);
		return null;
	} finally {
		if (tempSessionFile) try {
			await fs.rm(path.dirname(tempSessionFile), {
				recursive: true,
				force: true
			});
		} catch {}
	}
}

//#endregion
export { generateSlugViaLLM };