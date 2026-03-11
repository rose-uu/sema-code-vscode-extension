import React, { useState, useEffect, useMemo } from 'react';
import { VscodeApi, MCPData, MCPServerInfo, MCPScopeType, MCPServerConfig, ToolInfo, SystemToolInfo } from './types';
import { defaultMCPMarketInfos, MCPMarketInfo } from './default/defaultMCPMarket';
import { inlineSvgIcons } from './mcpIcon';
import { initialBgColors, hashString, getColorByName } from './utils/iconUtils';
import './style/agent.css';
import './style/mcp.css';

type MCPTabType = 'installed' | 'market';

interface MCPConfigProps {
    vscode: VscodeApi;
}

// 状态颜色映射
const statusColors: Record<string, string> = {
    disconnected: '#6b7280',
    connecting: '#f59e0b',
    connected: '#10b981',
    error: '#ef4444'
};

// 状态文本映射
const statusText: Record<string, string> = {
    disconnected: '未连接',
    connecting: '连接中',
    connected: '已连接',
    error: '错误'
};

// 工具数量上限
const MAX_TOOL_COUNT = 30;

// MCP 名称图标组件
const MCPNameIcon: React.FC<{ name: string }> = ({ name }) => {
    const initial = name.charAt(0).toUpperCase();
    const bgColor = initialBgColors[hashString(name) % initialBgColors.length];

    return (
        <span
            className="mcp-name-icon"
            style={{ backgroundColor: bgColor }}
        >
            {initial}
        </span>
    );
};

// MCP 服务项组件
const MCPServerItem: React.FC<{
    server: MCPServerInfo;
    scope: MCPScopeType;
    onReconnect: (name: string) => void;
    onEdit: (server: MCPServerInfo, scope: MCPScopeType) => void;
    onDelete: (server: MCPServerInfo, scope: MCPScopeType) => void;
    onToggle: (server: MCPServerInfo, scope: MCPScopeType, enabled: boolean) => void;
    onToolToggle: (mcpName: string, toolName: string, enabled: boolean) => void;
    disableReconnect?: boolean;
    isReconnecting?: boolean;
    isDeleting?: boolean;
}> = ({ server, scope, onReconnect, onEdit, onDelete, onToggle, onToolToggle, disableReconnect, isReconnecting, isDeleting }) => {
    const [expanded, setExpanded] = useState(false);
    const tools = server.capabilities?.tools || [];
    const toolCount = tools.length;

    // 判断工具是否启用
    const isToolEnabled = (toolName: string): boolean => {
        // 如果 useTools 是 null 或 undefined，表示所有工具都启用
        if (server.config.useTools === null || server.config.useTools === undefined) {
            return true;
        }
        // 否则检查工具名是否在列表中
        return server.config.useTools.includes(toolName);
    };

    // 计算启用的工具数量
    const enabledToolCount = tools.filter(tool => isToolEnabled(tool.name)).length;

    return (
        <div className="agent-card mcp-server-item">
            <div className="agent-header mcp-server-header">
                <button
                    className={`mcp-expand-btn ${expanded ? 'expanded' : ''}`}
                    onClick={() => setExpanded(!expanded)}
                >
                    <svg width="12" height="12" viewBox="0 0 12 12">
                        <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <MCPNameIcon name={server.config.name} />
                <span className="agent-name">{server.config.name}</span>
                <span
                    className="mcp-status-dot"
                    style={{ backgroundColor: statusColors[server.status] }}
                    title={statusText[server.status]}
                />
                {server.error && (
                    <span className="mcp-error-hint" title={server.error}>!</span>
                )}
                <div className="mcp-server-actions">
                    <button
                        className={`mcp-icon-btn ${isReconnecting ? 'btn-loading' : ''}`}
                        onClick={() => onReconnect(server.config.name)}
                        title={disableReconnect ? "项目MCP已连接，全局MCP已禁用" : "重新连接"}
                        disabled={server.config.enabled === false || disableReconnect || isReconnecting}
                    >
                        {isReconnecting ? (
                            <span className="spinner" />
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6M1 20v-6h6" />
                                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                            </svg>
                        )}
                    </button>
                    <button
                        className="mcp-icon-btn"
                        onClick={() => onEdit(server, scope)}
                        title="编辑配置"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button
                        className={`mcp-icon-btn mcp-icon-btn-danger ${isDeleting ? 'btn-loading' : ''}`}
                        onClick={() => onDelete(server, scope)}
                        title="删除"
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <span className="spinner" />
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                        )}
                    </button>
                    <label className="mcp-switch">
                        <input
                            type="checkbox"
                            checked={server.config.enabled !== false}
                            onChange={(e) => onToggle(server, scope, e.target.checked)}
                        />
                        <span className="mcp-switch-slider"></span>
                    </label>
                </div>
            </div>
            {expanded && (
                <div className="mcp-server-tools">
                    <div className="mcp-tools-header">{enabledToolCount}/{toolCount} Tools</div>
                    {toolCount > 0 ? (
                        <div className="mcp-tools-list">
                            {tools.map((tool, index) => (
                                <div key={index} className="mcp-tool-item mcp-tool-item-with-switch">
                                    <span className="mcp-tool-name">{tool.name}</span>
                                    <span className="mcp-tool-desc">{tool.description || '-'}</span>
                                    <label className="mcp-tool-switch">
                                        <input
                                            type="checkbox"
                                            checked={isToolEnabled(tool.name)}
                                            onChange={(e) => onToolToggle(server.config.name, tool.name, e.target.checked)}
                                        />
                                        <span className="mcp-tool-switch-slider"></span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mcp-tools-empty">暂无工具</div>
                    )}
                </div>
            )}
        </div>
    );
};

// MCP 分组组件
const MCPGroup: React.FC<{
    title: string;
    servers: MCPServerInfo[];
    scope: MCPScopeType;
    onReconnect: (name: string) => void;
    onEdit: (server: MCPServerInfo, scope: MCPScopeType) => void;
    onDelete: (server: MCPServerInfo, scope: MCPScopeType) => void;
    onToggle: (server: MCPServerInfo, scope: MCPScopeType, enabled: boolean) => void;
    onToolToggle: (mcpName: string, toolName: string, enabled: boolean) => void;
    connectedProjectMCPs?: Set<string>;
    reconnectingNames?: Set<string>;
    deletingNames?: Set<string>;
}> = ({ title, servers, scope, onReconnect, onEdit, onDelete, onToggle, onToolToggle, connectedProjectMCPs, reconnectingNames, deletingNames }) => {
    // 对服务器列表排序：启用的在前面
    const sortedServers = useMemo(() => {
        return [...servers].sort((a, b) => {
            const aEnabled = a.config.enabled !== false;
            const bEnabled = b.config.enabled !== false;
            if (aEnabled && !bEnabled) return -1;
            if (!aEnabled && bEnabled) return 1;
            return 0;
        });
    }, [servers]);

    return (
        <>
            <div className="section-group-title">
                {title}
                <span className="section-group-count">
                    ({scope === 'project' ? '.sema/mcp.json' : '~/.sema/mcp.json'})
                </span>
            </div>
            {sortedServers.length > 0 ? (
                <div className="agent-list mcp-server-list">
                    {sortedServers.map((server, index) => (
                        <MCPServerItem
                            key={`${server.config.name}-${index}`}
                            server={server}
                            scope={scope}
                            onReconnect={onReconnect}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onToggle={onToggle}
                            onToolToggle={onToolToggle}
                            disableReconnect={connectedProjectMCPs?.has(server.config.name)}
                            isReconnecting={reconnectingNames?.has(server.config.name)}
                            isDeleting={deletingNames?.has(server.config.name)}
                        />
                    ))}
                </div>
            ) : (
                <div className="section-empty">暂无 MCP 服务</div>
            )}
        </>
    );
};

// 系统工具分组组件
const SystemToolsGroup: React.FC<{
    tools: SystemToolInfo[];
    onToolToggle: (toolName: string, enabled: boolean) => void;
}> = ({ tools, onToolToggle }) => {
    const [expanded, setExpanded] = useState(true);
    const toolCount = tools.length;
    const enabledCount = tools.filter(t => t.enabled).length;

    return (
        <>
            <div className="section-group-title">
                系统工具
            </div>
            <div className="agent-list mcp-server-list">
                <div className="agent-card mcp-server-item">
                    <div className="agent-header mcp-server-header">
                        <button
                            className={`mcp-expand-btn ${expanded ? 'expanded' : ''}`}
                            onClick={() => setExpanded(!expanded)}
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12">
                                <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <div className="agent-icon mcp-builtin-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
                                <path fill="currentColor" d="M24.5 17.3c-.4-.1-.8-.3-1.1-.4 0-.7-.1-1.3-.1-2 0-.1.1-.1.1-.2.4-.2.7-.3 1.1-.5.4-.2.5-.6.4-1-.3-.7-.6-1.3-.9-2-.2-.4-.6-.6-1-.4-.4.2-.7.3-1.1.5-.1 0-.2 0-.2-.1-.2-.3-.5-.5-.7-.7-.2-.2-.5-.4-.7-.6.2-.4.3-.8.5-1.2.2-.5 0-.9-.5-1.1-.6-.1-1.3-.4-1.9-.6-.5-.2-.9 0-1.1.5-.1.4-.3.8-.4 1.1-.7 0-1.3.1-2 .1-.1 0-.1-.1-.2-.1-.2-.4-.3-.7-.5-1.1-.2-.4-.6-.5-1-.4-.7.3-1.3.6-2 .9-.4.2-.6.6-.4 1 .2.4.3.7.5 1.1 0 .1 0 .2-.1.2-.2.2-.4.3-.5.5-.3.3-.5.6-.8.9-.4-.1-.8-.3-1.1-.4-.5-.2-.9 0-1.1.5-.2.5-.5 1.2-.7 1.8-.2.6-.1.9.5 1.1.4.1.8.3 1.1.4 0 .7.1 1.3.1 2 0 .1-.1.1-.1.2-.4.2-.7.3-1.1.5-.4.2-.5.6-.4 1 .3.7.6 1.3.9 2 .2.4.6.6 1 .4.4-.2.7-.3 1.1-.5.1 0 .2 0 .2.1.2.3.5.5.7.7.2.2.5.4.7.6-.2.4-.3.8-.5 1.2-.2.5 0 .9.5 1.1.6.2 1.2.5 1.9.7.6.2.9.1 1.1-.5.1-.4.3-.8.4-1.1.7 0 1.3-.1 2-.1.1 0 .1.1.2.1.2.4.3.7.5 1.1.2.4.6.5 1 .4.7-.3 1.3-.6 2-.9.4-.2.6-.6.4-1-.2-.4-.3-.7-.5-1.1 0-.1 0-.2.1-.2.3-.2.5-.5.7-.7.2-.2.4-.5.6-.7.4.1.8.3 1.1.4.5.2.9 0 1.1-.5.2-.6.5-1.2.7-1.9.2-.5.1-.9-.5-1.1zm-7 2.1c-1.9.8-4 0-4.9-1.9-.8-1.9 0-4 1.9-4.9 1.9-.8 4 0 4.9 1.9.8 1.9 0 4-1.9 4.9z"/>
                            </svg>
                        </div>
                        <span className="agent-name">内置工具</span>
                        <span
                            className="mcp-status-dot"
                            style={{ backgroundColor: '#10b981' }}
                            title="已连接"
                        />
                        <div className="mcp-server-actions">
                            <button
                                className="mcp-icon-btn"
                                disabled
                                title="重新连接"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M23 4v6h-6M1 20v-6h6" />
                                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                                </svg>
                            </button>
                            <button
                                className="mcp-icon-btn"
                                disabled
                                title="编辑配置"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                            </button>
                            <button
                                className="mcp-icon-btn mcp-icon-btn-danger"
                                disabled
                                title="删除"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                            </button>
                            <label className="mcp-switch mcp-switch-disabled">
                                <input
                                    type="checkbox"
                                    checked={true}
                                    disabled
                                />
                                <span className="mcp-switch-slider"></span>
                            </label>
                        </div>
                    </div>
                    {expanded && (
                        <div className="mcp-server-tools">
                            <div className="mcp-tools-header">{enabledCount}/{toolCount} Tools</div>
                            {toolCount > 0 ? (
                                <div className="mcp-tools-list">
                                    {tools.map((tool, index) => (
                                        <div key={index} className="mcp-tool-item mcp-tool-item-with-switch">
                                            <span className="mcp-tool-name">{tool.name}</span>
                                            <span className="mcp-tool-desc">{tool.description || '-'}</span>
                                            <label className="mcp-tool-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={tool.enabled}
                                                    onChange={(e) => onToolToggle(tool.name, e.target.checked)}
                                                />
                                                <span className="mcp-tool-switch-slider"></span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="mcp-tools-empty">暂无工具</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

// JSON 编辑器弹窗组件
const MCPEditModal: React.FC<{
    server: MCPServerInfo | null;
    scope: MCPScopeType;
    require?: Record<string, string>;
    onClose: () => void;
    onSave: (config: MCPServerConfig, scope: MCPScopeType) => void;
    vscode: VscodeApi;
    isSaving?: boolean;
}> = ({ server, scope, require, onClose, onSave, vscode, isSaving }) => {
    const [jsonText, setJsonText] = useState('');
    const [error, setError] = useState<string | null>(null);

    // 判断是否需要显示 npx 提示
    const showNpxHint = useMemo(() => {
        if (!server) return false;
        const cmd = server.config.command?.toLowerCase();
        return cmd === 'npx' || cmd?.endsWith('/npx');
    }, [server]);

    // 判断是否需要显示 uvx 提示
    const showUvxHint = useMemo(() => {
        if (!server) return false;
        const cmd = server.config.command?.toLowerCase();
        return cmd === 'uvx' || cmd?.endsWith('/uvx');
    }, [server]);

    // 检查配置中是否还包含需要替换的占位符
    const checkRequirePlaceholders = (config: MCPServerConfig, requireKeys: string[]): string[] => {
        const unreplacedKeys: string[] = [];

        for (const key of requireKeys) {
            // 检查 args
            if (config.args?.some(arg => arg.includes(key))) {
                unreplacedKeys.push(key);
                continue;
            }
            // 检查 env
            if (config.env) {
                const envValues = Object.values(config.env);
                if (envValues.some(val => val.includes(key))) {
                    unreplacedKeys.push(key);
                }
            }
        }

        return unreplacedKeys;
    };

    useEffect(() => {
        if (server) {
            // 将 config 包装成 mcpServers 格式显示，name 作为 key
            const { name, ...restConfig } = server.config;
            const wrappedConfig = {
                mcpServers: {
                    [name]: restConfig
                }
            };
            setJsonText(JSON.stringify(wrappedConfig, null, 2));
            setError(null);
        }
    }, [server]);

    const handleSave = () => {
        try {
            const parsed = JSON.parse(jsonText);

            // 验证 mcpServers 格式
            if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
                setError('格式错误：需要 mcpServers 对象');
                return;
            }

            const serverNames = Object.keys(parsed.mcpServers);
            if (serverNames.length !== 1) {
                setError('格式错误：mcpServers 中只能有一个服务配置');
                return;
            }

            // 从 mcpServers 格式中提取配置，key 作为 name
            const name = serverNames[0];
            const serverConfig = parsed.mcpServers[name];
            const config: MCPServerConfig = {
                name,
                ...serverConfig
            };

            if (!config.transport) {
                setError('transport 字段是必需的');
                return;
            }

            // 检查是否还有未替换的占位符
            if (require) {
                const requireKeys = Object.keys(require);
                const unreplacedKeys = checkRequirePlaceholders(config, requireKeys);
                if (unreplacedKeys.length > 0) {
                    const keyDescriptions = unreplacedKeys.map(key => `'${key}'`).join('、');
                    setError(`请将 ${keyDescriptions} 替换为实际值`);
                    return;
                }
            }

            onSave(config, scope);
        } catch (e) {
            setError('JSON 格式错误');
        }
    };

    if (!server) return null;

    // 生成 require 提示内容
    const renderRequireHints = () => {
        if (!require || Object.keys(require).length === 0) return null;

        const entries = Object.entries(require);
        return (
            <div className="mcp-require-hint">
                <span className="mcp-require-hint-prefix">请将 </span>
                {entries.map(([key, desc], index) => (
                    <span key={key}>
                        '<span className="mcp-require-key">{key}</span>'
                        <span className="mcp-require-desc">（{desc}）</span>
                        {index < entries.length - 1 && '、'}
                    </span>
                ))}
                <span className="mcp-require-hint-suffix"> 替换为自己的值</span>
            </div>
        );
    };

    return (
        <div className="mcp-modal-overlay" onClick={onClose}>
            <div className="mcp-modal" onClick={(e) => e.stopPropagation()}>
                <div className="mcp-modal-header">
                    <span>编辑 MCP 配置 - {server.config.name}</span>
                    <button className="mcp-modal-close" onClick={onClose}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <div className="mcp-modal-body">
                    {/* NPX 环境提示 */}
                    {showNpxHint && (
                        <div className="mcp-npx-hint">
                            <span className="mcp-npx-hint-text">本地需要 npx 环境</span>
                            <a
                                href="https://nodejs.org/"
                                className="mcp-npx-hint-link"
                                onClick={(e) => {
                                    e.preventDefault();
                                    vscode.postMessage({ command: 'openExternal', url: 'https://nodejs.org/' });
                                }}
                            >
                                如何安装？
                            </a>
                        </div>
                    )}

                    {/* UVX 环境提示 */}
                    {showUvxHint && (
                        <div className="mcp-npx-hint">
                            <span className="mcp-npx-hint-text">本地需要 uvx 环境</span>
                            <a
                                href="https://docs.astral.sh/uv/getting-started/installation/"
                                className="mcp-npx-hint-link"
                                onClick={(e) => {
                                    e.preventDefault();
                                    vscode.postMessage({ command: 'openExternal', url: 'https://docs.astral.sh/uv/getting-started/installation/' });
                                }}
                            >
                                如何安装？
                            </a>
                        </div>
                    )}

                    {/* 必须字段提示 */}
                    {renderRequireHints()}

                    <textarea
                        className="mcp-json-editor"
                        value={jsonText}
                        onChange={(e) => {
                            setJsonText(e.target.value);
                            setError(null);
                        }}
                        spellCheck={false}
                    />
                    {error && <div className="mcp-edit-error">{error}</div>}
                </div>
                <div className="mcp-modal-footer">
                    <button className="mcp-btn secondary" onClick={onClose} disabled={isSaving}>取消</button>
                    <button className={`mcp-btn primary ${isSaving ? 'btn-loading' : ''}`} onClick={handleSave} disabled={isSaving}>
                        {isSaving && <span className="spinner" />}
                        {isSaving ? '保存中...' : '确定'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// 获取命令类型标签
const getCommandType = (command?: string): string => {
    if (!command) return '';
    const cmd = command.toLowerCase();
    if (cmd === 'npx' || cmd.endsWith('/npx')) return 'NPX';
    if (cmd === 'uvx' || cmd.endsWith('/uvx')) return 'UVX';
    return '';
};

// 格式化 MCP 名称：按 - 分割，首字母大写
const formatMCPName = (name: string): string => {
    return name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// 从 GitHub URL 提取作者名称
const getGitHubAuthor = (githubUrl?: string): string => {
    if (!githubUrl) return '';
    const match = githubUrl.match(/github\.com\/([^/]+)/);
    return match ? match[1] : '';
};


// MCP 图标组件 - 用 name 从 inlineSvgIcons 取值
const MCPIcon: React.FC<{ name: string }> = ({ name }) => {
    const iconContent = inlineSvgIcons[name];

    if (iconContent) {
        // 判断是 SVG 还是表情
        if (iconContent.includes('<svg')) {
            return (
                <span
                    className="mcp-market-icon mcp-market-icon-svg"
                    dangerouslySetInnerHTML={{ __html: iconContent }}
                />
            );
        }
        // 表情直接显示
        return <span className="mcp-market-icon mcp-market-icon-emoji">{iconContent}</span>;
    }

    // 没有值时显示圆形背景 + 首字母大写
    const initial = name.charAt(0).toUpperCase();
    const bgColor = initialBgColors[hashString(name) % initialBgColors.length];

    return (
        <span
            className="mcp-market-icon mcp-market-icon-initial"
            style={{ backgroundColor: bgColor }}
        >
            {initial}
        </span>
    );
};

// MCP 市场卡片组件
const MCPMarketCard: React.FC<{
    item: MCPMarketInfo;
    isInstalled: boolean;
    onInstall: (item: MCPMarketInfo, scope: MCPScopeType) => void;
    vscode: VscodeApi;
}> = ({ item, isInstalled, onInstall, vscode }) => {
    const [expanded, setExpanded] = useState(false);
    const commandType = getCommandType(item.config.command);
    const author = getGitHubAuthor(item.github);

    return (
        <div className="mcp-market-card">
            <div className="mcp-market-card-header">
                <div className="mcp-market-card-left">
                    <MCPIcon name={item.config.name} />
                    <div className="mcp-market-info">
                        <div className="mcp-market-name">
                            {item.config.title || formatMCPName(item.config.name)}
                            {commandType && <span className="mcp-command-type">{commandType}</span>}
                        </div>
                        <div className="mcp-market-desc">{item.description}</div>
                    </div>
                </div>
                <div className="mcp-market-card-right">
                    {isInstalled ? (
                        <span className="mcp-installed-badge">已安装</span>
                    ) : (
                        <div className="mcp-install-btns">
                            <button
                                className="mcp-btn secondary small"
                                onClick={() => onInstall(item, 'project')}
                                title="安装到当前项目"
                            >
                                项目添加
                            </button>
                            <button
                                className="mcp-btn primary small"
                                onClick={() => onInstall(item, 'user')}
                                title="安装到用户全局"
                            >
                                全局添加
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="mcp-market-card-tags">
                {item.tags.map((tag, index) => (
                    <span key={index} className="mcp-tag">{tag}</span>
                ))}
            </div>
            <div className="mcp-market-card-footer">
                <button
                    className={`mcp-expand-btn ${expanded ? 'expanded' : ''}`}
                    onClick={() => setExpanded(!expanded)}
                >
                    <svg width="12" height="12" viewBox="0 0 12 12">
                        <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{item.tools.length} Tools</span>
                </button>
                {item.github && (
                    <a
                        href={item.github}
                        className="mcp-github-link"
                        onClick={(e) => {
                            e.preventDefault();
                            // 在 VSCode 中打开链接
                            vscode.postMessage({ command: 'openExternal', url: item.github });
                        }}
                        title="查看源码"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                        {author && <span className="mcp-author">{author}</span>}
                    </a>
                )}
            </div>
            {expanded && (
                <div className="mcp-market-tools">
                    <div className="mcp-tools-list">
                        {item.tools.map((tool, index) => (
                            <span key={index} className="mcp-tool-badge">{tool}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const MCPConfig: React.FC<MCPConfigProps> = ({ vscode }) => {
    const [activeTab, setActiveTab] = useState<MCPTabType>('installed');
    const [mcpData, setMcpData] = useState<MCPData>({ project: [], user: [] });
    const [editingServer, setEditingServer] = useState<{ server: MCPServerInfo; scope: MCPScopeType; require?: Record<string, string> } | null>(null);
    const [loading, setLoading] = useState(true);

    // 系统工具状态
    const [systemTools, setSystemTools] = useState<SystemToolInfo[]>([]);

    // 加载状态
    const [reconnectingNames, setReconnectingNames] = useState<Set<string>>(new Set());
    const [deletingNames, setDeletingNames] = useState<Set<string>>(new Set());
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // 市场相关状态
    const [searchQuery, setSearchQuery] = useState('');

    // 获取已安装的服务名称列表
    const installedNames = useMemo(() => {
        const names = new Set<string>();
        mcpData.project.forEach(s => names.add(s.config.name));
        mcpData.user.forEach(s => names.add(s.config.name));
        return names;
    }, [mcpData]);

    // 获取已连接的项目MCP名称集合（用于禁用同名的全局MCP连接按钮）
    const connectedProjectMCPs = useMemo(() => {
        const names = new Set<string>();
        mcpData.project.forEach(s => {
            if (s.status === 'connected' || s.status === 'connecting') {
                names.add(s.config.name);
            }
        });
        return names;
    }, [mcpData]);

    // 计算所有启用的工具总数
    const totalToolCount = useMemo(() => {
        // 系统工具启用数量
        const systemToolCount = systemTools.filter(t => t.enabled).length;

        // 项目MCP工具数量（只计算启用的MCP的启用工具）
        const projectToolCount = mcpData.project
            .filter(s => s.config.enabled !== false)
            .reduce((sum, s) => {
                const tools = s.capabilities?.tools || [];
                if (s.config.useTools === null || s.config.useTools === undefined) {
                    return sum + tools.length;
                }
                return sum + s.config.useTools.length;
            }, 0);

        // 用户MCP工具数量（只计算启用的MCP的启用工具）
        const userToolCount = mcpData.user
            .filter(s => s.config.enabled !== false)
            .reduce((sum, s) => {
                const tools = s.capabilities?.tools || [];
                if (s.config.useTools === null || s.config.useTools === undefined) {
                    return sum + tools.length;
                }
                return sum + s.config.useTools.length;
            }, 0);

        return systemToolCount + projectToolCount + userToolCount;
    }, [systemTools, mcpData]);

    // 过滤市场列表 - 只在名字、标签、描述中检索，已安装的排在前面
    const filteredMarketItems = useMemo(() => {
        let items = defaultMCPMarketInfos;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            items = items.filter(item =>
                item.config.name.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query) ||
                item.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }
        // 已安装的排在前面
        return [...items].sort((a, b) => {
            const aInstalled = installedNames.has(a.config.name);
            const bInstalled = installedNames.has(b.config.name);
            if (aInstalled && !bInstalled) return -1;
            if (!aInstalled && bInstalled) return 1;
            return 0;
        });
    }, [searchQuery, installedNames]);

    // 更新单个 MCP 服务器信息
    const updateSingleMCPServer = (name: string, serverInfo: MCPServerInfo) => {
        setMcpData(prev => {
            const updateList = (list: MCPServerInfo[]) =>
                list.map(s => s.config.name === name ? serverInfo : s);
            return {
                project: updateList(prev.project),
                user: updateList(prev.user)
            };
        });
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'loadMCPConfigResult':
                    if (message.success) {
                        setMcpData(message.data);
                    }
                    setLoading(false);
                    break;
                case 'mcpReconnectResult':
                    setReconnectingNames(prev => {
                        const next = new Set(prev);
                        next.delete(message.name);
                        return next;
                    });
                    // 使用返回的信息更新单个 MCP 服务器
                    if (message.success && message.status) {
                        updateSingleMCPServer(message.name, message.status);
                    }
                    break;
                case 'mcpUpdateResult':
                    // 更新后重新加载
                    setIsSavingEdit(false);
                    setEditingServer(null);
                    vscode.postMessage({ command: 'loadMCPConfig' });
                    break;
                case 'mcpDeleteResult':
                    // 删除后重新加载
                    setDeletingNames(new Set());
                    if (message.success) {
                        vscode.postMessage({ command: 'loadMCPConfig' });
                    }
                    break;
                case 'loadSystemToolsResult':
                    // 加载系统工具结果
                    if (message.success && message.data) {
                        // 将 ToolInfo[] 转换为 SystemToolInfo[]，根据 status 设置 enabled
                        const toolsWithEnabled = (message.data as ToolInfo[]).map(tool => ({
                            ...tool,
                            enabled: tool.status === 'enable'
                        }));
                        setSystemTools(toolsWithEnabled);
                    }
                    break;
                case 'updateUseToolsResult':
                    // 工具更新结果，暂不需要特殊处理
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'loadMCPConfig' });
        vscode.postMessage({ command: 'loadSystemTools' });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const handleReconnect = (name: string) => {
        setReconnectingNames(prev => new Set(prev).add(name));
        vscode.postMessage({
            command: 'reconnectMCP',
            name
        });
    };

    const handleEdit = (server: MCPServerInfo, scope: MCPScopeType) => {
        setEditingServer({ server, scope });
    };

    const handleToggle = (server: MCPServerInfo, scope: MCPScopeType, enabled: boolean) => {
        const updatedConfig = { ...server.config, enabled };
        vscode.postMessage({
            command: 'updateMCPConfig',
            config: updatedConfig,
            scope
        });
    };

    const handleDelete = (server: MCPServerInfo, scope: MCPScopeType) => {
        setDeletingNames(prev => new Set(prev).add(server.config.name));
        vscode.postMessage({
            command: 'deleteMCPConfig',
            name: server.config.name,
            scope
        });
    };

    const handleSaveEdit = (config: MCPServerConfig, scope: MCPScopeType) => {
        setIsSavingEdit(true);
        vscode.postMessage({
            command: 'updateMCPConfig',
            config,
            scope
        });
    };

    // 市场安装处理 - 复用 MCPEditModal
    const handleInstallClick = (item: MCPMarketInfo, scope: MCPScopeType) => {
        // 将市场项转换为 MCPServerInfo 格式
        const serverInfo: MCPServerInfo = {
            config: item.config as MCPServerConfig,
            status: 'disconnected'
        };
        setEditingServer({ server: serverInfo, scope, require: item.require });
    };

    // 系统工具开关处理
    const handleSystemToolToggle = (toolName: string, enabled: boolean) => {
        // 更新本地状态
        const newTools = systemTools.map(tool =>
            tool.name === toolName ? {
                ...tool,
                enabled,
                status: enabled ? 'enable' : 'disable' as 'enable' | 'disable'
            } : tool
        );
        setSystemTools(newTools);

        // 计算启用的工具列表
        const enabledTools = newTools.filter(t => t.enabled).map(t => t.name);

        // 如果全部启用，传 null；否则传启用的工具列表
        const toolsToSend = enabledTools.length === newTools.length ? null : enabledTools;

        // 发送更新消息
        vscode.postMessage({
            command: 'updateUseTools',
            tools: toolsToSend
        });
    };

    // MCP 工具开关处理
    const handleMCPToolToggle = (mcpName: string, toolName: string, enabled: boolean) => {
        // 找到对应的 MCP 服务器
        const findServer = (servers: MCPServerInfo[]) => servers.find(s => s.config.name === mcpName);
        const server = findServer(mcpData.project) || findServer(mcpData.user);

        if (!server) return;

        // 获取当前所有工具
        const allTools = server.capabilities?.tools || [];
        const allToolNames = allTools.map(t => t.name);

        // 计算新的启用工具列表
        let currentEnabledTools: string[];
        if (server.config.useTools === null || server.config.useTools === undefined) {
            // 如果之前是全部启用，则从全部工具开始
            currentEnabledTools = [...allToolNames];
        } else {
            currentEnabledTools = [...server.config.useTools];
        }

        if (enabled) {
            // 添加工具
            if (!currentEnabledTools.includes(toolName)) {
                currentEnabledTools.push(toolName);
            }
        } else {
            // 移除工具
            currentEnabledTools = currentEnabledTools.filter(t => t !== toolName);
        }

        // 如果全部启用，传 null；否则传启用的工具列表
        const toolsToSend = currentEnabledTools.length === allToolNames.length ? null : currentEnabledTools;

        // 更新本地状态
        setMcpData(prev => {
            const updateList = (list: MCPServerInfo[]) =>
                list.map(s => s.config.name === mcpName
                    ? { ...s, config: { ...s.config, useTools: toolsToSend } }
                    : s
                );
            return {
                project: updateList(prev.project),
                user: updateList(prev.user)
            };
        });

        // 发送更新消息
        vscode.postMessage({
            command: 'updateMCPUseTools',
            mcpName,
            tools: toolsToSend
        });
    };

    return (
        <div className="agent-config mcp-config">
            {/* Tab 导航 */}
            <div className="tab-navigation">
                <div
                    className={`tab-item ${activeTab === 'installed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('installed')}
                >
                    已安装
                </div>
                <div
                    className={`tab-item ${activeTab === 'market' ? 'active' : ''}`}
                    onClick={() => setActiveTab('market')}
                >
                    MCP 市场
                </div>
            </div>

            {/* Tab 内容 */}
            <div className="tab-content">
                {activeTab === 'installed' ? (
                    loading ? (
                        <div className="agent-loading">加载中...</div>
                    ) : (
                        <div className="agent-sections">
                            {totalToolCount > MAX_TOOL_COUNT && (
                                <div className="mcp-tool-warning">
                                    <div className="mcp-tool-warning-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="8" x2="12" y2="12" />
                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                    </div>
                                    <div className="mcp-tool-warning-content">
                                        <div className="mcp-tool-warning-title">
                                            工具数量过多（当前 {totalToolCount} 个）
                                        </div>
                                        <div className="mcp-tool-warning-desc">
                                            建议启用的工具总数不超过 {MAX_TOOL_COUNT} 个，过多的工具可能会影响 AI 的选择准确性。请考虑禁用不常用的工具或 MCP 服务。
                                        </div>
                                    </div>
                                </div>
                            )}
                            <SystemToolsGroup
                                tools={systemTools}
                                onToolToggle={handleSystemToolToggle}
                            />
                            <MCPGroup
                                title="项目级 MCP"
                                servers={mcpData.project}
                                scope="project"
                                onReconnect={handleReconnect}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onToggle={handleToggle}
                                onToolToggle={handleMCPToolToggle}
                                reconnectingNames={reconnectingNames}
                                deletingNames={deletingNames}
                            />
                            <MCPGroup
                                title="用户级 MCP"
                                servers={mcpData.user}
                                scope="user"
                                onReconnect={handleReconnect}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onToggle={handleToggle}
                                onToolToggle={handleMCPToolToggle}
                                connectedProjectMCPs={connectedProjectMCPs}
                                reconnectingNames={reconnectingNames}
                                deletingNames={deletingNames}
                            />
                        </div>
                    )
                ) : (
                    <div className="mcp-market">
                        {/* 搜索框 */}
                        <div className="mcp-search-box">
                            <input
                                type="text"
                                className="mcp-search-input"
                                placeholder="搜索 MCP 服务..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* 市场列表 */}
                        <div className="mcp-market-list">
                            {filteredMarketItems.map((item) => (
                                <MCPMarketCard
                                    key={item.config.name}
                                    item={item}
                                    isInstalled={installedNames.has(item.config.name)}
                                    onInstall={handleInstallClick}
                                    vscode={vscode}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 编辑弹窗 */}
            {editingServer && (
                <MCPEditModal
                    server={editingServer.server}
                    scope={editingServer.scope}
                    require={editingServer.require}
                    onClose={() => { setEditingServer(null); setIsSavingEdit(false); }}
                    onSave={handleSaveEdit}
                    vscode={vscode}
                    isSaving={isSavingEdit}
                />
            )}
        </div>
    );
};

export default MCPConfig;
