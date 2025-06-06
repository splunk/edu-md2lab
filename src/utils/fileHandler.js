import path from "path";
import fs from "fs/promises";

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
 * Checks if a 'lab-guides' subdirectory exists.
 * If it exists, returns its path; otherwise, returns the sourcePath.
 * @param {string} sourcePath - The base directory to check.
 * @returns {Promise<string>} - The path to 'lab-guides' if it exists, otherwise the sourcePath.
 */
export async function getLabGuidesPath(sourcePath) {
  try {
    const resolvedPath = path.resolve(sourcePath);

    const labGuidesPath = path.join(resolvedPath, "lab-guides");

    const stat = await fs.stat(labGuidesPath);
    if (stat.isDirectory()) {
      return labGuidesPath;
    }
  } catch {
    return sourcePath;
  }
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

    const mdFiles = allFiles.filter((f) => f.endsWith(".md"));

    let introFile = mdFiles.find(
      (f) =>
        f.toLowerCase() === "introduction.md" ||
        f.toLowerCase() === "00-introduction.md"
    );
    let resourceFile = mdFiles.find(
      (f) =>
        f.toLowerCase() === "resources.md" ||
        /^\d{2}-resources\.md$/.test(f.toLowerCase())
    );

    const labFiles = mdFiles
      .filter(
        (f) => f !== introFile && f !== resourceFile && /^\d{2}-.+\.md$/.test(f)
      )
      .sort((a, b) => parseInt(a) - parseInt(b));

    const ordered = [];

    if (introFile) {
      ordered.push(introFile);
    }

    ordered.push(...labFiles);

    if (resourceFile) {
      ordered.push(resourceFile);
    }

    console.info(
      ` 🔀 Shuffling Markdown files:\n${ordered
        .map((f) => `  * ${f}`)
        .join("\n")}`
    );
    return ordered.map((f) => path.join(sourceDir, f));
  } catch (err) {
    throw new Error(`Error processing Markdown files: ${err.message}`);
  }
}
