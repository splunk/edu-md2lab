import path from 'path';
import fs from 'fs/promises';

/**
 * Checks if the given path is a valid directory.
 * @param {string} sourcePath - The path to check.
 * @returns {Promise<boolean>} - Resolves to `true` if it's a valid directory, otherwise `false`.
 */
export async function isValidDirectory(sourcePath) {
    try {
        const resolvedPath = path.resolve(sourcePath);
        const stat = await fs.stat(resolvedPath);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Returns the expected 'lab-guides' subdirectory path for a course.
 * The caller (stage 20) validates that the directory actually exists.
 * @param {string} sourcePath - The base course directory.
 * @returns {string} - The expected path to the 'lab-guides' subdirectory.
 */
export function getLabGuidesPath(sourcePath) {
    return path.join(path.resolve(sourcePath), 'lab-guides');
}

/**
 * Orders markdown files.
 * @param {string} sourceDir - The primary directory containing the markdown files.
 * @returns {Promise<string[]>} - Array of ordered markdown file paths.
 * @throws {Error} - If the source directory or 'lab-guides' subdirectory are invalid or do not exist.
 */
export async function getOrderedMarkdownFiles(sourceDir) {
    try {
        const allFiles = await fs.readdir(sourceDir);

        const mdFiles = allFiles.filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));

        const introFile = mdFiles.find((f) =>
            /^(introduction|00-introduction)\.mdx?$/.test(f.toLowerCase()),
        );
        const resourceFile = mdFiles.find((f) =>
            /^(resources|\d{2}-resources)\.mdx?$/.test(f.toLowerCase()),
        );

        const labFiles = mdFiles
            .filter((f) => f !== introFile && f !== resourceFile && /^\d{2}-.+\.mdx?$/.test(f))
            .sort((a, b) => parseInt(a) - parseInt(b));

        const ordered = [];

        if (introFile) {
            ordered.push(introFile);
        }

        ordered.push(...labFiles);

        if (resourceFile) {
            ordered.push(resourceFile);
        }

        console.info(` 🔀 Shuffling Markdown files:\n${ordered.map((f) => `  * ${f}`).join('\n')}`);
        return ordered.map((f) => path.join(sourceDir, f));
    } catch (err) {
        throw new Error(`Error processing Markdown files: ${err.message}`, { cause: err });
    }
}
