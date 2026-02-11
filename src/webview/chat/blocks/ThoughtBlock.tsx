import React, { useState } from 'react';
import { ToggleIcon } from '../components/ui/IconButton';

interface ThoughtBlockProps {
    content: string;  // thinking 内容
    isThinking: boolean;  // 是否正在 thinking 阶段
}

const ThoughtBlock: React.FC<ThoughtBlockProps> = React.memo(({
    content,
    isThinking
}) => {
    // 默认折叠状态
    const [isExpanded, setIsExpanded] = useState(false);

    const handleToggle = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="thought-block">
            <div
                className="thought-block-header"
                onClick={handleToggle}
            >
                <div className="thought-block-title">
                    <span className="thought-title-text">
                        {isThinking ? 'Thinking...' : 'Thought'}
                    </span>
                    <div className="thought-toggle-btn">
                        <ToggleIcon isExpanded={isExpanded} />
                    </div>
                </div>
            </div>
            {isExpanded && content && (
                <div className="thought-block-content">
                    <div className="thought-content">
                        {content}
                    </div>
                </div>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    // 当 isThinking 状态变化或内容变化时重新渲染
    return prevProps.isThinking === nextProps.isThinking &&
           prevProps.content === nextProps.content;
});

ThoughtBlock.displayName = 'ThoughtBlock';

export default ThoughtBlock;