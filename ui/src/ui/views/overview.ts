import { html, nothing } from "lit";
import { ConnectErrorDetailCodes } from "../../../../src/gateway/protocol/connect-error-details.js";
import { t, i18n, SUPPORTED_LOCALES, type Locale } from "../../i18n/index.ts";
import { buildExternalLinkRel, EXTERNAL_LINK_TARGET } from "../external-link.ts";
import { formatRelativeTimestamp, formatDurationHuman } from "../format.ts";
import type { GatewayHelloOk } from "../gateway.ts";
import { avatarFromName } from "../helpers/multiavatar.ts";
import type { UiSettings } from "../storage.ts";
import type { GatewayAgentRow, SessionActivityResult } from "../types.ts";
import { resolveAgentAvatarSrc } from "./agents-utils.ts";
import { shouldShowPairingHint } from "./overview-hints.ts";

// Module-level cache for async system stats (Electron IPC)
let _cachedCpu = 0;
let _cachedMem = 0;
let _systemStatsPending = false;

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
  cronJobsCount: number | null;
  cronNext: number | null;
  lastChannelsRefresh: number | null;
  onSettingsChange: (next: UiSettings) => void;
  onPasswordChange: (next: string) => void;
  onSessionKeyChange: (next: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
  sessionActivity: SessionActivityResult | null;
  agents: GatewayAgentRow[];
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
  const renderDonutChart = (
    percent: number,
    label: string,
    valueText: string,
    colorOverride?: string,
  ) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - Math.min(percent, 100) / 100);
    const strokeColor =
      colorOverride ?? (percent > 80 ? "#ff6b6b" : percent > 50 ? "#fbbf24" : "#34d399");
    return html`
      <div class="donut-chart">
        <div class="donut-chart__label">${label}</div>
        <svg viewBox="0 0 100 100" width="110" height="110">
          <defs>
            <filter id="glow-${label}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feFlood flood-color="${strokeColor}" flood-opacity="0.6" result="color"/>
              <feComposite in="color" in2="blur" operator="in" result="shadow"/>
              <feMerge>
                <feMergeNode in="shadow"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="currentColor" stroke-width="7" opacity="0.12"/>
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="${strokeColor}" stroke-width="7"
            stroke-linecap="round"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dashOffset}"
            transform="rotate(-90 50 50)"
            filter="url(#glow-${label})"
            style="transition: stroke-dashoffset 0.6s ease;"/>
          <text x="50" y="52" text-anchor="middle" dominant-baseline="middle"
            fill="currentColor" font-size="15" font-weight="800">${valueText}</text>
        </svg>
      </div>
    `;
  };

  // --- System stats (real data from gateway RPC or Electron IPC) ---
  type SystemStats = { cpuPercent: number; memPercent: number };
  const desktop = (
    globalThis as unknown as { desktop?: { getSystemStats?: () => Promise<SystemStats> } }
  ).desktop;
  if (!_systemStatsPending) {
    _systemStatsPending = true;
    // Derive HTTP base URL from WebSocket URL (ws:// -> http://, wss:// -> https://)
    const gwHttpBase = props.settings.gatewayUrl
      .replace(/^wss:\/\//, "https://")
      .replace(/^ws:\/\//, "http://")
      .replace(/\/+$/, "");
    const statsPromise: Promise<SystemStats | null> = desktop?.getSystemStats
      ? desktop.getSystemStats()
      : fetch(`${gwHttpBase}/api/system-stats`)
          .then((r) => (r.ok ? (r.json() as Promise<SystemStats>) : null))
          .catch(() => null);
    statsPromise
      .then((stats) => {
        if (stats) {
          _cachedCpu = stats.cpuPercent;
          _cachedMem = stats.memPercent;
        }
        _systemStatsPending = false;
      })
      .catch(() => {
        _systemStatsPending = false;
      });
  }
  const cpuPercent = _cachedCpu;
  const memPercent = _cachedMem;

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

  // --- Build each card as a keyed template ---
  const cards: Record<string, ReturnType<typeof html>> = {
    snapshot: html`
        <div data-swapy-slot="snapshot">
          <div data-swapy-item="snapshot">
            <div class="card ov-card--snapshot">
              <div class="card-header-row">${dragHandleFree}
                <div><div class="card-title">${t("overview.snapshot.title")}</div>
                <div class="card-sub">${t("overview.snapshot.subtitle")}</div></div>
              </div>
              <div class="snapshot-charts">
                ${renderDonutChart(props.connected ? 100 : 0, t("overview.snapshot.status"), props.connected ? t("common.ok") : t("common.offline"), props.connected ? "#34d399" : "#ff6b6b")}
                ${renderDonutChart(100, t("overview.snapshot.uptime"), uptime, "#a7f3d0")}
                ${renderDonutChart(cpuPercent, "CPU", `${cpuPercent}%`)}
                ${renderDonutChart(memPercent, "内存", `${memPercent}%`)}
                ${renderDonutChart(props.presenceCount * 10, t("overview.stats.instances"), `${props.presenceCount}`, "#818cf8")}
                ${renderDonutChart(props.sessionsCount != null ? Math.min(props.sessionsCount * 10, 100) : 0, t("overview.stats.sessions"), `${props.sessionsCount ?? 0}`, "#38bdf8")}
                ${renderDonutChart(props.cronJobsCount != null ? (props.cronJobsCount > 0 ? 100 : 0) : 0, t("overview.stats.cron"), `${props.cronJobsCount ?? 0}`, "#fbbf24")}
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
        </div>`,
    access: html`
        <div data-swapy-slot="access">
          <div data-swapy-item="access">
            <div class="card ov-card--access">
              <div class="card-header-row">${dragHandleOnly}
                <div><div class="card-title">${t("overview.access.title")}</div>
                <div class="card-sub">${t("overview.access.subtitle")}</div></div>
              </div>
              <div class="fields" style="margin-top: 14px;">
                <label class="field">
                  <span>WebSocket URL</span>
                  <input
                    type="text"
                    .value=${props.settings.gatewayUrl}
                    @change=${(e: Event) => {
                      const v = (e.target as HTMLInputElement).value;
                      props.onSettingsChange({ ...props.settings, gatewayUrl: v });
                    }}
                  />
                </label>
                <label class="field">
                  <span>${t("overview.access.gatewayToken")}</span>
                  <input
                    type="text"
                    .value=${props.settings.token}
                    @change=${(e: Event) => {
                      const v = (e.target as HTMLInputElement).value;
                      props.onSettingsChange({ ...props.settings, token: v });
                    }}
                  />
                </label>
                <label class="field">
                  <span>${t("overview.access.password")} (${t("overview.access.notStored")})</span>
                  <input
                    type="password"
                    placeholder="system or shared password"
                    .value=${props.password}
                    @change=${(e: Event) => {
                      const v = (e.target as HTMLInputElement).value;
                      props.onPasswordChange(v);
                    }}
                  />
                </label>
                <label class="field">
                  <span>${t("overview.access.defaultSessionKey")}</span>
                  <input
                    type="text"
                    .value=${props.settings.sessionKey ?? ""}
                    @change=${(e: Event) => {
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
        </div>`,
    agents: html`
        <div data-swapy-slot="agents">
          <div data-swapy-item="agents">
            <div class="card">
              <div class="card-header-row">${dragHandleFree}
                <div><div class="card-title">Agent</div>
                <div class="card-sub">${props.agents.length} 个已配置。</div></div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px;">
                ${props.agents.map((agent) => {
                  const avatarSrc = resolveAgentAvatarSrc(agent);
                  return html`
                    <div class="agent-row-display">
                      ${avatarSrc ? html`<img class="agent-avatar-sm" src="${avatarSrc}" alt="" />` : nothing}
                      <div class="agent-info-sm">
                        <div class="agent-name">${agent.identity?.name ?? agent.name ?? agent.id}</div>
                        <div class="agent-id mono muted">${agent.id}</div>
                      </div>
                    </div>
                  `;
                })}
              </div>
            </div>
          </div>
        </div>`,
    activity: html`
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
                        ${props.sessionActivity.sessions.map((s) => {
                          // Extract agent ID: "agent:dev:main" → "dev", "agent:test:web:123" → "test"
                          const agentId = s.key.split(":")[1] ?? s.key;
                          const agent = props.agents.find((a) => a.id === agentId);
                          const avatarSrc = agent
                            ? resolveAgentAvatarSrc(agent)
                            : avatarFromName(agentId);
                          return html`
                            <div class="activity-card ${s.state}">
                              <div class="activity-card__header">
                                ${avatarSrc ? html`<img class="activity-card__avatar" src="${avatarSrc}" alt="" />` : nothing}
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
                          `;
                        })}
                      </div>
                    `
                      : html`<div class="muted" style="margin-top: 14px;">${t("overview.activity.empty")}</div>`
                  }
                `
                  : html`<div class="muted" style="margin-top: 14px;">${t("overview.activity.loading")}</div>`
              }
            </div>
          </div>
        </div>`,
  };

  // Render cards in saved order (from localStorage), falling back to default
  const defaultOrder = ["snapshot", "access", "agents", "activity"];
  let cardOrder = defaultOrder;
  try {
    const saved = localStorage.getItem("oc-overview-card-order-v2");
    if (saved) {
      const parsed = JSON.parse(saved) as Array<{ slot: string; item: string }>;
      const order = parsed.map((e) => e.slot).filter((s) => s in cards);
      if (order.length === defaultOrder.length) {
        cardOrder = order;
      }
    }
  } catch {
    /* use default */
  }

  return html`
    <oc-overview-layout>
      <div class="overview-swapy">
        ${cardOrder.map((slot) => cards[slot])}
      </div>
    </oc-overview-layout>
  `;
}
