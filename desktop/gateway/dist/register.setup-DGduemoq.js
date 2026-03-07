import "./paths-B9jPXz5d.js";
import { p as defaultRuntime } from "./subsystem-D2eqGDrA.js";
import { x as shortenHomePath, z as theme } from "./utils-XeuG5BG2.js";
import "./boolean-DtWR5bt3.js";
import { A as createConfigIO, L as writeConfigFile } from "./auth-profiles-RMFSmOj7.js";
import { E as ensureAgentWorkspace, _ as DEFAULT_AGENT_WORKSPACE_DIR } from "./agent-scope-COhyYBj2.js";
import "./openclaw-root-DCL9Lxet.js";
import "./exec-CSag7MO2.js";
import "./github-copilot-token-CHThtPpe.js";
import "./host-env-security-DWcSD4kP.js";
import "./version-DR9Qjj6f.js";
import "./env-vars-tQ4AIdQq.js";
import "./manifest-registry-CzECnBMm.js";
import "./zod-schema.sensitive-DWhkVThK.js";
import "./dock-_2Xc_sWH.js";
import "./message-channel-yd0kgwA7.js";
import "./sessions-BAuzX1xb.js";
import "./plugins-J6qmW3qe.js";
import "./accounts-BO8r9fJE.js";
import "./accounts-BhFRzzTA.js";
import "./logging-D-Jq2wIo.js";
import "./accounts-DRk7WX7o.js";
import "./bindings-Dfvr3L3x.js";
import { s as resolveSessionTranscriptsDir } from "./paths-BUjNRwj7.js";
import "./chat-envelope-n7RmUTHV.js";
import "./client-BBMHVmn5.js";
import "./call-lKsLGW1W.js";
import "./pairing-token-qnEMEIzq.js";
import "./net-Duul8c99.js";
import "./tailnet-DEjyMQ9E.js";
import "./redact-BGmCI-cn.js";
import "./errors-BFjy26zi.js";
import { t as formatDocsLink } from "./links-CWyy563z.js";
import { n as runCommandWithRuntime } from "./cli-utils-B7nApBgk.js";
import "./progress-CoLN8zGu.js";
import "./onboard-helpers-DNqxJl2r.js";
import "./prompt-style-BcyiLcfo.js";
import { t as hasExplicitOptions } from "./command-options-D_KEIae-.js";
import "./note-Bpomg9Vl.js";
import "./clack-prompter-3l9KoDtA.js";
import "./runtime-guard-JlKhn9Xx.js";
import "./onboarding-CIgyNjGZ.js";
import { n as logConfigUpdated, t as formatConfigPath } from "./logging-DV03yykq.js";
import { t as onboardCommand } from "./onboard-tnWUxNEg.js";
import JSON5 from "json5";
import fsPromises from "node:fs/promises";

//#region src/commands/setup.ts
async function readConfigFileRaw(configPath) {
	try {
		const raw = await fsPromises.readFile(configPath, "utf-8");
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
	await fsPromises.mkdir(sessionsDir, { recursive: true });
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