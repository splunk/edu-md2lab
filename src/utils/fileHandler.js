import path from "path";
import fs from "fs";
import yaml from "js-yaml";
import logger from "../utils/logger.js";

export function getCourseTitle(sourceDir) {
  const metadataPath = path.join(sourceDir, "metadata.yaml");

  if (!fs.existsSync(metadataPath)) {
    logger.warn("metadata.yaml not found. Using default title.");
    return "lab-guide";
  }

  try {
    const metadata = yaml.load(fs.readFileSync(metadataPath, "utf8"));
    const title = metadata.course_title || "lab-guide";
    return title;
  } catch (err) {
    logger.error(`Failed to parse metadata.yaml: ${err.message}`);
    return "lab-guide";
  }
}

export function slugify(text) {
  logger.debug(`Slugifying text: "${text}"`);
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export async function getOrderedMarkdownFiles(sourceDir) {
  try {
    logger.debug("Reading directory contents to fetch markdown files.");

    const allFiles = await fs.promises.readdir(sourceDir);
    const mdFiles = allFiles.filter((f) => f.endsWith(".md"));

    logger.debug(`Found ${mdFiles.length} markdown files.`);

    const intro = mdFiles.find((f) => f.toLowerCase() === "introduction.md");
    const resources = mdFiles.find((f) => f.toLowerCase() === "resources.md");

    const labFiles = mdFiles
      .filter((f) => /^\d{2}-.+\.md$/.test(f))
      .sort((a, b) => parseInt(a) - parseInt(b));

    const ordered = [];
    if (intro) {
      ordered.push(intro);
      logger.debug("Adding introduction.md to the ordered list.");
    }
    ordered.push(...labFiles);
    if (resources) {
      ordered.push(resources);
      logger.debug("Adding resources.md to the ordered list.");
    }

    logger.info(
      `🔀 Shuffling Markdown files:\n${ordered
        .map((f) => `  * ${f}`)
        .join("\n")}`
    );
    return ordered.map((f) => path.join(sourceDir, f));
  } catch (err) {
    logger.error(
      `Error reading Markdown files in directory ${sourceDir}: ${err.message}`
    );
    throw err;
  }
}
