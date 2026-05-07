import fs from 'fs';
import path from 'path';
import logger from './logger.js';

/**
 * Converts a heading text to a GitHub-style anchor ID
 * @param {string} text - The heading text
 * @returns {string} - The anchor ID
 */
export function headingToAnchor(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Extracts the first level-1 heading from a markdown file
 * @param {string} filePath - Path to the markdown file
 * @returns {string|null} - The heading text or null if not found
 */
export function extractFirstH1(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const match = content.match(/^# (.+)$/m);
        return match ? match[1].trim() : null;
    } catch (err) {
        logger.error(`Error reading file ${filePath}: ${err.message}`);
        return null;
    }
}

/**
 * Checks if a file contains a TOC section with content
 * @param {string} content - The markdown content
 * @returns {boolean} - True if TOC has manual content (a list), false otherwise
 */
export function hasTocContent(content) {
    const tocRegex = /^## Table of [Cc]ontents\s*\n+(.*?)(?=\n##|\n#|$)/ms;
    const match = content.match(tocRegex);

    if (!match) return false;

    const tocContent = match[1].trim();
    // Check if there's any list content (starts with * or -)
    return /^\s*[\*\-]\s+/m.test(tocContent);
}

/**
 * Generates TOC markdown links from ordered markdown files
 * @param {string[]} files - Array of ordered markdown file paths
 * @returns {string} - Generated TOC as markdown list
 */
export function generateTocLinks(files) {
    const links = [];

    files.forEach((file, index) => {
        const heading = extractFirstH1(file);
        if (!heading) {
            logger.warn(`No H1 found in ${path.basename(file)}, skipping TOC entry`);
            return;
        }

        const anchor = headingToAnchor(heading);
        const linkText = index === 0 ? 'Introduction' : heading;
        links.push(`* [${linkText}](#${anchor})`);
    });

    return links.join('\n');
}

/**
 * Processes the first markdown file to add/update TOC
 * @param {string} content - The markdown content of the first file
 * @param {string[]} files - Array of ordered markdown file paths
 * @returns {string} - Updated markdown content with TOC
 */
export function processToc(content, files) {
    const tocRegex = /^## Table of [Cc]ontents\s*\n+/m;
    const match = content.match(tocRegex);

    if (!match) {
        // No TOC section found, return content as-is
        return content;
    }

    // Check if TOC already has manual content
    if (hasTocContent(content)) {
        logger.info('📋 Manual TOC found, skipping auto-generation');
        return content;
    }

    // Generate TOC
    logger.info('📋 Auto-generating TOC...');
    const tocLinks = generateTocLinks(files);

    // Insert the TOC after the "## Table of contents" header
    return content.replace(tocRegex, `${match[0]}\n${tocLinks}\n\n`);
}
