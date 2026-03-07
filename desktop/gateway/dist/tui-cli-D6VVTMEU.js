import "./paths-B9jPXz5d.js";
import { p as defaultRuntime } from "./subsystem-D2eqGDrA.js";
import { z as theme } from "./utils-XeuG5BG2.js";
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
import "./client-BBMHVmn5.js";
import "./call-lKsLGW1W.js";
import "./pairing-token-qnEMEIzq.js";
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
import "./commands-CbeEvWLC.js";
import "./commands-registry-A87lt89j.js";
import "./tool-display-TYTccNWv.js";
import { t as parseTimeoutMs } from "./parse-timeout-BS3EWcf6.js";
import { t as formatDocsLink } from "./links-CWyy563z.js";
import { t as runTui } from "./tui-Y7OUURFw.js";

//#region src/cli/tui-cli.ts
function registerTuiCli(program) {
	program.command("tui").description("Open a terminal UI connected to the Gateway").option("--url <url>", "Gateway WebSocket URL (defaults to gateway.remote.url when configured)").option("--token <token>", "Gateway token (if required)").option("--password <password>", "Gateway password (if required)").option("--session <key>", "Session key (default: \"main\", or \"global\" when scope is global)").option("--deliver", "Deliver assistant replies", false).option("--thinking <level>", "Thinking level override").option("--message <text>", "Send an initial message after connecting").option("--timeout-ms <ms>", "Agent timeout in ms (defaults to agents.defaults.timeoutSeconds)").option("--history-limit <n>", "History entries to load", "200").addHelpText("after", () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/tui", "docs.openclaw.ai/cli/tui")}\n`).action(async (opts) => {
		try {
			const timeoutMs = parseTimeoutMs(opts.timeoutMs);
			if (opts.timeoutMs !== void 0 && timeoutMs === void 0) defaultRuntime.error(`warning: invalid --timeout-ms "${String(opts.timeoutMs)}"; ignoring`);
			const historyLimit = Number.parseInt(String(opts.historyLimit ?? "200"), 10);
			await runTui({
				url: opts.url,
				token: opts.token,
				password: opts.password,
				session: opts.session,
				deliver: Boolean(opts.deliver),
				thinking: opts.thinking,
				message: opts.message,
				timeoutMs,
				historyLimit: Number.isNaN(historyLimit) ? void 0 : historyLimit
			});
		} catch (err) {
			defaultRuntime.error(String(err));
			defaultRuntime.exit(1);
		}
	});
}

//#endregion
export { registerTuiCli };