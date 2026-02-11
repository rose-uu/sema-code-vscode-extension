import { useState, useEffect, useRef, RefObject } from 'react';
import { VscodeApi, FileItem, SelectedFile } from '../../../types';

// 最大可选择文件/目录数量
const MAX_SELECTED_FILES = 10;

export interface UseFileSelectionReturn {
    selectedFiles: SelectedFile[];
    showFilePicker: boolean;
    fileSearchQuery: string;
    availableFiles: FileItem[];
    isSearching: boolean;
    setSelectedFiles: (files: SelectedFile[]) => void;
    setShowFilePicker: (show: boolean) => void;
    setFileSearchQuery: (query: string) => void;
    handleAddFileClick: () => void;
    handleFileSelect: (fileItem: FileItem, inputValue: string, setInputValue: (value: string) => void, inputBoxRef: RefObject<HTMLTextAreaElement>) => void;
    handleRemoveFile: (filePath: string) => void;
    handleFileClick: (filePath: string, startLine?: number) => void;
}

/**
 * 文件选择管理 Hook
 */
export const useFileSelection = (
    vscode: VscodeApi,
    disabled: boolean,
    filePickerRef: RefObject<HTMLDivElement>,
    addFileButtonRef: RefObject<HTMLButtonElement>
): UseFileSelectionReturn => {
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [showFilePicker, setShowFilePicker] = useState<boolean>(false);
    const [fileSearchQuery, setFileSearchQuery] = useState<string>('');
    const [availableFiles, setAvailableFiles] = useState<FileItem[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 监听来自扩展的文件列表消息
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'workspaceFiles') {
                setAvailableFiles(message.files);
                setIsSearching(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    // 清理搜索定时器
    useEffect(() => {
        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
    }, []);

    // 点击外部关闭文件选择器
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isOutsidePicker = filePickerRef.current && !filePickerRef.current.contains(target);
            const isOutsideButton = addFileButtonRef.current && !addFileButtonRef.current.contains(target);

            if (isOutsidePicker && isOutsideButton) {
                setShowFilePicker(false);
            }
        };

        if (showFilePicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showFilePicker, filePickerRef, addFileButtonRef]);

    // 搜索文件（防抖）
    useEffect(() => {
        // 清除之前的定时器
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        if (fileSearchQuery.trim() === '') {
            // 空搜索，重新请求默认列表
            vscode.postMessage({
                type: 'requestWorkspaceFiles'
            });
        } else {
            // 延迟搜索（防抖）
            setIsSearching(true);
            searchTimerRef.current = setTimeout(() => {
                vscode.postMessage({
                    type: 'searchWorkspaceFiles',
                    query: fileSearchQuery
                });
            }, 300);
        }
    }, [fileSearchQuery, vscode]);

    const handleAddFileClick = () => {
        if (disabled) return;

        // 请求工作区文件列表
        vscode.postMessage({
            type: 'requestWorkspaceFiles'
        });
        setShowFilePicker(!showFilePicker);
        setFileSearchQuery('');
    };

    const handleFileSelect = (
        fileItem: FileItem,
        inputValue: string,
        setInputValue: (value: string) => void,
        inputBoxRef: RefObject<HTMLTextAreaElement>
    ) => {
        const fileName = fileItem.path.split('/').pop() || fileItem.path;

        // 限制最多选择的文件/目录数量
        if (selectedFiles.length >= MAX_SELECTED_FILES) {
            return;
        }

        // 避免重复添加
        if (!selectedFiles.some(f => f.path === fileItem.path)) {
            setSelectedFiles([...selectedFiles, {
                path: fileItem.path,
                name: fileName,
                isDirectory: fileItem.isDirectory,
                startLine: undefined,
                endLine: undefined
            }]);
        }

        // 移除输入框中的 @ 及其后面的搜索内容
        const lastAtIndex = inputValue.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const textBeforeAt = inputValue.substring(0, lastAtIndex);
            const textAfterAt = inputValue.substring(lastAtIndex + 1);
            const spaceAfterQuery = textAfterAt.indexOf(' ');

            let newInputValue;
            if (spaceAfterQuery !== -1) {
                // 如果 @ 后面还有空格和其他内容，保留空格后的内容
                newInputValue = textBeforeAt + textAfterAt.substring(spaceAfterQuery);
            } else {
                // 否则只保留 @ 前面的内容
                newInputValue = textBeforeAt;
            }

            setInputValue(newInputValue);

            // 将光标移到删除位置
            setTimeout(() => {
                if (inputBoxRef.current) {
                    const cursorPos = textBeforeAt.length;
                    inputBoxRef.current.selectionStart = cursorPos;
                    inputBoxRef.current.selectionEnd = cursorPos;
                    inputBoxRef.current.focus();
                }
            }, 0);
        }

        setShowFilePicker(false);
        setFileSearchQuery('');
    };

    const handleRemoveFile = (filePath: string) => {
        setSelectedFiles(selectedFiles.filter(f => f.path !== filePath));
    };

    const handleFileClick = (filePath: string, startLine?: number) => {
        vscode.postMessage({
            type: 'openFile',
            filePath: filePath,
            line: startLine || 1
        });
    };

    return {
        selectedFiles,
        showFilePicker,
        fileSearchQuery,
        availableFiles,
        isSearching,
        setSelectedFiles,
        setShowFilePicker,
        setFileSearchQuery,
        handleAddFileClick,
        handleFileSelect,
        handleRemoveFile,
        handleFileClick
    };
};