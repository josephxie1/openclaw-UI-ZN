import { html } from "lit";
import { t } from "../../i18n/index.ts";
import { renderDropdown } from "../components/dropdown.ts";
import type { DropdownItem } from "../components/dropdown.ts";

export type DefaultModelConfigProps = {
  /** All configured model options */
  availableModels: DropdownItem[];
  /** Subset of available models that support image input */
  visionModels: DropdownItem[];
  /** Current default model (agents.defaults.model) */
  currentDefaultModel: string;
  /** Current image understanding model (tools.media.models[0]) */
  currentImageModel: string;
  onDefaultModelChange: (model: string) => void;
  onImageModelChange: (model: string) => void;
  saving: boolean;
  defaultModelDropdownOpen: boolean;
  onDefaultModelDropdownToggle: () => void;
  imageModelDropdownOpen: boolean;
  onImageModelDropdownToggle: () => void;
};

export function renderDefaultModelConfig(props: DefaultModelConfigProps) {
  const disabledItem: DropdownItem = {
    value: "",
    label: t("defaultModelConfig.disabled") ?? "— 关闭 —",
  };
  return html`
    <section class="card">
      <div>
        <div class="card-title">${t("defaultModelConfig.title") ?? "默认模型配置"}</div>
        <div class="card-sub">${t("defaultModelConfig.subtitle") ?? "选择默认使用的主模型和图像理解模型"}</div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-size: 13px; font-weight: 500;">${t("defaultModelConfig.primaryModel") ?? "主模型"}</span>
          ${renderDropdown({
            value: props.currentDefaultModel || null,
            placeholder: t("defaultModelConfig.notSet") ?? "— 未设置 —",
            items: props.availableModels,
            open: props.defaultModelDropdownOpen,
            disabled: props.saving,
            onToggle: props.onDefaultModelDropdownToggle,
            onSelect: (value: string) => props.onDefaultModelChange(value),
          })}
          <span class="muted" style="font-size: 11px;">
            ${t("defaultModelConfig.primaryModelHint") ?? "所有 Agent 默认使用的对话模型"}
          </span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-size: 13px; font-weight: 500;">${t("defaultModelConfig.imageModel") ?? "图像理解模型"}</span>
          ${
            props.visionModels.length === 0
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
                  value: props.currentImageModel || null,
                  placeholder: t("defaultModelConfig.disabled") ?? "— 关闭 —",
                  items: [disabledItem, ...props.visionModels],
                  open: props.imageModelDropdownOpen,
                  disabled: props.saving,
                  onToggle: props.onImageModelDropdownToggle,
                  onSelect: (value: string) => props.onImageModelChange(value),
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
