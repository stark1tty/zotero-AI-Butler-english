# Translation TODO List

**Project:** Zotero AI Butler - Chinese to English Conversion

**Last Updated:** 2026-04-06

---

## Summary

**UPDATED:** There are hardcoded Chinese strings throughout the TypeScript source files that need translation.

**Total:**

- ✅ ~160 locale file strings (COMPLETED)
- ⏳ ~1035 hardcoded strings in TypeScript source files (IN PROGRESS)

---

## Priority Files with Hardcoded Chinese (Top 20)

| File                                                     | Chinese Strings | Priority | Status     |
| -------------------------------------------------------- | --------------- | -------- | ---------- |
| `src/modules/views/settings/ApiSettingsPage.ts`          | 100             | HIGH     | ⏳ Pending |
| `src/modules/views/settings/UiSettingsPage.ts`           | 27              | HIGH     | ⏳ Pending |
| `src/modules/views/settings/PromptsSettingsPage.ts`      | 124             | HIGH     | ⏳ Pending |
| `src/modules/views/settings/ImageSummarySettingsPage.ts` | 68              | HIGH     | ⏳ Pending |
| `src/modules/views/settings/MindmapSettingsPage.ts`      | 35              | HIGH     | ⏳ Pending |
| `src/modules/views/settings/DataSettingsPage.ts`         | 35              | HIGH     | ⏳ Pending |
| `src/modules/views/SettingsView.ts`                      | 10              | HIGH     | ⏳ Pending |
| `src/modules/ItemPaneSection.ts`                         | 130             | HIGH     | ⏳ Pending |
| `src/modules/views/SummaryView.ts`                       | 72              | MEDIUM   | ⏳ Pending |
| `src/modules/views/LiteratureReviewView.ts`              | 26              | MEDIUM   | ⏳ Pending |
| `src/modules/views/LibraryScannerView.ts`                | 10              | MEDIUM   | ⏳ Pending |
| `src/modules/literatureReviewService.ts`                 | 53              | MEDIUM   | ⏳ Pending |
| `src/modules/noteGenerator.ts`                           | 34              | MEDIUM   | ⏳ Pending |
| `src/modules/imageNoteGenerator.ts`                      | 25              | MEDIUM   | ⏳ Pending |
| `src/modules/mindmapService.ts`                          | 21              | MEDIUM   | ⏳ Pending |
| `src/modules/imageClient.ts`                             | 39              | MEDIUM   | ⏳ Pending |
| `src/modules/llmproviders/OpenAIProvider.ts`             | 39              | LOW      | ⏳ Pending |
| `src/modules/llmproviders/GeminiProvider.ts`             | 33              | LOW      | ⏳ Pending |
| `src/modules/llmproviders/VolcanoArkProvider.ts`         | 26              | LOW      | ⏳ Pending |
| `src/modules/llmproviders/AnthropicProvider.ts`          | 26              | LOW      | ⏳ Pending |

---

## Files to Translate

### ✅ COMPLETED: Locale Files

### 📁 addon/locale/zh-CN/addon.ftl (18 strings)

| Key                                    | Chinese Text                 | Status     |
| -------------------------------------- | ---------------------------- | ---------- |
| `startup-begin`                        | 插件 Zotero-AI-Butler 加载中 | ⏳ Pending |
| `startup-finish`                       | 插件 Zotero-AI-Butler 已就绪 | ⏳ Pending |
| `menupopup-label`                      | Zotero-AI-Butler: 弹出菜单   | ⏳ Pending |
| `menuitem-submenulabel`                | Zotero-AI-Butler：子菜单     | ⏳ Pending |
| `menuitem-filemenulabel`               | Zotero-AI-Butler: 文件菜单   | ⏳ Pending |
| `prefs-table-title`                    | 标题                         | ⏳ Pending |
| `prefs-table-detail`                   | 详情                         | ⏳ Pending |
| `tabpanel-lib-tab-label`               | 库标签                       | ⏳ Pending |
| `tabpanel-reader-tab-label`            | 阅读器标签                   | ⏳ Pending |
| `reader-toolbar-ai-chat`               | 🤖 AI 追问                   | ⏳ Pending |
| `aibutler-itempane-ai-section-header`  | AI 管家                      | ⏳ Pending |
| `aibutler-itempane-ai-section-sidenav` | AI 管家                      | ⏳ Pending |
| `itempane-ai-open-chat`                | 📝 完整追问 (保存记录)       | ⏳ Pending |
| `itempane-ai-temp-chat`                | 💬 快速提问 (不保存记录)     | ⏳ Pending |
| `itempane-ai-no-item`                  | 请选择一篇文献               | ⏳ Pending |
| `library-toolbar-ai-butler`            | AI 管家                      | ⏳ Pending |

### 📁 addon/locale/zh-CN/preferences.ftl (17 strings)

| Key                                         | Chinese Text                                                           | Status     |
| ------------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| `ai-butler-prefs-heading`                   | AI 管家参数配置                                                        | ⏳ Pending |
| `ai-butler-prefs-description`               | 配置 AI管家 大模型参数。                                               | ⏳ Pending |
| `ai-butler-prefs-apiKey`                    | API 密钥                                                               | ⏳ Pending |
| `ai-butler-prefs-apiKey-description`        | 请在此输入大模型密钥。                                                 | ⏳ Pending |
| `ai-butler-prefs-apiUrl`                    | API 接口地址                                                           | ⏳ Pending |
| `ai-butler-prefs-apiUrl-description`        | 请在此输入大模型接口地址。                                             | ⏳ Pending |
| `ai-butler-prefs-model`                     | 大模型选择                                                             | ⏳ Pending |
| `ai-butler-prefs-model-description`         | 指定管家使用的大模型，例如 gpt-4-turbo 或 gemini-2.5-pro。             | ⏳ Pending |
| `ai-butler-prefs-temperature`               | 大模型温度                                                             | ⏳ Pending |
| `ai-butler-prefs-temperature-description`   | 控制大模型温度。值越高（如 1.2）则越有创意，值越低（如 0.3）则越严谨。 | ⏳ Pending |
| `ai-butler-prefs-stream`                    | 流式输出模式                                                           | ⏳ Pending |
| `ai-butler-prefs-stream-hint`               | 开启后，管家会像打字一样逐步输出结果；关闭则一次性呈现。               | ⏳ Pending |
| `ai-butler-prefs-summaryPrompt`             | 管家指令模板                                                           | ⏳ Pending |
| `ai-butler-prefs-summaryPrompt-description` | 您可以定制管家的工作指令，以满足您独特的阅读需求。                     | ⏳ Pending |
| `ai-butler-prefs-resetPrompt`               | 恢复默认指令                                                           | ⏳ Pending |
| `ai-butler-prefs-apiUrl-example`            | 接口示例（OpenAI 兼容）：https://api.openai.com/v1/chat/completions    | ⏳ Pending |

### 📁 addon/locale/zh-CN/mainWindow.ftl (~125 strings)

#### Menu Items

- `menuitem-generateSummary` - 召唤AI管家进行分析
- `menuitem-chatWithAI` - AI管家-后续追问
- `menuitem-multiRoundReanalyze` - AI管家多轮对话重新精读
- `menuitem-multiRoundConcat` - 多轮拼接
- `menuitem-multiRoundSummary` - 多轮总结
- `menuitem-imageSummary` - 召唤AI管家一图总结
- `menuitem-mindmap` - AI管家生成思维导图
- `menuitem-literatureReview` - AI管家文献综述
- `menuitem-fillTable` - AI管家填表

#### Error/Success Messages

- `error-noItemsSelected` - 抱歉,您尚未选择需要分析的文献。
- `error-noApiKey` - 抱歉,尚未配置API密钥,我无法开始工作。
- `success-allComplete` - 所有任务已处理完毕！

#### Progress Messages

- `progress-extracting` - 正在提取文献内容...
- `progress-generating` - 管家正在分析中...
- `progress-creating` - 正在为您整理为笔记...
- `progress-complete` - 任务完成！
- `progress-right-click-instruction` - 右键点击文献条目,选择「AI 管家分析」开始生成总结

#### Chat UI Strings

- `chat-user-label` - 用户
- `chat-assistant-label` - AI管家
- `chat-saved-time` - 保存时间
- `chat-saved-time-quick` - 来自快速提问

#### Task Queue Strings

- `task-created-time` - 创建时间
- `task-completed-time` - 完成时间
- `task-error-label` - 错误
- `task-retry-count` - 重试次数
- `task-stage-label` - 阶段

#### Dashboard Strings (30+ items)

- Status messages
- Button labels
- Statistics
- Error messages
- Success notifications

#### Library Scanner Strings (8+ items)

- Scanner UI labels
- Selection counts
- Completion messages

#### Literature Review Strings (15+ items)

- Form labels
- Validation messages
- Status indicators

#### Summary View Strings (12+ items)

- Instructions
- Error messages
- Status updates

#### Miscellaneous

- Button labels
- Section headers
- Tooltips
- Stat card labels

---

## Translation Strategy

1. Copy English translations from `en-US/*.ftl` files
2. Replace Chinese content in `zh-CN/*.ftl` files
3. Maintain exact key names and formatting
4. Preserve emoji and special characters
5. Keep Fluent formatting syntax intact (e.g., `{ $count }` variables)

---

## Notes

- Internal code comments are NOT being translated (as per user request)
- Only user-facing strings in locale files need conversion
- en-US and en-GB versions are already complete and can be used as reference
