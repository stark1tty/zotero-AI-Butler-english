/**
 * ================================================================
 * AI 笔记生成器模块
 * ================================================================
 *
 * 本模块是插件的核心功能实现,负责协调 PDF 提取、AI 分析和笔记创建的完整流程
 *
 * 主要职责:
 * 1. 统筹论文总结生成的完整工作流
 * 2. 协调 PDF 文本提取和 AI 模型调用
 * 3. 管理流式输出和用户界面Update
 * 4. 处理批量文献的队列执行
 * 5. 创建和管理 Zotero 笔记条目
 *
 * 工作流程:
 * PDF提取 -> 文本清理 -> AI分析 -> Markdown转换 -> 笔记保存
 *
 * 技术特点:
 * - 支持流式输出,实时反馈生成进度
 * - 智能错误处理和重试机制
 * - 批量处理支持用户中断
 * - Markdown 格式适配 Zotero 笔记系统
 *
 * @module noteGenerator
 * @author AI-Butler Team
 */

import { PDFExtractor } from "./pdfExtractor";
import { LLMClient } from "./llmClient";
import { SummaryView } from "./views/SummaryView";
import { getPref } from "../utils/prefs";
import { MainWindow } from "./views/MainWindow";
import { marked } from "marked";
import {
  parseMultiRoundPrompts,
  getDefaultMultiRoundFinalPrompt,
  DEFAULT_TABLE_TEMPLATE,
  DEFAULT_TABLE_FILL_PROMPT,
  type MultiRoundPromptItem,
  type SummaryMode,
} from "../utils/prompts";

/**
 * AI 笔记生成器类
 *
 * 提供静态方法集合,封装论文笔记生成的核心逻辑
 * 采用静态方法设计,简化调用方式,无需实例化
 */
export class NoteGenerator {
  /**
   * 为单个文献条目生成 AI 总结笔记
   *
   * 这是单条目处理的核心函数,协调整个生成流程
   *
   * 执行流程:
   * 1. 从文献条目提取 PDF 文本
   * 2. 清理和预处理文本内容
   * 3. 调用 AI 模型生成总结
   * 4. 将 Markdown 格式转换为 Zotero 笔记格式
   * 5. 创建笔记并关联到文献条目
   *
   * 流式输出支持:
   * - 如果提供 outputWindow,会实时显示生成过程
   * - 通过 onProgress 回调函数传递 AI 输出的增量内容
   * - 用户可以在输出窗口中看到"打字机效果"
   *
   * 错误处理:
   * - PDF 提取失败:抛出明确的错误信息
   * - AI 调用失败:包含 API 错误详情
   * - 不创建包含错误信息的笔记,直接抛出异常由上层处理
   *
   * @param item Zotero 文献条目对象
   * @param outputWindow Optional的输出窗口,用于显示流式生成过程
   * @param progressCallback Optional的进度回调函数,接收处理状态消息和进度百分比
   * @returns 包含创建的笔记对象和完整内容的对象
   * @throws 当任何步骤失败时抛出错误
   */
  public static async generateNoteForItem(
    item: Zotero.Item,
    outputWindow?: SummaryView,
    progressCallback?: (message: string, progress: number) => void,
    streamCallback?: (chunk: string) => void,
    options?: { summaryMode?: string; forceOverwrite?: boolean },
  ): Promise<{ note: Zotero.Item; content: string }> {
    // 获取文献标题,用于日志和用户反馈
    const itemTitle = item.getField("title") as string;
    let note: Zotero.Item | null = null;
    let fullContent = "";

    try {
      // 笔记管理策略: skip/overwrite/append
      const policy = (
        (getPref("noteStrategy" as any) as string) || "skip"
      ).toLowerCase();
      const existing = await this.findExistingNote(item);
      // 如果不是强制覆盖，且Already exists笔记，则检查策略
      if (existing && !options?.forceOverwrite) {
        if (policy === "skip") {
          progressCallback?.("AI note already exists, skipping", 100);
          return {
            note: existing as Zotero.Item,
            content: ((existing as any).getNote?.() as string) || "",
          };
        }
      }

      // 步骤 1: PDF 处理
      progressCallback?.("ProcessingPDF...", 10);

      // 检查 PDF 文件大小限制
      const enableSizeLimit =
        (getPref("enablePdfSizeLimit" as any) as boolean) ?? false;
      if (enableSizeLimit) {
        const maxPdfSizeMB = parseFloat(
          (getPref("maxPdfSizeMB" as any) as string) || "50",
        );
        const fileSizeMB = await PDFExtractor.getPdfFileSize(item);
        if (fileSizeMB > maxPdfSizeMB) {
          throw new Error(
            `PDF file too large (${fileSizeMB.toFixed(1)} MB)，exceeds the set threshold ${maxPdfSizeMB} MB`,
          );
        }
      }

      // 读取 PDF 处理模式和附件选择模式
      const prefMode = (getPref("pdfProcessMode") as string) || "base64";
      const pdfAttachmentMode =
        (getPref("pdfAttachmentMode" as any) as string) || "default";

      let pdfContent: string;
      let isBase64 = false;
      let useMultiPdfMode = false;

      // 检查是否应该Using multi-PDF mode
      if (pdfAttachmentMode === "all" && prefMode === "base64") {
        const allPdfs = await PDFExtractor.getAllPdfAttachments(item);

        if (allPdfs.length > 1) {
          // 检查当前 provider 是否支持多文件上传
          const provider = LLMClient.getCurrentProvider();
          const supportsMultiFile =
            provider && typeof provider.generateMultiFileSummary === "function";

          if (supportsMultiFile) {
            useMultiPdfMode = true;
            progressCallback?.(
              `Using multi-PDF mode (${allPdfs.length} files)...`,
              15,
            );
          } else {
            // Provider 不支持多文件，回退到默认模式
            try {
              new ztoolkit.ProgressWindow("AI Butler", {
                closeOnClick: true,
                closeTime: 3000,
              })
                .createLine({
                  text: "Current API does not support multi-PDF upload, using default PDF",
                  type: "warning",
                })
                .show();
            } catch {
              // Ignore notification error
            }
          }
        }
      }

      // 根据模式处理 PDF
      if (!useMultiPdfMode) {
        // 单 PDF 模式 (默认)
        if (prefMode === "base64") {
          pdfContent = await PDFExtractor.extractBase64FromItem(item);
          isBase64 = true;
        } else {
          const fullText = await PDFExtractor.extractTextFromItem(item);
          const cleanedText = PDFExtractor.cleanText(fullText);
          pdfContent = PDFExtractor.truncateText(cleanedText);
          isBase64 = false;
        }
      } else {
        // 多 PDF 模式 - 将在后续 AI 调用时直接使用
        // 这里设置占位符，实际处理在 LLMClient 中
        pdfContent = "__MULTI_PDF_MODE__";
        isBase64 = true;
      }

      // 步骤 2: AI 模型总结生成
      // 读取总结模式配置 - 优先使用传入的 options.summaryMode
      const summaryMode = (options?.summaryMode ||
        (getPref("summaryMode" as any) as string) ||
        "single") as SummaryMode;

      // 通知进度回调开始 AI 分析 (40% 完成)
      progressCallback?.(
        summaryMode === "single"
          ? "GeneratingAI summary..."
          : `Conducting multi-round analysis (mode: ${summaryMode === "multi_concat" ? "concatenation" : "summary"})...`,
        40,
      );

      // 如果有输出窗口,开始显示当前处理的条目
      if (outputWindow) {
        // 先显示加载状态
        outputWindow.showLoadingState(`Analyzing「${itemTitle}」`);
      }

      // 根据总结模式选择不同的生成策略
      if (summaryMode === "single") {
        // 单次对话模式：使用传统的单次总结
        // 定义流式输出回调函数
        const onProgress = async (chunk: string) => {
          fullContent += chunk;
          try {
            streamCallback?.(chunk);
          } catch (e) {
            ztoolkit.log("[AI Butler] streamCallback error:", e);
          }
          if (outputWindow) {
            if (fullContent === chunk) {
              outputWindow.startItem(itemTitle);
            }
            outputWindow.appendContent(chunk);
          }
        };

        let summary: string;
        if (useMultiPdfMode) {
          // 多 PDF 模式：获取所有 PDF 并调用多文件接口
          const allPdfs = await PDFExtractor.getAllPdfAttachments(item);
          const pdfFiles = await Promise.all(
            allPdfs.map(async (pdf) => {
              const path = await pdf.getFilePathAsync();
              if (!path || typeof path !== "string") {
                throw new Error(`Cannot get PDF file path: ${pdf.id}`);
              }
              // 获取 Base64 内容
              const pdfData = await Zotero.File.getBinaryContentsAsync(path);
              const bytes = new Uint8Array(pdfData.length);
              for (let i = 0; i < pdfData.length; i++) {
                bytes[i] = pdfData.charCodeAt(i);
              }
              let binary = "";
              const len = bytes.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64Content = btoa(binary);

              return {
                filePath: path || "",
                displayName:
                  (pdf.getField("title") as string) || `PDF-${pdf.id}`,
                base64Content,
              };
            }),
          );

          summary = await LLMClient.generateMultiFileSummary(
            pdfFiles,
            undefined, // 使用默认 prompt 解析逻辑
            onProgress,
          );
        } else {
          // 单 PDF 模式：使用原有方法
          summary = await LLMClient.generateSummaryWithRetry(
            pdfContent,
            isBase64,
            undefined,
            onProgress,
          );
        }
        fullContent = summary;
      } else {
        // 多轮对话模式
        fullContent = await this.generateMultiRoundContent(
          pdfContent,
          isBase64,
          itemTitle,
          summaryMode,
          outputWindow,
          progressCallback,
          streamCallback,
        );
      }

      // 步骤 3: 创建/Update笔记
      // 通知进度回调开始创建笔记 (80% 完成)
      progressCallback?.("Creating note...", 80);

      // 检查内容是否为空，防止创建空笔记
      if (!fullContent || !fullContent.trim()) {
        throw new Error("AI returned empty content, note not created");
      }

      // 格式化Note content,添加标题和样式
      const noteContent = this.formatNoteContent(
        itemTitle,
        fullContent,
        "AI Summary",
      );

      if (existing) {
        // 覆盖或追加到已有笔记
        const oldHtml = (existing as any).getNote?.() || "";
        let finalHtml = noteContent;
        if (policy === "append") {
          finalHtml = `${oldHtml}\n<hr/>\n${noteContent}`;
        }
        (existing as any).setNote?.(finalHtml);
        await (existing as any).saveTx?.();
        note = existing;
      } else {
        // 创建新笔记
        note = await this.createNote(item, noteContent);
        await note.saveTx();
      }

      // 如果有输出窗口,标记当前条目完成
      if (outputWindow) {
        outputWindow.finishItem();
      }

      // 通知进度回调完成 (100%)
      progressCallback?.("Done!", 100);

      // 异步并行填表（不阻塞笔记返回）
      const enableTable =
        (getPref("enableTableOnSingleNote" as any) as boolean) ?? true;
      if (enableTable) {
        // 延迟导入以避免循环依赖
        import("./literatureReviewService")
          .then(({ LiteratureReviewService }) => {
            const tableTemplate =
              (getPref("tableTemplate" as any) as string) ||
              DEFAULT_TABLE_TEMPLATE;
            const fillPrompt =
              (getPref("tableFillPrompt" as any) as string) ||
              DEFAULT_TABLE_FILL_PROMPT;
            const tableStrategy =
              (getPref("tableStrategy" as any) as string) || "skip";

            // 获取 PDF 附件
            const noteIDs = (item as any).getAttachments?.() || [];
            void (async () => {
              for (const attId of noteIDs) {
                try {
                  const att = await Zotero.Items.getAsync(attId);
                  if (att && att.isPDFAttachment?.()) {
                    // skip 策略时先检查是否已有表格
                    if (tableStrategy === "skip") {
                      const existing =
                        await LiteratureReviewService.findTableNote(item);
                      if (existing) break;
                    }
                    await LiteratureReviewService.fillTableForSinglePDF(
                      item,
                      att,
                      tableTemplate,
                      fillPrompt,
                    ).then((table) =>
                      LiteratureReviewService.saveTableNote(item, table),
                    );
                    break; // 只用第一个 PDF
                  }
                } catch (e) {
                  ztoolkit.log(
                    "[AI-Butler] Additional table filling failed:",
                    e,
                  );
                }
              }
            })();
          })
          .catch((e) => {
            ztoolkit.log("[AI-Butler] Failed to load table service:", e);
          });
      }

      // 返回创建的笔记对象和内容
      return { note, content: fullContent };
    } catch (error: any) {
      // 记录错误日志
      ztoolkit.log(`[AI Butler] 为文献"${itemTitle}"生成笔记时出错:`, error);

      // 如果有输出窗口,显示错误信息
      if (outputWindow) {
        outputWindow.showError(itemTitle, error.message);
      }

      // 不创建包含错误信息的笔记,直接抛出异常由上层处理
      throw error;
    }
  }

  /** 查找已有的 AI 笔记(通过标签或标题标识) */
  private static async findExistingNote(
    item: Zotero.Item,
  ): Promise<Zotero.Item | null> {
    try {
      const noteIDs = (item as any).getNotes?.() || [];
      let target: any = null;
      for (const nid of noteIDs) {
        const n = await Zotero.Items.getAsync(nid);
        if (!n) continue;
        const tags: Array<{ tag: string }> = (n as any).getTags?.() || [];
        const hasTag = tags.some((t) => t.tag === "AI-Generated");
        const hasTableTag = tags.some((t) => t.tag === "AI-Table");
        const noteHtml: string = (n as any).getNote?.() || "";
        const titleMatch = /<h2>\s*AI 管家\s*-/.test(noteHtml);
        if (!hasTableTag && (hasTag || titleMatch)) {
          if (!target) target = n;
          else {
            const a = (target as any).dateModified || 0;
            const b = (n as any).dateModified || 0;
            if (b > a) target = n;
          }
        }
      }
      return target;
    } catch {
      return null;
    }
  }

  /**
   * 格式化Note content
   *
   * 为 AI 生成的总结添加标题头部,并转换为 Zotero 笔记兼容的 HTML 格式
   *
   * 处理步骤:
   * 1. 将 Markdown 格式的总结转换为 HTML
   * 2. 添加文献标题作为笔记标题 (并限制长度)
   * 3. 包装成完整的笔记结构
   *
   * @param itemTitle 文献条目标题
   * @param summary AI 生成的Summary content (Markdown 格式)
   * @returns 格式化后的 HTML 内容,可直接保存到 Zotero 笔记
   *
   * @example
   * ```typescript
   * const formatted = formatNoteContent(
   *   "Deep Learning Review",
   *   "## 摘要\nThis is a review article..."
   * );
   * // 返回: <h2>AI 管家 - Deep Learning Review</h2><div>...</div>
   * ```
   */
  public static formatNoteContent(
    itemTitle: string,
    summary: string,
    prefix: string = "",
  ): string {
    // 将 Markdown 转换为笔记格式的 HTML
    const htmlContent = this.convertMarkdownToNoteHTML(summary);

    // 定义笔记标题中允许的文献标题最大长度,避免 Zotero 同步问题
    const maxTitleLength = 100;
    let truncatedTitle = itemTitle;

    // 如果原始标题超过长度限制,则进行截断并添加省略号
    if (truncatedTitle.length > maxTitleLength) {
      truncatedTitle = truncatedTitle.substring(0, maxTitleLength) + "...";
    }

    // 组装标题：有前缀则 "前缀 - 标题"，无前缀则直接用标题
    const heading = prefix
      ? `${this.escapeHtml(prefix)} - ${this.escapeHtml(truncatedTitle)}`
      : this.escapeHtml(truncatedTitle);

    // 添加标题头部和内容包装
    return `<h2>${heading}</h2>
<div>${htmlContent}</div>`;
  }

  /**
   * 将 Markdown 转换为适合 Zotero 笔记的 HTML 格式
   *
   * Zotero 笔记系统对 HTML 格式有特定要求:
   * 1. 不支持内联样式 (style 属性)
   * 2. 数学公式需要使用特定的 class 标记
   * 3. 块级公式用 <pre class="math">
   * 4. 行内公式用 <span class="math">
   *
   * 转换步骤:
   * 1. 使用 MainWindow 的核心方法将 Markdown 转换为 HTML
   * 2. 移除所有内联样式属性
   * 3. 将 MathJax 格式的公式转换为 Zotero 识别的格式
   *
   * 公式格式转换规则:
   * - `$$公式$$` -> `<pre class="math">$$公式$$</pre>` (块级)
   * - `$公式$` -> `<span class="math">$公式$</span>` (行内)
   *
   * @param markdown 原始 Markdown 文本
   * @returns 转换后的 HTML,适配 Zotero 笔记系统
   *
   * @example
   * ```typescript
   * const html = convertMarkdownToNoteHTML(
   *   "## 公式\nMass-energy equation: $E=mc^2$\n\n$$\\frac{a}{b}$$"
   * );
   * // 返回格式化的 HTML,公式被正确标记
   * ```
   */
  private static convertMarkdownToNoteHTML(markdown: string): string {
    // ===== 步骤 1: 保护公式，避免被 marked 误处理（将下划线转成 <em>）=====
    const formulas: Array<{ content: string; isBlock: boolean }> = [];
    let processedMarkdown = markdown;

    // 保护块级公式 $$...$$ 和 \[...\]
    processedMarkdown = processedMarkdown.replace(
      /(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])/g,
      (_match, start, formula, end) => {
        // 确保匹配闭合（虽然正则已经尽量做了，但防止 $$ 匹配到 \] 等情况，虽然正则结构保证了配对如果贪婪度控制得好）
        // 这里简化处理：只要匹配到了就当做公式
        const placeholder = `FORMULA_BLOCK_${formulas.length}_END`;
        formulas.push({ content: formula.trim(), isBlock: true });
        return placeholder;
      },
    );

    // 保护内联公式 $...$ 和 \(...\)
    processedMarkdown = processedMarkdown.replace(
      // eslint-disable-next-line no-useless-escape
      /((?<!\$)\$(?!\$)|\\\()([^\$\n]+?)((?<!\$)\$(?!\$)|\\\))/g,
      (_match, start, formula, end) => {
        // 简单的完整性检查：start 和 end 应该属于同一类（$配$，\(配\)）
        // 但为了宽容度，我们暂不严格校验配对，因为正则已经限制了内部不含 delimiters
        const placeholder = `FORMULA_INLINE_${formulas.length}_END`;
        formulas.push({ content: formula.trim(), isBlock: false });
        return placeholder;
      },
    );

    // ===== 步骤 2: 预处理加粗语法 =====
    processedMarkdown = processedMarkdown.replace(
      // eslint-disable-next-line no-useless-escape
      /\*\*([^\*\n]+?)\*\*/g,
      "<strong>$1</strong>",
    );

    // ===== 步骤 3: 配置并运行 marked =====
    marked.setOptions({
      breaks: true, // 单换行符转换为 <br>，解决国产模型换行问题
      gfm: true, // 启用 GitHub Flavored Markdown
    });

    let html = marked.parse(processedMarkdown) as string;

    // 移除所有内联样式,Zotero 笔记不支持 style 属性
    html = html.replace(/\s+style="[^"]*"/g, "");

    // ===== 步骤 4: 恢复公式（使用 Zotero 原生笔记Edit器识别的格式）=====
    html = html.replace(
      /FORMULA_(BLOCK|INLINE)_(\d+)_END/g,
      (_match, type, index) => {
        const formulaData = formulas[parseInt(index)];
        if (!formulaData) return _match;
        const { content, isBlock } = formulaData;

        // 关键修复：必须对 LaTeX 内容进行 HTML 转义，否则 <, >, & 等字符会破坏 XML 结构
        const escapedContent = NoteGenerator.escapeHtml(content);

        // 根据用户反馈和 Zotero 特性调整：
        // 鉴于用户反馈块级公式 <math-display> 未渲染，而行内公式有效
        // 为了稳妥，暂时将所有公式都作为 <math-inline> 生成
        if (isBlock) {
          // 块级公式：必须使用 $ 包裹（Zotero不支持 $$），加上 \displaystyle 强制显示为块级样式
          // 外层用 p 和 style 实现居中
          return `<p style="text-align: center;"><span class="math">$\\displaystyle ${escapedContent}$</span></p>`;
        } else {
          // 行内公式：使用 $ 包裹
          return `<span class="math">$${escapedContent}$</span>`;
        }
      },
    );

    return html;
  }

  /**
   * HTML 转义工具函数
   *
   * 将特殊字符转换为 HTML 实体,防止 XSS 攻击和Format error
   *
   * 转义规则:
   * - & → &amp;
   * - < → &lt;
   * - > → &gt;
   * - " → &quot;
   * - ' → &#39;
   *
   * @param text 待转义的文本
   * @returns 转义后的安全 HTML 文本
   *
   * @example
   * ```typescript
   * escapeHtml('<script>alert("xss")</script>')
   * // 返回: "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
   * ```
   */
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * 创建新的 Zotero 笔记条目
   *
   * 在 Zotero 数据库中创建一个新的笔记,并关联到指定的文献条目
   *
   * 操作步骤:
   * 1. 实例化一个新的笔记对象
   * 2. 设置父条目 ID (关联到文献)
   * 3. 设置Note content (HTML 格式)
   * 4. 添加标签 "AI-Generated"
   * 5. 保存到数据库
   *
   * 笔记特性:
   * - 自动关联到父文献条目
   * - 带有 "AI-Generated" 标签便于筛选
   * - 内容为 HTML 格式,支持富文本显示
   *
   * @param item 父文献条目对象
   * @param initialContent 初始Note content (HTML 格式),默认为空字符串
   * @returns 创建并保存的笔记对象
   *
   * @example
   * ```typescript
   * const note = await createNote(
   *   parentItem,
   *   "<h2>总结</h2><p>This is AI-generated content</p>"
   * );
   * console.log(note.id); // 新创建的笔记 ID
   * ```
   */
  public static async createNote(
    item: Zotero.Item,
    initialContent: string = "",
  ): Promise<Zotero.Item> {
    // 创建新的笔记对象
    const note = new Zotero.Item("note");

    // 设置库 ID 和父条目 ID,将笔记关联到文献
    // 修复群组文献库中创建笔记时 "Parent item not found" 的问题
    note.libraryID = item.libraryID;
    note.parentID = item.id;

    // 设置Note content
    note.setNote(initialContent);

    // 添加 AI 生成标签,便于用户筛选和识别
    note.addTag("AI-Generated");

    // 保存到数据库
    await note.saveTx();

    return note;
  }

  /**
   * 执行多轮对话并生成内容
   *
   * 根据配置的多轮提示词依次进行对话，支持两种模式：
   * - multi_concat: 将所有对话内容concatenation（最详细）
   * - multi_summarize: 基于对话生成最终总结（均衡）
   *
   * @param pdfContent PDF内容（Base64或文本）
   * @param isBase64 是否为Base64编码
   * @param itemTitle 文献标题
   * @param mode 总结模式
   * @param outputWindow 输出窗口
   * @param progressCallback 进度回调
   * @param streamCallback 流式输出回调
   * @returns 生成的内容
   */
  private static async generateMultiRoundContent(
    pdfContent: string,
    isBase64: boolean,
    itemTitle: string,
    mode: SummaryMode,
    outputWindow?: SummaryView,
    progressCallback?: (message: string, progress: number) => void,
    streamCallback?: (chunk: string) => void,
  ): Promise<string> {
    // 读取多轮提示词配置
    const multiRoundPromptsJson = getPref("multiRoundPrompts" as any) as string;
    const prompts = parseMultiRoundPrompts(multiRoundPromptsJson);
    const totalRounds = prompts.length;

    // 存储每轮对话的问答内容
    const roundResults: Array<{
      title: string;
      question: string;
      answer: string;
    }> = [];

    // 维护对话历史（用于上下文）
    const conversationHistory: Array<{
      role: "user" | "assistant";
      content: string;
    }> = [];

    // 显示标题
    if (outputWindow) {
      outputWindow.startItem(itemTitle);
      outputWindow.appendContent(
        `**[Multi-round mode: ${mode === "multi_concat" ? "concatenation" : "summary"}]**\n\n`,
      );
    }

    // 依次执行每轮对话
    for (let i = 0; i < totalRounds; i++) {
      const currentPrompt = prompts[i];
      const roundNum = i + 1;
      const progressPercent = 40 + Math.floor((i / totalRounds) * 40); // 40% - 80%

      progressCallback?.(
        `Conducting round ${roundNum}/${totalRounds} of dialogue: ${currentPrompt.title}`,
        progressPercent,
      );

      // 在输出窗口显示当前轮次标题
      if (outputWindow) {
        outputWindow.appendContent(
          `\n##  Round ${roundNum} : ${currentPrompt.title}\n\n`,
        );
        outputWindow.appendContent(`**Question:** ${currentPrompt.prompt}\n\n`);
        outputWindow.appendContent(`**Answer:**\n`);
      }

      // 构建当前对话消息
      conversationHistory.push({
        role: "user",
        content: currentPrompt.prompt,
      });

      // 收集当前轮次的回答
      let currentAnswer = "";
      const onRoundProgress = async (chunk: string) => {
        currentAnswer += chunk;
        streamCallback?.(chunk);
        if (outputWindow) {
          outputWindow.appendContent(chunk);
        }
      };

      try {
        // 调用 LLM 进行对话（带自动 API 密钥轮换）
        const answer = await LLMClient.chatWithRetry(
          pdfContent,
          isBase64,
          conversationHistory,
          onRoundProgress,
        );
        currentAnswer = answer;

        // 将助手回复加入对话历史
        conversationHistory.push({
          role: "assistant",
          content: answer,
        });

        // 记录本轮结果
        roundResults.push({
          title: currentPrompt.title,
          question: currentPrompt.prompt,
          answer: answer,
        });

        if (outputWindow) {
          outputWindow.appendContent("\n\n---\n");
        }
      } catch (error: any) {
        ztoolkit.log(`[AI Butler]  Round ${roundNum} 轮对话失败:`, error);
        // 如果某轮对话失败，记录错误但继续
        roundResults.push({
          title: currentPrompt.title,
          question: currentPrompt.prompt,
          answer: `[Error: ${error.message}]`,
        });

        if (outputWindow) {
          outputWindow.appendContent(
            `\n\n❌ **Conversation failed:** ${error.message}\n\n---\n`,
          );
        }
      }
    }

    // 根据模式生成最终内容
    if (mode === "multi_concat") {
      // concatenation模式：直接concatenation所有问答
      return this.formatMultiRoundConcat(roundResults);
    } else {
      // 总结模式：基于所有对话进行最终总结
      progressCallback?.("Generating final summary...", 85);

      if (outputWindow) {
        outputWindow.appendContent("\n## 📝 Final Summary\n\n");
      }

      // 读取最终总结提示词
      const finalPromptConfig = getPref(
        "multiRoundFinalPrompt" as any,
      ) as string;
      const finalPrompt =
        finalPromptConfig?.trim() || getDefaultMultiRoundFinalPrompt();

      // 将最终总结提示词加入对话
      conversationHistory.push({
        role: "user",
        content: finalPrompt,
      });

      let finalSummary = "";
      const onFinalProgress = async (chunk: string) => {
        finalSummary += chunk;
        streamCallback?.(chunk);
        if (outputWindow) {
          outputWindow.appendContent(chunk);
        }
      };

      try {
        // 调用 LLM 生成最终总结（带自动 API 密钥轮换）
        const summary = await LLMClient.chatWithRetry(
          pdfContent,
          isBase64,
          conversationHistory,
          onFinalProgress,
        );

        // 检查是否需要保存中间对话内容
        const saveIntermediate =
          (getPref("multiSummarySaveIntermediate" as any) as boolean) ?? false;
        if (saveIntermediate) {
          // concatenation中间内容和最终总结
          const intermediateContent = this.formatMultiRoundConcat(roundResults);
          return `${intermediateContent}\n---\n\n# 📝 Final Summary\n\n${summary}`;
        }

        return summary;
      } catch (error: any) {
        ztoolkit.log("[AI Butler] 最终总结生成失败:", error);
        // 如果最终总结失败，回退到concatenation模式
        return this.formatMultiRoundConcat(roundResults);
      }
    }
  }

  /**
   * 格式化多轮对话concatenation内容
   *
   * @param roundResults 各轮对话结果
   * @returns 格式化后的 Markdown 内容
   */
  private static formatMultiRoundConcat(
    roundResults: Array<{ title: string; question: string; answer: string }>,
  ): string {
    let content = "# Multi-Round Conversation Analysis\n\n";

    for (let i = 0; i < roundResults.length; i++) {
      const result = roundResults[i];
      content += `##  Round ${i + 1} : ${result.title}\n\n`;
      content += `**Question:** ${result.question}\n\n`;
      content += `**Answer:**\n${result.answer}\n\n`;
      content += "---\n\n";
    }

    return content;
  }

  /**
   * 为多个文献条目批量生成 AI 总结笔记
   *
   * 这是批量处理的核心函数,提供完整的用户交互和进度管理
   *
   * 功能特性:
   * 1. 自动创建输出窗口显示实时进度
   * 2. 支持用户中途停止处理
   * 3. 详细的成功/失败统计
   * 4. 每个条目独立处理,单个失败不影响后续条目
   *
   * 处理流程:
   * 1. 创建并Open主窗口
   * 2. 切换到 AI 总结视图
   * 3. 设置用户停止回调
   * 4. 依次处理每个条目
   * 5. 实时Update进度和统计
   * 6. 显示最终处理结果
   *
   * 错误处理策略:
   * - 单个条目失败:记录日志,继续处理下一个
   * - 用户停止:立即中断,显示Completed和未处理统计
   * - System error:抛出异常,停止所有处理
   *
   * 进度回调参数说明:
   * - current: 当前处理到第几个条目 (1-based)
   * - total: 总共要处理的条目数
   * - progress: 当前条目的处理进度 (0-100)
   * - message: 进度描述消息
   *
   * @param items Zotero 文献条目数组
   * @param progressCallback Optional的进度回调函数
   *
   * @example
   * ```typescript
   * await generateNotesForItems(
   *   selectedItems,
   *   (current, total, progress, message) => {
   *     console.log(`[${current}/${total}] ${progress}% - ${message}`);
   *   }
   * );
   * ```
   */
  public static async generateNotesForItems(
    items: Zotero.Item[],
    progressCallback?: (
      current: number,
      total: number,
      progress: number,
      message: string,
    ) => void,
  ): Promise<void> {
    const total = items.length;
    let successCount = 0; // 成功处理计数
    let failedCount = 0; // 失败处理计数
    let stopped = false; // 用户停止标记
    let processingCompleted = false;

    // 创建并Open主窗口
    const mainWindow = MainWindow.getInstance();
    await mainWindow.open("summary");

    // 获取 AI 总结视图
    const summaryView = mainWindow.getSummaryView();
    summaryView.updateQueueButton("ready");

    // 设置返回任务队列按钮的回调函数
    summaryView.setQueueButtonHandler(() => {
      if (!stopped && !processingCompleted) {
        stopped = true;
        summaryView.updateQueueButton("stopped");
      }
      mainWindow.switchTab("tasks");
    });

    // 等待窗口完全初始化,避免渲染问题
    await Zotero.Promise.delay(200);

    try {
      // 依次处理每个文献条目
      for (let i = 0; i < total; i++) {
        // 检查用户是否点击了停止按钮
        if (stopped) {
          ztoolkit.log("[AI Butler] 用户停止了批量处理");
          break;
        }

        const item = items[i];
        const current = i + 1;
        const itemTitle = item.getField("title") as string;

        try {
          // 为当前条目生成笔记,带流式输出
          await this.generateNoteForItem(
            item,
            summaryView,
            (message, progress) => {
              // 转发进度信息到外层回调
              progressCallback?.(current, total, progress, message);
            },
          );

          // 成功计数加一
          successCount++;
        } catch (error: any) {
          // 记录失败,但继续处理下一个条目
          failedCount++;
          ztoolkit.log(`[AI Butler] 处理文献"${itemTitle}"失败:`, error);
        }
      }

      // 根据停止状态显示不同的完成消息
      if (stopped) {
        // 用户主动停止的情况
        const notProcessed = total - successCount - failedCount;
        summaryView.showStopped(successCount, failedCount, notProcessed);
        summaryView.updateQueueButton("stopped");
        processingCompleted = true;
        progressCallback?.(
          total,
          total,
          100,
          `Stopped (completed ${successCount}, failed ${failedCount}, unprocessed ${notProcessed})`,
        );
      } else {
        // 正常完成的情况
        summaryView.showComplete(successCount, total);
        summaryView.updateQueueButton("completed");
        processingCompleted = true;

        // 根据成功/失败情况生成不同的完成消息
        if (failedCount === 0) {
          progressCallback?.(
            total,
            total,
            100,
            "All items processing complete",
          );
        } else if (successCount === 0) {
          progressCallback?.(total, total, 100, "All items processing failed");
        } else {
          progressCallback?.(
            total,
            total,
            100,
            `${successCount} succeeded, ${failedCount} failed`,
          );
        }
      }
    } catch (error: any) {
      // 发生系统级错误时禁用停止按钮
      summaryView.updateQueueButton("error");
      processingCompleted = true;
      ztoolkit.log("[AI Butler] 批量处理过程中发生错误:", error);
      throw error;
    }
  }
}
