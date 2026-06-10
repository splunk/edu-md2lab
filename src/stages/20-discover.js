import path from 'path';
import { Stage } from '../pipeline.js';
import {
    isValidDirectory,
    getLabGuidesPath,
    getOrderedMarkdownFiles,
} from '../utils/fileHandler.js';
import logger from '../utils/logger.js';

export class DiscoverStage extends Stage {
    constructor() {
        super('20-discover');
    }

    async execute(context) {
        logger.info('🔍 Discovering input files...');
        try {
            const customInput = context.manifest?.input?.labGuides;
            const labGuidesDir = customInput
                ? path.resolve(context.sourceDir, customInput)
                : getLabGuidesPath(context.sourceDir);

            const valid = await isValidDirectory(labGuidesDir);
            if (!valid) {
                throw new Error(`Lab guides directory not found: ${labGuidesDir}`);
            }

            context.labGuidesDir = labGuidesDir;
            logger.info(`  Lab guides: ${labGuidesDir}`);

            const files = await getOrderedMarkdownFiles(labGuidesDir);
            if (files.length === 0) {
                throw new Error(`No Markdown files found in "${labGuidesDir}"`);
            }

            context.markdownFiles = files;
            logger.info(`  Found ${files.length} Markdown file(s)`);
        } catch (error) {
            context.addError(error.message, this.name);
            throw error;
        }
    }
}
