/**
 * @file 插件的默认首选项
 * @description 此文件定义了插件首次启动或重置时的默认配置。
 * 注意：默认提示词主要在 src/utils/prompts.ts 中进行管理。
 * 此文件中的 summaryPrompt 仅作为备用值，在实际初始化时会被覆盖。
 */

// ==================== API 配置 ====================
pref("__prefsPrefix__.provider", "openai");
pref("__prefsPrefix__.openaiApiKey", "");
pref("__prefsPrefix__.openaiApiUrl", "https://api.openai.com/v1/responses");
pref("__prefsPrefix__.openaiApiModel", "gpt-3.5-turbo");
pref("__prefsPrefix__.openaiCompatApiKey", "");
pref(
  "__prefsPrefix__.openaiCompatApiUrl",
  "https://api.openai.com/v1/chat/completions",
);
pref("__prefsPrefix__.openaiCompatModel", "gpt-3.5-turbo");
pref(
  "__prefsPrefix__.geminiApiUrl",
  "https://generativelanguage.googleapis.com",
);
pref("__prefsPrefix__.geminiApiKey", "");
pref("__prefsPrefix__.geminiModel", "gemini-2.5-pro");
pref("__prefsPrefix__.anthropicApiUrl", "https://api.anthropic.com");
pref("__prefsPrefix__.anthropicApiKey", "");
pref("__prefsPrefix__.anthropicModel", "claude-3-5-sonnet-20241022");
pref(
  "__prefsPrefix__.openRouterApiUrl",
  "https://openrouter.ai/api/v1/chat/completions",
);
pref("__prefsPrefix__.openRouterApiKey", "");
pref("__prefsPrefix__.openRouterModel", "google/gemma-3-27b-it");
pref(
  "__prefsPrefix__.volcanoArkApiUrl",
  "https://ark.cn-beijing.volces.com/api/v3/responses",
);
pref("__prefsPrefix__.volcanoArkApiKey", "");
pref("__prefsPrefix__.volcanoArkModel", "doubao-seed-1-8-251228");
pref("__prefsPrefix__.temperature", "0.7");
pref("__prefsPrefix__.enableTemperature", true);
pref("__prefsPrefix__.maxTokens", "8192");
pref("__prefsPrefix__.enableMaxTokens", true);
pref("__prefsPrefix__.topP", "1.0");
pref("__prefsPrefix__.enableTopP", true);
pref("__prefsPrefix__.stream", true);
pref("__prefsPrefix__.requestTimeout", "300000"); // 5分钟超时
// MINERU API KEY
pref("__prefsPrefix__.mineruApiKey", "");

// ==================== Prompt Configuration ====================
pref(
  "__prefsPrefix__.summaryPrompt",
  "# Role\nHello, I am your AI Butler. I will meticulously read this paper and organize comprehensive notes for you.\n\n# Task\nPlease analyze the academic paper provided below and generate a comprehensive summary containing the following three sections:\n\n### Section 1: Core Summary\nProvide a one-paragraph overview of the paper's core content, including the research question, methods, key findings, and main conclusions, allowing me to quickly grasp the essence of the paper.\n\n### Section 2: Section Analysis\nIdentify and divide the paper's main sections (such as Introduction, Methods, Results, Discussion, etc.), and provide a clear title and detailed content summary for each section.\n\n### Section 3: Innovation and Limitations\nBased on the paper's content, analyze and summarize its main innovations and existing limitations, and point out possible future research directions.\n\n# Output Requirements\n- Clear structure and rigorous logic\n- Concise language that accurately conveys information\n- Please respond in English.",
);
pref("__prefsPrefix__.customPrompts", "[]");
// Multi-round summary mode: "single"(single conversation) | "multi_concat"(multi-round concatenation) | "multi_summarize"(multi-round with final summary)
pref("__prefsPrefix__.summaryMode", "single");
// Multi-round prompts (JSON array): each element contains id, title, prompt, order
pref(
  "__prefsPrefix__.multiRoundPrompts",
  '[{"id":"round1","title":"Background and Research Question","prompt":"Please introduce the research background and motivation of this paper in detail. Specifically: 1) What are the main challenges currently facing this research field? 2) What are the shortcomings of existing methods? 3) What is the core problem this paper aims to solve? Please answer in English.","order":1},{"id":"round2","title":"Methods and Techniques","prompt":"Please explain the methods and techniques proposed in this paper in detail. Specifically: 1) What is the core method/algorithm/framework? 2) What are the key technical details and innovations? 3) What improvements does it make compared to existing methods? Please answer in English.","order":2},{"id":"round3","title":"Experimental Design and Results","prompt":"Please analyze the experimental section of this paper in detail. Specifically: 1) What datasets and evaluation metrics were used? 2) What are the main experimental results? 3) How does it perform compared to baseline methods? 4) What ablation studies and analyses were conducted? Please answer in English.","order":3},{"id":"round4","title":"Conclusions and Future Work","prompt":"Please summarize the conclusions and contributions of this paper. Specifically: 1) What are the main contributions and innovations? 2) What limitations exist? 3) What are possible future research directions? Please answer in English.","order":4}]',
);
// Final summary prompt after multi-round conversation
pref(
  "__prefsPrefix__.multiRoundFinalPrompt",
  "Based on the multi-round conversation above, please generate a complete, structured paper summary note. Requirements:\\n1. Begin with a paragraph summarizing the core content\\n2. Organize key information from each section\\n3. Highlight the paper's innovations and contributions\\n4. Point out the paper's limitations and future directions\\n5. Use clear and concise language in English",
);
// 多轮总结模式下是否保存中间对话内容到笔记（仅对 multi_summarize 生效）
pref("__prefsPrefix__.multiSummarySaveIntermediate", false);

// ==================== 任务队列配置 ====================
pref("__prefsPrefix__.maxRetries", "3");
pref("__prefsPrefix__.batchSize", "1");
pref("__prefsPrefix__.batchInterval", "60");
pref("__prefsPrefix__.autoScan", false);
pref("__prefsPrefix__.scanInterval", "300");
pref("__prefsPrefix__.pdfProcessMode", "base64"); // "text" 或 "base64"

// ==================== 一图总结配置 ====================
pref("__prefsPrefix__.imageSummaryAspectRatio", "16:9"); // 图片宽高比，如 "1:1", "16:9", "9:16"
pref("__prefsPrefix__.imageSummaryResolution", "1K"); // 图片分辨率: "1K", "2K", "4K"

// ==================== UI 配置 ====================
pref("__prefsPrefix__.theme", "auto");
pref("__prefsPrefix__.fontSize", "14");
pref("__prefsPrefix__.autoScroll", true);
pref("__prefsPrefix__.windowWidth", "900");
pref("__prefsPrefix__.windowHeight", "700");
pref("__prefsPrefix__.saveChatHistory", true);
pref("__prefsPrefix__.sidebarNoteCollapsed", false);
pref("__prefsPrefix__.sidebarImageCollapsed", false);

// ==================== 数据管理 ====================
pref("__prefsPrefix__.notePrefix", "[AI-Butler]");
pref("__prefsPrefix__.noteStrategy", "skip");

// ==================== 思维导图配置 ====================
pref("__prefsPrefix__.mindmapPrompt", ""); // 空表示使用默认提示词
pref("__prefsPrefix__.mindmapExportPath", ""); // 空表示使用桌面目录
