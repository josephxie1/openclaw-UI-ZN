import { t as __exportAll } from "./rolldown-runtime-Cbj13DAv.js";
import { t as CONFIG_PATH } from "./paths-B9jPXz5d.js";
import { a as displayPath } from "./utils-XeuG5BG2.js";

//#region src/config/logging.ts
var logging_exports = /* @__PURE__ */ __exportAll({
	formatConfigPath: () => formatConfigPath,
	logConfigUpdated: () => logConfigUpdated
});
function formatConfigPath(path = CONFIG_PATH) {
	return displayPath(path);
}
function logConfigUpdated(runtime, opts = {}) {
	const path = formatConfigPath(opts.path ?? CONFIG_PATH);
	const suffix = opts.suffix ? ` ${opts.suffix}` : "";
	runtime.log(`Updated ${path}${suffix}`);
}

//#endregion
export { logConfigUpdated as n, logging_exports as r, formatConfigPath as t };