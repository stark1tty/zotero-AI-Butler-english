/**
 * 一图总结设置页面
 *
 * 提供 Nano-Banana Pro (Gemini Image) 生图 API 配置管理界面
 *
 * @file ImageSummarySettingsPage.ts
 * @author AI Butler Team
 */

import { getPref, setPref } from "../../../utils/prefs";
import {
  createStyledButton,
  createFormGroup,
  createInput,
  createSelect,
  createTextarea,
  createCheckbox,
  createSectionTitle,
  createNotice,
} from "../ui/components";
import {
  getDefaultImageSummaryPrompt,
  getDefaultImageGenerationPrompt,
} from "../../../utils/prompts";
import { ImageClient, ImageGenerationError } from "../../imageClient";

/**
 * 一图总结设置页面类
 */
export class ImageSummarySettingsPage {
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
      textContent: "🖼️ Image Summary Settings",
      styles: {
        color: "#9c27b0",
        marginBottom: "20px",
        fontSize: "20px",
        borderBottom: "2px solid #9c27b0",
        paddingBottom: "10px",
      },
    });
    this.container.appendChild(title);

    // 功能说明
    const notice = createNotice(
      "📝 <strong>Function Description</strong>: Image Summary uses image generation models (default gemini-3-pro-image-preview) to create academic concept posters for papers, supporting both Gemini Native API and OpenAI Compatible API request modes.",
      "info",
    );
    this.container.appendChild(notice);

    // 表单容器
    const form = this.createElement("div", {
      styles: {
        maxWidth: "800px",
      },
    });

    // === API 配置区域 ===
    form.appendChild(createSectionTitle("🔌 API Configuration"));

    // 请求方式
    const requestModeValue =
      (getPref("imageSummaryRequestMode" as any) as string) || "gemini";
    const requestModeSelect = createSelect(
      "imageSummaryRequestMode",
      [
        { value: "gemini", label: "Gemini Native API (x-goog-api-key)" },
        { value: "openai", label: "OpenAI Compatible API (Bearer)" },
      ],
      requestModeValue,
      (newVal) => {
        // 切换时，如 API 地址保持默认且用户尚未手动Modify，则自动填充更合适的默认值
        const urlInput = this.container.querySelector(
          "#setting-imageSummaryApiUrl",
        ) as HTMLInputElement | null;
        if (!urlInput) return;
        const cur = (urlInput.value || "").trim();
        const isDefaultGemini =
          !cur || cur === "https://generativelanguage.googleapis.com";
        const isDefaultOpenAI =
          cur === "https://api.openai.com/v1/chat/completions";
        if (newVal === "openai" && isDefaultGemini) {
          urlInput.value = "https://api.openai.com/v1/chat/completions";
        }
        if (newVal === "gemini" && (isDefaultOpenAI || !cur)) {
          urlInput.value = "https://generativelanguage.googleapis.com";
        }
      },
    );
    form.appendChild(
      createFormGroup(
        "Request Mode",
        requestModeSelect,
        "Choose between Gemini Native API or OpenAI Compatible API to call the image generation model",
      ),
    );

    // API Key
    form.appendChild(
      createFormGroup(
        "API Key *",
        this.createPasswordInput(
          "imageSummaryApiKey",
          (getPref("imageSummaryApiKey" as any) as string) || "",
          "Your API Key",
        ),
        "[Required] Gemini mode uses x-goog-api-key; OpenAI mode uses Authorization Bearer.",
      ),
    );

    // API Base URL
    form.appendChild(
      createFormGroup(
        "API Base URL",
        createInput(
          "imageSummaryApiUrl",
          "text",
          (getPref("imageSummaryApiUrl" as any) as string) ||
            (requestModeValue === "openai"
              ? "https://api.openai.com/v1/chat/completions"
              : "https://generativelanguage.googleapis.com"),
          requestModeValue === "openai"
            ? "https://api.openai.com/v1/chat/completions"
            : "https://generativelanguage.googleapis.com",
        ),
        "Gemini: Enter base URL; OpenAI: Can enter base URL or full endpoint (e.g. /v1/chat/completions)",
      ),
    );

    // 模型名称
    form.appendChild(
      createFormGroup(
        "Image Generation Model",
        createInput(
          "imageSummaryModel",
          "text",
          (getPref("imageSummaryModel" as any) as string) ||
            "gemini-3-pro-image-preview",
          "gemini-3-pro-image-preview",
        ),
        "Gemini image generation model name, recommended: gemini-3-pro-image-preview (Nano Banana Pro)",
      ),
    );

    // === 生成选项区域 ===
    form.appendChild(createSectionTitle("⚙️ Generation Options"));

    // 图片语言
    form.appendChild(
      createFormGroup(
        "Image Language",
        createInput(
          "imageSummaryLanguage",
          "text",
          (getPref("imageSummaryLanguage" as any) as string) || "Chinese",
          "Chinese",
        ),
        "Language of text displayed in generated images",
      ),
    );

    // 启用图片宽高比参数
    form.appendChild(
      createFormGroup(
        "Enable Aspect Ratio Parameter",
        createCheckbox(
          "imageSummaryAspectRatioEnabled",
          (getPref("imageSummaryAspectRatioEnabled" as any) as boolean) ??
            false,
        ),
        "Whether to include aspect ratio parameter in API requests (disable for compatibility with API proxies that don't support this parameter)",
      ),
    );

    // 图片宽高比
    form.appendChild(
      createFormGroup(
        "Image Aspect Ratio",
        createInput(
          "imageSummaryAspectRatio",
          "text",
          (getPref("imageSummaryAspectRatio" as any) as string) || "16:9",
          "16:9",
        ),
        "Aspect ratio of generated images, e.g. 16:9, 1:1, 9:16, 4:3",
      ),
    );

    // 启用图片分辨率参数
    form.appendChild(
      createFormGroup(
        "Enable Resolution Parameter",
        createCheckbox(
          "imageSummaryResolutionEnabled",
          (getPref("imageSummaryResolutionEnabled" as any) as boolean) ?? false,
        ),
        "Whether to include resolution parameter in API requests (disable for compatibility with API proxies that don't support this parameter)",
      ),
    );

    // 图片分辨率
    form.appendChild(
      createFormGroup(
        "Image Resolution",
        createSelect(
          "imageSummaryResolution",
          [
            { value: "1K", label: "1K (Default)" },
            { value: "2K", label: "2K" },
            { value: "4K", label: "4K" },
          ],
          (getPref("imageSummaryResolution" as any) as string) || "1K",
        ),
        "Resolution of generated images, higher resolutions may increase API costs",
      ),
    );

    // 使用已有 AI 笔记代替
    form.appendChild(
      createFormGroup(
        "Use Existing AI Notes",
        createCheckbox(
          "imageSummaryUseExistingNote",
          (getPref("imageSummaryUseExistingNote" as any) as boolean) || false,
        ),
        "When enabled, will use existing AI Butler note content as visual summary input, saving API costs",
      ),
    );

    // 自动添加一图总结（带二次确认）
    const autoSummaryContainer = createCheckbox(
      "autoImageSummaryOnComplete",
      (getPref("autoImageSummaryOnComplete" as any) as boolean) || false,
    );
    const autoSummaryCheckbox = autoSummaryContainer.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    const autoSummaryLabel = autoSummaryContainer.querySelector(
      "span",
    ) as HTMLSpanElement;

    if (autoSummaryCheckbox) {
      autoSummaryCheckbox.addEventListener("change", () => {
        if (autoSummaryCheckbox.checked) {
          // 弹出二次确认对话框
          const confirmed = this.showCostWarningDialog();
          if (!confirmed) {
            autoSummaryCheckbox.checked = false;
            if (autoSummaryLabel) {
              autoSummaryLabel.textContent = "Disabled";
            }
          } else {
            if (autoSummaryLabel) {
              autoSummaryLabel.textContent = "Enabled";
            }
            // 用户确认后自动保存设置
            setPref("autoImageSummaryOnComplete" as any, true);
          }
        } else {
          if (autoSummaryLabel) {
            autoSummaryLabel.textContent = "Disabled";
          }
          // 用户Close时自动保存设置
          setPref("autoImageSummaryOnComplete" as any, false);
        }
      });
    }

    form.appendChild(
      createFormGroup(
        "Auto Add Image Summary",
        autoSummaryContainer,
        "⚠️ When enabled, image summary will be automatically generated upon paper AI summary completion (may consume significant API costs, enable with caution)",
      ),
    );

    // === 提示词配置区域 ===
    form.appendChild(createSectionTitle("📝 Prompt Configuration"));

    // 变量说明
    const varsNotice = this.createElement("div", {
      styles: {
        padding: "12px 16px",
        backgroundColor: "#fff3e0",
        border: "1px solid #ffcc80",
        borderRadius: "6px",
        marginBottom: "16px",
        fontSize: "13px",
        color: "#e65100",
      },
    });
    varsNotice.innerHTML =
      "📌 <strong>Available Variables</strong>: <code>${context}</code> Paper content, <code>${title}</code> Paper title, <code>${language}</code> Language setting, <code>${summaryForImage}</code> Visual summary result";
    form.appendChild(varsNotice);

    // 视觉信息提取提示词
    form.appendChild(
      createFormGroup(
        "Visual Information Extraction Prompt",
        createTextarea(
          "imageSummaryPrompt",
          (getPref("imageSummaryPrompt" as any) as string) ||
            getDefaultImageSummaryPrompt(),
          10,
          "Prompt for extracting visual information from paper...",
        ),
        "Stage 1: Extract key visual information from paper for image generation",
      ),
    );

    // 生图提示词
    form.appendChild(
      createFormGroup(
        "Image Generation Prompt",
        createTextarea(
          "imageSummaryImagePrompt",
          (getPref("imageSummaryImagePrompt" as any) as string) ||
            getDefaultImageGenerationPrompt(),
          12,
          "Prompt for generating academic concept poster...",
        ),
        "Stage 2: Generate academic concept poster image based on visual summary",
      ),
    );

    // 按钮组
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
    const testButton = createStyledButton("🔍 Test API", "#2196f3", "medium");
    testButton.addEventListener("click", () => this.testConnection());
    buttonGroup.appendChild(testButton);

    // 保存按钮
    const saveButton = createStyledButton(
      "💾 Save Settings",
      "#4caf50",
      "medium",
    );
    saveButton.addEventListener("click", () => this.saveSettings());
    buttonGroup.appendChild(saveButton);

    // 重置提示词按钮
    const resetButton = createStyledButton(
      "🔄 Reset Prompts",
      "#9e9e9e",
      "medium",
    );
    resetButton.addEventListener("click", () => this.resetPrompts());
    buttonGroup.appendChild(resetButton);

    form.appendChild(buttonGroup);

    // 测试结果展示区域（防止进度窗文本过长被截断）
    const resultBox = this.createElement("div", {
      id: "image-summary-test-result",
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
      textContent: "API Connection Test Result",
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
    }) as HTMLButtonElement;
    copyBtn.type = "button";
    copyBtn.addEventListener("click", async () => {
      const resultPre = this.container.querySelector(
        "#image-summary-test-result-text",
      ) as HTMLElement | null;
      const text = (resultPre?.textContent || "").toString();
      const win = Zotero.getMainWindow() as any;
      const doc = win?.document as Document | undefined;
      const nav = (win as any)?.navigator as any;
      try {
        if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(text);
        } else {
          throw new Error("clipboard api unavailable");
        }
        new ztoolkit.ProgressWindow("Image Summary", { closeTime: 1500 })
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
          new ztoolkit.ProgressWindow("Image Summary", { closeTime: 1500 })
            .createLine({ text: "Error details copied", type: "success" })
            .show();
        } catch {
          new ztoolkit.ProgressWindow("Image Summary", { closeTime: 2500 })
            .createLine({
              text: "Copy failed, please select text manually",
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
      id: "image-summary-test-result-text",
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
   * 保存设置
   */
  private async saveSettings(): Promise<void> {
    try {
      // 收集所有设置值
      const fields = [
        "imageSummaryApiKey",
        "imageSummaryApiUrl",
        "imageSummaryModel",
        "imageSummaryLanguage",
        "imageSummaryAspectRatio",
        "imageSummaryPrompt",
        "imageSummaryImagePrompt",
      ];

      for (const field of fields) {
        const input = this.container.querySelector(`#setting-${field}`) as
          | HTMLInputElement
          | HTMLTextAreaElement;
        if (input) {
          setPref(field as any, input.value.trim() as any);
        }
      }

      // 下拉框单独处理 (requestMode)
      const modeSelect = this.container.querySelector(
        "#setting-imageSummaryRequestMode",
      ) as HTMLElement | null;
      if (modeSelect) {
        const modeValue =
          (modeSelect as any).getValue?.() ||
          modeSelect.getAttribute("data-value") ||
          "gemini";
        setPref("imageSummaryRequestMode" as any, modeValue);
      }

      // 下拉框单独处理 (resolution)
      const resolutionSelect = this.container.querySelector(
        "#setting-imageSummaryResolution",
      ) as HTMLElement;
      if (resolutionSelect) {
        const resValue =
          (resolutionSelect as any).getValue?.() ||
          resolutionSelect.getAttribute("data-value") ||
          "1K";
        setPref("imageSummaryResolution" as any, resValue);
      }

      // 复选框单独处理
      const useExistingCb = this.container.querySelector(
        "#setting-imageSummaryUseExistingNote",
      ) as HTMLInputElement;
      if (useExistingCb) {
        setPref("imageSummaryUseExistingNote" as any, useExistingCb.checked);
      }

      // 自动一图总结复选框
      const autoSummaryCb = this.container.querySelector(
        "#setting-autoImageSummaryOnComplete",
      ) as HTMLInputElement;
      if (autoSummaryCb) {
        setPref("autoImageSummaryOnComplete" as any, autoSummaryCb.checked);
      }

      // 宽高比参数启用复选框
      const aspectRatioEnabledCb = this.container.querySelector(
        "#setting-imageSummaryAspectRatioEnabled",
      ) as HTMLInputElement;
      if (aspectRatioEnabledCb) {
        setPref(
          "imageSummaryAspectRatioEnabled" as any,
          aspectRatioEnabledCb.checked,
        );
      }

      // 分辨率参数启用复选框
      const resolutionEnabledCb = this.container.querySelector(
        "#setting-imageSummaryResolutionEnabled",
      ) as HTMLInputElement;
      if (resolutionEnabledCb) {
        setPref(
          "imageSummaryResolutionEnabled" as any,
          resolutionEnabledCb.checked,
        );
      }

      new ztoolkit.ProgressWindow("AI Butler", {
        closeOnClick: true,
        closeTime: 2000,
      })
        .createLine({ text: "Image Summary settings saved", type: "success" })
        .show();
    } catch (error: any) {
      ztoolkit.log("[AI-Butler] Failed to save image summary settings:", error);
      new ztoolkit.ProgressWindow("AI Butler", {
        closeOnClick: true,
        closeTime: 3000,
      })
        .createLine({ text: `Save failed: ${error.message}`, type: "error" })
        .show();
    }
  }

  /**
   * 测试 API 连接
   */
  private async testConnection(): Promise<void> {
    const modeEl = this.container.querySelector(
      "#setting-imageSummaryRequestMode",
    ) as HTMLElement | null;
    const requestMode =
      (modeEl as any)?.getValue?.() ||
      modeEl?.getAttribute("data-value") ||
      "gemini";

    const apiKey =
      (
        this.container.querySelector(
          "#setting-imageSummaryApiKey",
        ) as HTMLInputElement
      )?.value?.trim() || "";
    const apiUrl =
      (
        this.container.querySelector(
          "#setting-imageSummaryApiUrl",
        ) as HTMLInputElement
      )?.value?.trim() || "https://generativelanguage.googleapis.com";
    const model =
      (
        this.container.querySelector(
          "#setting-imageSummaryModel",
        ) as HTMLInputElement
      )?.value?.trim() || "gemini-3-pro-image-preview";

    // 页面内结果区域
    const resultBox = this.container.querySelector(
      "#image-summary-test-result",
    ) as HTMLElement | null;
    const resultPre = this.container.querySelector(
      "#image-summary-test-result-text",
    ) as HTMLElement | null;

    if (!apiKey) {
      if (resultBox && resultPre) {
        resultBox.style.display = "block";
        resultBox.style.backgroundColor = "#ffebee";
        resultBox.style.border = "1px solid #ffcdd2";
        resultPre.style.color = "#b71c1c";
        resultPre.textContent = "❌ Please enter API Key first";
      }
      return;
    }

    // 显示测试中状态
    if (resultBox && resultPre) {
      resultBox.style.display = "block";
      resultBox.style.backgroundColor = "#fff8e1";
      resultBox.style.border = "1px solid #ffe082";
      resultPre.style.color = "#5d4037";
      resultPre.textContent = "Testing connection…\nPlease wait.";
    }

    try {
      const result = await ImageClient.generateImage(
        "Generate a simple test image: a blue circle on white background.",
        {
          apiKey,
          apiUrl,
          model,
          requestMode: requestMode as any,
        },
      );

      if (resultBox && resultPre) {
        resultBox.style.display = "block";
        resultBox.style.backgroundColor = "#e8f5e9";
        resultBox.style.border = "1px solid #a5d6a7";
        resultPre.style.color = "#1b5e20";
        resultPre.textContent = `✅ API connection successful, generated ${result.mimeType} image (${Math.round(result.imageBase64.length / 1024)} KB)`;
      }
    } catch (error: any) {
      ztoolkit.log("[AI-Butler] Image summary API test failed:", error);

      const fullMsg =
        error instanceof ImageGenerationError
          ? ImageClient.formatError(error)
          : `Error: ${error?.message || "Connection failed"}`;

      if (resultBox && resultPre) {
        resultBox.style.display = "block";
        resultBox.style.backgroundColor = "#ffebee";
        resultBox.style.border = "1px solid #ffcdd2";
        resultPre.style.color = "#b71c1c";
        resultPre.textContent = fullMsg;
      }
    }
  }

  /**
   * 显示费用警告确认对话框
   * @returns 用户是否确认开启
   */
  private showCostWarningDialog(): boolean {
    const message =
      "⚠️ Cost Warning\n\n" +
      "After enabling 'Auto Add Image Summary', the system will automatically call the image generation API to create academic concept posters whenever a paper AI summary is completed.\n\n" +
      "This will consume significant API calls and costs!\n\n" +
      "Are you sure you want to enable this feature?";

    return ztoolkit.getGlobal("confirm")(message);
  }

  /**
   * 重置提示词为默认值
   */
  private resetPrompts(): void {
    const summaryPrompt = this.container.querySelector(
      "#setting-imageSummaryPrompt",
    ) as HTMLTextAreaElement;
    const imagePrompt = this.container.querySelector(
      "#setting-imageSummaryImagePrompt",
    ) as HTMLTextAreaElement;

    if (summaryPrompt) {
      summaryPrompt.value = getDefaultImageSummaryPrompt();
    }
    if (imagePrompt) {
      imagePrompt.value = getDefaultImageGenerationPrompt();
    }

    new ztoolkit.ProgressWindow("AI Butler", {
      closeOnClick: true,
      closeTime: 2000,
    })
      .createLine({ text: "Prompts reset to default", type: "success" })
      .show();
  }

  /**
   * 创建元素辅助方法
   */
  private createElement(
    tag: string,
    options: {
      textContent?: string;
      innerHTML?: string;
      styles?: Partial<CSSStyleDeclaration>;
      id?: string;
    } = {},
  ): HTMLElement {
    const doc = this.container.ownerDocument || Zotero.getMainWindow().document;
    const el = doc.createElement(tag);
    if (options.textContent) el.textContent = options.textContent;
    if (options.innerHTML) el.innerHTML = options.innerHTML;
    if (options.id) el.id = options.id;
    if (options.styles) {
      Object.assign(el.style, options.styles);
    }
    return el;
  }

  /**
   * 创建密码输入框
   */
  private createPasswordInput(
    id: string,
    value: string,
    placeholder?: string,
  ): HTMLElement {
    const doc = this.container.ownerDocument || Zotero.getMainWindow().document;
    const wrapper = doc.createElement("div");
    wrapper.style.cssText = "display: flex; align-items: center; gap: 8px;";

    const input = createInput(id, "password", value, placeholder);
    input.style.flex = "1";
    wrapper.appendChild(input);

    const toggleBtn = doc.createElement("button");
    toggleBtn.textContent = "👁";
    toggleBtn.title = "Show/Hide Key";
    toggleBtn.type = "button";
    toggleBtn.style.cssText = `
      border: 1px solid #ddd;
      background: #f5f5f5;
      border-radius: 4px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 14px;
    `;
    toggleBtn.addEventListener("click", () => {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      toggleBtn.textContent = isPassword ? "🙈" : "👁";
    });
    wrapper.appendChild(toggleBtn);

    return wrapper;
  }
}

export default ImageSummarySettingsPage;
