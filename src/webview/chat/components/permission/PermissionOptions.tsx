import React, { useState, useEffect, useRef } from 'react';

interface PermissionOptionsProps {
    options: {
        agree: string;
        allow: string;
        refuse: string;
    };
    onSelect: (action: 'agree' | 'allow' | 'refuse', customInput?: string) => void;
    onCancel?: () => void;
    autoFocus?: boolean;
    showCustomInput?: boolean;
    customInputPlaceholder?: string;
}

const PermissionOptions: React.FC<PermissionOptionsProps> = ({
    options,
    onSelect,
    onCancel,
    autoFocus = true,
    showCustomInput = true,
    customInputPlaceholder = 'Tell Sema what to do instead'
}) => {
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const [customInput, setCustomInput] = useState<string>('');
    const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
    const [isComposing, setIsComposing] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // 计算总选项数（3个按钮 + 可能的输入框）
    const totalOptions = showCustomInput ? 4 : 3;

    // 格式化文本，提取反引号中的内容并加粗
    const formatAllowText = (text: string, showPrefix: boolean) => {
        const prefix = showPrefix ? '❯ ' : '';
        const match = text.match(/`([^`]+)`/);
        if (match) {
            const content = match[1];
            const before = text.substring(0, match.index);
            const after = text.substring(match.index! + match[0].length);

            // 使用 span 包裹整体，包含前缀确保文本作为单一文本流正常换行
            return (
                <span>
                    {prefix}{before}<strong>{content}</strong>{after}
                </span>
            );
        }
        return <span>{prefix}{text}</span>;
    };

    // 处理键盘事件
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // 如果输入框获得焦点，只处理特定按键
            if (isInputFocused) {
                // 输入法组合输入中，不处理 ESC
                if (event.key === 'Escape' && !isComposing) {
                    event.preventDefault();
                    setIsInputFocused(false);
                    setSelectedIndex(2);
                    containerRef.current?.focus();
                    return;
                }

                if (event.key === 'Enter' && customInput.trim()) {
                    event.preventDefault();
                    onSelect(customInput.trim() as any);
                } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setIsInputFocused(false);
                    setSelectedIndex(2);
                    containerRef.current?.focus();
                }
                return;
            }

            // 处理 ESC 和 Ctrl+C 中断
            if (event.key === 'Escape' || (event.key === 'c' && event.ctrlKey)) {
                event.preventDefault();
                onCancel?.();
                return;
            }

            switch (event.key) {
                case 'ArrowUp':
                    event.preventDefault();
                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalOptions - 1));
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    if (showCustomInput && selectedIndex === 2) {
                        // 从 refuse 按钮移动到输入框
                        setSelectedIndex(3);
                        setIsInputFocused(true);
                        setTimeout(() => inputRef.current?.focus(), 0);
                    } else if (selectedIndex === totalOptions - 1) {
                        setSelectedIndex(0);
                        setIsInputFocused(false);
                    } else {
                        setSelectedIndex((prev) => prev + 1);
                    }
                    break;
                case 'Enter':
                    event.preventDefault();
                    if (selectedIndex === 3 && showCustomInput) {
                        // 选中输入框时，聚焦输入框
                        setIsInputFocused(true);
                        setTimeout(() => inputRef.current?.focus(), 0);
                    } else {
                        handleSelect();
                    }
                    break;
            }
        };

        if (containerRef.current) {
            containerRef.current.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            if (containerRef.current) {
                containerRef.current.removeEventListener('keydown', handleKeyDown);
            }
        };
    }, [selectedIndex, onCancel, isInputFocused, customInput, showCustomInput, totalOptions]);

    // 自动聚焦
    useEffect(() => {
        if (autoFocus && containerRef.current) {
            containerRef.current.focus();
        }
    }, [autoFocus]);

    const handleSelect = () => {
        const actions: ('agree' | 'allow' | 'refuse')[] = ['agree', 'allow', 'refuse'];
        onSelect(actions[selectedIndex]);
    };

    const handleClick = (index: number, action: 'agree' | 'allow' | 'refuse') => {
        setSelectedIndex(index);
        setIsInputFocused(false);
        onSelect(action);
    };

    const handleInputSubmit = () => {
        if (customInput.trim()) {
            onSelect(customInput.trim() as any);
        }
    };

    const handleInputFocus = () => {
        setSelectedIndex(3);
        setIsInputFocused(true);
    };

    const handleInputBlur = () => {
        setIsInputFocused(false);
    };

    return (
        <div
            className="bash-permission-buttons"
            ref={containerRef}
            tabIndex={0}
            style={{ outline: 'none' }}
        >
            <button
                className={`bash-permission-btn ${selectedIndex === 0 ? 'selected' : ''}`}
                onClick={() => handleClick(0, 'agree')}
            >
                {selectedIndex === 0 && '❯ '}{options.agree}
            </button>
            <button
                className={`bash-permission-btn ${selectedIndex === 1 ? 'selected' : ''}`}
                onClick={() => handleClick(1, 'allow')}
            >
                {formatAllowText(options.allow, selectedIndex === 1)}
            </button>
            <button
                className={`bash-permission-btn  ${selectedIndex === 2 ? 'selected' : ''}`}
                onClick={() => handleClick(2, 'refuse')}
            >
                {selectedIndex === 2 && '❯ '}{options.refuse}
            </button>
            {showCustomInput && (
                <div className="permission-custom-input-wrapper">
                    <input
                        ref={inputRef}
                        type="text"
                        className="permission-custom-input"
                        placeholder={customInputPlaceholder}
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                        onCompositionStart={() => setIsComposing(true)}
                        onCompositionEnd={() => setIsComposing(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && customInput.trim() && !isComposing) {
                                e.preventDefault();
                                e.stopPropagation();
                                handleInputSubmit();
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default PermissionOptions;
