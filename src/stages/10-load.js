import { Stage } from '../pipeline.js';
import { loadMetadataAndManifest, getFormattedDate, valiDate } from '../utils/metadataHandler.js';
import logger from '../utils/logger.js';

export class LoadStage extends Stage {
    constructor() {
        super('10-load');
    }

    async execute(context) {
        logger.info('📦 Loading metadata...');
        try {
            const manifest = await loadMetadataAndManifest(context.sourceDir, {
                migrateFormat: context.options.migrate || 'yaml',
            });
            context.manifest = manifest;
            context.metadata = manifest.metadata;

            // Resolve theme
            if (context.options.theme) {
                context.theme = context.options.theme;
                logger.info(`  Theme: ${context.theme} (CLI override)`);
            } else if (manifest.output?.theme) {
                context.theme = manifest.output.theme;
                logger.info(`  Theme: ${context.theme}`);
            } else {
                context.theme = 'splunk-edu';
                logger.info(`  Theme: ${context.theme} (default)`);
            }

            // Resolve plugins
            if (manifest.plugins && Array.isArray(manifest.plugins)) {
                context.plugins = manifest.plugins;
                logger.info(`  Found ${manifest.plugins.length} plugin(s)`);
            }

            // Resolve datestamp
            const currDate = new Date().toISOString().split('T')[0];
            const courseGA = context.metadata?.ga || null;

            if (context.options.date) {
                context.datestamp = valiDate(context.options.date);
                logger.info(`📅 Using custom date for datestamp...`);
            } else if (courseGA && courseGA > currDate) {
                context.datestamp = courseGA;
                logger.info(`📅 Using GA date for datestamp...`);
            } else {
                context.datestamp = currDate;
                logger.info(`📅 Using current date for datestamp...`);
            }

            context.formattedDate = getFormattedDate(context.datestamp);

            const courseId = context.metadata?.courseId;
            const courseTitle = context.metadata?.courseTitle;
            logger.info(`  Course: ${courseTitle} (${courseId})`);
        } catch (error) {
            context.addError(error.message, this.name);
            throw error;
        }
    }
}
