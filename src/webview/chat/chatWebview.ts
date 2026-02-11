import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';

/**
 * ChatWebviewProvider - 为聊天界面提供 React webview
 */
export class ChatWebviewProvider {
    private view?: vscode.WebviewView;

    constructor(private readonly extensionUri: vscode.Uri) {}

    public setWebviewView(webviewView: vscode.WebviewView) {
        this.view = webviewView;
        this.view.webview.html = this.getHtmlContent(this.view.webview);
    }

    /**
     * 向 webview 发送消息
     */
    public postMessage(message: any): void {
        if (this.view) {
            this.view.webview.postMessage(message);
        }
    }

    /**
     * 获取 HTML 内容
     */
    private getHtmlContent(webview: vscode.Webview): string {
        // 获取打包后的 JS 文件路径
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'chat.js')
        );

        // 获取 nonce 用于安全策略
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; 
        style-src ${webview.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com; 
        script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com; 
        font-src ${webview.cspSource};">
    <title>Code Assistant</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css">
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private getNonce(): string {
        return crypto.randomBytes(16).toString('hex');
    }
}

