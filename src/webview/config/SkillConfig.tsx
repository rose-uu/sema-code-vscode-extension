import React, { useState, useEffect, useMemo } from 'react';
import { VscodeApi } from './types';
import { getColorByName } from './utils/iconUtils';
import { RefreshIcon, EditIcon } from './utils/svgIcons';
import { SkillScope, SkillConfig as SkillConfigItem } from './types/skill';
import './style/agent.css';

interface SkillConfigProps {
    vscode: VscodeApi;
}

const LOCATE_ORDER: SkillScope[] = ['project', 'user', 'plugin'];

const LOCATE_SECTION_TITLES: Record<SkillScope, string> = {
    plugin: '插件 Skills',
    project: '项目级 Skills',
    user: '用户级 Skills',
};

const LOCATE_PATHS: Record<SkillScope, string> = {
    plugin: '',
    project: '.sema/skills/',
    user: '~/.sema/skills/',
};

type SkillTabType = 'installed' | 'hub';

const SkillConfig: React.FC<SkillConfigProps> = ({ vscode }) => {
    const [activeTab, setActiveTab] = useState<SkillTabType>('installed');
    const [skills, setSkills] = useState<SkillConfigItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const groupedSkills = useMemo(() => {
        const groups: Record<SkillScope | 'other', SkillConfigItem[]> = {
            plugin: [],
            project: [],
            user: [],
            other: [],
        };
        skills.forEach(skill => {
            const loc = skill.locate;
            if (skill.from && skill.from !== 'sema') {
                groups.other.push(skill);
            } else if (loc && groups[loc]) {
                groups[loc].push(skill);
            } else {
                groups.other.push(skill);
            }
        });
        return groups;
    }, [skills]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'loadSkillsInfoResult':
                    if (message.success) {
                        setSkills(message.data || []);
                    }
                    setLoading(false);
                    break;
                case 'refreshSkillsInfoResult':
                    setIsRefreshing(false);
                    if (message.success) {
                        setSkills(message.data || []);
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'loadSkillsInfo' });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [vscode]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        vscode.postMessage({ command: 'refreshSkills' });
    };

    const toggleDescriptionExpand = (index: number) => {
        setExpandedDescriptions(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
        });
    };

    const getSkillInitial = (name: string): string => {
        if (!name) return '?';
        return name.charAt(0).toUpperCase();
    };

    const handleEditSkill = (skill: SkillConfigItem) => {
        if (skill.filePath) {
            vscode.postMessage({ command: 'openFile', filePath: skill.filePath });
        }
    };

    const renderSkillCard = (skill: SkillConfigItem, globalIndex: number) => {
        const DESC_MAX = 150;
        const description = skill.description || '暂无描述';
        const isDescExpanded = expandedDescriptions.has(globalIndex);
        const isLongDesc = description.length > DESC_MAX;
        const isReadonly = (skill.from && skill.from !== 'sema') || skill.locate === 'plugin';

        return (
            <div key={globalIndex} className="agent-card">
                <div className="agent-header">
                    <div className="agent-icon" style={{ backgroundColor: getColorByName(skill.name) }}>
                        {getSkillInitial(skill.name)}
                    </div>
                    <div className="agent-name-group">
                        <span className="agent-name">{skill.name}</span>
                        {isReadonly && (
                            <span className="readonly-tab">只读</span>
                        )}
                    </div>
                    {!isReadonly && (
                        <div className="agent-card-actions">
                            <button
                                className="mcp-icon-btn"
                                title="编辑"
                                onClick={(e) => { e.stopPropagation(); handleEditSkill(skill); }}
                            >
                                <EditIcon />
                            </button>
                        </div>
                    )}
                </div>
                <div className={`agent-description ${isLongDesc && !isDescExpanded ? 'collapsed' : ''}`}>
                    {isLongDesc && !isDescExpanded
                        ? description.slice(0, DESC_MAX) + '...'
                        : description
                    }
                    {isLongDesc && (
                        <span
                            className="description-toggle"
                            onClick={() => toggleDescriptionExpand(globalIndex)}
                        >
                            {isDescExpanded ? '收起' : '更多'}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const getGlobalIndex = (locate: SkillScope | 'other', localIndex: number): number => {
        let offset = 0;
        for (const loc of [...LOCATE_ORDER, 'other' as const]) {
            if (loc === locate) break;
            offset += groupedSkills[loc].length;
        }
        return offset + localIndex;
    };

    const ALL_SECTIONS: Array<SkillScope | 'other'> = [...LOCATE_ORDER, 'other'];
    const SECTION_TITLES: Record<SkillScope | 'other', string> = {
        ...LOCATE_SECTION_TITLES,
        other: '外部 Skills',
    };

    return (
        <div className="agent-config plugin-config">
            {/* Tab 导航 */}
            <div className="tab-navigation">
                <div
                    className={`tab-item ${activeTab === 'installed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('installed')}
                >
                    已安装
                    {skills.length > 0 && (
                        <span className="plugin-tab-count">{skills.length}</span>
                    )}
                </div>
                <div
                    className={`tab-item ${activeTab === 'hub' ? 'active' : ''}`}
                    onClick={() => setActiveTab('hub')}
                >
                    SkillHub
                </div>
                <div className="plugin-tab-actions">
                    {activeTab === 'installed' && (
                        <button
                            className={`mcp-icon-btn ${isRefreshing ? 'btn-loading' : ''}`}
                            onClick={handleRefresh}
                            title="刷新 Skills"
                            disabled={isRefreshing}
                        >
                            {isRefreshing ? (
                                <span className="spinner" />
                            ) : (
                                <RefreshIcon size={14} />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* 内容 */}
            <div className="tab-content">
                {activeTab === 'hub' ? (
                    <div className="section-empty" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--vscode-descriptionForeground)' }}>
                        敬请期待
                    </div>
                ) : loading ? (
                    <div className="agent-loading">加载中...</div>
                ) : (
                    <div className="agent-sections">
                        {ALL_SECTIONS.map(scope => {
                            const sectionSkills = groupedSkills[scope] || [];
                            if (sectionSkills.length === 0) return null;

                            const isCollapsed = collapsedSections.has(scope);
                            const toggleCollapse = () => setCollapsedSections(prev => {
                                const next = new Set(prev);
                                if (next.has(scope)) next.delete(scope); else next.add(scope);
                                return next;
                            });

                            return (
                                <div key={scope} className={`agent-section section-${scope}`}>
                                    <div
                                        className="section-group-title section-group-title-collapsible"
                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                        onClick={toggleCollapse}
                                    >
                                        {SECTION_TITLES[scope]}
                                        {scope !== 'other' && LOCATE_PATHS[scope as SkillScope] && (
                                            <span className="section-group-count">({LOCATE_PATHS[scope as SkillScope]})</span>
                                        )}
                                        <span className={`section-collapse-arrow ${isCollapsed ? 'collapsed' : ''}`} />
                                    </div>
                                    {!isCollapsed && (
                                        sectionSkills.length === 0 ? (
                                            <div className="section-empty">暂无 Skill</div>
                                        ) : (
                                            <div className="agent-list">
                                                {sectionSkills.map((skill, localIndex) =>
                                                    renderSkillCard(skill, getGlobalIndex(scope, localIndex))
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            );
                        })}
                        {ALL_SECTIONS.every(s => (groupedSkills[s] || []).length === 0) && (
                            <div className="section-empty">暂无 Skill</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SkillConfig;
