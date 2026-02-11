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

    // 解析结构化数据
    const parsedContent = useMemo(() => {
        const { title, content } = toolContent;

        let command = title;
        // content 包含输出内容
        const outputLines: string[] = [];
        if (content && typeof content === 'string') {
            const lines = content.split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    outputLines.push(line);
                }
            }
        }

        return { command, outputLines };
    }, [toolContent]);

    const { command, outputLines } = parsedContent;

    const handleToggle = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="bash-block">
            <div className="bash-block-header" onClick={handleToggle}>
                <div className="bash-block-title">
                    <span className="bash-title-text">Bash</span>
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