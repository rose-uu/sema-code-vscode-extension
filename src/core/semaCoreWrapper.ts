import { SemaCore } from 'sema-core';
import {
    MessageCompleteData,
    StateUpdateData,
    ThinkingChunkData,
    TextChunkData,
    SessionReadyData,
    SessionErrorData,
    SessionInterruptedData,
    ToolPermissionRequestData,
    ToolPermissionResponse,
    ToolExecutionCompleteData,
    ToolExecutionErrorData,
    TodosUpdateData,
    TopicUpdateData,
    ConversationUsageData,
    CompactExecData,
    TaskAgentStartData,
    TaskAgentEndData,
    AskQuestionRequestData,
    AskQuestionResponseData,
    PlanExitRequestData,
    PlanExitResponseData,
    PlanImplementData,
    FileReferenceData,
    MCPServerStatusData
} from 'sema-core/event';
import {
    SemaCoreConfig,
    ModelConfig,
    TaskConfig,
    FetchModelsParams,
    FetchModelsResult,
    ApiTestParams,
    ApiTestResult,
    ModelUpdateData,
    UpdatableCoreConfig,
    ToolInfo,
    MAIN_AGENT_ID,
    MarketplacePluginsInfo,
    PluginScope,
    AgentConfig,
    SkillConfig,
    CommandConfig,
    MCPServerConfig,
    MCPServerInfo
} from 'sema-core/types';

import { SystemConfigManager } from '../managers/SystemConfigManager';


// 定义回调函数类型
export interface SemaWrapperCallbacks {
    onSessionReady?: (data: SessionReadyData) => void;
    onModelUpdate?: (data: ModelUpdateData) => void;
    onStateChange?: (state: 'idle' | 'processing') => void;

    onMessage?: (message: any) => void;
    onMessageComplete?: () => void;
    onToolPermissionRequest?: (data: ToolPermissionRequestData) => void;
    onAskQuestionRequest?: (data: AskQuestionRequestData) => void;
    onPlanExitRequest?: (data: PlanExitRequestData) => void;
    onPlanImplement?: (data: PlanImplementData) => void;
    onUsageUpdate?: (data: ConversationUsageData) => void;
    onTodosUpdate?: (todos: TodosUpdateData) => void;
    onTopicUpdate?: (topic: TopicUpdateData) => void;
    onMCPServerStatus?: (data: MCPServerStatusData) => void;
}

export interface Message {
    type: 'user' | 'assistant' | 'tool' | 'system' | 'permission_request';
    content: any;
    timestamp: number;
    toolName?: string;
    toolArgs?: any;
    reasoning?: string;
}

// Task 工具消息内容类型
export interface TaskMessageContent {
    taskId: string;              // 子代理唯一标识
    subagent_type: string;       // Explore | Plan 等
    description: string;         // 任务简短描述（3-5个词）
    prompt: string;              // 任务prompt
    status: 'running' | 'completed' | 'failed' | 'interrupted';
    summary: string;             // 实时结果摘要
    taskMessages: Message[];     // 完整消息历史（用于弹窗展示）
}

/**
 * SemaCoreWrapper 类 - 封装 SemaCore 的使用逻辑
 */
export class SemaCoreWrapper {
    private semaCore: SemaCore;
    private currentState: 'idle' | 'processing' = 'idle';
    public currentSessionId: string | null = null; // 公开访问以便SessionHistoryManager使用
    public title: string = ''; // 会话标题，公开访问以便SessionHistoryManager使用
    private systemConfigManager: SystemConfigManager;

    // 消息历史存储
    public messageHistory: Array<Message> = []; // 公开访问以便SessionHistoryManager使用

    // 跟踪当前正在构建的消息引用，避免重复查找
    private currentStreamingMessage: Message | null = null;

    // 子代理任务管理：taskId -> 主消息历史中的消息引用
    private taskAgentMap: Map<string, Message> = new Map();

    constructor(workingDir: string, private callbacks: SemaWrapperCallbacks, systemConfigManager: SystemConfigManager) {
        this.systemConfigManager = systemConfigManager;

        // 加载系统配置
        const systemConfig = this.systemConfigManager.getSystemConfig();

        // 加载 useTools 配置
        const useTools = this.systemConfigManager.getUseTools();

        // console.log('systemConfig:', systemConfig);
        // console.log('useTools:', useTools);

        const config: SemaCoreConfig = {
            workingDir,
            logLevel: 'debug',
            ...systemConfig,
            useTools: useTools
        };

        this.semaCore = new SemaCore(config);

        this.setupEventListeners();
    }


    /**
     * 创建新会话或加载历史会话
     */
    public async createSession(sessionId?: string): Promise<void> {
        await this.semaCore.createSession(sessionId);
    }

    /**
     * 处理用户输入
     */
    public processUserInput(content: string, orgContent?: string): void {
        // 如果历史消息为空，从用户输入中生成标题
        if (this.messageHistory.length === 0) {
            let title = orgContent ? orgContent.trim() : content.trim();
            if (title.length > 50) {
                title = title.substring(0, 50) + '...';
            }
            this.title = title || '新对话';
            // console.log(`生成会话标题: ${this.title}`);
        }

        // 添加用户消息到历史记录
        this.messageHistory.push({
            type: 'user',
            content: orgContent || content,
            timestamp: Date.now()
        });
        this.sendContentUpdate();

        // 调用 sema-core 处理用户输入（文件引用通过 file:reference 事件返回）
        this.semaCore.processUserInput(content, orgContent);
    }

    /**
     * 中断会话
     */
    public interruptSession(): void {
        // 只有当状态为processing才发送打断
        if (this.currentState === 'processing') {
            this.semaCore.interruptSession();
        } else {
            // console.log('Session not in processing state, interrupt ignored');
        }
    }

    /**
     * 中断会话并等待完成
     * @param timeout 超时时间（毫秒）
     * @returns 是否成功完成中断
     */
    public async interruptAndWait(timeout: number = 2000): Promise<boolean> {
        // 如果当前不是 processing 状态，直接返回
        if (this.currentState !== 'processing') {
            return true;
        }

        // 发送中断信号
        this.semaCore.interruptSession();

        // 等待状态变为 idle
        const isIdle = await this.waitForIdle(timeout);
        if (!isIdle) {
            return false;
        }

        // 状态变为 idle 后再等待 300ms 确保稳定
        await new Promise(resolve => setTimeout(resolve, 300));
        return true;
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        // 监听会话生命周期事件
        this.semaCore.on<SessionReadyData>('session:ready', (data) => {
            // console.log('Session ready:', data);
            this.currentSessionId = data.sessionId;
            this.callbacks.onSessionReady?.(data);
        });

        // 监听文件引用事件
        this.semaCore.on<FileReferenceData>('file:reference', (data) => {
            // console.log('File reference:', data);
            if (data.references && data.references.length > 0) {
                this.messageHistory.push({
                    type: 'system',
                    content: {
                        type: 'file_reference',
                        content: data.references.map(ref => ref.content)
                    },
                    timestamp: Date.now()
                });
                this.sendContentUpdate();
            }
        });

        this.semaCore.on<SessionInterruptedData & { agentId?: string }>('session:interrupted', (data) => {
            // console.log('Session interrupted:', data);

            const USER_INTERRUPT_MESSAGE = '[Request interrupted by user]';
            const interruptType = data.content === USER_INTERRUPT_MESSAGE ? 'interrupt' : 'interrupt_by_tool';

            // 检查是否为子代理消息
            const agentId = data.agentId;
            if (agentId && agentId !== MAIN_AGENT_ID) {
                // 子代理中断，添加到对应的 taskMessages 中
                this.addMessageToTaskAgent(agentId, {
                    type: 'system',
                    content: {
                        'type': interruptType,
                        'content': data.content
                    },
                    timestamp: Date.now()
                });
                return;
            }

            // 主代理中断时清除流式消息缓存，避免下次流式覆盖之前的消息
            this.currentStreamingMessage = null;

            // 主代理中断，将中断消息添加到主消息历史中
            // 若消息历史为空，则不插入中断消息
            if (this.messageHistory.length === 0) {
                return;
            }

            this.messageHistory.push({
                type: 'system',
                content: {
                    'type': interruptType,
                    'content': data.content
                },
                timestamp: Date.now()
            });

            this.sendContentUpdate();
        });

        this.semaCore.on<SessionErrorData>('session:error', (data) => {
            console.error('Session error:', data);
            const errorMessage = data.error?.message || 'Unknown error';
            this.messageHistory.push({
                type: 'system',
                content: {
                    type: 'session_error',
                    content: `Error: [${data.type}]${errorMessage}`,
                    errorType: data.type
                },
                timestamp: Date.now()
            });
            this.sendContentUpdate();
        });

        // 监听状态更新事件
        this.semaCore.on<StateUpdateData>('state:update', (data) => {
            // console.log('State update:', data);
            this.currentState = data.state;
            this.callbacks.onStateChange?.(data.state);
        });

        // 监听AI思考流式事件
        this.semaCore.on<ThinkingChunkData>('message:thinking:chunk', (data) => {
            // 使用缓存的消息引用
            if (this.currentStreamingMessage && this.currentStreamingMessage.type === 'assistant') {
                // thinking 类型只更新 reasoning 字段，不发送更新（避免频繁渲染）
                this.currentStreamingMessage.reasoning = data.content;
                return;
            }

            // 创建新消息并缓存引用
            const newMessage: Message = {
                type: 'assistant',
                content: {
                    messageType: 'text',
                    content: '',
                    completed: false
                },
                reasoning: data.content,
                timestamp: Date.now()
            };

            this.currentStreamingMessage = newMessage;
            this.messageHistory.push(newMessage);
            // 第一次 thinking 消息发送更新，用于创建 ThoughtBlock/显示计时器
            this.sendContentUpdate();
        });

        // 监听AI文本流式事件
        this.semaCore.on<TextChunkData>('message:text:chunk', (data) => {
            // 使用缓存的消息引用
            if (this.currentStreamingMessage && this.currentStreamingMessage.type === 'assistant') {
                // text 类型更新到 content 字段
                this.currentStreamingMessage.content = {
                    messageType: 'text',
                    content: data.content,
                    completed: false
                };
                // text 阶段发送更新，此时 reasoning 已累积完成
                this.sendContentUpdate();
                return;
            }

            // 创建新消息并缓存引用（没有 thinking 直接开始 text 的情况）
            const newMessage: Message = {
                type: 'assistant',
                content: {
                    messageType: 'text',
                    content: data.content,
                    completed: false
                },
                timestamp: Date.now()
            };

            this.currentStreamingMessage = newMessage;
            this.messageHistory.push(newMessage);
            this.sendContentUpdate();
        });

        this.semaCore.on<MessageCompleteData & { agentId?: string }>('message:complete', (data) => {
            // console.log('AI response complete:', data);

            // 如果 content 为空且没有 reasoning 且没有工具调用，则不处理此消息
            // 注意：可能只有 thinking 和工具调用，没有 text 内容
            if (!data.content && !data.reasoning && !data.hasToolCalls) {
                this.currentStreamingMessage = null;
                return;
            }

            // 检查是否为子代理消息
            const agentId = data.agentId;
            if (agentId && agentId !== MAIN_AGENT_ID) {
                // 子代理消息，添加到对应的 taskMessages 中
                this.addMessageToTaskAgent(agentId, {
                    type: 'assistant',
                    content: {
                        messageType: 'text',
                        content: data.content,
                        completed: true,
                        hasToolCalls: data.hasToolCalls,
                    },
                    reasoning: data.reasoning,
                    timestamp: Date.now()
                });
                return;
            }

            // 主代理消息处理
            let messageUpdated = false;

            // 先尝试使用缓存的消息引用
            if (this.currentStreamingMessage && this.currentStreamingMessage.type === 'assistant') {
                const message = this.currentStreamingMessage;
                // 只有当 data.content 存在时才更新 content 字段
                if (data.content) {
                    message.content = {
                        messageType: message.content.messageType || 'text',
                        content: data.content,
                        completed: true,
                        hasToolCalls: data.hasToolCalls,
                    };
                } else {
                    // 没有 text 内容，只标记为完成
                    message.content.completed = true;
                    message.content.hasToolCalls = data.hasToolCalls;
                }
                // 更新 reasoning 字段（如果存在）
                if (data.reasoning) {
                    message.reasoning = data.reasoning;
                }
                messageUpdated = true;
            }

            // 如果没有找到对应的流式消息，直接创建新消息
            if (!messageUpdated) {
                console.warn('No streaming message found, creating new complete message');
                const newMessage: Message = {
                    type: 'assistant',
                    content: {
                        messageType: 'text',
                        content: data.content,
                        completed: true,
                        hasToolCalls: data.hasToolCalls,
                    },
                    timestamp: Date.now()
                };
                // 添加 reasoning 字段（如果存在）
                if (data.reasoning) {
                    newMessage.reasoning = data.reasoning;
                }
                this.messageHistory.push(newMessage);
                messageUpdated = true;
            }

            // 清除缓存的消息引用
            this.currentStreamingMessage = null;

            if (messageUpdated) {
                this.sendContentUpdate();
                // 消息完成后触发回调（用于保存会话等操作）
                this.callbacks.onMessageComplete?.();
            }
        });

        // 监听工具相关事件
        this.semaCore.on<ToolPermissionRequestData>('tool:permission:request', (data) => {
            // console.log('Tool permission request:', data);
            this.callbacks.onToolPermissionRequest?.(data);
        });

        this.semaCore.on<ToolExecutionCompleteData & { agentId?: string }>('tool:execution:complete', (data) => {
            // console.log('Tool execution complete:', data);

            // 检查是否为子代理消息
            const agentId = data.agentId;
            if (agentId && agentId !== MAIN_AGENT_ID) {
                // 子代理工具执行完成，添加到对应的 taskMessages 中
                this.addMessageToTaskAgent(agentId, {
                    type: 'tool',
                    content: data,
                    toolName: data.toolName,
                    timestamp: Date.now()
                });
                return;
            }

            // 主代理工具执行完成，跳过 Task 工具（Task 工具通过 task:agent:start/end 事件处理）
            if (data.toolName === 'Task') {
                return;
            }

            this.messageHistory.push({
                type: 'tool',
                content: data,
                toolName: data.toolName,
                timestamp: Date.now()
            });
            this.sendContentUpdate();
        });

        this.semaCore.on<ToolExecutionErrorData & { agentId?: string }>('tool:execution:error', (data) => {
            console.error('Tool execution error:', data);

            // 检查是否为子代理消息
            const agentId = data.agentId;
            if (agentId && agentId !== MAIN_AGENT_ID) {
                // 子代理工具执行错误，添加到对应的 taskMessages 中
                this.addMessageToTaskAgent(agentId, {
                    type: 'system',
                    content: {
                        'type': 'tool_error',
                        'content': data.content,
                        'toolName': data.toolName,
                        'title': data.title
                    },
                    toolName: data.toolName,
                    timestamp: Date.now()
                });
                return;
            }

            // 主代理工具执行错误
            this.messageHistory.push({
                type: 'system',
                content: {
                    'type': 'tool_error',
                    'content': data.content,
                    'toolName': data.toolName,
                    'title': data.title
                },
                timestamp: Date.now()
            });
            this.sendContentUpdate();
        });

        // 监听todos和topic更新事件
        this.semaCore.on<TodosUpdateData>('todos:update', (data) => {
            // console.log('Todos update:', data);
            this.callbacks.onTodosUpdate?.(data);
        });

        this.semaCore.on<TopicUpdateData>('topic:update', (data) => {
            // console.log('Topic update:', data);

            // 只有当标题真正发生变化时才触发回调
            if (data.title && data.title.trim() && this.title !== data.title) {
                this.title = data.title; // 先更新内部标题
                this.callbacks.onTopicUpdate?.(data);
            }
        });

        // 监听使用统计事件
        this.semaCore.on<ConversationUsageData>('conversation:usage', (data) => {
            // console.log('Conversation usage:', data);
            this.callbacks.onUsageUpdate?.(data);
        });

        // 监听模型压缩事件
        this.semaCore.on<CompactExecData>('compact:exec', (data) => {
            // console.log('Compact exec:', data);

            let finalContent = '';

            // 检查是否有错误信息
            if (data.errMsg && data.errMsg.trim() !== '') {
                // 如果有错误信息，使用错误信息作为内容
                finalContent = `Compacted: ${data.errMsg}`;
            } else {
                finalContent = `Compacted`;
            }

            this.messageHistory.push({
                type: 'system',
                content: {
                    'type': 'compact',
                    'content': finalContent
                },
                timestamp: Date.now()
            });
            this.sendContentUpdate();
        });

        // 监听会话清除事件
        this.semaCore.on<{ sessionId: string | null }>('session:cleared', (data) => {
            // console.log('Session cleared:', data);
            this.clearMessageHistory();
            // 恢复标题以便保存时能正确标识会话
            this.title = '新会话';
            this.messageHistory.push({
                type: 'user',
                content: '/clear',
                timestamp: Date.now()
            });
            this.messageHistory.push({
                type: 'system',
                content: {
                    'type': 'clear',
                    'content': '(no content)'
                },
                timestamp: Date.now()
            });
            this.sendContentUpdate();
            // 清空后触发保存，使历史记录同步更新为已清空状态
            this.callbacks.onMessageComplete?.();
        });

        // 监听问答请求事件
        this.semaCore.on<AskQuestionRequestData>('ask:question:request', (data) => {
            // console.log('Ask question request:', data);
            this.callbacks.onAskQuestionRequest?.(data);
        });

        // 监听退出Plan模式请求事件
        this.semaCore.on<PlanExitRequestData>('plan:exit:request', (data) => {
            // console.log('Plan exit request:', data);
            this.callbacks.onPlanExitRequest?.(data);
        });

        // 监听计划实施事件
        this.semaCore.on<PlanImplementData>('plan:implement', (data) => {
            // console.log('Plan implement:', data);
            // 将计划实施信息添加到消息历史
            this.messageHistory.push({
                type: 'system',
                content: {
                    type: 'plan_implement',
                    planFilePath: data.planFilePath,
                    planContent: data.planContent
                },
                timestamp: Date.now()
            });
            this.sendContentUpdate();
        });

        // 监听 MCP 服务状态变更事件
        this.semaCore.on<MCPServerStatusData>('mcp:server:status', (data) => {
            this.callbacks.onMCPServerStatus?.(data);
        });

        // 监听子代理事件
        this.semaCore.on<TaskAgentStartData>('task:agent:start', (data) => {
            // console.log('Task agent start:', data);
            this.handleTaskAgentStart(data);
        });

        this.semaCore.on<TaskAgentEndData>('task:agent:end', (data) => {
            // console.log('Task agent end:', data);
            this.handleTaskAgentEnd(data);
        });
    }

    /**
     * 发送内容更新到回调函数
     */
    private sendContentUpdate(): void {
        this.callbacks.onMessage?.({
            type: 'updateContent',
            messages: [...this.messageHistory]
        });
    }

    /**
     * 处理子代理开始事件
     */
    private handleTaskAgentStart(data: TaskAgentStartData): void {
        // 创建用户输入消息（prompt）作为 taskMessages 的第一条
        const userMessage: Message = {
            type: 'user',
            content: data.prompt,
            timestamp: Date.now()
        };

        // 创建 Task 工具消息
        const taskMessage: Message = {
            type: 'tool',
            toolName: 'Task',
            content: {
                taskId: data.taskId,
                subagent_type: data.subagent_type,
                description: data.description,
                prompt: data.prompt,
                status: 'running',
                summary: data.prompt, // 初始摘要显示 prompt
                taskMessages: [userMessage] // 初始包含用户输入
            } as TaskMessageContent,
            timestamp: Date.now()
        };

        // 添加到主消息历史
        this.messageHistory.push(taskMessage);

        // 记录 taskId 到消息引用的映射
        this.taskAgentMap.set(data.taskId, taskMessage);

        this.sendContentUpdate();
    }

    /**
     * 处理子代理结束事件
     */
    private handleTaskAgentEnd(data: TaskAgentEndData): void {
        const taskMessage = this.taskAgentMap.get(data.taskId);
        if (!taskMessage || taskMessage.toolName !== 'Task') {
            console.warn(`Task agent end: taskId ${data.taskId} not found`);
            return;
        }

        const taskContent = taskMessage.content as TaskMessageContent;
        taskContent.status = data.status;

        // 使用 TaskAgentEndData 的 content 作为最终摘要
        taskContent.summary = data.content;

        this.sendContentUpdate();

        // 清理映射（保留一段时间以防延迟消息）
        // 这里不立即删除，让 dispose 时统一清理
    }

    /**
     * 添加消息到子代理的 taskMessages
     */
    private addMessageToTaskAgent(taskId: string, message: Message): void {
        const taskMessage = this.taskAgentMap.get(taskId);
        if (!taskMessage || taskMessage.toolName !== 'Task') {
            console.warn(`addMessageToTaskAgent: taskId ${taskId} not found`);
            return;
        }

        const taskContent = taskMessage.content as TaskMessageContent;
        taskContent.taskMessages.push(message);

        // 实时更新摘要
        taskContent.summary = this.generateTaskSummary(taskContent);

        this.sendContentUpdate();
    }

    /**
     * 生成任务摘要
     * 规则：最近的2个工具调用标题 + '\nUsed N tools'
     * 若工具不足2个，显示 prompt 内容 + 工具调用标题
     *
     * 工具显示格式：
     * - Glob、Grep → Search(${title})
     * - 其他 → ${toolName}(${title})
     */
    private generateTaskSummary(taskContent: TaskMessageContent): string {
        const toolMessages = taskContent.taskMessages.filter(m => m.type === 'tool');
        const toolCount = toolMessages.length;

        // 格式化单个工具显示
        const formatToolDisplay = (m: Message): string => {
            const toolName = m.toolName || 'Unknown Tool';
            const content = m.content || {};
            const title = content.title || '';

            // Glob、Grep 统一映射为 Search
            if (toolName === 'Glob' || toolName === 'Grep') {
                return `Search(${title})`;
            }

            // 其他工具使用默认格式
            return title ? `${toolName}(${title})` : toolName;
        };

        // 获取最近的2个工具调用标题
        const recentTools = toolMessages.slice(-2);
        const toolTitles = recentTools.map(formatToolDisplay).join('\n');

        let summary = ''
        if (toolCount < 2) {
            // 工具不足2个，显示 prompt + 工具标题
            summary = `${taskContent.prompt}\n${toolTitles}`;
        }
        else {
            // 工具数量 >= 2，显示最近2个工具标题 + 工具总数
            summary = `${toolTitles}\nUsed ${toolCount} tools`;
        }
        return summary
    }

    /**
     * 响应工具权限请求
     */
    public respondToToolPermission(response: ToolPermissionResponse): void {
        // {toolName: "", selected: "agree/allow/refuse或实际填的值"}
        this.semaCore.respondToToolPermission(response);
    }

    /**
     * 响应问答请求
     */
    public respondToAskQuestion(response: AskQuestionResponseData): void {
        this.semaCore.respondToAskQuestion(response);
    }

    /**
     * 响应退出Plan模式请求
     */
    public respondToPlanExit(response: PlanExitResponseData): void {
        this.semaCore.respondToPlanExit(response);
    }

    /**
     * 更新消息历史
     */
    public updateMessageHistory(message: Message[]): void {
        // console.log('更新消息历史')
        this.messageHistory = message;
        this.sendContentUpdate();
    }

    /**
     * 更新会话标题
     */
    public updateTitle(title: string): void {
        // console.log('更新会话标题:', title);
        this.title = title;
    }

    /**
     * 清空消息历史
     */
    public clearMessageHistory(): void {
        // console.log('清空消息历史')
        this.messageHistory = [];
        this.title = '';
        this.taskAgentMap.clear(); // 清理子代理映射
        this.sendContentUpdate();
    }

    /**
     * 获取当前消息历史的副本
     */
    public getMessageHistory(): any[] {
        return [...this.messageHistory];
    }

    // ===== 模型管理相关方法 =====

    /**
     * 添加新模型
     */
    public async addModel(config: ModelConfig, skipValidation?: boolean): Promise<ModelUpdateData> {
        const result = await this.semaCore.addModel(config, skipValidation);
        // 主动触发模型更新回调
        this.callbacks.onModelUpdate?.(result);
        return result;
    }

    /**
     * 删除模型
     */
    public async deleteModel(modelName: string): Promise<ModelUpdateData> {
        const result = await this.semaCore.delModel(modelName);
        // 主动触发模型更新回调
        this.callbacks.onModelUpdate?.(result);
        return result;
    }

    /**
     * 切换当前模型
     */
    public async switchModel(modelName: string): Promise<ModelUpdateData> {
        const result = await this.semaCore.switchModel(modelName);
        // 主动触发模型更新回调
        this.callbacks.onModelUpdate?.(result);
        return result;
    }

    /**
     * 应用任务模型配置
     */
    public async applyTaskModel(config: TaskConfig): Promise<ModelUpdateData> {
        const result = await this.semaCore.applyTaskModel(config);
        // 主动触发模型更新回调
        this.callbacks.onModelUpdate?.(result);
        return result;
    }

    /**
     * 获取模型信息
     */
    public async getModelData(): Promise<ModelUpdateData> {
        return await this.semaCore.getModelData();
    }

    // ===== 独立工具函数（不依赖会话状态）=====

    /**
     * 获取可用模型列表（独立于会话）
     */
    public async fetchAvailableModels(params: FetchModelsParams): Promise<FetchModelsResult> {
        return await this.semaCore.fetchAvailableModels(params);
    }

    /**
     * 测试API连接（独立于会话）
     */
    public async testApiConnection(params: ApiTestParams): Promise<ApiTestResult> {
        return await this.semaCore.testApiConnection(params);
    }

    /**
     * 获取模型适配器类型
     */
    public getModelAdapter(provider: string, modelName: string): string | undefined {
        return this.semaCore.getModelAdapter(provider, modelName);
    }

    // ===== 工具管理相关方法 =====

    /**
     * 获取所有可用工具名称列表
     */
    public getToolInfos(): ToolInfo[] {
        const toolInfos = this.semaCore.getToolInfos();
        const toolNames = toolInfos.map(tool => tool.name).join(', ');
        // console.log(`从core获取Tools: ${toolNames}`);
        return toolInfos;
    }

    /**
     * 更新系统内置使用的工具列表
     */
    public async updateUseTools(toolNames: string[] | null): Promise<void> {
        // console.log(`触发core.updateUseTools: ${toolNames}`)
        await this.systemConfigManager.saveUseTools(toolNames);
        this.semaCore.updateUseTools(toolNames);
    }

    /**
     * 获取当前状态
     */
    public getCurrentState(): 'idle' | 'processing' {
        return this.currentState;
    }

    /**
     * 等待状态变为idle
     * @param timeout 超时时间（毫秒），默认5000ms
     * @returns 是否成功等待到idle状态
     */
    public waitForIdle(timeout: number = 5000): Promise<boolean> {
        return new Promise((resolve) => {
            // 如果当前已经是idle状态，直接返回
            if (this.currentState === 'idle') {
                resolve(true);
                return;
            }

            let timeoutId: NodeJS.Timeout;

            // 监听状态变化
            const stateHandler = (data: { state: 'idle' | 'processing' }) => {
                if (data.state === 'idle') {
                    clearTimeout(timeoutId);
                    this.semaCore.off('state:update', stateHandler);
                    resolve(true);
                }
            };

            this.semaCore.on('state:update', stateHandler);

            // 设置超时
            timeoutId = setTimeout(() => {
                this.semaCore.off('state:update', stateHandler);
                resolve(false);
            }, timeout);
        });
    }

    /**
     * 检查 sema-core 是否已准备就绪
     */
    public isReady(): boolean {
        return this.semaCore !== null && this.semaCore !== undefined;
    }

    /**
     * 等待 sema-core 准备就绪
     */
    public async waitForReady(timeout: number = 5000): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.isReady()) {
                resolve(true);
                return;
            }

            let timeoutId: NodeJS.Timeout;
            const readyHandler = () => {
                clearTimeout(timeoutId);
                this.semaCore.off('session:ready', readyHandler);
                resolve(true);
            };

            this.semaCore.on('session:ready', readyHandler);

            timeoutId = setTimeout(() => {
                this.semaCore.off('session:ready', readyHandler);
                resolve(false);
            }, timeout);
        });
    }

    // ===== 事件管理方法 =====

    /**
     * 添加事件监听器
     */
    public on<T>(event: string, listener: (data: T) => void): this {
        this.semaCore.on(event, listener);
        return this;
    }

    /**
     * 添加一次性事件监听器
     */
    public once<T>(event: string, listener: (data: T) => void): this {
        this.semaCore.once(event, listener);
        return this;
    }

    /**
     * 移除事件监听器
     */
    public off<T>(event: string, listener: (data: T) => void): this {
        this.semaCore.off(event, listener);
        return this;
    }

    // ===== 工具方法 =====

    /**
     * 获取当前SemaCore实例（谨慎使用）
     */
    public getSemaCore(): SemaCore {
        return this.semaCore;
    }

    /**
     * 更新系统配置并应用到 SemaCore
     */
    public async updateSystemConfig(config: UpdatableCoreConfig): Promise<void> {
        await this.systemConfigManager.saveSystemConfig(config);
        this.semaCore.updateCoreConfig(config);
    }


    /**
     * 更新agent模式
     */
    public async updateAgentMode(mode: 'Agent' | 'Plan'): Promise<void> {
        this.semaCore.updateAgentMode(mode);
    }


    /**
     * 更新单个系统配置并应用到 SemaCore
     */
    public async updateSystemConfigByKey<K extends keyof UpdatableCoreConfig>(
        key: K,
        value: UpdatableCoreConfig[K]
    ): Promise<void> {
        await this.systemConfigManager.saveSystemConfigByKey(key, value);
        this.semaCore.updateCoreConfByKey(key, value);
    }


    /**
     * 获取当前系统配置
     */
    public getSystemConfig(): UpdatableCoreConfig {
        return this.systemConfigManager.getSystemConfig();
    }

    /**
     * 插入权限请求消息到历史记录
     */
    public insertPermissionRequestMessage(permissionData: any): void {
        const message: Message = {
            type: 'permission_request',
            content: {
                toolName: permissionData.toolName,
                title: permissionData.title,
                content: permissionData.content,
                action: permissionData.action, // 'refuse' 或 'interrupted'
                refuseMessage: permissionData.refuseMessage
            },
            timestamp: Date.now()
        };

        // 检查是否为子代理消息
        const agentId = permissionData.agentId;
        if (agentId && agentId !== MAIN_AGENT_ID) {
            // 子代理权限请求，添加到对应的 taskMessages 中
            this.addMessageToTaskAgent(agentId, message);
            return;
        }

        // 主代理权限请求，添加到主消息历史
        this.messageHistory.push(message);
        this.sendContentUpdate();
    }

    // ===== 插件市场管理相关方法 =====

    /**
     * 从 Git 仓库添加插件市场
     */
    public async addMarketplaceFromGit(repo: string): Promise<MarketplacePluginsInfo> {
        return await this.semaCore.addMarketplaceFromGit(repo);
    }

    /**
     * 从本地目录添加插件市场
     */
    public async addMarketplaceFromDirectory(dirPath: string): Promise<MarketplacePluginsInfo> {
        return await this.semaCore.addMarketplaceFromDirectory(dirPath);
    }

    /**
     * 更新插件市场
     */
    public async updateMarketplace(marketplaceName: string): Promise<MarketplacePluginsInfo> {
        return await this.semaCore.updateMarketplace(marketplaceName);
    }

    /**
     * 移除插件市场
     */
    public async removeMarketplace(marketplaceName: string): Promise<MarketplacePluginsInfo> {
        return await this.semaCore.removeMarketplace(marketplaceName);
    }

    /**
     * 安装插件
     */
    public async installPlugin(pluginName: string, marketplaceName: string, scope: PluginScope, projectPath?: string): Promise<MarketplacePluginsInfo> {
        return await this.semaCore.installPlugin(pluginName, marketplaceName, scope, projectPath);
    }

    /**
     * 卸载插件
     */
    public async uninstallPlugin(pluginName: string, marketplaceName: string, scope: PluginScope, projectPath?: string): Promise<MarketplacePluginsInfo> {
        return await this.semaCore.uninstallPlugin(pluginName, marketplaceName, scope, projectPath);
    }

    /**
     * 启用插件
     */
    public async enablePlugin(pluginName: string, marketplaceName: string, scope: PluginScope, projectPath?: string): Promise<MarketplacePluginsInfo> {
        return await this.semaCore.enablePlugin(pluginName, marketplaceName, scope, projectPath);
    }

    /**
     * 禁用插件
     */
    public async disablePlugin(pluginName: string, marketplaceName: string, scope: PluginScope, projectPath?: string): Promise<MarketplacePluginsInfo> {
        return await this.semaCore.disablePlugin(pluginName, marketplaceName, scope, projectPath);
    }

    /**
     * 更新插件
     */
    public async updatePlugin(pluginName: string, marketplaceName: string, scope: PluginScope, projectPath?: string): Promise<MarketplacePluginsInfo> {
        return await this.semaCore.updatePlugin(pluginName, marketplaceName, scope, projectPath);
    }

    /**
     * 刷新插件市场信息
     */
    public async refreshMarketplacePluginsInfo(): Promise<MarketplacePluginsInfo> {
        return await this.semaCore.refreshMarketplacePluginsInfo();
    }

    /**
     * 获取插件市场信息
     */
    public async getMarketplacePluginsInfo(): Promise<MarketplacePluginsInfo> {
        return await this.semaCore.getMarketplacePluginsInfo();
    }

    // ===== agent管理相关方法 =====

    /**
     * 获取 Agents 信息列表
     */
    public getAgentsInfo(): Promise<AgentConfig[]> {
        return this.semaCore.getAgentsInfo();
    }

    /**
     * 重新加载 Agents 信息列表
     */
    public refreshAgentsInfo(): Promise<AgentConfig[]> {
        return this.semaCore.refreshAgentsInfo();
    }

    /**
     * 添加 Agents 
     */
    public addAgentConf(agentConf: AgentConfig): Promise<AgentConfig[]> {
        return this.semaCore.addAgentConf(agentConf);
    }

    /**
     * 移除 Agents 
     */
    public removeAgentConf(name: string): Promise<AgentConfig[]> {
        return this.semaCore.removeAgentConf(name);
    }

    // ===== skill管理相关方法 =====

    /**
     * 获取 Skills 信息列表
     */
    public getSkillsInfo(): Promise<SkillConfig[]> {
        return this.semaCore.getSkillsInfo();
    }

    /**
     * 重新加载 Skills 信息列表
     */
    public refreshSkillsInfo(): Promise<SkillConfig[]> {
        return this.semaCore.refreshSkillsInfo();
    }

    /**
     * 移除 Skills 
     */
    public removeSkillConf(name: string): Promise<SkillConfig[]> {
        return this.semaCore.removeSkillConf(name);
    }

    // ===== command管理相关方法 =====

    /**
     * 获取 Commands 信息列表
     */
    public getCommandsInfo(): Promise<CommandConfig[]> {
        return this.semaCore.getCommandsInfo();
    }

    /**
     * 重新加载 Commands 信息列表
     */
    public refreshCommandsInfo(): Promise<CommandConfig[]> {
        return this.semaCore.refreshCommandsInfo();
    }

    /**
     * 添加 Commands 
     */
    public addCommandConf(commandConf: CommandConfig): Promise<CommandConfig[]> {
        return this.semaCore.addCommandConf(commandConf);
    }

    /**
     * 移除 Commands 
     */
    public removeCommandConf(name: string): Promise<CommandConfig[]> {
        return this.semaCore.removeCommandConf(name);
    }

    // ===== MCP 管理相关方法 =====

    public getMCPServerInfo(): Promise<MCPServerInfo[]> {
        return this.semaCore.getMCPServerInfo();
    }

    public refreshMCPServerInfo(): Promise<MCPServerInfo[]> {
        return this.semaCore.refreshMCPServerInfo();
    }

    public addMCPServer(mcpConfig: MCPServerConfig): Promise<MCPServerInfo[]> {
        return this.semaCore.addMCPServer(mcpConfig);
    }

    public removeMCPServer(name: string): Promise<MCPServerInfo[]> {
        return this.semaCore.removeMCPServer(name);
    }

    public reconnectMCPServer(name: string): Promise<MCPServerInfo[]> {
        return this.semaCore.reconnectMCPServer(name);
    }

    public disableMCPServer(name: string): Promise<MCPServerInfo[]> {
        return this.semaCore.disableMCPServer(name);
    }

    public enableMCPServer(name: string): Promise<MCPServerInfo[]> {
        return this.semaCore.enableMCPServer(name);
    }

    public updateMCPUseTools(name: string, toolNames: string[]): Promise<MCPServerInfo[]> {
        return this.semaCore.updateMCPUseTools(name, toolNames);
    }

    /**
     * 销毁wrapper实例
     */
    public dispose(): void {
        try {
            // console.log('Disposing SemaCoreWrapper...');

            // 销毁 SemaCore 实例
            this.semaCore.dispose();

            // 清空消息历史和状态
            this.messageHistory = [];
            this.currentState = 'idle';
            this.currentSessionId = null;
            this.currentStreamingMessage = null;
            this.title = '';
            this.taskAgentMap.clear(); // 清理子代理映射

            // 清空回调函数
            this.callbacks = {};

            // console.log('SemaCoreWrapper disposed successfully');
        } catch (error) {
            console.error('Error disposing SemaCoreWrapper:', error);
        }
    }
}