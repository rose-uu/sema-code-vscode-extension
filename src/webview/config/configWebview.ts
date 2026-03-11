import * as vscode from 'vscode';
import { defaultConfig } from './default/defaultConfig';

/**
 * ConfigWebviewProvider 类 - 管理配置界面的Webview
 */
export class ConfigWebviewProvider {
    private panel?: vscode.WebviewPanel;
    private coreManager: any; // SemaCoreWrapper实例

    constructor(coreManager: any) {
        this.coreManager = coreManager;
    }

    /**
     * 显示配置界面
     */
    public show(extensionUri: vscode.Uri) {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'semaConfig',
            'Code Agent 配置',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')]
            }
        );

        this.panel.webview.html = this.getHtmlContent(this.panel.webview, extensionUri);

        // 监听来自webview的消息
        this.panel.webview.onDidReceiveMessage(async message => {
            const handlers = {
                'saveConfig': () => this.saveConfig(message.data),
                'loadConfig': () => this.loadConfig(),
                'toggleModelActive': () => this.toggleModelActive(message.provider, message.modelName),
                'updateModelPointer': () => this.updateModelPointer(message.pointer, message.modelName),
                'confirmTaskConfig': () => this.confirmTaskConfig(message.data),
                'testConnection': () => this.testConnection(message.data),
                'deleteModel': () => this.deleteModel(message.provider, message.modelName),
                'fetchModels': () => this.fetchModels(message.data),
                'loadSystemConfig': () => this.loadSystemConfig(),
                'saveSystemConfig': () => this.saveSystemConfig(message.data),
                'saveSystemConfigByKey': () => this.saveSystemConfigByKey(message.key, message.value),
                'resetSystemConfig': () => this.resetSystemConfig(),
                'loadMCPConfig': () => this.loadMCPConfig(),
                'reconnectMCP': () => this.reconnectMCP(message.name),
                'updateMCPConfig': () => this.updateMCPConfig(message.config, message.scope),
                'deleteMCPConfig': () => this.deleteMCPConfig(message.name, message.scope),
                'openExternal': () => this.openExternalUrl(message.url),
                'loadSystemTools': () => this.loadSystemTools(),
                'updateUseTools': () => this.updateUseTools(message.tools),
                'updateMCPUseTools': () => this.updateMCPUseTools(message.mcpName, message.tools),
                'loadSkillsInfo': () => this.loadSkillsInfo(),
                'loadAgentsInfo': () => this.loadAgentsInfo(),
                'addAgent': () => this.addAgent(message.data),
                'getModelAdapter': () => this.getModelAdapter(message.provider, message.modelName),
                'loadPluginConfig': () => this.loadPluginConfig(),
                'refreshPluginConfig': () => this.refreshPluginConfig(),
                'installPlugin': () => this.installPlugin(message.pluginName, message.marketplaceName, message.scope, message.key),
                'uninstallPlugin': () => this.uninstallPlugin(message.pluginName, message.marketplaceName, message.scope, message.key),
                'enablePlugin': () => this.enablePlugin(message.pluginName, message.marketplaceName, message.scope),
                'disablePlugin': () => this.disablePlugin(message.pluginName, message.marketplaceName, message.scope),
                'updateMarketplace': () => this.updateMarketplace(message.marketplaceName),
                'removeMarketplace': () => this.removeMarketplace(message.marketplaceName),
                'addMarketplaceFromGit': () => this.addMarketplace('github', message.repo),
                'addMarketplaceFromDirectory': () => this.addMarketplace('directory', message.dirPath),
            };

            const handler = handlers[message.command as keyof typeof handlers];
            if (handler) {
                await handler();
            }
        });

        // 面板关闭时清理
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // 加载现有配置
        this.loadConfig();
    }

    /**
     * 确保 sema-core 准备就绪的通用方法
     */
    private async ensureCoreReady(): Promise<void> {
        if (!this.coreManager) {
            throw new Error('SemaCore 未初始化');
        }

        const isReady = await this.coreManager.waitForReady(5000);
        if (!isReady) {
            throw new Error('SemaCore 初始化超时');
        }
    }

    /**
     * 发送消息到 webview 的通用方法
     */
    private postMessage(message: any): void {
        if (this.panel) {
            this.panel.webview.postMessage(message);
        }
    }

    /**
     * 通用的错误处理方法
     */
    private handleError(error: any, operation: string, command?: string): void {
        console.error(`Error ${operation}:`, error);
        const message = error instanceof Error ? error.message : '未知错误';

        if (command) {
            this.postMessage({
                command,
                success: false,
                message: `${operation}失败：${message}`
            });
        }

        vscode.window.showErrorMessage(`${operation}失败：${message}`);
    }

    /**
     * 加载现有配置
     */
    private async loadConfig() {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const modelData = await this.coreManager.getModelData();
            const hasModels = modelData.modelList && modelData.modelList.length > 0;

            this.postMessage({
                command: 'loadConfig',
                data: modelData,
                showAddPage: !hasModels  // 如果没有模型，显示新增模型页面
            });

        } catch (error) {
            console.error('Error loading config:', error);

            // 如果加载失败，显示空配置和新增页面
            this.postMessage({
                command: 'loadConfig',
                data: null,
                showAddPage: true
            });
        }
    }

    /**
     * 保存新模型配置
     */
    private async saveConfig(data: {
        provider: string;
        baseURL: string;
        apiKey: string;
        modelName: string;
        maxTokens: number;
        contextLength: number;
        adapt?: string;
    }) {
        try {
            await this.ensureCoreReady();

            const modelConfig = {
                provider: data.provider,
                modelName: data.modelName,
                baseURL: data.baseURL,
                apiKey: data.apiKey,
                maxTokens: data.maxTokens,
                contextLength: data.contextLength,
                ...(data.adapt && { adapt: data.adapt })
            };

            await this.coreManager.addModel(modelConfig);

            this.postMessage({
                command: 'saveResult',
                success: true,
                message: '模型配置已添加！'
            });

            // vscode.window.showInformationMessage('模型配置已添加');
            this.loadConfig();

        } catch (error) {
            this.handleError(error, '添加模型配置', 'saveResult');
        }
    }

    /**
     * 切换模型激活状态 (通过sema-core切换模型)
     */
    private async toggleModelActive(provider: string, modelName: string) {
        try {
            await this.ensureCoreReady();

            await this.coreManager.switchModel(modelName);

            this.loadConfig();
            vscode.window.showInformationMessage(`已切换到模型：${modelName}`);

        } catch (error) {
            this.handleError(error, '切换模型');
        }
    }

    /**
     * 更新任务模型指针（不立即保存，只更新webview状态）
     */
    private async updateModelPointer(pointer: string, modelName: string) {
        this.postMessage({
            command: 'taskConfigChanged',
            pointer: pointer,
            modelName: modelName
        });
    }

    /**
     * 确认任务配置修改（使用 sema-core API）
     */
    private async confirmTaskConfig(data: {
        main: string;
        quick: string;
    }) {
        try {
            await this.ensureCoreReady();

            const taskConfig = {
                main: data.main,
                quick: data.quick
            };

            await this.coreManager.applyTaskModel(taskConfig);

            this.postMessage({
                command: 'taskConfigConfirmed'
            });

            this.loadConfig();

        } catch (error) {
            this.handleError(error, '更新任务配置');
        }
    }

    /**
     * 删除模型配置
     */
    private async deleteModel(provider: string, modelName: string) {
        // 先弹出确认对话框
        const confirmMessage = `确定要删除模型 "${provider} ${modelName}" 吗？\n\n注意：如果该模型正在被任务配置使用，将无法删除。`;
        const selection = await vscode.window.showWarningMessage(
            confirmMessage,
            { modal: true },
            '删除',
            '取消'
        );

        if (selection !== '删除') {
            return; // 用户取消了删除操作
        }

        try {
            await this.ensureCoreReady();

            await this.coreManager.deleteModel(modelName);

            this.postMessage({
                command: 'deleteResult',
                success: true,
                message: '模型已删除'
            });

            vscode.window.showInformationMessage('模型已删除');
            this.loadConfig();

        } catch (error) {
            this.handleError(error, '删除模型', 'deleteResult');
        }
    }

    /**
     * 获取可用模型列表（使用 sema-core API）
     */
    private async fetchModels(data: {
        provider: string;
        baseURL: string;
        apiKey: string;
    }) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const fetchParams = {
                provider: data.provider,
                baseURL: data.baseURL,
                apiKey: data.apiKey
            };

            const result = await this.coreManager.fetchAvailableModels(fetchParams);

            this.postMessage({
                command: 'modelsResult',
                success: result.success,
                models: result.models || [],
                message: result.success
                    ? (result.message || '获取模型列表成功')
                    : `${result.message || '获取模型列表失败'}${result.curlCommand ? '\n调试命令: ' + result.curlCommand : ''}`
            });

        } catch (error) {
            console.error('Error fetching models:', error);
            const message = error instanceof Error ? error.message : '未知错误';

            this.postMessage({
                command: 'modelsResult',
                success: false,
                models: [],
                message: `获取模型列表失败: ${message}`
            });
        }
    }

    /**
     * 测试 API 连接（使用 sema-core API）
     */
    private async testConnection(data: any) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const result = await this.coreManager.testApiConnection(data);

            this.postMessage({
                command: 'testResult',
                success: result.success,
                message: result.success ? '✓ 连接测试成功！API 配置正确。' : `${result.message}\n调试命令: ${result.curlCommand}` || '连接测试失败'
            });

        } catch (error) {
            console.error('Error testing API connection:', error);
            const message = error instanceof Error ? error.message : '未知错误';

            this.postMessage({
                command: 'testResult',
                success: false,
                message: `✗ 测试失败: ${message}`
            });
        }
    }

    /**
     * 刷新配置页面（如果已打开）
     */
    public refreshConfigPage(): void {
        if (this.panel) {
            this.loadConfig();
        }
    }

    /**
     * 生成HTML内容 - 加载 React 应用
     */
    private getHtmlContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'config.js')
        );

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; script-src ${webview.cspSource}; img-src data:;">
    <title>Code Agent Model配置</title>
</head>
<body>
    <div id="root"></div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }

    /**
     * 加载系统配置
     */
    private async loadSystemConfig() {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 从 sema-core 获取系统配置
            const systemConfig = this.coreManager.getSystemConfig();

            this.postMessage({
                command: 'loadSystemConfigResult',
                success: true,
                data: systemConfig
            });

        } catch (error) {
            this.handleError(error, '加载系统配置', 'loadSystemConfigResult');
        }
    }

    /**
     * 保存系统配置
     */
    private async saveSystemConfig(data: any) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 通过 sema-core 保存系统配置
            await this.coreManager.updateSystemConfig(data);

            this.postMessage({
                command: 'saveSystemConfigResult',
                success: true,
                message: '系统配置已保存'
            });

        } catch (error) {
            this.handleError(error, '保存系统配置', 'saveSystemConfigResult');
        }
    }

    /**
     * 保存单个系统配置项
     */
    private async saveSystemConfigByKey(key: string, value: any) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 特殊处理 useTools，使用专用方法
            if (key === 'useTools') {
                await this.coreManager.updateUseTools(value);
            } else {
                // 其他配置通过 sema-core 保存单个配置项
                await this.coreManager.updateSystemConfigByKey(key, value);
            }

            this.postMessage({
                command: 'saveSystemConfigByKeyResult',
                success: true,
                key,
                value,
                message: '配置已保存'
            });

        } catch (error) {
            this.handleError(error, '保存系统配置', 'saveSystemConfigByKeyResult');
        }
    }

    /**
     * 重置系统配置（带确认对话框）
     */
    private async resetSystemConfig() {
        if (!this.panel) return;

        // 使用 VSCode 原生确认对话框
        const confirmMessage = '确定要重置为默认配置吗？此操作将恢复所有系统配置';
        const selection = await vscode.window.showWarningMessage(
            confirmMessage,
            { modal: true },
            '重置',
            '取消'
        );

        if (selection !== '重置') {
            return; // 用户取消了重置操作
        }

        try {
            await this.ensureCoreReady();

            // 通过 sema-core 保存默认配置（排除 useTools 字段，保持当前工具配置不变）
            const { useTools, ...configWithoutUseTools } = defaultConfig;
            await this.coreManager.updateSystemConfig(configWithoutUseTools);

            this.postMessage({
                command: 'resetSystemConfigResult',
                success: true,
                message: '系统配置已重置'
            });

        } catch (error) {
            this.handleError(error, '重置系统配置', 'resetSystemConfigResult');
        }
    }

    /**
     * 加载 MCP 配置
     */
    private async loadMCPConfig() {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 获取 MCP 服务器配置
            const mcpConfigs = this.coreManager.getMCPServerConfigs();

            // 转换 Map 为前端需要的格式
            const mcpData = {
                project: mcpConfigs.get('project') || [],
                user: mcpConfigs.get('user') || []
            };

            this.postMessage({
                command: 'loadMCPConfigResult',
                success: true,
                data: mcpData
            });

        } catch (error) {
            console.error('Error loading MCP config:', error);
            this.postMessage({
                command: 'loadMCPConfigResult',
                success: false,
                data: { project: [], user: [] },
                message: error instanceof Error ? error.message : '加载 MCP 配置失败'
            });
        }
    }

    /**
     * 重新连接 MCP 服务
     */
    private async reconnectMCP(name: string) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 调用连接 MCP 服务
            const status = await this.coreManager.connectMCPServer(name);

            this.postMessage({
                command: 'mcpReconnectResult',
                success: true,
                name,
                status
            });

            // vscode.window.showInformationMessage(`MCP 服务 ${name} 已重新连接`);

        } catch (error) {
            console.error('Error reconnecting MCP:', error);
            this.postMessage({
                command: 'mcpReconnectResult',
                success: false,
                name,
                message: error instanceof Error ? error.message : '重新连接失败'
            });
            vscode.window.showErrorMessage(`重新连接 MCP 服务失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 更新 MCP 配置
     */
    private async updateMCPConfig(config: any, scope: 'project' | 'user') {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 调用更新 MCP 配置
            await this.coreManager.addOrUpdateMCPServer(config, scope);

            this.postMessage({
                command: 'mcpUpdateResult',
                success: true,
                message: 'MCP 配置已更新'
            });

            // vscode.window.showInformationMessage(`MCP 服务 ${config.name} 配置已更新`);

        } catch (error) {
            console.error('Error updating MCP config:', error);
            this.postMessage({
                command: 'mcpUpdateResult',
                success: false,
                message: error instanceof Error ? error.message : '更新配置失败'
            });
            vscode.window.showErrorMessage(`更新 MCP 配置失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 打开外部链接
     */
    private openExternalUrl(url: string) {
        if (url) {
            vscode.env.openExternal(vscode.Uri.parse(url));
        }
    }

    /**
     * 删除 MCP 配置
     */
    private async deleteMCPConfig(name: string, scope: 'project' | 'user') {
        if (!this.panel) return;

        // 先弹出确认对话框
        const confirmMessage = `确定要删除 MCP 服务 "${name}" 吗？`;
        const selection = await vscode.window.showWarningMessage(
            confirmMessage,
            { modal: true },
            '删除',
            '取消'
        );

        if (selection !== '删除') {
            return; // 用户取消了删除操作
        }

        try {
            await this.ensureCoreReady();

            // 调用删除 MCP 配置
            await this.coreManager.removeMCPServer(name, scope);

            this.postMessage({
                command: 'mcpDeleteResult',
                success: true,
                message: 'MCP 配置已删除'
            });

            // vscode.window.showInformationMessage(`MCP 服务 ${name} 已删除`);

        } catch (error) {
            console.error('Error deleting MCP config:', error);
            this.postMessage({
                command: 'mcpDeleteResult',
                success: false,
                message: error instanceof Error ? error.message : '删除配置失败'
            });
            vscode.window.showErrorMessage(`删除 MCP 配置失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 加载系统工具列表
     */
    private async loadSystemTools() {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 获取系统工具列表
            const tools = this.coreManager.getToolInfos();

            this.postMessage({
                command: 'loadSystemToolsResult',
                success: true,
                data: tools
            });

        } catch (error) {
            console.error('Error loading system tools:', error);
            this.postMessage({
                command: 'loadSystemToolsResult',
                success: false,
                data: [],
                message: error instanceof Error ? error.message : '加载系统工具失败'
            });
        }
    }

    /**
     * 更新可使用的工具列表
     */
    private async updateUseTools(tools: string[] | null) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 更新可使用的工具列表
            await this.coreManager.updateUseTools(tools);

            this.postMessage({
                command: 'updateUseToolsResult',
                success: true,
                message: '工具配置已更新'
            });

        } catch (error) {
            console.error('Error updating use tools:', error);
            this.postMessage({
                command: 'updateUseToolsResult',
                success: false,
                message: error instanceof Error ? error.message : '更新工具配置失败'
            });
            vscode.window.showErrorMessage(`更新工具配置失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 更新 MCP 可使用的工具列表
     */
    private async updateMCPUseTools(mcpName: string, tools: string[] | null) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 更新 MCP 可使用的工具列表
            this.coreManager.updateMCPUseTools(mcpName, tools);

            this.postMessage({
                command: 'updateMCPUseToolsResult',
                success: true,
                message: 'MCP 工具配置已更新'
            });

        } catch (error) {
            console.error('Error updating MCP use tools:', error);
            this.postMessage({
                command: 'updateMCPUseToolsResult',
                success: false,
                message: error instanceof Error ? error.message : '更新 MCP 工具配置失败'
            });
            vscode.window.showErrorMessage(`更新 MCP 工具配置失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 加载 Skill 信息列表
     */
    private async loadSkillsInfo() {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 获取 Skill 信息列表
            const skills = this.coreManager.getSkillsInfo();

            this.postMessage({
                command: 'loadSkillsInfoResult',
                success: true,
                data: skills
            });

        } catch (error) {
            console.error('Error loading skills info:', error);
            this.postMessage({
                command: 'loadSkillsInfoResult',
                success: false,
                data: [],
                message: error instanceof Error ? error.message : '加载 Skill 信息失败'
            });
        }
    }

    /**
     * 加载 Agent 信息列表
     */
    private async loadAgentsInfo() {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 获取 Agent 信息列表
            const agents = this.coreManager.getAgentsInfo();

            this.postMessage({
                command: 'loadAgentsInfoResult',
                success: true,
                data: agents
            });

        } catch (error) {
            console.error('Error loading agents info:', error);
            this.postMessage({
                command: 'loadAgentsInfoResult',
                success: false,
                data: [],
                message: error instanceof Error ? error.message : '加载 Agent 信息失败'
            });
        }
    }

    /**
     * 获取模型适配器类型
     */
    private getModelAdapter(provider: string, modelName: string) {
        try {
            const adapter = this.coreManager.getModelAdapter(provider, modelName);
            this.postMessage({
                command: 'modelAdapterResult',
                adapter: adapter || null
            });
        } catch (error) {
            // 静默失败，保持当前 adapter
        }
    }

    /**
     * 加载插件市场信息
     */
    private async loadPluginConfig() {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const data = await this.coreManager.getMarketplacePluginsInfo();

            this.postMessage({
                command: 'loadPluginConfigResult',
                success: true,
                data
            });

        } catch (error) {
            console.error('Error loading plugin config:', error);
            this.postMessage({
                command: 'loadPluginConfigResult',
                success: false,
                data: { marketplaces: [], plugins: [] },
                message: error instanceof Error ? error.message : '加载插件信息失败'
            });
        }
    }

    /**
     * 刷新插件市场信息
     */
    private async refreshPluginConfig() {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const data = await this.coreManager.refreshMarketplacePluginsInfo();

            this.postMessage({
                command: 'refreshPluginConfigResult',
                success: true,
                data
            });

        } catch (error) {
            console.error('Error refreshing plugin config:', error);
            this.postMessage({
                command: 'refreshPluginConfigResult',
                success: false,
                message: error instanceof Error ? error.message : '刷新插件信息失败'
            });
            vscode.window.showErrorMessage(`刷新插件信息失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 安装插件
     */
    private async installPlugin(pluginName: string, marketplaceName: string, scope: string, key: string) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const data = await this.coreManager.installPlugin(pluginName, marketplaceName, scope);

            this.postMessage({
                command: 'installPluginResult',
                success: true,
                key,
                data
            });

        } catch (error) {
            console.error('Error installing plugin:', error);
            this.postMessage({
                command: 'installPluginResult',
                success: false,
                key,
                message: error instanceof Error ? error.message : '安装插件失败'
            });
            vscode.window.showErrorMessage(`安装插件失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 卸载插件
     */
    private async uninstallPlugin(pluginName: string, marketplaceName: string, scope: string, key: string) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const data = await this.coreManager.uninstallPlugin(pluginName, marketplaceName, scope);

            this.postMessage({
                command: 'uninstallPluginResult',
                success: true,
                key,
                data
            });

        } catch (error) {
            console.error('Error uninstalling plugin:', error);
            this.postMessage({
                command: 'uninstallPluginResult',
                success: false,
                key,
                message: error instanceof Error ? error.message : '卸载插件失败'
            });
            vscode.window.showErrorMessage(`卸载插件失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 启用插件
     */
    private async enablePlugin(pluginName: string, marketplaceName: string, scope: string) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const data = await this.coreManager.enablePlugin(pluginName, marketplaceName, scope);

            this.postMessage({
                command: 'enablePluginResult',
                success: true,
                data
            });

        } catch (error) {
            console.error('Error enabling plugin:', error);
            this.postMessage({
                command: 'enablePluginResult',
                success: false,
                message: error instanceof Error ? error.message : '启用插件失败'
            });
            vscode.window.showErrorMessage(`启用插件失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 禁用插件
     */
    private async disablePlugin(pluginName: string, marketplaceName: string, scope: string) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const data = await this.coreManager.disablePlugin(pluginName, marketplaceName, scope);

            this.postMessage({
                command: 'disablePluginResult',
                success: true,
                data
            });

        } catch (error) {
            console.error('Error disabling plugin:', error);
            this.postMessage({
                command: 'disablePluginResult',
                success: false,
                message: error instanceof Error ? error.message : '禁用插件失败'
            });
            vscode.window.showErrorMessage(`禁用插件失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 更新插件市场
     */
    private async updateMarketplace(marketplaceName: string) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const data = await this.coreManager.updateMarketplace(marketplaceName);

            this.postMessage({
                command: 'updateMarketplaceResult',
                success: true,
                name: marketplaceName,
                data
            });

        } catch (error) {
            console.error('Error updating marketplace:', error);
            this.postMessage({
                command: 'updateMarketplaceResult',
                success: false,
                name: marketplaceName,
                message: error instanceof Error ? error.message : '更新市场失败'
            });
            vscode.window.showErrorMessage(`更新插件市场失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 移除插件市场
     */
    private async removeMarketplace(marketplaceName: string) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const data = await this.coreManager.removeMarketplace(marketplaceName);

            this.postMessage({
                command: 'removeMarketplaceResult',
                success: true,
                name: marketplaceName,
                data
            });

        } catch (error) {
            console.error('Error removing marketplace:', error);
            this.postMessage({
                command: 'removeMarketplaceResult',
                success: false,
                name: marketplaceName,
                message: error instanceof Error ? error.message : '移除市场失败'
            });
            vscode.window.showErrorMessage(`移除插件市场失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 添加插件市场（GitHub 或本地目录）
     */
    private async addMarketplace(type: 'github' | 'directory', value: string) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            const data = type === 'github'
                ? await this.coreManager.addMarketplaceFromGit(value)
                : await this.coreManager.addMarketplaceFromDirectory(value);

            this.postMessage({
                command: 'addMarketplaceResult',
                success: true,
                data
            });

        } catch (error) {
            console.error('Error adding marketplace:', error);
            this.postMessage({
                command: 'addMarketplaceResult',
                success: false,
                message: error instanceof Error ? error.message : '添加市场失败'
            });
            vscode.window.showErrorMessage(`添加插件市场失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 添加新 Agent
     */
    private async addAgent(data: {
        name: string;
        description: string;
        tools?: string[] | '*';
        prompt: string;
        model?: string;
        locate?: 'project' | 'user';
    }) {
        if (!this.panel) return;

        try {
            await this.ensureCoreReady();

            // 调用 sema-core 添加 Agent
            const result = this.coreManager.addAgentConf({
                name: data.name,
                description: data.description,
                tools: data.tools,
                prompt: data.prompt,
                model: data.model,
                locate: data.locate || 'user'
            });

            if (result) {
                this.postMessage({
                    command: 'addAgentResult',
                    success: true,
                    message: 'Agent 创建成功'
                });

                vscode.window.showInformationMessage(`Agent "${data.name}" 创建成功`);

                // 重新加载 Agent 列表
                this.loadAgentsInfo();
            } else {
                this.postMessage({
                    command: 'addAgentResult',
                    success: false,
                    message: '创建 Agent 失败'
                });
            }

        } catch (error) {
            console.error('Error adding agent:', error);
            this.postMessage({
                command: 'addAgentResult',
                success: false,
                message: error instanceof Error ? error.message : '创建 Agent 失败'
            });
            vscode.window.showErrorMessage(`创建 Agent 失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
}
