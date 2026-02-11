import React, { useState, useEffect, useMemo } from 'react';
import { VscodeApi, AgentInfo, AgentLocate, AgentConfig as AgentConfigType, SystemToolInfo } from './types';
import { getColorByName } from './utils/iconUtils';
import './style/agent.css';

// 预设工具组合
const TOOL_PRESETS = {
    readonly: {
        name: '只读工具',
        tools: ['Glob', 'Grep', 'Read', 'TodoWrite']
    },
    edit: {
        name: '编辑工具',
        tools: ['Edit', 'Write', 'NotebookEdit']
    },
    execute: {
        name: '执行工具',
        tools: ['Bash']
    },
    other: {
        name: '其他工具',
        tools: ['Skill']
    }
};

// 所有可用工具列表
const ALL_TOOLS = ['Bash', 'Glob', 'Grep', 'Read', 'Edit', 'Write', 'NotebookEdit', 'TodoWrite', 'Skill'];

// 创建表单的初始状态
const initialFormState: Omit<AgentConfigType, 'locate'> & { locate: 'project' | 'user' } = {
    name: '',
    description: '',
    prompt: '',
    tools: undefined,
    model: 'main',
    locate: 'project'
};

interface AgentConfigProps {
    vscode: VscodeApi;
}

const LOCATE_LABELS: Record<AgentLocate, string> = {
    builtin: '内置',
    project: '项目',
    user: '用户'
};

const LOCATE_ORDER: AgentLocate[] = ['builtin', 'project', 'user'];

const LOCATE_SECTION_TITLES: Record<AgentLocate, string> = {
    builtin: '内置 Agent',
    project: '项目级 Agent',
    user: '用户级 Agent'
};

const LOCATE_PATHS: Record<AgentLocate, string> = {
    builtin: '',
    project: '.sema/agents/',
    user: '~/.sema/agents/'
};

const AgentConfig: React.FC<AgentConfigProps> = ({ vscode }) => {
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());

    // 创建表单相关状态
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [useAllTools, setUseAllTools] = useState(true); // 默认使用所有工具
    const [submitting, setSubmitting] = useState(false);

    // 工具选择相关状态
    const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set(ALL_TOOLS)); // 默认全选
    const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set(['all'])); // 默认选中全部工具预设

    // 按位置分组 agents
    const groupedAgents = useMemo(() => {
        const groups: Record<AgentLocate, AgentInfo[]> = {
            builtin: [],
            project: [],
            user: []
        };
        agents.forEach(agent => {
            if (groups[agent.locate]) {
                groups[agent.locate].push(agent);
            }
        });
        return groups;
    }, [agents]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            switch (message.command) {
                case 'loadAgentsInfoResult':
                    if (message.success) {
                        setAgents(message.data || []);
                    }
                    setLoading(false);
                    break;
                case 'addAgentResult':
                    setSubmitting(false);
                    if (message.success) {
                        // 创建成功，重置表单并关闭
                        setFormData(initialFormState);
                        setUseAllTools(true); // 重置为默认使用所有工具
                        setSelectedTools(new Set(ALL_TOOLS)); // 重置为全选
                        setSelectedPresets(new Set(['all'])); // 重置为全部工具预设
                        setShowCreateForm(false);
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);

        // 加载 agent 信息
        vscode.postMessage({ command: 'loadAgentsInfo' });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [vscode]);

    // 切换工具展开状态
    const toggleToolsExpand = (agentIndex: number) => {
        setExpandedTools(prev => {
            const newSet = new Set(prev);
            if (newSet.has(agentIndex)) {
                newSet.delete(agentIndex);
            } else {
                newSet.add(agentIndex);
            }
            return newSet;
        });
    };

    // 切换描述展开状态
    const toggleDescriptionExpand = (agentIndex: number) => {
        setExpandedDescriptions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(agentIndex)) {
                newSet.delete(agentIndex);
            } else {
                newSet.add(agentIndex);
            }
            return newSet;
        });
    };

    // 处理表单字段变化
    const handleFormChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // 处理工具选择变化
    const handleToolSelection = (tool: string, checked: boolean) => {
        setSelectedTools(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(tool);
            } else {
                newSet.delete(tool);
            }
            // 更新预设选择状态
            updatePresetSelection(newSet);
            return newSet;
        });
    };

    // 处理预设选择变化
    const handlePresetSelection = (presetKey: string, checked: boolean) => {
        const preset = TOOL_PRESETS[presetKey as keyof typeof TOOL_PRESETS];
        if (!preset) return;

        setSelectedTools(prev => {
            const newSet = new Set(prev);
            if (checked) {
                // 添加预设中的所有工具
                preset.tools.forEach(tool => newSet.add(tool));
            } else {
                // 移除预设中的所有工具
                preset.tools.forEach(tool => newSet.delete(tool));
            }
            // 更新预设选择状态
            updatePresetSelection(newSet);
            return newSet;
        });
    };

    // 更新预设选择状态
    const updatePresetSelection = (selectedToolsSet: Set<string>) => {
        const newSelectedPresets = new Set<string>();
        Object.entries(TOOL_PRESETS).forEach(([key, preset]) => {
            // 检查预设中的所有工具是否都被选中
            const allToolsSelected = preset.tools.every(tool => selectedToolsSet.has(tool));
            if (allToolsSelected) {
                newSelectedPresets.add(key);
            }
        });
        setSelectedPresets(newSelectedPresets);
    };

    // 全选/取消全选工具
    const handleSelectAllTools = (selectAll: boolean) => {
        if (selectAll) {
            setSelectedTools(new Set(ALL_TOOLS));
            setSelectedPresets(new Set(['all']));
        } else {
            setSelectedTools(new Set());
            setSelectedPresets(new Set());
        }
    };

    // 长度限制常量
    const NAME_MIN = 3;
    const NAME_MAX = 50;
    const DESCRIPTION_MIN = 1;
    const DESCRIPTION_MAX = 200;
    const PROMPT_MIN = 1;
    const PROMPT_MAX = 1000;

    // 验证名称长度和格式
    const isNameValid = () => {
        const name = formData.name.trim();
        const len = name.length;
        // 长度验证
        if (len < NAME_MIN || len > NAME_MAX) {
            return false;
        }
        // 格式验证：只允许英文字母、数字、连字符和下划线
        const nameRegex = /^[a-zA-Z0-9_-]+$/;
        return nameRegex.test(name);
    };

    // 验证描述长度
    const isDescriptionValid = () => {
        const len = formData.description.trim().length;
        return len >= DESCRIPTION_MIN && len <= DESCRIPTION_MAX;
    };

    // 验证 Prompt 长度
    const isPromptValid = () => {
        const len = formData.prompt.trim().length;
        return len >= PROMPT_MIN && len <= PROMPT_MAX;
    };

    // 处理表单提交
    const handleSubmit = () => {
        // 验证必填字段
        if (!formData.name.trim() || !isNameValid()) {
            return;
        }
        if (!formData.description.trim() || !isDescriptionValid()) {
            return;
        }
        if (!formData.prompt.trim() || !isPromptValid()) {
            return;
        }

        setSubmitting(true);

        // 构建工具列表
        let tools: string[] | '*' | undefined;
        if (useAllTools) {
            tools = '*';
        } else if (selectedTools.size > 0) {
            tools = Array.from(selectedTools);
        }

        vscode.postMessage({
            command: 'addAgent',
            data: {
                name: formData.name.trim(),
                description: formData.description.trim(),
                prompt: formData.prompt.trim(),
                tools,
                model: formData.model || 'main',
                locate: formData.locate
            }
        });
    };

    // 取消创建
    const handleCancel = () => {
        setFormData(initialFormState);
        setUseAllTools(true); // 重置为默认使用所有工具
        setSelectedTools(new Set(ALL_TOOLS)); // 重置为全选
        setSelectedPresets(new Set(['all'])); // 重置为全部工具预设
        setShowCreateForm(false);
    };

    // 渲染工具列表
    const renderTools = (tools: string[] | '*' | undefined, agentIndex: number) => {
        if (!tools) {
            return <span className="tools-none">无工具</span>;
        }
        if (tools === '*') {
            return <span className="tools-all">所有工具</span>;
        }
        if (tools.length === 0) {
            return <span className="tools-none">无工具</span>;
        }

        const isExpanded = expandedTools.has(agentIndex);
        const displayTools = isExpanded ? tools : tools.slice(0, 3);
        const hasMore = tools.length > 3;

        return (
            <div className="tools-list">
                {displayTools.map((tool, index) => (
                    <span key={index} className="tool-tag">{tool}</span>
                ))}
                {hasMore && !isExpanded && (
                    <span
                        className="tool-tag tool-more"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleToolsExpand(agentIndex);
                        }}
                    >
                        +{tools.length - 3}
                    </span>
                )}
                {hasMore && isExpanded && (
                    <span
                        className="tool-tag tool-collapse"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleToolsExpand(agentIndex);
                        }}
                    >
                        收起
                    </span>
                )}
            </div>
        );
    };

    // 渲染创建表单
    const renderCreateForm = () => {
        if (!showCreateForm) return null;

        return (
            <div className="agent-create-form">
                <div className="form-header">
                    <h3>创建新 Agent</h3>
                    <button className="close-btn" onClick={handleCancel}>×</button>
                </div>

                <div className="form-body">
                    <div className="agent-form-group">
                        <label>名称 <span className="required">*</span></label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleFormChange('name', e.target.value)}
                            placeholder="Agent 名称，如：test_runner, code-checker 等"
                            maxLength={NAME_MAX}
                            className={formData.name.trim() && !isNameValid() ? 'input-error' : ''}
                        />
                        <div className="field-hint">
                            <span className={formData.name.trim().length > NAME_MAX ? 'error' : ''}>
                                {formData.name.length}/{NAME_MAX}
                            </span>
                            {formData.name.trim().length > 0 && formData.name.trim().length < NAME_MIN && (
                                <span className="error">（至少 {NAME_MIN} 字符）</span>
                            )}
                            {formData.name.trim().length >= NAME_MIN && formData.name.trim().length <= NAME_MAX && !isNameValid() && (
                                <span className="error">（只允许英文字母、数字、连字符和下划线）</span>
                            )}
                        </div>
                    </div>

                    <div className="agent-form-group">
                        <label>描述 <span className="required">*</span></label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => handleFormChange('description', e.target.value)}
                            placeholder="Agent 的使用时机"
                            maxLength={DESCRIPTION_MAX}
                            className={formData.description.trim() && !isDescriptionValid() ? 'input-error' : ''}
                        />
                        <div className="field-hint">
                            <span className={formData.description.trim().length > DESCRIPTION_MAX ? 'error' : ''}>
                                {formData.description.length}/{DESCRIPTION_MAX}
                            </span>
                            {formData.description.trim().length > 0 && formData.description.trim().length < DESCRIPTION_MIN && (
                                <span className="error">（至少 {DESCRIPTION_MIN} 字符）</span>
                            )}
                        </div>
                    </div>

                    <div className="agent-form-group">
                        <label>Prompt <span className="required">*</span></label>
                        <textarea
                            value={formData.prompt}
                            onChange={(e) => handleFormChange('prompt', e.target.value)}
                            placeholder="Agent 的系统提示词"
                            rows={4}
                            maxLength={PROMPT_MAX}
                            className={formData.prompt.trim() && !isPromptValid() ? 'input-error' : ''}
                        />
                        <div className="field-hint">
                            <span className={!isPromptValid() && formData.prompt.trim().length > 0 ? 'error' : ''}>
                                {formData.prompt.length}/{PROMPT_MAX}
                            </span>
                            {formData.prompt.trim().length > 0 && formData.prompt.trim().length < PROMPT_MIN && (
                                <span className="error">（至少 {PROMPT_MIN} 字符）</span>
                            )}
                        </div>
                    </div>

                    <div className="agent-form-group">
                        <label>工具</label>
                        <div className="tools-input-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={useAllTools}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setUseAllTools(checked);
                                        if (!checked) {
                                            // 取消勾选"使用所有工具"时，默认只选择只读工具预设
                                            const readonlyTools = TOOL_PRESETS.readonly.tools;
                                            setSelectedTools(new Set(readonlyTools));
                                            setSelectedPresets(new Set(['readonly']));
                                        }
                                    }}
                                />
                                使用所有工具
                            </label>
                            {!useAllTools && (
                                <div className="tools-selection">
                                    {/* 预设工具组合 */}
                                    <div className="tools-presets">
                                        <div className="presets-title">预设</div>
                                        <div className="presets-grid">
                                            {Object.entries(TOOL_PRESETS).map(([key, preset]) => (
                                                <label key={key} className="checkbox-label preset-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPresets.has(key)}
                                                        onChange={(e) => handlePresetSelection(key, e.target.checked)}
                                                    />
                                                    {preset.name} ({preset.tools.length})
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 单独工具选择 */}
                                    <div className="tools-header">
                                        <div className="select-all-indicator">
                                            已选择 ({selectedTools.size}/{ALL_TOOLS.length})
                                        </div>
                                    </div>
                                    <div className="tools-list-checkboxes">
                                        {ALL_TOOLS.map((tool, index) => (
                                            <label key={index} className="checkbox-label tool-item">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTools.has(tool)}
                                                    onChange={(e) => handleToolSelection(tool, e.target.checked)}
                                                />
                                                {tool}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="agent-form-group">
                            <label>模型</label>
                            <select
                                value={formData.model}
                                onChange={(e) => handleFormChange('model', e.target.value)}
                            >
                                <option value="main">Main (默认)</option>
                                <option value="quick">Quick</option>
                            </select>
                        </div>

                        <div className="agent-form-group">
                            <label>位置</label>
                            <select
                                value={formData.locate}
                                onChange={(e) => handleFormChange('locate', e.target.value as 'project' | 'user')}
                            >
                                <option value="project">项目级 (默认)</option>
                                <option value="user">用户级</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="form-footer">
                    <button className="btn-secondary" onClick={handleCancel}>取消</button>
                    <button
                        className="btn-primary"
                        onClick={handleSubmit}
                        disabled={submitting || !formData.name.trim() || !isNameValid() || !isDescriptionValid() || !isPromptValid()}
                    >
                        {submitting ? '创建中...' : '创建'}
                    </button>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="agent-config">
                <div className="section-title">Agents</div>
                <div className="agent-loading">加载中...</div>
            </div>
        );
    }

    // 获取 agent 名称的首字符（大写）
    const getAgentInitial = (name: string): string => {
        if (!name) return '?';
        return name.charAt(0).toUpperCase();
    };

    // 获取模型标签的类名
    const getModelBadgeClass = (model: string): string => {
        if (model === 'main' || model === 'quick') {
            return `model-badge model-${model}`;
        }
        return 'model-badge model-default';
    };

    // 渲染单个 agent 卡片
    const renderAgentCard = (agent: AgentInfo, globalIndex: number) => {
        const LongDescValue = 150
        const description = agent.description || '暂无描述';
        const isDescriptionExpanded = expandedDescriptions.has(globalIndex);
        const isLongDescription = description.length > LongDescValue;

        return (
            <div key={globalIndex} className="agent-card">
                <div className="agent-header">
                    <div className="agent-icon" style={{ backgroundColor: getColorByName(agent.name) }}>
                        {getAgentInitial(agent.name)}
                    </div>
                    <div className="agent-name">{agent.name}</div>
                    {agent.model && (
                        <span className={getModelBadgeClass(agent.model)}>
                            {agent.model}
                        </span>
                    )}
                </div>
                <div className={`agent-description ${isLongDescription && !isDescriptionExpanded ? 'collapsed' : ''}`}>
                    {isLongDescription && !isDescriptionExpanded
                        ? description.slice(0, LongDescValue) + '...'
                        : description
                    }
                    {isLongDescription && (
                        <span
                            className="description-toggle"
                            onClick={() => toggleDescriptionExpand(globalIndex)}
                        >
                            {isDescriptionExpanded ? '收起' : '查看更多'}
                        </span>
                    )}
                </div>
                <div className="agent-tools">
                    <span className="tools-label">工具:</span>
                    {renderTools(agent.tools, globalIndex)}
                </div>
            </div>
        );
    };

    // 计算全局索引
    const getGlobalIndex = (locate: AgentLocate, localIndex: number): number => {
        let offset = 0;
        for (const loc of LOCATE_ORDER) {
            if (loc === locate) break;
            offset += groupedAgents[loc].length;
        }
        return offset + localIndex;
    };

    return (
        <div className="agent-config">
            <div className="section-header">
                <div className="section-title">SubAgents</div>
                <div className="section-header-right">
                    <div className="agent-count">{agents.length} 个可用</div>
                    <button
                        className="btn-create"
                        onClick={() => {
                            setShowCreateForm(true);
                            // 默认使用所有工具
                            setUseAllTools(true);
                            setSelectedTools(new Set(ALL_TOOLS));
                            setSelectedPresets(new Set(['all']));
                        }}
                    >
                        + 创建 Agent
                    </button>
                </div>
            </div>

            {renderCreateForm()}

            {agents.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                            <circle cx="19" cy="5" r="2" />
                            <circle cx="5" cy="5" r="2" />
                        </svg>
                    </div>
                    <p>暂无可用的 SubAgent</p>
                </div>
            ) : (
                <div className="agent-sections">
                    {LOCATE_ORDER.map(locate => {
                        const sectionAgents = groupedAgents[locate];
                        // 项目级和用户级 Agent 即使数量为 0 也显示，内置 Agent 为 0 时隐藏
                        if (sectionAgents.length === 0 && locate === 'builtin') return null;

                        return (
                            <div key={locate} className={`agent-section section-${locate}`}>
                                <div className="section-group-title">
                                    {LOCATE_SECTION_TITLES[locate]}
                                    {LOCATE_PATHS[locate] && (
                                        <span className="section-group-count">({LOCATE_PATHS[locate]})</span>
                                    )}
                                </div>
                                {sectionAgents.length === 0 ? (
                                    <div className="section-empty">
                                        暂无 Agent
                                    </div>
                                ) : (
                                    <div className="agent-list">
                                        {sectionAgents.map((agent, localIndex) =>
                                            renderAgentCard(agent, getGlobalIndex(locate, localIndex))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AgentConfig;
