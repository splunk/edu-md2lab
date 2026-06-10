import logger from '../src/utils/logger.js';

class PluginManager {
    constructor() {
        this.plugins = [];
        this.hooks = {
            admonitionTypes: [], // custom admonition type names to register
            fontFamilies: [], // additional font-family strings for CSS
            labels: {}, // label overrides e.g. { note: 'Note personnalisée' }
        };
    }

    register(plugin) {
        if (!plugin || !plugin.name) {
            logger.warn('Plugin registration skipped: missing name');
            return;
        }

        this.plugins.push(plugin);

        if (plugin.hooks) {
            if (Array.isArray(plugin.hooks.admonitionTypes)) {
                this.hooks.admonitionTypes.push(...plugin.hooks.admonitionTypes);
            }
            if (Array.isArray(plugin.hooks.fontFamilies)) {
                this.hooks.fontFamilies.push(...plugin.hooks.fontFamilies);
            }
            if (plugin.hooks.labels && typeof plugin.hooks.labels === 'object') {
                Object.assign(this.hooks.labels, plugin.hooks.labels);
            }
        }

        logger.info(`  Registered plugin: ${plugin.name} v${plugin.version || '?'}`);
    }

    getAdmonitionTypes() {
        return this.hooks.admonitionTypes;
    }

    getFontFamilies() {
        return this.hooks.fontFamilies;
    }

    getLabel(key, defaultValue) {
        return this.hooks.labels[key] || defaultValue;
    }

    reset() {
        this.plugins = [];
        this.hooks = {
            admonitionTypes: [],
            fontFamilies: [],
            labels: {},
        };
    }
}

const pluginManager = new PluginManager();
export default pluginManager;
