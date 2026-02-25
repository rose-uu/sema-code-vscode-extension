import React from 'react';
import BaseBashContent from '../ui/BaseBashContent';
import UpdateCodeDiff from '../ui/UpdateCodeDiff';
import FileIcon from '../ui/FileIcon';
import { langMap } from '../../utils/fileLangTypeMap';
import { DiffContent } from '../../types';
import {
    isNotebookType,
    isMcpToolType,
    isSkillType,
    parseMcpToolName,
    stringToDiffContent
} from '../../utils/permissionUtils';
import { countDiffChanges } from '../../utils/diffParser';

interface PermissionContentProps {
    toolName: string;
    title: string;
    content: string | DiffContent;
    vscode?: any;
}

const PermissionContent: React.FC<PermissionContentProps> = ({
    toolName,
    title,
    content,
    vscode
}) => {
    // 计算增删行数
    const getDiffStats = () => {
        // 只有文件编辑/创建操作才显示 diff 统计
        if (
            toolName === 'Edit' ||
            toolName === 'Write'
        ) {
            if (typeof content === 'object' && 'type' in content && 'patch' in content) {
                const { addedCount, removedCount } = countDiffChanges(content as DiffContent);
                if (addedCount > 0 || removedCount > 0) {
                    return { addedCount, removedCount };
                }
            }
        }
        return null;
    };

    const diffStats = getDiffStats();

    // 渲染 diff 统计信息
    const renderDiffStats = () => {
        if (!diffStats) return null;

        return (
            <span className="bash-permission-diff-stats">
                {diffStats.addedCount > 0 && (
                    <span className="diff-added">+{diffStats.addedCount}</span>
                )}
                {diffStats.addedCount > 0 && diffStats.removedCount > 0 && ' '}
                {diffStats.removedCount > 0 && (
                    <span className="diff-removed">-{diffStats.removedCount}</span>
                )}
            </span>
        );
    };

    // 渲染Notebook相关的内容
    const renderNotebookContent = () => {
        const fileName = title;
        const displayFileName = fileName.split('/').pop() || fileName;
        const language = 'python';

        const diffContent = typeof content === 'string'
            ? stringToDiffContent(content)
            : content as DiffContent;

        return (
            <div className="file-permission-container">
                <div className="file-permission-title-wrapper">
                    <div className="file-permission-title-divider-top" />
                    <div className="file-permission-title">
                        <strong className="file-permission-action">Update Cell </strong>
                        <FileIcon fileName={displayFileName} isDirectory={false} size={18} />
                        <span className="file-permission-filename">{fileName}</span>
                    </div>
                    <div className="file-permission-title-divider-bottom" />
                </div>
                <UpdateCodeDiff
                    diffContent={diffContent}
                    language={language}
                />
                <div className="file-permission-code-divider" />
            </div>
        );
    };

    // 渲染MCP工具内容
    const renderMcpToolContent = () => {
        const { mcpName, toolName: parsedToolName } = parseMcpToolName(toolName);
        const displayName = `${mcpName} - ${parsedToolName}${title ? `(${title})` : ''}`;

        return (
            <div className="file-permission-container">
                <div className="file-permission-title-wrapper">
                    <div className="file-permission-title-divider-top" />
                    <div className="file-permission-title">
                        <strong className="file-permission-action">Tool use </strong>
                        <span className="file-permission-filename">{displayName}</span>
                    </div>
                    <div className="file-permission-title-divider-bottom" />
                </div>
                <div className="mcp-tool-content">
                    {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                </div>
                <div className="file-permission-code-divider" />
            </div>
        );
    };

    // 渲染Skill内容
    const renderSkillContent = () => {
        const skillName = title;

        return (
            <div className="file-permission-container">
                <div className="file-permission-title-wrapper">
                    <div className="file-permission-title-divider-top" />
                    <div className="file-permission-title">
                        <strong className="file-permission-action">Use skill </strong>
                        <span className="file-permission-filename">"{skillName}"</span>
                    </div>
                    <div className="file-permission-title-divider-bottom" />
                </div>
                <div className="skill-permission-info">
                    Code Agent may use instructions, code, or files from this Skill.
                </div>
                <div className="skill-permission-content">
                    {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                </div>
                <div className="file-permission-code-divider" />
            </div>
        );
    };

    // 渲染常规文件内容
    const renderRegularFileContent = () => {
        const fileName = title;
        const displayFileName = fileName.split('/').pop() || fileName;

        // 检测语言类型
        let language = 'plaintext';
        if (fileName) {
            const ext = fileName.split('.').pop()?.toLowerCase();
            if (ext && langMap[ext]) {
                language = langMap[ext];
            }
        }

        const diffContent = content as DiffContent;
        const isUpdate = toolName === 'Edit' || (diffContent && diffContent.type === 'diff');
        const actionLabel = isUpdate ? 'Update File' : 'Create File';

        const handleFileClick = () => {
            if (vscode && fileName) {
                const firstLine = diffContent?.patch?.[0]?.newStart ?? 1;
                vscode.postMessage({
                    type: 'openFile',
                    filePath: fileName,
                    line: firstLine
                });
            }
        };

        return (
            <div className="file-permission-container">
                <div className="file-permission-title-wrapper">
                    <div className="file-permission-title-divider-top" />
                    <div className="file-permission-title">
                        <strong className="file-permission-action">{actionLabel}</strong>
                        <div
                            className={`file-permission-file-left${isUpdate && vscode ? ' file-permission-file-left-clickable' : ''}`}
                            onClick={isUpdate && vscode ? handleFileClick : undefined}
                        >
                            <FileIcon fileName={displayFileName} isDirectory={false} size={18} />
                            <span className="file-permission-filename">{fileName}</span>
                            {renderDiffStats()}
                        </div>
                    </div>
                    <div className="file-permission-title-divider-bottom" />
                </div>
                <UpdateCodeDiff
                    diffContent={diffContent}
                    language={language}
                />
                <div className="file-permission-code-divider" />
            </div>
        );
    };

    // 渲染Bash命令内容
    const renderBashContent = () => {
        return (
            <div className="file-permission-container">
                <div className="file-permission-title-wrapper">
                    <div className="file-permission-title-divider-top" />
                    <div className="file-permission-title">
                        <strong className="file-permission-action">Bash command</strong>
                    </div>
                </div>
                <div className="bash-permission-bash-command">
                    <BaseBashContent command={title} />
                </div>
                <div className="bash-permission-bash-description">
                    {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                </div>
            </div>
        );
    };

    // 根据工具类型渲染对应内容
    if (toolName === 'Bash') {
        return renderBashContent();
    } else if (isSkillType(toolName)) {
        return renderSkillContent();
    } else if (isMcpToolType(toolName)) {
        return renderMcpToolContent();
    } else if (isNotebookType(toolName)) {
        return renderNotebookContent();
    } else if (
        toolName === 'Write' ||
        toolName === 'Edit' 
    ) {
        return renderRegularFileContent();
    }

    return null;
};

export default PermissionContent;
