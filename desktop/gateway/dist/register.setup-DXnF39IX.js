import "./paths-B4BZAPZh.js";
import { B as theme, S as shortenHomePath } from "./utils-BKDT474X.js";
import { E as ensureAgentWorkspace, _ as DEFAULT_AGENT_WORKSPACE_DIR } from "./agent-scope-D_zGtnox.js";
import { p as defaultRuntime } from "./subsystem-VTlWhMKb.js";
import "./openclaw-root-rn0A27By.js";
import "./exec-vwrJesku.js";
import { Bt as createConfigIO, qt as writeConfigFile } from "./model-selection-82PVSbGK.js";
import "./github-copilot-token-nncItI8D.js";
import "./boolean-CE7i9tBR.js";
import "./env-U62qLjIp.js";
import "./host-env-security-CJMD0__Z.js";
import "./env-vars-gp4sxqr7.js";
import "./manifest-registry-2uOrD3Lr.js";
import "./zod-schema.sensitive-CDAit1Bm.js";
import "./dock-WgTQYXEa.js";
import "./message-channel-Kgna1vBs.js";
import "./tailnet-_mVv0dKW.js";
import "./ws-DJ7x-04t.js";
import "./redact-CHv3ivPV.js";
import "./errors-Djy9l-lu.js";
import "./sessions-eZVPDvN6.js";
import "./plugins-BOMr5br8.js";
import "./accounts-BI0c9qZz.js";
import "./accounts-DxlJH0sT.js";
import "./logging-w5jq5901.js";
import "./accounts-B5sqOlIj.js";
import "./bindings-2Hl6Kz2z.js";
import { s as resolveSessionTranscriptsDir } from "./paths-ENyTm-5-.js";
import "./chat-envelope-C9vncoSN.js";
import "./client-DA6b0BN3.js";
import "./call-CzVIo0bJ.js";
import "./pairing-token-BQRj_ZVG.js";
import { t as formatDocsLink } from "./links-j4QBCma0.js";
import { n as runCommandWithRuntime } from "./cli-utils-BbBvzQDf.js";
import "./progress-BQ1mGU5R.js";
import "./onboard-helpers-D2emUd7N.js";
import "./prompt-style-CuSDZZjo.js";
import "./runtime-guard-C8LLa37E.js";
import { t as hasExplicitOptions } from "./command-options-DGYxc3D_.js";
import "./note-DuHBH3YO.js";
import "./clack-prompter-CloFkR0o.js";
import "./onboarding-ZE9QFQu0.js";
import { n as logConfigUpdated, t as formatConfigPath } from "./logging-cirizFZh.js";
import { t as onboardCommand } from "./onboard-C2Szk5gu.js";
import JSON5 from "json5";
import fs from "node:fs/promises";

//#region src/commands/setup.ts
async function readConfigFileRaw(configPath) {
	try {
		const raw = await fs.readFile(configPath, "utf-8");
		const parsed = JSON5.parse(raw);
		if (parsed && typeof parsed === "object") return {
			exists: true,
			parsed
		};
		return {
			exists: true,
			parsed: {}
		};
	} catch {
		return {
			exists: false,
			parsed: {}
		};
	}
}
async function setupCommand(opts, runtime = defaultRuntime) {
	const desiredWorkspace = typeof opts?.workspace === "string" && opts.workspace.trim() ? opts.workspace.trim() : void 0;
	const configPath = createConfigIO().configPath;
	const existingRaw = await readConfigFileRaw(configPath);
	const cfg = existingRaw.parsed;
	const defaults = cfg.agents?.defaults ?? {};
	const workspace = desiredWorkspace ?? defaults.workspace ?? DEFAULT_AGENT_WORKSPACE_DIR;
	const next = {
		...cfg,
		agents: {
			...cfg.agents,
			defaults: {
				...defaults,
				workspace
			}
		}
	};
	if (!existingRaw.exists || defaults.workspace !== workspace) {
		await writeConfigFile(next);
		if (!existingRaw.exists) runtime.log(`Wrote ${formatConfigPath(configPath)}`);
		else logConfigUpdated(runtime, {
			path: configPath,
			suffix: "(set agents.defaults.workspace)"
		});
	} else runtime.log(`Config OK: ${formatConfigPath(configPath)}`);
	const ws = await ensureAgentWorkspace({
		dir: workspace,
		ensureBootstrapFiles: !next.agents?.defaults?.skipBootstrap
	});
	runtime.log(`Workspace OK: ${shortenHomePath(ws.dir)}`);
	const sessionsDir = resolveSessionTranscriptsDir();
	await fs.mkdir(sessionsDir, { recursive: true });
	runtime.log(`Sessions OK: ${shortenHomePath(sessionsDir)}`);
}

//#endregion
//#region src/cli/program/register.setup.ts
function registerSetupCommand(program) {
	program.command("setup").description("Initialize ~/.openclaw/openclaw.json and the agent workspace").addHelpText("after", () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/setup", "docs.openclaw.ai/cli/setup")}\n`).option("--workspace <dir>", "Agent workspace directory (default: ~/.openclaw/workspace; stored as agents.defaults.workspace)").option("--wizard", "Run the interactive onboarding wizard", false).option("--non-interactive", "Run the wizard without prompts", false).option("--mode <mode>", "Wizard mode: local|remote").option("--remote-url <url>", "Remote Gateway WebSocket URL").option("--remote-token <token>", "Remote Gateway token (optional)").action(async (opts, command) => {
		await runCommandWithRuntime(defaultRuntime, async () => {
			const hasWizardFlags = hasExplicitOptions(command, [
				"wizard",
				"nonInteractive",
				"mode",
				"remoteUrl",
				"remoteToken"
			]);
			if (opts.wizard || hasWizardFlags) {
				await onboardCommand({
					workspace: opts.workspace,
					nonInteractive: Boolean(opts.nonInteractive),
					mode: opts.mode,
					remoteUrl: opts.remoteUrl,
					remoteToken: opts.remoteToken
				}, defaultRuntime);
				return;
			}
			await setupCommand({ workspace: opts.workspace }, defaultRuntime);
		});
	});
}

//#endregion
export { registerSetupCommand };