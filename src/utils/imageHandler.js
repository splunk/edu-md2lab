const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const logger = require("../utils/logger");

async function generateBase64Logo(logoPath, height = 30) {
  try {
    logger.debug(`Resizing logo from path: ${logoPath} to height: ${height}px`);

    const buffer = await sharp(logoPath)
      .resize({ height })
      .png({ quality: 80 }) // Use compression quality for PNGs
      .toBuffer();

    const base64 = buffer.toString("base64");
    logger.info("Logo resized and converted to Base64.");
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    logger.error(
      `❌ Error processing image at path: ${logoPath} - ${err.message}`
    );
    throw err;
  }
}

function embedLocalImagesInMarkdown(markdown, sourceDir) {
  logger.debug("Embarking on embedding images in Markdown content.");

  return markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, imgPath) => {
      const resolvedPath = path.resolve(sourceDir, imgPath);

      if (!fs.existsSync(resolvedPath)) {
        logger.warn(
          `⚠️ Image not found: ${imgPath}. Path resolved to: ${resolvedPath}`
        );
        return match;
      }

      const ext = path.extname(resolvedPath).slice(1);
      const mime = `image/${ext === "jpg" ? "jpeg" : ext}`;
      const base64 = fs.readFileSync(resolvedPath).toString("base64");

      logger.info(`Successfully embedded image: ${imgPath}`);
      return `![${alt}](data:${mime};base64,${base64})`;
    }
  );
}

module.exports = { generateBase64Logo, embedLocalImagesInMarkdown };
