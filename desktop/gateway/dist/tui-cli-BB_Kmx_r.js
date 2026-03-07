import "./paths-B4BZAPZh.js";
import { B as theme } from "./utils-BKDT474X.js";
import "./thinking-BB3zi8pq.js";
import "./agent-scope-D_zGtnox.js";
import { p as defaultRuntime } from "./subsystem-VTlWhMKb.js";
import "./openclaw-root-rn0A27By.js";
import "./exec-vwrJesku.js";
import "./model-selection-82PVSbGK.js";
import "./github-copilot-token-nncItI8D.js";
import "./boolean-CE7i9tBR.js";
import "./env-U62qLjIp.js";
import "./host-env-security-CJMD0__Z.js";
import "./env-vars-gp4sxqr7.js";
import "./manifest-registry-2uOrD3Lr.js";
import "./zod-schema.sensitive-CDAit1Bm.js";
import "./dock-WgTQYXEa.js";
import "./message-channel-Kgna1vBs.js";
import "./pi-embedded-helpers-Sl6s9PvE.js";
import "./sandbox-BPirxlgj.js";
import "./tool-catalog-IBWCA-2a.js";
import "./chrome-CLxBG4X0.js";
import "./tailscale-B75FY02i.js";
import "./tailnet-_mVv0dKW.js";
import "./ws-DJ7x-04t.js";
import "./auth-B5QWqm-f.js";
import "./server-context-B7q1THBo.js";
import "./frontmatter-BmSW8Z0-.js";
import "./skills-DCB7NmWY.js";
import "./path-alias-guards-BtU22bLe.js";
import "./paths-DvqGb6xa.js";
import "./redact-CHv3ivPV.js";
import "./errors-Djy9l-lu.js";
import "./fs-safe-CYw4dFPj.js";
import "./ssrf-BXDXzZL_.js";
import "./image-ops-BBXywopb.js";
import "./store-w7wgV-e1.js";
import "./ports-csNzxb2D.js";
import "./trash-BBJmn2wY.js";
import "./server-middleware-BZlz_kXM.js";
import "./sessions-eZVPDvN6.js";
import "./plugins-BOMr5br8.js";
import "./accounts-BI0c9qZz.js";
import "./accounts-DxlJH0sT.js";
import "./logging-w5jq5901.js";
import "./accounts-B5sqOlIj.js";
import "./bindings-2Hl6Kz2z.js";
import "./paths-ENyTm-5-.js";
import "./chat-envelope-C9vncoSN.js";
import "./tool-images-Bm-L66dQ.js";
import "./tool-display-BQ86Un7Q.js";
import "./commands-CSjiq1ty.js";
import "./commands-registry-lue_bzYz.js";
import "./client-DA6b0BN3.js";
import "./call-CzVIo0bJ.js";
import "./pairing-token-BQRj_ZVG.js";
import { t as formatDocsLink } from "./links-j4QBCma0.js";
import { t as parseTimeoutMs } from "./parse-timeout-CIqovswJ.js";
import { t as runTui } from "./tui-vn0Sx5ft.js";

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