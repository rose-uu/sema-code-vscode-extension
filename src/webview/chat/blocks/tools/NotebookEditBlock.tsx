import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { VscodeApi, FileChange } from '../../types';
import { IconButton, ToggleIcon, CopyIcon } from '../../components/ui/IconButton';
import FileIcon from '../../components/ui/FileIcon';
import { ToolContent } from '../../types';
import UpdateCodeDiff from '../../components/ui/UpdateCodeDiff';
import { langMap } from '../../utils/fileLangTypeMap';

interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
}

interface DiffContent {
    type: string;
    patch: DiffHunk[];
    diffText: string;
}

interface NotebookEditBlockProps {
    content: ToolContent;
    vscode: VscodeApi;
    onFileChange?: (change: FileChange) => void;
}

const NotebookEditBlock: React.FC<NotebookEditBlockProps> = React.memo(({
    content: toolContent,
    vscode,
    onFileChange
}) => {
    const { title, summary, content } = toolContent;

    const [isExpanded, setIsExpanded] = useState(true);

    const parsedContent = useMemo(() => {
        const fileName = title || '';

        // 从 summary 中提取 cell 信息
        let cellNum = 0;
        const cellMatch = summary.match(/cell[:\s]+(\d+)/);
        if (cellMatch) {
            cellNum = parseInt(cellMatch[1]);
        }

        // 解析 diff 内容
        let diffContent: DiffContent | null = null;
        let isNewFile = false;

        if (typeof content === 'object' && content !== null && ((content as any).type === 'diff' || (content as any).type === 'new')) {
            diffContent = content as DiffContent;
            isNewFile = (content as any).type === 'new';
        }

        // 检测语言类型
        let language = 'plaintext';
        if (fileName) {
            const ext = fileName.split('.').pop()?.toLowerCase();
            if (ext && langMap[ext]) {
                language = langMap[ext];
            }
        }

        return {
            fileName,
            cellNum,
            diffContent,
            isNewFile,
            language
        };
    }, [title, summary, content]);

    const { fileName, cellNum, diffContent, isNewFile, language } = parsedContent;

    const displayFileName = fileName;

    const reportFileChange = useCallback(() => {
        if (onFileChange && fileName) {
            onFileChange({
                fileName: displayFileName,
                fullPath: fileName,
                type: 'edit',
                isNotebook: true,
                additions: cellNum,
                removals: 0,
                minLine: cellNum
            });
        }
    }, [onFileChange, fileName, displayFileName, cellNum]);

    useEffect(() => {
        reportFileChange();
    }, [reportFileChange]);

    const handleCopy = useCallback(() => {
        if (!diffContent) return;

        const lines: string[] = [];
        for (const hunk of diffContent.patch) {
            for (const line of hunk.lines) {
                const marker = line[0];
                const lineContent = line.substring(1);
                if (marker !== '-') {
                    lines.push(lineContent);
                }
            }
        }
        navigator.clipboard.writeText(lines.join('\n'));
    }, [diffContent]);

    const handleToggle = useCallback(() => {
        setIsExpanded(!isExpanded);
    }, [isExpanded]);

    const handleShowDiff = useCallback(async () => {
        if (fileName) {
            vscode.postMessage({
                type: 'showFileDiff',
                filePath: fileName,
                minLine: cellNum
            });
        }
    }, [fileName, cellNum, vscode]);

    if (!fileName || !diffContent) {
        return null;
    }

    return (
        <div className="edit-block">
            <div className="edit-block-header">
                <div className="edit-block-title" onClick={handleShowDiff}>
                    <span className="edit-type">Notebook</span>
                    <FileIcon
                        fileName={displayFileName}
                        isDirectory={false}
                        size={18}
                    />
                    <span className="file-name">{displayFileName}</span>
                    <span className="edit-stats">
                        {cellNum >= 0 && (
                            <span className="cell-info">cell:{cellNum}</span>
                        )}
                    </span>
                </div>
                <div className="edit-block-actions">
                    <IconButton onClick={handleCopy} title="复制代码">
                        <CopyIcon />
                    </IconButton>
                    <IconButton onClick={handleToggle} title={isExpanded ? "折叠" : "展开"}>
                        <ToggleIcon isExpanded={isExpanded} />
                    </IconButton>
                </div>
            </div>
            {isExpanded && (
                <div className={`edit-block-content ${isNewFile ? 'new-file' : ''}`}>
                    <UpdateCodeDiff
                        diffContent={diffContent}
                        language={language}
                    />
                </div>
            )}
        </div>
    );
});

NotebookEditBlock.displayName = 'NotebookEditBlock';

export default NotebookEditBlock;
