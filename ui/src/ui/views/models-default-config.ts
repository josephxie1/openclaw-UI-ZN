import { html } from "lit";
import { t } from "../../i18n/index.ts";

export type DefaultModelConfigProps = {
  /** All configured model options: { value: "provider/id", label: "provider/name" } */
  availableModels: Array<{ value: string; label: string }>;
  /** Subset of available models that support image input */
  visionModels: Array<{ value: string; label: string }>;
  /** Current default model (agents.defaults.model) */
  currentDefaultModel: string;
  /** Current image understanding model (tools.media.models[0]) */
  currentImageModel: string;
  onDefaultModelChange: (model: string) => void;
  onImageModelChange: (model: string) => void;
  saving: boolean;
};

export function renderDefaultModelConfig(props: DefaultModelConfigProps) {
  return html`
    <section class="card" style="margin-bottom: 18px;">
      <div>
        <div class="card-title">${t("defaultModelConfig.title") ?? "默认模型配置"}</div>
        <div class="card-sub">${t("defaultModelConfig.subtitle") ?? "选择默认使用的主模型和图像理解模型"}</div>
      </div>
      <div class="default-model-config__grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
        <label class="field" style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-size: 13px; font-weight: 500;">${t("defaultModelConfig.primaryModel") ?? "主模型"}</span>
          <select
            style="width: 100%;"
            ?disabled=${props.saving}
            @change=${(e: Event) => {
              const target = e.target as HTMLSelectElement;
              props.onDefaultModelChange(target.value);
            }}
          >
            <option value="" ?selected=${!props.currentDefaultModel}>
              ${t("defaultModelConfig.notSet") ?? "— 未设置 —"}
            </option>
            ${props.availableModels.map(
              (m) => html`
                <option value=${m.value} ?selected=${props.currentDefaultModel === m.value}>
                  ${m.label}
                </option>
              `,
            )}
          </select>
          <span class="muted" style="font-size: 11px;">
            ${t("defaultModelConfig.primaryModelHint") ?? "所有 Agent 默认使用的对话模型"}
          </span>
        </label>

        <label class="field" style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-size: 13px; font-weight: 500;">${t("defaultModelConfig.imageModel") ?? "图像理解模型"}</span>
          ${
            props.visionModels.length === 0
              ? html`
                <select disabled style="width: 100%;">
                  <option>${t("defaultModelConfig.noVisionModels") ?? "暂无支持图像的模型"}</option>
                </select>
                <span class="muted" style="font-size: 11px;">
                  ${t("defaultModelConfig.noVisionModelsHint") ?? "请先添加支持图像输入的模型"}
                </span>
              `
              : html`
                <select
                  style="width: 100%;"
                  ?disabled=${props.saving}
                  @change=${(e: Event) => {
                    const target = e.target as HTMLSelectElement;
                    props.onImageModelChange(target.value);
                  }}
                >
                  <option value="" ?selected=${!props.currentImageModel}>
                    ${t("defaultModelConfig.disabled") ?? "— 关闭 —"}
                  </option>
                  ${props.visionModels.map(
                    (m) => html`
                      <option value=${m.value} ?selected=${props.currentImageModel === m.value}>
                        ${m.label}
                      </option>
                    `,
                  )}
                </select>
                <span class="muted" style="font-size: 11px;">
                  ${t("defaultModelConfig.imageModelHint") ?? "用于自动识别用户发送的图片内容"}
                </span>
              `
          }
        </label>
      </div>
    </section>
  `;
}
