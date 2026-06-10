import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Stage } from '../pipeline.js';
import { validateManifest, formatValidationErrors } from '../utils/validator.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ValidateStage extends Stage {
    constructor() {
        super('30-validate');
    }

    async execute(context) {
        logger.info('✓ Validating configuration...');
        try {
            // Schema validation
            const validation = validateManifest(context.manifest);
            if (!validation.valid) {
                const messages = formatValidationErrors(validation.errors);
                messages.forEach((msg) => logger.error(`  ${msg}`));
                context.addError(
                    'Manifest validation failed. Please fix the errors above.',
                    this.name,
                );
                return;
            }
            logger.info('✓ Manifest validated');

            const { metadata } = context;

            // Validate theme exists
            const themeCssPath = path.join(__dirname, '../../themes', context.theme, 'style.css');
            if (!fs.existsSync(themeCssPath)) {
                context.addError(`Theme not found: ${context.theme}`, this.name);
                return;
            }

            // Validate markdown files exist
            if (!context.markdownFiles || context.markdownFiles.length === 0) {
                context.addError('No Markdown files to process', this.name);
                return;
            }

            logger.info(`  Validated: ${metadata.courseTitle} (${metadata.courseId || 'no ID'})`);
            if (metadata.version) logger.info(`  Version: ${metadata.version}`);

            // Validate plugins
            if (context.plugins.length > 0) {
                for (const pluginEntry of context.plugins) {
                    const pluginName =
                        typeof pluginEntry === 'string' ? pluginEntry : pluginEntry.name;
                    const pluginPath = path.join(
                        __dirname,
                        '../../plugins',
                        pluginName,
                        'index.js',
                    );
                    if (!fs.existsSync(pluginPath)) {
                        context.addWarning(`Plugin not found: ${pluginName}`, this.name);
                    } else {
                        logger.info(`  Plugin validated: ${pluginName}`);
                    }
                }
            }
        } catch (error) {
            context.addError(error.message, this.name);
        }
    }
}
