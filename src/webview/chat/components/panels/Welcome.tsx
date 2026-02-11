// Welcome.tsx
import React from 'react';

interface WelcomeProps {
    version?: string;
}

const Welcome: React.FC<WelcomeProps> = ({ version = '' }) => {
    const welcomeMessage = `Sema ${version ? `v${version}` : ''}

Sema是一个强大的 AI 驱动的终端助手，专为开发者设计。它能够理解代码库，智能编辑文件，执行命令，并自动化各种开发工作流程。

常见任务：
• 询问关于您的代码库的问题 > 介绍当前项目
• 编辑文件 > 更新 App.tsx 以...
• 运行压缩命令 > /compact

设置sema至右侧界面：
 - 右键点击 Sema 图标
 - 选择 "Move To" → "Secondary Side Bar"
 - 恢复至左侧 右键点击面板标题，选择 "Move To" → "Move to Primary Side Bar" 

内置命令：
  /init - 初始化新的 AGENTS.md 文件
  /clear - 清除历史会话和上下文
  /compact - 压缩会话历史
  /review - 代码审查
  /explain - 代码解释
  /fix - 代码修复
  /comment - 代码注释
  /knowledge - 生成项目知识库文档
`;

    return (
        <div className="welcome-container">
            <div className="welcome-header">
                <span className="welcome-icon">🚀</span>
                <span className="welcome-title">欢迎使用 Sema</span>
            </div>
            <div className="welcome-message">
                {welcomeMessage.split('\n').map((line, index) => (
                    <div key={index} className="welcome-line">
                        {line.startsWith('Sema') && (line.includes('v') || line.trim() === 'Sema') ? (
                            <strong className="version-text">{line}</strong>
                        ) : line.startsWith('•') || /^\s{2}\//.test(line) ? (
                            <span className="command-text">{line}</span>
                        ) : line.trim() === '' ? (
                            <br />
                        ) : (
                            line
                        )}
                    </div>
                ))}
            </div>
            <div className="welcome-footer">
                <span className="hint-text">下滑查看更多帮助信息</span>
            </div>
        </div>
    );
};

export default Welcome;