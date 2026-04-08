/**
 * ================================================================
 * AI 提示词配置管理模块
 * ================================================================
 *
 * 本模块集中管理所有与 AI 提示词相关的配置和逻辑
 *
 * 主要职责:
 * 1. 定义和维护默认的论文总结提示词模板
 * 2. 管理提示词版本,支持自动升级机制
 * 3. 提供提示词构建和格式化工具函数
 * 4. 确保提示词的一致性和可维护性
 *
 * 设计理念:
 * - 集中管理:所有提示词相关代码集中在此模块,便于修改和维护
 * - 版本控制:通过版本号机制,支持提示词的平滑升级
 * - 灵活扩展:提供工具函数,支持动态构建提示词
 * - 国际化友好:提示词结构清晰,易于翻译和本地化
 *
 * @module prompts
 * @author AI-Butler Team
 */

/**
 * 提示词版本号
 *
 * 版本管理策略:
 * - 每次修改默认提示词时,必须递增此版本号
 * - 插件启动时会检查用户的提示词版本
 * - 如果用户使用旧版本且未自定义,会自动升级到新版本
 *
 * 升级触发条件:
 * 1. 用户的提示词版本号小于当前版本号
 * 2. 用户未进行过自定义修改(或修改内容与旧版本默认值一致)
 *
 * 版本变更记录:
 * - v1: 初始版本,包含角色定义、任务说明、输出要求
 *
 * @const {number} PROMPT_VERSION 当前提示词版本号
 */
export const PROMPT_VERSION = 1;

/**
 * 默认的论文总结提示词模板
 *
 * 此模板定义了 AI 生成论文总结的详细指令
 *
 * 模板结构:
 * 1. 角色定义:明确 AI 的身份和专业能力
 * 2. 任务说明:详细描述需要 AI 完成的工作
 *    - 全文核心摘要:一段式高度概括
 *    - 分章节详细解析:结构化的深入分析
 *    - 创新性与局限性评估:批判性思维评价
 * 3. 输出要求:规范输出格式和语言风格
 *
 * 设计原则:
 * - 指令明确:避免歧义,确保 AI 理解任务
 * - 结构化输出:便于用户快速理解论文内容
 * - 深度与广度兼顾:既有宏观概括,又有细节分析
 * - 批判性思维:不仅总结,还要评价创新点和局限性
 *
 * 使用场景:
 * - 用户首次安装插件时的默认提示词
 * - 用户重置提示词设置时的参考模板
 * - 提示词版本升级时的新版本内容
 *
 * @const {string} DEFAULT_SUMMARY_PROMPT 默认提示词文本
 */
export const DEFAULT_SUMMARY_PROMPT = `Please explain this paper in as much detail as possible. I have a general background in this field but lack specific knowledge in this particular sub-area. Only include content about the paper itself — no pleasantries. Begin with a paragraph summarising the core content of the paper. If there are formulae, use $inline formula$ and $$block formula$$ format.`;

/**
 * 系统角色提示词
 *
 * 在与大模型的对话中,系统角色定义了 AI 助手的基本身份和行为准则
 *
 * 作用:
 * - 设定 AI 的总体定位和态度
 * - 影响 AI 的回复风格和专业度
 * - 提供稳定的行为基线
 *
 * 当前设定:
 * - 定位为学术助理,强调专业性和辅助性
 * - 保持简洁,避免过度约束 AI 的创造力
 *
 * @const {string} SYSTEM_ROLE_PROMPT 系统角色定义
 */
export const SYSTEM_ROLE_PROMPT = "You are a helpful academic assistant.";

/**
 * 构建完整的用户消息
 *
 * 将用户自定义的提示词和论文全文组合成完整的 API 请求消息
 *
 * 消息结构:
 * 1. 用户提示词:定义任务和输出要求
 * 2. 语言要求:明确使用中文回答(可配置)
 * 3. 论文全文:包裹在 XML 标签中,清晰标识内容边界
 *
 * 技术细节:
 * - 使用 <Paper> XML 标签包裹论文内容
 * - XML 标签帮助 AI 识别论文正文的起止位置
 * - 避免论文内容干扰提示词指令的解析
 *
 * @param prompt 用户自定义的提示词模板
 * @param text 论文全文内容
 * @returns 格式化后的完整消息文本
 *
 * @example
 * ```typescript
 * const message = buildUserMessage(
 *   getDefaultSummaryPrompt(),
 *   paperFullText
 * );
 * // 输出:
 * // "帮我用中文讲一下这篇论文...\n\n<Paper>\n论文内容...\n</Paper>"
 * ```
 */
export function buildUserMessage(prompt: string, text: string): string {
  return `${prompt}\n\nPlease respond in English.\n\n<Paper>\n${text}\n</Paper>`;
}

/**
 * 获取默认的总结提示词
 *
 * 简单的封装函数,返回默认提示词常量
 *
 * 设计目的:
 * - 提供统一的访问接口
 * - 便于未来扩展(如动态提示词选择)
 * - 提高代码可读性
 *
 * @returns 默认提示词文本
 *
 * @example
 * ```typescript
 * const prompt = getDefaultSummaryPrompt();
 * setPref("summaryPrompt", prompt);
 * ```
 */
export function getDefaultSummaryPrompt(): string {
  return DEFAULT_SUMMARY_PROMPT;
}

/**
 * 检查是否需要更新用户的提示词
 *
 * 判断逻辑:
 * 1. 如果用户没有提示词版本号记录,需要更新(首次使用或旧版本插件)
 * 2. 如果用户的版本号低于当前版本,需要更新(版本过时)
 *
 * 更新策略:
 * - 自动更新:仅当用户使用默认提示词且未自定义时
 * - 保留自定义:如果用户修改过提示词,不会被自动覆盖
 *
 * 使用场景:
 * - 插件启动时的配置初始化
 * - 检测并执行提示词版本升级
 *
 * @param currentPromptVersion 用户当前的提示词版本号
 * @param currentPrompt 用户当前的提示词内容(可选,用于高级判断)
 * @returns 如果需要更新返回 true,否则返回 false
 *
 * @example
 * ```typescript
 * const version = getPref("promptVersion");
 * const prompt = getPref("summaryPrompt");
 *
 * if (shouldUpdatePrompt(version, prompt)) {
 *   setPref("summaryPrompt", getDefaultSummaryPrompt());
 *   setPref("promptVersion", PROMPT_VERSION);
 * }
 * ```
 */
export function shouldUpdatePrompt(
  currentPromptVersion?: number,
  currentPrompt?: string,
): boolean {
  // 情况1:没有版本号记录,强制更新为默认提示词
  // 这通常发生在首次安装或从旧版本升级时
  if (currentPromptVersion === undefined) {
    return true;
  }

  // 情况2:版本号低于当前版本,需要升级
  // 注意:仅在用户未自定义提示词时才会执行更新
  // 自定义判断由调用方负责(通过比较 currentPrompt 与旧版本默认值)
  return currentPromptVersion < PROMPT_VERSION;
}

// ================================================================
// 多轮对话提示词相关功能
// ================================================================

/**
 * 多轮提示词条目类型
 */
export interface MultiRoundPromptItem {
  id: string;
  title: string;
  prompt: string;
  order: number;
}

/**
 * 总结模式类型
 * - single: 单次对话总结（默认，Token消耗最少）
 * - multi_concat: 多轮拼接模式（将所有对话内容拼接作为笔记）
 * - multi_summarize: 多轮总结模式（多轮对话后再进行汇总）
 */
export type SummaryMode = "single" | "multi_concat" | "multi_summarize";

/**
 * 默认的多轮提示词数组
 *
 * 包含四轮提示词，分别针对：
 * 1. 研究背景与问题
 * 2. 研究方法与技术
 * 3. 实验设计与结果
 * 4. 结论与展望
 */
export const DEFAULT_MULTI_ROUND_PROMPTS: MultiRoundPromptItem[] = [
  {
    id: "round1",
    title: "Research Background and Problem",
    prompt:
      "Please describe the research background and motivation of this paper in detail. Specifically: 1) What are the main challenges currently facing this research field? 2) What are the shortcomings of existing methods? 3) What is the core problem this paper aims to solve? Please respond in English.",
    order: 1,
  },
  {
    id: "round2",
    title: "Research Methods and Techniques",
    prompt:
      "Please explain the methods and techniques proposed in this paper in detail. Specifically: 1) What is the core method/algorithm/framework? 2) What are the key technical details and innovations? 3) What improvements does it offer compared to existing methods? Please respond in English.",
    order: 2,
  },
  {
    id: "round3",
    title: "Experimental Design and Results",
    prompt:
      "Please analyse the experimental section of this paper in detail. Specifically: 1) What datasets and evaluation metrics were used? 2) What are the main experimental results? 3) How does it perform compared to baseline methods? 4) What ablation studies and analyses were conducted? Please respond in English.",
    order: 3,
  },
  {
    id: "round4",
    title: "Conclusions and Future Directions",
    prompt:
      "Please summarise the conclusions and contributions of this paper. Specifically: 1) What are the main contributions and innovations of the paper? 2) What limitations exist? 3) What are the possible future research directions? Please respond in English.",
    order: 4,
  },
];

/**
 * 默认的多轮对话最终总结提示词
 */
export const DEFAULT_MULTI_ROUND_FINAL_PROMPT = `Based on the content of the multi-round dialogue above, please generate a complete, structured summary note for this paper. Requirements:
1. Begin with a paragraph summarising the core content of the paper
2. Organise key information from each section into chapters
3. Highlight the paper's innovations and contributions
4. Identify the paper's limitations and future directions
5. Use clear and concise language in English`;

/**
 * 获取默认的多轮提示词数组
 *
 * @returns 默认多轮提示词数组
 */
export function getDefaultMultiRoundPrompts(): MultiRoundPromptItem[] {
  return DEFAULT_MULTI_ROUND_PROMPTS;
}

/**
 * 获取默认的多轮对话最终总结提示词
 *
 * @returns 默认最终总结提示词
 */
export function getDefaultMultiRoundFinalPrompt(): string {
  return DEFAULT_MULTI_ROUND_FINAL_PROMPT;
}

/**
 * 解析存储的多轮提示词 JSON 字符串
 *
 * @param jsonStr 存储的 JSON 字符串
 * @returns 解析后的多轮提示词数组，解析失败则返回默认值
 */
export function parseMultiRoundPrompts(
  jsonStr: string | undefined,
): MultiRoundPromptItem[] {
  if (!jsonStr || !jsonStr.trim()) {
    return getDefaultMultiRoundPrompts();
  }
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // 按 order 排序
      return parsed.sort(
        (a: MultiRoundPromptItem, b: MultiRoundPromptItem) => a.order - b.order,
      );
    }
    return getDefaultMultiRoundPrompts();
  } catch (e) {
    return getDefaultMultiRoundPrompts();
  }
}

// ================================================================
// 一图总结提示词相关功能
// ================================================================

/**
 * 默认的视觉信息提取提示词
 *
 * 用于从论文中提取适合生成学术概念海报的关键视觉信息
 */
export const DEFAULT_IMAGE_SUMMARY_PROMPT = `Please read the paper content I have provided and extract key visual information for generating an "academic concept poster".

Please ensure descriptions are specific and vivid, suitable for visual presentation.
Please output the following content (only output the content, no filler), using \${language}:
1. Research Problem: the core problem addressed
2. Innovative Method: the main method or technique proposed in the paper — find the "Aha!" moment.
3. Workflow: the processing flow from input to output
4. Key Results: main experimental findings or performance improvements
5. Application Value: the practical significance of this research
---
Paper content follows:
\${context}`;

/**
 * 默认的生图提示词
 *
 * 用于根据视觉摘要生成学术概念海报图片
 */
export const DEFAULT_IMAGE_GENERATION_PROMPT = `Based on "\${summaryForImage}", generate an academic paper concept diagram that clearly presents the following:

Research Problem: the core problem addressed
Innovative Method: the main method or technique proposed in the paper
Workflow: the processing flow from input to output
Key Results: main experimental findings or performance improvements
Application Value: the practical significance of this research
Paper Title: \${title}
Requirements:
**Design Guidelines (STRICTLY FOLLOW):**
1.  **Style:**
    *   Modern Minimalist Tech Infographic.
    *   Flat vector illustration with subtle isometric elements.
    *   High-quality corporate Memphis design style.
    *   Clean lines, geometric shapes.
2.  **Composition:**
    *   **Layout:** Central composition or Left-to-Right Process Flow.
    *   **Background:** Clean, solid off-white or very light grey background (#F5F5F7). No clutter.
    *   **Structure:** Organize elements logically like a presentation slide or an academic poster.
3.  **Colour Palette:**
    *   Primary: Deep Academic Blue & Slate Grey.
    *   Accent: Vibrant Orange or Teal for highlights.
    *   High contrast, professional colour grading.
4.  **Text Rendering:**
    *   Use Times New Roman font for English.
    *   Main text language: \${language} (User defined language).
    *   The title does not need to be reflected in the figure.
    *   The text needs to be clear and free of garbled characters.
5.  **Negative Prompt (Avoid these):**
    *   No photorealism.
    *   No messy sketches.
    *   No blurry text.
    *   No chaotic background.
**Generation Instructions:**
Generate an academic infographic poster.`;

/**
 * 获取默认的视觉信息提取提示词
 *
 * @returns 默认视觉提取提示词
 */
export function getDefaultImageSummaryPrompt(): string {
  return DEFAULT_IMAGE_SUMMARY_PROMPT;
}

/**
 * 获取默认的生图提示词
 *
 * @returns 默认生图提示词
 */
export function getDefaultImageGenerationPrompt(): string {
  return DEFAULT_IMAGE_GENERATION_PROMPT;
}

// ================================================================
// 文献综述提示词相关功能
// ================================================================

/**
 * 默认的文献综述提示词
 *
 * 用于综合多篇论文生成文献综述报告
 */
export const DEFAULT_LITERATURE_REVIEW_PROMPT = `Please read the following academic papers and generate a comprehensive literature review report, including:

1. **Research Topic Overview**: Briefly describe the research field and core questions these papers collectively address
2. **Main Contributions of Each Paper**: Summarise the core viewpoints, methods, and findings of each paper individually
3. **Research Method Comparison**: Analyse the similarities and differences in research methods across the papers
4. **Summary of Main Findings**: Synthesise the main conclusions and findings from all papers
5. **Research Trends and Future Directions**: Based on these papers, analyse the development trends and future research directions in this field

Please use clear structure and academic language to ensure the review is accurate and logically coherent. Output in English.`;

/**
 * 获取默认的文献综述提示词
 *
 * @returns 默认文献综述提示词
 */
export function getDefaultLiteratureReviewPrompt(): string {
  return DEFAULT_LITERATURE_REVIEW_PROMPT;
}

// ================================================================
// 文献综述表格填写相关功能
// ================================================================

/**
 * 默认的文献综述表格模板（Markdown 格式）
 *
 * 用户可在设置界面自定义此模板
 * LLM 会按此模板结构为每篇论文填写信息
 */
export const DEFAULT_TABLE_TEMPLATE = `| Dimension | Content |
|------|------|
| Paper Title | |
| Authors | |
| Year of Publication | |
| Research Problem | |
| Research Method | |
| Main Findings | |
| Innovations | |
| Limitations | |
| Relevance to This Study | |`;

/**
 * 默认的逐篇填表提示词
 *
 * 指导 LLM 阅读单篇论文并按表格模板填写结构化信息
 */
export const DEFAULT_TABLE_FILL_PROMPT = `Please carefully read the content of the following academic paper and fill in the information for each dimension according to the given table template.

Requirements:
1. Strictly follow the table template format for output, maintaining Markdown table syntax
2. Every dimension must be filled in; if the paper does not contain relevant information, write "Not mentioned"
3. Content should be concise and precise, with each dimension limited to 1-3 sentences
4. Write in English
5. Only output the completed table, do not add extra explanations

Table template:
\${tableTemplate}`;

/**
 * 默认的汇总综述提示词
 *
 * 基于多篇论文的填表结果生成综合文献综述
 */
export const DEFAULT_TABLE_REVIEW_PROMPT = `Please read the following academic papers and generate a comprehensive literature review report, including:

1. **Research Topic Overview**: Briefly describe the research field and core questions these papers collectively address
2. **Main Contributions of Each Paper**: Summarise the core viewpoints, methods, and findings of each paper individually
3. **Research Method Comparison**: Analyse the similarities and differences in research methods across the papers
4. **Summary of Main Findings**: Synthesise the main conclusions and findings from all papers
5. **Research Trends and Future Directions**: Based on these papers, analyse the development trends and future research directions in this field

For all cited content or conclusions, use [num] format for citations (e.g. [1], [2]), where num corresponds to each reference's number. When there are multiple citation sources, use [1][2][3] format. There is no need to provide a complete reference list at the end. Please use clear structure and academic language to ensure the review is accurate and logically coherent. Output in English.`;

/**
 * 获取默认的表格模板
 *
 * @returns 默认 Markdown 表格模板
 */
export function getDefaultTableTemplate(): string {
  return DEFAULT_TABLE_TEMPLATE;
}

/**
 * 获取默认的逐篇填表提示词
 *
 * @returns 默认填表提示词
 */
export function getDefaultTableFillPrompt(): string {
  return DEFAULT_TABLE_FILL_PROMPT;
}

/**
 * 获取默认的汇总综述提示词
 *
 * @returns 默认汇总综述提示词
 */
export function getDefaultTableReviewPrompt(): string {
  return DEFAULT_TABLE_REVIEW_PROMPT;
}

// ================================================================
// 思维导图提示词相关功能
// ================================================================

/**
 * 默认的思维导图生成提示词
 *
 * 用于从论文中生成结构化 Markdown 列表，供 Markmap 渲染为思维导图
 *
 * 设计要点：
 * - 使用 One-Shot 提示让 LLM 模仿固定格式
 * - 根节点为论文标题
 * - 一级分支固定为四个核心章节
 * - 子节点层级控制在 3-4 层以内
 */
export const DEFAULT_MINDMAP_PROMPT = `# Role
You are a professional academic paper analysis assistant. Your task is to transform paper content into structured mind map data.

# Output Format Rules (must be strictly followed)
1. The output format must be **Markdown headings and unordered lists**.
2. **Root node (\`#\`)**: Must be the paper's title.
3. **First-level branches (\`##\`)**: Must strictly contain only the following four sections:
   - Research Background and Objectives
   - Research Methods
   - Key Research Results
   - Research Conclusions and Significance
4. **Sub-nodes (\`-\`)**: Subdivide according to the paper's content, keeping the hierarchy within 3-4 levels and remaining concise.
5. Do not output any Markdown code block markers (such as \`\`\`markdown), just output the content directly.
6. Language: Output in **English**.

# One-Shot Example
## Input Text:
[An abstract of a paper on Deep Residual Learning (ResNet)...]

## Expected Output:
# Deep Residual Learning for Image Recognition

## Research Background and Objectives
- Vanishing/Exploding Gradients
  - Hindered convergence of deep neural networks
- Degradation Problem
  - Increasing network depth led to accuracy saturation or even decline
- Core Objective
  - Train extremely deep networks (100+ layers)
  - Solve the degradation problem

## Research Methods
- Residual Learning Framework
  - Introduced Identity Mapping
  - Fitting the residual function F(x) = H(x) - x
- Network Architecture
  - Using 3x3 convolution kernels
  - Introduced Global Average Pooling layer
- Training Strategy
  - Batch Normalisation

## Key Research Results
- ImageNet Competition Winner
  - Top-5 error rate reduced to 3.57%
- Depth Advantage Verified
  - 152-layer network significantly outperformed VGG-16
- Optimisation Difficulty
  - ResNet is easier to optimise than plain networks

## Research Conclusions and Significance
- Core Contribution
  - Confirmed the effectiveness of residual structures in deep networks
- Broad Impact
  - Became the standard backbone network in computer vision
- Limitations
  - Training time cost for extremely deep networks is relatively high

---
# Current Task
Please read the following paper content and generate mind map data according to the format above:`;

/**
 * 获取默认的思维导图提示词
 *
 * @returns 默认思维导图提示词
 */
export function getDefaultMindmapPrompt(): string {
  return DEFAULT_MINDMAP_PROMPT;
}
