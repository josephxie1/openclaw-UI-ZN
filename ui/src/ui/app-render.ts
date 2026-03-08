import { html, nothing } from "lit";
import { parseAgentSessionKey } from "../../../src/routing/session-key.js";
import { t } from "../i18n/index.ts";
import { refreshChatAvatar } from "./app-chat.ts";
import { renderUsageTab } from "./app-render-usage-tab.ts";
import { renderChatControls, renderTab, renderThemeToggle } from "./app-render.helpers.ts";
import { resolveSessionDisplayName, isCronSessionKey } from "./app-render.helpers.ts";
import { syncUrlWithSessionKey } from "./app-settings.ts";
import type { AppViewState } from "./app-view-state.ts";
import { loadAgentFileContent, loadAgentFiles, saveAgentFile } from "./controllers/agent-files.ts";
import { loadAgentIdentities, loadAgentIdentity } from "./controllers/agent-identity.ts";
import { loadAgentSkills } from "./controllers/agent-skills.ts";
import { loadAgents, loadToolsCatalog } from "./controllers/agents.ts";
import { approveChannelPairing, loadChannelPairings } from "./controllers/channel-pairing.ts";
import { loadChannels } from "./controllers/channels.ts";
import { ChatState, loadChatHistory } from "./controllers/chat.ts";
import {
  applyConfig,
  loadConfig,
  loadConfigRaw,
  runUpdate,
  saveConfig,
  updateConfigFormValue,
  removeConfigFormValue,
} from "./controllers/config.ts";
import {
  loadCronRuns,
  loadMoreCronJobs,
  loadMoreCronRuns,
  reloadCronJobs,
  toggleCronJob,
  runCronJob,
  removeCronJob,
  addCronJob,
  startCronEdit,
  startCronClone,
  cancelCronEdit,
  validateCronForm,
  hasCronFormErrors,
  normalizeCronFormState,
  getVisibleCronJobs,
  updateCronJobsFilter,
  updateCronRunsFilter,
} from "./controllers/cron.ts";
import { loadDebug, callDebugMethod } from "./controllers/debug.ts";
import {
  approveDevicePairing,
  loadDevices,
  rejectDevicePairing,
  revokeDeviceToken,
  rotateDeviceToken,
} from "./controllers/devices.ts";
import {
  loadExecApprovals,
  removeExecApprovalsFormValue,
  saveExecApprovals,
  updateExecApprovalsFormValue,
} from "./controllers/exec-approvals.ts";
import { loadLogs } from "./controllers/logs.ts";
import { loadNodes } from "./controllers/nodes.ts";
import { loadPresence } from "./controllers/presence.ts";
import { deleteSessionAndRefresh, loadSessions, patchSession } from "./controllers/sessions.ts";
import {
  installSkill,
  loadSkills,
  saveSkillApiKey,
  updateSkillEdit,
  updateSkillEnabled,
} from "./controllers/skills.ts";
import { buildExternalLinkRel, EXTERNAL_LINK_TARGET } from "./external-link.ts";
import { translateError } from "./helpers/translate-error.ts";
import { icons } from "./icons.ts";
import { normalizeBasePath, TAB_GROUPS, subtitleForTab, titleForTab } from "./navigation.ts";
import { resolveConfiguredCronModelSuggestions } from "./views/agents-utils.ts";
import { renderAgents } from "./views/agents.ts";
import { renderChannelsQuickAdd } from "./views/channels-quick-add.ts";
import { renderChannels } from "./views/channels.ts";
import { renderChat } from "./views/chat.ts";
import { renderConfig } from "./views/config.ts";
import { renderCron } from "./views/cron.ts";
import { renderDebug } from "./views/debug.ts";
import { renderExecApprovalPrompt } from "./views/exec-approval.ts";
import { renderGatewayUrlConfirmation } from "./views/gateway-url-confirmation.ts";
import { renderInstances } from "./views/instances.ts";
import { renderLogs } from "./views/logs.ts";
import { renderDefaultModelConfig } from "./views/models-default-config.ts";
import { renderModelsQuickAdd, PROVIDER_PRESETS } from "./views/models-quick-add.ts";
import { renderNodes, renderChannelPairings } from "./views/nodes.ts";
import { renderOverview } from "./views/overview.ts";
import { renderSessions } from "./views/sessions.ts";
import { renderSetupWizard } from "./views/setup-wizard.ts";
import { renderSkills } from "./views/skills.ts";

const AVATAR_DATA_RE = /^data:/i;
const AVATAR_HTTP_RE = /^https?:\/\//i;
const CRON_THINKING_SUGGESTIONS = ["off", "minimal", "low", "medium", "high"];
const CRON_TIMEZONE_SUGGESTIONS = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
];

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function normalizeSuggestionValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function resolveAssistantAvatarUrl(state: AppViewState): string | undefined {
  const list = state.agentsList?.agents ?? [];
  const parsed = parseAgentSessionKey(state.sessionKey);
  const agentId = parsed?.agentId ?? state.agentsList?.defaultId ?? "main";
  const agent = list.find((entry) => entry.id === agentId);
  const identity = agent?.identity;
  const candidate = identity?.avatarUrl ?? identity?.avatar;
  if (!candidate) {
    return undefined;
  }
  if (AVATAR_DATA_RE.test(candidate) || AVATAR_HTTP_RE.test(candidate)) {
    return candidate;
  }
  return identity?.avatarUrl;
}

const MAX_SIDEBAR_SESSIONS = 20;

function formatRelativeTime(ts: number | null): string {
  if (!ts) {
    return "";
  }
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) {
    return "just now";
  }
  if (mins < 60) {
    return `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function renderSessionList(state: AppViewState) {
  const sessions = state.sessionsResult?.sessions;
  if (!sessions || sessions.length === 0) {
    return nothing;
  }

  const hideCron = state.sessionsHideCron ?? true;
  const filtered = sessions
    .filter((s) => !hideCron || !isCronSessionKey(s.key))
    .slice(0, MAX_SIDEBAR_SESSIONS);

  if (filtered.length === 0) {
    return nothing;
  }

  return html`
    <div class="session-list">
      ${filtered.map((session) => {
        const isActive = session.key === state.sessionKey;
        const name = resolveSessionDisplayName(session.key, session);
        const time = formatRelativeTime(session.updatedAt);
        return html`
          <button
            class="session-item ${isActive ? "session-item--active" : ""}"
            @click=${() => {
              if (isActive) {
                return;
              }
              state.sessionKey = session.key;
              state.chatMessage = "";
              state.chatStream = null;
              state.chatRunId = null;
              state.applySettings({
                ...state.settings,
                sessionKey: session.key,
                lastActiveSessionKey: session.key,
              });
              void state.loadAssistantIdentity();
              syncUrlWithSessionKey(
                state as unknown as Parameters<typeof syncUrlWithSessionKey>[0],
                session.key,
                true,
              );
              void loadChatHistory(state as unknown as ChatState);
              state.setTab("chat");
            }}
            title=${name}
          >
            <span class="session-item__name">${name}</span>
            ${time ? html`<span class="session-item__time">${time}</span>` : nothing}
          </button>
        `;
      })}
    </div>
  `;
}

export function renderApp(state: AppViewState) {
  const openClawVersion =
    (typeof state.hello?.server?.version === "string" && state.hello.server.version.trim()) ||
    state.updateAvailable?.currentVersion ||
    t("common.na");
  const availableUpdate =
    state.updateAvailable &&
    state.updateAvailable.latestVersion !== state.updateAvailable.currentVersion
      ? state.updateAvailable
      : null;
  const versionStatusClass = availableUpdate ? "warn" : "ok";
  const presenceCount = state.presenceEntries.length;
  const sessionsCount = state.sessionsResult?.count ?? null;
  const cronNext = state.cronStatus?.nextWakeAtMs ?? null;
  const chatDisabledReason = state.connected ? null : t("chat.disconnected");
  const isChat = state.tab === "chat";
  const chatFocus = isChat && (state.settings.chatFocusMode || state.onboarding);
  const showThinking = state.onboarding ? false : state.settings.chatShowThinking;
  const assistantAvatarUrl = resolveAssistantAvatarUrl(state);
  const chatAvatarUrl = state.chatAvatarUrl ?? assistantAvatarUrl ?? null;
  const configValue =
    state.configForm ?? (state.configSnapshot?.config as Record<string, unknown> | null);
  const basePath = normalizeBasePath(state.basePath ?? "");
  const resolvedAgentId =
    state.agentsSelectedId ??
    state.agentsList?.defaultId ??
    state.agentsList?.agents?.[0]?.id ??
    null;
  const cronAgentSuggestions = Array.from(
    new Set(
      [
        ...(state.agentsList?.agents?.map((entry) => entry.id.trim()) ?? []),
        ...state.cronJobs
          .map((job) => (typeof job.agentId === "string" ? job.agentId.trim() : ""))
          .filter(Boolean),
      ].filter(Boolean),
    ),
  ).toSorted((a, b) => a.localeCompare(b));
  const cronModelSuggestions = Array.from(
    new Set(
      [
        ...state.cronModelSuggestions,
        ...resolveConfiguredCronModelSuggestions(configValue),
        ...state.cronJobs
          .map((job) => {
            if (job.payload.kind !== "agentTurn" || typeof job.payload.model !== "string") {
              return "";
            }
            return job.payload.model.trim();
          })
          .filter(Boolean),
      ].filter(Boolean),
    ),
  ).toSorted((a, b) => a.localeCompare(b));
  const visibleCronJobs = getVisibleCronJobs(state);
  const selectedDeliveryChannel =
    state.cronForm.deliveryChannel && state.cronForm.deliveryChannel.trim()
      ? state.cronForm.deliveryChannel.trim()
      : "last";
  const jobToSuggestions = state.cronJobs
    .map((job) => normalizeSuggestionValue(job.delivery?.to))
    .filter(Boolean);
  const accountToSuggestions = (
    selectedDeliveryChannel === "last"
      ? Object.values(state.channelsSnapshot?.channelAccounts ?? {}).flat()
      : (state.channelsSnapshot?.channelAccounts?.[selectedDeliveryChannel] ?? [])
  )
    .flatMap((account) => [
      normalizeSuggestionValue(account.accountId),
      normalizeSuggestionValue(account.name),
    ])
    .filter(Boolean);
  const rawDeliveryToSuggestions = uniquePreserveOrder([
    ...jobToSuggestions,
    ...accountToSuggestions,
  ]);
  const accountSuggestions = uniquePreserveOrder(accountToSuggestions);
  const deliveryToSuggestions =
    state.cronForm.deliveryMode === "webhook"
      ? rawDeliveryToSuggestions.filter((value) => isHttpUrl(value))
      : rawDeliveryToSuggestions;

  return html`
    <div class="shell ${isChat ? "shell--chat" : ""} ${chatFocus ? "shell--chat-focus" : ""} ${state.settings.navCollapsed ? "shell--nav-collapsed" : ""} ${state.onboarding ? "shell--onboarding" : ""}">
      <header class="topbar">
        <div class="topbar-left">
          <button
            class="nav-collapse-toggle"
            @click=${() =>
              state.applySettings({
                ...state.settings,
                navCollapsed: !state.settings.navCollapsed,
              })}
            title="${state.settings.navCollapsed ? t("nav.expand") : t("nav.collapse")}"
            aria-label="${state.settings.navCollapsed ? t("nav.expand") : t("nav.collapse")}"
          >
            <span class="nav-collapse-toggle__icon">${icons.menu}</span>
          </button>
          <div class="brand">
            <div class="brand-logo">
              <img src=${basePath ? `${basePath}/favicon.svg` : "/favicon.svg"} alt="OpenClaw" />
            </div>
            <div class="brand-text">
              <div class="brand-title">OPENCLAW</div>
              <div class="brand-sub">${t("global.brandSub")}</div>
            </div>
          </div>
        </div>
        <div class="topbar-status">
          <div class="pill">
            <span class="statusDot ${versionStatusClass}"></span>
            <span>${t("common.version")}</span>
            <span class="mono">${openClawVersion}</span>
          </div>
          <div class="pill">
            <span class="statusDot ${state.connected ? "ok" : ""}"></span>
            <span>${t("common.health")}</span>
            <span class="mono">${state.connected ? t("common.ok") : t("common.offline")}</span>
          </div>
          ${renderThemeToggle(state)}
        </div>
      </header>
      <aside class="nav ${state.settings.navCollapsed ? "nav--collapsed" : ""}">
        ${TAB_GROUPS.map((group) => {
          const isGroupCollapsed = state.settings.navGroupsCollapsed[group.label] ?? false;
          const hasActiveTab = group.tabs.some((tab) => tab === state.tab);
          return html`
            <div class="nav-group ${isGroupCollapsed && !hasActiveTab ? "nav-group--collapsed" : ""}">
              ${
                group.label === "chat"
                  ? html`
                <button
                  class="nav-label ${state.tab === "chat" ? "nav-label--active" : ""}"
                  @click=${() => {
                    if (state.tab === "chat") {
                      // Already on chat — just toggle collapse, no reload
                      const next = { ...state.settings.navGroupsCollapsed };
                      next[group.label] = !isGroupCollapsed;
                      state.applySettings({
                        ...state.settings,
                        navGroupsCollapsed: next,
                      });
                    } else {
                      // Coming from another tab — always expand and load
                      const next = { ...state.settings.navGroupsCollapsed };
                      next[group.label] = false;
                      state.applySettings({
                        ...state.settings,
                        navGroupsCollapsed: next,
                      });
                      state.setTab("chat");
                    }
                  }}
                  aria-expanded=${!isGroupCollapsed}
                >
                  <span class="nav-label__text">${t(`nav.${group.label}`)}</span>
                  <span class="nav-label__chevron">${isGroupCollapsed ? "+" : "−"}</span>
                </button>
                ${!isGroupCollapsed ? renderSessionList(state) : nothing}
              `
                  : group.tabs.length === 1
                    ? html`
                <button
                  class="nav-label ${state.tab === group.tabs[0] ? "nav-label--active" : ""}"
                  @click=${() => state.setTab(group.tabs[0])}
                >
                  <span class="nav-label__text">${t(`nav.${group.label}`)}</span>
                </button>
              `
                    : html`
                <button
                  class="nav-label"
                  @click=${() => {
                    const next = { ...state.settings.navGroupsCollapsed };
                    next[group.label] = !isGroupCollapsed;
                    state.applySettings({
                      ...state.settings,
                      navGroupsCollapsed: next,
                    });
                  }}
                  aria-expanded=${!isGroupCollapsed}
                >
                  <span class="nav-label__text">${t(`nav.${group.label}`)}</span>
                  <span class="nav-label__chevron">${isGroupCollapsed ? "+" : "−"}</span>
                </button>
                <div class="nav-group__items">
                  ${group.tabs.map((tab) => renderTab(state, tab))}
                </div>
              `
              }
            </div>
          `;
        })}
        <div class="nav-group nav-group--links">
          <div class="nav-label nav-label--static">
            <span class="nav-label__text">${t("common.resources")}</span>
          </div>
          <div class="nav-group__items">
            <a
              class="nav-item nav-item--external"
              href="https://docs.openclaw.ai"
              target=${EXTERNAL_LINK_TARGET}
              rel=${buildExternalLinkRel()}
              title="${t("common.docs")} (opens in new tab)"
            >
              <span class="nav-item__icon" aria-hidden="true">${icons.book}</span>
              <span class="nav-item__text">${t("common.docs")}</span>
            </a>
          </div>
        </div>
      </aside>
      <main class="content ${isChat ? "content--chat" : ""}">
        ${
          availableUpdate
            ? html`<div class="update-banner callout danger" role="alert">
              <strong>${t("global.updateAvailable")}</strong> v${availableUpdate.latestVersion}
              (${t("global.running")} v${availableUpdate.currentVersion}).
              <button
                class="btn btn--sm update-banner__btn"
                ?disabled=${state.updateRunning || !state.connected}
                @click=${() => runUpdate(state)}
              >${state.updateRunning ? t("global.updating") : t("global.updateNow")}</button>
            </div>`
            : nothing
        }
        ${
          state.onboarding
            ? renderSetupWizard({
                currentStep: state.wizardStep,
                totalSteps: 4,
                direction: state.wizardDirection,
                animating: state.wizardAnimating,
                saving: state.wizardSaving,
                // Model step state
                selectedPreset: state.modelsQuickAddPreset,
                selectedModelIds: state.modelsQuickAddSelectedIds,
                apiKey: state.modelsQuickAddForm.apiKey,
                presetDropdownOpen: state.wizardPresetDropdownOpen,
                modelDropdownOpen: state.wizardModelDropdownOpen,
                onPresetSelect: (presetId: string) => {
                  state.modelsQuickAddPreset = presetId;
                  state.wizardPresetDropdownOpen = false;
                  if (presetId === "__custom__") {
                    state.modelsQuickAddForm = {
                      provider: "",
                      baseUrl: "",
                      api: "openai-completions",
                      apiKey: "",
                      models: [{ id: "", name: "" }],
                    };
                    state.modelsQuickAddSelectedIds = [];
                  } else {
                    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
                    if (preset) {
                      state.modelsQuickAddForm = {
                        provider: preset.provider,
                        baseUrl: preset.baseUrl,
                        api: preset.api,
                        apiKey: state.modelsQuickAddForm.apiKey,
                        models: [],
                      };
                      const first = preset.models[0];
                      state.modelsQuickAddSelectedIds = first ? [first.id] : [];
                    }
                  }
                },
                onPresetDropdownToggle: () => {
                  state.wizardPresetDropdownOpen = !state.wizardPresetDropdownOpen;
                  if (state.wizardPresetDropdownOpen) {
                    state.wizardModelDropdownOpen = false;
                    const close = () => {
                      state.wizardPresetDropdownOpen = false;
                      document.removeEventListener("click", close);
                    };
                    requestAnimationFrame(() =>
                      document.addEventListener("click", close, { once: true }),
                    );
                  }
                },
                onModelToggle: (modelId: string) => {
                  const ids = new Set(state.modelsQuickAddSelectedIds);
                  if (ids.has(modelId)) {
                    ids.delete(modelId);
                  } else {
                    ids.add(modelId);
                  }
                  state.modelsQuickAddSelectedIds = [...ids];
                },
                onModelDropdownToggle: () => {
                  state.wizardModelDropdownOpen = !state.wizardModelDropdownOpen;
                  if (state.wizardModelDropdownOpen) {
                    state.wizardPresetDropdownOpen = false;
                    const close = () => {
                      state.wizardModelDropdownOpen = false;
                      document.removeEventListener("click", close);
                    };
                    requestAnimationFrame(() =>
                      document.addEventListener("click", close, { once: true }),
                    );
                  }
                },
                onApiKeyChange: (value: string) => {
                  state.modelsQuickAddForm = { ...state.modelsQuickAddForm, apiKey: value };
                },
                apiKeyVisible: state.wizardApiKeyVisible,
                onApiKeyVisibilityToggle: () => {
                  state.wizardApiKeyVisible = !state.wizardApiKeyVisible;
                },
                customForm: state.modelsQuickAddForm,
                onCustomFieldChange: (field: string, value: string) => {
                  state.modelsQuickAddForm = { ...state.modelsQuickAddForm, [field]: value };
                },
                onCustomModelChange: (index: number, field: string, value: string) => {
                  const models = [...state.modelsQuickAddForm.models];
                  models[index] = { ...models[index], [field]: value };
                  state.modelsQuickAddForm = { ...state.modelsQuickAddForm, models };
                },
                onCustomAddModel: () => {
                  state.modelsQuickAddForm = {
                    ...state.modelsQuickAddForm,
                    models: [...state.modelsQuickAddForm.models, { id: "", name: "" }],
                  };
                },
                onCustomRemoveModel: (index: number) => {
                  state.modelsQuickAddForm = {
                    ...state.modelsQuickAddForm,
                    models: state.modelsQuickAddForm.models.filter((_, i) => i !== index),
                  };
                },
                // Navigation
                onNext: async () => {
                  // Save model config when leaving step 2 (silently)
                  if (state.wizardStep === 2) {
                    const f = state.modelsQuickAddForm;
                    const isCustom = state.modelsQuickAddPreset === "__custom__";
                    let newModels: Array<{ id: string; name: string; input: string[] }>;
                    if (isCustom) {
                      newModels = f.models
                        .filter((m) => m.id.trim() !== "")
                        .map((m) => ({
                          id: m.id.trim(),
                          name: m.name.trim() || m.id.trim(),
                          input: m.supportsImage ? ["text", "image"] : ["text"],
                        }));
                    } else {
                      const preset = PROVIDER_PRESETS.find(
                        (p) => p.id === state.modelsQuickAddPreset,
                      );
                      const selectedIds = new Set(state.modelsQuickAddSelectedIds);
                      newModels = (preset?.models ?? [])
                        .filter((m) => selectedIds.has(m.id))
                        .map((m) => ({
                          id: m.id,
                          name: m.name,
                          input: m.supportsImage ? ["text", "image"] : ["text"],
                        }));
                    }
                    if (f.provider.trim() && f.apiKey.trim() && newModels.length > 0) {
                      try {
                        if (!(state.configSnapshot as Record<string, unknown>)?.hash) {
                          await loadConfig(state);
                        }
                        const providerObj: Record<string, unknown> = {
                          baseUrl: f.baseUrl.trim(),
                          apiKey: f.apiKey.trim(),
                          api: f.api,
                          models: newModels,
                        };
                        updateConfigFormValue(state, ["models", "mode"], "merge");
                        updateConfigFormValue(
                          state,
                          ["models", "providers", f.provider.trim()],
                          providerObj,
                        );
                        // Set the first selected model as the default agent model
                        const firstModel = `${f.provider.trim()}/${newModels[0].id}`;
                        updateConfigFormValue(state, ["agents", "defaults", "model"], firstModel);
                        // Auto-set image understanding model if a vision-capable model is selected
                        const visionModel = newModels.find((m: { id: string; input?: string[] }) =>
                          m.input?.includes("image"),
                        );
                        if (visionModel) {
                          updateConfigFormValue(
                            state,
                            ["tools", "media", "models"],
                            [{ provider: f.provider.trim(), model: visionModel.id }],
                          );
                        }
                      } catch (err) {
                        console.error("Wizard: failed to prepare model config", err);
                      }
                    }
                  }
                  state.wizardDirection = 1;
                  state.wizardAnimating = true;
                  state.wizardStep = state.wizardStep + 1;
                },
                onBack: () => {
                  state.wizardDirection = -1;
                  state.wizardAnimating = true;
                  state.wizardStep = state.wizardStep - 1;
                },
                onSkip: () => {
                  state.wizardDirection = 1;
                  state.wizardAnimating = true;
                  state.wizardStep = state.wizardStep + 1;
                },
                onComplete: async () => {
                  state.wizardSaving = true;
                  try {
                    // Ensure config snapshot is loaded (needed for hash)
                    if (!(state.configSnapshot as Record<string, unknown>)?.hash) {
                      await loadConfig(state);
                    }
                    // Only apply if we have a valid config snapshot
                    if ((state.configSnapshot as Record<string, unknown>)?.hash) {
                      await applyConfig(state);
                      // Wait for gateway restart + reconnection
                      await new Promise((r) => setTimeout(r, 2500));
                    }
                  } catch (err) {
                    console.error("Wizard: failed to save config", err);
                  } finally {
                    state.wizardSaving = false;
                  }
                  state.onboarding = false;
                  state.wizardStep = 1;
                  state.setTab("chat");
                  // Notify Desktop main process to clear onboarding flag
                  const dsk = (window as unknown as Record<string, unknown>).desktop as
                    | { onboardingDone?: () => void }
                    | undefined;
                  dsk?.onboardingDone?.();
                },
                onAnimationEnd: () => {
                  state.wizardAnimating = false;
                },
                renderChannelStep: () => {
                  const configValue = state.configForm;
                  const modelsSection = configValue?.models as Record<string, unknown> | undefined;
                  const providersObj = modelsSection?.providers as
                    | Record<string, unknown>
                    | undefined;
                  const availableModels: Array<{ value: string; label: string }> = [];
                  if (providersObj) {
                    for (const [provId, provData] of Object.entries(providersObj)) {
                      const prov = provData as Record<string, unknown>;
                      const models = prov.models as
                        | Array<{ id: string; name?: string }>
                        | undefined;
                      if (models) {
                        for (const m of models) {
                          availableModels.push({
                            value: `${provId}/${m.id}`,
                            label: `${provId}/${m.name || m.id}`,
                          });
                        }
                      }
                    }
                  }
                  const modelGroups = providersObj
                    ? Object.entries(providersObj)
                        .map(([provId, provData]) => {
                          const prov = provData as Record<string, unknown>;
                          const models =
                            (prov.models as Array<{ id: string; name?: string }>) ?? [];
                          return {
                            label: provId,
                            items: models.map((m) => ({
                              value: `${provId}/${m.id}`,
                              label: m.name || m.id,
                            })),
                          };
                        })
                        .filter((g) => g.items.length > 0)
                    : [];
                  const agentsObj = configValue?.agents as Record<string, unknown> | undefined;
                  const agentsList = (agentsObj?.list ?? []) as Array<{
                    id: string;
                    identity?: { name?: string };
                  }>;
                  const availableAgents = agentsList.map((a) => ({
                    id: a.id,
                    name: a.identity?.name ?? a.id,
                  }));
                  return renderChannelsQuickAdd({
                    form: state.channelQuickAddForm,
                    expanded: true,
                    busy: state.channelQuickAddBusy,
                    error: state.channelQuickAddError,
                    availableModels,
                    modelGroups,
                    availableAgents,
                    onToggle: () => {},
                    onChannelTypeChange: (type) => {
                      state.channelQuickAddForm = {
                        ...state.channelQuickAddForm,
                        channelType: type,
                      };
                    },
                    onFieldChange: (field, value) => {
                      state.channelQuickAddForm = { ...state.channelQuickAddForm, [field]: value };
                    },
                    agentDropdownOpen: state.chAgentDropdownOpen ?? false,
                    onAgentDropdownToggle: () => {
                      state.chAgentDropdownOpen = !state.chAgentDropdownOpen;
                      if (state.chAgentDropdownOpen) {
                        const close = () => {
                          state.chAgentDropdownOpen = false;
                          document.removeEventListener("click", close);
                        };
                        requestAnimationFrame(() =>
                          document.addEventListener("click", close, { once: true }),
                        );
                      }
                    },
                    modelDropdownOpen: state.chModelDropdownOpen ?? false,
                    modelDropdownExpandedGroups: state.chModelDropdownExpandedGroups ?? new Set(),
                    onModelDropdownToggle: () => {
                      state.chModelDropdownOpen = !state.chModelDropdownOpen;
                      if (state.chModelDropdownOpen) {
                        const close = () => {
                          state.chModelDropdownOpen = false;
                          document.removeEventListener("click", close);
                        };
                        requestAnimationFrame(() =>
                          document.addEventListener("click", close, { once: true }),
                        );
                      }
                    },
                    onModelDropdownGroupToggle: (label) => {
                      const next = new Set(state.chModelDropdownExpandedGroups ?? new Set());
                      if (next.has(label)) {
                        next.delete(label);
                      } else {
                        next.add(label);
                      }
                      state.chModelDropdownExpandedGroups = next;
                    },
                    onSubmit: () => {},
                  });
                },
              })
            : nothing
        }
        ${
          !state.onboarding
            ? html`<section class="content-header">
          <div>
            ${state.tab === "usage" ? nothing : html`<div class="page-title">${titleForTab(state.tab)}</div>`}
            ${state.tab === "usage" ? nothing : html`<div class="page-sub">${subtitleForTab(state.tab)}</div>`}
          </div>
          <div class="page-meta">
            ${state.lastError ? html`<div class="pill danger">${translateError(state.lastError)}</div>` : nothing}
            ${isChat ? renderChatControls(state) : nothing}
          </div>
        </section>`
            : nothing
        }

        ${
          state.onboarding
            ? nothing
            : html`
        ${
          state.tab === "overview"
            ? renderOverview({
                connected: state.connected,
                hello: state.hello,
                settings: state.settings,
                password: state.password,
                lastError: state.lastError,
                lastErrorCode: state.lastErrorCode,
                presenceCount,
                sessionsCount,
                cronEnabled: state.cronStatus?.enabled ?? null,
                cronNext,
                lastChannelsRefresh: state.channelsLastSuccess,
                onSettingsChange: (next) => state.applySettings(next),
                onPasswordChange: (next) => (state.password = next),
                onSessionKeyChange: (next) => {
                  state.sessionKey = next;
                  state.chatMessage = "";
                  state.resetToolStream();
                  state.applySettings({
                    ...state.settings,
                    sessionKey: next,
                    lastActiveSessionKey: next,
                  });
                  void state.loadAssistantIdentity();
                },
                onConnect: () => state.connect(),
                onRefresh: () => state.loadOverview(),
                sessionActivity: state.sessionActivity,
              })
            : nothing
        }

        ${
          state.tab === "channels"
            ? html`
                ${(() => {
                  // Build available models list from config providers
                  const providersObj = (
                    (state.configForm as Record<string, unknown>)?.models as Record<string, unknown>
                  )?.providers as Record<string, unknown> | undefined;
                  const availableModels: Array<{ value: string; label: string }> = [];
                  if (providersObj) {
                    for (const [provId, provData] of Object.entries(providersObj)) {
                      const prov = provData as Record<string, unknown>;
                      const models = prov.models as
                        | Array<{ id: string; name?: string }>
                        | undefined;
                      if (models) {
                        for (const m of models) {
                          availableModels.push({
                            value: `${provId}/${m.id}`,
                            label: `${provId}/${m.name || m.id}`,
                          });
                        }
                      }
                    }
                  }
                  // Build grouped models for dropdown
                  const modelGroups = providersObj
                    ? Object.entries(providersObj)
                        .map(([provId, provData]) => {
                          const prov = provData as Record<string, unknown>;
                          const models =
                            (prov.models as Array<{ id: string; name?: string }>) ?? [];
                          return {
                            label: provId,
                            items: models.map((m) => ({
                              value: `${provId}/${m.id}`,
                              label: m.name || m.id,
                            })),
                          };
                        })
                        .filter((g) => g.items.length > 0)
                    : [];
                  // Build available agents list
                  const agentsObj = (state.configForm as Record<string, unknown>)?.agents as
                    | Record<string, unknown>
                    | undefined;
                  const agentsList = (agentsObj?.list ?? []) as Array<{
                    id: string;
                    identity?: { name?: string };
                  }>;
                  const availableAgents = agentsList.map((a) => ({
                    id: a.id,
                    name: a.identity?.name ?? a.id,
                  }));
                  return renderChannelsQuickAdd({
                    form: state.channelQuickAddForm,
                    expanded: state.channelQuickAddExpanded,
                    busy: state.channelQuickAddBusy,
                    error: state.channelQuickAddError,
                    availableModels,
                    modelGroups,
                    availableAgents,
                    onToggle: () => {
                      state.channelQuickAddExpanded = !state.channelQuickAddExpanded;
                    },
                    onChannelTypeChange: (type) => {
                      state.channelQuickAddForm = {
                        ...state.channelQuickAddForm,
                        channelType: type,
                      };
                    },
                    onFieldChange: (field, value) => {
                      state.channelQuickAddForm = { ...state.channelQuickAddForm, [field]: value };
                    },
                    agentDropdownOpen: state.chAgentDropdownOpen ?? false,
                    onAgentDropdownToggle: () => {
                      state.chAgentDropdownOpen = !state.chAgentDropdownOpen;
                      if (state.chAgentDropdownOpen) {
                        const close = () => {
                          state.chAgentDropdownOpen = false;
                          document.removeEventListener("click", close);
                        };
                        requestAnimationFrame(() =>
                          document.addEventListener("click", close, { once: true }),
                        );
                      }
                    },
                    modelDropdownOpen: state.chModelDropdownOpen ?? false,
                    modelDropdownExpandedGroups: state.chModelDropdownExpandedGroups ?? new Set(),
                    onModelDropdownToggle: () => {
                      state.chModelDropdownOpen = !state.chModelDropdownOpen;
                      if (state.chModelDropdownOpen) {
                        const close = () => {
                          state.chModelDropdownOpen = false;
                          document.removeEventListener("click", close);
                        };
                        requestAnimationFrame(() =>
                          document.addEventListener("click", close, { once: true }),
                        );
                      }
                    },
                    onModelDropdownGroupToggle: (label) => {
                      const next = new Set(state.chModelDropdownExpandedGroups ?? new Set());
                      if (next.has(label)) {
                        next.delete(label);
                      } else {
                        next.add(label);
                      }
                      state.chModelDropdownExpandedGroups = next;
                    },
                    onSubmit: async () => {
                      const f = state.channelQuickAddForm;
                      state.channelQuickAddBusy = true;
                      state.channelQuickAddError = null;
                      try {
                        const channel = f.channelType;
                        const accountId = f.accountId.trim();

                        // 1. Write channel account config
                        if (channel === "telegram") {
                          const accountObj: Record<string, unknown> = {
                            dmPolicy: "pairing",
                            botToken: f.botToken.trim(),
                            groupPolicy: "allowlist",
                            streaming: "off",
                          };
                          updateConfigFormValue(state, ["channels", "telegram", "enabled"], true);
                          updateConfigFormValue(
                            state,
                            ["channels", "telegram", "accounts", accountId],
                            accountObj,
                          );
                        } else {
                          const accountObj: Record<string, unknown> = {
                            appId: f.appId.trim(),
                            appSecret: f.appSecret.trim(),
                            botName: f.botName.trim() || accountId,
                          };
                          updateConfigFormValue(state, ["channels", "feishu", "enabled"], true);
                          updateConfigFormValue(
                            state,
                            ["channels", "feishu", "accounts", accountId],
                            accountObj,
                          );
                        }

                        // 2. Create agent if needed
                        const agentIdToUse = f.createAgent ? f.agentId || accountId : "";
                        if (f.createAgent && f.agentId === "") {
                          // New agent — save avatar as file if it's a data URI
                          let avatarValue: string = f.agentEmoji;
                          const isDataUri = /^data:image\//i.test(f.agentEmoji);
                          if (isDataUri && state.client) {
                            try {
                              const res = await state.client.request("agent.avatar.save", {
                                agentId: accountId,
                                dataUri: f.agentEmoji,
                              });
                              const saved = res as { path?: string } | null;
                              if (saved?.path) {
                                avatarValue = saved.path;
                              }
                            } catch {
                              // Fallback: keep data URI if save fails
                            }
                          }

                          const newAgent: Record<string, unknown> = {
                            id: accountId,
                            identity: {
                              name: f.agentName.trim() || accountId,
                              avatar: avatarValue,
                            },
                          };
                          if (f.agentModel) {
                            newAgent.model = { primary: f.agentModel };
                          }
                          const currentAgents = ((
                            (state.configForm as Record<string, unknown>)?.agents as Record<
                              string,
                              unknown
                            >
                          )?.list ?? []) as unknown[];
                          updateConfigFormValue(
                            state,
                            ["agents", "list"],
                            [...currentAgents, newAgent],
                          );
                        }

                        // 3. Create binding
                        if (f.createAgent && agentIdToUse) {
                          const newBinding = {
                            agentId: agentIdToUse,
                            match: { channel, accountId },
                          };
                          const currentBindings = ((state.configForm as Record<string, unknown>)
                            ?.bindings ?? []) as unknown[];
                          updateConfigFormValue(
                            state,
                            ["bindings"],
                            [...currentBindings, newBinding],
                          );
                        }

                        // Save
                        await saveConfig(state);
                        await applyConfig(state);

                        // Reset form
                        state.channelQuickAddForm = {
                          channelType: f.channelType,
                          accountId: "",
                          botToken: "",
                          appId: "",
                          appSecret: "",
                          botName: "",
                          createAgent: true,
                          agentId: "",
                          agentName: "",
                          agentEmoji: "🤖",
                          agentModel: "",
                        };
                        state.channelQuickAddExpanded = false;
                      } catch (err) {
                        state.channelQuickAddError = String(err);
                      } finally {
                        state.channelQuickAddBusy = false;
                      }
                    },
                  });
                })()}
                ${renderChannelPairings({
                  channelPairingsLoading: state.channelPairingsLoading,
                  channelPairings: state.channelPairings,
                  channelPairingsError: state.channelPairingsError,
                  onChannelPairingsRefresh: () => loadChannelPairings(state),
                  onChannelPairingApprove: (channel: string, code: string) =>
                    approveChannelPairing(state, channel, code),
                })}
                ${renderChannels({
                  connected: state.connected,
                  loading: state.channelsLoading,
                  snapshot: state.channelsSnapshot,
                  lastError: state.channelsError,
                  lastSuccessAt: state.channelsLastSuccess,
                  whatsappMessage: state.whatsappLoginMessage,
                  whatsappQrDataUrl: state.whatsappLoginQrDataUrl,
                  whatsappConnected: state.whatsappLoginConnected,
                  whatsappBusy: state.whatsappBusy,
                  configSchema: state.configSchema,
                  configSchemaLoading: state.configSchemaLoading,
                  configForm: state.configForm,
                  configUiHints: state.configUiHints,
                  configSaving: state.configSaving,
                  configFormDirty: state.configFormDirty,
                  nostrProfileFormState: state.nostrProfileFormState,
                  nostrProfileAccountId: state.nostrProfileAccountId,
                  onRefresh: (probe) => loadChannels(state, probe),
                  onWhatsAppStart: (force) => state.handleWhatsAppStart(force),
                  onWhatsAppWait: () => state.handleWhatsAppWait(),
                  onWhatsAppLogout: () => state.handleWhatsAppLogout(),
                  onConfigPatch: (path, value) => updateConfigFormValue(state, path, value),
                  onConfigSave: () => state.handleChannelConfigSave(),
                  onConfigReload: () => state.handleChannelConfigReload(),
                  onNostrProfileEdit: (accountId, profile) =>
                    state.handleNostrProfileEdit(accountId, profile),
                  onNostrProfileCancel: () => state.handleNostrProfileCancel(),
                  onNostrProfileFieldChange: (field, value) =>
                    state.handleNostrProfileFieldChange(field, value),
                  onNostrProfileSave: () => state.handleNostrProfileSave(),
                  onNostrProfileImport: () => state.handleNostrProfileImport(),
                  onNostrProfileToggleAdvanced: () => state.handleNostrProfileToggleAdvanced(),
                })}`
            : nothing
        }

        ${
          state.tab === "instances"
            ? renderInstances({
                loading: state.presenceLoading,
                entries: state.presenceEntries,
                lastError: state.presenceError,
                statusMessage: state.presenceStatus,
                onRefresh: () => loadPresence(state),
              })
            : nothing
        }

        ${
          state.tab === "sessions"
            ? renderSessions({
                loading: state.sessionsLoading,
                result: state.sessionsResult,
                error: state.sessionsError,
                activeMinutes: state.sessionsFilterActive,
                limit: state.sessionsFilterLimit,
                includeGlobal: state.sessionsIncludeGlobal,
                includeUnknown: state.sessionsIncludeUnknown,
                basePath: state.basePath,
                onFiltersChange: (next) => {
                  state.sessionsFilterActive = next.activeMinutes;
                  state.sessionsFilterLimit = next.limit;
                  state.sessionsIncludeGlobal = next.includeGlobal;
                  state.sessionsIncludeUnknown = next.includeUnknown;
                },
                onRefresh: () => loadSessions(state),
                onPatch: (key, patch) => patchSession(state, key, patch),
                onDelete: (key) => deleteSessionAndRefresh(state, key),
              })
            : nothing
        }

        ${renderUsageTab(state)}

        ${
          state.tab === "cron"
            ? renderCron({
                basePath: state.basePath,
                loading: state.cronLoading,
                jobsLoadingMore: state.cronJobsLoadingMore,
                status: state.cronStatus,
                jobs: visibleCronJobs,
                jobsTotal: state.cronJobsTotal,
                jobsHasMore: state.cronJobsHasMore,
                jobsQuery: state.cronJobsQuery,
                jobsEnabledFilter: state.cronJobsEnabledFilter,
                jobsScheduleKindFilter: state.cronJobsScheduleKindFilter,
                jobsLastStatusFilter: state.cronJobsLastStatusFilter,
                jobsSortBy: state.cronJobsSortBy,
                jobsSortDir: state.cronJobsSortDir,
                error: state.cronError,
                busy: state.cronBusy,
                form: state.cronForm,
                fieldErrors: state.cronFieldErrors,
                canSubmit: !hasCronFormErrors(state.cronFieldErrors),
                editingJobId: state.cronEditingJobId,
                channels: state.channelsSnapshot?.channelMeta?.length
                  ? state.channelsSnapshot.channelMeta.map((entry) => entry.id)
                  : (state.channelsSnapshot?.channelOrder ?? []),
                channelLabels: state.channelsSnapshot?.channelLabels ?? {},
                channelMeta: state.channelsSnapshot?.channelMeta ?? [],
                runsJobId: state.cronRunsJobId,
                runs: state.cronRuns,
                runsTotal: state.cronRunsTotal,
                runsHasMore: state.cronRunsHasMore,
                runsLoadingMore: state.cronRunsLoadingMore,
                runsScope: state.cronRunsScope,
                runsStatuses: state.cronRunsStatuses,
                runsDeliveryStatuses: state.cronRunsDeliveryStatuses,
                runsStatusFilter: state.cronRunsStatusFilter,
                runsQuery: state.cronRunsQuery,
                runsSortDir: state.cronRunsSortDir,
                agentSuggestions: cronAgentSuggestions,
                modelSuggestions: cronModelSuggestions,
                thinkingSuggestions: CRON_THINKING_SUGGESTIONS,
                timezoneSuggestions: CRON_TIMEZONE_SUGGESTIONS,
                deliveryToSuggestions,
                accountSuggestions,
                onFormChange: (patch) => {
                  state.cronForm = normalizeCronFormState({ ...state.cronForm, ...patch });
                  state.cronFieldErrors = validateCronForm(state.cronForm);
                },
                onRefresh: () => state.loadCron(),
                onAdd: () => addCronJob(state),
                onEdit: (job) => startCronEdit(state, job),
                onClone: (job) => startCronClone(state, job),
                onCancelEdit: () => cancelCronEdit(state),
                onToggle: (job, enabled) => toggleCronJob(state, job, enabled),
                onRun: (job, mode) => runCronJob(state, job, mode ?? "force"),
                onRemove: (job) => removeCronJob(state, job),
                onLoadRuns: async (jobId) => {
                  updateCronRunsFilter(state, { cronRunsScope: "job" });
                  await loadCronRuns(state, jobId);
                },
                onLoadMoreJobs: () => loadMoreCronJobs(state),
                onJobsFiltersChange: async (patch) => {
                  updateCronJobsFilter(state, patch);
                  const shouldReload =
                    typeof patch.cronJobsQuery === "string" ||
                    Boolean(patch.cronJobsEnabledFilter) ||
                    Boolean(patch.cronJobsSortBy) ||
                    Boolean(patch.cronJobsSortDir);
                  if (shouldReload) {
                    await reloadCronJobs(state);
                  }
                },
                onJobsFiltersReset: async () => {
                  updateCronJobsFilter(state, {
                    cronJobsQuery: "",
                    cronJobsEnabledFilter: "all",
                    cronJobsScheduleKindFilter: "all",
                    cronJobsLastStatusFilter: "all",
                    cronJobsSortBy: "nextRunAtMs",
                    cronJobsSortDir: "asc",
                  });
                  await reloadCronJobs(state);
                },
                onLoadMoreRuns: () => loadMoreCronRuns(state),
                onRunsFiltersChange: async (patch) => {
                  updateCronRunsFilter(state, patch);
                  if (state.cronRunsScope === "all") {
                    await loadCronRuns(state, null);
                    return;
                  }
                  await loadCronRuns(state, state.cronRunsJobId);
                },
              })
            : nothing
        }

        ${
          state.tab === "agents"
            ? renderAgents({
                loading: state.agentsLoading,
                error: state.agentsError,
                agentsList: state.agentsList,
                selectedAgentId: resolvedAgentId,
                activePanel: state.agentsPanel,
                configForm: configValue,
                configLoading: state.configLoading,
                configSaving: state.configSaving,
                configDirty: state.configFormDirty,
                channelsLoading: state.channelsLoading,
                channelsError: state.channelsError,
                channelsSnapshot: state.channelsSnapshot,
                channelsLastSuccess: state.channelsLastSuccess,
                cronLoading: state.cronLoading,
                cronStatus: state.cronStatus,
                cronJobs: state.cronJobs,
                cronError: state.cronError,
                agentFilesLoading: state.agentFilesLoading,
                agentFilesError: state.agentFilesError,
                agentFilesList: state.agentFilesList,
                agentFileActive: state.agentFileActive,
                agentFileContents: state.agentFileContents,
                agentFileDrafts: state.agentFileDrafts,
                agentFileSaving: state.agentFileSaving,
                agentIdentityLoading: state.agentIdentityLoading,
                agentIdentityError: state.agentIdentityError,
                agentIdentityById: state.agentIdentityById,
                agentSkillsLoading: state.agentSkillsLoading,
                agentSkillsReport: state.agentSkillsReport,
                agentSkillsError: state.agentSkillsError,
                agentSkillsAgentId: state.agentSkillsAgentId,
                toolsCatalogLoading: state.toolsCatalogLoading,
                toolsCatalogError: state.toolsCatalogError,
                toolsCatalogResult: state.toolsCatalogResult,
                skillsFilter: state.skillsFilter,
                modelDropdownOpen: state.modelDropdownOpen,
                modelDropdownExpandedGroups: state.modelDropdownExpandedGroups,
                onRefresh: async () => {
                  await loadAgents(state);
                  const nextSelected =
                    state.agentsSelectedId ??
                    state.agentsList?.defaultId ??
                    state.agentsList?.agents?.[0]?.id ??
                    null;
                  await loadToolsCatalog(state, nextSelected);
                  const agentIds = state.agentsList?.agents?.map((entry) => entry.id) ?? [];
                  if (agentIds.length > 0) {
                    void loadAgentIdentities(state, agentIds);
                  }
                },
                onSelectAgent: (agentId) => {
                  if (state.agentsSelectedId === agentId) {
                    return;
                  }
                  state.agentsSelectedId = agentId;
                  state.agentFilesList = null;
                  state.agentFilesError = null;
                  state.agentFilesLoading = false;
                  state.agentFileActive = null;
                  state.agentFileContents = {};
                  state.agentFileDrafts = {};
                  state.agentSkillsReport = null;
                  state.agentSkillsError = null;
                  state.agentSkillsAgentId = null;
                  void loadAgentIdentity(state, agentId);
                  if (state.agentsPanel === "tools") {
                    void loadToolsCatalog(state, agentId);
                  }
                  if (state.agentsPanel === "files") {
                    void loadAgentFiles(state, agentId);
                  }
                  if (state.agentsPanel === "skills") {
                    void loadAgentSkills(state, agentId);
                  }
                },
                onSelectPanel: (panel) => {
                  state.agentsPanel = panel;
                  if (panel === "files" && resolvedAgentId) {
                    if (state.agentFilesList?.agentId !== resolvedAgentId) {
                      state.agentFilesList = null;
                      state.agentFilesError = null;
                      state.agentFileActive = null;
                      state.agentFileContents = {};
                      state.agentFileDrafts = {};
                      void loadAgentFiles(state, resolvedAgentId);
                    }
                  }
                  if (panel === "tools") {
                    void loadToolsCatalog(state, resolvedAgentId);
                  }
                  if (panel === "skills") {
                    if (resolvedAgentId) {
                      void loadAgentSkills(state, resolvedAgentId);
                    }
                  }
                  if (panel === "channels") {
                    void loadChannels(state, false);
                  }
                  if (panel === "cron") {
                    void state.loadCron();
                  }
                },
                onLoadFiles: (agentId) => loadAgentFiles(state, agentId),
                onSelectFile: (name) => {
                  state.agentFileActive = name;
                  if (!resolvedAgentId) {
                    return;
                  }
                  void loadAgentFileContent(state, resolvedAgentId, name);
                },
                onFileDraftChange: (name, content) => {
                  state.agentFileDrafts = { ...state.agentFileDrafts, [name]: content };
                },
                onFileReset: (name) => {
                  const base = state.agentFileContents[name] ?? "";
                  state.agentFileDrafts = { ...state.agentFileDrafts, [name]: base };
                },
                onFileSave: (name) => {
                  if (!resolvedAgentId) {
                    return;
                  }
                  const content =
                    state.agentFileDrafts[name] ?? state.agentFileContents[name] ?? "";
                  void saveAgentFile(state, resolvedAgentId, name, content);
                },
                onToolsProfileChange: (agentId, profile, clearAllow) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "tools"];
                  if (profile) {
                    updateConfigFormValue(state, [...basePath, "profile"], profile);
                  } else {
                    removeConfigFormValue(state, [...basePath, "profile"]);
                  }
                  if (clearAllow) {
                    removeConfigFormValue(state, [...basePath, "allow"]);
                  }
                },
                onToolsOverridesChange: (agentId, alsoAllow, deny) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "tools"];
                  if (alsoAllow.length > 0) {
                    updateConfigFormValue(state, [...basePath, "alsoAllow"], alsoAllow);
                  } else {
                    removeConfigFormValue(state, [...basePath, "alsoAllow"]);
                  }
                  if (deny.length > 0) {
                    updateConfigFormValue(state, [...basePath, "deny"], deny);
                  } else {
                    removeConfigFormValue(state, [...basePath, "deny"]);
                  }
                },
                onConfigReload: () => loadConfig(state),
                onConfigSave: () => saveConfig(state),
                onChannelsRefresh: () => loadChannels(state, false),
                onCronRefresh: () => state.loadCron(),
                onSkillsFilterChange: (next) => (state.skillsFilter = next),
                onSkillsRefresh: () => {
                  if (resolvedAgentId) {
                    void loadAgentSkills(state, resolvedAgentId);
                  }
                },
                onAgentSkillToggle: (agentId, skillName, enabled) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const entry = list[index] as { skills?: unknown };
                  const normalizedSkill = skillName.trim();
                  if (!normalizedSkill) {
                    return;
                  }
                  const allSkills =
                    state.agentSkillsReport?.skills?.map((skill) => skill.name).filter(Boolean) ??
                    [];
                  const existing = Array.isArray(entry.skills)
                    ? entry.skills.map((name) => String(name).trim()).filter(Boolean)
                    : undefined;
                  const base = existing ?? allSkills;
                  const next = new Set(base);
                  if (enabled) {
                    next.add(normalizedSkill);
                  } else {
                    next.delete(normalizedSkill);
                  }
                  updateConfigFormValue(state, ["agents", "list", index, "skills"], [...next]);
                },
                onAgentSkillsClear: (agentId) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  removeConfigFormValue(state, ["agents", "list", index, "skills"]);
                },
                onAgentSkillsDisableAll: (agentId) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  updateConfigFormValue(state, ["agents", "list", index, "skills"], []);
                },
                onModelChange: (agentId, modelId) => {
                  state.modelDropdownOpen = false;
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "model"];
                  if (!modelId) {
                    removeConfigFormValue(state, basePath);
                    return;
                  }
                  const entry = list[index] as { model?: unknown };
                  const existing = entry?.model;
                  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
                    const fallbacks = (existing as { fallbacks?: unknown }).fallbacks;
                    const next = {
                      primary: modelId,
                      ...(Array.isArray(fallbacks) ? { fallbacks } : {}),
                    };
                    updateConfigFormValue(state, basePath, next);
                  } else {
                    updateConfigFormValue(state, basePath, modelId);
                  }
                },
                onModelFallbacksChange: (agentId, fallbacks) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "model"];
                  const entry = list[index] as { model?: unknown };
                  const normalized = fallbacks.map((name) => name.trim()).filter(Boolean);
                  const existing = entry.model;
                  const resolvePrimary = () => {
                    if (typeof existing === "string") {
                      return existing.trim() || null;
                    }
                    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
                      const primary = (existing as { primary?: unknown }).primary;
                      if (typeof primary === "string") {
                        const trimmed = primary.trim();
                        return trimmed || null;
                      }
                    }
                    return null;
                  };
                  const primary = resolvePrimary();
                  if (normalized.length === 0) {
                    if (primary) {
                      updateConfigFormValue(state, basePath, primary);
                    } else {
                      removeConfigFormValue(state, basePath);
                    }
                    return;
                  }
                  const next = primary
                    ? { primary, fallbacks: normalized }
                    : { fallbacks: normalized };
                  updateConfigFormValue(state, basePath, next);
                },
                onModelDropdownToggle: () => {
                  state.modelDropdownOpen = !state.modelDropdownOpen;
                  if (state.modelDropdownOpen) {
                    const close = () => {
                      state.modelDropdownOpen = false;
                      document.removeEventListener("click", close);
                    };
                    requestAnimationFrame(() =>
                      document.addEventListener("click", close, { once: true }),
                    );
                  }
                },
                onModelDropdownGroupToggle: (label) => {
                  const next = new Set(state.modelDropdownExpandedGroups);
                  if (next.has(label)) {
                    next.delete(label);
                  } else {
                    next.add(label);
                  }
                  state.modelDropdownExpandedGroups = next;
                },
                fallbackDropdownOpen: state.fallbackDropdownOpen,
                fallbackDropdownExpandedGroups: state.fallbackDropdownExpandedGroups,
                onFallbackDropdownToggle: () => {
                  state.fallbackDropdownOpen = !state.fallbackDropdownOpen;
                  if (state.fallbackDropdownOpen) {
                    const close = () => {
                      state.fallbackDropdownOpen = false;
                      document.removeEventListener("click", close);
                    };
                    requestAnimationFrame(() =>
                      document.addEventListener("click", close, { once: true }),
                    );
                  }
                },
                onFallbackDropdownGroupToggle: (label) => {
                  const next = new Set(state.fallbackDropdownExpandedGroups);
                  if (next.has(label)) {
                    next.delete(label);
                  } else {
                    next.add(label);
                  }
                  state.fallbackDropdownExpandedGroups = next;
                },
              })
            : nothing
        }

        ${
          state.tab === "skills"
            ? renderSkills({
                loading: state.skillsLoading,
                report: state.skillsReport,
                error: state.skillsError,
                filter: state.skillsFilter,
                edits: state.skillEdits,
                messages: state.skillMessages,
                busyKey: state.skillsBusyKey,
                onFilterChange: (next) => (state.skillsFilter = next),
                onRefresh: () => loadSkills(state, { clearMessages: true }),
                onToggle: (key, enabled) => updateSkillEnabled(state, key, enabled),
                onEdit: (key, value) => updateSkillEdit(state, key, value),
                onSaveKey: (key) => saveSkillApiKey(state, key),
                onInstall: (skillKey, name, installId) =>
                  installSkill(state, skillKey, name, installId),
              })
            : nothing
        }

        ${
          state.tab === "nodes"
            ? renderNodes({
                loading: state.nodesLoading,
                nodes: state.nodes,
                devicesLoading: state.devicesLoading,
                devicesError: state.devicesError,
                devicesList: state.devicesList,
                configForm:
                  state.configForm ??
                  (state.configSnapshot?.config as Record<string, unknown> | null),
                configLoading: state.configLoading,
                configSaving: state.configSaving,
                configDirty: state.configFormDirty,
                configFormMode: state.configFormMode,
                execApprovalsLoading: state.execApprovalsLoading,
                execApprovalsSaving: state.execApprovalsSaving,
                execApprovalsDirty: state.execApprovalsDirty,
                execApprovalsSnapshot: state.execApprovalsSnapshot,
                execApprovalsForm: state.execApprovalsForm,
                execApprovalsSelectedAgent: state.execApprovalsSelectedAgent,
                execApprovalsTarget: state.execApprovalsTarget,
                execApprovalsTargetNodeId: state.execApprovalsTargetNodeId,
                onRefresh: () => loadNodes(state),
                onDevicesRefresh: () => loadDevices(state),
                onDeviceApprove: (requestId) => approveDevicePairing(state, requestId),
                onDeviceReject: (requestId) => rejectDevicePairing(state, requestId),
                onDeviceRotate: (deviceId, role, scopes) =>
                  rotateDeviceToken(state, { deviceId, role, scopes }),
                onDeviceRevoke: (deviceId, role) => revokeDeviceToken(state, { deviceId, role }),
                onLoadConfig: () => loadConfig(state),
                onLoadExecApprovals: () => {
                  const target =
                    state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
                      ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
                      : { kind: "gateway" as const };
                  return loadExecApprovals(state, target);
                },
                onBindDefault: (nodeId) => {
                  if (nodeId) {
                    updateConfigFormValue(state, ["tools", "exec", "node"], nodeId);
                  } else {
                    removeConfigFormValue(state, ["tools", "exec", "node"]);
                  }
                },
                onBindAgent: (agentIndex, nodeId) => {
                  const basePath = ["agents", "list", agentIndex, "tools", "exec", "node"];
                  if (nodeId) {
                    updateConfigFormValue(state, basePath, nodeId);
                  } else {
                    removeConfigFormValue(state, basePath);
                  }
                },
                onSaveBindings: () => saveConfig(state),
                onExecApprovalsTargetChange: (kind, nodeId) => {
                  state.execApprovalsTarget = kind;
                  state.execApprovalsTargetNodeId = nodeId;
                  state.execApprovalsSnapshot = null;
                  state.execApprovalsForm = null;
                  state.execApprovalsDirty = false;
                  state.execApprovalsSelectedAgent = null;
                },
                onExecApprovalsSelectAgent: (agentId) => {
                  state.execApprovalsSelectedAgent = agentId;
                },
                onExecApprovalsPatch: (path, value) =>
                  updateExecApprovalsFormValue(state, path, value),
                onExecApprovalsRemove: (path) => removeExecApprovalsFormValue(state, path),
                onSaveExecApprovals: () => {
                  const target =
                    state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
                      ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
                      : { kind: "gateway" as const };
                  return saveExecApprovals(state, target);
                },
              })
            : nothing
        }

        ${
          state.tab === "chat"
            ? renderChat({
                sessionKey: state.sessionKey,
                onSessionKeyChange: (next) => {
                  state.sessionKey = next;
                  state.chatMessage = "";
                  state.chatAttachments = [];
                  state.chatStream = null;
                  state.chatStreamStartedAt = null;
                  state.chatRunId = null;
                  state.chatQueue = [];
                  state.resetToolStream();
                  state.resetChatScroll();
                  state.applySettings({
                    ...state.settings,
                    sessionKey: next,
                    lastActiveSessionKey: next,
                  });
                  void state.loadAssistantIdentity();
                  void loadChatHistory(state);
                  void refreshChatAvatar(state);
                },
                thinkingLevel: state.chatThinkingLevel,
                showThinking,
                loading: state.chatLoading,
                sending: state.chatSending,
                compactionStatus: state.compactionStatus,
                fallbackStatus: state.fallbackStatus,
                assistantAvatarUrl: chatAvatarUrl,
                messages: state.chatMessages,
                toolMessages: state.chatToolMessages,
                stream: state.chatStream,
                streamStartedAt: state.chatStreamStartedAt,
                draft: state.chatMessage,
                queue: state.chatQueue,
                connected: state.connected,
                canSend: state.connected,
                disabledReason: chatDisabledReason,
                error: state.lastError,
                sessions: state.sessionsResult,
                focusMode: chatFocus,
                onRefresh: () => {
                  state.resetToolStream();
                  return Promise.all([loadChatHistory(state), refreshChatAvatar(state)]);
                },
                onToggleFocusMode: () => {
                  if (state.onboarding) {
                    return;
                  }
                  state.applySettings({
                    ...state.settings,
                    chatFocusMode: !state.settings.chatFocusMode,
                  });
                },
                onChatScroll: (event) => state.handleChatScroll(event),
                onDraftChange: (next) => (state.chatMessage = next),
                attachments: state.chatAttachments,
                onAttachmentsChange: (next) => (state.chatAttachments = next),
                onSend: () => state.handleSendChat(),
                canAbort: Boolean(state.chatRunId),
                onAbort: () => void state.handleAbortChat(),
                onQueueRemove: (id) => state.removeQueuedMessage(id),
                onNewSession: () => {
                  const newKey = `web:${Date.now()}`;
                  state.sessionKey = newKey;
                  state.chatMessage = "";
                  state.chatStream = null;
                  state.chatRunId = null;
                  state.chatMessages = [];
                  state.chatToolMessages = [];
                  state.applySettings({
                    ...state.settings,
                    sessionKey: newKey,
                    lastActiveSessionKey: newKey,
                  });
                  void state.loadAssistantIdentity();
                  syncUrlWithSessionKey(
                    state as unknown as Parameters<typeof syncUrlWithSessionKey>[0],
                    newKey,
                    true,
                  );
                },
                showNewMessages: state.chatNewMessagesBelow && !state.chatManualRefreshInFlight,
                onScrollToBottom: () => state.scrollToBottom(),
                // Sidebar props for tool output viewing
                sidebarOpen: state.sidebarOpen,
                sidebarContent: state.sidebarContent,
                sidebarError: state.sidebarError,
                splitRatio: state.splitRatio,
                onOpenSidebar: (content: string) => state.handleOpenSidebar(content),
                onCloseSidebar: () => state.handleCloseSidebar(),
                onSplitRatioChange: (ratio: number) => state.handleSplitRatioChange(ratio),
                assistantName: state.assistantName,
                assistantAvatar: state.assistantAvatar,
              })
            : nothing
        }

        ${
          state.tab === "config"
            ? renderConfig({
                raw: state.configRaw,
                originalRaw: state.configRawOriginal,
                valid: state.configValid,
                issues: state.configIssues,
                loading: state.configLoading,
                saving: state.configSaving,
                applying: state.configApplying,
                updating: state.updateRunning,
                connected: state.connected,
                schema: state.configSchema,
                schemaLoading: state.configSchemaLoading,
                uiHints: state.configUiHints,
                formMode: state.configFormMode,
                configRawLoading: state.configRawLoading,
                formValue: state.configForm,
                originalValue: state.configFormOriginal,
                searchQuery: state.configSearchQuery,
                activeSection: state.configActiveSection,
                activeSubsection: state.configActiveSubsection,
                onRawChange: (next) => {
                  state.configRaw = next;
                },
                onFormModeChange: (mode) => (state.configFormMode = mode),
                onLoadRaw: () => void loadConfigRaw(state),
                onFormPatch: (path, value) => updateConfigFormValue(state, path, value),
                onSearchChange: (query) => (state.configSearchQuery = query),
                onSectionChange: (section) => {
                  state.configActiveSection = section;
                  state.configActiveSubsection = null;
                },
                onSubsectionChange: (section) => (state.configActiveSubsection = section),
                onReload: () => loadConfig(state),
                onSave: () => saveConfig(state),
                onApply: () => applyConfig(state),
                onUpdate: () => runUpdate(state),
              })
            : nothing
        }

        ${
          state.tab === "models"
            ? html`
                <div class="models-page">
                  ${renderModelsQuickAdd({
                    form: state.modelsQuickAddForm,
                    busy: state.modelsQuickAddBusy,
                    error: state.modelsQuickAddError,
                    selectedPreset: state.modelsQuickAddPreset,
                    selectedModelIds: new Set(state.modelsQuickAddSelectedIds),
                    onPresetChange: (presetId: string) => {
                      state.modelsQuickAddPreset = presetId;
                      if (presetId === "") {
                        state.modelsQuickAddForm = {
                          provider: "",
                          baseUrl: "",
                          api: "openai-completions",
                          apiKey: "",
                          models: [{ id: "", name: "" }],
                        };
                        state.modelsQuickAddSelectedIds = [];
                      } else {
                        const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
                        if (preset) {
                          state.modelsQuickAddForm = {
                            provider: preset.provider,
                            baseUrl: preset.baseUrl,
                            api: preset.api,
                            apiKey: state.modelsQuickAddForm.apiKey,
                            models: [],
                          };
                          // Auto-select first (recommended) model
                          const first = preset.models[0];
                          state.modelsQuickAddSelectedIds = first ? [first.id] : [];
                        }
                      }
                    },
                    onPresetModelToggle: (modelId: string) => {
                      const ids = new Set(state.modelsQuickAddSelectedIds);
                      if (ids.has(modelId)) {
                        ids.delete(modelId);
                      } else {
                        ids.add(modelId);
                      }
                      state.modelsQuickAddSelectedIds = [...ids];
                    },
                    onPresetSelectAll: () => {
                      const preset = PROVIDER_PRESETS.find(
                        (p) => p.id === state.modelsQuickAddPreset,
                      );
                      if (!preset) {
                        return;
                      }
                      if (state.modelsQuickAddSelectedIds.length === preset.models.length) {
                        state.modelsQuickAddSelectedIds = [];
                      } else {
                        state.modelsQuickAddSelectedIds = preset.models.map((m) => m.id);
                      }
                    },
                    onFieldChange: (field, value) => {
                      state.modelsQuickAddForm = { ...state.modelsQuickAddForm, [field]: value };
                    },
                    onModelChange: (index, field, value) => {
                      const models = [...state.modelsQuickAddForm.models];
                      models[index] = { ...models[index], [field]: value };
                      state.modelsQuickAddForm = { ...state.modelsQuickAddForm, models };
                    },
                    onAddModel: () => {
                      state.modelsQuickAddForm = {
                        ...state.modelsQuickAddForm,
                        models: [...state.modelsQuickAddForm.models, { id: "", name: "" }],
                      };
                    },
                    onRemoveModel: (index) => {
                      const models = state.modelsQuickAddForm.models.filter((_, i) => i !== index);
                      state.modelsQuickAddForm = { ...state.modelsQuickAddForm, models };
                    },
                    onSubmit: async () => {
                      const f = state.modelsQuickAddForm;
                      const isCustom = state.modelsQuickAddPreset === "";
                      // Build models from preset selection or manual input
                      let newModels: Array<{ id: string; name: string; input: string[] }>;
                      if (isCustom) {
                        newModels = f.models
                          .filter((m) => m.id.trim() !== "")
                          .map((m) => ({
                            id: m.id.trim(),
                            name: m.name.trim() || m.id.trim(),
                            input: m.supportsImage ? ["text", "image"] : ["text"],
                          }));
                      } else {
                        const preset = PROVIDER_PRESETS.find(
                          (p) => p.id === state.modelsQuickAddPreset,
                        );
                        const selectedIds = new Set(state.modelsQuickAddSelectedIds);
                        newModels = (preset?.models ?? [])
                          .filter((m) => selectedIds.has(m.id))
                          .map((m) => ({
                            id: m.id,
                            name: m.name,
                            input: m.supportsImage ? ["text", "image"] : ["text"],
                          }));
                      }
                      if (
                        !f.provider.trim() ||
                        !f.baseUrl.trim() ||
                        !f.api.trim() ||
                        !f.apiKey.trim() ||
                        newModels.length === 0
                      ) {
                        state.modelsQuickAddError = t("modelsQuickAdd.errorMissing");
                        return;
                      }
                      state.modelsQuickAddBusy = true;
                      state.modelsQuickAddError = null;
                      try {
                        const providerObj: Record<string, unknown> = {
                          baseUrl: f.baseUrl.trim(),
                          apiKey: f.apiKey.trim(),
                          api: f.api,
                          models: newModels,
                        };
                        updateConfigFormValue(state, ["models", "mode"], "merge");
                        const existing = (state.configForm as Record<string, unknown>)?.models as
                          | Record<string, unknown>
                          | undefined;
                        const existingProviders = (existing?.providers ?? {}) as Record<
                          string,
                          unknown
                        >;
                        const existingProvider = existingProviders[f.provider.trim()] as
                          | Record<string, unknown>
                          | undefined;
                        if (existingProvider && Array.isArray(existingProvider.models)) {
                          providerObj.baseUrl = existingProvider.baseUrl ?? f.baseUrl.trim();
                          providerObj.apiKey = existingProvider.apiKey ?? f.apiKey.trim();
                          providerObj.api = existingProvider.api ?? f.api;
                          // Merge models, dedup by id — new models override existing
                          const newIds = new Set(newModels.map((m) => m.id));
                          const kept = (existingProvider.models as Array<{ id: string }>).filter(
                            (m) => !newIds.has(m.id),
                          );
                          providerObj.models = [...kept, ...newModels];
                        }
                        updateConfigFormValue(
                          state,
                          ["models", "providers", f.provider.trim()],
                          providerObj,
                        );
                        await applyConfig(state);
                        state.modelsQuickAddForm = {
                          provider: "",
                          baseUrl: "",
                          api: "openai-completions",
                          apiKey: "",
                          models: [{ id: "", name: "" }],
                        };
                      } catch (err) {
                        state.modelsQuickAddError = String(err);
                      } finally {
                        state.modelsQuickAddBusy = false;
                      }
                    },
                  })}
                  ${(() => {
                    // Build available models from config
                    const providersObj = (
                      (state.configForm as Record<string, unknown>)?.models as Record<
                        string,
                        unknown
                      >
                    )?.providers as Record<string, unknown> | undefined;
                    const allModels: Array<{ value: string; label: string }> = [];
                    const visionModels: Array<{ value: string; label: string }> = [];
                    if (providersObj) {
                      for (const [provId, provData] of Object.entries(providersObj)) {
                        const prov = provData as Record<string, unknown>;
                        const models = prov.models as
                          | Array<{ id: string; name?: string; input?: string[] }>
                          | undefined;
                        if (models) {
                          for (const m of models) {
                            const entry = {
                              value: `${provId}/${m.id}`,
                              label: `${provId}/${m.name || m.id}`,
                            };
                            allModels.push(entry);
                            if (m.input?.includes("image")) {
                              visionModels.push(entry);
                            }
                          }
                        }
                      }
                    }
                    // Read current default model
                    const agentsConfig = (state.configForm as Record<string, unknown>)?.agents as
                      | Record<string, unknown>
                      | undefined;
                    const defaultsConfig = (agentsConfig?.defaults ?? {}) as Record<
                      string,
                      unknown
                    >;
                    const currentDefaultModel =
                      typeof defaultsConfig.model === "string"
                        ? defaultsConfig.model
                        : typeof defaultsConfig.model === "object" && defaultsConfig.model
                          ? (((defaultsConfig.model as Record<string, unknown>)
                              .primary as string) ?? "")
                          : "";
                    // Read current image understanding model
                    const toolsConfig = (state.configForm as Record<string, unknown>)?.tools as
                      | Record<string, unknown>
                      | undefined;
                    const mediaConfig = (toolsConfig?.media ?? {}) as Record<string, unknown>;
                    const mediaModels = (mediaConfig.models ?? []) as Array<{
                      provider?: string;
                      model?: string;
                    }>;
                    const firstMediaModel = mediaModels[0];
                    const currentImageModel = firstMediaModel
                      ? `${firstMediaModel.provider ?? ""}/${firstMediaModel.model ?? ""}`
                      : "";
                    return renderDefaultModelConfig({
                      availableModels: allModels,
                      visionModels,
                      currentDefaultModel,
                      currentImageModel,
                      saving: state.configSaving,
                      onDefaultModelChange: (model: string) => {
                        updateConfigFormValue(
                          state,
                          ["agents", "defaults", "model"],
                          model || undefined,
                        );
                        void applyConfig(state);
                      },
                      onImageModelChange: (model: string) => {
                        if (!model) {
                          updateConfigFormValue(state, ["tools", "media", "models"], []);
                        } else {
                          const [provider, ...rest] = model.split("/");
                          const modelId = rest.join("/");
                          updateConfigFormValue(
                            state,
                            ["tools", "media", "models"],
                            [{ provider, model: modelId }],
                          );
                        }
                        void applyConfig(state);
                      },
                    });
                  })()}
                </div>
              `
            : nothing
        }

        ${
          state.tab === "agents-config"
            ? renderConfig({
                raw: state.configRaw,
                originalRaw: state.configRawOriginal,
                valid: state.configValid,
                issues: state.configIssues,
                loading: state.configLoading,
                saving: state.configSaving,
                applying: state.configApplying,
                updating: state.updateRunning,
                connected: state.connected,
                schema: state.configSchema,
                schemaLoading: state.configSchemaLoading,
                uiHints: state.configUiHints,
                formMode: state.configFormMode,
                configRawLoading: state.configRawLoading,
                formValue: state.configForm,
                originalValue: state.configFormOriginal,
                searchQuery: "",
                activeSection: "agents",
                activeSubsection: state.agentsConfigActiveSubsection,
                hideSidebar: true,
                onRawChange: (next) => {
                  state.configRaw = next;
                },
                onFormModeChange: (mode) => (state.configFormMode = mode),
                onLoadRaw: () => void loadConfigRaw(state),
                onFormPatch: (path, value) => updateConfigFormValue(state, path, value),
                onSearchChange: () => {},
                onSectionChange: () => {},
                onSubsectionChange: (section) => (state.agentsConfigActiveSubsection = section),
                onReload: () => loadConfig(state),
                onSave: () => saveConfig(state),
                onApply: () => applyConfig(state),
                onUpdate: () => runUpdate(state),
              })
            : nothing
        }
        ${
          state.tab === "json-edit"
            ? renderConfig({
                raw: state.configRaw,
                originalRaw: state.configRawOriginal,
                valid: state.configValid,
                issues: state.configIssues,
                loading: state.configLoading,
                saving: state.configSaving,
                applying: state.configApplying,
                updating: state.updateRunning,
                connected: state.connected,
                schema: state.configSchema,
                schemaLoading: false,
                uiHints: state.configUiHints,
                formMode: "raw" as const,
                configRawLoading: state.configRawLoading,
                formValue: state.configForm,
                originalValue: state.configFormOriginal,
                searchQuery: "",
                activeSection: null,
                activeSubsection: null,
                hideSidebar: true,
                onRawChange: (next) => {
                  state.configRaw = next;
                },
                onFormModeChange: () => {},
                onLoadRaw: () => void loadConfigRaw(state),
                onFormPatch: (path, value) => updateConfigFormValue(state, path, value),
                onSearchChange: () => {},
                onSectionChange: () => {},
                onSubsectionChange: () => {},
                onReload: async () => {
                  await loadConfig(state);
                  await loadConfigRaw(state);
                },
                onSave: () => saveConfig(state),
                onApply: () => applyConfig(state),
                onUpdate: () => runUpdate(state),
              })
            : nothing
        }

        ${
          state.tab === "debug"
            ? renderDebug({
                loading: state.debugLoading,
                status: state.debugStatus,
                health: state.debugHealth,
                models: state.debugModels,
                heartbeat: state.debugHeartbeat,
                eventLog: state.eventLog,
                callMethod: state.debugCallMethod,
                callParams: state.debugCallParams,
                callResult: state.debugCallResult,
                callError: state.debugCallError,
                onCallMethodChange: (next) => (state.debugCallMethod = next),
                onCallParamsChange: (next) => (state.debugCallParams = next),
                onRefresh: () => loadDebug(state),
                onCall: () => callDebugMethod(state),
              })
            : nothing
        }

        ${
          state.tab === "logs"
            ? renderLogs({
                loading: state.logsLoading,
                error: state.logsError,
                file: state.logsFile,
                entries: state.logsEntries,
                filterText: state.logsFilterText,
                levelFilters: state.logsLevelFilters,
                autoFollow: state.logsAutoFollow,
                truncated: state.logsTruncated,
                onFilterTextChange: (next) => (state.logsFilterText = next),
                onLevelToggle: (level, enabled) => {
                  state.logsLevelFilters = { ...state.logsLevelFilters, [level]: enabled };
                },
                onToggleAutoFollow: (next) => (state.logsAutoFollow = next),
                onRefresh: () => loadLogs(state, { reset: true }),
                onExport: (lines, label) => state.exportLogs(lines, label),
                onScroll: (event) => state.handleLogsScroll(event),
              })
            : nothing
        }`
        }
      </main>
      ${renderExecApprovalPrompt(state)}
      ${renderGatewayUrlConfirmation(state)}
    </div>
  `;
}
