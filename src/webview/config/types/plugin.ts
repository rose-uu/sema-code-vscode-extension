export type PluginTabType = 'installed' | 'market';

export type PluginScope = 'local' | 'project' | 'user';

export interface PluginSource {
    source: 'github' | 'directory';
    repo?: string;
    path?: string;
}

export interface AvailablePlugin {
    name: string;
    description: string;
    author: string;
}

export interface MarketplaceInfo {
    name: string;
    source: PluginSource;
    lastUpdated: string;
    available: AvailablePlugin[];
    installed: string[];
    from: string;
}

export interface PluginComponents {
    commands: string[];
    agents: string[];
    skills: string[];
}

export interface PluginInfo {
    name: string;
    marketplace: string;
    scope: PluginScope;
    status: boolean;
    version?: string;
    description?: string;
    author?: string;
    components: PluginComponents;
    from: string;
}

export interface MarketplacePluginsInfo {
    marketplaces: MarketplaceInfo[];
    plugins: PluginInfo[];
}
