import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { Message, VscodeApi } from '../../types';
import EditBlock from '../../blocks/tools/EditBlock';
import NotebookEditBlock from '../../blocks/tools/NotebookEditBlock';
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
    const [userScrolled, setUserScrolled] = useState(false);
    const prevMessagesLengthRef = useRef(taskMessages.length);

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

    // 监听滚动事件，检测用户是否手动滚动
    useEffect(() => {
        const contentElement = contentRef.current;
        if (!contentElement) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = contentElement;
            // 如果用户滚动到了底部，可以重置 userScrolled 状态
            if (scrollHeight - scrollTop - clientHeight < 10) {
                setUserScrolled(false);
            } else {
                // 用户手动滚动到了非底部位置
                setUserScrolled(true);
            }
        };

        contentElement.addEventListener('scroll', handleScroll);
        return () => contentElement.removeEventListener('scroll', handleScroll);
    }, []);

    // 滚动到底部（仅在用户没有手动滚动且确实有新消息时）
    useEffect(() => {
        const contentElement = contentRef.current;
        if (!contentElement) return;

        // 检查是否有新消息添加
        const hasNewMessages = taskMessages.length > prevMessagesLengthRef.current;
        
        // 只有在用户没有手动滚动，并且确实有新消息时才自动滚动
        if (!userScrolled && hasNewMessages) {
            // 使用 setTimeout 确保在 DOM 更新后滚动
            setTimeout(() => {
                if (contentElement) {
                    contentElement.scrollTop = contentElement.scrollHeight;
                }
            }, 0);
        }

        // 更新上一次的消息长度
        prevMessagesLengthRef.current = taskMessages.length;
    }, [taskMessages, userScrolled]);

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
                return (
                    <EditBlock
                        key={key}
                        content={message.content}
                        vscode={vscode}
                    />
                );

            case 'NotebookEdit':
                return (
                    <NotebookEditBlock
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
                    if (message.content.type === 'interrupted') {
                        const USER_INTERRUPT_MESSAGE = '[Request interrupted by user]';
                        if (message.content.content === USER_INTERRUPT_MESSAGE) {
                            return <SupplementaryInfo key={key} items={['interrupted']} />;
                        }
                        return null;
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