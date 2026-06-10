import fs from 'fs';
import { Stage } from '../pipeline.js';
import { generateHtmlContent, markdownHasAnswersBlock } from '../generators/htmlGenerator.js';
import pluginManager from '../../plugins/pluginLoader.js';
import logger from '../utils/logger.js';

export class ConvertStage extends Stage {
    constructor() {
        super('40-convert');
    }

    async execute(context) {
        logger.info('🔄 Converting Markdown to HTML...');
        try {
            if (context.plugins.length > 0) {
                await this.loadPlugins(context.plugins);
            }

            // Determine render variants
            let hasAnswers = false;
            for (const file of context.markdownFiles) {
                const content = fs.readFileSync(file, 'utf-8');
                if (markdownHasAnswersBlock(content)) {
                    hasAnswers = true;
                    break;
                }
            }

            const variants = [{ includeAnswers: false, suffix: '', label: 'without answers' }];
            if (hasAnswers) {
                variants.push({ includeAnswers: true, suffix: '-answers', label: 'with answers' });
            }

            // Generate HTML for each variant
            context.htmlVariants = [];
            for (const variant of variants) {
                const html = await generateHtmlContent(
                    context.markdownFiles,
                    context.labGuidesDir,
                    context.formattedDate,
                    variant,
                    context.theme,
                );
                context.htmlVariants.push({ html, variant });
                logger.info(
                    `  Generated HTML for variant: ${variant.label} (${html.length} bytes)`,
                );
            }
        } catch (error) {
            context.addError(error.message, this.name);
            throw error;
        }
    }

    async loadPlugins(plugins) {
        for (const pluginEntry of plugins) {
            try {
                const pluginName = typeof pluginEntry === 'string' ? pluginEntry : pluginEntry.name;
                const pluginModule = await import(`../../plugins/${pluginName}/index.js`);
                const plugin = pluginModule.default;
                pluginManager.register(plugin);
                logger.info(`  Loaded plugin: ${pluginName}`);
            } catch (err) {
                logger.warn(`  Failed to load plugin: ${err.message}`);
            }
        }
    }
}
