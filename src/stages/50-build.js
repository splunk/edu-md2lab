import path from 'path';
import fs from 'fs';
import beautifyPkg from 'js-beautify';
const { html: beautify } = beautifyPkg;
import { Stage } from '../pipeline.js';
import {
    renderHtmlToPdf,
    setPdfMetadata,
    addHeadersAndFootersToPdfBuffer,
} from '../generators/pdfGenerator.js';
import { slugify, updateMetadataDate } from '../utils/metadataHandler.js';
import { loadThemeConfig, getThemeAssetPath } from '../utils/loadTheme.js';
import { PDFDocument } from 'pdf-lib';
import logger from '../utils/logger.js';

export class BuildStage extends Stage {
    constructor() {
        super('50-build');
    }

    async execute(context) {
        const { metadata, options } = context;

        // If --html mode, print first variant to stdout and exit
        if (options.html) {
            if (context.htmlVariants.length > 0) {
                const prettyHtml = beautify(context.htmlVariants[0].html, {
                    indent_size: 2,
                    space_in_empty_paren: true,
                });
                console.log(prettyHtml);
            }
            return;
        }

        logger.info('📄 Generating PDF(s)...');
        try {
            const courseId = metadata?.courseId || 'unknown';
            const courseTitle = metadata?.courseTitle || 'Unknown';
            const version = metadata?.version;
            const slug = slugify(courseTitle);

            // Resolve logo from theme config
            const themeConfig = await loadThemeConfig(context.theme);
            const logoFile = themeConfig?.header?.logo;
            const logoPath = logoFile ? getThemeAssetPath(context.theme, logoFile) : null;

            // Resolve output directory
            const outputDir = context.manifest?.output?.destination
                ? path.join(context.sourceDir, context.manifest.output.destination)
                : path.join(context.sourceDir, 'dist');

            fs.mkdirSync(outputDir, { recursive: true });

            for (const { html, variant } of context.htmlVariants) {
                const outputFilename = `${courseId}-${slug}${version ? '-' + version : ''}-lab-guide${variant.suffix}.pdf`;
                const outputPdfPath = path.join(outputDir, outputFilename);

                const pdfBuffer = await renderHtmlToPdf(html);

                const pdfDoc = await PDFDocument.load(pdfBuffer);
                await setPdfMetadata(pdfDoc, metadata);

                let finalBuffer;
                if (logoPath && fs.existsSync(logoPath)) {
                    finalBuffer = await addHeadersAndFootersToPdfBuffer(
                        pdfDoc,
                        pdfBuffer,
                        logoPath,
                        courseTitle,
                        metadata,
                    );
                } else {
                    finalBuffer = await pdfDoc.save();
                }

                fs.writeFileSync(outputPdfPath, finalBuffer);
                context.outputPaths.push(outputPdfPath);
                logger.info(`⚙️  Generated PDF ${variant.label}: ${outputPdfPath}`);
            }

            // Update metadata date
            if (context.manifest?._metadataPath) {
                await updateMetadataDate(
                    context.manifest._metadataPath,
                    context.manifest,
                    context.datestamp,
                );
            }
        } catch (error) {
            context.addError(error.message, this.name);
            throw error;
        }
    }
}
