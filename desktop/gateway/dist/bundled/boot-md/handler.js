import { n as listAgentIds, s as resolveAgentWorkspaceDir } from "../../agent-scope-DOGlT2cV.js";
import "../../paths-B9lBY6-m.js";
import { pt as isGatewayStartupEvent, r as defaultRuntime, t as createSubsystemLogger } from "../../subsystem-mPRezpll.js";
import { l as resolveAgentIdFromSessionKey } from "../../session-key-CPPWn8gW.js";
import "../../workspace-5k-UUhQ1.js";
import "../../model-selection-CwOrP4rO.js";
import "../../github-copilot-token-BgKF-7S1.js";
import "../../env-DijpAkAH.js";
import "../../boolean-M-esQJt6.js";
import "../../dock-DUCzi1P7.js";
import { n as SILENT_REPLY_TOKEN } from "../../tokens-DhiG-E4H.js";
import { a as createDefaultDeps, i as agentCommand } from "../../pi-embedded-DzwMw9AI.js";
import "../../plugins-tZMHqQXn.js";
import "../../accounts-CaRtAz_2.js";
import "../../bindings-CVne_Hrz.js";
import "../../send-BskUYrI3.js";
import "../../send-BCfiMncE.js";
import "../../deliver-BxUiV_vG.js";
import "../../diagnostic-DyMX0VmB.js";
import "../../diagnostic-session-state-C0Sxjfox.js";
import "../../accounts-8ZWbw0Zq.js";
import "../../send-CTFqW4gs.js";
import "../../image-ops-BTLRgXTA.js";
import "../../pi-model-discovery-CbFUCNZ5.js";
import "../../message-channel-DKXv9Xa_.js";
import "../../pi-embedded-helpers-CARAh64z.js";
import "../../chrome-Dq0GBg4b.js";
import "../../frontmatter-eHCuq81z.js";
import "../../skills-ZeFEhkWa.js";
import "../../path-alias-guards-BrkOkEP6.js";
import "../../redact-B5RjPWCN.js";
import "../../errors-BB1m5Yna.js";
import "../../fs-safe-SlzoHURm.js";
import "../../ssrf-l8l1dk4l.js";
import "../../store-C_9XVp6p.js";
import { H as resolveAgentMainSessionKey, W as resolveMainSessionKey, d as updateSessionStore, s as loadSessionStore } from "../../sessions-Cq6vzHzY.js";
import "../../accounts-BKkVzHhg.js";
import { l as resolveStorePath } from "../../paths-C8TW5zqh.js";
import "../../tool-images-BvOekDK7.js";
import "../../thinking-DEPKewmZ.js";
import "../../image-DfDK_FPR.js";
import "../../reply-prefix-p0bozZ_o.js";
import "../../manager-CFDN2xPr.js";
import "../../gemini-auth-Dr1Iw07P.js";
import "../../fetch-guard-BXwXup_j.js";
import "../../query-expansion-C-tgLuSk.js";
import "../../retry-jbRR-O4V.js";
import "../../target-errors-C2altkcu.js";
import "../../local-roots-SwYJVbml.js";
import "../../chunk-CUWJkNYS.js";
import "../../markdown-tables-jLSCvVYT.js";
import "../../ir-DRPkXdbz.js";
import "../../render-B1VqYyvo.js";
import "../../commands-registry-LudbxuF3.js";
import "../../skill-commands-CeG-aWN8.js";
import "../../retry-policy-CfyF02Fr.js";
import "../../runner-B-7Z-D8H.js";
import "../../fetch-seh5wWer.js";
import "../../tables-L0adxSs6.js";
import "../../send-DE5rVgPQ.js";
import "../../outbound-attachment-LB4puxUc.js";
import "../../send-CLVMvcCc.js";
import "../../resolve-route-CHtY5MFC.js";
import "../../proxy-XyLLh-Ux.js";
import "../../replies-CgUvKtvR.js";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

//#region src/gateway/boot.ts
function generateBootSessionId() {
	return `boot-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "")}-${crypto.randomUUID().slice(0, 8)}`;
}
const log$1 = createSubsystemLogger("gateway/boot");
const BOOT_FILENAME = "BOOT.md";
function buildBootPrompt(content) {
	return [
		"You are running a boot check. Follow BOOT.md instructions exactly.",
		"",
		"BOOT.md:",
		content,
		"",
		"If BOOT.md asks you to send a message, use the message tool (action=send with channel + target).",
		"Use the `target` field (not `to`) for message tool destinations.",
		`After sending with the message tool, reply with ONLY: ${SILENT_REPLY_TOKEN}.`,
		`If nothing needs attention, reply with ONLY: ${SILENT_REPLY_TOKEN}.`
	].join("\n");
}
async function loadBootFile(workspaceDir) {
	const bootPath = path.join(workspaceDir, BOOT_FILENAME);
	try {
		const trimmed = (await fs.readFile(bootPath, "utf-8")).trim();
		if (!trimmed) return { status: "empty" };
		return {
			status: "ok",
			content: trimmed
		};
	} catch (err) {
		if (err.code === "ENOENT") return { status: "missing" };
		throw err;
	}
}
function snapshotMainSessionMapping(params) {
	const agentId = resolveAgentIdFromSessionKey(params.sessionKey);
	const storePath = resolveStorePath(params.cfg.session?.store, { agentId });
	try {
		const entry = loadSessionStore(storePath, { skipCache: true })[params.sessionKey];
		if (!entry) return {
			storePath,
			sessionKey: params.sessionKey,
			canRestore: true,
			hadEntry: false
		};
		return {
			storePath,
			sessionKey: params.sessionKey,
			canRestore: true,
			hadEntry: true,
			entry: structuredClone(entry)
		};
	} catch (err) {
		log$1.debug("boot: could not snapshot main session mapping", {
			sessionKey: params.sessionKey,
			error: String(err)
		});
		return {
			storePath,
			sessionKey: params.sessionKey,
			canRestore: false,
			hadEntry: false
		};
	}
}
async function restoreMainSessionMapping(snapshot) {
	if (!snapshot.canRestore) return;
	try {
		await updateSessionStore(snapshot.storePath, (store) => {
			if (snapshot.hadEntry && snapshot.entry) {
				store[snapshot.sessionKey] = snapshot.entry;
				return;
			}
			delete store[snapshot.sessionKey];
		}, { activeSessionKey: snapshot.sessionKey });
		return;
	} catch (err) {
		return err instanceof Error ? err.message : String(err);
	}
}
async function runBootOnce(params) {
	const bootRuntime = {
		log: () => {},
		error: (message) => log$1.error(String(message)),
		exit: defaultRuntime.exit
	};
	let result;
	try {
		result = await loadBootFile(params.workspaceDir);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log$1.error(`boot: failed to read ${BOOT_FILENAME}: ${message}`);
		return {
			status: "failed",
			reason: message
		};
	}
	if (result.status === "missing" || result.status === "empty") return {
		status: "skipped",
		reason: result.status
	};
	const sessionKey = params.agentId ? resolveAgentMainSessionKey({
		cfg: params.cfg,
		agentId: params.agentId
	}) : resolveMainSessionKey(params.cfg);
	const message = buildBootPrompt(result.content ?? "");
	const sessionId = generateBootSessionId();
	const mappingSnapshot = snapshotMainSessionMapping({
		cfg: params.cfg,
		sessionKey
	});
	let agentFailure;
	try {
		await agentCommand({
			message,
			sessionKey,
			sessionId,
			deliver: false,
			senderIsOwner: true
		}, bootRuntime, params.deps);
	} catch (err) {
		agentFailure = err instanceof Error ? err.message : String(err);
		log$1.error(`boot: agent run failed: ${agentFailure}`);
	}
	const mappingRestoreFailure = await restoreMainSessionMapping(mappingSnapshot);
	if (mappingRestoreFailure) log$1.error(`boot: failed to restore main session mapping: ${mappingRestoreFailure}`);
	if (!agentFailure && !mappingRestoreFailure) return { status: "ran" };
	return {
		status: "failed",
		reason: [agentFailure ? `agent run failed: ${agentFailure}` : void 0, mappingRestoreFailure ? `mapping restore failed: ${mappingRestoreFailure}` : void 0].filter((part) => Boolean(part)).join("; ")
	};
}

//#endregion
//#region src/hooks/bundled/boot-md/handler.ts
const log = createSubsystemLogger("hooks/boot-md");
const runBootChecklist = async (event) => {
	if (!isGatewayStartupEvent(event)) return;
	if (!event.context.cfg) return;
	const cfg = event.context.cfg;
	const deps = event.context.deps ?? createDefaultDeps();
	const agentIds = listAgentIds(cfg);
	for (const agentId of agentIds) {
		const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
		const result = await runBootOnce({
			cfg,
			deps,
			workspaceDir,
			agentId
		});
		if (result.status === "failed") {
			log.warn("boot-md failed for agent startup run", {
				agentId,
				workspaceDir,
				reason: result.reason
			});
			continue;
		}
		if (result.status === "skipped") log.debug("boot-md skipped for agent startup run", {
			agentId,
			workspaceDir,
			reason: result.reason
		});
	}
};

//#endregion
export { runBootChecklist as default };