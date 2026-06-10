import path from 'path';
import { isValidDirectory } from './utils/fileHandler.js';
import { Context } from './context.js';
import { Pipeline } from './pipeline.js';

import { LoadStage } from './stages/10-load.js';
import { DiscoverStage } from './stages/20-discover.js';
import { ValidateStage } from './stages/30-validate.js';
import { ConvertStage } from './stages/40-convert.js';
import { BuildStage } from './stages/50-build.js';

/**
 * Generate a lab guide PDF (or HTML) from a source directory.
 *
 * @param {string} sourcePath - Path to the course directory (may contain lab-guides subdir)
 * @param {object} options
 * @param {boolean} [options.html]    - Output HTML to stdout instead of generating a PDF
 * @param {string}  [options.date]    - Override datestamp (YYYY-MM-DD)
 * @param {string}  [options.theme]   - Override theme name
 */
export async function generateLabGuide(sourcePath = '.', options = {}) {
    const resolvedPath = path.resolve(sourcePath);

    const valid = await isValidDirectory(resolvedPath);
    if (!valid) {
        throw new Error(`Not a valid directory: ${resolvedPath}`);
    }

    const context = new Context({ sourceDir: resolvedPath, ...options });

    let stages;
    if (options.html) {
        stages = [
            new LoadStage(),
            new DiscoverStage(),
            new ValidateStage(),
            new ConvertStage(),
            new BuildStage(),
        ];
    } else {
        stages = [
            new LoadStage(),
            new DiscoverStage(),
            new ValidateStage(),
            new ConvertStage(),
            new BuildStage(),
        ];
    }

    const pipeline = new Pipeline(stages);
    await pipeline.run(context);
    return context;
}
