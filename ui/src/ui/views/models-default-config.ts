import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "../../i18n/index.ts";
import { renderDropdown } from "../components/dropdown.ts";
import type { DropdownGroup, DropdownItem } from "../components/dropdown.ts";

/**
 * Self-contained LitElement for default model configuration.
 * Manages its own dropdown open/close + expandedGroups state so
 * toggles only re-render this card, not the whole models page.
 *
 * Usage:
 *   <oc-default-model-config
 *     .modelGroups=${groups}
 *     .visionModelGroups=${vGroups}
 *     .currentDefaultModel=${"prov/id"}
 *     .currentImageModel=${"prov/id"}
 *     ?saving=${false}
 *     @default-model-change=${handler}
 *     @image-model-change=${handler}
 *   ></oc-default-model-config>
 */
@customElement("oc-default-model-config")
export class OcDefaultModelConfig extends LitElement {
  // ── External props (set by parent) ──
  @property({ type: Array }) modelGroups: DropdownGroup[] = [];
  @property({ type: Array }) visionModelGroups: DropdownGroup[] = [];
  @property({ type: String }) currentDefaultModel = "";
  @property({ type: String }) currentImageModel = "";
  @property({ type: Boolean }) saving = false;
  @property({ type: Boolean }) hasVisionModels = false;

  // ── Internal state (managed here → no parent re-render) ──
  @state() private _defOpen = false;
  @state() private _defExpanded = new Set<string>();
  @state() private _imgOpen = false;
  @state() private _imgExpanded = new Set<string>();

  createRenderRoot() {
    return this;
  }

  render() {
    const disabledItem: DropdownItem = {
      value: "",
      label: t("defaultModelConfig.disabled") ?? "— 关闭 —",
    };
    return html`
      <section class="card">
        <div>
          <div class="card-title">${t("defaultModelConfig.title") ?? "默认模型配置"}</div>
          <div class="card-sub">
            ${t("defaultModelConfig.subtitle") ?? "选择默认使用的主模型和图像理解模型"}
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 16px;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <span style="font-size: 13px; font-weight: 500;">
              ${t("defaultModelConfig.primaryModel") ?? "主模型"}
            </span>
            ${renderDropdown({
              value: this.currentDefaultModel || null,
              placeholder: t("defaultModelConfig.notSet") ?? "— 未设置 —",
              groups: this.modelGroups,
              open: this._defOpen,
              disabled: this.saving,
              expandedGroups: this._defExpanded,
              onToggle: () => {
                this._defOpen = !this._defOpen;
                this._imgOpen = false;
                if (this._defOpen) {
                  const close = () => {
                    this._defOpen = false;
                  };
                  requestAnimationFrame(() =>
                    document.addEventListener("click", close, { once: true }),
                  );
                }
              },
              onSelect: (value: string) => {
                this._defOpen = false;
                this.dispatchEvent(
                  new CustomEvent("default-model-change", {
                    detail: { model: value },
                    bubbles: true,
                    composed: true,
                  }),
                );
              },
              onGroupToggle: (label: string) => {
                const s = new Set(this._defExpanded);
                if (s.has(label)) {
                  s.delete(label);
                } else {
                  s.add(label);
                }
                this._defExpanded = s;
              },
            })}
            <span class="muted" style="font-size: 11px;">
              ${t("defaultModelConfig.primaryModelHint") ?? "所有 Agent 默认使用的对话模型"}
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <span style="font-size: 13px; font-weight: 500;">
              ${t("defaultModelConfig.imageModel") ?? "图像理解模型"}
            </span>
            ${
              !this.hasVisionModels
                ? html`
                  <div class="muted" style="font-size: 12px; padding: 10px 0;">
                    ${t("defaultModelConfig.noVisionModels") ?? "暂无支持图像的模型"}
                  </div>
                  <span class="muted" style="font-size: 11px;">
                    ${t("defaultModelConfig.noVisionModelsHint") ?? "请先添加支持图像输入的模型"}
                  </span>
                `
                : html`
                  ${renderDropdown({
                    value: this.currentImageModel || null,
                    placeholder: t("defaultModelConfig.disabled") ?? "— 关闭 —",
                    items: [disabledItem],
                    groups: this.visionModelGroups,
                    open: this._imgOpen,
                    disabled: this.saving,
                    expandedGroups: this._imgExpanded,
                    onToggle: () => {
                      this._imgOpen = !this._imgOpen;
                      this._defOpen = false;
                      if (this._imgOpen) {
                        const close = () => {
                          this._imgOpen = false;
                        };
                        requestAnimationFrame(() =>
                          document.addEventListener("click", close, { once: true }),
                        );
                      }
                    },
                    onSelect: (value: string) => {
                      this._imgOpen = false;
                      this.dispatchEvent(
                        new CustomEvent("image-model-change", {
                          detail: { model: value },
                          bubbles: true,
                          composed: true,
                        }),
                      );
                    },
                    onGroupToggle: (label: string) => {
                      const s = new Set(this._imgExpanded);
                      if (s.has(label)) {
                        s.delete(label);
                      } else {
                        s.add(label);
                      }
                      this._imgExpanded = s;
                    },
                  })}
                  <span class="muted" style="font-size: 11px;">
                    ${t("defaultModelConfig.imageModelHint") ?? "用于自动识别用户发送的图片内容"}
                  </span>
                `
            }
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-default-model-config": OcDefaultModelConfig;
  }
}
