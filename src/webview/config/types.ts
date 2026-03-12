// 模型管理相关接口
export interface ModelConfig {
    provider: string;
    modelName: string;
    baseURL: string;
    apiKey: string;
    maxTokens: number;
    contextLength: number;
}

export interface TaskConfig {
    main: string;
    quick: string;
}

// 模型信息接口
export interface ModelInfo {
    id: string;
    name: string;
    ownedBy?: string;
    key_doc_url?: string;
}

// 获取模型列表参数接口
export interface FetchModelsParams {
    baseURL: string;
    apiKey: string;
}

// 获取模型列表结果接口
export interface FetchModelsResult {
    success: boolean;
    models?: ModelInfo[];
    message?: string;
    curlCommand?: string;
}

// API 连接测试结果接口
export interface ApiTestResult {
    success: boolean;
    message: string;
    curlCommand?: string;
}

// API 连接测试参数接口
export interface ApiTestParams {
    baseURL: string;
    apiKey: string;
    modelName: string;
}

// 模型更新数据接口
export interface ModelUpdateData {
    modelName: string;
    modelList: string[];
    taskConfig: {
        main: string;
        quick: string;
    };
}

// webview 配置接口，直接使用 ModelUpdateData
export interface Config extends ModelUpdateData {}

export interface VscodeApi {
    postMessage(message: any): void;
    getState(): any;
    setState(state: any): void;
}

declare global {
    interface Window {
        acquireVsCodeApi(): VscodeApi;
    }
}

// MCP 相关类型定义
export type MCPTransportType = 'stdio' | 'sse' | 'http';
export type MCPScopeType = 'project' | 'user';
export type MCPServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MCPServerConfig {
    name: string;
    transport: MCPTransportType;
    description?: string;
    enabled?: boolean;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    useTools?: string[] | null;
}

export interface MCPToolDefinition {
    name: string;
    description?: string;
    inputSchema: {
        type: 'object';
        properties?: Record<string, any>;
        required?: string[];
    };
}

export interface MCPServerCapabilities {
    tools?: MCPToolDefinition[];
}

export interface MCPServerInfo {
    config: MCPServerConfig;
    status: MCPServerStatus;
    capabilities?: MCPServerCapabilities;
    error?: string;
    connectedAt?: number;
}

export interface MCPData {
    project: MCPServerInfo[];
    user: MCPServerInfo[];
}

// MCP 市场相关类型
export interface MCPMarketInfo {
    config: MCPServerConfig;
    description: string;
    icon: string;
    github?: string;
    tools: string[];
    tags: string[];
}

// 工具信息类型
export interface ToolInfo {
  name: string
  description: string
  status: 'enable' | 'disable'
}

// 系统工具数据（带启用状态）
export interface SystemToolInfo extends ToolInfo {
  enabled: boolean
}

// 系统工具数据
export interface SystemToolsData {
  tools: SystemToolInfo[]
}

// Skill 位置类型
export type SkillLocate = 'user' | 'project';

// Skill 信息类型
export interface SkillInfo {
  name: string;
  description: string;
  locate: SkillLocate;
}

// 工具预设类型
export interface ToolPreset {
  name: string;
  tools: string[];
}

// 工具预设集合类型
export type ToolPresets = {
  [key: string]: ToolPreset;
};
