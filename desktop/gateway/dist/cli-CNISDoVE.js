import "./paths-B9jPXz5d.js";
import { t as createSubsystemLogger } from "./subsystem-D2eqGDrA.js";
import "./utils-XeuG5BG2.js";
import "./boolean-DtWR5bt3.js";
import { j as loadConfig } from "./auth-profiles-RMFSmOj7.js";
import { d as resolveDefaultAgentId, u as resolveAgentWorkspaceDir } from "./agent-scope-COhyYBj2.js";
import "./openclaw-root-DCL9Lxet.js";
import "./exec-CSag7MO2.js";
import "./github-copilot-token-CHThtPpe.js";
import "./host-env-security-DWcSD4kP.js";
import "./version-DR9Qjj6f.js";
import "./env-vars-tQ4AIdQq.js";
import "./manifest-registry-CzECnBMm.js";
import "./zod-schema.sensitive-DWhkVThK.js";
import "./dock-_2Xc_sWH.js";
import "./model-Dt0HFL-9.js";
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
import "./send-Dx6e5OVw.js";
import "./send-ClSNAArO.js";
import { _ as loadOpenClawPlugins } from "./subagent-registry-C1wkxMiF.js";
import "./paths-BUjNRwj7.js";
import "./chat-envelope-n7RmUTHV.js";
import "./client-BBMHVmn5.js";
import "./call-lKsLGW1W.js";
import "./pairing-token-qnEMEIzq.js";
import "./net-Duul8c99.js";
import "./tailnet-DEjyMQ9E.js";
import "./tokens-TehTRAdt.js";
import "./with-timeout-DUzEFXCC.js";
import "./deliver-BoJU4g6Z.js";
import "./diagnostic-C6HGeITY.js";
import "./diagnostic-session-state-C8NH3PSI.js";
import "./send-C-9uYJHl.js";
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
import "./exec-approvals-allowlist-xHfNNxi2.js";
import "./exec-safe-bin-runtime-policy-D5SgVqCi.js";
import "./reply-prefix-C2YwnCk5.js";
import "./memory-cli-CTOuAPN-.js";
import "./manager-D3IPvghl.js";
import "./gemini-auth-MTBwjEsL.js";
import "./fetch-guard-8nU7xYtq.js";
import "./query-expansion-CI9833Km.js";
import "./retry-BoP38Evl.js";
import "./target-errors-Dz-Z8qA7.js";
import "./local-roots-ENJED6HX.js";
import "./chunk-CDx-ekK4.js";
import "./markdown-tables-DjaG-l0w.js";
import "./ir-0-vQZqv4.js";
import "./render-e7fENCYH.js";
import "./commands-CbeEvWLC.js";
import "./commands-registry-A87lt89j.js";
import "./image-CvVCyyID.js";
import "./tool-display-TYTccNWv.js";
import "./retry-policy-CtbxW3Xf.js";
import "./runner-oFiVwzHl.js";
import "./model-catalog-BrJHG3wZ.js";
import "./fetch-C-_zRqDA.js";
import "./pairing-store-BaE5Ncon.js";
import "./exec-approvals-BMFhaWeS.js";
import "./nodes-screen-kQdYAeIi.js";
import "./system-run-command-CicKBIPK.js";
import "./session-utils-B8zGDizZ.js";
import "./session-cost-usage-rB-A7vpt.js";
import "./skill-commands-BDtt4uDD.js";
import "./workspace-dirs-BR9SrIvj.js";
import "./tables-CB94nVrr.js";
import "./server-lifecycle-CySgxigJ.js";
import "./stagger-DjNEVTNM.js";
import "./channel-selection-BkBi1FAK.js";
import "./plugin-auto-enable-isteJejq.js";
import "./send-ByikypFu.js";
import "./outbound-attachment-BGXZWCaS.js";
import "./delivery-queue-sFkGs-VC.js";
import "./send-BU9l6o49.js";
import "./resolve-route-BlHg3O1U.js";
import "./pi-tools.policy-Cp6Qx_ot.js";
import "./proxy-DZJY4nKm.js";
import "./links-CWyy563z.js";
import "./cli-utils-B7nApBgk.js";
import "./help-format-DYI1Qsgl.js";
import "./progress-CoLN8zGu.js";
import "./replies-VIjwT8IJ.js";
import "./onboard-helpers-DNqxJl2r.js";
import "./prompt-style-BcyiLcfo.js";
import "./pairing-labels-Bz-kDxCO.js";

//#region src/plugins/cli.ts
const log = createSubsystemLogger("plugins");
function registerPluginCliCommands(program, cfg) {
	const config = cfg ?? loadConfig();
	const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
	const logger = {
		info: (msg) => log.info(msg),
		warn: (msg) => log.warn(msg),
		error: (msg) => log.error(msg),
		debug: (msg) => log.debug(msg)
	};
	const registry = loadOpenClawPlugins({
		config,
		workspaceDir,
		logger
	});
	const existingCommands = new Set(program.commands.map((cmd) => cmd.name()));
	for (const entry of registry.cliRegistrars) {
		if (entry.commands.length > 0) {
			const overlaps = entry.commands.filter((command) => existingCommands.has(command));
			if (overlaps.length > 0) {
				log.debug(`plugin CLI register skipped (${entry.pluginId}): command already registered (${overlaps.join(", ")})`);
				continue;
			}
		}
		try {
			const result = entry.register({
				program,
				config,
				workspaceDir,
				logger
			});
			if (result && typeof result.then === "function") result.catch((err) => {
				log.warn(`plugin CLI register failed (${entry.pluginId}): ${String(err)}`);
			});
			for (const command of entry.commands) existingCommands.add(command);
		} catch (err) {
			log.warn(`plugin CLI register failed (${entry.pluginId}): ${String(err)}`);
		}
	}
}

//#endregion
export { registerPluginCliCommands };