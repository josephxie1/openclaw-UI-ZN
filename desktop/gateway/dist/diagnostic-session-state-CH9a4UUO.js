import { n as getDiagnosticSessionState, r as pruneDiagnosticSessionStates, t as diagnosticSessionStates } from "./diagnostic-session-state-CTcjyzEd.js";

//#region src/browser/pw-ai-state.ts
let pwAiLoaded = false;
function markPwAiLoaded() {
	pwAiLoaded = true;
}
function isPwAiLoaded() {
	return pwAiLoaded;
}

//#endregion
export { getDiagnosticSessionState, markPwAiLoaded as n, isPwAiLoaded as t };