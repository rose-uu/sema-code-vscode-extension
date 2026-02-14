import * as vscode from 'vscode';
import { FileStateDiffManager } from '../managers/FileStateDiffManager';
import { FileOperationManager } from '../managers/FileOperationManager';
import { ChatWebviewProvider } from '../webview/chat/chatWebview';

export interface FileItem {
    path: string;
    name: string;
    isDirectory: boolean;
    startLine?: number;
    endLine?: number;
}

export interface MessageHandlerCallbacks {
    handleUserInput: (text: string, files?: Array<FileItem>) => Promise<void>;
    openConfigPanel: () => void;
    interrupt: () => Promise<void>;
    switchModel: (modelName: string) => Promise<void>;
    sendModelInfo: () => void;
    bashPermission: (action: string, command: string) => void;
    toolPermissionResponse: (response: any) => void;
    askQuestionResponse: (response: any) => void;
    planExitResponse: (response: any) => void;
    initializeSession: () => Promise<void>;
    checkConfiguration: () => Promise<void>;
    insertPermissionRequest: (permissionData: any) => void;
    updateAgentMode: (mode: 'Agent' | 'Plan') => Promise<void>;
}

/**
 * 处理来自 webview 的消息
 */
export class MessageHandler {

    constructor(
        private fileStateDiffManager: FileStateDiffManager,
        private fileOperationManager: FileOperationManager,
        private chatWebviewProvider: ChatWebviewProvider,
        private callbacks: MessageHandlerCallbacks
    ) { }

    /**
     * 处理 webview 消息
     */
    async handleMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'frontendReady':
                // 前端准备就绪，现在可以初始化会话
               // console.log('Frontend ready, initializing session...');
                await this.callbacks.initializeSession();
                // 在前端准备就绪后检查配置
                await this.callbacks.checkConfiguration();
                break;
            case 'sendInput':
                await this.callbacks.handleUserInput(message.text, message.files);
                break;
            case 'openConfig':
                this.callbacks.openConfigPanel();
                break;
            case 'interrupt':
                await this.callbacks.interrupt();
                break;
            case 'openFile':
                await this.fileOperationManager.openFileAtLine(message.filePath, message.line, message.endLine);
                break;
            case 'requestWorkspaceFiles':
                await this.sendFilesToWebview(await this.fileOperationManager.getWorkspaceFiles());
                break;
            case 'searchWorkspaceFiles':
                await this.sendFilesToWebview(await this.fileOperationManager.searchWorkspaceFiles((message.query || '')));
                break;
            case 'requestModelInfo':
                this.callbacks.sendModelInfo();
                break;
            case 'switchModel':
                await this.callbacks.switchModel(message.modelName);
                break;
            case 'restoreFromSnapshots':
                await this.handleRestoreFromSnapshots(message.filePaths);
                break;
            case 'showFileDiff':
                await this.fileStateDiffManager.showFileDiff(message.filePath, message.minLine);
                break;
            case 'getFileChangeStats':
                await this.handleGetFileChangeStats(message.filePath);
                break;
            case 'searchContentInFiles':
                await this.handleSearchContentInFiles(message.content);
                break;
            case 'bashPermission':
                await this.callbacks.bashPermission(message.action, message.command);
                break;
            case 'toolPermissionResponse':
                this.callbacks.toolPermissionResponse(message.response);
                break;
            case 'askQuestionResponse':
                this.callbacks.askQuestionResponse(message.response);
                break;
            case 'planExitResponse':
                this.callbacks.planExitResponse(message.response);
                break;
            case 'verifyFilePath':
                await this.handleVerifyFilePath(message.filePath, message.tempId, message.originalCode, message.lineInfo);
                break;
            case 'insertPermissionRequest':
                this.callbacks.insertPermissionRequest(message.permissionData);
                break;
            case 'updateAgentMode':
                await this.callbacks.updateAgentMode(message.mode);
                break;
        }
    }

    /**
     * 发送文件列表到 webview
     */
    private sendFilesToWebview(files: { path: string; isDirectory: boolean; isOpen?: boolean }[]): void {
        this.chatWebviewProvider.postMessage({
            type: 'workspaceFiles',
            files: files.map(item => ({
                path: item.path,
                isDirectory: item.isDirectory,
                isOpen: item.isOpen
            }))
        });
    }

    /**
     * 处理从快照恢复
     */
    private async handleRestoreFromSnapshots(filePaths: string[]): Promise<void> {
        // 恢复指定文件到快照状态
        await this.fileStateDiffManager.revertAllChanges(filePaths);

        this.chatWebviewProvider.postMessage({
            type: 'clearFileChanges'
        });

    }

    /**
     * 处理获取文件变更统计
     */
    private async handleGetFileChangeStats(filePath: string): Promise<void> {
        if (filePath) {
            try {
                const stats = await this.fileStateDiffManager.getFileChangeStats(filePath);
                // 返回统计信息给前端
                this.chatWebviewProvider.postMessage({
                    type: 'fileChangeStats',
                    fullPath: filePath,
                    stats: stats
                });
            } catch (error) {
                console.error('Failed to get file change stats:', error);
            }
        }
    }

    /**
     * 处理搜索文件内容
     */
    private async handleSearchContentInFiles(content: string): Promise<void> {
        try {
            const result = await this.fileOperationManager.searchContentInFiles(content);

            this.chatWebviewProvider.postMessage({
                type: 'contentSearchResult',
                result: result
            });
        } catch (error) {
            console.error('Failed to search content in files:', error);
            this.chatWebviewProvider.postMessage({
                type: 'contentSearchResult',
                result: null
            });
        }
    }

    /**
     * 处理文件路径验证
     */
    private async handleVerifyFilePath(filePath: string, tempId: string, originalCode: string, lineInfo?: string): Promise<void> {
        try {
            // 使用 FileOperationManager 检查文件是否存在
            const exists = await this.fileOperationManager.verifyFilePath(filePath);

            this.chatWebviewProvider.postMessage({
                type: 'filePathVerified',
                tempId: tempId,
                exists: exists,
                filePath: filePath,
                originalCode: originalCode,
                lineInfo: lineInfo
            });
        } catch (error) {
            console.error('Failed to verify file path:', error);
            this.chatWebviewProvider.postMessage({
                type: 'filePathVerified',
                tempId: tempId,
                exists: false,
                filePath: filePath,
                originalCode: originalCode,
                lineInfo: lineInfo
            });
        }
    }

}