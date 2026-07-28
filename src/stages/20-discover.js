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

            let labGuidesDir;
            let files = [];

            if (Array.isArray(customInput)) {
                // Multiple lab guide sources: collect files from each entry in order.
                // Entries may be directory paths or paths to sub-manifest files
                // (in which case the manifest's parent directory is used).
                for (const entry of customInput) {
                    const entryPath = path.resolve(context.sourceDir, entry);
                    const dir = /\.(json|ya?ml)$/i.test(entry)
                        ? path.dirname(entryPath)
                        : entryPath;
                    const valid = await isValidDirectory(dir);
                    if (!valid) {
                        throw new Error(`Lab guides directory not found: ${dir}`);
                    }
                    const entryFiles = await getOrderedMarkdownFiles(dir);
                    files = files.concat(entryFiles);
                }
                // Use the project root as the asset base when files span multiple dirs
                labGuidesDir = context.sourceDir;
                logger.info(`  Lab guides: ${customInput.length} source directories`);
            } else {
                labGuidesDir = customInput
                    ? path.resolve(context.sourceDir, customInput)
                    : getLabGuidesPath(context.sourceDir);

                const valid = await isValidDirectory(labGuidesDir);
                if (!valid) {
                    throw new Error(`Lab guides directory not found: ${labGuidesDir}`);
                }

                files = await getOrderedMarkdownFiles(labGuidesDir);
                logger.info(`  Lab guides: ${labGuidesDir}`);
            }

            if (files.length === 0) {
                throw new Error(`No Markdown files found in "${labGuidesDir}"`);
            }

            context.labGuidesDir = labGuidesDir;
            context.markdownFiles = files;
            logger.info(`  Found ${files.length} Markdown file(s)`);
        } catch (error) {
            context.addError(error.message, this.name);
            throw error;
        }
    }
}
