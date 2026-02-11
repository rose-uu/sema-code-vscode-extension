import { useState, useEffect, RefObject, useCallback, useMemo } from 'react';
import { getHighlightedCommand } from '../utils/commandUtils';

export interface UseCommandHighlightReturn {
    highlightedCommand: string;
    commandStartPos: number;
    commandEndPos: number;
    cursorPosition: number;
    setCursorPosition: (position: number) => void;
}

/**
 * 命令高亮管理 Hook
 */
export const useCommandHighlight = (
    inputValue: string,
    inputBoxRef: RefObject<HTMLTextAreaElement>
): UseCommandHighlightReturn => {
    const [highlightedCommand, setHighlightedCommand] = useState<string>('');
    const [commandStartPos, setCommandStartPos] = useState<number>(-1);
    const [commandEndPos, setCommandEndPos] = useState<number>(-1);
    const [cursorPosition, setCursorPosition] = useState<number>(0);

    // 使用 useMemo 缓存命令信息，避免不必要的重新计算
    const commandInfo = useMemo(() => {
        return getHighlightedCommand(inputValue);
    }, [inputValue]);

    // 更新命令高亮状态
    const updateCommandHighlight = useCallback(() => {
        if (commandInfo) {
            setHighlightedCommand(commandInfo.command);
            setCommandStartPos(commandInfo.startPos);
            setCommandEndPos(commandInfo.endPos);
        } else {
            setHighlightedCommand('');
            setCommandStartPos(-1);
            setCommandEndPos(-1);
        }
    }, [commandInfo]);

    // 监听命令信息变化，立即更新高亮
    useEffect(() => {
        updateCommandHighlight();
    }, [updateCommandHighlight]);

    // 将回调函数定义在组件顶层
    const updateCursorPosition = useCallback(() => {
        if (inputBoxRef.current) {
            const cursorPos = inputBoxRef.current.selectionStart;
            setCursorPosition(cursorPos);
        }
    }, []);

    // 处理滚动同步
    const handleScroll = useCallback(() => {
        if (inputBoxRef.current) {
            // 同步textarea的滚动位置到高亮元素
            const overlay = document.querySelector('.command-highlight-overlay') as HTMLElement;
            if (overlay) {
                overlay.scrollTop = inputBoxRef.current.scrollTop;
                overlay.scrollLeft = inputBoxRef.current.scrollLeft;
            }
        }
    }, []);

    // 监听光标位置变化和其他事件
    useEffect(() => {
        // 添加事件监听器
        const textarea = inputBoxRef.current;
        if (textarea) {
            textarea.addEventListener('keyup', updateCursorPosition);
            textarea.addEventListener('mouseup', updateCursorPosition);
            textarea.addEventListener('click', updateCursorPosition);
            textarea.addEventListener('focus', updateCursorPosition);
            textarea.addEventListener('scroll', handleScroll);
        }

        return () => {
            if (textarea) {
                textarea.removeEventListener('keyup', updateCursorPosition);
                textarea.removeEventListener('mouseup', updateCursorPosition);
                textarea.removeEventListener('click', updateCursorPosition);
                textarea.removeEventListener('focus', updateCursorPosition);
                textarea.removeEventListener('scroll', handleScroll);
            }
        };
    }, [inputBoxRef, updateCursorPosition, handleScroll]);

    return {
        highlightedCommand,
        commandStartPos,
        commandEndPos,
        cursorPosition,
        setCursorPosition
    };
};