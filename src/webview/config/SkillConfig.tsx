import React, { useState, useEffect, useMemo } from 'react';
import { VscodeApi, SkillInfo, SkillLocate } from './types';
import { getColorByName } from './utils/iconUtils';
import './style/agent.css'; // 复用 agent 样式

interface SkillConfigProps {
    vscode: VscodeApi;
}

const LOCATE_ORDER: SkillLocate[] = ['project', 'user'];

const LOCATE_SECTION_TITLES: Record<SkillLocate, string> = {
    project: '项目级 Skill',
    user: '用户级 Skill'
};

const LOCATE_PATHS: Record<SkillLocate, string> = {
    project: '.sema/skills/',
    user: '~/.sema/skills/'
};

const SkillConfig: React.FC<SkillConfigProps> = ({ vscode }) => {
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());

    // 按位置分组 skills
    const groupedSkills = useMemo(() => {
        const groups: Record<SkillLocate, SkillInfo[]> = {
            project: [],
            user: []
        };
        skills.forEach(skill => {
            if (groups[skill.locate]) {
                groups[skill.locate].push(skill);
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
            }
        };

        window.addEventListener('message', handleMessage);

        // 加载 skill 信息
        vscode.postMessage({ command: 'loadSkillsInfo' });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [vscode]);

    // 切换描述展开状态
    const toggleDescriptionExpand = (skillIndex: number) => {
        setExpandedDescriptions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(skillIndex)) {
                newSet.delete(skillIndex);
            } else {
                newSet.add(skillIndex);
            }
            return newSet;
        });
    };

    if (loading) {
        return (
            <div className="agent-config">
                <div className="section-title">Skills</div>
                <div className="agent-loading">加载中...</div>
            </div>
        );
    }

    // 获取 skill 名称的首字符（大写）
    const getSkillInitial = (name: string): string => {
        if (!name) return '?';
        return name.charAt(0).toUpperCase();
    };

    // 渲染单个 skill 卡片
    const renderSkillCard = (skill: SkillInfo, globalIndex: number) => {
        const LongDescValue = 150
        const description = skill.description || '暂无描述';
        const isDescriptionExpanded = expandedDescriptions.has(globalIndex);
        const isLongDescription = description.length > LongDescValue;

        return (
            <div key={globalIndex} className="agent-card">
                <div className="agent-header">
                    <div className="agent-icon" style={{ backgroundColor: getColorByName(skill.name) }}>
                        {getSkillInitial(skill.name)}
                    </div>
                    <div className="agent-name">{skill.name}</div>
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
            </div>
        );
    };

    // 计算全局索引
    const getGlobalIndex = (locate: SkillLocate, localIndex: number): number => {
        let offset = 0;
        for (const loc of LOCATE_ORDER) {
            if (loc === locate) break;
            offset += groupedSkills[loc].length;
        }
        return offset + localIndex;
    };

    return (
        <div className="agent-config">
            <div className="section-header">
                <div className="section-title">Skills</div>
                <div className="section-header-right">
                    <div className="agent-count">{skills.length} 个可用</div>
                </div>
            </div>

            <div className="agent-sections">
                {LOCATE_ORDER.map(locate => {
                    const sectionSkills = groupedSkills[locate];
                    return (
                        <div key={locate} className={`agent-section section-${locate}`}>
                            <div className="section-group-title">
                                {LOCATE_SECTION_TITLES[locate]}
                                {LOCATE_PATHS[locate] && (
                                    <span className="section-group-count">({LOCATE_PATHS[locate]})</span>
                                )}
                            </div>
                            {sectionSkills.length === 0 ? (
                                <div className="section-empty">
                                    暂无 Skill
                                </div>
                            ) : (
                                <div className="agent-list">
                                    {sectionSkills.map((skill, localIndex) =>
                                        renderSkillCard(skill, getGlobalIndex(locate, localIndex))
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

export default SkillConfig;
