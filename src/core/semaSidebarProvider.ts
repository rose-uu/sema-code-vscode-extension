import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

import { SessionHistoryManager } from '../managers/SessionHistoryManager';
import { FileStateDiffManager } from '../managers/FileStateDiffManager';
import { FileOperationManager } from '../managers/FileOperationManager';
import { SystemConfigManager } from '../managers/SystemConfigManager';
import { ChatWebviewProvider } from '../webview/chat/chatWebview';
import { ConfigWebviewProvider } from '../webview/config/configWebview';
import { SessionHistoryWebviewProvider } from '../webview/sessionHistory/sessionHistoryWebview';
import { MessageHandler } from './MessageHandler';
import { SemaCoreWrapper } from './semaCoreWrapper';
import { transformCommandToPrompt } from './command';


/**
 * SemaSidebarProvider 类 - 管理 VS Code 侧边栏的 Webview
 */
export class SemaSidebarProvider implements vscode.WebviewViewProvider {
    // Webview 视图实例
    private view?: vscode.WebviewView;
    // 工作目录 (当前打开的文件夹/工作区)
    private workingDir: string;

    // Webview提供者
    private chatWebviewProvider: ChatWebviewProvider;        // 聊天Webview提供者：管理聊天界面的Webview实例
    private configWebviewProvider!: ConfigWebviewProvider;   // 配置Webview提供者：管理配置界面的Webview实例
    private sessionHistoryWebviewProvider!: SessionHistoryWebviewProvider; // 历史会话Webview提供者：管理历史会话界面的Webview实例

    // 管理器实例
    private coreManager: SemaCoreWrapper;                    // 核心管理器：封装与Sema Core的交互
    private sessionHistoryManager: SessionHistoryManager;    // 会话历史管理器：负责会话历史的存储、检索和管理（数据访问层）
    private fileStateDiffManager: FileStateDiffManager;      // 文件状态差异管理器：跟踪文件变更和状态差异
    private fileOperationManager: FileOperationManager;      // 文件操作管理器：处理文件创建、编辑、删除等操作
    private systemConfigManager: SystemConfigManager;        // 系统配置管理器：处理系统配置的持久化存储

    // 处理器实例
    private messageHandler!: MessageHandler;                 // 消息处理器：处理Webview与扩展之间的消息通信

    // 保存防抖计时器，避免短时间内多次触发保存
    private saveSessionTimer?: NodeJS.Timeout;

    constructor(
        private readonly context: vscode.ExtensionContext

    ) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
           // console.log('Workspace path:', workspacePath);
            this.workingDir = workspacePath
        } else {
            this.workingDir = path.join(os.homedir(), 'sema-demo');
        }

        this.fileOperationManager = new FileOperationManager();
        this.fileStateDiffManager = new FileStateDiffManager(this.workingDir);
        this.systemConfigManager = new SystemConfigManager(this.context);

        this.chatWebviewProvider = new ChatWebviewProvider(this.context.extensionUri);

        this.coreManager = new SemaCoreWrapper(
            this.workingDir,
            {
                onSessionReady: async (data) => await this.handleSessionReady(data),
                onMessage: (message) => this.chatWebviewProvider.postMessage(message),
                onMessageComplete: () => this.handleMessageComplete(),
                onModelUpdate: (data) => this.handleModelUpdate(data),
                onStateChange: (state) => this.handleStateChange(state),
                onToolPermissionRequest: (data) => this.handleToolPermissionRequest(data),
                onAskQuestionRequest: (data) => this.handleAskQuestionRequest(data),
                onPlanExitRequest: (data) => this.handlePlanExitRequest(data),
                onUsageUpdate: (data) => this.handleUsageUpdate(data),
                onTodosUpdate: (todos) => this.handleTodosUpdate(todos),
                onTopicUpdate: (topic) => this.handleTopicUpdate(topic)
            },
            this.systemConfigManager
        );

        this.sessionHistoryManager = new SessionHistoryManager(context, this.workingDir, this.coreManager);

        this.messageHandler = new MessageHandler(
            this.fileStateDiffManager,
            this.fileOperationManager,
            this.chatWebviewProvider,
            {
                handleUserInput: async (text, files) => await this.handleUserInput(text, files),
                openConfigPanel: () => this.openConfigPanel(),
                interrupt: async () => await this.interrupt(),
                switchModel: async (modelName) => await this.switchModel(modelName),
                sendModelInfo: async () => await this.sendModelInfo(),
                bashPermission: (action, command) => this.bashPermission(action, command),
                toolPermissionResponse: (response) => this.handleToolPermissionResponse(response),
                askQuestionResponse: (response) => this.handleAskQuestionResponse(response),
                planExitResponse: (response) => this.handlePlanExitResponse(response),
                initializeSession: async () => await this.coreManager.createSession(),
                checkConfiguration: async () => await this.checkConfiguration(),
                insertPermissionRequest: (permissionData) => this.coreManager.insertPermissionRequestMessage(permissionData),
                updateAgentMode: async (mode) => await this.updateAgentMode(mode)
            }
        );

        this.configWebviewProvider = new ConfigWebviewProvider(this.coreManager);
        this.sessionHistoryWebviewProvider = new SessionHistoryWebviewProvider(
            this.sessionHistoryManager,
            {
                loadSession: async (sessionId: string) => await this.loadHistorySession(sessionId)
            }
        );
    }
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void | Thenable<void> {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        this.chatWebviewProvider.setWebviewView(webviewView);

        webviewView.webview.onDidReceiveMessage(async (message) => {
            await this.messageHandler.handleMessage(message);
        });

        // 配置检查移除，改为在 frontendReady 时执行
    }

    /**
    * 检查配置状态
    */
    private async checkConfiguration() {
        try {
            const isReady = await this.coreManager.waitForReady(5000);
            if (!isReady) {
                console.warn('SemaCore 初始化超时，无法检查配置状态');
                return;
            }

            const modelData = await this.coreManager.getModelData();
            if (!modelData.modelList || modelData.modelList.length === 0) {
                // console.info('[提示] 请先点击右上角的配置按钮进行模型设置～\n');

                // 向前端发送模型配置提醒消息
                this.chatWebviewProvider.postMessage({
                    type: 'showModelConfigReminder',
                    message: 'Code Agent Model 尚未配置，请先配置模型信息'
                });
            }
        } catch (error) {
            console.error('Error checking configuration:', error);
            vscode.window.showWarningMessage(
                'Code Agent Model 配置检查失败，请配置模型信息',
                '打开配置'
            ).then(selection => {
                if (selection === '打开配置') {
                    this.openConfigPanel();
                }
            });
        }
    }

    /**
     * 开始新对话
     */
    public async newSession() {
        try {
            // 如果当前正在运行，先中断并等待完成
            if (this.coreManager.getCurrentState() === 'processing') {
               // console.log('[NewSession] 当前正在运行，先中断会话');
                const completed = await this.coreManager.interruptAndWait();
                if (!completed) {
                    console.warn('[NewSession] 等待中断完成超时，继续创建新会话');
                }
            }

            // 清理消息历史（包括可能的中断消息）
            this.coreManager.clearMessageHistory();

            // 清理所有面板状态
            this.clearAllPanels();

            // 重置token信息
            this.chatWebviewProvider.postMessage({
                type: 'resetTokenInfo'
            });

            // 创建文件快照
            await this.fileStateDiffManager.createSnapshot();

            await this.coreManager.createSession();

            // 刷新历史会话面板（如果已打开）
            this.sessionHistoryWebviewProvider.refreshSessionList();

        } catch (error) {
            console.error('Error starting new session:', error);
            // 即使出错也要启用输入框
            this.chatWebviewProvider.postMessage({
                type: 'enableInput'
            });
        }
    }

    /**
     * 打开历史会话面板
     */
    public async openHistoryPanel() {
        try {
            // 显示历史会话面板
            await this.sessionHistoryWebviewProvider.show(this.context.extensionUri);

        } catch (error) {
            console.error('Error opening history panel:', error);
            vscode.window.showErrorMessage(`打开历史会话面板失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 加载历史会话
     */
    private async loadHistorySession(sessionId: string): Promise<void> {
        try {
            const session = await this.sessionHistoryManager.getSession(sessionId);
            if (!session) {
                vscode.window.showErrorMessage('会话不存在或已被删除');
                return;
            }

            // 如果当前正在运行，先中断并等待完成
            if (this.coreManager.getCurrentState() === 'processing') {
               // console.log('[LoadSession] 当前正在运行，先中断会话');
                const completed = await this.coreManager.interruptAndWait();
                if (!completed) {
                    console.warn('[LoadSession] 等待中断完成超时，继续加载会话');
                }
            }

            // 清理消息历史（包括可能的中断消息）
            this.coreManager.clearMessageHistory();

            // 加载历史会话前清理所有面板状态
            this.clearAllPanels();

            // 通过SemaCoreWrapper加载会话
            if (session.content && session.content.length > 0) {
                try {
                    // 创建文件快照
                    await this.fileStateDiffManager.createSnapshot();

                    // 使用createSession方法加载历史会话
                    await this.coreManager.createSession(sessionId);

                    await this.coreManager.updateMessageHistory(session.content);
                    this.coreManager.updateTitle(session.title);

                    // vscode.window.showInformationMessage(`已加载会话：${session.title}`);
                } catch (error) {
                    console.error('Failed to load session:', error);
                    vscode.window.showErrorMessage(`加载会话失败：${error instanceof Error ? error.message : '未知错误'}`);
                }
            } else {
                vscode.window.showErrorMessage('无法加载会话：会话数据为空');
            }

        } catch (error) {
            console.error('Error loading history session:', error);
            vscode.window.showErrorMessage(`加载会话失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 打开配置页面
     */
    public openConfigPanel() {
        this.configWebviewProvider.show(this.context.extensionUri);
    }

    /**
     * 处理会话准备就绪事件
     */
    private async handleSessionReady(data: any): Promise<void> {
        try {
            // 会话准备就绪时启用输入框
            this.chatWebviewProvider.postMessage({
                type: 'enableInput'
            });

            // 如果有项目输入历史，发送给前端
            if (data.projectInputHistory && Array.isArray(data.projectInputHistory)) {
                this.chatWebviewProvider.postMessage({
                    type: 'initializeInputHistory',
                    projectInputHistory: data.projectInputHistory
                });
            }

            // 更新 token 信息
            if (data.usage) {
                this.chatWebviewProvider.postMessage({
                    type: 'updateTokenInfo',
                    tokenInfo: data.usage
                });
            }

            // 加载自定义命令
            try {
                const customCommands = await this.coreManager.getCustomCommands();
               // console.log('[Backend] Loaded custom commands:', customCommands.length, 'commands');

                // 通知前端更新命令列表
                this.chatWebviewProvider.postMessage({
                    type: 'customCommandsLoaded',
                    commands: customCommands
                });
            } catch (error) {
                console.error('Error loading custom commands:', error);
                // 不阻塞会话初始化，只记录错误
            }

        } catch (error) {
            console.error('Error handling session ready:', error);
            // 即使出错也要启用输入框
            this.chatWebviewProvider.postMessage({
                type: 'enableInput'
            });
        }
    }

    /**
     * 处理模型更新事件
     */
    private handleModelUpdate(data: any): void {
       // console.log('Model update data:', data);

        // 向webview发送模型更新消息
        this.chatWebviewProvider.postMessage({
            type: 'modelUpdate',
            data: data
        });

        // 刷新配置页面（如果已打开）
        this.configWebviewProvider.refreshConfigPage();
    }

    /**
     * 防抖保存会话，避免短时间内多次触发
     */
    private debouncedSaveSession(): void {
        clearTimeout(this.saveSessionTimer);
        this.saveSessionTimer = setTimeout(async () => {
            try {
                await this.sessionHistoryManager.saveSession();
            } catch (error) {
                console.error('Error saving session:', error);
            }
        }, 300);
    }

    /**
     * 处理消息完成事件
     */
    private handleMessageComplete(): void {
        this.debouncedSaveSession();
    }

    /**
     * 处理状态变更事件
     */
    private async handleStateChange(state: 'idle' | 'processing'): Promise<void> {
        this.chatWebviewProvider.postMessage({
            type: 'stateUpdate',
            state: state
        });

        // 当状态切换成idle时触发会话记录保存
        if (state === 'idle') {
            this.debouncedSaveSession();
        }
    }

    /**
     * 处理用户输入
     */
    private async handleUserInput(text: string, files?: Array<any>): Promise<void> {
        try {
            // 创建文件快照
            await this.fileStateDiffManager.createSnapshot();

            let content = text; // 初始化内容为用户输入的文本

            // 第一步：处理附加的文件信息
            if (files && files.length > 0) {
               // console.log('Processing user input with files:', files);

                const fileContext = files.map(file => {
                    if (file.startLine && file.endLine) {
                        return `@${file.path}:${file.startLine}-${file.endLine}`;
                    } else {
                        return `@${file.path}`;
                    }
                }).join(' ');

                content = `${text} ${fileContext} `;
            }

            // 第二步：尝试将命令转换为对应的 prompt
            const transformedContent = transformCommandToPrompt(content);
            if (transformedContent && transformedContent !== content) {
                await this.coreManager.processUserInput(transformedContent, content);
            } else {
                await this.coreManager.processUserInput(content);
            }
        } catch (error) {
            console.error('Error handling user input:', error);
            // 向webview发送错误信息
            this.chatWebviewProvider.postMessage({
                type: 'error',
                message: error instanceof Error ? error.message : '处理用户输入时发生错误'
            });
        }
    }

    /**
     * 中断当前会话
     */
    private async interrupt(): Promise<void> {
        try {
            // 中断时重新启用输入框（特别是当bash permission面板被中断时）
            this.enableInput();

            // 清理所有面板状态
            this.clearAllPanels();

            this.coreManager.interruptSession();

        } catch (error) {
            console.error('Error interrupting session:', error);
        }
    }

    /**
     * 切换模型
     */
    private async switchModel(modelName: string): Promise<void> {
        try {
            await this.coreManager.switchModel(modelName);
        } catch (error) {
            console.error('Error switching model:', error);
            // 向webview发送错误信息
            this.chatWebviewProvider.postMessage({
                type: 'error',
                message: `切换模型失败: ${error instanceof Error ? error.message : '未知错误'}`
            });
        }
    }

    /**
     * 发送模型信息
     */
    private async sendModelInfo(): Promise<void> {
        try {
            // 从getModelData获取模型信息并发送给webview
            const modelData = await this.coreManager.getModelData();

            // 发送符合前端期望格式的模型信息
            this.chatWebviewProvider.postMessage({
                type: 'updateModelInfo',
                modelName: modelData.modelName || '',
                availableModels: modelData.modelList || []
            });
        } catch (error) {
            console.error('Error getting model info:', error);
            this.chatWebviewProvider.postMessage({
                type: 'error',
                message: `获取模型信息失败: ${error instanceof Error ? error.message : '未知错误'}`
            });
        }
    }

    /**
     * Bash权限处理
     */
    private bashPermission(action: string, command: string): void {
       // console.log('Bash permission request:', action, command);
        // 这里可以实现权限确认逻辑
        // 暂时直接允许
        this.chatWebviewProvider.postMessage({
            type: 'bashPermissionResponse',
            action: action,
            command: command,
            allowed: true
        });
    }

    /**
     * 处理工具权限请求
     */
    private handleToolPermissionRequest(data: any): void {
        // 转发工具权限请求到前端
        this.chatWebviewProvider.postMessage({
            type: 'toolPermissionRequest',
            data: data
        });

        // 禁用输入框并显示bash权限提示 
        this.chatWebviewProvider.postMessage({
            type: 'disableInput',
            message: '请选择是否执行bash命令'
        });

    }

    /**
     * 处理使用统计更新
     */
    private handleUsageUpdate(data: any): void {
       // console.log('Usage update:', data);

        // 向前端发送使用统计更新
        this.chatWebviewProvider.postMessage({
            type: 'updateTokenInfo',
            tokenInfo: data.usage
        });
    }

    /**
     * 处理待办事项更新
     */
    private handleTodosUpdate(todos: any): void {
       // console.log('Todos update:', todos);

        // 向前端发送待办事项更新
        this.chatWebviewProvider.postMessage({
            type: 'todosUpdate',
            todos: todos
        });
    }

    /**
     * 处理工具权限响应
     */
    private handleToolPermissionResponse(response: any): void {
       // console.log('Tool permission response:', response);

        // 将权限响应传递给SemaCoreWrapper
        this.coreManager.respondToToolPermission(response);


        // bash权限处理完成后，重新启用输入框
        this.enableInput();
    }

    /**
     * 处理问答请求
     */
    private handleAskQuestionRequest(data: any): void {
        // 转发问答请求到前端
        this.chatWebviewProvider.postMessage({
            type: 'askQuestionRequest',
            data: data
        });
    }

    /**
     * 处理问答响应
     */
    private handleAskQuestionResponse(response: any): void {
       // console.log('Ask question response:', response);

        // 将问答响应传递给SemaCoreWrapper
        this.coreManager.respondToAskQuestion(response);
    }

    /**
     * 处理退出Plan模式请求
     */
    private handlePlanExitRequest(data: any): void {
        // 转发退出Plan模式请求到前端
        this.chatWebviewProvider.postMessage({
            type: 'planExitRequest',
            data: data
        });
    }

    /**
     * 处理退出Plan模式响应
     */
    private async handlePlanExitResponse(response: any): Promise<void> {
       // console.log('Plan exit response:', response);

        // 如果用户选择 clearContextAndStart，清空历史信息
        if (response.selected === 'clearContextAndStart') {
           // console.log('[PlanExitResponse] 用户选择清空上下文，清理历史信息');

            // 清空消息历史
            this.coreManager.clearMessageHistory();

            // 清理所有面板状态
            this.clearAllPanels();

            // 重置token信息
            this.chatWebviewProvider.postMessage({
                type: 'resetTokenInfo'
            });
        }

        // 将退出Plan模式响应传递给SemaCoreWrapper
        this.coreManager.respondToPlanExit(response);

        // 自动切换回Agent模式
        await this.updateAgentMode('Agent');

        // 通知前端更新模式状态
        this.chatWebviewProvider.postMessage({
            type: 'agentModeUpdate',
            mode: 'Agent'
        });
    }

    /**
     * 启用输入框
     */
    private enableInput() {
        if (!this.view) {
            return;
        }
        this.chatWebviewProvider.postMessage({
            type: 'enableInput'
        });
       // console.log('[EnableInput]');
    }

    /**
     * 清理所有面板状态（权限面板、问答面板、文件变更面板、todos面板）
     */
    private clearAllPanels() {
        // 关闭权限申请面板
        this.chatWebviewProvider.postMessage({
            type: 'closePermissionPanel'
        });

        // 关闭问答面板
        this.chatWebviewProvider.postMessage({
            type: 'closeAskQuestionPanel'
        });

        // 关闭退出Plan模式面板
        this.chatWebviewProvider.postMessage({
            type: 'closePlanExitPanel'
        });

        // 清空文件变更列表
        this.chatWebviewProvider.postMessage({
            type: 'clearFileChanges'
        });

        // 清空todos列表
        this.chatWebviewProvider.postMessage({
            type: 'clearTodos'
        });

       // console.log('[ClearAllPanels] 已清理所有面板状态');
    }

    /**
     * 处理主题更新
     */
    private handleTopicUpdate(_topic: any): void {
        this.debouncedSaveSession();

        if (this.sessionHistoryWebviewProvider) {
            this.sessionHistoryWebviewProvider.refreshSessionList();
        }
    }

    /**
     * 更新 Agent 模式
     */
    private async updateAgentMode(mode: 'Agent' | 'Plan'): Promise<void> {
        try {
            await this.coreManager.updateAgentMode(mode);
           // console.log('Agent mode updated to:', mode);
        } catch (error) {
            console.error('Error updating agent mode:', error);
        }
    }
}

