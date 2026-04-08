/**
 * API 设置页面
 *
 * 提供 API 配置管理界面
 *
 * @file ApiSettingsPage.ts
 * @author AI Butler Team
 */

import { getPref, setPref } from "../../../utils/prefs";
import {
  createStyledButton,
  createFormGroup,
  createInput,
  createSelect,
} from "../ui/components";
import LLMClient from "../../llmClient";
import { APITestError } from "../../llmproviders/types";
import { ApiKeyManager, type ProviderId } from "../../apiKeyManager";

/**
 * API 设置页面类
 */
export class ApiSettingsPage {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * 渲染页面
   */
  public render(): void {
    this.container.innerHTML = "";

    // 标题
    const title = this.createElement("h2", {
      textContent: "🔌 API Configuration",
      styles: {
        color: "#59c0bc",
        marginBottom: "20px",
        fontSize: "20px",
        borderBottom: "2px solid #59c0bc",
        paddingBottom: "10px",
      },
    });
    this.container.appendChild(title);

    // 添加Required项说明
    const notice = this.createElement("div", {
      styles: {
        padding: "12px 16px",
        backgroundColor: "#e3f2fd",
        border: "1px solid #2196f3",
        borderRadius: "6px",
        marginBottom: "24px",
        fontSize: "14px",
        color: "#1565c0",
      },
    });
    const doc = Zotero.getMainWindow().document;
    notice.innerHTML =
      "📝 <strong>Note</strong>: Fields marked with <strong style='color: #d32f2f;'>*</strong> are required";
    this.container.appendChild(notice);

    // 表单容器
    const form = this.createElement("div", {
      styles: {
        maxWidth: "800px",
      },
    });

    // API 提供商选择（使用自定义下拉，支持 onChange）
    const providerValue = (getPref("provider") as string) || "openai";
    const providerSelect = createSelect(
      "provider",
      [
        { value: "openai", label: "OpenAI (Responses New Interface)" },
        {
          value: "openai-compat",
          label: "OpenAI Compatible (Legacy ChatCompletions / Third-party)",
        },
        { value: "google", label: "Google Gemini" },
        { value: "anthropic", label: "Anthropic Claude" },
        { value: "openrouter", label: "OpenRouter" },
        { value: "volcanoark", label: "Volcano Engine Ark" },
      ],
      providerValue,
      (newVal) => {
        // 供应商切换时，动态Refresh字段显示
        renderProviderSections(newVal);
        // Cancel Provider 与 PDF 模式的强制联动：用户自行选择 PDF 处理模式
        // 若切换到 Gemini 且未填写，填充默认 URL 与模型
        if (newVal === "google") {
          const curUrl = (getPref("geminiApiUrl") as string) || "";
          const urlInput = this.container.querySelector(
            "#setting-geminiApiUrl",
          ) as HTMLInputElement;
          const modelInput = this.container.querySelector(
            "#setting-geminiModel",
          ) as HTMLInputElement;
          if (urlInput && (!curUrl || urlInput.value.trim() === "")) {
            urlInput.value = "https://generativelanguage.googleapis.com";
          }
          if (
            modelInput &&
            (!modelInput.value || modelInput.value.trim() === "")
          ) {
            modelInput.value = "gemini-2.5-pro";
          }
        }
        // 若切换到 Anthropic 且未填写，填充默认 URL 与模型
        if (newVal === "anthropic") {
          const curUrl = (getPref("anthropicApiUrl") as string) || "";
          const urlInput = this.container.querySelector(
            "#setting-anthropicApiUrl",
          ) as HTMLInputElement;
          const modelInput = this.container.querySelector(
            "#setting-anthropicModel",
          ) as HTMLInputElement;
          if (urlInput && (!curUrl || urlInput.value.trim() === "")) {
            urlInput.value = "https://api.anthropic.com";
          }
          if (
            modelInput &&
            (!modelInput.value || modelInput.value.trim() === "")
          ) {
            modelInput.value = "claude-3-5-sonnet-20241022";
          }
        }
        // 若切换到 OpenRouter 且未填写，填充默认
        if (newVal === "openrouter") {
          const curUrl = (getPref("openRouterApiUrl") as string) || "";
          const urlInput = this.container.querySelector(
            "#setting-openRouterApiUrl",
          ) as HTMLInputElement;
          const modelInput = this.container.querySelector(
            "#setting-openRouterModel",
          ) as HTMLInputElement;
          if (urlInput && (!curUrl || urlInput.value.trim() === "")) {
            urlInput.value = "https://openrouter.ai/api/v1/chat/completions";
          }
          if (
            modelInput &&
            (!modelInput.value || modelInput.value.trim() === "")
          ) {
            modelInput.value = "google/gemma-3-27b-it";
          }
        }
        // 若切换到火山方舟且未填写，填充默认
        if (newVal === "volcanoark") {
          const curUrl = (getPref("volcanoArkApiUrl") as string) || "";
          const urlInput = this.container.querySelector(
            "#setting-volcanoArkApiUrl",
          ) as HTMLInputElement;
          const modelInput = this.container.querySelector(
            "#setting-volcanoArkModel",
          ) as HTMLInputElement;
          if (urlInput && (!curUrl || urlInput.value.trim() === "")) {
            urlInput.value =
              "https://ark.cn-beijing.volces.com/api/v3/responses";
          }
          if (
            modelInput &&
            (!modelInput.value || modelInput.value.trim() === "")
          ) {
            modelInput.value = "doubao-seed-1-8-251228";
          }
        }
      },
    );
    form.appendChild(
      this.createFormGroup(
        "API Provider",
        providerSelect,
        "Select your AI model provider",
      ),
    );

    // Provider 专属字段容器
    const sectionOpenAI = this.createElement("div", { id: "provider-openai" });
    const sectionOpenAICompat = this.createElement("div", {
      id: "provider-openai-compat",
    });
    const sectionGemini = this.createElement("div", { id: "provider-gemini" });
    const sectionAnthropic = this.createElement("div", {
      id: "provider-anthropic",
    });
    const sectionOpenRouter = this.createElement("div", {
      id: "provider-openrouter",
    });
    const sectionVolcanoArk = this.createElement("div", {
      id: "provider-volcanoark",
    });

    // OpenAI 字段（Responses 新接口）
    sectionOpenAI.appendChild(
      this.createFormGroup(
        "API Address *",
        this.createInput(
          "openaiApiUrl",
          "text",
          getPref("openaiApiUrl") as string,
          "https://api.openai.com/v1/responses",
        ),
        "【Required】Official OpenAI address: https://api.openai.com/v1/responses",
      ),
    );
    sectionOpenAI.appendChild(
      this.createFormGroup(
        "API Key *",
        this.createPasswordInput(
          "openaiApiKey",
          getPref("openaiApiKey") as string,
          "sk-...",
          "openai",
        ),
        "【Required】Your API key, stored safely locally. Click + to add more keys for rotation.",
        "openai",
      ),
    );
    sectionOpenAI.appendChild(
      this.createFormGroup(
        "Model *",
        this.createInput(
          "openaiApiModel",
          "text",
          getPref("openaiApiModel") as string,
          "gpt-5",
        ),
        "【Required】The name of the model to use",
      ),
    );

    // OpenAI 新接口说明
    const openaiNote = this.createElement("div", {
      innerHTML:
        "ℹ️ <strong>Note</strong>: This configuration uses the official OpenAI <code>/v1/responses</code> interface (unified multi-modal). If you need compatibility with legacy Chat Completions services (e.g., SiliconFlow), please select <strong>OpenAI Compatible</strong> provider above.",
      styles: {
        padding: "10px 12px",
        backgroundColor: "#e8f5e9",
        border: "1px solid #a5d6a7",
        borderRadius: "6px",
        color: "#2e7d32",
        fontSize: "13px",
        marginBottom: "16px",
      },
    });
    sectionOpenAI.appendChild(openaiNote);

    // OpenAI 兼容（旧 Chat Completions / 第三方）字段
    sectionOpenAICompat.appendChild(
      this.createFormGroup(
        "Compatible API Address *",
        this.createInput(
          "openaiCompatApiUrl",
          "text",
          (getPref("openaiCompatApiUrl") as string) ||
            "https://api.openai.com/v1/chat/completions",
          "https://api.openai.com/v1/chat/completions",
        ),
        "【Required】Legacy Chat Completions endpoint. Example (SiliconFlow): https://api.siliconflow.cn/v1/chat/completions",
      ),
    );
    sectionOpenAICompat.appendChild(
      this.createFormGroup(
        "Compatible API Key *",
        this.createPasswordInput(
          "openaiCompatApiKey",
          (getPref("openaiCompatApiKey") as string) ||
            (getPref("openaiApiKey") as string),
          "sk-...",
          "openai-compat",
        ),
        "【Required】Key for the third-party service. Click + to add more keys for rotation.",
        "openai-compat",
      ),
    );
    sectionOpenAICompat.appendChild(
      this.createFormGroup(
        "Compatible Model *",
        this.createInput(
          "openaiCompatModel",
          "text",
          (getPref("openaiCompatModel") as string) ||
            (getPref("openaiApiModel") as string) ||
            "gpt-3.5-turbo",
          "gpt-3.5-turbo",
        ),
        "【Required】Model name provided by the third-party, such as Qwen/QwQ-32B, deepseek-ai/DeepSeek-V3, etc.",
      ),
    );
    const openaiCompatNote = this.createElement("div", {
      innerHTML:
        '⚠️ <strong>Purpose</strong>: Used for compatibility with legacy <code>/v1/chat/completions</code> format, suitable for third-party aggregators/proxies (SiliconFlow, OpenAI-compatible gateways, etc.).<br/>If using official OpenAI, please select <strong>OpenAI (Responses New Interface)</strong>.<br/>If the third-party doesn\'t support PDF Base64 multi-modal processing, please change the PDF Processing Mode to "Text Extraction".',
      styles: {
        padding: "10px 12px",
        backgroundColor: "#fff8e1",
        border: "1px solid #ffe082",
        borderRadius: "6px",
        color: "#795548",
        fontSize: "13px",
        marginBottom: "16px",
      },
    });
    sectionOpenAICompat.appendChild(openaiCompatNote);

    // Gemini 字段
    sectionGemini.appendChild(
      this.createFormGroup(
        "API Base Address *",
        this.createInput(
          "geminiApiUrl",
          "text",
          getPref("geminiApiUrl") as string,
          "https://generativelanguage.googleapis.com",
        ),
        "【Required】Will be called via /v1beta/models/{model}:streamGenerateContent?alt=sse",
      ),
    );
    sectionGemini.appendChild(
      this.createFormGroup(
        "API Key *",
        this.createPasswordInput(
          "geminiApiKey",
          getPref("geminiApiKey") as string,
          "sk-...",
          "google",
        ),
        "【Required】Your Gemini API Key. Click + to add more keys for rotation.",
        "google",
      ),
    );
    sectionGemini.appendChild(
      this.createFormGroup(
        "Model *",
        this.createInput(
          "geminiModel",
          "text",
          getPref("geminiModel") as string,
          "gemini-2.5-pro",
        ),
        "【Required】Gemini model name, e.g., gemini-2.5-pro",
      ),
    );

    // Anthropic 字段
    sectionAnthropic.appendChild(
      this.createFormGroup(
        "API Base Address *",
        this.createInput(
          "anthropicApiUrl",
          "text",
          getPref("anthropicApiUrl") as string,
          "https://api.anthropic.com",
        ),
        "【Required】Anthropic API base address",
      ),
    );
    sectionAnthropic.appendChild(
      this.createFormGroup(
        "API Key *",
        this.createPasswordInput(
          "anthropicApiKey",
          getPref("anthropicApiKey") as string,
          "sk-ant-...",
          "anthropic",
        ),
        "【Required】Your Anthropic API Key. Click + to add more keys for rotation.",
        "anthropic",
      ),
    );
    sectionAnthropic.appendChild(
      this.createFormGroup(
        "Model *",
        this.createInput(
          "anthropicModel",
          "text",
          getPref("anthropicModel") as string,
          "claude-3-5-sonnet-20241022",
        ),
        "【Required】Claude model name, e.g., claude-3-5-sonnet-20241022",
      ),
    );

    // OpenRouter 字段
    sectionOpenRouter.appendChild(
      this.createFormGroup(
        "API Base Address *",
        this.createInput(
          "openRouterApiUrl",
          "text",
          getPref("openRouterApiUrl") as string,
          "https://openrouter.ai/api/v1/chat/completions",
        ),
        "【Required】OpenRouter API base address",
      ),
    );
    sectionOpenRouter.appendChild(
      this.createFormGroup(
        "API Key *",
        this.createPasswordInput(
          "openRouterApiKey",
          getPref("openRouterApiKey") as string,
          "sk-or-...",
          "openrouter",
        ),
        "【Required】Your OpenRouter API Key. Click + to add more keys for rotation.",
        "openrouter",
      ),
    );
    sectionOpenRouter.appendChild(
      this.createFormGroup(
        "Model *",
        this.createInput(
          "openRouterModel",
          "text",
          getPref("openRouterModel") as string,
          "google/gemma-3-27b-it",
        ),
        "【Required】OpenRouter model name, e.g., google/gemma-3-27b-it",
      ),
    );

    // 火山方舟字段
    sectionVolcanoArk.appendChild(
      this.createFormGroup(
        "API Address *",
        this.createInput(
          "volcanoArkApiUrl",
          "text",
          getPref("volcanoArkApiUrl") as string,
          "https://ark.cn-beijing.volces.com/api/v3/responses",
        ),
        "【Required】Volcano Engine Ark API full address (using Responses API)",
      ),
    );
    sectionVolcanoArk.appendChild(
      this.createFormGroup(
        "API Key *",
        this.createPasswordInput(
          "volcanoArkApiKey",
          getPref("volcanoArkApiKey") as string,
          "ark-...",
          "volcanoark",
        ),
        "【Required】Your Volcano Engine Ark API Key. Click + to add more keys for rotation.",
        "volcanoark",
      ),
    );
    sectionVolcanoArk.appendChild(
      this.createFormGroup(
        "Model *",
        this.createInput(
          "volcanoArkModel",
          "text",
          getPref("volcanoArkModel") as string,
          "doubao-seed-1-8-251228",
        ),
        "【Required】Doubao model name, e.g., doubao-seed-1-8-251228",
      ),
    );
    // 火山方舟说明
    const volcanoArkNote = this.createElement("div", {
      innerHTML:
        "ℹ️ <strong>Note</strong>: Volcano Engine Ark provides 2 million free tokens daily and supports multi-modal understanding.<br/>Recommended models: <code>doubao-seed-1-8-251228</code>, <code>doubao-seed-1-6-250615</code>",
      styles: {
        padding: "10px 12px",
        backgroundColor: "#e8f5e9",
        border: "1px solid #a5d6a7",
        borderRadius: "6px",
        color: "#2e7d32",
        fontSize: "13px",
        marginBottom: "16px",
      },
    });
    sectionVolcanoArk.appendChild(volcanoArkNote);

    form.appendChild(sectionOpenAI);
    form.appendChild(sectionOpenAICompat);
    form.appendChild(sectionGemini);
    form.appendChild(sectionAnthropic);
    form.appendChild(sectionOpenRouter);
    form.appendChild(sectionVolcanoArk);

    const renderProviderSections = (prov: string) => {
      const isGemini = prov === "google";
      const isAnthropic = prov === "anthropic";
      const isOpenRouter = prov === "openrouter";
      const isOpenAICompat = prov === "openai-compat";
      const isVolcanoArk = prov === "volcanoark";
      (sectionOpenAI as HTMLElement).style.display =
        isGemini ||
        isAnthropic ||
        isOpenAICompat ||
        isOpenRouter ||
        isVolcanoArk
          ? "none"
          : "block";
      (sectionOpenAICompat as HTMLElement).style.display = isOpenAICompat
        ? "block"
        : "none";
      (sectionGemini as HTMLElement).style.display = isGemini
        ? "block"
        : "none";
      (sectionAnthropic as HTMLElement).style.display = isAnthropic
        ? "block"
        : "none";
      (sectionOpenRouter as HTMLElement).style.display = isOpenRouter
        ? "block"
        : "none";
      (sectionVolcanoArk as HTMLElement).style.display = isVolcanoArk
        ? "block"
        : "none";
    };
    renderProviderSections(providerValue);

    // Temperature 参数（Optional启用）
    const tempContainer = this.createElement("div", {
      styles: { display: "flex", alignItems: "center", gap: "12px" },
    });
    const enableTemp = ((getPref("enableTemperature") as any) ??
      true) as boolean;
    const tempToggle = this.createCheckbox("enableTemperature", enableTemp);
    const tempSlider = this.createSlider(
      "temperature",
      0,
      2,
      0.1,
      parseFloat((getPref("temperature") as string) || "0.7"),
    );
    // 控制禁用状态
    setTimeout(() => {
      const sliderEl = tempSlider.querySelector(
        "#setting-temperature",
      ) as HTMLInputElement;
      const cbEl = tempToggle.querySelector(
        "#setting-enableTemperature",
      ) as HTMLInputElement;
      if (sliderEl && cbEl) {
        sliderEl.disabled = !cbEl.checked;
        cbEl.addEventListener("change", () => {
          sliderEl.disabled = !cbEl.checked;
        });
      }
    }, 0);
    tempContainer.appendChild(tempToggle);
    tempContainer.appendChild(tempSlider);
    form.appendChild(
      this.createFormGroup(
        "Temperature",
        tempContainer,
        "Controls output randomness (0-2). Higher values are more random. Parameter is not sent if unchecked.",
      ),
    );

    // Max Tokens 参数（Optional启用）
    const maxContainer = this.createElement("div", {
      styles: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "nowrap",
      },
    });
    const enableMax = ((getPref("enableMaxTokens") as any) ?? true) as boolean;
    const maxToggle = this.createCheckbox("enableMaxTokens", enableMax);
    const maxInput = this.createInput(
      "maxTokens",
      "number",
      ((getPref("maxTokens") as string) || "4096") as string,
      "4096",
    );
    // 缩短输入框，保持与 Temperature 行一致的紧凑布局
    Object.assign(maxInput.style, {
      width: "180px",
      flex: "0 0 180px",
    });
    setTimeout(() => {
      const inputEl = this.container.querySelector(
        "#setting-maxTokens",
      ) as HTMLInputElement;
      const cbEl = maxToggle.querySelector(
        "#setting-enableMaxTokens",
      ) as HTMLInputElement;
      if (inputEl && cbEl) {
        inputEl.disabled = !cbEl.checked;
        cbEl.addEventListener("change", () => {
          inputEl.disabled = !cbEl.checked;
        });
      }
    }, 0);
    maxContainer.appendChild(maxToggle);
    maxContainer.appendChild(maxInput);
    form.appendChild(
      this.createFormGroup(
        "Max Tokens",
        maxContainer,
        "Maximum number of tokens to generate. Parameter is not sent if unchecked (optional for some services).",
      ),
    );

    // Top P 参数（Optional启用）
    const topPContainer = this.createElement("div", {
      styles: { display: "flex", alignItems: "center", gap: "12px" },
    });
    const enableTopP = ((getPref("enableTopP") as any) ?? true) as boolean;
    const topPToggle = this.createCheckbox("enableTopP", enableTopP);
    const topPSlider = this.createSlider(
      "topP",
      0,
      1,
      0.05,
      parseFloat((getPref("topP") as string) || "1.0"),
    );
    setTimeout(() => {
      const sliderEl = topPSlider.querySelector(
        "#setting-topP",
      ) as HTMLInputElement;
      const cbEl = topPToggle.querySelector(
        "#setting-enableTopP",
      ) as HTMLInputElement;
      if (sliderEl && cbEl) {
        sliderEl.disabled = !cbEl.checked;
        cbEl.addEventListener("change", () => {
          sliderEl.disabled = !cbEl.checked;
        });
      }
    }, 0);
    topPContainer.appendChild(topPToggle);
    topPContainer.appendChild(topPSlider);
    form.appendChild(
      this.createFormGroup(
        "Top P",
        topPContainer,
        "Nucleus sampling parameter (0-1). Controls output diversity. Parameter is not sent if unchecked.",
      ),
    );

    // 流式输出开关
    form.appendChild(
      this.createFormGroup(
        "Stream Output",
        this.createCheckbox("stream", getPref("stream") as boolean),
        "Enables real-time display of the generation process",
      ),
    );

    // Request timeout配置
    form.appendChild(
      this.createFormGroup(
        "Request Timeout (ms)",
        this.createInput(
          "requestTimeout",
          "number",
          getPref("requestTimeout") as string,
          "300000",
        ),
        "API request timeout. Default is 300,000ms (5 mins), minimum is 30,000ms (30 secs).",
      ),
    );

    // === 调度配置分隔线 ===
    const scheduleTitle = this.createElement("h3", {
      textContent: "📅 Scheduling Configuration",
      styles: {
        color: "#667eea",
        marginTop: "40px",
        marginBottom: "20px",
        fontSize: "18px",
        borderBottom: "2px solid #667eea",
        paddingBottom: "8px",
      },
    });
    form.appendChild(scheduleTitle);

    // 每批次处理论文数量
    form.appendChild(
      this.createFormGroup(
        "Number of papers per batch",
        this.createInput(
          "batchSize",
          "number",
          getPref("batchSize") as string,
          "1",
        ),
        "Number of papers processed simultaneously. Recommended set to 1 to avoid API rate limiting.",
      ),
    );

    // 批次间隔时间
    form.appendChild(
      this.createFormGroup(
        "Batch interval (seconds)",
        this.createInput(
          "batchInterval",
          "number",
          getPref("batchInterval") as string,
          "60",
        ),
        "Wait time between batches to control API call frequency.",
      ),
    );

    // 自动扫描间隔
    form.appendChild(
      this.createFormGroup(
        "Auto scan interval (seconds)",
        this.createInput(
          "scanInterval",
          "number",
          getPref("scanInterval") as string,
          "300",
        ),
        "Interval for background automatic scanning of new literature. Default is 5 minutes.",
      ),
    );

    // === API 轮换配置分隔线 ===
    const rotationTitle = this.createElement("h3", {
      textContent: "🔄 API Rotation Configuration",
      styles: {
        color: "#9c27b0",
        marginTop: "40px",
        marginBottom: "20px",
        fontSize: "18px",
        borderBottom: "2px solid #9c27b0",
        paddingBottom: "8px",
      },
    });
    form.appendChild(rotationTitle);

    // API 轮换说明
    const rotationNote = this.createElement("div", {
      innerHTML:
        "ℹ️ <strong>Note</strong>: After configuring backup API keys, if the primary key fails, it will automatically switch to a backup key to continue, improving task success rate.",
      styles: {
        padding: "10px 12px",
        backgroundColor: "#f3e5f5",
        border: "1px solid #ce93d8",
        borderRadius: "6px",
        color: "#6a1b9a",
        fontSize: "13px",
        marginBottom: "16px",
      },
    });
    form.appendChild(rotationNote);

    // 最大切换次数
    form.appendChild(
      this.createFormGroup(
        "Maximum switch count",
        this.createInput(
          "maxApiSwitchCount",
          "number",
          (getPref("maxApiSwitchCount" as any) as string) || "3",
          "3",
        ),
        "Maximum number of times to switch keys when an API call fails. Default is 3.",
      ),
    );

    // 失败冷却时间
    form.appendChild(
      this.createFormGroup(
        "Failure cooldown (seconds)",
        this.createInput(
          "failedKeyCooldownSeconds",
          "number",
          String(
            Math.floor(
              (parseInt(
                (getPref("failedKeyCooldown" as any) as string) || "300000",
              ) || 300000) / 1000,
            ),
          ),
          "300",
        ),
        "How long a failed key needs to cool down before it can be used again. Default is 300 seconds (5 minutes).",
      ),
    );

    // === PDF 处理配置分隔线 ===
    const pdfTitle = this.createElement("h3", {
      textContent: "📄 PDF Processing Configuration",
      styles: {
        color: "#ff9800",
        marginTop: "40px",
        marginBottom: "20px",
        fontSize: "18px",
        borderBottom: "2px solid #ff9800",
        paddingBottom: "8px",
      },
    });
    form.appendChild(pdfTitle);

    // PDF 处理模式选择
    const pdfModeValue = (getPref("pdfProcessMode") as string) || "base64";
    const pdfModeSelect = createSelect(
      "pdfProcessMode",
      [
        {
          value: "base64",
          label: "Base64 Encoding (Recommended, supports multi-modal)",
        },
        { value: "text", label: "Text Extraction (Text only)" },
        { value: "mineru", label: "MinerU (High-quality layout restoration)" },
      ],
      pdfModeValue,
      (newVal) => {
        // Toggle Mineru API Key visibility
        const mineruSection = this.container.querySelector(
          "#provider-mineru",
        ) as HTMLElement;
        if (mineruSection) {
          mineruSection.style.display = newVal === "mineru" ? "block" : "none";
        }

        // 当用户手动调整 PDF 模式，也给出一个轻量提示
        let msg = "";
        if (newVal === "base64")
          msg =
            "Base64 mode selected: Better multi-modal support, suitable for Gemini, etc.";
        else if (newVal === "text")
          msg =
            "Text Extraction mode selected: Text only, suitable for Anthropic, etc.";
        else if (newVal === "mineru")
          msg =
            "MinerU mode selected: API Key required for advanced formula/table restoration.";

        try {
          new ztoolkit.ProgressWindow("AI Butler", {
            closeOnClick: true,
            closeTime: 2500,
          })
            .createLine({ text: msg, type: "info" })
            .show();
        } catch (e) {
          try {
            ztoolkit.log("[API Settings] Show PDF mode tip failed:", e);
          } catch (_ignore) {
            // ignore
          }
        }
      },
    );
    form.appendChild(
      this.createFormGroup(
        "PDF Processing Mode",
        pdfModeSelect,
        "Base64: Native image recognition; Text Extraction: Default Zotero extraction; MinerU: High-quality restoration of complex formulas and tables via API.",
      ),
    );

    // MinerU 专属配置区域
    const sectionMineru = this.createElement("div", { id: "provider-mineru" });
    sectionMineru.style.display = pdfModeValue === "mineru" ? "block" : "none";

    const mineruInputWrapper = this.createPasswordInput(
      "mineruApiKey",
      (getPref("mineruApiKey") as string) || "",
      "Configure to enable high-quality formula and table recognition...",
    );

    // 手动绑定保存事件，因为 createPasswordInput 只有存在 providerId 时才自动保存
    const mineruInputEl = mineruInputWrapper.querySelector(
      "input",
    ) as HTMLInputElement;
    if (mineruInputEl) {
      let saveTimeout: ReturnType<typeof setTimeout> | null = null;
      const saveMineruKey = () => {
        setPref("mineruApiKey" as any, mineruInputEl.value.trim());
      };

      mineruInputEl.addEventListener("input", () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveMineruKey, 500);
      });

      mineruInputEl.addEventListener("blur", () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveMineruKey();
      });
    }

    sectionMineru.appendChild(
      this.createFormGroup(
        "MinerU API Key *",
        mineruInputWrapper,
        "【Required】Please visit https://mineru.net/ to apply for an API Key",
      ),
    );
    form.appendChild(sectionMineru);

    // PDF 大小限制设置
    const sizeLimitContainer = this.createElement("div", {
      styles: { display: "flex", alignItems: "center", gap: "12px" },
    });
    const enableSizeLimit = ((getPref("enablePdfSizeLimit" as any) as any) ??
      false) as boolean;
    const sizeLimitToggle = this.createCheckbox(
      "enablePdfSizeLimit",
      enableSizeLimit,
    );
    const maxSizeInput = this.createInput(
      "maxPdfSizeMB",
      "number",
      ((getPref("maxPdfSizeMB" as any) as string) || "50") as string,
      "50",
    );
    // 缩短输入框宽度
    Object.assign(maxSizeInput.style, {
      width: "100px",
      flex: "0 0 100px",
    });
    const mbLabel = this.createElement("span", {
      textContent: "MB",
      styles: { fontSize: "14px", color: "#666" },
    });

    // 控制输入框禁用状态
    setTimeout(() => {
      const inputEl = this.container.querySelector(
        "#setting-maxPdfSizeMB",
      ) as HTMLInputElement;
      const cbEl = sizeLimitToggle.querySelector(
        "#setting-enablePdfSizeLimit",
      ) as HTMLInputElement;
      if (inputEl && cbEl) {
        inputEl.disabled = !cbEl.checked;
        cbEl.addEventListener("change", () => {
          inputEl.disabled = !cbEl.checked;
        });
      }
    }, 0);

    sizeLimitContainer.appendChild(sizeLimitToggle);
    sizeLimitContainer.appendChild(maxSizeInput);
    sizeLimitContainer.appendChild(mbLabel);
    form.appendChild(
      this.createFormGroup(
        "Attachment size limit",
        sizeLimitContainer,
        "If enabled, PDF files exceeding the specified size will be skipped during auto-scan to avoid triggering API limits.",
      ),
    );

    // PDF 附件选择模式
    const pdfAttachmentModeValue =
      (getPref("pdfAttachmentMode" as any) as string) || "default";
    const pdfAttachmentModeSelect = createSelect(
      "pdfAttachmentMode",
      [
        {
          value: "default",
          label: "Default PDF only (earliest added attachment)",
        },
        { value: "all", label: "All PDFs (multi-file upload)" },
      ],
      pdfAttachmentModeValue,
      (newVal) => {
        const msg =
          newVal === "all"
            ? "All PDFs mode selected: All attachments will be sent to the LLM simultaneously."
            : "Default PDF mode selected: Only the earliest added attachment will be used.";
        try {
          new ztoolkit.ProgressWindow("AI Butler", {
            closeOnClick: true,
            closeTime: 2500,
          })
            .createLine({ text: msg, type: "info" })
            .show();
        } catch (e) {
          ztoolkit.log(
            "[API Settings] Show PDF attachment mode tip failed:",
            e,
          );
        }
      },
    );
    form.appendChild(
      this.createFormGroup(
        "Multi-PDF attachment mode",
        pdfAttachmentModeSelect,
        "Processing method when a paper has multiple PDF attachments. 'All PDFs' mode only supports Gemini; other providers will automatically fall back to default mode.",
      ),
    );

    const buttonGroup = this.createElement("div", {
      styles: {
        display: "flex",
        gap: "12px",
        marginTop: "30px",
        paddingTop: "20px",
        borderTop: "1px solid #eee",
      },
    });

    // 测试连接按钮
    const testButton = this.createButton("🔍 Test Connection", "#2196f3");
    testButton.addEventListener("click", () => this.testApiConnection());
    buttonGroup.appendChild(testButton);

    // 保存按钮
    const saveButton = this.createButton("💾 Save Settings", "#4caf50");
    saveButton.addEventListener("click", () => this.saveSettings());
    buttonGroup.appendChild(saveButton);

    // 重置按钮
    const resetButton = this.createButton("🔄 Reset Defaults", "#9e9e9e");
    resetButton.addEventListener("click", () => this.resetSettings());
    buttonGroup.appendChild(resetButton);

    form.appendChild(buttonGroup);

    // 测试结果展示区域（防止进度窗文本过长被截断）
    const resultBox = this.createElement("div", {
      id: "api-test-result",
      styles: {
        display: "none",
        marginTop: "12px",
        padding: "12px 14px",
        borderRadius: "6px",
        backgroundColor: "#fff8e1",
        border: "1px solid #ffe082",
      },
    });
    // 标题 + 复制按钮
    const resultTitle = this.createElement("div", {
      styles: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        marginBottom: "6px",
      },
    });
    const resultTitleText = this.createElement("span", {
      textContent: "API Connection Test Results",
      styles: { fontSize: "13px", fontWeight: "600" },
    });
    // 按钮容器
    const buttonContainer = this.createElement("div", {
      styles: { display: "flex", gap: "8px" },
    });
    const copyBtn = this.createElement("button", {
      textContent: "Copy Details",
      styles: {
        border: "1px solid #ddd",
        background: "#fff",
        color: "#333",
        borderRadius: "4px",
        padding: "4px 8px",
        cursor: "pointer",
        fontSize: "12px",
      },
    });
    copyBtn.addEventListener("click", async () => {
      const text = (resultPre.textContent || "").toString();
      const win = Zotero.getMainWindow() as any;
      const doc = win?.document as Document | undefined;
      const nav = (win as any)?.navigator as any;
      try {
        if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(text);
        } else {
          throw new Error("clipboard api unavailable");
        }
        new ztoolkit.ProgressWindow("API Connection Test", { closeTime: 1500 })
          .createLine({ text: "Error details copied", type: "success" })
          .show();
      } catch {
        try {
          if (!doc) throw new Error("no document");
          const tmp = doc.createElement("textarea");
          tmp.value = text;
          (tmp.style as any).position = "fixed";
          (tmp.style as any).left = "-9999px";
          (doc.documentElement || doc.body || doc).appendChild(tmp);
          (tmp as any).select?.();
          (doc as any).execCommand?.("copy");
          (tmp as any).remove?.();
          new ztoolkit.ProgressWindow("API Connection Test", {
            closeTime: 1500,
          })
            .createLine({ text: "Error details copied", type: "success" })
            .show();
        } catch {
          new ztoolkit.ProgressWindow("API Connection Test", {
            closeTime: 2500,
          })
            .createLine({
              text: "Copy failed, please select and copy manually",
              type: "default",
            })
            .show();
        }
      }
    });
    buttonContainer.appendChild(copyBtn);
    resultTitle.appendChild(resultTitleText);
    resultTitle.appendChild(buttonContainer);
    const resultPre = this.createElement("pre", {
      id: "api-test-result-text",
      styles: {
        margin: "0",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        maxHeight: "240px",
        overflow: "auto",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: "12px",
        lineHeight: "1.5",
        color: "#5d4037",
      },
    });
    resultBox.appendChild(resultTitle);
    resultBox.appendChild(resultPre);
    form.appendChild(resultBox);
    this.container.appendChild(form);
  }

  /**
   * 创建元素
   */
  private createElement(tag: string, options: any): HTMLElement {
    const doc = Zotero.getMainWindow().document;
    const element = doc.createElement(tag);

    if (options.textContent) {
      element.textContent = options.textContent;
    }

    if (options.innerHTML) {
      element.innerHTML = options.innerHTML;
    }

    if (options.id) {
      element.id = options.id;
    }

    if (options.className) {
      element.className = options.className;
    }

    if (options.styles) {
      Object.assign(element.style, options.styles);
    }

    if (options.children) {
      options.children.forEach((child: HTMLElement) => {
        element.appendChild(child);
      });
    }

    return element;
  }

  /**
   * 创建表单组
   */
  private createFormGroup(
    label: string,
    input: HTMLElement,
    description?: string,
    providerId?: ProviderId,
  ): HTMLElement {
    const group = this.createElement("div", {
      styles: {
        marginBottom: "24px",
      },
    });

    // 标签行：包含标签和Optional的密钥数量徽标
    const labelRow = this.createElement("div", {
      styles: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "8px",
      },
    });

    const labelElement = this.createElement("label", {
      textContent: label,
      styles: {
        fontSize: "14px",
        fontWeight: "600",
        color: "#333",
      },
    });
    labelRow.appendChild(labelElement);

    // 密钥数量徽标（仅当 providerId 存在时显示）
    if (providerId) {
      const badge = this.createElement("span", {
        styles: {
          padding: "3px 8px",
          backgroundColor: "#e3f2fd",
          color: "#1565c0",
          borderRadius: "10px",
          fontSize: "11px",
          fontWeight: "500",
        },
      });
      badge.setAttribute("data-key-badge", providerId);
      this.updateKeyBadge(badge, providerId);
      labelRow.appendChild(badge);
    }

    group.appendChild(labelRow);
    group.appendChild(input);

    if (description) {
      const desc = this.createElement("div", {
        textContent: description,
        styles: {
          marginTop: "6px",
          fontSize: "12px",
          color: "#666",
        },
      });
      group.appendChild(desc);
    }

    return group;
  }

  /**
   * 创建文本输入框
   */
  private createInput(
    id: string,
    type: string,
    value: string,
    placeholder?: string,
  ): HTMLInputElement {
    const doc = Zotero.getMainWindow().document;
    const input = doc.createElement("input");
    input.type = type;
    input.id = `setting-${id}`;
    input.value = value || "";
    if (placeholder) input.placeholder = placeholder;

    Object.assign(input.style, {
      width: "100%",
      padding: "10px 12px",
      fontSize: "14px",
      border: "1px solid #ddd",
      borderRadius: "4px",
      boxSizing: "border-box",
      textAlign: "left",
    });

    input.addEventListener("focus", () => {
      input.style.borderColor = "#59c0bc";
      input.style.outline = "none";
    });

    input.addEventListener("blur", () => {
      input.style.borderColor = "#ddd";
    });

    return input;
  }

  /**
   * 创建密码输入框（支持多密钥管理）
   *
   * @param id 输入框ID
   * @param value 当前值
   * @param placeholder 占位符
   * @param providerId Optional的提供商ID，用于多密钥管理
   */
  private createPasswordInput(
    id: string,
    value: string,
    placeholder?: string,
    providerId?: ProviderId,
  ): HTMLElement {
    const wrapper = this.createElement("div", {
      styles: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      },
    });
    if (providerId) {
      wrapper.setAttribute("data-key-wrapper", providerId);
    }

    // 第一行：状态 + 密钥1 + 输入框 + 按钮
    const container = this.createElement("div", {
      styles: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
      },
    });

    // 状态指示器（放最前面，可点击禁用/启用）
    if (providerId) {
      const keyIndex = 0;
      const isDisabled = ApiKeyManager.isKeyDisabled(providerId, keyIndex);
      const hasValue = !!value?.trim();
      const statusIcon = this.createElement("span", {
        textContent: "●",
        styles: {
          color: isDisabled ? "#9e9e9e" : hasValue ? "#4caf50" : "#bbb",
          fontSize: "14px",
          lineHeight: "1",
          cursor: "pointer",
        },
      });
      const getTooltip = (disabled: boolean, configured: boolean) => {
        const status = disabled
          ? "Disabled"
          : configured
            ? "Configured"
            : "Not Configured";
        const action = disabled ? "Click to enable" : "Click to disable";
        return `${status} | ${action}`;
      };
      statusIcon.title = getTooltip(isDisabled, hasValue);
      statusIcon.setAttribute("data-key-status", `${providerId}-${keyIndex}`);
      statusIcon.addEventListener("click", () => {
        const nowDisabled = ApiKeyManager.toggleKeyDisabled(
          providerId,
          keyIndex,
        );
        statusIcon.style.color = nowDisabled
          ? "#9e9e9e"
          : hasValue
            ? "#4caf50"
            : "#bbb";
        statusIcon.title = getTooltip(nowDisabled, hasValue);
        this.updateAllKeyBadges(providerId);
      });
      container.appendChild(statusIcon);
    }

    // 密钥1标签
    if (providerId) {
      const keyLabel = this.createElement("span", {
        textContent: "Key 1",
        styles: {
          fontSize: "12px",
          color: "#666",
          whiteSpace: "nowrap",
        },
      });
      container.appendChild(keyLabel);
    }

    // 输入框
    const input = this.createInput(id, "password", value, placeholder);
    input.style.flex = "1";

    // 自动保存第一个密钥（与额外密钥行为一致）
    if (providerId) {
      const mapping: Record<ProviderId, string> = {
        openai: "openaiApiKey",
        "openai-compat": "openaiCompatApiKey",
        google: "geminiApiKey",
        anthropic: "anthropicApiKey",
        openrouter: "openRouterApiKey",
        volcanoark: "volcanoArkApiKey",
      };
      const prefKey = mapping[providerId];
      if (prefKey) {
        let saveTimeout: ReturnType<typeof setTimeout> | null = null;
        const saveFirstKey = () => {
          const newKey = input.value?.trim() || "";
          setPref(prefKey as any, newKey);
          // Update状态指示器
          const statusIconEl = container.querySelector(
            "[data-key-status]",
          ) as HTMLElement | null;
          if (statusIconEl) {
            const isDisabled = ApiKeyManager.isKeyDisabled(providerId, 0);
            statusIconEl.style.color = isDisabled
              ? "#9e9e9e"
              : newKey
                ? "#4caf50"
                : "#bbb";
          }
          this.updateAllKeyBadges(providerId);
          ztoolkit.log(`[ApiSettingsPage] Auto-save key 1: ${prefKey}`);
        };
        input.addEventListener("input", () => {
          if (saveTimeout) clearTimeout(saveTimeout);
          saveTimeout = setTimeout(saveFirstKey, 500);
        });
        input.addEventListener("blur", () => {
          if (saveTimeout) clearTimeout(saveTimeout);
          saveFirstKey();
        });
      }
    }

    container.appendChild(input);

    // 显示/隐藏按钮
    const toggleButton = this.createElement("button", {
      textContent: "👁️",
      styles: {
        padding: "8px 12px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        backgroundColor: "#f5f5f5",
        cursor: "pointer",
        fontSize: "14px",
        lineHeight: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    });
    toggleButton.title = "Show/Hide Key";

    let isVisible = false;
    toggleButton.addEventListener("click", (e) => {
      e.preventDefault();
      isVisible = !isVisible;
      input.type = isVisible ? "text" : "password";
      toggleButton.textContent = isVisible ? "🙈" : "👁️";
    });
    container.appendChild(toggleButton);

    // 添加密钥按钮
    if (providerId) {
      const addButton = this.createElement("button", {
        textContent: "+",
        styles: {
          padding: "8px 12px",
          border: "1px solid #4caf50",
          borderRadius: "4px",
          backgroundColor: "#e8f5e9",
          color: "#2e7d32",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "bold",
          lineHeight: "1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      });
      addButton.title = "Add More Keys";

      addButton.addEventListener("mouseenter", () => {
        addButton.style.backgroundColor = "#4caf50";
        addButton.style.color = "#fff";
      });
      addButton.addEventListener("mouseleave", () => {
        addButton.style.backgroundColor = "#e8f5e9";
        addButton.style.color = "#2e7d32";
      });

      addButton.addEventListener("click", (e) => {
        e.preventDefault();
        this.addExtraKeyField(wrapper, providerId);
        this.updateAllKeyBadges(providerId);
      });

      container.appendChild(addButton);
    }

    wrapper.appendChild(container);

    // 渲染已有的额外密钥
    if (providerId) {
      const extraKeys = ApiKeyManager.getExtraKeys(providerId);
      for (let i = 0; i < extraKeys.length; i++) {
        this.renderExtraKeyField(wrapper, providerId, i, extraKeys[i]);
      }
    }

    return wrapper;
  }

  /**
   * Update密钥数量徽标
   */
  private updateKeyBadge(badge: HTMLElement, providerId: ProviderId): void {
    const allKeys = ApiKeyManager.getAllKeys(providerId);
    const total = allKeys.length;
    const valid = allKeys.filter((k) => k?.trim()).length;
    const disabled = ApiKeyManager.getDisabledCount(providerId);
    if (disabled > 0) {
      badge.textContent = `${total} total, ${valid} valid, ${disabled} disabled`;
    } else {
      badge.textContent = `${total} total keys, ${valid} valid`;
    }
  }

  /**
   * Update所有徽标（删除或添加密钥后调用）
   */
  private updateAllKeyBadges(providerId: ProviderId): void {
    const badges = this.container.querySelectorAll(
      `[data-key-badge="${providerId}"]`,
    );
    badges.forEach((badge: Element) => {
      this.updateKeyBadge(badge as HTMLElement, providerId);
    });
  }

  /**
   * 添加额外密钥输入框
   */
  private addExtraKeyField(wrapper: HTMLElement, providerId: ProviderId): void {
    const extraKeys = ApiKeyManager.getExtraKeys(providerId);
    const index = extraKeys.length;

    // 先保存一个空占位符
    extraKeys.push("");
    ApiKeyManager.saveExtraKeys(providerId, extraKeys);

    // 创建新的空输入框
    this.renderExtraKeyField(wrapper, providerId, index, "");
  }

  /**
   * 渲染额外密钥输入框（自动保存）
   */
  private renderExtraKeyField(
    wrapper: HTMLElement,
    providerId: ProviderId,
    index: number,
    value: string,
  ): void {
    const container = this.createElement("div", {
      styles: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
      },
    });
    container.setAttribute("data-extra-key-index", String(index));
    container.setAttribute("data-provider-id", providerId);

    // 状态指示器（放最前面，可点击禁用/启用）
    const keyIndex = index + 1; // 额外密钥从索引1开始
    const isDisabled = ApiKeyManager.isKeyDisabled(providerId, keyIndex);
    const hasValue = !!value?.trim();
    const statusIcon = this.createElement("span", {
      textContent: "●",
      styles: {
        color: isDisabled ? "#9e9e9e" : hasValue ? "#4caf50" : "#bbb",
        fontSize: "14px",
        lineHeight: "1",
        cursor: "pointer",
      },
    });
    const getTooltip = (disabled: boolean, configured: boolean) => {
      const status = disabled
        ? "Disabled"
        : configured
          ? "Configured"
          : "Not Configured";
      const action = disabled ? "Click to enable" : "Click to disable";
      return `${status} | ${action}`;
    };
    statusIcon.title = getTooltip(isDisabled, hasValue);
    statusIcon.setAttribute("data-key-status", `${providerId}-${keyIndex}`);
    statusIcon.addEventListener("click", () => {
      const nowDisabled = ApiKeyManager.toggleKeyDisabled(providerId, keyIndex);
      statusIcon.style.color = nowDisabled
        ? "#9e9e9e"
        : hasValue
          ? "#4caf50"
          : "#bbb";
      statusIcon.title = getTooltip(nowDisabled, hasValue);
      this.updateAllKeyBadges(providerId);
    });
    container.appendChild(statusIcon);

    // 密钥标签
    const label = this.createElement("span", {
      textContent: `Key ${index + 2}`,
      styles: {
        fontSize: "12px",
        color: "#666",
        whiteSpace: "nowrap",
      },
    });
    container.appendChild(label);

    // 密码输入框
    const input = this.createInput(
      `${providerId}-extraKey-${index}`,
      "password",
      value,
      "sk-...",
    );
    input.style.flex = "1";

    // 自动保存（输入时延迟保存）
    let saveTimeout: ReturnType<typeof setTimeout> | null = null;
    const saveKey = () => {
      const newKey = input.value?.trim() || "";
      const extraKeys = ApiKeyManager.getExtraKeys(providerId);
      const currentIdx = parseInt(
        container.getAttribute("data-extra-key-index") || "0",
      );
      // 确保数组足够大以容纳当前索引
      while (extraKeys.length <= currentIdx) {
        extraKeys.push("");
      }
      extraKeys[currentIdx] = newKey;
      ApiKeyManager.saveExtraKeys(providerId, extraKeys);
      // Update状态图标
      const statusIconEl = container.querySelector(
        "[data-key-status]",
      ) as HTMLElement;
      if (statusIconEl) {
        statusIconEl.style.color = newKey ? "#4caf50" : "#bbb";
        statusIconEl.title = newKey ? "Configured" : "Not Configured";
      }
      // Update徽标
      this.updateAllKeyBadges(providerId);
    };

    input.addEventListener("input", () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveKey, 500);
    });
    input.addEventListener("blur", () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveKey();
    });

    container.appendChild(input);

    // 显示/隐藏按钮
    const toggleBtn = this.createElement("button", {
      textContent: "👁️",
      styles: {
        padding: "8px 12px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        backgroundColor: "#f5f5f5",
        cursor: "pointer",
        fontSize: "14px",
        lineHeight: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    });
    toggleBtn.title = "Show/Hide";
    let isVisible = false;
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      isVisible = !isVisible;
      input.type = isVisible ? "text" : "password";
      toggleBtn.textContent = isVisible ? "🙈" : "👁️";
    });
    container.appendChild(toggleBtn);

    // 删除按钮
    const deleteBtn = this.createElement("button", {
      textContent: "×",
      styles: {
        padding: "8px 12px",
        border: "1px solid #f44336",
        borderRadius: "4px",
        backgroundColor: "#ffebee",
        color: "#c62828",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "bold",
        lineHeight: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    });
    deleteBtn.title = "Delete This Key";
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const currentIdx = parseInt(
        container.getAttribute("data-extra-key-index") || "0",
      );
      ApiKeyManager.removeExtraKey(providerId, currentIdx);
      container.remove();
      this.refreshExtraKeyIndices(wrapper, providerId);
      this.updateAllKeyBadges(providerId);
    });
    container.appendChild(deleteBtn);

    wrapper.appendChild(container);
  }

  /**
   * Refresh额外密钥的索引显示
   */
  private refreshExtraKeyIndices(
    wrapper: HTMLElement,
    providerId: ProviderId,
  ): void {
    const containers = wrapper.querySelectorAll(
      `[data-provider-id="${providerId}"]`,
    );
    containers.forEach((container: Element, idx: number) => {
      container.setAttribute("data-extra-key-index", String(idx));
      const label = container.querySelector("span:first-child") as HTMLElement;
      if (label && !label.hasAttribute("data-key-status")) {
        label.textContent = `Key ${idx + 2}:`;
      }
      // Update状态指示器的ID
      const statusIcon = container.querySelector("[data-key-status]");
      if (statusIcon) {
        statusIcon.setAttribute("data-key-status", `${providerId}-${idx + 1}`);
      }
    });
  }

  /**
   * 创建滑块
   */
  private createSlider(
    id: string,
    min: number,
    max: number,
    step: number,
    value: number,
  ): HTMLElement {
    const doc = Zotero.getMainWindow().document;
    const container = this.createElement("div", {
      styles: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
      },
    });

    const slider = doc.createElement("input");
    slider.type = "range";
    slider.id = `setting-${id}`;
    slider.min = min.toString();
    slider.max = max.toString();
    slider.step = step.toString();
    slider.value = value.toString();

    Object.assign(slider.style, {
      flex: "1",
      height: "6px",
      borderRadius: "3px",
      outline: "none",
    });

    const valueDisplay = this.createElement("span", {
      textContent: value.toFixed(2),
      styles: {
        minWidth: "50px",
        textAlign: "right",
        fontSize: "14px",
        fontWeight: "600",
        color: "#59c0bc",
      },
    });

    slider.addEventListener("input", () => {
      valueDisplay.textContent = parseFloat(slider.value).toFixed(2);
    });

    container.appendChild(slider);
    container.appendChild(valueDisplay);

    return container;
  }

  /**
   * 创建复选框
   */
  private createCheckbox(id: string, checked: boolean): HTMLElement {
    const doc = Zotero.getMainWindow().document;
    const container = this.createElement("div", {
      styles: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
      },
    });

    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `setting-${id}`;
    checkbox.checked = checked;

    Object.assign(checkbox.style, {
      width: "20px",
      height: "20px",
      cursor: "pointer",
    });

    const label = this.createElement("span", {
      textContent: checked ? "Enabled" : "Disabled",
      styles: {
        fontSize: "14px",
        color: "#666",
      },
    });

    checkbox.addEventListener("change", () => {
      label.textContent = checkbox.checked ? "Enabled" : "Disabled";
    });

    container.appendChild(checkbox);
    container.appendChild(label);

    return container;
  }

  /**
   * 创建按钮
   */
  private createButton(text: string, color: string): HTMLButtonElement {
    return createStyledButton(text, color);
  }

  /**
   * 保存设置
   */
  private async saveSettings(): Promise<void> {
    try {
      // 🔧 修复: 在 container 内查找元素,而不是在主窗口 document 中
      ztoolkit.log("[API Settings] Starting save...");

      // 获取表单值 - 使用 querySelector 在 container 内查找
      const providerEl = this.container.querySelector(
        "#setting-provider",
      ) as HTMLElement;
      // OpenAI
      const apiUrlEl = this.container.querySelector(
        "#setting-openaiApiUrl",
      ) as HTMLInputElement;
      const apiKeyEl = this.container.querySelector(
        "#setting-openaiApiKey",
      ) as HTMLInputElement;
      const modelEl = this.container.querySelector(
        "#setting-openaiApiModel",
      ) as HTMLInputElement;
      // OpenAI 兼容（旧接口）
      const compatUrlEl = this.container.querySelector(
        "#setting-openaiCompatApiUrl",
      ) as HTMLInputElement;
      const compatKeyEl = this.container.querySelector(
        "#setting-openaiCompatApiKey",
      ) as HTMLInputElement;
      const compatModelEl = this.container.querySelector(
        "#setting-openaiCompatModel",
      ) as HTMLInputElement;
      // Gemini
      const gemUrlEl = this.container.querySelector(
        "#setting-geminiApiUrl",
      ) as HTMLInputElement;
      const gemKeyEl = this.container.querySelector(
        "#setting-geminiApiKey",
      ) as HTMLInputElement;
      const gemModelEl = this.container.querySelector(
        "#setting-geminiModel",
      ) as HTMLInputElement;
      // Anthropic
      const anthUrlEl = this.container.querySelector(
        "#setting-anthropicApiUrl",
      ) as HTMLInputElement;
      const anthKeyEl = this.container.querySelector(
        "#setting-anthropicApiKey",
      ) as HTMLInputElement;
      const anthModelEl = this.container.querySelector(
        "#setting-anthropicModel",
      ) as HTMLInputElement;
      // OpenRouter
      const orUrlEl = this.container.querySelector(
        "#setting-openRouterApiUrl",
      ) as HTMLInputElement;
      const orKeyEl = this.container.querySelector(
        "#setting-openRouterApiKey",
      ) as HTMLInputElement;
      const orModelEl = this.container.querySelector(
        "#setting-openRouterModel",
      ) as HTMLInputElement;
      // Volcano Ark (火山方舟)
      const vaUrlEl = this.container.querySelector(
        "#setting-volcanoArkApiUrl",
      ) as HTMLInputElement;
      const vaKeyEl = this.container.querySelector(
        "#setting-volcanoArkApiKey",
      ) as HTMLInputElement;
      const vaModelEl = this.container.querySelector(
        "#setting-volcanoArkModel",
      ) as HTMLInputElement;
      const temperatureEl = this.container.querySelector(
        "#setting-temperature",
      ) as HTMLInputElement;
      const maxTokensEl = this.container.querySelector(
        "#setting-maxTokens",
      ) as HTMLInputElement;
      const topPEl = this.container.querySelector(
        "#setting-topP",
      ) as HTMLInputElement;
      const enableTempEl = this.container.querySelector(
        "#setting-enableTemperature",
      ) as HTMLInputElement;
      const enableMaxEl = this.container.querySelector(
        "#setting-enableMaxTokens",
      ) as HTMLInputElement;
      const enableTopPEl = this.container.querySelector(
        "#setting-enableTopP",
      ) as HTMLInputElement;
      const streamEl = this.container.querySelector(
        "#setting-stream",
      ) as HTMLInputElement;
      // 调度配置
      const batchSizeEl = this.container.querySelector(
        "#setting-batchSize",
      ) as HTMLInputElement;
      const batchIntervalEl = this.container.querySelector(
        "#setting-batchInterval",
      ) as HTMLInputElement;
      const scanIntervalEl = this.container.querySelector(
        "#setting-scanInterval",
      ) as HTMLInputElement;
      // PDF 处理模式
      const pdfModeEl = this.container.querySelector(
        "#setting-pdfProcessMode",
      ) as HTMLElement;

      // 调试: 检查元素是否找到
      ztoolkit.log("[API Settings] Elements found:", {
        provider: !!providerEl,
        openaiApiUrl: !!apiUrlEl,
        openaiApiKey: !!apiKeyEl,
        openaiApiModel: !!modelEl,
      });

      const provider = (providerEl as any)?.getValue
        ? (providerEl as any).getValue()
        : "openai";
      const pdfProcessMode = (pdfModeEl as any)?.getValue
        ? (pdfModeEl as any).getValue()
        : "base64";
      const values = {
        provider,
        openaiApiUrl: apiUrlEl?.value?.trim() || "",
        openaiApiKey: apiKeyEl?.value?.trim() || "",
        openaiApiModel: modelEl?.value?.trim() || "",
        openaiCompatApiUrl: compatUrlEl?.value?.trim() || "",
        openaiCompatApiKey: compatKeyEl?.value?.trim() || "",
        openaiCompatModel: compatModelEl?.value?.trim() || "",
        geminiApiUrl: gemUrlEl?.value?.trim() || "",
        geminiApiKey: gemKeyEl?.value?.trim() || "",
        geminiModel: gemModelEl?.value?.trim() || "",
        anthropicApiUrl: anthUrlEl?.value?.trim() || "",
        anthropicApiKey: anthKeyEl?.value?.trim() || "",
        anthropicModel: anthModelEl?.value?.trim() || "",
        openRouterApiUrl: orUrlEl?.value?.trim() || "",
        openRouterApiKey: orKeyEl?.value?.trim() || "",
        openRouterModel: orModelEl?.value?.trim() || "",
        volcanoArkApiUrl: vaUrlEl?.value?.trim() || "",
        volcanoArkApiKey: vaKeyEl?.value?.trim() || "",
        volcanoArkModel: vaModelEl?.value?.trim() || "",
        temperature: temperatureEl?.value || "0.7",
        maxTokens: maxTokensEl?.value?.trim() || "4096",
        topP: topPEl?.value || "1.0",
        enableTemperature: enableTempEl?.checked ?? true,
        enableMaxTokens: enableMaxEl?.checked ?? true,
        enableTopP: enableTopPEl?.checked ?? true,
        stream: streamEl?.checked ?? true,
        requestTimeout:
          (
            this.container.querySelector(
              "#setting-requestTimeout",
            ) as HTMLInputElement
          )?.value?.trim() || "300000",
        batchSize: batchSizeEl?.value?.trim() || "1",
        batchInterval: batchIntervalEl?.value?.trim() || "60",
        scanInterval: scanIntervalEl?.value?.trim() || "300",
        pdfProcessMode,
      } as const;

      // 调试: 检查获取到的值
      ztoolkit.log("[API Settings] Values:", {
        openaiApiUrl: values.openaiApiUrl || "(empty)",
        openaiApiKey: values.openaiApiKey ? "(set)" : "(empty)",
        openaiApiModel: values.openaiApiModel || "(empty)",
      });

      // 验证Required项 - 详细提示哪些字段缺失
      const missingFields: string[] = [];
      if (provider === "google") {
        if (!values.geminiApiUrl)
          missingFields.push("API Base Address (Gemini)");
        if (!values.geminiApiKey) missingFields.push("API Key (Gemini)");
        if (!values.geminiModel) missingFields.push("Model Name (Gemini)");
      } else if (provider === "anthropic") {
        if (!values.anthropicApiUrl)
          missingFields.push("API Base Address (Anthropic)");
        if (!values.anthropicApiKey) missingFields.push("API Key (Anthropic)");
        if (!values.anthropicModel)
          missingFields.push("Model Name (Anthropic)");
      } else if (provider === "openrouter") {
        if (!values.openRouterApiUrl)
          missingFields.push("API Base Address (OpenRouter)");
        if (!values.openRouterApiKey)
          missingFields.push("API Key (OpenRouter)");
        if (!values.openRouterModel)
          missingFields.push("Model Name (OpenRouter)");
      } else if (provider === "volcanoark") {
        if (!values.volcanoArkApiUrl)
          missingFields.push("API Address (Volcano Engine Ark)");
        if (!values.volcanoArkApiKey)
          missingFields.push("API Key (Volcano Engine Ark)");
        if (!values.volcanoArkModel)
          missingFields.push("Model Name (Volcano Engine Ark)");
      } else if (provider === "openai-compat") {
        if (!values.openaiCompatApiUrl)
          missingFields.push("Compatible API Address (OpenAI Compatible)");
        if (!values.openaiCompatApiKey)
          missingFields.push("Compatible API Key (OpenAI Compatible)");
        if (!values.openaiCompatModel)
          missingFields.push("Compatible Model Name (OpenAI Compatible)");
      } else {
        if (!values.openaiApiUrl) missingFields.push("API Address");
        if (!values.openaiApiKey) missingFields.push("API Key");
        if (!values.openaiApiModel) missingFields.push("Model Name");
      }

      if (missingFields.length > 0) {
        const errorMsg = `Please fill in the following required fields:\n\n• ${missingFields.join("\n• ")}`;
        ztoolkit.log("[API Settings] Validation failed:", missingFields);

        new ztoolkit.ProgressWindow("API Configuration", {
          closeTime: 4000,
        })
          .createLine({ text: `❌ ${errorMsg}`, type: "fail" })
          .show();
        return;
      }

      // 保存到配置
      setPref("provider", values.provider);
      // 分别保存三套配置,互不覆盖
      setPref("openaiApiUrl", values.openaiApiUrl);
      // OpenAI 兼容配置保存
      setPref("openaiCompatApiUrl", values.openaiCompatApiUrl);
      setPref("openaiCompatApiKey", values.openaiCompatApiKey);
      setPref("openaiCompatModel", values.openaiCompatModel);
      setPref("openaiApiKey", values.openaiApiKey);
      setPref("openaiApiModel", values.openaiApiModel);
      setPref("geminiApiUrl", values.geminiApiUrl);
      setPref("geminiApiKey", values.geminiApiKey);
      setPref("geminiModel", values.geminiModel);
      setPref("anthropicApiUrl", values.anthropicApiUrl);
      setPref("anthropicApiKey", values.anthropicApiKey);
      setPref("anthropicModel", values.anthropicModel);
      setPref("openRouterApiUrl", values.openRouterApiUrl);
      setPref("openRouterApiKey", values.openRouterApiKey);
      setPref("openRouterModel", values.openRouterModel);
      setPref("volcanoArkApiUrl", values.volcanoArkApiUrl);
      setPref("volcanoArkApiKey", values.volcanoArkApiKey);
      setPref("volcanoArkModel", values.volcanoArkModel);
      setPref("temperature", values.temperature);
      setPref("maxTokens", values.maxTokens);
      setPref("topP", values.topP);
      setPref("enableTemperature", values.enableTemperature as any);
      setPref("enableMaxTokens", values.enableMaxTokens as any);
      setPref("enableTopP", values.enableTopP as any);
      setPref("stream", values.stream);
      setPref("requestTimeout", values.requestTimeout);
      // 调度配置
      setPref("batchSize", values.batchSize);
      setPref("batchInterval", values.batchInterval);
      setPref("scanInterval", values.scanInterval);
      // PDF 处理模式
      setPref("pdfProcessMode", values.pdfProcessMode);

      // API 轮换配置
      const maxSwitchEl = this.container.querySelector(
        "#setting-maxApiSwitchCount",
      ) as HTMLInputElement | null;
      const cooldownSecsEl = this.container.querySelector(
        "#setting-failedKeyCooldownSeconds",
      ) as HTMLInputElement | null;
      if (maxSwitchEl) {
        setPref("maxApiSwitchCount" as any, maxSwitchEl.value?.trim() || "3");
      }
      if (cooldownSecsEl) {
        const secs = parseInt(cooldownSecsEl.value?.trim() || "300") || 300;
        setPref("failedKeyCooldown" as any, String(secs * 1000));
      }

      // PDF 大小限制配置
      const enableSizeLimitEl = this.container.querySelector(
        "#setting-enablePdfSizeLimit",
      ) as HTMLInputElement | null;
      const maxPdfSizeEl = this.container.querySelector(
        "#setting-maxPdfSizeMB",
      ) as HTMLInputElement | null;
      if (enableSizeLimitEl) {
        setPref("enablePdfSizeLimit" as any, enableSizeLimitEl.checked);
      }
      if (maxPdfSizeEl) {
        setPref("maxPdfSizeMB" as any, maxPdfSizeEl.value?.trim() || "50");
      }

      // PDF 附件选择模式
      const pdfAttachmentModeEl = this.container.querySelector(
        "#setting-pdfAttachmentMode",
      ) as HTMLElement | null;
      if (pdfAttachmentModeEl && (pdfAttachmentModeEl as any).getValue) {
        setPref(
          "pdfAttachmentMode" as any,
          (pdfAttachmentModeEl as any).getValue() || "default",
        );
      }

      ztoolkit.log("[API Settings] Settings saved successfully");

      new ztoolkit.ProgressWindow("API Configuration", {
        closeTime: 2000,
      })
        .createLine({ text: "✅ Settings Saved", type: "success" })
        .show();
    } catch (error: any) {
      ztoolkit.log(`[API Settings] Save error: ${error}`);
      new ztoolkit.ProgressWindow("API Configuration", {
        closeTime: 3000,
      })
        .createLine({ text: `❌ Save Failed: ${error.message}`, type: "fail" })
        .show();
    }
  }

  /**
   * 测试 API 连接
   */
  private async testApiConnection(): Promise<void> {
    // 获取当前提供商和密钥
    const provider = (getPref("provider") as string) || "openai";
    const keyManagerId = this.mapToKeyManagerId(provider);
    const allKeys = ApiKeyManager.getAllKeys(keyManagerId);

    // 如果有多个密钥，让用户选择
    if (allKeys.length > 1) {
      this.showKeySelectionPopup(keyManagerId, allKeys);
      return;
    }

    // 只有一个密钥，直接测试
    await this.runTestConnection();
  }

  /**
   * 映射提供商ID到KeyManagerId
   */
  private mapToKeyManagerId(provider: string): ProviderId {
    if (provider === "google") return "google";
    if (provider === "anthropic") return "anthropic";
    if (provider === "openrouter") return "openrouter";
    if (provider === "openai-compat") return "openai-compat";
    return "openai";
  }

  /**
   * 显示密钥选择弹窗
   */
  private showKeySelectionPopup(providerId: ProviderId, keys: string[]): void {
    // 创建遮罩层（固定定位，覆盖整个视口）
    const overlay = this.createElement("div", {
      styles: {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: "10000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    });

    // 弹窗容器
    const popup = this.createElement("div", {
      styles: {
        backgroundColor: "#fff",
        borderRadius: "8px",
        padding: "20px",
        minWidth: "320px",
        maxWidth: "420px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      },
    });

    // 标题
    const title = this.createElement("div", {
      textContent: "Select Key to Test",
      styles: {
        fontSize: "16px",
        fontWeight: "600",
        marginBottom: "16px",
        color: "#333",
      },
    });
    popup.appendChild(title);

    // 密钥列表
    keys.forEach((key, index) => {
      const btn = this.createElement("button", {
        textContent: `Key ${index + 1}: ${ApiKeyManager.maskKey(key)}`,
        styles: {
          display: "block",
          width: "100%",
          padding: "12px 14px",
          marginBottom: "8px",
          border: "1px solid #ddd",
          borderRadius: "6px",
          backgroundColor: "#f8f9fa",
          cursor: "pointer",
          fontSize: "14px",
          textAlign: "left",
        },
      });
      btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = "#e3f2fd";
        btn.style.borderColor = "#2196f3";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.backgroundColor = "#f8f9fa";
        btn.style.borderColor = "#ddd";
      });
      btn.addEventListener("click", async () => {
        overlay.remove();
        await this.runTestConnectionWithKey(key, index);
      });
      popup.appendChild(btn);
    });

    // Cancel按钮
    const cancelBtn = this.createElement("button", {
      textContent: "Cancel",
      styles: {
        display: "block",
        width: "100%",
        padding: "12px 14px",
        marginTop: "8px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        backgroundColor: "#fff",
        cursor: "pointer",
        fontSize: "14px",
        color: "#666",
      },
    });
    cancelBtn.addEventListener("click", () => overlay.remove());
    popup.appendChild(cancelBtn);

    overlay.appendChild(popup);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // 附加到设置页容器
    this.container.appendChild(overlay);
    ztoolkit.log(
      `[ApiSettingsPage] Showing key selection popup, ${keys.length} keys total`,
    );
  }

  /**
   * 执行测试连接（使用当前活动密钥）
   */
  private async runTestConnection(): Promise<void> {
    const progressWindow = new ztoolkit.ProgressWindow("API Connection Test", {
      closeTime: -1,
    });
    progressWindow.createLine({
      text: "Testing connection...",
      type: "default",
    });
    progressWindow.show();

    // 页面内结果区域（避免进度窗文本截断）
    const resultBox = this.container.querySelector(
      "#api-test-result",
    ) as HTMLElement | null;
    const resultPre = this.container.querySelector(
      "#api-test-result-text",
    ) as HTMLElement | null;
    if (resultBox && resultPre) {
      resultBox.style.display = "block";
      resultBox.style.backgroundColor = "#fff8e1";
      resultBox.style.border = "1px solid #ffe082";
      resultPre.textContent = "Testing connection…\nPlease wait.";
    }

    try {
      // 先保存当前设置,确保测试使用最新配置
      await this.saveSettings();

      // 调用 LLMClient 的测试方法
      const result = await LLMClient.testConnection();

      progressWindow.changeLine({
        text: result,
        type: "success",
        progress: 100,
      });

      if (resultBox && resultPre) {
        resultBox.style.display = "block";
        // 成功样式
        resultBox.style.backgroundColor = "#e8f5e9";
        resultBox.style.border = "1px solid #a5d6a7";
        resultPre.style.color = "#1b5e20";
        resultPre.textContent = result;
      }

      setTimeout(() => progressWindow.close(), 3000);
    } catch (error: any) {
      // 检查是否为 APITestError 类型
      let fullMsg: string;
      if (error?.name === "APITestError" && error?.details) {
        // 使用详细错误报告格式
        fullMsg = error.formatReport?.() || this.formatAPITestError(error);
      } else {
        // 普通错误，直接显示消息
        fullMsg = error?.message || String(error);
      }

      progressWindow.changeLine({
        text: `❌ ${error?.message || "Connection Failed"}`,
        type: "fail",
        progress: 100,
      });

      if (resultBox && resultPre) {
        resultBox.style.display = "block";
        // 失败样式
        resultBox.style.backgroundColor = "#ffebee";
        resultBox.style.border = "1px solid #ffcdd2";
        resultPre.style.color = "#b71c1c";
        resultPre.textContent = fullMsg;
      }

      setTimeout(() => progressWindow.close(), 5000);
    }
  }

  /**
   * 执行测试连接（使用指定密钥）
   */
  private async runTestConnectionWithKey(
    apiKey: string,
    keyIndex: number,
  ): Promise<void> {
    const progressWindow = new ztoolkit.ProgressWindow("API Connection Test", {
      closeTime: -1,
    });
    progressWindow.createLine({
      text: `Testing key ${keyIndex + 1}...`,
      type: "default",
    });
    progressWindow.show();

    const resultBox = this.container.querySelector(
      "#api-test-result",
    ) as HTMLElement | null;
    const resultPre = this.container.querySelector(
      "#api-test-result-text",
    ) as HTMLElement | null;
    if (resultBox && resultPre) {
      resultBox.style.display = "block";
      resultBox.style.backgroundColor = "#fff8e1";
      resultBox.style.border = "1px solid #ffe082";
      resultPre.textContent = `Testing key ${keyIndex + 1}…\nPlease wait.`;
    }

    try {
      await this.saveSettings();
      const result = await LLMClient.testConnectionWithKey(apiKey);

      progressWindow.changeLine({
        text: `✅ Key ${keyIndex + 1} Test Successful`,
        type: "success",
        progress: 100,
      });

      if (resultBox && resultPre) {
        resultBox.style.display = "block";
        resultBox.style.backgroundColor = "#e8f5e9";
        resultBox.style.border = "1px solid #a5d6a7";
        resultPre.style.color = "#1b5e20";
        resultPre.textContent = `Key ${keyIndex + 1} test result:\n${result}`;
      }

      // Update成功密钥的状态指示器为绿色
      this.updateKeyStatusIndicator(keyIndex, true);

      setTimeout(() => progressWindow.close(), 3000);
    } catch (error: any) {
      const fullMsg = error?.message || String(error);

      progressWindow.changeLine({
        text: `❌ Key ${keyIndex + 1} Test Failed`,
        type: "fail",
        progress: 100,
      });

      if (resultBox && resultPre) {
        resultBox.style.display = "block";
        resultBox.style.backgroundColor = "#ffebee";
        resultBox.style.border = "1px solid #ffcdd2";
        resultPre.style.color = "#b71c1c";
        resultPre.textContent = `Key ${keyIndex + 1} test failed:\n${fullMsg}`;
      }

      // Update失败密钥的状态指示器为红色
      this.updateKeyStatusIndicator(keyIndex, false);

      setTimeout(() => progressWindow.close(), 5000);
    }
  }

  /**
   * Update密钥状态指示器
   */
  private updateKeyStatusIndicator(keyIndex: number, isValid: boolean): void {
    const provider = (getPref("provider") as string) || "openai";
    const keyManagerId = this.mapToKeyManagerId(provider);
    const statusSelector = `[data-key-status="${keyManagerId}-${keyIndex}"]`;
    const statusIcon = this.container.querySelector(
      statusSelector,
    ) as HTMLElement | null;
    if (statusIcon) {
      statusIcon.style.color = isValid ? "#4caf50" : "#f44336";
      statusIcon.title = isValid ? "Test Successful" : "Test Failed";
    }
  }

  /**
   * 格式化 APITestError 为详细错误报告
   */
  private formatAPITestError(error: any): string {
    const d = error?.details;
    if (!d) return error?.message || String(error);
    const lines: string[] = [];
    lines.push(`Error Name: ${d.errorName || "Unknown"}`);
    lines.push(
      `Error Message: ${d.errorMessage || error?.message || "Unknown"}`,
    );
    if (d.statusCode !== undefined) {
      lines.push(`Status Code: ${d.statusCode}`);
    }
    lines.push(`Request URL: ${d.requestUrl || "Unknown"}`);
    if (d.responseBody) {
      lines.push(`Response Body: ${d.responseBody}`);
    }
    if (d.responseHeaders && Object.keys(d.responseHeaders).length > 0) {
      lines.push(
        `Response Headers: ${JSON.stringify(d.responseHeaders, null, 2)}`,
      );
    }
    lines.push(`Request Body: ${d.requestBody || "Unknown"}`);
    return lines.join("\n");
  }

  /**
   * 重置设置
   */
  private resetSettings(): void {
    const confirmed = Services.prompt.confirm(
      Zotero.getMainWindow() as any,
      "Reset Settings",
      "Are you sure you want to reset to default settings?",
    );

    if (!confirmed) {
      return;
    }

    // 重置为默认值
    setPref("provider", "openai");
    // OpenAI 默认（已改为新接口）
    setPref("openaiApiUrl", "https://api.openai.com/v1/responses");
    setPref("openaiApiKey", "");
    setPref("openaiApiModel", "gpt-5");
    // OpenAI 兼容默认
    setPref("openaiCompatApiUrl", "https://api.openai.com/v1/chat/completions");
    setPref("openaiCompatApiKey", "");
    setPref("openaiCompatModel", "gpt-3.5-turbo");
    // Gemini 默认
    setPref("geminiApiUrl", "https://generativelanguage.googleapis.com");
    setPref("geminiApiKey", "");
    setPref("geminiModel", "gemini-2.5-pro");
    // Anthropic 默认
    setPref("anthropicApiUrl", "https://api.anthropic.com");
    setPref("anthropicApiKey", "");
    setPref("anthropicModel", "claude-3-5-sonnet-20241022");
    setPref(
      "openRouterApiUrl",
      "https://openrouter.ai/api/v1/chat/completions",
    );
    setPref("openRouterApiKey", "");
    setPref("openRouterModel", "google/gemma-3-27b-it");
    // 火山方舟默认
    setPref(
      "volcanoArkApiUrl",
      "https://ark.cn-beijing.volces.com/api/v3/responses",
    );
    setPref("volcanoArkApiKey", "");
    setPref("volcanoArkModel", "doubao-seed-1-8-251228");
    setPref("temperature", "0.7");
    setPref("maxTokens", "8192");
    setPref("topP", "1.0");
    setPref("enableTemperature", true as any);
    setPref("enableMaxTokens", true as any);
    setPref("enableTopP", true as any);
    setPref("stream", true);
    setPref("requestTimeout", "300000");

    // 重新渲染
    this.render();

    new ztoolkit.ProgressWindow("API Configuration")
      .createLine({ text: "Reset to Default Settings", type: "success" })
      .show();
  }
}
