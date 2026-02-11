import React from 'react';
import Tooltip from '../../ui/Tooltip';
import FileIcon from '../../ui/FileIcon';
import { RemoveIcon } from '../../ui/IconButton';
import { SelectedFile } from '../../../types';

interface SelectedFilesListProps {
    selectedFiles: SelectedFile[];
    onRemoveFile: (filePath: string) => void;
    onFileClick: (filePath: string, startLine?: number) => void;
}

const SelectedFilesList: React.FC<SelectedFilesListProps> = ({
    selectedFiles,
    onRemoveFile,
    onFileClick
}) => {
    return (
        <div className="selected-files">
            {selectedFiles.map(file => (
                <Tooltip key={file.path} content={file.path}>
                    <div className="selected-file-tag">
                        <span
                            className="file-tag-icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFile(file.path);
                            }}
                        >
                            <span className="icon-default">
                                <FileIcon
                                    fileName={file.name}
                                    isDirectory={file.isDirectory}
                                    size={18}
                                />
                            </span>
                            <span className="icon-remove">
                                <RemoveIcon />
                            </span>
                        </span>
                        <span
                            className={`file-name ${file.isDirectory ? 'is-directory' : ''}`}
                            onClick={(e) => {
                                if (!file.isDirectory) {
                                    e.stopPropagation();
                                    onFileClick(file.path, file.startLine);
                                }
                            }}
                        >
                            {file.startLine && file.endLine
                                ? `${file.name}:${file.startLine}-${file.endLine}`
                                : file.name}
                        </span>
                    </div>
                </Tooltip>
            ))}
        </div>
    );
};

export default SelectedFilesList;