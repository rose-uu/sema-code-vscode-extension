import * as vscode from 'vscode';

/**
 * 会话数据结构
 */
export interface Session {
    id: string;
    title: string;
    createdAt: number; // 创建时间
    updatedAt: number; // 更新时间
    content: any[]; // 消息历史数组
    projectPath: string; // 项目路径，用于区分不同项目的会话
    jsonPath?: string; // JSON文件路径（兼容旧版本）
}

/**
 * 按项目存储的数据结构
 */
interface ProjectData {
    projectPath: string;
    lastUpdatedAt: number; // 项目最后更新时间，用于淘汰旧项目
    sessions: Session[];
}

/**
 * SessionHistoryManager 类 - 管理历史会话
 * 负责保存、加载、删除历史会话
 * 存储结构：按项目分组，最多保留 MAX_PROJECTS 个项目，每个项目最多 MAX_SESSIONS 条记录
 */
export class SessionHistoryManager {
    private static readonly STORAGE_KEY = 'sema.sessionHistoryV2';
    private static readonly MAX_SESSIONS = 50;  // 每个项目最多保留50条会话历史
    private static readonly MAX_PROJECTS = 20;  // 最多保留20个项目
    private context: vscode.ExtensionContext;
    private projectPath: string;
    private semaWrapper: any;

    constructor(context: vscode.ExtensionContext, workingDir: string, semaWrapper: any) {
        this.context = context;
        this.projectPath = workingDir;
        this.semaWrapper = semaWrapper;
    }

    /**
     * 将消息历史中所有 running 状态的 Task 改为 interrupted（返回新数组，不修改原对象）
     */
    private markRunningTasksAsInterrupted(messages: any[]): any[] {
        return messages.map(message => {
            if (message.type === 'tool' && message.toolName === 'Task' && message.content?.status === 'running') {
                return { ...message, content: { ...message.content, status: 'interrupted' } };
            }
            return message;
        });
    }

    /**
     * 过滤掉不完整的assistant消息（如thinking过程中中断产生的消息）
     * 不完整的消息特征：type === 'assistant' && content.completed !== true && content为空
     */
    private filterIncompleteMessages(messages: any[]): any[] {
        return messages.filter(message => {
            // 保留非assistant类型的消息
            if (message.type !== 'assistant') {
                return true;
            }
            // 对于assistant类型，只过滤掉未完成且content为空的消息
            const isCompleted = message.content?.completed === true;
            const hasContent = message.content?.content && message.content.content.length > 0;
            // 保留已完成的消息，或者有内容的消息
            return isCompleted || hasContent;
        });
    }

    /**
     * 保存会话到历史记录
     */
    public async saveSession(messageHistory?: any[]): Promise<void> {
        const sessionId = this.semaWrapper.currentSessionId;
        console.log(`保存会话到历史记录: ${sessionId}`)
        let messages = messageHistory || this.semaWrapper.messageHistory || [];

        // 如果内容为空，不保存
        if (!sessionId || messages.length === 0) {
            return;
        }

        // 过滤掉不完整的assistant消息（如thinking过程中中断产生的消息）
        messages = this.filterIncompleteMessages(messages);

        // 过滤后如果为空，不保存
        if (messages.length === 0) {
            return;
        }

        // 将所有 running 状态的 Task 改为 interrupted（返回新数组，不污染原始消息历史）
        messages = this.markRunningTasksAsInterrupted(messages);

        // 直接从 semaWrapper 读取标题
        const title = this.semaWrapper.title;
        if (!title) {
            return;
        }

        const now = Date.now();
        const allProjects = await this.getAllProjectsRaw();

        // 查找当前项目
        let projectIndex = allProjects.findIndex(p => p.projectPath === this.projectPath);
        if (projectIndex === -1) {
            // 新项目：如果超过最大项目数，删除最旧的项目
            if (allProjects.length >= SessionHistoryManager.MAX_PROJECTS) {
                allProjects.sort((a, b) => a.lastUpdatedAt - b.lastUpdatedAt);
                allProjects.splice(0, allProjects.length - SessionHistoryManager.MAX_PROJECTS + 1);
            }
            allProjects.push({ projectPath: this.projectPath, lastUpdatedAt: now, sessions: [] });
            projectIndex = allProjects.length - 1;
        }

        const projectData = allProjects[projectIndex];
        const existingIndex = projectData.sessions.findIndex(s => s.id === sessionId);

        if (existingIndex !== -1) {
            // 更新现有会话（保留创建时间）
            projectData.sessions[existingIndex] = {
                id: sessionId,
                title: title,
                createdAt: projectData.sessions[existingIndex].createdAt || now,
                updatedAt: now,
                content: [...messages],
                projectPath: this.projectPath
            };
        } else {
            // 新会话，添加到头部
            const session: Session = {
                id: sessionId,
                title: title,
                createdAt: now,
                updatedAt: now,
                content: [...messages],
                projectPath: this.projectPath
            };
            projectData.sessions.unshift(session);

            // 超过每项目最大数量，删除最旧的
            if (projectData.sessions.length > SessionHistoryManager.MAX_SESSIONS) {
                projectData.sessions.splice(SessionHistoryManager.MAX_SESSIONS);
            }
        }

        projectData.lastUpdatedAt = now;
        await this.context.globalState.update(SessionHistoryManager.STORAGE_KEY, allProjects);
    }

    /**
     * 获取所有项目数据（内部使用）
     */
    private async getAllProjectsRaw(): Promise<ProjectData[]> {
        return this.context.globalState.get<ProjectData[]>(SessionHistoryManager.STORAGE_KEY, []);
    }

    /**
     * 获取当前项目数据
     */
    private async getCurrentProjectData(): Promise<ProjectData | null> {
        const allProjects = await this.getAllProjectsRaw();
        return allProjects.find(p => p.projectPath === this.projectPath) || null;
    }

    /**
     * 格式化时间显示
     */
    public static formatTime(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;
        const dayInMs = 24 * 60 * 60 * 1000;

        if (diff < dayInMs) {
            return '今天';
        } else if (diff < 2 * dayInMs) {
            return '1天前';
        } else if (diff < 3 * dayInMs) {
            return '2天前';
        } else if (diff < 4 * dayInMs) {
            return '3天前';
        } else {
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        }
    }

    /**
     * 获取当前激活的会话ID
     */
    public getCurrentSessionId(): string | null {
        return this.semaWrapper.currentSessionId;
    }

    /**
     * 获取当前项目的所有会话
     */
    public async getAllSessions(): Promise<Session[]> {
        const projectData = await this.getCurrentProjectData();
        const currentSessionId = this.semaWrapper.currentSessionId;

        if (!projectData) {
            return [];
        }

        const sessions = projectData.sessions;

        // 分离当前会话和其他会话
        const currentSession = sessions.find(s => s.id === currentSessionId);
        const otherSessions = sessions.filter(s => s.id !== currentSessionId);

        // 其他会话按更新时间降序排列
        otherSessions.sort((a, b) => b.updatedAt - a.updatedAt);

        // 当前会话排在第一位，其余按更新时间排序
        return currentSession ? [currentSession, ...otherSessions] : otherSessions;
    }

    /**
     * 根据ID获取特定会话
     */
    public async getSession(sessionId: string): Promise<Session | null> {
        const projectData = await this.getCurrentProjectData();
        if (!projectData) {
            return null;
        }
        return projectData.sessions.find(s => s.id === sessionId) || null;
    }

    /**
     * 删除会话
     */
    public async deleteSession(sessionId: string): Promise<void> {
        console.log(`删除会话: ${sessionId}`)
        const allProjects = await this.getAllProjectsRaw();
        const projectIndex = allProjects.findIndex(p => p.projectPath === this.projectPath);
        if (projectIndex === -1) {
            return;
        }

        const projectData = allProjects[projectIndex];
        const originalLength = projectData.sessions.length;
        projectData.sessions = projectData.sessions.filter(s => s.id !== sessionId);

        if (projectData.sessions.length < originalLength) {
            await this.context.globalState.update(SessionHistoryManager.STORAGE_KEY, allProjects);
        }
    }

    /**
     * 清空当前项目的所有会话历史
     */
    public async clearAllSessions(): Promise<void> {
        console.log(`清空会话: ${this.projectPath}`)
        const allProjects = await this.getAllProjectsRaw();
        const filtered = allProjects.filter(p => p.projectPath !== this.projectPath);
        await this.context.globalState.update(SessionHistoryManager.STORAGE_KEY, filtered);
    }
}



