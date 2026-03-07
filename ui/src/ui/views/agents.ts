import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { renderDropdown, renderMultiDropdown } from "../components/dropdown.ts";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
  SkillStatusReport,
  ToolsCatalogResult,
} from "../types.ts";
import {
  renderAgentFiles,
  renderAgentChannels,
  renderAgentCron,
} from "./agents-panels-status-files.ts";
import { renderAgentTools, renderAgentSkills } from "./agents-panels-tools-skills.ts";
import {
  agentBadgeText,
  buildAgentContext,
  resolveGroupedModels,
  normalizeAgentLabel,
  normalizeModelValue,
  resolveAgentConfig,
  resolveAgentAvatarSrc,
  resolveAgentEmoji,
  resolveEffectiveModelFallbacks,
  resolveModelLabel,
  resolveModelPrimary,
} from "./agents-utils.ts";

export type AgentsPanel = "overview" | "files" | "tools" | "skills" | "channels" | "cron";

export type AgentsProps = {
  loading: boolean;
  error: string | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  activePanel: AgentsPanel;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  channelsLoading: boolean;
  channelsError: string | null;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsLastSuccess: number | null;
  cronLoading: boolean;
  cronStatus: CronStatus | null;
  cronJobs: CronJob[];
  cronError: string | null;
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFilesList: AgentsFilesListResult | null;
  agentFileActive: string | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileSaving: boolean;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentSkillsLoading: boolean;
  agentSkillsReport: SkillStatusReport | null;
  agentSkillsError: string | null;
  agentSkillsAgentId: string | null;
  toolsCatalogLoading: boolean;
  toolsCatalogError: string | null;
  toolsCatalogResult: ToolsCatalogResult | null;
  skillsFilter: string;
  modelDropdownOpen: boolean;
  modelDropdownExpandedGroups: Set<string>;
  onRefresh: () => void;
  onSelectAgent: (agentId: string) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
  onToolsProfileChange: (agentId: string, profile: string | null, clearAllow: boolean) => void;
  onToolsOverridesChange: (agentId: string, alsoAllow: string[], deny: string[]) => void;
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
  onModelDropdownToggle: () => void;
  onModelDropdownGroupToggle: (label: string) => void;
  fallbackDropdownOpen: boolean;
  fallbackDropdownExpandedGroups: Set<string>;
  onFallbackDropdownToggle: () => void;
  onFallbackDropdownGroupToggle: (label: string) => void;
  onChannelsRefresh: () => void;
  onCronRefresh: () => void;
  onSkillsFilterChange: (next: string) => void;
  onSkillsRefresh: () => void;
  onAgentSkillToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  onAgentSkillsClear: (agentId: string) => void;
  onAgentSkillsDisableAll: (agentId: string) => void;
};

export type AgentContext = {
  workspace: string;
  model: string;
  identityName: string;
  identityEmoji: string;
  skillsLabel: string;
  isDefault: boolean;
};

export function renderAgents(props: AgentsProps) {
  const agents = props.agentsList?.agents ?? [];
  const defaultId = props.agentsList?.defaultId ?? null;
  const selectedId = props.selectedAgentId ?? defaultId ?? agents[0]?.id ?? null;
  const selectedAgent = selectedId
    ? (agents.find((agent) => agent.id === selectedId) ?? null)
    : null;

  return html`
    <div class="agents-layout">
      <section class="card agents-sidebar">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">${t("agentsView.agents")}</div>
            <div class="card-sub">${t("agentsView.configured", { count: String(agents.length) })}</div>
          </div>
          <button class="btn btn--sm" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? t("shared.loading") : t("shared.refresh")}
          </button>
        </div>
        ${
          props.error
            ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
            : nothing
        }
        <div class="agent-list" style="margin-top: 12px;">
          ${
            agents.length === 0
              ? html`
                  <div class="muted">${t("agentsView.noAgentsFound")}</div>
                `
              : agents.map((agent) => {
                  const badge = agentBadgeText(agent.id, defaultId);
                  const emoji = resolveAgentEmoji(agent, props.agentIdentityById[agent.id] ?? null);
                  const avatarSrc = resolveAgentAvatarSrc(
                    agent,
                    props.agentIdentityById[agent.id] ?? null,
                  );
                  return html`
                    <button
                      type="button"
                      class="agent-row ${selectedId === agent.id ? "active" : ""}"
                      @click=${() => props.onSelectAgent(agent.id)}
                    >
                      ${
                        avatarSrc
                          ? html`<img class="agent-avatar" src="${avatarSrc}" alt="${normalizeAgentLabel(agent)}" />`
                          : html`<div class="agent-avatar">${emoji || normalizeAgentLabel(agent).slice(0, 1)}</div>`
                      }
                      <div class="agent-info">
                        <div class="agent-title">${normalizeAgentLabel(agent)}</div>
                        <div class="agent-sub mono">${agent.id}</div>
                      </div>
                      ${badge ? html`<span class="agent-pill">${badge}</span>` : nothing}
                    </button>
                  `;
                })
          }
        </div>
      </section>
      <section class="agents-main">
        ${
          !selectedAgent
            ? html`
                <div class="card">
                  <div class="card-title">${t("agentsView.selectAgent")}</div>
                  <div class="card-sub">${t("agentsView.selectAgentSub")}</div>
                </div>
              `
            : html`
                ${renderAgentHeader(
                  selectedAgent,
                  defaultId,
                  props.agentIdentityById[selectedAgent.id] ?? null,
                )}
                ${renderAgentTabs(props.activePanel, (panel) => props.onSelectPanel(panel))}
                ${
                  props.activePanel === "overview"
                    ? renderAgentOverview({
                        agent: selectedAgent,
                        defaultId,
                        configForm: props.configForm,
                        agentFilesList: props.agentFilesList,
                        agentIdentity: props.agentIdentityById[selectedAgent.id] ?? null,
                        agentIdentityError: props.agentIdentityError,
                        agentIdentityLoading: props.agentIdentityLoading,
                        configLoading: props.configLoading,
                        configSaving: props.configSaving,
                        configDirty: props.configDirty,
                        modelDropdownOpen: props.modelDropdownOpen,
                        modelDropdownExpandedGroups: props.modelDropdownExpandedGroups,
                        onConfigReload: props.onConfigReload,
                        onConfigSave: props.onConfigSave,
                        onModelChange: props.onModelChange,
                        onModelFallbacksChange: props.onModelFallbacksChange,
                        onModelDropdownToggle: props.onModelDropdownToggle,
                        onModelDropdownGroupToggle: props.onModelDropdownGroupToggle,
                        fallbackDropdownOpen: props.fallbackDropdownOpen,
                        fallbackDropdownExpandedGroups: props.fallbackDropdownExpandedGroups,
                        onFallbackDropdownToggle: props.onFallbackDropdownToggle,
                        onFallbackDropdownGroupToggle: props.onFallbackDropdownGroupToggle,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "files"
                    ? renderAgentFiles({
                        agentId: selectedAgent.id,
                        agentFilesList: props.agentFilesList,
                        agentFilesLoading: props.agentFilesLoading,
                        agentFilesError: props.agentFilesError,
                        agentFileActive: props.agentFileActive,
                        agentFileContents: props.agentFileContents,
                        agentFileDrafts: props.agentFileDrafts,
                        agentFileSaving: props.agentFileSaving,
                        onLoadFiles: props.onLoadFiles,
                        onSelectFile: props.onSelectFile,
                        onFileDraftChange: props.onFileDraftChange,
                        onFileReset: props.onFileReset,
                        onFileSave: props.onFileSave,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "tools"
                    ? renderAgentTools({
                        agentId: selectedAgent.id,
                        configForm: props.configForm,
                        configLoading: props.configLoading,
                        configSaving: props.configSaving,
                        configDirty: props.configDirty,
                        toolsCatalogLoading: props.toolsCatalogLoading,
                        toolsCatalogError: props.toolsCatalogError,
                        toolsCatalogResult: props.toolsCatalogResult,
                        onProfileChange: props.onToolsProfileChange,
                        onOverridesChange: props.onToolsOverridesChange,
                        onConfigReload: props.onConfigReload,
                        onConfigSave: props.onConfigSave,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "skills"
                    ? renderAgentSkills({
                        agentId: selectedAgent.id,
                        report: props.agentSkillsReport,
                        loading: props.agentSkillsLoading,
                        error: props.agentSkillsError,
                        activeAgentId: props.agentSkillsAgentId,
                        configForm: props.configForm,
                        configLoading: props.configLoading,
                        configSaving: props.configSaving,
                        configDirty: props.configDirty,
                        filter: props.skillsFilter,
                        onFilterChange: props.onSkillsFilterChange,
                        onRefresh: props.onSkillsRefresh,
                        onToggle: props.onAgentSkillToggle,
                        onClear: props.onAgentSkillsClear,
                        onDisableAll: props.onAgentSkillsDisableAll,
                        onConfigReload: props.onConfigReload,
                        onConfigSave: props.onConfigSave,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "channels"
                    ? renderAgentChannels({
                        context: buildAgentContext(
                          selectedAgent,
                          props.configForm,
                          props.agentFilesList,
                          defaultId,
                          props.agentIdentityById[selectedAgent.id] ?? null,
                        ),
                        configForm: props.configForm,
                        snapshot: props.channelsSnapshot,
                        loading: props.channelsLoading,
                        error: props.channelsError,
                        lastSuccess: props.channelsLastSuccess,
                        onRefresh: props.onChannelsRefresh,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "cron"
                    ? renderAgentCron({
                        context: buildAgentContext(
                          selectedAgent,
                          props.configForm,
                          props.agentFilesList,
                          defaultId,
                          props.agentIdentityById[selectedAgent.id] ?? null,
                        ),
                        agentId: selectedAgent.id,
                        jobs: props.cronJobs,
                        status: props.cronStatus,
                        loading: props.cronLoading,
                        error: props.cronError,
                        onRefresh: props.onCronRefresh,
                      })
                    : nothing
                }
              `
        }
      </section>
    </div>
  `;
}

function renderAgentHeader(
  agent: AgentsListResult["agents"][number],
  defaultId: string | null,
  agentIdentity: AgentIdentityResult | null,
) {
  const badge = agentBadgeText(agent.id, defaultId);
  const displayName = normalizeAgentLabel(agent);
  const subtitle = agent.identity?.theme?.trim() || t("agentsView.defaultSubtitle");
  const emoji = resolveAgentEmoji(agent, agentIdentity);
  const avatarSrc = resolveAgentAvatarSrc(agent, agentIdentity);
  return html`
    <section class="card agent-header">
      <div class="agent-header-main">
        ${
          avatarSrc
            ? html`<img class="agent-avatar agent-avatar--lg" src="${avatarSrc}" alt="${displayName}" />`
            : html`<div class="agent-avatar agent-avatar--lg">${emoji || displayName.slice(0, 1)}</div>`
        }
        <div>
          <div class="card-title">${displayName}</div>
          <div class="card-sub">${subtitle}</div>
        </div>
      </div>
      <div class="agent-header-meta">
        <div class="mono">${agent.id}</div>
        ${badge ? html`<span class="agent-pill">${badge}</span>` : nothing}
      </div>
    </section>
  `;
}

function renderAgentTabs(active: AgentsPanel, onSelect: (panel: AgentsPanel) => void) {
  const tabs: Array<{ id: AgentsPanel; label: string }> = [
    { id: "overview", label: t("agentsView.overview") },
    { id: "files", label: t("agentsView.files") },
    { id: "tools", label: t("agentsView.tools") },
    { id: "skills", label: t("agentsView.skills") },
    { id: "channels", label: t("agentsView.channels") },
    { id: "cron", label: t("agentsView.cronJobs") },
  ];
  return html`
    <div class="agent-tabs">
      ${tabs.map(
        (tab) => html`
          <button
            class="agent-tab ${active === tab.id ? "active" : ""}"
            type="button"
            @click=${() => onSelect(tab.id)}
          >
            ${tab.label}
          </button>
        `,
      )}
    </div>
  `;
}

function renderAgentOverview(params: {
  agent: AgentsListResult["agents"][number];
  defaultId: string | null;
  configForm: Record<string, unknown> | null;
  agentFilesList: AgentsFilesListResult | null;
  agentIdentity: AgentIdentityResult | null;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  modelDropdownOpen: boolean;
  modelDropdownExpandedGroups: Set<string>;
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
  onModelDropdownToggle: () => void;
  onModelDropdownGroupToggle: (label: string) => void;
  fallbackDropdownOpen: boolean;
  fallbackDropdownExpandedGroups: Set<string>;
  onFallbackDropdownToggle: () => void;
  onFallbackDropdownGroupToggle: (label: string) => void;
}) {
  const {
    agent,
    configForm,
    agentFilesList,
    agentIdentity,
    agentIdentityLoading,
    agentIdentityError,
    configLoading,
    configSaving,
    configDirty,
    onConfigReload,
    onConfigSave,
    onModelChange,
    onModelFallbacksChange,
    onModelDropdownToggle,
    onModelDropdownGroupToggle,
    onFallbackDropdownToggle,
    onFallbackDropdownGroupToggle,
  } = params;
  const config = resolveAgentConfig(configForm, agent.id);
  const modelGroups = resolveGroupedModels(configForm);
  const workspaceFromFiles =
    agentFilesList && agentFilesList.agentId === agent.id ? agentFilesList.workspace : null;
  const workspace =
    workspaceFromFiles || config.entry?.workspace || config.defaults?.workspace || "default";
  const model = config.entry?.model
    ? resolveModelLabel(config.entry?.model)
    : resolveModelLabel(config.defaults?.model);
  const defaultModel = resolveModelLabel(config.defaults?.model);
  const modelPrimary =
    resolveModelPrimary(config.entry?.model) || (model !== "-" ? normalizeModelValue(model) : null);
  const defaultPrimary =
    resolveModelPrimary(config.defaults?.model) ||
    (defaultModel !== "-" ? normalizeModelValue(defaultModel) : null);
  const effectivePrimary = modelPrimary ?? defaultPrimary ?? null;
  const modelFallbacks = resolveEffectiveModelFallbacks(
    config.entry?.model,
    config.defaults?.model,
  );
  const identityName =
    agentIdentity?.name?.trim() ||
    agent.identity?.name?.trim() ||
    agent.name?.trim() ||
    config.entry?.name ||
    "-";
  const resolvedEmoji = resolveAgentEmoji(agent, agentIdentity);
  const identityEmoji = resolvedEmoji || "-";
  const skillFilter = Array.isArray(config.entry?.skills) ? config.entry?.skills : null;
  const skillCount = skillFilter?.length ?? null;
  const identityStatus = agentIdentityLoading
    ? t("shared.loading")
    : agentIdentityError
      ? t("agentsView.unavailable")
      : "";
  const isDefault = Boolean(params.defaultId && agent.id === params.defaultId);

  return html`
    <section class="card">
      <div class="card-title">${t("agentsView.overviewTitle")}</div>
      <div class="card-sub">${t("agentsView.overviewSub")}</div>
      <div class="agents-overview-grid" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">${t("agentsView.workspace")}</div>
          <div class="mono">${workspace}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsView.primaryModel")}</div>
          <div class="mono">${model}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsView.identityName")}</div>
          <div>${identityName}</div>
          ${identityStatus ? html`<div class="agent-kv-sub muted">${identityStatus}</div>` : nothing}
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsView.defaultLabel")}</div>
          <div>${isDefault ? t("agentsView.yes") : t("agentsView.no")}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsView.identityEmoji")}</div>
          <div>${identityEmoji}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsView.skillsFilter")}</div>
          <div>${skillFilter ? t("agentsView.selectedSkills", { count: String(skillCount) }) : t("agentsView.allSkills")}</div>
        </div>
      </div>

      <div class="agent-model-select" style="margin-top: 20px;">
        <div class="label">${t("agentsView.modelSelection")}</div>
        <div class="row" style="gap: 12px; flex-wrap: wrap;">
          <div style="min-width: 260px; flex: 1;">
            <div class="label" style="margin-bottom: 6px;">${isDefault ? t("agentsView.primaryModelDefault") : t("agentsView.primaryModel")}</div>
            ${renderDropdown({
              value: effectivePrimary,
              placeholder: isDefault
                ? t("agentsView.noConfiguredModels")
                : defaultPrimary
                  ? t("agentsView.inheritDefaultWith", { model: defaultPrimary })
                  : t("agentsView.inheritDefault"),
              groups: modelGroups.map((g) => ({
                label: g.providerId,
                items: g.models,
              })),
              open: params.modelDropdownOpen,
              disabled: !configForm || configLoading || configSaving,
              expandedGroups: params.modelDropdownExpandedGroups,
              onSelect: (value) => onModelChange(agent.id, value || null),
              onToggle: onModelDropdownToggle,
              onGroupToggle: onModelDropdownGroupToggle,
            })}
          </div>
          <div style="min-width: 260px; flex: 1;">
            <div class="label" style="margin-bottom: 6px;">${t("agentsView.fallbacks")}</div>
            ${renderMultiDropdown({
              values: modelFallbacks ?? [],
              placeholder: t("agentsView.fallbacksPlaceholder") ?? "选择备选模型",
              groups: modelGroups
                .map((g) => ({
                  label: g.providerId,
                  items: g.models.filter((m) => m.value !== effectivePrimary),
                }))
                .filter((g) => g.items.length > 0),
              open: params.fallbackDropdownOpen,
              disabled: !configForm || configLoading || configSaving,
              expandedGroups: params.fallbackDropdownExpandedGroups,
              onToggleItem: (value) => {
                const current = modelFallbacks ?? [];
                const next = current.includes(value)
                  ? current.filter((v) => v !== value)
                  : [...current, value];
                onModelFallbacksChange(agent.id, next);
              },
              onToggle: onFallbackDropdownToggle,
              onGroupToggle: onFallbackDropdownGroupToggle,
            })}
          </div>
        </div>
        <div class="row" style="justify-content: flex-end; gap: 8px;">
          <button class="btn btn--sm" ?disabled=${configLoading} @click=${onConfigReload}>
            ${t("agentsView.reloadConfig")}
          </button>
          <button
            class="btn btn--sm primary"
            ?disabled=${configSaving || !configDirty}
            @click=${onConfigSave}
          >
            ${configSaving ? t("shared.saving") : t("shared.save")}
          </button>
        </div>
      </div>
    </section>
  `;
}
