import "./paths-B4BZAPZh.js";
import { B as theme } from "./utils-BKDT474X.js";
import "./agent-scope-D_zGtnox.js";
import "./subsystem-VTlWhMKb.js";
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
import { t as formatDocsLink } from "./links-j4QBCma0.js";
import { n as registerQrCli } from "./qr-cli-BnpSebnQ.js";

//#region src/cli/clawbot-cli.ts
function registerClawbotCli(program) {
	registerQrCli(program.command("clawbot").description("Legacy clawbot command aliases").addHelpText("after", () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/clawbot", "docs.openclaw.ai/cli/clawbot")}\n`));
}

//#endregion
export { registerClawbotCli };