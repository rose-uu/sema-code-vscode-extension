import React, { useState, useMemo } from 'react';
import { ToggleIcon } from '../../components/ui/IconButton';
import BaseBashContent from '../../components/ui/BaseBashContent';
import { ToolContent } from '../../types';

interface BashBlockProps {
    content: ToolContent;
}

const BashBlock: React.FC<BashBlockProps> = ({ content: toolContent }) => {
    // console.log('BashBlock:', JSON.stringify(toolContent));
    const [isExpanded, setIsExpanded] = useState(true);

    // 模拟终端 \r 行为：\r 将光标移到行首，后续字符覆盖原内容
    const processTerminalOutput = (text: string): string[] => {
        const resultLines: string[] = [];
        let currentLineChars: string[] = [];
        let pos = 0;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '\r') {
                if (i + 1 < text.length && text[i + 1] === '\n') {
                    // \r\n：Windows 换行
                    resultLines.push(currentLineChars.join(''));
                    currentLineChars = [];
                    pos = 0;
                    i++;
                } else {
                    // 单独 \r：光标回到行首，不清除内容，后续字符覆盖
                    pos = 0;
                }
            } else if (char === '\n') {
                resultLines.push(currentLineChars.join(''));
                currentLineChars = [];
                pos = 0;
            } else {
                currentLineChars[pos] = char;
                pos++;
            }
        }

        const lastLine = currentLineChars.join('');
        if (lastLine) {
            resultLines.push(lastLine);
        }

        return resultLines;
    };

    // 解析结构化数据
    const parsedContent = useMemo(() => {
        const { title, content } = toolContent;

        let command = title;
        // content 包含输出内容
        let outputLines: string[] = [];
        if (content && typeof content === 'string') {
            outputLines = processTerminalOutput(content).filter(line => line.trim());
        }

        return { command, outputLines };
    }, [toolContent]);

    const { command, outputLines } = parsedContent;
    const isStreaming = toolContent.completed === false;

    const handleToggle = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="bash-block">
            <div className="bash-block-header" onClick={handleToggle}>
                <div className="bash-block-title">
                    <span className="bash-title-text">Bash</span>
                    {isStreaming && <span className="bash-streaming-dot" />}
                    <div className="bash-toggle-btn">
                        <ToggleIcon isExpanded={isExpanded} />
                    </div>
                </div>
            </div>
            {isExpanded && (
                <div className="bash-block-content">
                    {command && (
                        <BaseBashContent command={command} />
                    )}
                    {outputLines.length > 0 && (
                        <pre className="bash-output">{outputLines.join('\n')}</pre>
                    )}
                </div>
            )}
        </div>
    );
};

export default BashBlock;