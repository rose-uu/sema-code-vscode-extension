import React from 'react';
import FileIcon from '../../ui/FileIcon';
import { FileItem } from '../../../types';

interface FilePickerProps {
    show: boolean;
    fileSearchQuery: string;
    availableFiles: FileItem[];
    isSearching: boolean;
    onSearchChange: (query: string) => void;
    onFileSelect: (fileItem: FileItem) => void;
    filePickerRef: React.RefObject<HTMLDivElement>;
}

const FilePicker: React.FC<FilePickerProps> = ({
    show,
    fileSearchQuery,
    availableFiles,
    isSearching,
    onSearchChange,
    onFileSelect,
    filePickerRef
}) => {
    if (!show) return null;

    return (
        <div className="file-picker-popup" ref={filePickerRef}>
            <div className="file-picker-search">
                <input
                    type="text"
                    placeholder="搜索文件..., 最多添加10个文件或目录"
                    value={fileSearchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    autoFocus
                />
            </div>
            <div className="file-picker-list">
                {isSearching ? (
                    <div className="file-picker-empty">
                        搜索中...
                    </div>
                ) : availableFiles.length > 0 ? (
                    availableFiles.map((fileItem, index) => {
                        // 检查是否需要在此处添加分割线（当前项不是已打开文件，但前一项是已打开文件）
                        const prevItem = index > 0 ? availableFiles[index - 1] : null;
                        const needsDivider = prevItem && prevItem.isOpen && !fileItem.isOpen;

                        return (
                            <React.Fragment key={fileItem.path}>
                                {needsDivider && <div className="file-picker-divider"></div>}
                                <div
                                    className={`file-picker-item ${fileItem.isOpen ? 'file-open' : ''}`}
                                    onClick={() => onFileSelect(fileItem)}
                                    title={fileItem.path} // 添加title属性用于悬浮提示
                                >
                                    <span className="file-icon">
                                        <FileIcon
                                            fileName={fileItem.path.split('/').pop() || fileItem.path}
                                            isDirectory={fileItem.isDirectory}
                                            size={18}
                                        />
                                    </span>
                                    <div className="file-info">
                                        <span className={`file-name ${fileItem.isOpen ? 'file-name-open' : ''}`}>
                                            {fileItem.path.split('/').pop() || fileItem.path}
                                        </span>
                                        <span className="file-full-path">
                                            {fileItem.path}
                                        </span>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })
                ) : (
                    <div className="file-picker-empty">
                        {fileSearchQuery ? '未找到匹配的文件或目录' : '工作区中没有文件'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FilePicker;