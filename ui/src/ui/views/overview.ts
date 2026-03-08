import { html, nothing } from "lit";
import { ConnectErrorDetailCodes } from "../../../../src/gateway/protocol/connect-error-details.js";
import { t, i18n, SUPPORTED_LOCALES, type Locale } from "../../i18n/index.ts";
import { buildExternalLinkRel, EXTERNAL_LINK_TARGET } from "../external-link.ts";
import { formatRelativeTimestamp, formatDurationHuman } from "../format.ts";
import type { GatewayHelloOk } from "../gateway.ts";
import { formatNextRun } from "../presenter.ts";
import type { UiSettings } from "../storage.ts";
import type { SessionActivityResult } from "../types.ts";
import { shouldShowPairingHint } from "./overview-hints.ts";

export type OverviewProps = {
  connected: boolean;
  hello: GatewayHelloOk | null;
  settings: UiSettings;
  password: string;
  lastError: string | null;
  lastErrorCode: string | null;
  presenceCount: number;
  sessionsCount: number | null;
  cronEnabled: boolean | null;
  cronNext: number | null;
  lastChannelsRefresh: number | null;
  onSettingsChange: (next: UiSettings) => void;
  onPasswordChange: (next: string) => void;
  onSessionKeyChange: (next: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
  sessionActivity: SessionActivityResult | null;
};

export function renderOverview(props: OverviewProps) {
  const snapshot = props.hello?.snapshot as
    | {
        uptimeMs?: number;
        policy?: { tickIntervalMs?: number };
        authMode?: "none" | "token" | "password" | "trusted-proxy";
      }
    | undefined;
  const uptime = snapshot?.uptimeMs ? formatDurationHuman(snapshot.uptimeMs) : t("common.na");
  const _tick = snapshot?.policy?.tickIntervalMs
    ? `${snapshot.policy.tickIntervalMs}ms`
    : t("common.na");
  const authMode = snapshot?.authMode;
  const isTrustedProxy = authMode === "trusted-proxy";

  const pairingHint = (() => {
    if (!shouldShowPairingHint(props.connected, props.lastError, props.lastErrorCode)) {
      return null;
    }
    return html`
      <div class="muted" style="margin-top: 8px">
        ${t("overview.pairing.hint")}
        <div style="margin-top: 6px">
          <span class="mono">openclaw devices list</span><br />
          <span class="mono">openclaw devices approve &lt;requestId&gt;</span>
        </div>
        <div style="margin-top: 6px; font-size: 12px;">
          ${t("overview.pairing.mobileHint")}
        </div>
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.openclaw.ai/web/control-ui#device-pairing-first-connection"
            target=${EXTERNAL_LINK_TARGET}
            rel=${buildExternalLinkRel()}
            title="Device pairing docs (opens in new tab)"
            >Docs: Device pairing</a
          >
        </div>
      </div>
    `;
  })();

  const authHint = (() => {
    if (props.connected || !props.lastError) {
      return null;
    }
    const lower = props.lastError.toLowerCase();
    const authRequiredCodes = new Set<string>([
      ConnectErrorDetailCodes.AUTH_REQUIRED,
      ConnectErrorDetailCodes.AUTH_TOKEN_MISSING,
      ConnectErrorDetailCodes.AUTH_PASSWORD_MISSING,
      ConnectErrorDetailCodes.AUTH_TOKEN_NOT_CONFIGURED,
      ConnectErrorDetailCodes.AUTH_PASSWORD_NOT_CONFIGURED,
    ]);
    const authFailureCodes = new Set<string>([
      ...authRequiredCodes,
      ConnectErrorDetailCodes.AUTH_UNAUTHORIZED,
      ConnectErrorDetailCodes.AUTH_TOKEN_MISMATCH,
      ConnectErrorDetailCodes.AUTH_PASSWORD_MISMATCH,
      ConnectErrorDetailCodes.AUTH_DEVICE_TOKEN_MISMATCH,
      ConnectErrorDetailCodes.AUTH_RATE_LIMITED,
      ConnectErrorDetailCodes.AUTH_TAILSCALE_IDENTITY_MISSING,
      ConnectErrorDetailCodes.AUTH_TAILSCALE_PROXY_MISSING,
      ConnectErrorDetailCodes.AUTH_TAILSCALE_WHOIS_FAILED,
      ConnectErrorDetailCodes.AUTH_TAILSCALE_IDENTITY_MISMATCH,
    ]);
    const authFailed = props.lastErrorCode
      ? authFailureCodes.has(props.lastErrorCode)
      : lower.includes("unauthorized") || lower.includes("connect failed");
    if (!authFailed) {
      return null;
    }
    const hasToken = Boolean(props.settings.token.trim());
    const hasPassword = Boolean(props.password.trim());
    const isAuthRequired = props.lastErrorCode
      ? authRequiredCodes.has(props.lastErrorCode)
      : !hasToken && !hasPassword;
    if (isAuthRequired) {
      return html`
        <div class="muted" style="margin-top: 8px">
          ${t("overview.auth.required")}
          <div style="margin-top: 6px">
            <span class="mono">openclaw dashboard --no-open</span> → tokenized URL<br />
            <span class="mono">openclaw doctor --generate-gateway-token</span> → set token
          </div>
          <div style="margin-top: 6px">
            <a
              class="session-link"
              href="https://docs.openclaw.ai/web/dashboard"
              target=${EXTERNAL_LINK_TARGET}
              rel=${buildExternalLinkRel()}
              title="Control UI auth docs (opens in new tab)"
              >Docs: Control UI auth</a
            >
          </div>
        </div>
      `;
    }
    return html`
      <div class="muted" style="margin-top: 8px">
        ${t("overview.auth.failed", { command: "openclaw dashboard --no-open" })}
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.openclaw.ai/web/dashboard"
            target=${EXTERNAL_LINK_TARGET}
            rel=${buildExternalLinkRel()}
            title="Control UI auth docs (opens in new tab)"
            >Docs: Control UI auth</a
          >
        </div>
      </div>
    `;
  })();

  const insecureContextHint = (() => {
    if (props.connected || !props.lastError) {
      return null;
    }
    const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : true;
    if (isSecureContext) {
      return null;
    }
    const lower = props.lastError.toLowerCase();
    const insecureContextCode =
      props.lastErrorCode === ConnectErrorDetailCodes.CONTROL_UI_DEVICE_IDENTITY_REQUIRED ||
      props.lastErrorCode === ConnectErrorDetailCodes.DEVICE_IDENTITY_REQUIRED;
    if (
      !insecureContextCode &&
      !lower.includes("secure context") &&
      !lower.includes("device identity required")
    ) {
      return null;
    }
    return html`
      <div class="muted" style="margin-top: 8px">
        ${t("overview.insecure.hint", { url: "http://127.0.0.1:18789" })}
        <div style="margin-top: 6px">
          ${t("overview.insecure.stayHttp", { config: "gateway.controlUi.allowInsecureAuth: true" })}
        </div>
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.openclaw.ai/gateway/tailscale"
            target=${EXTERNAL_LINK_TARGET}
            rel=${buildExternalLinkRel()}
            title="Tailscale Serve docs (opens in new tab)"
            >Docs: Tailscale Serve</a
          >
          <span class="muted"> · </span>
          <a
            class="session-link"
            href="https://docs.openclaw.ai/web/control-ui#insecure-http"
            target=${EXTERNAL_LINK_TARGET}
            rel=${buildExternalLinkRel()}
            title="Insecure HTTP docs (opens in new tab)"
            >Docs: Insecure HTTP</a
          >
        </div>
      </div>
    `;
  })();

  const currentLocale = i18n.getLocale();

  // --- Donut chart helper ---
  const renderDonutChart = (percent: number, label: string, valueText: string) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - Math.min(percent, 100) / 100);
    const strokeColor = percent > 80 ? "#fca5a5" : percent > 50 ? "#fbbf24" : "#86efac";
    return html`
      <div class="donut-chart">
        <svg viewBox="0 0 100 100" width="90" height="90">
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="8"/>
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="${strokeColor}" stroke-width="8"
            stroke-linecap="round"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dashOffset}"
            transform="rotate(-90 50 50)"
            style="transition: stroke-dashoffset 0.6s ease;"/>
          <text x="50" y="48" text-anchor="middle" fill="#fff" font-size="16" font-weight="700">${valueText}</text>
          <text x="50" y="64" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="10">${label}</text>
        </svg>
      </div>
    `;
  };

  // --- CPU & Memory estimates ---
  const perf = globalThis.performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  };
  const memPercent = perf?.memory
    ? Math.round((perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100)
    : 0;
  // Estimate CPU from active sessions count (rough heuristic)
  const activeSessions =
    (props.sessionActivity?.processing ?? 0) + (props.sessionActivity?.waiting ?? 0);
  const cpuPercent = Math.min(activeSessions * 15 + (props.connected ? 5 : 0), 100);

  const handleSvg = html`
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="19" r="1" />
    </svg>
  `;
  /** Cards with inputs — drag only via handle */
  const dragHandleOnly = html`<button class="swapy-handle" data-swapy-handle title="${t("overview.drag.hint") ?? "拖拽交换位置"}">${handleSvg}</button>`;
  /** Display-only cards — entire card is draggable, icon is decorative */
  const dragHandleFree = html`<button class="swapy-handle" title="${t("overview.drag.hint") ?? "拖拽交换位置"}">${handleSvg}</button>`;

  return html`
    <oc-overview-layout>
      <div class="overview-swapy">
        <div data-swapy-slot="access">
          <div data-swapy-item="access">
            <div class="card ov-card--access">
              <div class="card-header-row">${dragHandleOnly}
                <div><div class="card-title">${t("overview.access.title")}</div>
                <div class="card-sub">${t("overview.access.subtitle")}</div></div>
              </div>
              <div class="form-grid" style="margin-top: 16px;">
                <label class="field">
                  <span>${t("overview.access.wsUrl")}</span>
                  <input
                    .value=${props.settings.gatewayUrl}
                    @input=${(e: Event) => {
                      const v = (e.target as HTMLInputElement).value;
                      props.onSettingsChange({ ...props.settings, gatewayUrl: v });
                    }}
                    placeholder="ws://100.x.y.z:18789"
                  />
                </label>
                ${
                  isTrustedProxy
                    ? ""
                    : html`
                      <label class="field">
                        <span>${t("overview.access.token")}</span>
                        <input
                          .value=${props.settings.token}
                          @input=${(e: Event) => {
                            const v = (e.target as HTMLInputElement).value;
                            props.onSettingsChange({ ...props.settings, token: v });
                          }}
                          placeholder="OPENCLAW_GATEWAY_TOKEN"
                        />
                      </label>
                      <label class="field">
                        <span>${t("overview.access.password")}</span>
                        <input
                          type="password"
                          .value=${props.password}
                          @input=${(e: Event) => {
                            const v = (e.target as HTMLInputElement).value;
                            props.onPasswordChange(v);
                          }}
                          placeholder="system or shared password"
                        />
                      </label>
                    `
                }
                <label class="field">
                  <span>${t("overview.access.sessionKey")}</span>
                  <input
                    .value=${props.settings.sessionKey}
                    @input=${(e: Event) => {
                      const v = (e.target as HTMLInputElement).value;
                      props.onSessionKeyChange(v);
                    }}
                  />
                </label>
                <label class="field">
                  <span>${t("overview.access.language")}</span>
                  <select
                    .value=${currentLocale}
                    @change=${(e: Event) => {
                      const v = (e.target as HTMLSelectElement).value as Locale;
                      void i18n.setLocale(v);
                      props.onSettingsChange({ ...props.settings, locale: v });
                    }}
                  >
                    ${SUPPORTED_LOCALES.map((loc) => {
                      const key = loc.replace(/-([a-zA-Z])/g, (_, c) => c.toUpperCase());
                      return html`<option value=${loc}>${t(`languages.${key}`)}</option>`;
                    })}
                  </select>
                </label>
              </div>
              <div class="row" style="margin-top: 14px;">
                <button class="btn" @click=${() => props.onConnect()}>${t("common.connect")}</button>
                <button class="btn" @click=${() => props.onRefresh()}>${t("common.refresh")}</button>
                <span class="muted">${
                  isTrustedProxy
                    ? t("overview.access.trustedProxy")
                    : t("overview.access.connectHint")
                }</span>
              </div>
            </div>
          </div>
        </div>

        <div data-swapy-slot="snapshot">
          <div data-swapy-item="snapshot">
            <div class="card ov-card--snapshot">
              <div class="card-header-row">${dragHandleFree}
                <div><div class="card-title">${t("overview.snapshot.title")}</div>
                <div class="card-sub">${t("overview.snapshot.subtitle")}</div></div>
              </div>
              <div class="snapshot-dashboard">
                <div class="snapshot-status-row">
                  <div class="stat">
                    <div class="stat-label">${t("overview.snapshot.status")}</div>
                    <div class="stat-value ${props.connected ? "ok" : "warn"}">
                      ${props.connected ? t("common.ok") : t("common.offline")}
                    </div>
                  </div>
                  <div class="stat">
                    <div class="stat-label">${t("overview.snapshot.uptime")}</div>
                    <div class="stat-value">${uptime}</div>
                  </div>
                </div>
                <div class="snapshot-charts">
                  ${renderDonutChart(cpuPercent, "CPU", `${cpuPercent}%`)}
                  ${renderDonutChart(memPercent, "内存", `${memPercent}%`)}
                </div>
              </div>
              ${
                props.lastError
                  ? html`<div class="callout danger" style="margin-top: 14px;">
                    <div>${props.lastError}</div>
                    ${pairingHint ?? ""}
                    ${authHint ?? ""}
                    ${insecureContextHint ?? ""}
                  </div>`
                  : ""
              }
            </div>
          </div>
        </div>

        <div data-swapy-slot="stats">
          <div data-swapy-item="stats">
            <div class="card stat-cards-row ov-card--stats">
              <div class="card-header-row">${dragHandleFree}
                <div><div class="card-title">${"统计概览"}</div></div>
              </div>
              <div class="stat-grid" style="margin-top: 12px;">
                <div class="stat">
                  <div class="stat-label">${t("overview.stats.instances")}</div>
                  <div class="stat-value">${props.presenceCount}</div>
                  <div class="muted">${t("overview.stats.instancesHint")}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">${t("overview.stats.sessions")}</div>
                  <div class="stat-value">${props.sessionsCount ?? t("common.na")}</div>
                  <div class="muted">${t("overview.stats.sessionsHint")}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">${t("overview.stats.cron")}</div>
                  <div class="stat-value">
                    ${props.cronEnabled == null ? t("common.na") : props.cronEnabled ? t("common.enabled") : t("common.disabled")}
                  </div>
                  <div class="muted">${t("overview.stats.cronNext", { time: formatNextRun(props.cronNext) })}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div data-swapy-slot="activity">
          <div data-swapy-item="activity">
            <div class="card ov-card--activity">
              <div class="card-header-row">${dragHandleFree}
                <div><div class="card-title">${t("overview.activity.title")}</div>
                <div class="card-sub">${t("overview.activity.subtitle")}</div></div>
              </div>
              ${
                props.sessionActivity
                  ? html`
                  <div class="stat-grid" style="margin-top: 14px;">
                    <div class="stat">
                      <div class="stat-label">${t("overview.activity.processing")}</div>
                      <div class="stat-value ${props.sessionActivity.processing > 0 ? "ok" : ""}">
                        ${props.sessionActivity.processing}
                      </div>
                    </div>
                    <div class="stat">
                      <div class="stat-label">${t("overview.activity.waiting")}</div>
                      <div class="stat-value ${props.sessionActivity.waiting > 0 ? "warn" : ""}">
                        ${props.sessionActivity.waiting}
                      </div>
                    </div>
                    <div class="stat">
                      <div class="stat-label">${t("overview.activity.idle")}</div>
                      <div class="stat-value">${props.sessionActivity.idle}</div>
                    </div>
                  </div>
                  ${
                    props.sessionActivity.sessions.length > 0
                      ? html`
                      <div class="activity-cards" style="margin-top: 14px;">
                        ${props.sessionActivity.sessions.map(
                          (s) => html`
                            <div class="activity-card ${s.state}">
                              <div class="activity-card__header">
                                <span class="activity-dot ${s.state}"></span>
                                <span class="activity-card__badge ${s.state}">
                                  ${t(`overview.activity.state.${s.state}`)}
                                </span>
                              </div>
                              <div class="activity-card__key mono">${s.key}</div>
                              <div class="activity-card__meta muted">
                                ${
                                  s.lastActivityAgo < 5000
                                    ? t("overview.activity.justNow")
                                    : formatRelativeTimestamp(Date.now() - s.lastActivityAgo)
                                }
                                ${
                                  s.queueDepth > 0
                                    ? html` · ${t("overview.activity.queued", { count: String(s.queueDepth) })}`
                                    : nothing
                                }
                              </div>
                            </div>
                          `,
                        )}
                      </div>
                    `
                      : html`<div class="muted" style="margin-top: 14px;">${t("overview.activity.empty")}</div>`
                  }
                `
                  : html`<div class="muted" style="margin-top: 14px;">${t("overview.activity.loading")}</div>`
              }
            </div>
          </div>
        </div>

        <div data-swapy-slot="notes">
          <div data-swapy-item="notes">
            <div class="card ov-card--notes">
              <div class="card-header-row">${dragHandleFree}
                <div><div class="card-title">${t("overview.notes.title")}</div>
                <div class="card-sub">${t("overview.notes.subtitle")}</div></div>
              </div>
              <div class="note-grid" style="margin-top: 14px;">
                <div>
                  <div class="note-title">${t("overview.notes.tailscaleTitle")}</div>
                  <div class="muted">
                    ${t("overview.notes.tailscaleText")}
                  </div>
                </div>
                <div>
                  <div class="note-title">${t("overview.notes.sessionTitle")}</div>
                  <div class="muted">${t("overview.notes.sessionText")}</div>
                </div>
                <div>
                  <div class="note-title">${t("overview.notes.cronTitle")}</div>
                  <div class="muted">${t("overview.notes.cronText")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </oc-overview-layout>
  `;
}
