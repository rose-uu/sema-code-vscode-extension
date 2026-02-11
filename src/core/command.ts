import { CustomCommand } from './semaCoreWrapper';

// 存储自定义命令的映射
let customCommandsMap: Map<string, CustomCommand> = new Map();

// 缓存合并后的命令列表
let cachedShortcutCommands: ShortcutCommand[] | null = null;

/**
 * 更新自定义命令映射
 */
export function updateCustomCommands(commands: CustomCommand[]): void {
    customCommandsMap.clear();
    commands.forEach(cmd => {
        // 使用 displayName 作为 key（如 "/optimize"）
        customCommandsMap.set(cmd.displayName, cmd);
    });
    // 清空缓存，强制重新计算
    cachedShortcutCommands = null;
}

/**
 * 获取所有自定义命令
 */
export function getCustomCommandsList(): CustomCommand[] {
    return Array.from(customCommandsMap.values());
}

/**
 * 将用户输入的命令转换为对应的 prompt
 */
export function transformCommandToPrompt(text: string): string {
    const trimmedText = text.trim();

    if (trimmedText.startsWith('/')) {
        // 提取命令部分（第一个空格之前的部分，如果没有空格则是整个文本）
        const spaceIndex = trimmedText.indexOf(' ');
        const command = spaceIndex > 0 ? trimmedText.substring(0, spaceIndex) : trimmedText;

        // 优先检查内置命令
        if (COMMAND_PROMPT_MAP[command]) {
            // 如果有额外参数，将其附加到 prompt 后面
            const extraParams = spaceIndex > 0 ? trimmedText.substring(spaceIndex) : '';
            return COMMAND_PROMPT_MAP[command] + extraParams;
        }

        // 然后检查自定义命令
        const customCommand = customCommandsMap.get(command);
        if (customCommand) {
            // 自定义命令的 content 就是 prompt
            // 如果有额外参数，将其附加到 prompt 后面
            const extraParams = spaceIndex > 0 ? trimmedText.substring(spaceIndex) : '';
            return customCommand.content + extraParams;
        }
    }
    return text;
}



// 命令到 prompt 的映射关系
const COMMAND_PROMPT_MAP: Record<string, string> = {
    '/knowledge': '帮我扫描整个代码项目，构建非常完善的wiki项目文档，需要是多个文档，分门别类的存放，按照目录来索引，对整个仓库做深度解析，越详细越好。中文回答',
    '/explain': '帮我分析代码实现',
    '/fix': '帮我修复代码',
    '/comment': '帮我添加注释',
    '/init': `Please analyze this codebase and create a AGENTS.md file containing:
1. Build/lint/test commands - especially for running a single test
2. Code style guidelines including imports, formatting, types, naming conventions, error handling, etc.

The file you create will be given to agentic coding agents (such as yourself) that operate in this repository. Make it about 20 lines long.
If there's already a AGENTS.md, improve it.
If there are Cursor rules (in .cursor/rules/ or .cursorrules) or Copilot rules (in .github/copilot-instructions.md), make sure to include them.`,
    '/review': `     You are an expert code reviewer. Follow these steps:

      1. If no PR number is provided in the args, use Bash("gh pr list") to show open PRs
      2. If a PR number is provided, use Bash("gh pr view <number>") to get PR details
      3. Use Bash("gh pr diff <number>") to get the diff
      4. Analyze the changes and provide a thorough code review that includes:
         - Overview of what the PR does
         - Analysis of code quality and style
         - Specific suggestions for improvements
         - Any potential issues or risks

      Keep your review concise but thorough. Focus on:
      - Code correctness
      - Following project conventions
      - Performance implications
      - Test coverage
      - Security considerations

      Format your review with clear sections and bullet points.

      PR number: `
};


// 快捷命令配置类型
export interface ShortcutCommand {
    text: string;
    desc: string;
    send: boolean;
    argumentHint?: string;
    isCustom?: boolean;  // 标识是否为自定义命令
}

// 内置快捷命令配置
const BUILTIN_SHORTCUT_COMMANDS: ShortcutCommand[] = [
    {
        text: "init",
        desc: "初始化项目信息",
        send: false
    },
    {
        text: "clear",
        desc: "清除对话历史和上下文",
        send: true  // 设置为true 点击后直接发送不给输入
    },
    {
        text: "compact",
        desc: "压缩会话历史",
        send: true  // 设置为true 点击后直接发送不给输入
    },
    {
        text: "review",
        desc: "代码审查",
        send: false
    },
    {
        text: "explain",
        desc: "代码解释",
        send: false
    },
    {
        text: "fix",
        desc: "代码修复",
        send: false
    },
    {
        text: "comment",
        desc: "代码注释",
        send: false
    },
    {
        text: "knowledge",
        desc: "生成项目知识库文档",
        send: false
    }
];

/**
 * 获取所有快捷命令（内置 + 自定义）
 * 使用缓存避免频繁重复计算
 */
export function getAllShortcutCommands(): ShortcutCommand[] {
    // 如果缓存存在，直接返回
    if (cachedShortcutCommands !== null) {
        return cachedShortcutCommands;
    }

    // 构建自定义命令列表 9a0d309 (优化等待过程ui)
    const customCommands: ShortcutCommand[] = Array.from(customCommandsMap.values()).map(cmd => ({
        text: cmd.name,  // 使用 name（不带 /）作为 text
        desc: cmd.description,
        send: false,  // 自定义命令默认不直接发送
        argumentHint: cmd.argumentHint,
        isCustom: true
    }));

    // 合并并缓存结果
    cachedShortcutCommands = [...BUILTIN_SHORTCUT_COMMANDS, ...customCommands];

    return cachedShortcutCommands;
}

// 为了保持向后兼容，导出一个 getter
export const SHORTCUT_COMMANDS = BUILTIN_SHORTCUT_COMMANDS;