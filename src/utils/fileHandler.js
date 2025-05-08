const path = require("path");
const fs = require("fs");
const yaml = require("js-yaml");
const logger = require("../utils/logger");

function getCourseTitle(sourceDir) {
  const metadataPath = path.join(sourceDir, "metadata.yaml");

  if (!fs.existsSync(metadataPath)) {
    logger.warn("⚠️ metadata.yaml not found. Using default title.");
    return "lab-guide";
  }

  try {
    const metadata = yaml.load(fs.readFileSync(metadataPath, "utf8"));
    const title = metadata.course_title || "lab-guide";
    logger.info(`Using course title: ${title}`);
    return title;
  } catch (err) {
    logger.error(`❌ Failed to parse metadata.yaml: ${err.message}`);
    return "lab-guide";
  }
}

function slugify(text) {
  logger.debug(`Slugifying text: "${text}"`);

  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function getOrderedMarkdownFiles(sourceDir) {
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

    logger.info(`Ordered markdown files: ${ordered.join(", ")}`);
    return ordered.map((f) => path.join(sourceDir, f));
  } catch (err) {
    logger.error(
      `❌ Error reading markdown files in directory ${sourceDir}: ${err.message}`
    );
    throw err;
  }
}

module.exports = {
  getCourseTitle,
  slugify,
  getOrderedMarkdownFiles,
};
