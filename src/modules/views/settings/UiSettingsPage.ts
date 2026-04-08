/**
 * UI 设置页面
 */

import { getPref, setPref } from "../../../utils/prefs";
import { AutoScanManager } from "../../autoScanManager";
import {
  createFormGroup,
  createSelect,
  createSlider,
  createInput,
  createCheckbox,
  createStyledButton,
  createNotice,
} from "../ui/components";

export class UiSettingsPage {
  private container: HTMLElement;
  private preview!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render(): void {
    this.container.innerHTML = "";

    const title = Zotero.getMainWindow().document.createElement("h2");
    title.textContent = "🎨 UI Settings";
    Object.assign(title.style, {
      color: "#59c0bc",
      marginBottom: "20px",
      fontSize: "20px",
      borderBottom: "2px solid #59c0bc",
      paddingBottom: "10px",
    });
    this.container.appendChild(title);

    this.container.appendChild(
      createNotice(
        "UI and behavior settings: auto-scroll, auto-scan; and how to handle existing AI notes.",
      ),
    );

    const form = Zotero.getMainWindow().document.createElement("div");
    Object.assign(form.style, { maxWidth: "820px" });

    // Auto-scroll
    const autoScroll = (getPref("autoScroll") as boolean) ?? true;
    const autoScrollBox = createCheckbox("autoScroll", !!autoScroll);
    form.appendChild(
      createFormGroup(
        "Auto-scroll to Latest Output",
        autoScrollBox,
        "Automatically scroll to the bottom of the output window when generating notes",
      ),
    );

    // Auto-scan
    const autoScan = (getPref("autoScan") as boolean) ?? true;
    const autoScanBox = createCheckbox("autoScan", !!autoScan);
    form.appendChild(
      createFormGroup(
        "Auto-scan New Literature",
        autoScanBox,
        "Monitor library changes and automatically add new items to the analysis queue",
      ),
    );

    // Save chat history
    const saveChatHistory = (getPref("saveChatHistory") as boolean) ?? true;
    const saveChatHistoryBox = createCheckbox(
      "saveChatHistory",
      !!saveChatHistory,
    );
    form.appendChild(
      createFormGroup(
        "Save Follow-up Chat History",
        saveChatHistoryBox,
        "When enabled, follow-up conversation content will be automatically saved to the paper's AI Butler note",
      ),
    );

    // Note management strategy
    const policy = (
      (getPref("noteStrategy" as any) as string) || "skip"
    ).toString();
    const policySelect = createSelect(
      "notePolicy",
      [
        { value: "skip", label: "Skip (Default)" },
        { value: "overwrite", label: "Overwrite" },
        { value: "append", label: "Append" },
      ],
      policy,
    );
    form.appendChild(
      createFormGroup(
        "Existing AI Note Strategy",
        policySelect,
        "How to handle items that already have AI summary notes",
      ),
    );

    // Table management strategy
    const tablePolicy = (
      (getPref("tableStrategy" as any) as string) || "skip"
    ).toString();
    const tablePolicySelect = createSelect(
      "tablePolicy",
      [
        { value: "skip", label: "Skip (Default)" },
        { value: "overwrite", label: "Overwrite" },
      ],
      tablePolicy,
    );
    form.appendChild(
      createFormGroup(
        "Existing AI Table Strategy",
        tablePolicySelect,
        "How to handle items that already have AI table notes",
      ),
    );

    // Markdown note style theme
    const currentTheme = (
      (getPref("markdownTheme" as any) as string) || "github"
    ).toString();
    const themeSelect = createSelect(
      "markdownTheme",
      [
        { value: "github", label: "GitHub (Default)" },
        { value: "redstriking", label: "Redstriking" },
        // More themes can be added here
      ],
      currentTheme,
    );
    form.appendChild(
      createFormGroup(
        "Sidebar Note Style",
        themeSelect,
        "Set the Markdown rendering style for AI notes in the sidebar",
      ),
    );

    // Preview area (font size preview removed, no longer providing font size setting)

    // Buttons
    const actions = Zotero.getMainWindow().document.createElement("div");
    Object.assign(actions.style, {
      display: "flex",
      gap: "12px",
      marginTop: "16px",
    });
    const btnSave = createStyledButton("💾 Save Settings", "#4caf50");
    btnSave.addEventListener("click", async () => {
      const autoVal =
        (form.querySelector("#setting-autoScroll") as HTMLInputElement)
          ?.checked ?? true;
      const autoScanVal =
        (form.querySelector("#setting-autoScan") as HTMLInputElement)
          ?.checked ?? true;
      const saveChatHistoryVal =
        (form.querySelector("#setting-saveChatHistory") as HTMLInputElement)
          ?.checked ?? true;
      const policyVal = (policySelect as any).getValue
        ? (policySelect as any).getValue()
        : policy;
      const tablePolicyVal = (tablePolicySelect as any).getValue
        ? (tablePolicySelect as any).getValue()
        : tablePolicy;
      const themeVal = (themeSelect as any).getValue
        ? (themeSelect as any).getValue()
        : currentTheme;

      setPref("autoScroll", !!autoVal as any);
      setPref("autoScan", !!autoScanVal as any);
      setPref("saveChatHistory", !!saveChatHistoryVal as any);
      setPref("noteStrategy" as any, policyVal);
      setPref("tableStrategy" as any, tablePolicyVal);
      setPref("markdownTheme" as any, themeVal);

      // Clear theme cache to load new theme next time
      const { themeManager } = await import("../../themeManager");
      themeManager.setCurrentTheme(themeVal);
      themeManager.clearCache();

      // Reload auto-scan manager
      AutoScanManager.getInstance().reload();

      new ztoolkit.ProgressWindow("UI Settings")
        .createLine({ text: "✅ Settings Saved", type: "success" })
        .show();
    });

    const btnReset = createStyledButton("🔄 Reset to Default", "#9e9e9e");
    btnReset.addEventListener("click", () => {
      setPref("autoScroll", true as any);
      setPref("autoScan", true as any);
      setPref("saveChatHistory", true as any);
      setPref("noteStrategy" as any, "skip");
      setPref("tableStrategy" as any, "skip");
      AutoScanManager.getInstance().reload();
      this.render();
      new ztoolkit.ProgressWindow("UI Settings")
        .createLine({ text: "Reset to Default", type: "success" })
        .show();
    });
    actions.appendChild(btnSave);
    actions.appendChild(btnReset);
    form.appendChild(actions);

    this.container.appendChild(form);

    // No font size preview
  }

  private applyPreview(fontSize: number): void {
    if (!this.preview) return;
    this.preview.style.fontSize = `${fontSize}px`;
  }
}
