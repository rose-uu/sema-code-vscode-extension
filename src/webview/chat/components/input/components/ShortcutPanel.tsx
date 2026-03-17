import React, { useMemo, useEffect, useRef } from 'react';
import { ShortcutCommand } from '../../../../../core/util/command';

interface ShortcutPanelProps {
    show: boolean;
    commands: ShortcutCommand[];
    searchQuery?: string;
    selectedIndex?: number;
    onExecuteShortcut: (text: string, send: boolean) => void;
    shortcutPanelRef: React.RefObject<HTMLDivElement>;
}

const ShortcutPanel: React.FC<ShortcutPanelProps> = ({
    show,
    commands,
    searchQuery = '',
    selectedIndex = 0,
    onExecuteShortcut,
    shortcutPanelRef
}) => {
    // ⚠️ 所有 hooks 必须在条件判断之前调用（React Hooks 规则）
    const selectedItemRef = useRef<HTMLDivElement>(null);

    const filteredCommands = useMemo(() => {
        if (!searchQuery) return commands;
        return commands.filter(cmd => cmd.text.toLowerCase().startsWith(searchQuery.toLowerCase()));
    }, [commands, searchQuery]);

    // 确保 selectedIndex 在有效范围内
    const safeSelectedIndex = Math.max(0, Math.min(selectedIndex, filteredCommands.length - 1));

    // 当选中项改变时，滚动到可见区域
    useEffect(() => {
        if (selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }, [safeSelectedIndex]);

    // ✅ 现在可以进行条件判断和早期返回了
    if (!show) return null;

    // 如果没有匹配的命令，不显示面板
    if (filteredCommands.length === 0) return null;

    return (
        <div className="shortcut-panel-popup" ref={shortcutPanelRef}>
            {filteredCommands.map((item, index) => (
                <div
                    key={index}
                    ref={index === safeSelectedIndex ? selectedItemRef : null}
                    className={`shortcut-panel-item ${index === safeSelectedIndex ? 'selected' : ''}`}
                    onClick={() => onExecuteShortcut(item.text, item.send)}
                >
                    <span className="shortcut-slash">/</span>
                    <span className="shortcut-command">{item.text}</span>
                    <span className="shortcut-desc">{item.desc}</span>
                </div>
            ))}
        </div>
    );
};

export default ShortcutPanel;