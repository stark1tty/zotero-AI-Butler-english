/**
 * ================================================================
 * 仪表盘视图
 * ================================================================
 *
 * 本模块提供插件工作状态的可视化概览
 *
 * 主要职责:
 * 1. 展示管家工作状态 (工作中/休息中)
 * 2. 显示实时统计数据和图表
 * 3. 展示最近处理的文献列表
 * 4. 提供快速操作入口
 * 5. 显示系统健康状态
 *
 * 显示内容:
 * - 管家状态卡片
 * - 统计数据总览
 * - 处理趋势图表
 * - 最近活动列表
 * - 快捷操作按钮
 *
 * @module DashboardView
 * @author AI-Butler Team
 */

import { BaseView } from "./BaseView";
import { TaskQueueManager, QueueStats, TaskStatus } from "../taskQueue";
import { MainWindow } from "./MainWindow";
import { AutoScanManager } from "../autoScanManager";
import { getPref, setPref } from "../../utils/prefs";
import { createCard, createStyledButton } from "./ui/components";
import { getString } from "../../utils/locale";

/**
 * 管家状态枚举
 */
export enum ButlerStatus {
  WORKING = "working", // 工作中
  IDLE = "idle", // 休息中
  ERROR = "error", // Error状态
}

/**
 * 统计数据接口
 */
export interface DashboardStats {
  totalProcessed: number; // 总处理数
  todayProcessed: number; // 今日处理数
  pendingCount: number; // 待处理数
  failedCount: number; // Failed数
  successRate: number; // 成功率
  averageTime: number; // 平均处理时间(秒)
}

/**
 * 最近活动接口
 */
export interface RecentActivity {
  id: string;
  title: string;
  status: "success" | "failed";
  timestamp: Date;
  duration: number; // 秒
}

/**
 * 仪表盘视图类
 */
export class DashboardView extends BaseView {
  /** 当前管家状态 */
  private butlerStatus: ButlerStatus = ButlerStatus.IDLE;

  /** 统计数据 */
  private stats: DashboardStats = {
    totalProcessed: 0,
    todayProcessed: 0,
    pendingCount: 0,
    failedCount: 0,
    successRate: 100,
    averageTime: 0,
  };

  /** 最近活动列表 */
  private recentActivities: RecentActivity[] = [];

  /** 状态卡片容器 */
  private statusCard: HTMLElement | null = null;

  /** 统计卡片容器 */
  private statsContainer: HTMLElement | null = null;

  /** 活动列表容器 */
  private activityContainer: HTMLElement | null = null;

  /** 任务队列管理器 */
  private taskQueueManager: TaskQueueManager;

  /** 数据Refresh定时器 */
  private refreshTimerId: number | null = null;

  /** 进度回调Cancel函数 */
  private unsubscribeProgress: (() => void) | null = null;

  /** 完成回调Cancel函数 */
  private unsubscribeComplete: (() => void) | null = null;

  /**
   * 构造函数
   */
  constructor() {
    super("dashboard-view");
    this.taskQueueManager = TaskQueueManager.getInstance();
  }

  /**
   * 视图挂载时的回调
   * 注册任务队列事件监听器并启动数据Refresh
   *
   * @protected
   */
  protected onMount(): void {
    super.onMount();

    // 注册任务进度回调
    this.unsubscribeProgress = this.taskQueueManager.onProgress(
      (taskId, progress, message) => {
        this.handleTaskProgress(taskId, progress, message);
      },
    );

    // 注册任务完成回调
    this.unsubscribeComplete = this.taskQueueManager.onComplete(
      (taskId, success, error) => {
        this.handleTaskComplete(taskId, success, error);
      },
    );

    // 启动定时Refresh
    this.startRefreshTimer();

    // 立即Refresh一次数据
    this.refreshData();

    // 应用主题
    this.applyTheme();
  }

  /**
   * 视图销毁时的回调
   * 清理事件监听器和定时器
   *
   * @protected
   */
  protected onDestroy(): void {
    // Cancel任务队列回调
    if (this.unsubscribeProgress) {
      this.unsubscribeProgress();
      this.unsubscribeProgress = null;
    }

    if (this.unsubscribeComplete) {
      this.unsubscribeComplete();
      this.unsubscribeComplete = null;
    }

    // 停止定时Refresh
    this.stopRefreshTimer();

    super.onDestroy();
  }

  /**
   * 渲染视图内容
   *
   * @protected
   */
  protected renderContent(): HTMLElement {
    const container = this.createElement("div", {
      id: "ai-butler-dashboard-view",
      styles: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "auto",
      },
    });

    // 头部区域
    const header = this.createHeader();

    // 管家状态卡片
    this.statusCard = this.createStatusCard();

    // 统计数据区域
    this.statsContainer = this.createStatsSection();

    // 快捷操作区域
    const quickActions = this.createQuickActions();

    // 最近活动区域
    this.activityContainer = this.createRecentActivities();

    container.appendChild(header);
    container.appendChild(this.statusCard);
    container.appendChild(this.statsContainer);
    container.appendChild(quickActions);
    container.appendChild(this.activityContainer);

    return container;
  }

  /**
   * 创建头部区域
   *
   * @private
   */
  private createHeader(): HTMLElement {
    return this.createElement("div", {
      styles: {
        padding: "20px 20px 0 20px",
        flexShrink: "0",
      },
      children: [
        this.createElement("h2", {
          styles: {
            margin: "0 0 20px 0",
            fontSize: "20px",
            borderBottom: "2px solid #59c0bc",
            paddingBottom: "10px",
          },
          innerHTML: getString("dashboard-title"),
        }),
      ],
    });
  }

  /**
   * 创建管家状态卡片
   *
   * @private
   */
  private createStatusCard(): HTMLElement {
    const card = this.createElement("div", {
      id: "butler-status-card",
      styles: {
        margin: "0 20px 20px 20px",
        padding: "30px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: "12px",
        color: "#fff",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      },
    });

    const statusIcon = this.createElement("div", {
      id: "status-icon",
      styles: {
        fontSize: "48px",
        marginBottom: "15px",
      },
      textContent: "😴",
    });

    const statusText = this.createElement("div", {
      id: "status-text",
      styles: {
        fontSize: "24px",
        fontWeight: "700",
        marginBottom: "10px",
      },
      textContent: getString("dashboard-status-resting"),
    });

    const statusDetail = this.createElement("div", {
      id: "status-detail",
      styles: {
        fontSize: "14px",
        opacity: "0.9",
      },
      textContent: getString("dashboard-status-detail-resting", {
        args: { count: 0 },
      }),
    });

    card.appendChild(statusIcon);
    card.appendChild(statusText);
    card.appendChild(statusDetail);

    return card;
  }

  /**
   * 创建统计数据区域
   *
   * @private
   */
  private createStatsSection(): HTMLElement {
    return this.createElement("div", {
      id: "stats-section",
      styles: {
        padding: "0 20px 20px 20px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "15px",
      },
      children: [
        this.createStatCard(
          "total",
          getString("stat-total-processed"),
          "0",
          "#2196f3",
          "📚",
        ),
        this.createStatCard(
          "today",
          getString("stat-today-processed"),
          "0",
          "#4caf50",
          "📅",
        ),
        this.createStatCard(
          "pending",
          getString("stat-pending"),
          "0",
          "#ff9800",
          "⏳",
        ),
        this.createStatCard(
          "success-rate",
          getString("stat-success-rate"),
          "100%",
          "#9c27b0",
          "✨",
        ),
        this.createStatCard(
          "avg-time",
          getString("stat-avg-time"),
          "0s",
          "#607d8b",
          "⚡",
        ),
        this.createStatCard(
          "failed",
          getString("stat-failed"),
          "0",
          "#f44336",
          "❌",
        ),
      ],
    });
  }

  /**
   * 创建统计卡片
   *
   * @private
   */
  private createStatCard(
    id: string,
    label: string,
    value: string,
    color: string,
    icon: string,
  ): HTMLElement {
    const card = createCard("stat", label, undefined, {
      accentColor: color,
      value,
      icon,
      classes: ["stat-card"],
    });
    // 设置元素 id，便于后续Update
    card.id = `stat-${id}`;
    return card;
  }

  /**
   * 创建快捷操作区域
   *
   * @private
   */
  private createQuickActions(): HTMLElement {
    const section = this.createElement("div", {
      styles: {
        padding: "0 20px 20px 20px",
      },
    });

    const title = this.createElement("h3", {
      styles: {
        margin: "0 0 15px 0",
        fontSize: "16px",
        color: "var(--ai-text)",
      },
      textContent: "⚡ Quick Actions",
    });

    const actionsGrid = this.createElement("div", {
      styles: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "12px",
      },
    });

    const actions = [
      {
        icon: "🔍",
        label: getString("dashboard-button-scan"),
        color: "#2196f3",
      },
      {
        icon: "🚀",
        label: getString("dashboard-button-start-auto"),
        color: "#4caf50",
      },
      {
        icon: "⏸️",
        label: getString("dashboard-button-pause-auto"),
        color: "#ff9800",
      },
      {
        icon: "📋",
        label: getString("dashboard-button-view-queue"),
        color: "#9c27b0",
      },
      {
        icon: "🗑️",
        label: getString("dashboard-button-clear"),
        color: "#9e9e9e",
      },
      {
        icon: "⚙️",
        label: getString("dashboard-button-settings"),
        color: "#607d8b",
      },
    ];

    actions.forEach((action) => {
      const button = createStyledButton(
        `<span style="font-size: 20px;">${action.icon}</span> ${action.label}`,
        action.color,
        "large",
      );

      button.addEventListener("click", () => {
        this.handleQuickAction(action.label);
      });

      actionsGrid.appendChild(button);
    });

    section.appendChild(title);
    section.appendChild(actionsGrid);

    return section;
  }

  /**
   * 创建最近活动区域
   *
   * @private
   */
  private createRecentActivities(): HTMLElement {
    const section = this.createElement("div", {
      styles: {
        padding: "0 20px 20px 20px",
        flex: "1",
      },
    });

    const title = this.createElement("h3", {
      styles: {
        margin: "0 0 15px 0",
        fontSize: "16px",
        color: "var(--ai-text)",
      },
      textContent: "🕒 Recent Activities",
    });

    const activityList = this.createElement("div", {
      id: "activity-list",
      styles: {
        backgroundColor: "rgba(89, 192, 188, 0.03)",
        borderRadius: "8px",
        padding: "15px",
        maxHeight: "300px",
        overflow: "auto",
      },
    });

    if (this.recentActivities.length === 0) {
      const emptyMsg = this.createElement("div", {
        styles: {
          textAlign: "center",
          padding: "40px 20px",
          color: "#9e9e9e",
          fontSize: "14px",
        },
        textContent: "No recent activities",
      });
      activityList.appendChild(emptyMsg);
    }

    section.appendChild(title);
    section.appendChild(activityList);

    return section;
  }

  /**
   * Update管家状态
   *
   * @param status 状态
   * @param currentItem 当前处理的文献标题
   * @param remaining 剩余数量
   */
  public updateButlerStatus(
    status: ButlerStatus,
    currentItem?: string,
    remaining?: number,
  ): void {
    this.butlerStatus = status;

    if (!this.statusCard) return;

    const statusIcon = this.statusCard.querySelector("#status-icon");
    const statusText = this.statusCard.querySelector("#status-text");
    const statusDetail = this.statusCard.querySelector("#status-detail");

    if (!statusIcon || !statusText || !statusDetail) return;

    switch (status) {
      case ButlerStatus.WORKING:
        statusIcon.textContent = "🧐";
        statusText.textContent = getString("dashboard-status-working");
        statusDetail.textContent = currentItem
          ? remaining
            ? getString("dashboard-status-detail-working-remaining", {
                args: { item: currentItem, remaining },
              })
            : getString("dashboard-status-detail-working", {
                args: { item: currentItem },
              })
          : getString("dashboard-status-detail-processing");
        this.statusCard.style.background =
          "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)";
        break;

      case ButlerStatus.IDLE:
        statusIcon.textContent = "😴";
        statusText.textContent = getString("dashboard-status-resting");
        statusDetail.textContent = getString(
          "dashboard-status-detail-resting",
          { args: { count: this.stats.totalProcessed } },
        );
        this.statusCard.style.background =
          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
        break;

      case ButlerStatus.ERROR:
        statusIcon.textContent = "😵";
        statusText.textContent = getString("dashboard-status-error");
        statusDetail.textContent = getString("dashboard-status-detail-error");
        this.statusCard.style.background =
          "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)";
        break;
    }
  }

  /**
   * Update统计数据
   *
   * @param stats 统计数据
   */
  public updateStats(stats: Partial<DashboardStats>): void {
    this.stats = { ...this.stats, ...stats };

    if (!this.statsContainer) return;

    // Update各个统计卡片
    this.updateStatValue("total", this.stats.totalProcessed.toString());
    this.updateStatValue("today", this.stats.todayProcessed.toString());
    this.updateStatValue("pending", this.stats.pendingCount.toString());
    this.updateStatValue(
      "success-rate",
      `${this.stats.successRate.toFixed(1)}%`,
    );
    this.updateStatValue("avg-time", `${this.stats.averageTime.toFixed(0)}s`);
    this.updateStatValue("failed", this.stats.failedCount.toString());
  }

  /**
   * Update单个统计值
   *
   * @private
   */
  private updateStatValue(id: string, value: string): void {
    const statCard = this.statsContainer?.querySelector(`#stat-${id}`);
    if (statCard) {
      const valueElement = statCard.querySelector(".stat-value");
      if (valueElement) {
        valueElement.textContent = value;
      }
    }
  }

  /**
   * 添加最近活动
   *
   * @param activity 活动数据
   */
  public addRecentActivity(activity: RecentActivity): void {
    this.recentActivities.unshift(activity);

    // 只保留最近 20 条
    if (this.recentActivities.length > 20) {
      this.recentActivities = this.recentActivities.slice(0, 20);
    }

    this.renderRecentActivities();
  }

  /**
   * 渲染最近活动列表
   *
   * @private
   */
  private renderRecentActivities(): void {
    const activityList =
      this.activityContainer?.querySelector("#activity-list");
    if (!activityList) return;

    activityList.innerHTML = "";

    if (this.recentActivities.length === 0) {
      const emptyMsg = this.createElement("div", {
        styles: {
          textAlign: "center",
          padding: "40px 20px",
          color: "#9e9e9e",
          fontSize: "14px",
        },
        textContent: "No recent activities",
      });
      activityList.appendChild(emptyMsg);
      return;
    }

    this.recentActivities.forEach((activity) => {
      const activityItem = this.createElement("div", {
        className: "activity-item",
        styles: {
          padding: "12px",
          marginBottom: "8px",
          borderRadius: "6px",
          borderLeft: `3px solid ${activity.status === "success" ? "#4caf50" : "#f44336"}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        },
      });

      const leftContent = this.createElement("div", {
        styles: {
          flex: "1",
        },
      });

      const title = this.createElement("div", {
        styles: {
          fontSize: "13px",
          fontWeight: "600",
          marginBottom: "4px",
          color: "var(--ai-text)",
        },
        textContent: activity.title,
      });

      const time = this.createElement("div", {
        styles: {
          fontSize: "11px",
          color: "var(--ai-text-muted)",
        },
        textContent: this.formatTime(activity.timestamp),
      });

      leftContent.appendChild(title);
      leftContent.appendChild(time);

      const rightContent = this.createElement("div", {
        styles: {
          display: "flex",
          alignItems: "center",
          gap: "10px",
        },
      });

      const duration = this.createElement("span", {
        styles: {
          fontSize: "11px",
          color: "var(--ai-text-muted)",
        },
        textContent: `${activity.duration}s`,
      });

      const statusIcon = this.createElement("span", {
        styles: {
          fontSize: "16px",
        },
        textContent: activity.status === "success" ? "✅" : "❌",
      });

      rightContent.appendChild(duration);
      rightContent.appendChild(statusIcon);

      activityItem.appendChild(leftContent);
      activityItem.appendChild(rightContent);

      activityList.appendChild(activityItem);
    });
  }

  /**
   * 格式化时间
   *
   * @private
   */
  private formatTime(date: Date): string {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;

    return date.toLocaleDateString("en-US");
  }

  /**
   * 处理快捷操作
   *
   * @private
   */
  private async handleQuickAction(action: string): Promise<void> {
    ztoolkit.log(`[AI Butler] Quick action: ${action}`);

    switch (action) {
      case getString("dashboard-button-scan"):
        MainWindow.getInstance().switchTab("scanner");
        break;

      case getString("dashboard-button-start-auto"):
        setPref("autoScan", true);
        AutoScanManager.getInstance().start();
        new ztoolkit.ProgressWindow("AI Butler")
          .createLine({
            text: getString("dashboard-success-auto-started"),
            type: "success",
          })
          .show();
        break;

      case getString("dashboard-button-pause-auto"):
        setPref("autoScan", false);
        AutoScanManager.getInstance().stop();
        new ztoolkit.ProgressWindow("AI Butler")
          .createLine({
            text: getString("dashboard-success-auto-paused"),
            type: "default",
          })
          .show();
        break;

      case getString("dashboard-button-view-queue"):
        // 切换到任务队列标签页
        MainWindow.getInstance().switchTab("tasks");
        break;

      case getString("dashboard-button-clear"):
        this.taskQueueManager.clearCompleted();
        new ztoolkit.ProgressWindow("AI Butler")
          .createLine({
            text: getString("dashboard-success-cleared"),
            type: "success",
          })
          .show();
        this.refreshData();
        break;

      case getString("dashboard-button-settings"):
        MainWindow.getInstance().switchTab("settings");
        break;

      default:
        new ztoolkit.ProgressWindow("AI Butler")
          .createLine({
            text: `Feature under development: ${action}`,
            type: "default",
          })
          .show();
    }
  }

  /**
   * 获取主窗口实例
   *
   * @private
   */
  private getMainWindow(): MainWindow | null {
    // 从全局存储获取主窗口实例
    const win = Zotero.getMainWindow();
    return ((win as any).__aiButlerMainWindow as MainWindow) || null;
  }

  // ==================== 数据Refresh ====================

  /**
   * 启动定时Refresh
   *
   * @private
   */
  private startRefreshTimer(): void {
    if (this.refreshTimerId !== null) {
      return;
    }

    // 每5秒Refresh一次
    this.refreshTimerId = setInterval(() => {
      this.refreshData();
    }, 5000) as any as number;
  }

  /**
   * 停止定时Refresh
   *
   * @private
   */
  private stopRefreshTimer(): void {
    if (this.refreshTimerId !== null) {
      clearInterval(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  /**
   * Refresh所有数据
   *
   * @private
   */
  private refreshData(): void {
    this.taskQueueManager.refreshFromStorage();

    // 获取队列统计数据
    const queueStats = this.taskQueueManager.getStats();

    // 计算管家状态
    const butlerStatus = this.calculateButlerStatus(queueStats);

    // 获取当前处理的任务
    const processingTask = this.taskQueueManager.getTasksByStatus(
      TaskStatus.PROCESSING,
    )[0];

    // Update管家状态
    this.updateButlerStatus(
      butlerStatus,
      processingTask?.title,
      queueStats.pending + queueStats.priority,
    );

    // 计算平均处理时间
    const completedTasks = this.taskQueueManager
      .getAllTasks()
      .filter((t) => t.status === "completed" && t.duration);
    const avgTime =
      completedTasks.length > 0
        ? completedTasks.reduce((sum, t) => sum + (t.duration || 0), 0) /
          completedTasks.length
        : 0;

    // Update统计数据
    this.updateStats({
      totalProcessed: queueStats.completed,
      todayProcessed: this.taskQueueManager.getTodayCompletedCount(),
      pendingCount: queueStats.pending + queueStats.priority,
      failedCount: queueStats.failed,
      successRate: queueStats.successRate,
      averageTime: avgTime,
    });

    // 从队列加载最近活动
    this.loadRecentActivitiesFromQueue();
  }

  /**
   * 计算管家状态
   *
   * @private
   */
  private calculateButlerStatus(stats: QueueStats): ButlerStatus {
    if (stats.processing > 0) {
      return ButlerStatus.WORKING;
    }

    if (stats.failed > 0 && stats.pending === 0 && stats.priority === 0) {
      return ButlerStatus.ERROR;
    }

    return ButlerStatus.IDLE;
  }

  /**
   * 从任务队列加载最近活动
   *
   * @private
   */
  private loadRecentActivitiesFromQueue(): void {
    const allTasks = this.taskQueueManager.getAllTasks();

    // 筛选Completed和Failed的任务
    const finishedTasks = allTasks
      .filter((t) => t.status === "completed" || t.status === "failed")
      .filter((t) => t.completedAt)
      .sort((a, b) => {
        const aTime = a.completedAt?.getTime() || 0;
        const bTime = b.completedAt?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 20);

    // 转换为活动记录
    this.recentActivities = finishedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status:
        task.status === "completed"
          ? ("success" as const)
          : ("failed" as const),
      timestamp: task.completedAt!,
      duration: task.duration || 0,
    }));

    this.renderRecentActivities();
  }

  // ==================== 任务队列事件处理 ====================

  /**
   * 处理任务进度Update
   *
   * @private
   */
  private handleTaskProgress(
    taskId: string,
    progress: number,
    message: string,
  ): void {
    ztoolkit.log(`Task progress: ${taskId} - ${progress}% - ${message}`);

    // Refresh数据以Update状态
    this.refreshData();
  }

  /**
   * 处理任务完成
   *
   * @private
   */
  private handleTaskComplete(
    taskId: string,
    success: boolean,
    error?: string,
  ): void {
    ztoolkit.log(`Task completed: ${taskId} - success=${success}`);

    // 获取任务信息
    const task = this.taskQueueManager.getTask(taskId);
    if (task) {
      // 添加到最近活动
      this.addRecentActivity({
        id: task.id,
        title: task.title,
        status: success ? "success" : "failed",
        timestamp: new Date(),
        duration: task.duration || 0,
      });
    }

    // Refresh数据
    this.refreshData();

    // 显示通知
    if (success) {
      new ztoolkit.ProgressWindow("AI Butler", {
        closeTime: 3000,
      })
        .createLine({
          text: getString("dashboard-task-completed", {
            args: { title: task?.title },
          }),
          type: "success",
        })
        .show();
    } else {
      new ztoolkit.ProgressWindow("AI Butler", {
        closeTime: 5000,
      })
        .createLine({
          text: getString("dashboard-task-failed", {
            args: { title: task?.title },
          }),
          type: "fail",
        })
        .createLine({
          text: error || getString("dashboard-error-unknown"),
          type: "default",
        })
        .show();
    }
  }

  /**
   * 视图显示时的回调
   *
   * @protected
   */
  protected onShow(): void {
    this.refreshData();
  }
}
