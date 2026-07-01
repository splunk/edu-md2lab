import logger from '../src/utils/logger.js';

class PluginManager {
    constructor() {
        this.plugins = [];
        this.hooks = {
            admonitionTypes: [], // custom admonition type names to register
            fontFamilies: [], // additional font-family strings for CSS
            labels: {}, // label overrides e.g. { note: 'Note personnalisée' }
            componentTransforms: [], // fns called with raw JSX block; return string to replace, '' to remove
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
            if (Array.isArray(plugin.hooks.componentTransforms)) {
                this.hooks.componentTransforms.push(...plugin.hooks.componentTransforms);
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

    /**
     * Transforms a raw JSX component block string.
     * Calls registered componentTransform functions in order.
     * Returns the first non-undefined result, or '' to remove the component.
     * A plugin's transform function receives the full raw block string and
     * may return a replacement string (e.g. a Markdown placeholder), or ''
     * to remove the component.
     *
     * @param {string} rawBlock - The raw JSX component block (multi-line string).
     * @returns {string} Replacement text, or '' to remove the component.
     */
    transformComponent(rawBlock) {
        for (const fn of this.hooks.componentTransforms) {
            const result = fn(rawBlock);
            if (result !== undefined) return result;
        }
        return ''; // default: remove the component
    }

    reset() {
        this.plugins = [];
        this.hooks = {
            admonitionTypes: [],
            fontFamilies: [],
            labels: {},
            componentTransforms: [],
        };
    }
}

const pluginManager = new PluginManager();
export default pluginManager;
