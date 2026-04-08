/**
 * 思维导图设置页面
 *
 * 提供思维导图提示词模板和导出路径配置
 *
 * @file MindmapSettingsPage.ts
 * @author AI Butler Team
 */

import { getPref, setPref } from "../../../utils/prefs";
import {
  createFormGroup,
  createTextarea,
  createStyledButton,
  createSectionTitle,
  createNotice,
  createInput,
} from "../ui/components";
import { getDefaultMindmapPrompt } from "../../../utils/prompts";

/**
 * 思维导图设置页面类
 */
export class MindmapSettingsPage {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
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
   * 渲染页面
   */
  render(): void {
    this.container.innerHTML = "";

    // Page title
    const title = this.createElement("h2", {
      textContent: "🧠 Mind Map Settings",
      styles: {
        color: "var(--ai-accent)",
        marginBottom: "20px",
        fontSize: "20px",
        borderBottom: "2px solid var(--ai-accent)",
        paddingBottom: "10px",
      },
    });
    this.container.appendChild(title);

    // Description
    const description = this.createElement("p", {
      textContent:
        "Configure the prompt template and export file path for mind map generation. Custom prompts can change the structure and content style of the mind map.",
      styles: {
        color: "var(--ai-text-muted)",
        fontSize: "13px",
        marginBottom: "20px",
        lineHeight: "1.5",
      },
    });
    this.container.appendChild(description);

    // 表单容器
    const form = this.createElement("div", {
      styles: {
        maxWidth: "800px",
      },
    });

    // ==================== Prompt Template ====================
    form.appendChild(createSectionTitle("📝 Prompt Template"));

    // Prompt notice
    const promptNotice = createNotice(
      "The prompt determines the structure of the mind map. The default includes four main categories (Research Background, Research Methods, Key Results, Conclusion). You can freely modify it. Leave blank to use the default template.",
      "info",
    );
    form.appendChild(promptNotice);

    // Prompt editor
    const savedPrompt = (getPref("mindmapPrompt" as any) as string) || "";
    const defaultPrompt = getDefaultMindmapPrompt();
    const isUsingDefaultPrompt = !savedPrompt.trim();
    const effectivePrompt = isUsingDefaultPrompt ? defaultPrompt : savedPrompt;

    const promptStatus = this.createElement("div", {
      textContent: isUsingDefaultPrompt
        ? "Current: Default prompt (no custom saved)"
        : "Current: Custom prompt",
      styles: {
        fontSize: "12px",
        color: "var(--ai-text-muted)",
        marginBottom: "8px",
      },
    });
    form.appendChild(promptStatus);
    const promptTextarea = createTextarea(
      "mindmapPrompt",
      effectivePrompt,
      15, // rows
      "Leave blank to use default prompt template...",
    );
    promptTextarea.style.fontFamily = "monospace";
    promptTextarea.style.fontSize = "12px";
    promptTextarea.style.lineHeight = "1.5";
    promptTextarea.style.width = "100%";

    const promptGroup = createFormGroup("Prompt Content", promptTextarea);
    form.appendChild(promptGroup);

    // Button group
    const promptButtonGroup = this.createElement("div", {
      styles: {
        display: "flex",
        gap: "10px",
        marginTop: "15px",
      },
    });

    // View default prompt button
    const viewDefaultBtn = createStyledButton(
      "View Default Prompt",
      "#9e9e9e",
      "medium",
    );
    viewDefaultBtn.addEventListener("click", () => {
      promptTextarea.value = defaultPrompt;
      promptStatus.textContent = "Current edit: Default prompt (not saved)";
    });
    promptButtonGroup.appendChild(viewDefaultBtn);

    // Clear button (use default)
    const clearBtn = createStyledButton("Use Default", "#ff9800", "medium");
    clearBtn.addEventListener("click", () => {
      promptTextarea.value = defaultPrompt;
      setPref("mindmapPrompt" as any, "" as any);
      promptStatus.textContent = "Current: Default prompt (no custom saved)";
      this.showToast("Reset to default prompt");
    });
    promptButtonGroup.appendChild(clearBtn);

    // Save button
    const savePromptBtn = createStyledButton(
      "Save Prompt",
      "#4caf50",
      "medium",
    );
    savePromptBtn.addEventListener("click", () => {
      const value = promptTextarea.value.trim();
      const defaultTrimmed = defaultPrompt.trim();

      // Empty or unchanged default prompt means "use default" (keep pref empty)
      if (!value || value === defaultTrimmed) {
        setPref("mindmapPrompt" as any, "" as any);
        promptTextarea.value = defaultPrompt;
        promptStatus.textContent = "Current: Default prompt (no custom saved)";
        this.showToast("Using default prompt");
        return;
      }

      setPref("mindmapPrompt" as any, value as any);
      promptStatus.textContent = "Current: Custom prompt";
      this.showToast("Prompt saved");
    });
    promptButtonGroup.appendChild(savePromptBtn);

    form.appendChild(promptButtonGroup);

    // ==================== Export Path Settings ====================
    const exportDivider = this.createElement("div", {
      styles: {
        marginTop: "30px",
      },
    });
    form.appendChild(exportDivider);

    form.appendChild(createSectionTitle("📂 Export Path Settings"));

    // Description
    const exportNotice = createNotice(
      "Set the default save path for mind map exports (PNG/OPML). Leave blank to save to desktop by default.",
      "info",
    );
    form.appendChild(exportNotice);

    // Path input
    const currentPath = (getPref("mindmapExportPath" as any) as string) || "";
    const pathInput = createInput(
      "mindmapExportPath",
      "text",
      currentPath,
      "Leave blank to use desktop directory...",
    );
    pathInput.style.width = "100%";

    const pathGroup = createFormGroup("Export Path", pathInput);
    form.appendChild(pathGroup);

    // Path button group
    const pathButtonGroup = this.createElement("div", {
      styles: {
        display: "flex",
        gap: "10px",
        marginTop: "15px",
      },
    });

    // Browse button
    const browseBtn = createStyledButton("Browse...", "#2196f3", "medium");
    browseBtn.addEventListener("click", async () => {
      try {
        // Use Zotero folder picker
        const fp = (Components.classes as any)[
          "@mozilla.org/filepicker;1"
        ].createInstance(Components.interfaces.nsIFilePicker);
        const win = Zotero.getMainWindow();
        fp.init(win, "Select Export Directory", fp.modeGetFolder);

        const result = await new Promise<number>((resolve) => {
          fp.open((res: number) => resolve(res));
        });

        if (result === fp.returnOK) {
          const selectedPath = fp.file.path;
          (pathInput as HTMLInputElement).value = selectedPath;
          setPref("mindmapExportPath" as any, selectedPath as any);
          this.showToast("Export path saved");
        }
      } catch (e) {
        ztoolkit.log("[AI-Butler] Failed to select export directory:", e);
        this.showToast(
          "Failed to select directory, please enter path manually",
        );
      }
    });
    pathButtonGroup.appendChild(browseBtn);

    // Reset to desktop
    const resetPathBtn = createStyledButton(
      "Reset to Desktop",
      "#ff9800",
      "medium",
    );
    resetPathBtn.addEventListener("click", () => {
      (pathInput as HTMLInputElement).value = "";
      setPref("mindmapExportPath" as any, "" as any);
      this.showToast("Reset to desktop directory");
    });
    pathButtonGroup.appendChild(resetPathBtn);

    // Save path button
    const savePathBtn = createStyledButton("Save Path", "#4caf50", "medium");
    savePathBtn.addEventListener("click", () => {
      const value = (pathInput as HTMLInputElement).value.trim();
      setPref("mindmapExportPath" as any, value as any);
      this.showToast("Export path saved");
    });
    pathButtonGroup.appendChild(savePathBtn);

    form.appendChild(pathButtonGroup);

    // ==================== Configuration Preview ====================
    const previewDivider = this.createElement("div", {
      styles: {
        marginTop: "30px",
      },
    });
    form.appendChild(previewDivider);

    form.appendChild(createSectionTitle("📊 Current Configuration Preview"));

    const previewBox = this.createElement("div", {
      styles: {
        background: "var(--ai-surface-2)",
        border: "1px solid var(--ai-border)",
        borderRadius: "8px",
        padding: "15px",
        fontSize: "13px",
        lineHeight: "1.6",
      },
    });

    const promptPref = (getPref("mindmapPrompt" as any) as string) || "";
    const promptText = promptPref.trim() ? promptPref : defaultPrompt;
    const promptPreview =
      promptText.length > 100
        ? promptText.substring(0, 100) + "..."
        : promptText;
    const promptLabel = promptPref.trim() ? "Custom" : "Default";
    const path = (getPref("mindmapExportPath" as any) as string) || "(Desktop)";

    previewBox.innerHTML = `
      <div style="margin-bottom: 10px;">
        <strong>Prompt:</strong>
        <span style="color: var(--ai-text-muted);">
          (${promptLabel}) ${this.escapeHtml(promptPreview)}
        </span>
      </div>
      <div>
        <strong>Export Path:</strong>
        <span style="color: var(--ai-text-muted);">${path}</span>
      </div>
    `;

    form.appendChild(previewBox);

    this.container.appendChild(form);
  }

  /**
   * Show toast message
   */
  private showToast(message: string): void {
    new ztoolkit.ProgressWindow("Mind Map Settings")
      .createLine({
        text: message,
        type: "success",
      })
      .show();
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

export default MindmapSettingsPage;
