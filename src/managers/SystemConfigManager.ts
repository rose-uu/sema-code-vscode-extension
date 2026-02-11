import * as vscode from 'vscode';
import { UpdatableCoreConfig } from 'sema-core/types';
import { defaultConfig } from '../webview/config/default/defaultConfig';

/**
 * SystemConfigManager 类 - 管理系统配置的持久化存储
 */
export class SystemConfigManager {
    private static readonly CONFIG_KEY = 'sema.systemConfig';
    private static readonly USE_TOOLS_KEY = 'sema.useTools';
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * 获取系统配置
     */
    public getSystemConfig(): UpdatableCoreConfig {
        try {
            const stored = this.context.globalState.get<UpdatableCoreConfig>(SystemConfigManager.CONFIG_KEY);

            // 如果没有存储的配置，创建并存储默认配置
            if (!stored) {
                console.log('No stored system config found, creating and storing default config');
                const defaultConfigCopy = { ...defaultConfig };

                // 异步保存默认配置，但不等待完成
                this.context.globalState.update(SystemConfigManager.CONFIG_KEY, defaultConfigCopy)
                    .then(() => {
                        console.log('Default system config saved successfully');
                    }, (error: any) => {
                        console.error('Error saving default system config:', error);
                    });

                return defaultConfigCopy;
            }

            // 合并存储的配置和默认配置，确保所有字段都有值
            const config = {
                ...defaultConfig,
                ...stored
            };

            // console.log('Loaded system config:', config);
            return config;

        } catch (error) {
            console.error('Error loading system config:', error);
            return { ...defaultConfig };
        }
    }

    /**
     * 保存系统配置
     */
    public async saveSystemConfig(config: UpdatableCoreConfig): Promise<void> {
        try {
            await this.context.globalState.update(SystemConfigManager.CONFIG_KEY, config);
            console.log('System config updated:', config);
        } catch (error) {
            console.error('Error saving system config:', error);
            throw new Error(`保存系统配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 保存单个系统配置项
     */
    public async saveSystemConfigByKey<K extends keyof UpdatableCoreConfig>(
        key: K,
        value: UpdatableCoreConfig[K]
    ): Promise<void> {
        try {
            const currentConfig = this.getSystemConfig();
            const newConfig = { ...currentConfig, [key]: value };
            await this.context.globalState.update(SystemConfigManager.CONFIG_KEY, newConfig);
            console.log(`System config updated: ${String(key)} =`, value);

        } catch (error) {
            console.error('Error saving system config by key:', error);
            throw new Error(`保存系统配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 获取 useTools 配置
     */
    public getUseTools(): string[] | null {
        try {
            const stored = this.context.globalState.get<string[] | null>(SystemConfigManager.USE_TOOLS_KEY);
            return stored !== undefined ? stored : defaultConfig.useTools || null;
        } catch (error) {
            console.error('Error loading useTools config:', error);
            return defaultConfig.useTools || null;
        }
    }

    /**
     * 保存 useTools 配置
     */
    public async saveUseTools(useTools: string[] | null): Promise<void> {
        try {
            await this.context.globalState.update(SystemConfigManager.USE_TOOLS_KEY, useTools);
            console.log('UseTools config saved successfully:', useTools);
        } catch (error) {
            console.error('Error saving useTools config:', error);
            throw new Error(`保存 useTools 配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

}