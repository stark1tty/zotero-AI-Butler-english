/**
 * 数据管理页面
 */

import { getPref, setPref, clearPref } from "../../../utils/prefs";
import {
  createFormGroup,
  createStyledButton,
  createNotice,
  createCard,
} from "../ui/components";
import { TaskQueueManager } from "../../taskQueue";
import { getDefaultSummaryPrompt } from "../../../utils/prompts";

export class DataSettingsPage {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render(): void {
    this.container.innerHTML = "";

    const title = Zotero.getMainWindow().document.createElement("h2");
    title.textContent = "💾 Data Management";
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
        "Includes task queue cleanup, settings import/export, and one-click reset tools.",
      ),
    );

    const section = Zotero.getMainWindow().document.createElement("div");
    Object.assign(section.style, { maxWidth: "820px" });

    // Task statistics
    const stats = this.getStats();
    const statsBox = Zotero.getMainWindow().document.createElement("div");
    Object.assign(statsBox.style, {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "12px",
      marginBottom: "16px",
    });

    const statConfigs = [
      { label: "Total Tasks", val: stats.total.toString(), icon: "📊" },
      { label: "Completed", val: stats.completed.toString(), icon: "✅" },
      { label: "Failed", val: stats.failed.toString(), icon: "⚠️" },
    ];

    statConfigs.forEach((s) => {
      const card = createCard("stat", s.label, undefined, {
        value: s.val,
        icon: s.icon,
        accentColor: "#59c0bc",
      });
      statsBox.appendChild(card);
    });

    section.appendChild(statsBox);

    // Action button row
    const row1 = Zotero.getMainWindow().document.createElement("div");
    Object.assign(row1.style, {
      display: "flex",
      gap: "12px",
      marginBottom: "12px",
    });
    const btnClearDone = createStyledButton(
      "🧹 Clear Completed Tasks",
      "#9e9e9e",
    );
    btnClearDone.addEventListener("click", async () => {
      await TaskQueueManager.getInstance().clearCompleted();
      this.render();
      new ztoolkit.ProgressWindow("Data Management")
        .createLine({ text: "Completed tasks cleared", type: "success" })
        .show();
    });
    const btnClearAll = createStyledButton("🗑️ Clear All Tasks", "#f44336");
    btnClearAll.addEventListener("click", async () => {
      const ok = Services.prompt.confirm(
        Zotero.getMainWindow() as any,
        "Clear Tasks",
        "Are you sure you want to clear all tasks?",
      );
      if (!ok) return;
      await TaskQueueManager.getInstance().clearAll();
      this.render();
      new ztoolkit.ProgressWindow("Data Management")
        .createLine({ text: "All tasks cleared", type: "success" })
        .show();
    });
    const btnClearEmptyNotes = createStyledButton(
      "🧹 Clear Empty Notes",
      "#ff9800",
    );
    btnClearEmptyNotes.addEventListener("click", () => this.clearEmptyNotes());
    row1.appendChild(btnClearDone);
    row1.appendChild(btnClearAll);
    row1.appendChild(btnClearEmptyNotes);
    section.appendChild(row1);

    // Settings export/import
    const row2 = Zotero.getMainWindow().document.createElement("div");
    Object.assign(row2.style, {
      display: "flex",
      gap: "12px",
      marginBottom: "12px",
    });
    const btnExport = createStyledButton(
      "📤 Export Settings (JSON)",
      "#2196f3",
    );
    btnExport.addEventListener("click", () => this.exportSettings());
    const btnImport = createStyledButton(
      "📥 Import Settings (JSON)",
      "#673ab7",
    );
    btnImport.addEventListener("click", () => this.importSettings());
    row2.appendChild(btnExport);
    row2.appendChild(btnImport);
    section.appendChild(row2);

    // One-click reset
    const row3 = Zotero.getMainWindow().document.createElement("div");
    Object.assign(row3.style, {
      display: "flex",
      gap: "12px",
      marginBottom: "12px",
    });
    const btnResetAll = createStyledButton(
      "♻️ Restore All Default Settings",
      "#9e9e9e",
    );
    btnResetAll.addEventListener("click", () => this.resetAll());
    section.appendChild(row3);
    row3.appendChild(btnResetAll);

    this.container.appendChild(section);
  }

  private getStats() {
    const q = TaskQueueManager.getInstance();
    q.refreshFromStorage();
    const all = q.getAllTasks();
    return {
      total: all.length,
      completed: all.filter((t) => t.status === "completed").length,
      failed: all.filter((t) => t.status === "failed").length,
    };
  }

  private exportSettings(): void {
    // Collect keys declared in prefs.d.ts
    const keys = [
      "provider",
      "openaiApiKey",
      "openaiApiUrl",
      "openaiApiModel",
      "geminiApiUrl",
      "geminiApiKey",
      "geminiModel",
      "temperature",
      "enableTemperature",
      "maxTokens",
      "enableMaxTokens",
      "topP",
      "enableTopP",
      "stream",
      "summaryPrompt",
      "customPrompts",
      "maxRetries",
      "batchSize",
      "batchInterval",
      "autoScan",
      "scanInterval",
      "pdfProcessMode",
      "theme",
      "fontSize",
      "autoScroll",
      "windowWidth",
      "windowHeight",
      "notePrefix",
      "noteStrategy",
    ];
    const data: any = {};
    keys.forEach((k) => {
      try {
        data[k] = getPref(k as any);
      } catch (e) {
        // Ignore individual preference read failures
        return;
      }
    });
    const json = JSON.stringify(data, null, 2);

    // Display in dialog for easy copying
    const win = Zotero.getMainWindow().document;
    const overlay = win.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "9999",
    });
    const modal = win.createElement("div");
    Object.assign(modal.style, {
      width: "720px",
      maxWidth: "90vw",
      background: "#fff",
      borderRadius: "8px",
      padding: "16px",
      boxShadow: "0 10px 30px rgba(0,0,0,.2)",
    });
    const ta = win.createElement("textarea");
    Object.assign(ta.style, {
      width: "100%",
      height: "360px",
      fontFamily: "Consolas, monospace",
      fontSize: "12px",
    });
    ta.value = json;
    const close = createStyledButton("Close", "#9e9e9e");
    close.addEventListener("click", () => overlay.remove());
    modal.appendChild(ta);
    modal.appendChild(close);
    overlay.appendChild(modal);
    (win.body ?? win.documentElement)!.appendChild(overlay);
  }

  private importSettings(): void {
    const win = Zotero.getMainWindow() as any;
    const text = { value: "" } as any;
    const ok = Services.prompt.prompt(
      win,
      "Import Settings",
      "Paste JSON: ",
      text,
      "",
      { value: false },
    );
    if (!ok || !text.value) return;
    try {
      const obj = JSON.parse(text.value);
      Object.entries(obj).forEach(([k, v]) => {
        try {
          setPref(k as any, v as any);
        } catch (e) {
          // Ignore items that cannot be set, continue processing others
          return;
        }
      });
      new ztoolkit.ProgressWindow("Import Settings")
        .createLine({ text: "✅ Import Successful", type: "success" })
        .show();
      this.render();
    } catch (e: any) {
      new ztoolkit.ProgressWindow("Import Settings")
        .createLine({ text: `❌ Parsing Failed: ${e.message}`, type: "fail" })
        .show();
    }
  }

  private resetAll(): void {
    const ok = Services.prompt.confirm(
      Zotero.getMainWindow() as any,
      "Restore Defaults",
      "This will reset most plugin settings. Continue?",
    );
    if (!ok) return;

    // Restore common items
    setPref("summaryPrompt", getDefaultSummaryPrompt());
    setPref("provider", "openai");
    setPref("openaiApiUrl", "https://api.openai.com/v1/responses");
    setPref("openaiApiKey", "");
    setPref("openaiApiModel", "gpt-5");
    setPref("temperature", "0.7");
    setPref("maxTokens", "4096");
    setPref("topP", "1.0");
    setPref("enableTemperature", true as any);
    setPref("enableMaxTokens", true as any);
    setPref("enableTopP", true as any);
    setPref("stream", true as any);
    setPref("theme", "system");
    setPref("fontSize", "14");
    setPref("autoScroll", true as any);
    setPref("windowWidth", "900");
    setPref("windowHeight", "650");
    setPref("maxRetries", "3");
    setPref("batchSize", "1");
    setPref("batchInterval", "60");
    clearPref("customPrompts");

    // Task queue local storage
    Zotero.Prefs.clear("extensions.zotero.aibutler.taskQueue", true);

    new ztoolkit.ProgressWindow("Data Management")
      .createLine({ text: "✅ Restored to Default Settings", type: "success" })
      .show();
    this.render();
  }

  /**
   * Clear all empty AI notes
   *
   * Scan all papers in the library and delete AI notes that only have a title but no actual content
   */
  private async clearEmptyNotes(): Promise<void> {
    const ok = Services.prompt.confirm(
      Zotero.getMainWindow() as any,
      "Clear Empty Notes",
      "This operation will scan all papers in the library and delete AI notes that only have a title but no actual content.\n\nContinue?",
    );
    if (!ok) return;

    let deletedCount = 0;
    let scannedCount = 0;

    try {
      // Get all items
      const allItems = await Zotero.Items.getAll(
        Zotero.Libraries.userLibraryID,
      );

      for (const item of allItems) {
        // Skip non-regular items (e.g. notes, attachments)
        if (!item.isRegularItem()) continue;

        scannedCount++;
        const noteIDs = (item as any).getNotes?.() || [];

        for (const noteID of noteIDs) {
          const note = await Zotero.Items.getAsync(noteID);
          if (!note) continue;

          // Check if this is an AI-generated note
          const tags: Array<{ tag: string }> = (note as any).getTags?.() || [];
          const hasTag = tags.some((t) => t.tag === "AI-Generated");
          const noteHtml: string = (note as any).getNote?.() || "";
          const titleMatch = /<h2>\s*(AI Butler|AI 管家)\s*-/.test(noteHtml);

          if (!hasTag && !titleMatch) continue;

          // Check if note content is empty
          // Remove title and wrapper tags then check remaining content
          const contentWithoutTitle = noteHtml
            .replace(/<h2>.*?<\/h2>/gi, "")
            .replace(/<div>|<\/div>/gi, "")
            .replace(/<[^>]+>/g, "") // Remove all HTML tags
            .trim();

          if (!contentWithoutTitle) {
            // This is an empty note, delete it
            await (note as any).eraseTx?.();
            deletedCount++;
          }
        }
      }

      new ztoolkit.ProgressWindow("Data Management")
        .createLine({
          text: `✅ Scanned ${scannedCount} papers, deleted ${deletedCount} empty notes`,
          type: "success",
        })
        .show();
    } catch (error: any) {
      ztoolkit.log("[AI Butler] Failed to clear empty notes:", error);
      new ztoolkit.ProgressWindow("Data Management")
        .createLine({
          text: `❌ Operation Failed: ${error.message}`,
          type: "fail",
        })
        .show();
    }
  }
}
