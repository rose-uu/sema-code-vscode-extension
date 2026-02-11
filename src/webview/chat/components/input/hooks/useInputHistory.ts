import { useState } from 'react';
import { SelectedFile } from '../../../types';

const MAX_HISTORY = 50; // 最多保存50条历史记录

export interface HistoryItem {
    text: string;
    files: SelectedFile[];
}

export interface UseInputHistoryReturn {
    inputHistory: HistoryItem[];
    historyIndex: number;
    tempInput: HistoryItem;
    addToHistory: (text: string, files: SelectedFile[]) => void;
    navigateHistory: (direction: 'up' | 'down', currentInput: string, currentFiles: SelectedFile[]) => HistoryItem;
    resetNavigation: () => void;
    exitNavigation: () => void;
    initializeHistory: (projectHistory: string[]) => void;
}

/**
 * 输入历史记录管理 Hook
 */
export const useInputHistory = (): UseInputHistoryReturn => {
    const [inputHistory, setInputHistory] = useState<HistoryItem[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);
    const [tempInput, setTempInput] = useState<HistoryItem>({ text: '', files: [] });

    const addToHistory = (text: string, files: SelectedFile[]) => {
        if (text) {
            // 检查是否与最近的历史记录完全相同（文本和文件都相同）
            const lastItem = inputHistory[inputHistory.length - 1];
            const isDuplicate = lastItem &&
                lastItem.text === text &&
                JSON.stringify(lastItem.files) === JSON.stringify(files);

            if (!isDuplicate) {
                const newHistory = [...inputHistory, { text, files: [...files] }];
                if (newHistory.length > MAX_HISTORY) {
                    newHistory.shift(); // 移除最旧的记录
                }
                setInputHistory(newHistory);
            }
        }
    };

    const navigateHistory = (direction: 'up' | 'down', currentInput: string, currentFiles: SelectedFile[]): HistoryItem => {
        if (direction === 'up' && inputHistory.length > 0) {
            if (historyIndex === -1) {
                // 首次按上键，保存当前输入
                setTempInput({ text: currentInput, files: [...currentFiles] });
                setHistoryIndex(inputHistory.length - 1);
                return inputHistory[inputHistory.length - 1];
            } else if (historyIndex > 0) {
                // 继续向上导航
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                return inputHistory[newIndex];
            }
        } else if (direction === 'down' && historyIndex !== -1) {
            if (historyIndex < inputHistory.length - 1) {
                // 继续向下导航
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                return inputHistory[newIndex];
            } else {
                // 回到最初的输入
                setHistoryIndex(-1);
                return tempInput;
            }
        }

        return { text: currentInput, files: currentFiles };
    };

    const resetNavigation = () => {
        setHistoryIndex(-1);
        setTempInput({ text: '', files: [] });
    };

    const exitNavigation = () => {
        setHistoryIndex(-1);
        setTempInput({ text: '', files: [] });
    };

    const initializeHistory = (projectHistory: string[]) => {
        // 将项目历史输入转换为 HistoryItem 格式（不包含文件信息）
        const historyItems: HistoryItem[] = projectHistory.map(text => ({
            text,
            files: []
        }));

        // 如果 projectHistory 是 0最新 -1最旧，需要反转数组
        const reversedHistory = historyItems.reverse();

        // 限制历史记录数量
        const limitedHistory = historyItems.slice(-MAX_HISTORY);

        setInputHistory(limitedHistory);
        // 重置导航状态
        setHistoryIndex(-1);
        setTempInput({ text: '', files: [] });
    };

    return {
        inputHistory,
        historyIndex,
        tempInput,
        addToHistory,
        navigateHistory,
        resetNavigation,
        exitNavigation,
        initializeHistory
    };
};