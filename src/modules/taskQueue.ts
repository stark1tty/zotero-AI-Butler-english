/**
 * ================================================================
 * 任务队列管理器
 * ================================================================
 *
 * 本模块提供文献处理任务的队列管理功能
 *
 * 主要职责:
 * 1. 任务入队/出队管理
 * 2. 任务状态跟踪 (待处理/处理中/Completed/失败)
 * 3. 优先级调度
 * 4. 并发控制
 * 5. 失败重试机制
 * 6. 持久化存储
 * 7. 任务进度回调
 *
 * 任务执行流程:
 * 1. 用户添加任务到队列
 * 2. 任务按优先级和创建时间排序
 * 3. 后台执行器按并发数限制处理任务
 * 4. 任务完成/失败后Update状态
 * 5. 失败任务可重试或移除
 *
 * @module taskQueue
 * @author AI-Butler Team
 */

import { getPref, setPref } from "../utils/prefs";
import { NoteGenerator } from "./noteGenerator";
import { PDFExtractor } from "./pdfExtractor";

/** 无 PDF 附件错误标识 */
const NO_PDF_ERROR_MSG =
  "This item has no PDF attachment and cannot be analyzed by AI. Please add a PDF file to this literature first.";

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = "pending", // 待处理
  PROCESSING = "processing", // 处理中
  COMPLETED = "completed", // Completed
  FAILED = "failed", // 失败
  PRIORITY = "priority", // 优先处理
}

/**
 * 任务类型枚举
 */
export type TaskType =
  | "summary"
  | "imageSummary"
  | "mindmap"
  | "tableFill"
  | "review"
  | "targetedQuestion";

/**
 * 任务项接口
 */
export interface TaskItem {
  id: string; // 任务唯一ID (使用 Zotero Item ID)
  itemId: number; // Zotero 文献条目 ID
  title: string; // 文献标题
  status: TaskStatus; // 当前状态
  progress: number; // 进度百分比 (0-100)
  createdAt: Date; // 创建时间
  startedAt?: Date; // 开始处理时间
  completedAt?: Date; // 完成时间
  error?: string; // 错误信息
  retryCount: number; // 已重试次数
  maxRetries: number; // 最大重试次数
  duration?: number; // 处理耗时(秒)
  /** 任务类型: summary(默认) 或 imageSummary(一图总结) 或 mindmap(思维导图) */
  taskType?: TaskType;
  /** 工作流阶段 (一图总结专用) */
  workflowStage?: string;
  options?: {
    summaryMode?: string;
    forceOverwrite?: boolean;
  };
  /** 综述任务参数 */
  collectionId?: number;
  pdfAttachmentIds?: number[];
  reviewName?: string;
  tableTemplate?: string;
  /** 针对性提问任务参数 */
  targetedPrompt?: string;
  targetedNoteTitle?: string;
  targetedSelectedTableEntries?: string[];
  targetedAppendedTableEntries?: string[];
}

/**
 * 任务队列统计信息
 */
export interface QueueStats {
  total: number; // 总任务数
  pending: number; // 待处理数
  priority: number; // 优先处理数
  processing: number; // 处理中数
  completed: number; // Completed数
  failed: number; // 失败数
  successRate: number; // 成功率(%)
}

/**
 * 任务进度回调类型
 */
export type TaskProgressCallback = (
  taskId: string,
  progress: number,
  message: string,
) => void;

/**
 * 任务完成回调类型
 */
export type TaskCompleteCallback = (
  taskId: string,
  success: boolean,
  error?: string,
) => void;

/**
 * 任务流式事件回调类型
 */
export type TaskStreamCallback = (
  taskId: string,
  event: {
    type: "start" | "chunk" | "finish" | "error";
    chunk?: string;
    title?: string;
  },
) => void;

/**
 * 任务队列管理器类
 */
export class TaskQueueManager {
  /** 单例实例 */
  private static instance: TaskQueueManager | null = null;

  /** 任务队列 */
  private tasks: Map<string, TaskItem> = new Map();

  /** 当前Processing的任务ID集合 */
  private processingTasks: Set<string> = new Set();

  /** 任务进度回调函数集合 */
  private progressCallbacks: Set<TaskProgressCallback> = new Set();

  /** 任务完成回调函数集合 */
  private completeCallbacks: Set<TaskCompleteCallback> = new Set();

  /** 任务流式事件回调函数集合 */
  private streamCallbacks: Set<TaskStreamCallback> = new Set();

  /** 队列执行器定时器ID */
  private executorTimerId: number | null = null;

  /** 最近一次加载到的持久化快照时间 */
  private lastLoadedSnapshotAt: string | null = null;

  /** 最大并发数 */
  private maxConcurrency: number = 1;

  /** 每批次处理的任务数量 */
  private batchSize: number = 1;

  /** 当前是否正在执行批次 */
  private isBatchRunning: boolean = false;

  /** 执行间隔(毫秒) */
  private executionInterval: number = 60000; // 默认60秒

  /** 是否正在运行 */
  private isRunning: boolean = false;

  /**
   * 私有构造函数(单例模式)
   */
  private constructor() {
    this.loadFromStorage(true);
    this.loadSettings();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): TaskQueueManager {
    if (!TaskQueueManager.instance) {
      TaskQueueManager.instance = new TaskQueueManager();
    }
    return TaskQueueManager.instance;
  }

  // ==================== 任务管理 ====================

  /**
   * 添加单个任务到队列
   *
   * @param item Zotero 文献条目
   * @param priority 是否优先处理
   * @returns 任务ID
   */
  public async addTask(
    item: Zotero.Item,
    priority: boolean = false,
    options?: { summaryMode?: string; forceOverwrite?: boolean },
  ): Promise<string> {
    const taskId = `task-${item.id}`;

    // 检查是否Already exists
    if (this.tasks.has(taskId)) {
      const existingTask = this.tasks.get(taskId)!;
      // 如果强制覆盖，或者任务Already exists且需要强制Update
      if (options?.forceOverwrite) {
        ztoolkit.log(`Force updating existing task: ${taskId}`);
        existingTask.status = priority
          ? TaskStatus.PRIORITY
          : TaskStatus.PENDING;
        existingTask.options = options;
        existingTask.progress = 0;
        existingTask.error = undefined;
        existingTask.retryCount = 0;
        existingTask.createdAt = new Date(); // Update创建时间以调整顺序
        await this.saveToStorage();

        if (!this.isRunning) {
          this.start();
        }
        if (priority) {
          this.executeTask(taskId).catch((e) => {
            ztoolkit.log(`Priority task immediate execution failed: ${e}`);
          });
        }
        return taskId;
      }

      ztoolkit.log(`Task already exists: ${taskId}`);
      return taskId;
    }

    // 创建任务项
    const task: TaskItem = {
      id: taskId,
      itemId: item.id,
      title: item.getField("title") as string,
      status: priority ? TaskStatus.PRIORITY : TaskStatus.PENDING,
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: parseInt(getPref("maxRetries") as string) || 3,
      options,
    };

    this.tasks.set(taskId, task);
    await this.saveToStorage();

    ztoolkit.log(`Adding task: ${task.title} (${taskId})`);

    // 如果执行器未运行,启动它
    if (!this.isRunning) {
      this.start();
    }

    // 如果是优先任务，立即执行（不等待批处理周期）
    if (priority) {
      this.executeTask(taskId).catch((e) => {
        ztoolkit.log(`Priority task immediate execution failed: ${e}`);
      });
    }

    return taskId;
  }

  /**
   * 批量添加任务
   *
   * @param items Zotero 文献条目数组
   * @param priority 是否优先处理
   * @returns 任务ID数组
   */
  public async addTasks(
    items: Zotero.Item[],
    priority: boolean = false,
  ): Promise<string[]> {
    const taskIds: string[] = [];

    for (const item of items) {
      const taskId = await this.addTask(item, priority);
      taskIds.push(taskId);
    }

    return taskIds;
  }

  /**
   * 添加一图总结任务
   *
   * @param item Zotero 文献条目
   * @returns 任务ID
   */
  public async addImageSummaryTask(item: Zotero.Item): Promise<string> {
    const taskId = `img-task-${item.id}`;

    // 检查是否Already exists
    if (this.tasks.has(taskId)) {
      ztoolkit.log(`Image summary task already exists: ${taskId}`);
      return taskId;
    }

    // 创建任务项
    const task: TaskItem = {
      id: taskId,
      itemId: item.id,
      title: item.getField("title") as string,
      status: TaskStatus.PRIORITY, // 一图总结默认优先处理
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 1, // 一图总结只重试1次
      taskType: "imageSummary",
      workflowStage: "Waiting to start",
    };

    this.tasks.set(taskId, task);
    await this.saveToStorage();

    ztoolkit.log(`Adding image summary task: ${task.title} (${taskId})`);

    // 立即执行一图总结任务
    this.executeImageSummaryTask(taskId).catch((e) => {
      ztoolkit.log(`Image summary task execution failed: ${e}`);
    });

    return taskId;
  }

  /**
   * 执行一图总结任务
   *
   * @param taskId 任务ID
   */
  private async executeImageSummaryTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.taskType !== "imageSummary") {
      return;
    }

    // 防止重复执行
    if (
      task.status === TaskStatus.PROCESSING ||
      task.status === TaskStatus.COMPLETED
    ) {
      return;
    }

    // Update任务状态
    task.status = TaskStatus.PROCESSING;
    task.startedAt = new Date();
    task.progress = 0;
    task.workflowStage = "Initializing";
    this.processingTasks.add(taskId);
    await this.saveToStorage();

    ztoolkit.log(`Starting image summary task: ${task.title}`);

    try {
      // 获取 Zotero Item
      const item = await Zotero.Items.getAsync(task.itemId);
      if (!item) {
        throw new Error("Literature item does not exist");
      }

      // 动态导入 ImageSummaryService
      const { ImageSummaryService } = await import("./imageSummaryService");

      // 执行一图总结
      await ImageSummaryService.generateForItem(
        item,
        (stage, message, progress) => {
          // Update任务进度
          task.progress = progress;
          task.workflowStage = message;
          this.notifyProgress(taskId, progress, message);
          // 保存进度（但不要太频繁）
          if (progress % 20 === 0 || progress === 100) {
            this.saveToStorage().catch(() => {});
          }
        },
      );

      // 任务成功完成
      task.status = TaskStatus.COMPLETED;
      task.progress = 100;
      task.workflowStage = "Completed";
      task.completedAt = new Date();
      task.duration = Math.floor(
        (task.completedAt.getTime() - task.startedAt!.getTime()) / 1000,
      );

      ztoolkit.log(
        `Image summary task completed: ${task.title} (took ${task.duration} seconds)`,
      );
      this.notifyComplete(taskId, true);
    } catch (error: any) {
      // 任务失败
      task.error =
        error?.details?.errorMessage || error?.message || "Unknown error";
      task.workflowStage = "Failed";

      task.retryCount++;
      if (task.retryCount < task.maxRetries) {
        task.status = TaskStatus.PENDING;
        task.progress = 0;
        ztoolkit.log(
          `Image summary task failed, will retry (${task.retryCount}/${task.maxRetries}): ${task.title}`,
        );
      } else {
        task.status = TaskStatus.FAILED;
        task.completedAt = new Date();
        ztoolkit.log(
          `Image summary task ultimately failed: ${task.title} - ${task.error}`,
        );
      }

      this.notifyComplete(taskId, false, task.error);
    } finally {
      this.processingTasks.delete(taskId);
      await this.saveToStorage();
    }
  }

  /**
   * 获取一图总结任务
   */
  public getImageSummaryTasks(): TaskItem[] {
    return this.getAllTasks().filter((t) => t.taskType === "imageSummary");
  }

  /**
   * 添加思维导图任务
   *
   * @param item Zotero 文献条目
   * @returns 任务ID
   */
  public async addMindmapTask(item: Zotero.Item): Promise<string> {
    const taskId = `mindmap-task-${item.id}`;

    // 检查是否Already exists
    if (this.tasks.has(taskId)) {
      ztoolkit.log(`Mindmap task already exists: ${taskId}`);
      return taskId;
    }

    // 创建任务项
    const task: TaskItem = {
      id: taskId,
      itemId: item.id,
      title: item.getField("title") as string,
      status: TaskStatus.PRIORITY, // 思维导图默认优先处理
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 2,
      taskType: "mindmap",
      workflowStage: "Waiting to start",
    };

    this.tasks.set(taskId, task);
    await this.saveToStorage();

    ztoolkit.log(`Adding mindmap task: ${task.title} (${taskId})`);

    // 立即执行思维导图任务
    this.executeMindmapTask(taskId).catch((e) => {
      ztoolkit.log(`Mindmap task execution failed: ${e}`);
    });

    return taskId;
  }

  /**
   * 执行思维导图任务
   *
   * @param taskId 任务ID
   */
  private async executeMindmapTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.taskType !== "mindmap") {
      return;
    }

    // 防止重复执行
    if (
      task.status === TaskStatus.PROCESSING ||
      task.status === TaskStatus.COMPLETED
    ) {
      return;
    }

    // Update任务状态
    task.status = TaskStatus.PROCESSING;
    task.startedAt = new Date();
    task.progress = 0;
    task.workflowStage = "Initializing";
    this.processingTasks.add(taskId);
    await this.saveToStorage();

    ztoolkit.log(`Starting mindmap task: ${task.title}`);

    try {
      // 获取 Zotero Item
      const item = await Zotero.Items.getAsync(task.itemId);
      if (!item) {
        throw new Error("Literature item does not exist");
      }

      // 动态导入 MindmapService
      const { MindmapService } = await import("./mindmapService");

      // 执行Mind map generation
      await MindmapService.generateForItem(item, (stage, message, progress) => {
        // Update任务进度
        task.progress = progress;
        task.workflowStage = message;
        this.notifyProgress(taskId, progress, message);
        // 保存进度（但不要太频繁）
        if (progress % 20 === 0 || progress === 100) {
          this.saveToStorage().catch(() => {});
        }
      });

      // 任务成功完成
      task.status = TaskStatus.COMPLETED;
      task.progress = 100;
      task.workflowStage = "Completed";
      task.completedAt = new Date();
      task.duration = Math.floor(
        (task.completedAt.getTime() - task.startedAt!.getTime()) / 1000,
      );

      ztoolkit.log(
        `Mindmap task completed: ${task.title} (took ${task.duration} seconds)`,
      );
      this.notifyComplete(taskId, true);
    } catch (error: any) {
      // 任务失败
      task.error =
        error?.details?.errorMessage || error?.message || "Unknown error";
      task.workflowStage = "Failed";

      task.retryCount++;
      if (task.retryCount < task.maxRetries) {
        task.status = TaskStatus.PENDING;
        task.progress = 0;
        ztoolkit.log(
          `Mindmap task failed, will retry (${task.retryCount}/${task.maxRetries}): ${task.title}`,
        );
      } else {
        task.status = TaskStatus.FAILED;
        task.completedAt = new Date();
        ztoolkit.log(
          `Mindmap task ultimately failed: ${task.title} - ${task.error}`,
        );
      }

      this.notifyComplete(taskId, false, task.error);
    } finally {
      this.processingTasks.delete(taskId);
      await this.saveToStorage();
    }
  }

  /**
   * 获取思维导图任务
   */
  public getMindmapTasks(): TaskItem[] {
    return this.getAllTasks().filter((t) => t.taskType === "mindmap");
  }

  /**
   * 添加填表任务
   */
  public async addTableFillTask(item: Zotero.Item): Promise<string> {
    const taskId = `table-task-${item.id}`;

    if (this.tasks.has(taskId)) {
      ztoolkit.log(`Table filling task already exists: ${taskId}`);
      return taskId;
    }

    const task: TaskItem = {
      id: taskId,
      itemId: item.id,
      title: item.getField("title") as string,
      status: TaskStatus.PRIORITY,
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 2,
      taskType: "tableFill",
      workflowStage: "Waiting to start",
    };

    this.tasks.set(taskId, task);
    await this.saveToStorage();

    ztoolkit.log(`Adding table filling task: ${task.title} (${taskId})`);

    // 立即执行
    this.executeTableFillTask(taskId).catch((e) => {
      ztoolkit.log(`Table filling task execution failed: ${e}`);
    });

    return taskId;
  }

  /**
   * 执行填表任务
   */
  private async executeTableFillTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.taskType !== "tableFill") return;

    if (
      task.status === TaskStatus.PROCESSING ||
      task.status === TaskStatus.COMPLETED
    )
      return;

    task.status = TaskStatus.PROCESSING;
    task.startedAt = new Date();
    task.progress = 0;
    task.workflowStage = "Initializing";
    this.processingTasks.add(taskId);
    await this.saveToStorage();

    try {
      const item = await Zotero.Items.getAsync(task.itemId);
      if (!item) throw new Error("Literature item does not exist");

      const { LiteratureReviewService } =
        await import("./literatureReviewService");
      const { getPref } = await import("../utils/prefs");
      const { DEFAULT_TABLE_TEMPLATE, DEFAULT_TABLE_FILL_PROMPT } =
        await import("../utils/prompts");

      const tableTemplate =
        (getPref("tableTemplate" as any) as string) || DEFAULT_TABLE_TEMPLATE;
      const fillPrompt =
        (getPref("tableFillPrompt" as any) as string) ||
        DEFAULT_TABLE_FILL_PROMPT;

      task.workflowStage = "Extracting PDF";
      task.progress = 20;
      this.notifyProgress(taskId, 20, "Extracting PDF");

      // 找到 PDF 附件
      const attachmentIDs = (item as any).getAttachments?.() || [];
      let pdfAtt: Zotero.Item | null = null;
      for (const attId of attachmentIDs) {
        const att = await Zotero.Items.getAsync(attId);
        if (att && (att as any).isPDFAttachment?.()) {
          pdfAtt = att;
          break;
        }
      }

      if (!pdfAtt) throw new Error("This item has no PDF attachment");

      task.workflowStage = "AI Table Filling";
      task.progress = 40;
      this.notifyProgress(taskId, 40, "AI Table Filling");

      const tableContent = await LiteratureReviewService.fillTableForSinglePDF(
        item,
        pdfAtt,
        tableTemplate,
        fillPrompt,
      );

      task.workflowStage = "Saving";
      task.progress = 80;
      this.notifyProgress(taskId, 80, "Saving");

      await LiteratureReviewService.saveTableNote(item, tableContent);

      task.status = TaskStatus.COMPLETED;
      task.progress = 100;
      task.workflowStage = "Completed";
      task.completedAt = new Date();
      task.duration = Math.floor(
        (task.completedAt.getTime() - task.startedAt!.getTime()) / 1000,
      );

      ztoolkit.log(
        `Table filling task completed: ${task.title} (took ${task.duration} seconds)`,
      );
      this.notifyComplete(taskId, true);
    } catch (error: any) {
      task.error = error?.message || "Unknown error";
      task.workflowStage = "Failed";
      task.retryCount++;
      if (task.retryCount < task.maxRetries) {
        task.status = TaskStatus.PENDING;
        task.progress = 0;
      } else {
        task.status = TaskStatus.FAILED;
        task.completedAt = new Date();
      }
      this.notifyComplete(taskId, false, task.error);
    } finally {
      this.processingTasks.delete(taskId);
      await this.saveToStorage();
    }
  }

  /**
   * 添加综述任务
   */
  public async addReviewTask(
    collection: Zotero.Collection,
    pdfAttachments: Zotero.Item[],
    reviewName: string,
    prompt?: string,
    tableTemplate?: string,
  ): Promise<string> {
    const taskId = `review-task-${collection.id}`;

    // 若Already exists则Update
    if (this.tasks.has(taskId)) {
      const existing = this.tasks.get(taskId)!;
      if (existing.status === TaskStatus.PROCESSING) {
        ztoolkit.log(`Literature review task is executing: ${taskId}`);
        return taskId;
      }
      this.tasks.delete(taskId);
    }

    const task: TaskItem = {
      id: taskId,
      itemId: collection.id,
      title: reviewName,
      status: TaskStatus.PRIORITY,
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 1,
      taskType: "review",
      workflowStage: "Waiting to start",
      collectionId: collection.id,
      pdfAttachmentIds: pdfAttachments.map((p) => p.id),
      reviewName,
      tableTemplate,
    };

    this.tasks.set(taskId, task);
    await this.saveToStorage();

    ztoolkit.log(`Adding literature review task: ${task.title} (${taskId})`);

    // 立即执行
    this.executeReviewTask(taskId, prompt).catch((e) => {
      ztoolkit.log(`Literature review task execution failed: ${e}`);
    });

    return taskId;
  }

  /**
   * 执行综述任务
   */
  private async executeReviewTask(
    taskId: string,
    prompt?: string,
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.taskType !== "review") return;

    if (
      task.status === TaskStatus.PROCESSING ||
      task.status === TaskStatus.COMPLETED
    )
      return;

    task.status = TaskStatus.PROCESSING;
    task.startedAt = new Date();
    task.progress = 0;
    task.workflowStage = "Initializing";
    this.processingTasks.add(taskId);
    await this.saveToStorage();

    try {
      if (!task.collectionId || !task.pdfAttachmentIds?.length) {
        throw new Error("Literature review task parameters are incomplete");
      }

      const collection = Zotero.Collections.get(
        task.collectionId,
      ) as Zotero.Collection;
      if (!collection) throw new Error("Collection does not exist");

      // 加载 PDF 附件
      const pdfAttachments: Zotero.Item[] = [];
      for (const attId of task.pdfAttachmentIds) {
        const att = await Zotero.Items.getAsync(attId);
        if (att) pdfAttachments.push(att);
      }

      if (pdfAttachments.length === 0)
        throw new Error("No available PDF attachments");

      const { LiteratureReviewService } =
        await import("./literatureReviewService");

      const reviewName =
        task.reviewName || `Review ${new Date().toISOString().slice(2, 10)}`;

      await LiteratureReviewService.generateReview(
        collection,
        pdfAttachments,
        reviewName,
        prompt || "",
        task.tableTemplate || "",
        (message: string, progress: number) => {
          task.progress = progress;
          task.workflowStage = message;
          this.notifyProgress(taskId, progress, message);
          if (progress % 20 === 0 || progress === 100) {
            this.saveToStorage().catch(() => {});
          }
        },
      );

      task.status = TaskStatus.COMPLETED;
      task.progress = 100;
      task.workflowStage = "Completed";
      task.completedAt = new Date();
      task.duration = Math.floor(
        (task.completedAt.getTime() - task.startedAt!.getTime()) / 1000,
      );

      ztoolkit.log(
        `Literature review task completed: ${task.title} (took ${task.duration} seconds)`,
      );
      this.notifyComplete(taskId, true);
    } catch (error: any) {
      task.error = error?.message || "Unknown error";
      task.workflowStage = "Failed";
      task.status = TaskStatus.FAILED;
      task.completedAt = new Date();
      this.notifyComplete(taskId, false, task.error);
    } finally {
      this.processingTasks.delete(taskId);
      await this.saveToStorage();
    }
  }

  /**
   * 获取填表任务
   */
  public getTableFillTasks(): TaskItem[] {
    return this.getAllTasks().filter((t) => t.taskType === "tableFill");
  }

  /**
   * 获取综述任务
   */
  public getReviewTasks(): TaskItem[] {
    return this.getAllTasks().filter((t) => t.taskType === "review");
  }

  /**
   * 添加针对性提问任务
   */
  public async addTargetedQuestionTask(
    collection: Zotero.Collection,
    pdfAttachments: Zotero.Item[],
    noteTitle: string,
    targetedPrompt: string,
    tableTemplate?: string,
    options?: {
      selectedTableEntries?: string[];
      appendedTableEntries?: string[];
    },
  ): Promise<string> {
    const taskId = `targeted-task-${collection.id}-${Date.now()}-${Math.floor(
      Math.random() * 1000,
    )}`;

    const task: TaskItem = {
      id: taskId,
      itemId: collection.id,
      title: noteTitle,
      status: TaskStatus.PRIORITY,
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 1,
      taskType: "targetedQuestion",
      workflowStage: "Waiting to start",
      collectionId: collection.id,
      pdfAttachmentIds: pdfAttachments.map((p) => p.id),
      tableTemplate,
      targetedPrompt,
      targetedNoteTitle: noteTitle,
      targetedSelectedTableEntries: options?.selectedTableEntries || [],
      targetedAppendedTableEntries: options?.appendedTableEntries || [],
    };

    this.tasks.set(taskId, task);
    await this.saveToStorage();

    ztoolkit.log(`Adding targeted question task: ${task.title} (${taskId})`);

    // 立即执行
    this.executeTargetedQuestionTask(taskId).catch((e) => {
      ztoolkit.log(`Targeted question task execution failed: ${e}`);
    });

    return taskId;
  }

  /**
   * 执行针对性提问任务
   */
  private async executeTargetedQuestionTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.taskType !== "targetedQuestion") return;

    if (
      task.status === TaskStatus.PROCESSING ||
      task.status === TaskStatus.COMPLETED
    )
      return;

    task.status = TaskStatus.PROCESSING;
    task.startedAt = new Date();
    task.progress = 0;
    task.workflowStage = "Initializing";
    this.processingTasks.add(taskId);
    await this.saveToStorage();

    try {
      if (
        !task.collectionId ||
        !task.pdfAttachmentIds?.length ||
        !task.targetedPrompt
      ) {
        throw new Error("Targeted question task parameters are incomplete");
      }

      const collection = Zotero.Collections.get(
        task.collectionId,
      ) as Zotero.Collection;
      if (!collection) throw new Error("Collection does not exist");

      const pdfAttachments: Zotero.Item[] = [];
      for (const attId of task.pdfAttachmentIds) {
        const att = await Zotero.Items.getAsync(attId);
        if (att) pdfAttachments.push(att);
      }
      if (pdfAttachments.length === 0)
        throw new Error("No available PDF attachments");

      const { LiteratureReviewService } =
        await import("./literatureReviewService");
      const noteTitle =
        task.targetedNoteTitle ||
        `Targeted Question ${new Date().toISOString().slice(2, 10)}`;

      await LiteratureReviewService.generateTargetedAnswer(
        collection,
        pdfAttachments,
        noteTitle,
        task.targetedPrompt,
        task.tableTemplate || "",
        {
          selectedTableEntries: task.targetedSelectedTableEntries || [],
          appendedTableEntries: task.targetedAppendedTableEntries || [],
        },
        (message: string, progress: number) => {
          task.progress = progress;
          task.workflowStage = message;
          this.notifyProgress(taskId, progress, message);
          if (progress % 20 === 0 || progress === 100) {
            this.saveToStorage().catch(() => {});
          }
        },
      );

      task.status = TaskStatus.COMPLETED;
      task.progress = 100;
      task.workflowStage = "Completed";
      task.completedAt = new Date();
      task.duration = Math.floor(
        (task.completedAt.getTime() - task.startedAt!.getTime()) / 1000,
      );

      ztoolkit.log(
        `Targeted question task completed: ${task.title} (took ${task.duration} seconds)`,
      );
      this.notifyComplete(taskId, true);
    } catch (error: any) {
      task.error = error?.message || "Unknown error";
      task.workflowStage = "Failed";
      task.status = TaskStatus.FAILED;
      task.completedAt = new Date();
      this.notifyComplete(taskId, false, task.error);
    } finally {
      this.processingTasks.delete(taskId);
      await this.saveToStorage();
    }
  }

  /**
   * 获取针对性提问任务
   */
  public getTargetedQuestionTasks(): TaskItem[] {
    return this.getAllTasks().filter((t) => t.taskType === "targetedQuestion");
  }

  /**
   * 移除任务
   *
   * @param taskId 任务ID
   */
  public async removeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    // 不能删除处理中的任务
    if (task.status === TaskStatus.PROCESSING) {
      throw new Error("Cannot delete a processing task");
    }

    this.tasks.delete(taskId);
    await this.saveToStorage();

    ztoolkit.log(`Deleting task: ${taskId}`);
  }

  /**
   * 清空Completed的任务
   */
  public async clearCompleted(): Promise<void> {
    const completedTasks = Array.from(this.tasks.values()).filter(
      (task) => task.status === TaskStatus.COMPLETED,
    );

    for (const task of completedTasks) {
      this.tasks.delete(task.id);
    }

    await this.saveToStorage();
    ztoolkit.log(`Cleared completed tasks: ${completedTasks.length}`);
  }

  /**
   * 清空所有任务
   */
  public async clearAll(): Promise<void> {
    // 停止执行器
    this.stop();

    // 清空队列
    this.tasks.clear();
    this.processingTasks.clear();

    await this.saveToStorage();
    ztoolkit.log("Cleared all tasks");
  }

  /**
   * 设置任务优先级
   *
   * @param taskId 任务ID
   * @param priority 是否优先
   */
  public async setTaskPriority(
    taskId: string,
    priority: boolean,
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    // 只有待处理或失败的任务可以调整优先级
    if (
      task.status === TaskStatus.PENDING ||
      task.status === TaskStatus.FAILED
    ) {
      task.status = priority ? TaskStatus.PRIORITY : TaskStatus.PENDING;
      await this.saveToStorage();
      ztoolkit.log(`Task ${taskId} priority updated: ${priority}`);
    }
  }

  /**
   * 重试失败任务
   *
   * @param taskId 任务ID
   */
  public async retryTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== TaskStatus.FAILED) {
      return;
    }

    // 重置任务状态
    task.status = TaskStatus.PRIORITY; // 优先重试
    task.progress = 0;
    task.error = undefined;
    task.retryCount = 0;

    await this.saveToStorage();
    ztoolkit.log(`Retrying task: ${taskId}`);

    // 确保执行器正在运行
    if (!this.isRunning) {
      this.start();
    }
  }

  // ==================== 队列查询 ====================

  /**
   * 获取所有任务
   */
  public getAllTasks(): TaskItem[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 按状态筛选任务
   *
   * @param status 任务状态
   */
  public getTasksByStatus(status: TaskStatus): TaskItem[] {
    return this.getAllTasks().filter((task) => task.status === status);
  }

  /**
   * 获取排序后的任务列表
   *
   * 排序规则:
   * 1. 优先处理
   * 2. 处理中
   * 3. 待处理
   * 4. 失败
   * 5. Completed
   *
   * 同状态内按创建时间升序
   */
  public getSortedTasks(): TaskItem[] {
    const statusOrder = {
      [TaskStatus.PRIORITY]: 1,
      [TaskStatus.PROCESSING]: 2,
      [TaskStatus.PENDING]: 3,
      [TaskStatus.FAILED]: 4,
      [TaskStatus.COMPLETED]: 5,
    };

    return this.getAllTasks().sort((a, b) => {
      // 先按状态排序
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) {
        return statusDiff;
      }

      // 同状态按创建时间排序
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * 获取队列统计信息
   */
  public getStats(): QueueStats {
    const tasks = this.getAllTasks();
    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === TaskStatus.PENDING).length;
    const priority = tasks.filter(
      (t) => t.status === TaskStatus.PRIORITY,
    ).length;
    const processing = tasks.filter(
      (t) => t.status === TaskStatus.PROCESSING,
    ).length;
    const completed = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    ).length;
    const failed = tasks.filter((t) => t.status === TaskStatus.FAILED).length;

    const successRate =
      total > 0
        ? Math.round((completed / (completed + failed)) * 100) || 0
        : 100;

    return {
      total,
      pending,
      priority,
      processing,
      completed,
      failed,
      successRate,
    };
  }

  /**
   * 获取单个任务
   *
   * @param taskId 任务ID
   */
  public getTask(taskId: string): TaskItem | undefined {
    return this.tasks.get(taskId);
  }

  // ==================== 执行器控制 ====================

  /**
   * 启动队列执行器
   */
  public start(): void {
    if (this.isRunning) {
      ztoolkit.log("Queue executor is already running");
      return;
    }

    this.isRunning = true;
    ztoolkit.log("Starting queue executor");

    // 立即执行一次
    this.executeNextBatch();

    // 设置定时器
    this.executorTimerId = setInterval(() => {
      this.executeNextBatch();
    }, this.executionInterval) as any as number;
  }

  /**
   * 停止队列执行器
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.isBatchRunning = false;

    if (this.executorTimerId !== null) {
      clearInterval(this.executorTimerId);
      this.executorTimerId = null;
    }

    ztoolkit.log("Stopping queue executor");
  }

  /**
   * Update执行器设置
   *
   * @param maxConcurrency 最大并发数
   * @param intervalSeconds 执行间隔(秒)
   */
  public updateSettings(batchSize: number, intervalSeconds: number): void {
    this.batchSize = Math.max(1, Math.floor(batchSize));
    this.maxConcurrency = Math.max(1, this.batchSize);
    this.executionInterval = Math.max(1, Math.floor(intervalSeconds)) * 1000;

    // 如果正在运行,重启以应用新设置
    if (this.isRunning) {
      this.stop();
      this.start();
    }

    ztoolkit.log(
      `Updating executor settings: batchSize=${this.batchSize}, interval=${intervalSeconds} seconds`,
    );
  }

  // ==================== 任务执行 ====================

  /**
   * 执行下一批任务
   *
   * 并行执行 batchSize 个任务，所有任务完成后再进入下一个间隔周期
   */
  private async executeNextBatch(): Promise<void> {
    if (this.isBatchRunning) {
      return;
    }

    this.isBatchRunning = true;

    try {
      // 获取待处理任务
      const pendingTasks = this.getAllTasks()
        .filter(
          (task) =>
            task.status === TaskStatus.PRIORITY ||
            task.status === TaskStatus.PENDING,
        )
        .sort((a, b) => {
          if (
            a.status === TaskStatus.PRIORITY &&
            b.status !== TaskStatus.PRIORITY
          ) {
            return -1;
          }
          if (
            a.status !== TaskStatus.PRIORITY &&
            b.status === TaskStatus.PRIORITY
          ) {
            return 1;
          }
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

      if (pendingTasks.length === 0) {
        ztoolkit.log("No pending tasks");
        return;
      }

      // 选取本批次要执行的任务（最多 batchSize 个）
      const tasksToExecute = pendingTasks.slice(0, this.batchSize);

      ztoolkit.log(
        `Starting parallel batch execution: ${tasksToExecute.length} tasks (batchSize=${this.batchSize})`,
      );

      // 并行执行所有任务
      const taskPromises = tasksToExecute.map(async (task) => {
        ztoolkit.log(`Starting task: ${task.title}`);
        const wasQuickFail = await this.executeTask(task.id);
        return { taskId: task.id, title: task.title, wasQuickFail };
      });

      // 等待所有任务完成
      const results = await Promise.all(taskPromises);

      // 统计结果
      const llmTasksProcessed = results.filter((r) => !r.wasQuickFail).length;
      const quickFailCount = results.filter((r) => r.wasQuickFail).length;

      ztoolkit.log(
        `Batch execution completed, processed ${llmTasksProcessed} tasks, quick failed ${quickFailCount} tasks`,
      );
    } finally {
      this.isBatchRunning = false;

      const hasPending = this.getAllTasks().some(
        (task) =>
          task.status === TaskStatus.PRIORITY ||
          task.status === TaskStatus.PENDING,
      );

      if (!hasPending && this.processingTasks.size === 0 && this.isRunning) {
        this.stop();
      }
    }
  }

  /**
   * 执行单个任务
   *
   * @param taskId 任务ID
   * @returns 是否为快速失败（无 PDF 附件），用于批次配额判断
   */
  private async executeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    // 非普通总结任务转交到各自执行器，避免误走默认总结流程
    if (task.taskType && task.taskType !== "summary") {
      if (task.taskType === "imageSummary") {
        await this.executeImageSummaryTask(taskId);
        return false;
      }
      if (task.taskType === "mindmap") {
        await this.executeMindmapTask(taskId);
        return false;
      }
      if (task.taskType === "tableFill") {
        await this.executeTableFillTask(taskId);
        return false;
      }
      if (task.taskType === "review") {
        await this.executeReviewTask(taskId);
        return false;
      }
      if (task.taskType === "targetedQuestion") {
        await this.executeTargetedQuestionTask(taskId);
        return false;
      }
    }

    // 防止任务被重复执行（竞态条件保护）
    // 如果任务已在处理中或Completed，跳过执行
    if (
      task.status === TaskStatus.PROCESSING ||
      task.status === TaskStatus.COMPLETED
    ) {
      ztoolkit.log(
        `Task already processing or completed, skipping duplicate execution: ${taskId}`,
      );
      return false;
    }

    // Update任务状态为处理中
    task.status = TaskStatus.PROCESSING;
    task.startedAt = new Date();
    task.progress = 0;
    this.processingTasks.add(taskId);
    await this.saveToStorage();

    ztoolkit.log(`Starting task execution: ${task.title} (${taskId})`);

    try {
      // 获取 Zotero Item
      const item = await Zotero.Items.getAsync(task.itemId);
      if (!item) {
        throw new Error("Literature item does not exist");
      }

      // 检查是否有 PDF 附件
      const hasPdf = await PDFExtractor.hasPDFAttachment(item);
      if (!hasPdf) {
        throw new Error(NO_PDF_ERROR_MSG);
      }

      // 调用 NoteGenerator 生成笔记
      await NoteGenerator.generateNoteForItem(
        item,
        undefined, // 不使用输出窗口,通过流式回调转发
        (message: string, progress: number) => {
          // Update任务进度
          task.progress = progress;
          this.notifyProgress(taskId, progress, message);
        },
        (chunk: string) => {
          // 将增量内容广播给监听者
          try {
            // 首次到来时发送 start 事件
            if (task.progress === 0) {
              this.notifyStream(taskId, { type: "start", title: task.title });
            }
            this.notifyStream(taskId, { type: "chunk", chunk });
          } catch (e) {
            ztoolkit.log(`Stream callback execution failed: ${e}`);
          }
        },
        task.options,
      );

      // 任务成功完成
      task.status = TaskStatus.COMPLETED;
      task.progress = 100;
      task.completedAt = new Date();
      task.duration = Math.floor(
        (task.completedAt.getTime() - task.startedAt!.getTime()) / 1000,
      );

      ztoolkit.log(
        `Task completed: ${task.title} (took ${task.duration} seconds)`,
      );
      this.notifyComplete(taskId, true);
      // 发送结束事件
      this.notifyStream(taskId, { type: "finish" });
      // 自动触发一图总结（如果设置已启用且是普通总结任务）
      if (!task.taskType || task.taskType === "summary") {
        this.maybeAutoTriggerImageSummary(task.itemId);
      }
      return false; // 非快速失败，计入批次
    } catch (error: any) {
      // 任务失败
      task.error = error.message || "Unknown error";

      // 无 PDF 附件错误直接标记失败，不重试（用户需要手动添加 PDF）
      const isNoPdfError = task.error === NO_PDF_ERROR_MSG;
      if (isNoPdfError) {
        task.status = TaskStatus.FAILED;
        task.completedAt = new Date();
        ztoolkit.log(`Task failed (no PDF attachment): ${task.title}`);
      } else {
        task.retryCount++;
        // 检查是否需要重试
        if (task.retryCount < task.maxRetries) {
          // 重置为待处理状态,等待重试
          task.status = TaskStatus.PENDING;
          task.progress = 0;
          ztoolkit.log(
            `Task failed, will retry (${task.retryCount}/${task.maxRetries}): ${task.title}`,
          );
        } else {
          // 超过最大重试次数,标记为失败
          task.status = TaskStatus.FAILED;
          task.completedAt = new Date();
          ztoolkit.log(`Task ultimately failed: ${task.title} - ${task.error}`);
        }
      }

      this.notifyComplete(taskId, false, task.error);
      this.notifyStream(taskId, { type: "error" });
      return isNoPdfError; // 无 PDF 错误时返回 true，表示快速失败
    } finally {
      // 移除处理中标记
      this.processingTasks.delete(taskId);
      await this.saveToStorage();
    }
  }

  // ==================== 回调管理 ====================

  /**
   * 注册进度回调
   *
   * @param callback 回调函数
   */
  public onProgress(callback: TaskProgressCallback): () => void {
    this.progressCallbacks.add(callback);

    // 返回Cancel注册的函数
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * 注册完成回调
   *
   * @param callback 回调函数
   */
  public onComplete(callback: TaskCompleteCallback): () => void {
    this.completeCallbacks.add(callback);

    // 返回Cancel注册的函数
    return () => {
      this.completeCallbacks.delete(callback);
    };
  }

  /**
   * 注册流式事件回调
   */
  public onStream(callback: TaskStreamCallback): () => void {
    this.streamCallbacks.add(callback);
    return () => this.streamCallbacks.delete(callback);
  }

  /**
   * 通知进度回调
   */
  private notifyProgress(
    taskId: string,
    progress: number,
    message: string,
  ): void {
    this.progressCallbacks.forEach((callback) => {
      try {
        callback(taskId, progress, message);
      } catch (error) {
        ztoolkit.log(`Progress callback execution failed: ${error}`);
      }
    });
  }

  /**
   * 通知完成回调
   */
  private notifyComplete(
    taskId: string,
    success: boolean,
    error?: string,
  ): void {
    this.completeCallbacks.forEach((callback) => {
      try {
        callback(taskId, success, error);
      } catch (error) {
        ztoolkit.log(`Complete callback execution failed: ${error}`);
      }
    });
  }

  /** 通知流式事件 */
  private notifyStream(
    taskId: string,
    event: {
      type: "start" | "chunk" | "finish" | "error";
      chunk?: string;
      title?: string;
    },
  ): void {
    this.streamCallbacks.forEach((cb) => {
      try {
        cb(taskId, event);
      } catch (e) {
        ztoolkit.log(`Stream callback execution failed: ${e}`);
      }
    });
  }

  /**
   * 检查是否应该自动触发一图总结
   * 只有当设置启用且任务是普通总结任务时才触发
   */
  private async maybeAutoTriggerImageSummary(itemId: number): Promise<void> {
    try {
      const { getPref } = await import("../utils/prefs");
      const autoTrigger =
        (getPref("autoImageSummaryOnComplete" as any) as boolean) || false;

      if (!autoTrigger) {
        return;
      }

      // 获取 Zotero Item
      const item = await Zotero.Items.getAsync(itemId);
      if (!item) {
        return;
      }

      // 检查是否已有一图总结任务正在In queue
      const existingTask = this.tasks.get(`img-task-${itemId}`);
      if (existingTask) {
        ztoolkit.log(
          `[AI-Butler] Image summary task already exists, skipping auto trigger: ${itemId}`,
        );
        return;
      }

      ztoolkit.log(
        `[AI-Butler] Auto triggering image summary: ${item.getField("title")}`,
      );
      await this.addImageSummaryTask(item);
    } catch (error) {
      ztoolkit.log(`[AI-Butler] Auto trigger image summary failed:`, error);
    }
  }

  // ==================== 持久化 ====================

  /**
   * 从持久化存储加载任务队列
   *
   * @param resetProcessingTasks 是否将处理中任务重置为待处理
   */
  private loadFromStorage(resetProcessingTasks: boolean): void {
    try {
      const stored = Zotero.Prefs.get(
        "extensions.zotero.aibutler.taskQueue",
        true,
      ) as string;
      if (!stored) {
        return;
      }

      const data = JSON.parse(stored);
      const snapshotAt =
        typeof data?.savedAt === "string" ? data.savedAt : undefined;

      // 快照未变化时无需重复覆盖内存状态
      if (
        snapshotAt &&
        this.lastLoadedSnapshotAt &&
        snapshotAt === this.lastLoadedSnapshotAt
      ) {
        return;
      }

      // 恢复任务数据
      this.tasks.clear();
      for (const taskData of data.tasks || []) {
        const task: TaskItem = {
          ...taskData,
          createdAt: new Date(taskData.createdAt),
          startedAt: taskData.startedAt
            ? new Date(taskData.startedAt)
            : undefined,
          completedAt: taskData.completedAt
            ? new Date(taskData.completedAt)
            : undefined,
        };

        // 插件重启恢复时，处理中任务无法继续执行，改为待处理重新排队
        if (resetProcessingTasks && task.status === TaskStatus.PROCESSING) {
          task.status = TaskStatus.PENDING;
          task.progress = 0;
        }

        this.tasks.set(task.id, task);
      }

      this.lastLoadedSnapshotAt = snapshotAt || null;

      ztoolkit.log(`Loaded ${this.tasks.size} tasks from storage`);
    } catch (error) {
      ztoolkit.log(`Failed to load task queue: ${error}`);
    }
  }

  /**
   * 主动从持久化存储Refresh任务数据
   *
   * 用于跨窗口上下文读取最新快照；若本上下文正在执行任务，则以内存状态为准。
   */
  public refreshFromStorage(): void {
    if (this.processingTasks.size > 0) {
      return;
    }
    this.loadFromStorage(false);
  }

  /**
   * 保存任务队列到 localStorage
   */
  private async saveToStorage(): Promise<void> {
    try {
      const savedAt = new Date().toISOString();
      const data = {
        tasks: Array.from(this.tasks.values()),
        savedAt,
      };

      Zotero.Prefs.set(
        "extensions.zotero.aibutler.taskQueue",
        JSON.stringify(data),
        true,
      );
      this.lastLoadedSnapshotAt = savedAt;
    } catch (error) {
      ztoolkit.log(`Failed to save task queue: ${error}`);
    }
  }

  /**
   * 从配置加载设置
   */
  private loadSettings(): void {
    const rawBatchSize = parseInt(getPref("batchSize") as string) || 1;
    this.batchSize = Math.max(1, rawBatchSize);
    this.maxConcurrency = Math.max(1, this.batchSize);
    this.executionInterval =
      (parseInt(getPref("batchInterval") as string) || 60) * 1000;
  }

  // ==================== 今日统计 ====================

  /**
   * 获取今日完成的任务数
   */
  public getTodayCompletedCount(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.getAllTasks().filter(
      (task) =>
        task.status === TaskStatus.COMPLETED &&
        task.completedAt &&
        task.completedAt >= today,
    ).length;
  }

  /**
   * 获取今日失败的任务数
   */
  public getTodayFailedCount(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.getAllTasks().filter(
      (task) =>
        task.status === TaskStatus.FAILED &&
        task.completedAt &&
        task.completedAt >= today,
    ).length;
  }
}
