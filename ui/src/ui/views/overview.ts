import { html, nothing } from "lit";
import { ConnectErrorDetailCodes } from "../../../../src/gateway/protocol/connect-error-details.js";
import { t, i18n, SUPPORTED_LOCALES, type Locale } from "../../i18n/index.ts";
import { buildExternalLinkRel, EXTERNAL_LINK_TARGET } from "../external-link.ts";
import { formatRelativeTimestamp, formatDurationHuman } from "../format.ts";
import type { GatewayHelloOk } from "../gateway.ts";
import { avatarFromName } from "../helpers/multiavatar.ts";
import type { UiSettings } from "../storage.ts";
import type {
  GatewayAgentRow,
  SessionActivityResult,
  CostUsageSummary,
  SessionsUsageResult,
} from "../types.ts";
import { resolveAgentAvatarSrc } from "./agents-utils.ts";
import { shouldShowPairingHint } from "./overview-hints.ts";

// Module-level cache for async system stats (Electron IPC)
let _cachedCpu = 0;
let _cachedMem = 0;
let _systemStatsPending = false;

// Module-level state for usage chart mode toggle
let _usageChartMode: "1d" | "7d" | "ctx" = "7d";
let _ctxTimeRange: "1d" | "7d" = "1d";
let _usageAgentFilter = ""; // "" = all agents
let _usageChartInstance: import("chart.js").Chart | null = null;

async function initOrUpdateUsageChart(
  canvas: HTMLCanvasElement,
  labels: string[],
  data: number[],
  mode: "1d" | "7d",
) {
  const { Chart, registerables } = await import("chart.js");
  Chart.register(...registerables);

  const isDark = document.documentElement.dataset.theme === "dark";
  const textColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const formatTick = (val: number | string) => {
    const n = typeof val === "string" ? Number(val) : val;
    if (n >= 1_000_000) {
      return `${(n / 1_000_000).toFixed(1)}M`;
    }
    if (n >= 1_000) {
      return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
    }
    return String(n);
  };

  if (_usageChartInstance) {
    _usageChartInstance.data.labels = labels;
    _usageChartInstance.data.datasets[0].data = data;
    // Update tick display for mode changes
    const xAxis = _usageChartInstance.options.scales?.x;
    if (xAxis && "ticks" in xAxis) {
      (xAxis as Record<string, unknown>).maxTicksLimit = mode === "1d" ? 8 : undefined;
    }
    _usageChartInstance.update("none");
    return;
  }

  _usageChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data,
          borderColor: "#818cf8",
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) {
              return "rgba(129,140,248,0.1)";
            }
            const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            grad.addColorStop(0, "rgba(129,140,248,0.35)");
            grad.addColorStop(1, "rgba(129,140,248,0.02)");
            return grad;
          },
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#818cf8",
          pointBorderColor: isDark ? "#1a1a2e" : "#fff",
          pointBorderWidth: 1.5,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? "rgba(20,20,40,0.95)" : "rgba(255,255,255,0.95)",
          titleColor: isDark ? "#fff" : "#333",
          bodyColor: isDark ? "rgba(255,255,255,0.8)" : "#555",
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            label: (ctx) => `${(ctx.parsed.y ?? 0).toLocaleString()} tokens`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { size: 11 },
            maxTicksLimit: mode === "1d" ? 8 : undefined,
          },
          border: { display: false },
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: (val) => formatTick(val),
            maxTicksLimit: 5,
          },
          border: { display: false },
          beginAtZero: true,
        },
      },
    },
  });
}

let _ctxChartInstance: import("chart.js").Chart | null = null;

async function initOrUpdateCtxChart(
  canvas: HTMLCanvasElement,
  rows: Array<{ label: string; tokens: number; color: string }>,
  sessionCount: number,
) {
  const { Chart, registerables } = await import("chart.js");
  Chart.register(...registerables);

  const isDark = document.documentElement.dataset.theme === "dark";
  const textColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const formatTick = (val: number | string) => {
    const n = typeof val === "string" ? Number(val) : val;
    if (n >= 1e6) {
      return `${(n / 1e6).toFixed(1)}M`;
    }
    if (n >= 1e3) {
      return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
    }
    return String(n);
  };

  const labels = rows.map((r) => r.label);
  const data = rows.map((r) => r.tokens);
  const colors = rows.map((r) => r.color);

  if (_ctxChartInstance) {
    _ctxChartInstance.data.labels = labels;
    _ctxChartInstance.data.datasets[0].data = data;
    _ctxChartInstance.data.datasets[0].backgroundColor = colors;
    _ctxChartInstance.update("none");
    return;
  }

  _ctxChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderRadius: 4,
          barThickness: 24,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? "rgba(20,20,40,0.95)" : "rgba(255,255,255,0.95)",
          titleColor: isDark ? "#fff" : "#333",
          bodyColor: isDark ? "rgba(255,255,255,0.8)" : "#555",
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
          displayColors: true,
          callbacks: {
            label: (ctx) => {
              const total = (ctx.dataset.data as number[]).reduce((a, b) => a + (b ?? 0), 0);
              const val = ctx.parsed.x ?? 0;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
              return `${formatTick(val)} tokens (${pct}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 }, callback: (val) => formatTick(val) },
          border: { display: false },
          beginAtZero: true,
          title:
            sessionCount > 1
              ? {
                  display: true,
                  text: `avg ${sessionCount} sessions`,
                  color: textColor,
                  font: { size: 10 },
                }
              : undefined,
        },
        y: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 12, weight: "bold" } },
          border: { display: false },
        },
      },
    },
  });
}

function buildHourlyFromSessions(
  result: SessionsUsageResult,
): Array<{ hour: number; tokens: number }> {
  const hourTotals = Array.from({ length: 24 }, () => 0);
  for (const session of result.sessions) {
    const usage = session.usage;
    if (!usage || !usage.totalTokens || usage.totalTokens <= 0) {
      continue;
    }
    const start = usage.firstActivity ?? session.updatedAt;
    const end = usage.lastActivity ?? session.updatedAt;
    if (!start || !end) {
      continue;
    }
    const startMs = Math.min(start, end);
    const endMs = Math.max(start, end);
    const durationMs = Math.max(endMs - startMs, 1);
    const totalMinutes = durationMs / 60000;
    let cursor = startMs;
    while (cursor < endMs) {
      const date = new Date(cursor);
      const hour = date.getHours();
      const nextHour = new Date(date);
      nextHour.setMinutes(59, 59, 999);
      const nextMs = Math.min(nextHour.getTime(), endMs);
      const minutes = Math.max((nextMs - cursor) / 60000, 0);
      const share = minutes / totalMinutes;
      hourTotals[hour] += usage.totalTokens * share;
      cursor = nextMs + 1;
    }
  }
  return hourTotals.map((tokens, hour) => ({ hour, tokens: Math.round(tokens) }));
}

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
  costDaily: CostUsageSummary | null;
  usageResult: SessionsUsageResult | null;
  weekUsageResult: SessionsUsageResult | null;
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
              <div class="access-grid" style="margin-top: 14px;">
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
              </div>
              <div class="row" style="margin-top: 14px; gap: 10px; align-items: center;">
                <label class="field" style="margin: 0; flex: 0 0 auto;">
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
                              ${
                                s.totalTokens != null && s.contextTokens
                                  ? html`
                                  <div class="activity-card__tokens">
                                    <div class="token-bar">
                                      <div class="token-bar__fill" style="width: ${Math.min((s.totalTokens / s.contextTokens) * 100, 100)}%"></div>
                                    </div>
                                    <div class="token-bar__label muted"><span>tokens</span><span>${s.totalTokens.toLocaleString()} / ${s.contextTokens.toLocaleString()} (${Math.round((s.totalTokens / s.contextTokens) * 100)}%)</span></div>
                                  </div>`
                                  : nothing
                              }
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
    usage: (() => {
      const daily = props.costDaily?.daily ?? [];
      const hourly = props.usageResult ? buildHourlyFromSessions(props.usageResult) : [];
      const hasWeekData = daily.length > 0;
      const hasDayData = hourly.some((h) => h.tokens > 0);
      const hasCtxData =
        props.usageResult?.sessions?.some((s: Record<string, unknown>) => s.contextWeight) ?? false;
      if (!hasWeekData && !hasDayData && !hasCtxData) {
        return html`
          <div data-swapy-slot="usage"><div data-swapy-item="usage"></div></div>
        `;
      }

      // Collect unique agents from both results
      const agentSet = new Set<string>();
      for (const s of props.usageResult?.sessions ?? []) {
        if (s.agentId) {
          agentSet.add(s.agentId);
        }
      }
      for (const s of props.weekUsageResult?.sessions ?? []) {
        if (s.agentId) {
          agentSet.add(s.agentId);
        }
      }
      const agentList = Array.from(agentSet).toSorted();
      const filterAgent = _usageAgentFilter;
      const hasFilter = filterAgent !== "" && agentSet.has(filterAgent);

      // Filter helper
      const filterSessions = (sessions: SessionsUsageResult["sessions"]) =>
        hasFilter ? sessions.filter((s) => s.agentId === filterAgent) : sessions;

      const mode = _usageChartMode;
      let labels: string[] = [];
      let data: number[] = [];
      let subtitle = "";
      const isChartMode = mode !== "ctx";
      const fmtT = (n: number) =>
        n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);

      if (mode === "7d" && hasWeekData) {
        if (hasFilter && props.weekUsageResult) {
          // Recompute daily from filtered sessions
          const now = new Date();
          const dayMap = new Map<string, number>();
          for (let i = 0; i < 7; i++) {
            const d = new Date(now.getTime() - (6 - i) * 86400000);
            dayMap.set(d.toISOString().slice(0, 10), 0);
          }
          for (const s of filterSessions(props.weekUsageResult.sessions)) {
            if (!s.updatedAt || !s.usage) {
              continue;
            }
            const dateStr = new Date(s.updatedAt).toISOString().slice(0, 10);
            if (dayMap.has(dateStr)) {
              dayMap.set(dateStr, (dayMap.get(dateStr) ?? 0) + (s.usage.totalTokens ?? 0));
            }
          }
          labels = Array.from(dayMap.keys()).map((d) => {
            const dt = new Date(d + "T00:00:00");
            return `${dt.getMonth() + 1}/${dt.getDate()}`;
          });
          data = Array.from(dayMap.values());
        } else {
          labels = daily.map((d) => {
            const dt = new Date(d.date + "T00:00:00");
            return `${dt.getMonth() + 1}/${dt.getDate()}`;
          });
          data = daily.map((d) => d.totalTokens ?? 0);
        }
        const total = data.reduce((a, b) => a + b, 0);
        subtitle = `最近 ${daily.length} 天 · ${fmtT(total)} tokens`;
      } else if (mode === "1d") {
        if (hasFilter && props.usageResult) {
          const hrs = Array.from({ length: 24 }, (_, i) => ({ hour: i, tokens: 0 }));
          for (const s of filterSessions(props.usageResult.sessions)) {
            if (!s.updatedAt || !s.usage) {
              continue;
            }
            const h = new Date(s.updatedAt).getHours();
            hrs[h].tokens += s.usage.totalTokens ?? 0;
          }
          labels = hrs.map((h) => `${h.hour}:00`);
          data = hrs.map((h) => h.tokens);
        } else {
          labels = hourly.map((h) => `${h.hour}:00`);
          data = hourly.map((h) => h.tokens);
        }
        const total = data.reduce((a, b) => a + b, 0);
        subtitle = `今日（按小时）· ${fmtT(total)} tokens`;
      } else if (mode === "ctx") {
        subtitle = _ctxTimeRange === "7d" ? "上下文构成（7天）" : "上下文构成（今日）";
      }

      if (isChartMode && data.length === 0) {
        return html`
          <div data-swapy-slot="usage"><div data-swapy-item="usage"></div></div>
        `;
      }

      const onToggle = (next: "1d" | "7d" | "ctx") => {
        if (next === "ctx" && _usageChartInstance) {
          _usageChartInstance.destroy();
          _usageChartInstance = null;
        }
        _usageChartMode = next;
        const host = document.querySelector("openclaw-app");
        if (host) {
          (host as HTMLElement & { requestUpdate?: () => void }).requestUpdate?.();
        }
      };

      if (isChartMode && data.length > 0) {
        requestAnimationFrame(() => {
          const canvas = document.getElementById("ov-usage-canvas") as HTMLCanvasElement | null;
          if (!canvas) {
            return;
          }
          void initOrUpdateUsageChart(canvas, labels, data, mode);
        });
      }

      // Context breakdown for ctx mode
      const CTP = 4;
      let ctxHtml = html``;
      if (mode === "ctx") {
        let sC = 0,
          kC = 0,
          tC = 0,
          fC = 0,
          cnt = 0;
        const ctxSource =
          _ctxTimeRange === "7d"
            ? (props.weekUsageResult?.sessions ?? [])
            : (props.usageResult?.sessions ?? []);
        const ctxSessions = hasFilter
          ? ctxSource.filter((s) => s.agentId === filterAgent)
          : ctxSource;
        for (const s of ctxSessions) {
          const cw = (s as Record<string, unknown>).contextWeight as
            | Record<string, Record<string, number>>
            | undefined;
          if (!cw) {
            continue;
          }
          sC += cw.systemPrompt?.chars ?? 0;
          kC += cw.skills?.promptChars ?? 0;
          tC += (cw.tools?.listChars ?? 0) + (cw.tools?.schemaChars ?? 0);
          const wf = (cw as Record<string, unknown>).injectedWorkspaceFiles as
            | Array<{ injectedChars: number }>
            | undefined;
          fC += (wf ?? []).reduce((a, f) => a + f.injectedChars, 0);
          cnt++;
        }
        if (cnt > 1) {
          sC = Math.round(sC / cnt);
          kC = Math.round(kC / cnt);
          tC = Math.round(tC / cnt);
          fC = Math.round(fC / cnt);
        }
        const sy = Math.round(sC / CTP),
          sk = Math.round(kC / CTP),
          tl = Math.round(tC / CTP),
          fl = Math.round(fC / CTP);
        const tot = sy + sk + tl + fl;
        const rows = [
          { label: "System", tokens: sy, color: "#ff4d4d" },
          { label: "Tools", tokens: tl, color: "#ffa64d" },
          { label: "Skills", tokens: sk, color: "#4da6ff" },
          { label: "Files", tokens: fl, color: "#4dff88" },
        ];
        if (tot > 0) {
          requestAnimationFrame(() => {
            const canvas = document.getElementById("ov-ctx-canvas") as HTMLCanvasElement | null;
            if (!canvas) {
              return;
            }
            void initOrUpdateCtxChart(canvas, rows, cnt);
          });
          const onCtxRange = (r: "1d" | "7d") => {
            if (_ctxChartInstance) {
              _ctxChartInstance.destroy();
              _ctxChartInstance = null;
            }
            _ctxTimeRange = r;
            const host = document.querySelector("openclaw-app");
            if (host) {
              (host as HTMLElement & { requestUpdate?: () => void }).requestUpdate?.();
            }
          };
          ctxHtml = html`
            <div style="display:flex;justify-content:flex-end;margin-bottom:4px">
              <div class="usage-chart-toggle" style="font-size:11px">
                <button class="${_ctxTimeRange === "1d" ? "active" : ""}" @click=${() => onCtxRange("1d")}>1d</button>
                <button class="${_ctxTimeRange === "7d" ? "active" : ""}" @click=${() => onCtxRange("7d")}>7d</button>
              </div>
            </div>
            <div style="position:relative;height:165px">
              <canvas id="ov-ctx-canvas"></canvas>
            </div>`;
        } else {
          ctxHtml = html`
            <div class="muted" style="padding: 20px; text-align: center">无上下文数据</div>
          `;
        }
      }

      return html`
        <div data-swapy-slot="usage">
          <div data-swapy-item="usage">
            <div class="card ov-card--usage">
              <div class="card-header-row">${dragHandleOnly}
                <div style="flex:1"><div class="card-title">${mode === "ctx" ? "上下文构成" : "令牌用量趋势"}</div>
                <div class="card-sub">${subtitle}</div></div>
                ${
                  agentList.length > 1
                    ? html`
                  <div class="ov-agent-dropdown">
                    <button class="ov-agent-btn" @click=${(e: Event) => {
                      const menu = (e.currentTarget as HTMLElement)
                        .nextElementSibling as HTMLElement;
                      const isOpen = menu.classList.toggle("open");
                      if (isOpen) {
                        const close = (ev: MouseEvent) => {
                          if (
                            !(e.currentTarget as HTMLElement)?.parentElement?.contains(
                              ev.target as Node,
                            )
                          ) {
                            menu.classList.remove("open");
                            document.removeEventListener("click", close);
                          }
                        };
                        requestAnimationFrame(() => document.addEventListener("click", close));
                      }
                    }}>
                      ${filterAgent || "全部 Agent"}
                      <span class="ov-agent-arrow">▾</span>
                    </button>
                    <div class="ov-agent-menu">
                      ${[
                        { value: "", label: "全部 Agent" },
                        ...agentList.map((a) => ({ value: a, label: a })),
                      ].map(
                        (opt) => html`
                        <div class="ov-agent-option ${opt.value === filterAgent ? "selected" : ""}" @click=${() => {
                          _usageAgentFilter = opt.value;
                          if (_usageChartInstance) {
                            _usageChartInstance.destroy();
                            _usageChartInstance = null;
                          }
                          if (_ctxChartInstance) {
                            _ctxChartInstance.destroy();
                            _ctxChartInstance = null;
                          }
                          const host = document.querySelector("openclaw-app");
                          if (host) {
                            (
                              host as HTMLElement & { requestUpdate?: () => void }
                            ).requestUpdate?.();
                          }
                        }}>${opt.value === filterAgent ? "✓ " : ""}${opt.label}</div>
                      `,
                      )}
                    </div>
                  </div>
                `
                    : nothing
                }
                <div class="usage-chart-toggle">
                  <button class="${mode === "1d" ? "active" : ""}" @click=${() => onToggle("1d")}>1d</button>
                  <button class="${mode === "7d" ? "active" : ""}" @click=${() => onToggle("7d")}>7d</button>
                  <button class="${mode === "ctx" ? "active" : ""}" @click=${() => onToggle("ctx")}>ctx</button>
                </div>
              </div>
              ${
                isChartMode
                  ? html`
                      <div class="usage-line-chart" style="margin-top: 12px; position: relative; height: 200px">
                        <canvas id="ov-usage-canvas"></canvas>
                      </div>
                    `
                  : html`<div style="margin-top:12px;padding:0 4px 4px">${ctxHtml}</div>`
              }
            </div>
          </div>
        </div>`;
    })(),
  };

  // Render cards in saved order (from localStorage), falling back to default
  const defaultOrder = ["snapshot", "usage", "access", "agents", "activity"];
  let cardOrder = defaultOrder;
  try {
    const saved = localStorage.getItem("oc-overview-card-order-v3");
    if (saved) {
      const parsed = JSON.parse(saved) as Array<{ slot: string; item: string }>;
      const order = parsed.map((e) => e.item).filter((s) => s in cards);
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
