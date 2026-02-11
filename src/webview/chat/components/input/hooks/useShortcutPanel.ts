import { useState, useEffect, RefObject } from 'react';

export interface UseShortcutPanelReturn {
    showShortcutPanel: boolean;
    setShowShortcutPanel: (show: boolean) => void;
    handleToggleShortcutPanel: () => void;
    handleExecuteShortcut: (
        text: string,
        send: boolean,
        setInputValue: (value: string) => void,
        onSend: (text: string, files: any[]) => void,
        selectedFiles: any[],
        isExpanded: boolean,
        inputBoxRef: RefObject<HTMLTextAreaElement>
    ) => void;
}

/**
 * 快捷面板管理 Hook
 */
export const useShortcutPanel = (
    disabled: boolean,
    shortcutPanelRef: RefObject<HTMLDivElement>,
    shortcutButtonRef: RefObject<HTMLButtonElement>
): UseShortcutPanelReturn => {
    const [showShortcutPanel, setShowShortcutPanel] = useState<boolean>(false);

    const FULL_MAX_HEIGHT = 500; // 全屏最大高度
    const DEFAULT_MAX_HEIGHT = 200; // 默认最大高度

    // 点击外部关闭快捷面板
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isOutsidePanel = shortcutPanelRef.current && !shortcutPanelRef.current.contains(target);
            const isOutsideButton = shortcutButtonRef.current && !shortcutButtonRef.current.contains(target);

            if (isOutsidePanel && isOutsideButton) {
                setShowShortcutPanel(false);
            }
        };

        if (showShortcutPanel) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showShortcutPanel, shortcutPanelRef, shortcutButtonRef]);

    const handleToggleShortcutPanel = () => {
        if (disabled) return;
        setShowShortcutPanel(!showShortcutPanel);
    };

    const handleExecuteShortcut = (
        text: string,
        send: boolean,
        setInputValue: (value: string) => void,
        onSend: (text: string, files: any[]) => void,
        selectedFiles: any[],
        isExpanded: boolean,
        inputBoxRef: RefObject<HTMLTextAreaElement>
    ) => {
        setShowShortcutPanel(false);

        // 将命令文本放入，格式为 "/命令 "（命令后加一个空格）
        const newInputValue = `/${text} `;
        setInputValue(newInputValue);

        // 如果 send 为 true，直接发送
        if (send) {
            setTimeout(() => {
                onSend(newInputValue.trim(), selectedFiles);
                setInputValue('');

                // 重置输入框高度
                if (inputBoxRef.current) {
                    if (isExpanded) {
                        inputBoxRef.current.style.height = FULL_MAX_HEIGHT + 'px';
                    } else {
                        inputBoxRef.current.style.height = 'auto';
                    }
                }
            }, 0);
            return;
        }

        // 将光标移到末尾并聚焦
        setTimeout(() => {
            if (inputBoxRef.current) {
                inputBoxRef.current.focus();
                inputBoxRef.current.selectionStart = newInputValue.length;
                inputBoxRef.current.selectionEnd = newInputValue.length;

                // 自动调整高度
                if (isExpanded) {
                    inputBoxRef.current.style.height = FULL_MAX_HEIGHT + 'px';
                } else {
                    inputBoxRef.current.style.height = 'auto';
                    inputBoxRef.current.style.height = Math.min(inputBoxRef.current.scrollHeight, DEFAULT_MAX_HEIGHT) + 'px';
                }
            }
        }, 0);
    };

    return {
        showShortcutPanel,
        setShowShortcutPanel,
        handleToggleShortcutPanel,
        handleExecuteShortcut
    };
};