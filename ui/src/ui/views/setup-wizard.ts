import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { renderDropdown } from "../components/dropdown.ts";
import { renderMultiDropdown } from "../components/dropdown.ts";
import { PROVIDER_PRESETS } from "./models-quick-add.ts";
import type { QuickAddProviderForm } from "./models-quick-add.ts";

export interface SetupWizardProps {
  currentStep: number;
  totalSteps: number;
  direction: number;
  animating: boolean;
  saving: boolean;
  // Model step state
  selectedPreset: string;
  selectedModelIds: string[];
  apiKey: string;
  customForm: QuickAddProviderForm;
  presetDropdownOpen: boolean;
  modelDropdownOpen: boolean;
  onPresetSelect: (presetId: string) => void;
  onPresetDropdownToggle: () => void;
  onModelToggle: (modelId: string) => void;
  onModelDropdownToggle: () => void;
  onApiKeyChange: (value: string) => void;
  apiKeyVisible: boolean;
  onApiKeyVisibilityToggle: () => void;
  onCustomFieldChange: (field: string, value: string) => void;
  onCustomModelChange: (index: number, field: string, value: string) => void;
  onCustomAddModel: () => void;
  onCustomRemoveModel: (index: number) => void;
  // Navigation
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
  onAnimationEnd: () => void;
  // Channel step
  renderChannelStep: () => unknown;
}

const API_OPTIONS = [
  { value: "openai-completions", label: "OpenAI Completions" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
];

let _apiKeyVisible = false;

function renderPasswordInput(
  value: string,
  onChange: (v: string) => void,
  visible: boolean,
  onToggle: () => void,
) {
  return html`
    <div class="setup-wizard__password-wrap">
      <input
        class="setup-wizard__form-input setup-wizard__form-input--password"
        type="${visible ? "text" : "password"}"
        placeholder="sk-xxx"
        .value=${value}
        @input=${(e: Event) => onChange((e.target as HTMLInputElement).value)}
      />
      <button
        type="button"
        class="setup-wizard__eye-toggle"
        @click=${() => {
          onToggle();
        }}
        title="${visible ? "Hide" : "Show"}"
      >
        ${
          visible
            ? html`
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              `
            : html`
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              `
        }
      </button>
    </div>
  `;
}

export function renderSetupWizard(props: SetupWizardProps) {
  const { currentStep, totalSteps, direction, animating } = props;
  const isFirst = currentStep === 1;
  const isLast = currentStep === totalSteps;
  const isDone = currentStep > totalSteps;
  const stepCount = totalSteps;

  // Model step validation
  const isCustom = props.selectedPreset === "__custom__";
  const activePreset = PROVIDER_PRESETS.find((p) => p.id === props.selectedPreset);
  const modelStepValid = isCustom
    ? !!(
        props.customForm.provider.trim() &&
        props.customForm.baseUrl.trim() &&
        props.customForm.apiKey.trim() &&
        props.customForm.models.some((m) => m.id.trim())
      )
    : !!(activePreset && props.selectedModelIds.length > 0 && props.apiKey.trim());

  return html`
    <div class="setup-wizard">
      <div class="setup-wizard__container">
        <!-- Step indicators -->
        <div class="setup-wizard__indicators">
          ${Array.from({ length: stepCount }, (_, i) => {
            const step = i + 1;
            const isActive = step === currentStep;
            const isComplete = step < currentStep || isDone;
            const dotClass = isActive
              ? "setup-wizard__step-dot--active"
              : isComplete
                ? "setup-wizard__step-dot--complete"
                : "setup-wizard__step-dot--inactive";
            return html`
              ${
                i > 0
                  ? html`<div class="setup-wizard__connector">
                    <div
                      class="setup-wizard__connector-fill"
                      style="width: ${currentStep > step || isDone ? "100%" : "0%"}"
                    ></div>
                  </div>`
                  : nothing
              }
              <button class="setup-wizard__step-dot ${dotClass}">
                ${
                  isComplete && !isActive
                    ? html`
                        <svg class="setup-wizard__check" viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      `
                    : isActive
                      ? html`
                          <div class="setup-wizard__step-dot-inner"></div>
                        `
                      : html`<span>${step}</span>`
                }
              </button>
            `;
          })}
        </div>

        <!-- Saving overlay -->
        ${
          props.saving
            ? html`
              <div class="setup-wizard__saving-overlay">
                <div class="setup-wizard__saving-spinner"></div>
                <p>${t("setupWizard.saving") ?? "正在保存配置…"}</p>
              </div>
            `
            : nothing
        }

        <!-- Content area -->
        <div class="setup-wizard__content">
          <div
            class="setup-wizard__slide ${
              animating
                ? direction > 0
                  ? "setup-wizard__slide--enter-left"
                  : "setup-wizard__slide--enter-right"
                : ""
            }"
            @animationend=${props.onAnimationEnd}
          >
            ${renderStepContent(currentStep, props, modelStepValid)}
          </div>
        </div>

        <!-- Footer -->
        ${
          isDone
            ? nothing
            : html`
              <div
                class="setup-wizard__footer ${!isFirst ? "setup-wizard__footer--spread" : ""}"
              >
                ${
                  !isFirst
                    ? html`<button class="setup-wizard__btn-back" @click=${props.onBack}>
                      ${t("setupWizard.back")}
                    </button>`
                    : nothing
                }
                <div style="display:flex;gap:0.5rem;">
                  ${
                    currentStep === 3
                      ? html`<button class="setup-wizard__btn-skip" @click=${props.onSkip}>
                        ${t("setupWizard.skip")}
                      </button>`
                      : nothing
                  }
                  ${
                    isLast
                      ? html`<button class="setup-wizard__btn-next" @click=${props.onComplete}>
                        ${t("setupWizard.finish")}
                      </button>`
                      : currentStep === 2
                        ? html`<button
                          class="setup-wizard__btn-next"
                          ?disabled=${!modelStepValid}
                          @click=${props.onNext}
                        >
                          ${t("setupWizard.next")}
                        </button>`
                        : html`<button class="setup-wizard__btn-next" @click=${props.onNext}>
                          ${currentStep === 1 ? t("setupWizard.start") : t("setupWizard.next")}
                        </button>`
                  }
                </div>
              </div>
            `
        }
      </div>
    </div>
  `;
}

function renderStepContent(step: number, props: SetupWizardProps, _modelStepValid: boolean) {
  switch (step) {
    case 1:
      return html`
        <div class="setup-wizard__welcome">
          <div class="setup-wizard__welcome-logo">🐾</div>
          <h2>${t("setupWizard.welcomeTitle")}</h2>
          <p>${t("setupWizard.welcomeDesc")}</p>
        </div>
      `;
    case 2:
      return renderModelStep(props);
    case 3:
      return html`
        <div>
          <div class="setup-wizard__step-label">${t("setupWizard.step")} 2 / 2</div>
          <div class="setup-wizard__step-title">${t("setupWizard.channelTitle")}</div>
          <p style="color:var(--muted);font-size:0.85rem;margin:0 0 1rem;">
            ${t("setupWizard.channelDesc")}
          </p>
          ${props.renderChannelStep()}
        </div>
      `;
    case 4:
      return html`
        <div class="setup-wizard__done">
          <div class="setup-wizard__done-icon">🎉</div>
          <h2>${t("setupWizard.doneTitle")}</h2>
          <p>${t("setupWizard.doneDesc")}</p>
        </div>
      `;
    default:
      return nothing;
  }
}

function renderModelStep(props: SetupWizardProps) {
  const isCustom = props.selectedPreset === "__custom__";
  const activePreset = PROVIDER_PRESETS.find((p) => p.id === props.selectedPreset);

  // Build provider dropdown items: presets + custom
  const providerItems = [
    ...PROVIDER_PRESETS.map((p) => ({ value: p.id, label: p.label })),
    { value: "__custom__", label: t("modelsQuickAdd.custom") ?? "自定义" },
  ];

  // Build model multi-select items
  const modelItems = activePreset
    ? activePreset.models.map((m) => ({
        value: m.id,
        label: `${m.name}${m.tag ? ` (${m.tag})` : ""}`,
      }))
    : [];

  return html`
    <div>
      <div class="setup-wizard__step-label">${t("setupWizard.step")} 1 / 2</div>
      <div class="setup-wizard__step-title">${t("setupWizard.modelTitle")}</div>

      <div class="setup-wizard__form-group">
        <label class="setup-wizard__form-label">${t("modelsQuickAdd.provider")}</label>
        ${renderDropdown({
          value: props.selectedPreset || null,
          placeholder: t("setupWizard.selectProvider") ?? "选择模型供应商...",
          items: providerItems,
          open: props.presetDropdownOpen,
          onSelect: (value) => props.onPresetSelect(value),
          onToggle: () => props.onPresetDropdownToggle(),
        })}
      </div>

      ${
        activePreset
          ? html`
            <div class="setup-wizard__form-group">
              <label class="setup-wizard__form-label">
                ${t("modelsQuickAdd.selectModels")}
                <span class="setup-wizard__model-count">${props.selectedModelIds.length} / ${activePreset.models.length}</span>
              </label>
              ${renderMultiDropdown({
                values: props.selectedModelIds,
                placeholder: t("setupWizard.selectModels") ?? "选择要添加的模型...",
                items: modelItems,
                open: props.modelDropdownOpen,
                onToggleItem: (value) => props.onModelToggle(value),
                onToggle: () => props.onModelDropdownToggle(),
              })}
            </div>

            <div class="setup-wizard__form-group">
              <label class="setup-wizard__form-label">
                API Key
                <a
                  class="setup-wizard__api-key-link"
                  href=${activePreset.apiKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🔑 ${t("modelsQuickAdd.getApiKey")}
                </a>
              </label>
              ${renderPasswordInput(props.apiKey, props.onApiKeyChange, props.apiKeyVisible, props.onApiKeyVisibilityToggle)}
            </div>
          `
          : nothing
      }

      ${
        isCustom
          ? html`
            <div class="setup-wizard__form-group">
              <label class="setup-wizard__form-label">${t("modelsQuickAdd.provider")}</label>
              <input
                class="setup-wizard__form-input"
                type="text"
                placeholder="my-provider"
                .value=${props.customForm.provider}
                @input=${(e: Event) => props.onCustomFieldChange("provider", (e.target as HTMLInputElement).value)}
              />
            </div>

            <div class="setup-wizard__form-group">
              <label class="setup-wizard__form-label">${t("modelsQuickAdd.baseUrl")}</label>
              <input
                class="setup-wizard__form-input"
                type="text"
                placeholder="https://api.example.com/v1"
                .value=${props.customForm.baseUrl}
                @input=${(e: Event) => props.onCustomFieldChange("baseUrl", (e.target as HTMLInputElement).value)}
              />
            </div>

            <div class="setup-wizard__form-group">
              <label class="setup-wizard__form-label">${t("modelsQuickAdd.api")}</label>
              <select
                class="setup-wizard__form-input"
                .value=${props.customForm.api}
                @change=${(e: Event) => props.onCustomFieldChange("api", (e.target as HTMLSelectElement).value)}
              >
                ${API_OPTIONS.map(
                  (opt) => html`
                    <option value=${opt.value} ?selected=${props.customForm.api === opt.value}>
                      ${opt.label}
                    </option>
                  `,
                )}
              </select>
            </div>

            <div class="setup-wizard__form-group">
              <label class="setup-wizard__form-label">API Key</label>
              ${renderPasswordInput(props.customForm.apiKey, (v) => props.onCustomFieldChange("apiKey", v), props.apiKeyVisible, props.onApiKeyVisibilityToggle)}
            </div>

            <div class="setup-wizard__form-group">
              <label class="setup-wizard__form-label">
                ${t("modelsQuickAdd.modelsTitle")}
                <button
                  class="setup-wizard__add-model-btn"
                  @click=${props.onCustomAddModel}
                >
                  ＋ ${t("modelsQuickAdd.addModel")}
                </button>
              </label>
              ${props.customForm.models.map(
                (model, index) => html`
                  <div class="setup-wizard__custom-model-row">
                    <input
                      class="setup-wizard__form-input"
                      type="text"
                      placeholder="model-id"
                      .value=${model.id}
                      @input=${(e: Event) => props.onCustomModelChange(index, "id", (e.target as HTMLInputElement).value)}
                    />
                    <input
                      class="setup-wizard__form-input"
                      type="text"
                      placeholder="${t("modelsQuickAdd.modelName")}"
                      .value=${model.name}
                      @input=${(e: Event) => props.onCustomModelChange(index, "name", (e.target as HTMLInputElement).value)}
                    />
                    ${
                      props.customForm.models.length > 1
                        ? html`<button
                          class="setup-wizard__remove-model-btn"
                          @click=${() => props.onCustomRemoveModel(index)}
                        >✕</button>`
                        : nothing
                    }
                  </div>
                `,
              )}
            </div>
          `
          : nothing
      }
    </div>
  `;
}
