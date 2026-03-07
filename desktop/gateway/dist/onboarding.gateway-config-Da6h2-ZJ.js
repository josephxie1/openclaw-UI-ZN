import "./paths-B4BZAPZh.js";
import "./utils-BKDT474X.js";
import "./agent-scope-D_zGtnox.js";
import "./subsystem-VTlWhMKb.js";
import "./openclaw-root-rn0A27By.js";
import "./exec-vwrJesku.js";
import { Tr as ensureControlUiAllowedOriginsForNonLoopbackBind } from "./model-selection-82PVSbGK.js";
import "./github-copilot-token-nncItI8D.js";
import "./boolean-CE7i9tBR.js";
import "./env-U62qLjIp.js";
import "./host-env-security-CJMD0__Z.js";
import "./env-vars-gp4sxqr7.js";
import "./manifest-registry-2uOrD3Lr.js";
import "./zod-schema.sensitive-CDAit1Bm.js";
import "./dock-WgTQYXEa.js";
import "./message-channel-Kgna1vBs.js";
import { a as findTailscaleBinary } from "./tailscale-B75FY02i.js";
import "./tailnet-_mVv0dKW.js";
import "./ws-DJ7x-04t.js";
import "./sessions-eZVPDvN6.js";
import "./plugins-BOMr5br8.js";
import "./accounts-BI0c9qZz.js";
import "./accounts-DxlJH0sT.js";
import "./logging-w5jq5901.js";
import "./accounts-B5sqOlIj.js";
import "./bindings-2Hl6Kz2z.js";
import "./paths-ENyTm-5-.js";
import "./chat-envelope-C9vncoSN.js";
import "./client-DA6b0BN3.js";
import "./call-CzVIo0bJ.js";
import "./pairing-token-BQRj_ZVG.js";
import { h as randomToken, u as normalizeGatewayTokenInput, y as validateGatewayPasswordInput } from "./onboard-helpers-D2emUd7N.js";
import "./prompt-style-CuSDZZjo.js";
import { a as maybeAddTailnetOriginToControlUiAllowedOrigins, i as TAILSCALE_MISSING_BIN_NOTE_LINES, n as TAILSCALE_DOCS_LINES, r as TAILSCALE_EXPOSURE_OPTIONS, t as validateIPv4AddressInput } from "./ipv4-DvAgUsEY.js";

//#region src/wizard/onboarding.gateway-config.ts
const DEFAULT_DANGEROUS_NODE_DENY_COMMANDS = [
	"camera.snap",
	"camera.clip",
	"screen.record",
	"calendar.add",
	"contacts.add",
	"reminders.add"
];
async function configureGatewayForOnboarding(opts) {
	const { flow, localPort, quickstartGateway, prompter } = opts;
	let { nextConfig } = opts;
	const port = flow === "quickstart" ? quickstartGateway.port : Number.parseInt(String(await prompter.text({
		message: "Gateway port",
		initialValue: String(localPort),
		validate: (value) => Number.isFinite(Number(value)) ? void 0 : "Invalid port"
	})), 10);
	let bind = flow === "quickstart" ? quickstartGateway.bind : await prompter.select({
		message: "Gateway bind",
		options: [
			{
				value: "loopback",
				label: "Loopback (127.0.0.1)"
			},
			{
				value: "lan",
				label: "LAN (0.0.0.0)"
			},
			{
				value: "tailnet",
				label: "Tailnet (Tailscale IP)"
			},
			{
				value: "auto",
				label: "Auto (Loopback → LAN)"
			},
			{
				value: "custom",
				label: "Custom IP"
			}
		]
	});
	let customBindHost = quickstartGateway.customBindHost;
	if (bind === "custom") {
		if (flow !== "quickstart" || !customBindHost) {
			const input = await prompter.text({
				message: "Custom IP address",
				placeholder: "192.168.1.100",
				initialValue: customBindHost ?? "",
				validate: validateIPv4AddressInput
			});
			customBindHost = typeof input === "string" ? input.trim() : void 0;
		}
	}
	let authMode = flow === "quickstart" ? quickstartGateway.authMode : await prompter.select({
		message: "Gateway auth",
		options: [{
			value: "token",
			label: "Token",
			hint: "Recommended default (local + remote)"
		}, {
			value: "password",
			label: "Password"
		}],
		initialValue: "token"
	});
	const tailscaleMode = flow === "quickstart" ? quickstartGateway.tailscaleMode : await prompter.select({
		message: "Tailscale exposure",
		options: [...TAILSCALE_EXPOSURE_OPTIONS]
	});
	let tailscaleBin = null;
	if (tailscaleMode !== "off") {
		tailscaleBin = await findTailscaleBinary();
		if (!tailscaleBin) await prompter.note(TAILSCALE_MISSING_BIN_NOTE_LINES.join("\n"), "Tailscale Warning");
	}
	let tailscaleResetOnExit = flow === "quickstart" ? quickstartGateway.tailscaleResetOnExit : false;
	if (tailscaleMode !== "off" && flow !== "quickstart") {
		await prompter.note(TAILSCALE_DOCS_LINES.join("\n"), "Tailscale");
		tailscaleResetOnExit = Boolean(await prompter.confirm({
			message: "Reset Tailscale serve/funnel on exit?",
			initialValue: false
		}));
	}
	if (tailscaleMode !== "off" && bind !== "loopback") {
		await prompter.note("Tailscale requires bind=loopback. Adjusting bind to loopback.", "Note");
		bind = "loopback";
		customBindHost = void 0;
	}
	if (tailscaleMode === "funnel" && authMode !== "password") {
		await prompter.note("Tailscale funnel requires password auth.", "Note");
		authMode = "password";
	}
	let gatewayToken;
	if (authMode === "token") if (flow === "quickstart") gatewayToken = (quickstartGateway.token ?? normalizeGatewayTokenInput(process.env.OPENCLAW_GATEWAY_TOKEN)) || randomToken();
	else gatewayToken = normalizeGatewayTokenInput(await prompter.text({
		message: "Gateway token (blank to generate)",
		placeholder: "Needed for multi-machine or non-loopback access",
		initialValue: quickstartGateway.token ?? normalizeGatewayTokenInput(process.env.OPENCLAW_GATEWAY_TOKEN) ?? ""
	})) || randomToken();
	if (authMode === "password") {
		const password = flow === "quickstart" && quickstartGateway.password ? quickstartGateway.password : await prompter.text({
			message: "Gateway password",
			validate: validateGatewayPasswordInput
		});
		nextConfig = {
			...nextConfig,
			gateway: {
				...nextConfig.gateway,
				auth: {
					...nextConfig.gateway?.auth,
					mode: "password",
					password: String(password ?? "").trim()
				}
			}
		};
	} else if (authMode === "token") nextConfig = {
		...nextConfig,
		gateway: {
			...nextConfig.gateway,
			auth: {
				...nextConfig.gateway?.auth,
				mode: "token",
				token: gatewayToken
			}
		}
	};
	nextConfig = {
		...nextConfig,
		gateway: {
			...nextConfig.gateway,
			port,
			bind,
			...bind === "custom" && customBindHost ? { customBindHost } : {},
			tailscale: {
				...nextConfig.gateway?.tailscale,
				mode: tailscaleMode,
				resetOnExit: tailscaleResetOnExit
			}
		}
	};
	nextConfig = ensureControlUiAllowedOriginsForNonLoopbackBind(nextConfig, { requireControlUiEnabled: true }).config;
	nextConfig = await maybeAddTailnetOriginToControlUiAllowedOrigins({
		config: nextConfig,
		tailscaleMode,
		tailscaleBin
	});
	if (!quickstartGateway.hasExisting && nextConfig.gateway?.nodes?.denyCommands === void 0 && nextConfig.gateway?.nodes?.allowCommands === void 0 && nextConfig.gateway?.nodes?.browser === void 0) nextConfig = {
		...nextConfig,
		gateway: {
			...nextConfig.gateway,
			nodes: {
				...nextConfig.gateway?.nodes,
				denyCommands: [...DEFAULT_DANGEROUS_NODE_DENY_COMMANDS]
			}
		}
	};
	return {
		nextConfig,
		settings: {
			port,
			bind,
			customBindHost: bind === "custom" ? customBindHost : void 0,
			authMode,
			gatewayToken,
			tailscaleMode,
			tailscaleResetOnExit
		}
	};
}

//#endregion
export { configureGatewayForOnboarding };