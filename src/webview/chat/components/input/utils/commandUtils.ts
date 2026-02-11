import { getAllShortcutCommands } from '../../../../../core/command'

// 缓存命令列表，避免频繁调用
let cachedHighlightCommands: string[] | null = null;
let cachedAllCommands: ReturnType<typeof getAllShortcutCommands> | null = null;

/**
 * 清空缓存（当自定义命令更新时调用）
 */
export const clearCommandCache = () => {
    cachedHighlightCommands = null;
    cachedAllCommands = null;
};

/**
 * 获取所有需要高亮的命令列表（带缓存）
 */
export const getHighlightCommands = () => {
    if (cachedHighlightCommands === null) {
        cachedHighlightCommands = getAllShortcutCommands().map(command => '/' + command.text);
    }
    return cachedHighlightCommands;
};

/**
 * 获取所有命令（带缓存）
 */
const getCachedAllCommands = () => {
    if (cachedAllCommands === null) {
        cachedAllCommands = getAllShortcutCommands();
    }
    return cachedAllCommands;
};

/**
 * 检查文本是否包含高亮命令
 */
export const getHighlightedCommand = (text: string) => {
    // 去掉首尾空格进行匹配
    const trimmedText = text.trim();

    // 获取当前的命令列表（动态）
    const highlightCommands = getHighlightCommands();

    // 找到匹配的命令
    const matchedCommand = highlightCommands.find(cmd => trimmedText.startsWith(cmd));

    if (matchedCommand) {
        // 在原始文本中找到命令的实际位置
        const startPos = text.indexOf(matchedCommand);
        const endPos = startPos + matchedCommand.length;

        return {
            command: matchedCommand,
            startPos: startPos >= 0 ? startPos : 0,
            endPos: endPos
        };
    }

    return null;
};

/**
 * 检查输入文本是否与某个命令完全匹配
 */
export const isExactCommandMatch = (text: string): boolean => {
    const trimmedText = text.trim();
    const highlightCommands = getHighlightCommands();
    return highlightCommands.includes(trimmedText);
};

/**
 * 根据搜索查询过滤快捷命令（使用缓存）
 */
export const getFilteredShortcutCommands = (searchQuery: string) => {
    const allCommands = getCachedAllCommands();

    if (!searchQuery) {
        return allCommands;
    }

    // 过滤出以搜索查询开头的命令
    return allCommands.filter(cmd =>
        cmd.text.toLowerCase().startsWith(searchQuery.toLowerCase())
    );
};
