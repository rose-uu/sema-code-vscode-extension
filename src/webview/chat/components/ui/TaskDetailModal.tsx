import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { Message, VscodeApi } from '../../types';
import EditBlock from '../../blocks/tools/EditBlock';
import ReadBlock from '../../blocks/tools/ReadBlock';
import PubBlock from '../../blocks/tools/PubBlock';
import BashBlock from '../../blocks/tools/BashBlock';
import AiResponseBlock from '../../blocks/AiResponseBlock';
import UserInputBlock from '../../blocks/UserInputBlock';
import PermissionRequestBlock from '../permission/PermissionRequestBlock';
import ToolErrorBlock from '../../blocks/ToolErrorBlock';
import SupplementaryInfo from './SupplementaryInfo';
import PlanImplementPanel from './PlanImplementPanel';

interface TaskDetailModalProps {
    title: string;
    status: 'running' | 'completed' | 'failed' | 'interrupted';
    taskMessages: Message[];
    vscode: VscodeApi;
    onClose: () => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
    title,
    status,
    taskMessages,
    vscode,
    onClose
}) => {
    const contentRef = useRef<HTMLDivElement>(null);

    // 点击背景关闭弹窗
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    // ESC 键关闭弹窗
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // 应用代码高亮
    useEffect(() => {
        if (window.hljs && contentRef.current) {
            contentRef.current.querySelectorAll('pre code').forEach((block) => {
                if (!block.classList.contains('hljs')) {
                    window.hljs.highlightElement(block);
                }
            });
        }
    }, [taskMessages]);

    // 滚动到底部
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [taskMessages]);

    // 获取状态显示文本
    const getStatusText = () => {
        switch (status) {
            case 'running':
                return '运行中...';
            case 'completed':
                return '已完成';
            case 'failed':
                return '失败';
            default:
                return '';
        }
    };

    // 渲染工具消息
    const renderToolMessage = useCallback((message: Message, key: string) => {
        switch (message.toolName) {
            case 'Write':
            case 'Edit':
            case 'NotebookEdit':
                return (
                    <EditBlock
                        key={key}
                        content={message.content}
                        vscode={vscode}
                    />
                );

            case 'TodoWrite':
                return null;

            case 'Read':
            case 'NotebookRead':
                return <ReadBlock key={key} content={message.content} vscode={vscode} />;

            case 'Bash':
                return <BashBlock key={key} content={message.content} />;

            default:
                return <PubBlock key={key} content={message.content} />;
        }
    }, [vscode]);

    // 渲染消息列表
    const renderedMessages = useMemo(() => {
        if (!taskMessages || taskMessages.length === 0) {
            return (
                <div className="task-modal-empty">
                    暂无消息记录
                </div>
            );
        }

        return taskMessages.map((message) => {
            const key = message.id;

            switch (message.type) {
                case 'user':
                    return (
                        <UserInputBlock key={key} content={message.content} />
                    );

                case 'assistant':
                    const hasContent = message.content && message.content.content && message.content.content.trim().length > 0;

                    return (
                        <React.Fragment key={key}>
                            {hasContent && (
                                <AiResponseBlock
                                    content={message.content.content}
                                    isStreaming={!message.content.completed}
                                    vscode={vscode}
                                />
                            )}
                        </React.Fragment>
                    );

                case 'tool':
                    return renderToolMessage(message, key);

                case 'permission_request':
                    return (
                        <PermissionRequestBlock
                            key={key}
                            permissionData={message.content}
                        />
                    );

                case 'system':
                    if (message.content.type === 'interrupt') {
                        return <SupplementaryInfo key={key} items={['interrupted']} />;
                    }
                    else if (message.content.type === 'tool_error') {
                        return (
                            <ToolErrorBlock
                                key={key}
                                toolName={message.content.toolName || ''}
                                title={message.content.title || ''}
                                content={message.content.content || ''}
                            />
                        );
                    }
                    return null;

                default:
                    return null;
            }
        });
    }, [taskMessages, vscode, renderToolMessage]);

    return (
        <div className="task-modal-overlay" onClick={handleBackdropClick}>
            <div className="task-modal-container">
                <div className="task-modal-header">
                    <div className="task-modal-title">
                        <span className={`task-modal-status task-status-${status}`}>
                            {getStatusText()}
                        </span>
                        <span className="task-modal-title-text">{title}</span>
                    </div>
                    <button className="task-modal-close" onClick={onClose} title="关闭">
                        ✕
                    </button>
                </div>
                <div className="task-modal-content" ref={contentRef}>
                    {renderedMessages}
                </div>
            </div>
        </div>
    );
};

export default TaskDetailModal;
