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
 * SessionHistoryManager 类 - 管理历史会话
 * 负责保存、加载、删除历史会话
 */
export class SessionHistoryManager {
    private static readonly STORAGE_KEY = 'sema.sessionHistory';
    private static readonly MAX_SESSIONS = 50;  // 所有项目只保留最近的50会话历史
    private context: vscode.ExtensionContext;
    private projectPath: string;
    private semaWrapper: any;

    constructor(context: vscode.ExtensionContext, workingDir: string, semaWrapper: any) {
        this.context = context;
        this.projectPath = workingDir;
        this.semaWrapper = semaWrapper;
    }

    /**
     * 将消息历史中所有 running 状态的 Task 改为 interrupted
     */
    private markRunningTasksAsInterrupted(messages: any[]): void {
        for (const message of messages) {
            if (message.type === 'tool' && message.toolName === 'Task' && message.content?.status === 'running') {
                message.content.status = 'interrupted';
            }
        }
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

        // 将所有 running 状态的 Task 改为 interrupted
        this.markRunningTasksAsInterrupted(messages);
        // console.log('saveSession:', JSON.stringify(messages))

        // 直接从 semaWrapper 读取标题
        const title = this.semaWrapper.title;
        if (!title) {
            return;
        }

        // 获取所有会话（包含所有项目）
        const allSessions = await this.getAllSessionsRaw();

        // 更新现有会话
        const existingIndex = allSessions.findIndex(s => s.projectPath === this.projectPath && s.id === sessionId);
        if (existingIndex !== -1) {
            const existingSession = allSessions[existingIndex];

            // 更新现有会话（保留创建时间）
            allSessions[existingIndex] = {
                id: sessionId,
                title: title,
                createdAt: existingSession.createdAt || Date.now(), // 保留创建时间
                updatedAt: Date.now(), // 更新时间
                content: [...messages],
                projectPath: this.projectPath
            };

            // 保存到存储
            await this.context.globalState.update(SessionHistoryManager.STORAGE_KEY, allSessions);
        }
        // 新会话，添加到会话列表
        else {
            const now = Date.now();
            const session: Session = {
                id: sessionId,
                title: title,
                createdAt: now, // 创建时间
                updatedAt: now, // 更新时间（初始时与创建时间相同）
                content: [...messages],
                projectPath: this.projectPath
            };

            // 添加新会话到所有会话列表
            allSessions.unshift(session);

            // 如果总的会话超过最大数量，删除最旧的
            if (allSessions.length > SessionHistoryManager.MAX_SESSIONS) {
                allSessions.splice(SessionHistoryManager.MAX_SESSIONS);
            }

            // 保存到存储
            await this.context.globalState.update(SessionHistoryManager.STORAGE_KEY, allSessions);
        }
    }

    /**
     * 获取所有会话（不过滤项目，用于内部操作）
     */
    private async getAllSessionsRaw(): Promise<Session[]> {
        return this.context.globalState.get<Session[]>(SessionHistoryManager.STORAGE_KEY, []);
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
     * 获取当前项目的所有会话
     */
    public async getAllSessions(): Promise<Session[]> {
        const allSessions = await this.getAllSessionsRaw();
        const currentSessionId = this.semaWrapper.currentSessionId;
        // console.log(`所有会话: ${allSessions.length}`)

        // 过滤出当前项目的会话
        const projectSessions = allSessions.filter(session => session.projectPath === this.projectPath);

        // 分离当前会话和其他会话
        const currentSession = projectSessions.find(s => s.id === currentSessionId);
        const otherSessions = projectSessions.filter(s => s.id !== currentSessionId);

        // 其他会话按更新时间降序排列
        otherSessions.sort((a, b) => b.updatedAt - a.updatedAt);

        // 当前会话排在第一位，其余按更新时间排序
        return currentSession ? [currentSession, ...otherSessions] : otherSessions;
    }

    /**
     * 根据ID获取特定会话
     */
    public async getSession(sessionId: string): Promise<Session | null> {
        // console.log(`获取会话: ${sessionId}`)
        const allSessions = await this.getAllSessionsRaw();
        const session = allSessions.find(s => s.id === sessionId && s.projectPath === this.projectPath);
        // console.log('getSession:', JSON.stringify(session))
        return session || null;
    }

    /**
     * 删除会话
     */
    public async deleteSession(sessionId: string): Promise<void> {
        console.log(`删除会话: ${sessionId}`)
        const allSessions = await this.getAllSessionsRaw();
        const filteredSessions = allSessions.filter(s => !(s.id === sessionId && s.projectPath === this.projectPath));

        // 只有在实际删除了会话时才更新存储
        if (filteredSessions.length < allSessions.length) {
            await this.context.globalState.update(SessionHistoryManager.STORAGE_KEY, filteredSessions);
        }
    }

    /**
     * 加载历史会话到当前会话
     */
    public async loadSession(sessionId: string): Promise<any[]> {
        console.log(`加载会话: ${sessionId}`)
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error('会话不存在或已被删除');
        }

        // 返回会话内容供调用方使用
        return session.content || [];
    }

    /**
     * 清空当前项目的所有会话历史
     */
    public async clearAllSessions(): Promise<void> {
        console.log(`清空会话: ${this.projectPath}`)
        const allSessions = await this.getAllSessionsRaw();
        const otherProjectSessions = allSessions.filter(s => s.projectPath !== this.projectPath);
        await this.context.globalState.update(SessionHistoryManager.STORAGE_KEY, otherProjectSessions);
    }
}



