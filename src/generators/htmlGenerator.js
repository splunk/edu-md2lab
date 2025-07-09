import logger from "../utils/logger.js";
import container from "markdown-it-container";
import markdownIt from "markdown-it";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { embedLocalImagesInMarkdown } from "../utils/imageHandler.js";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerContainers(md, { includeAnswers }) {
  const types = [
    "caution",
    "danger",
    "hint",
    "info",
    "note",
    "tip",
    "warning",
    "scenario",
    "custom",
    "answers",
  ];

  const originalRender = md.renderer.render;

  md.renderer.render = function (tokens, options, env) {
    if (!includeAnswers) {
      tokens = tokens.filter((t, idx) => {
        if (t._skip) {
          let nesting = 1;
          for (let i = idx + 1; i < tokens.length; i++) {
            nesting += tokens[i].nesting;
            if (nesting === 0) {
              tokens.splice(idx, i - idx + 1);
              break;
            }
          }
          return false;
        }
        return true;
      });
    }
    return originalRender.call(this, tokens, options, env);
  };

  types.forEach((type) => {
    md.use(container, type, {
      validate(params) {
        return params.trim().startsWith(type);
      },

      render: (tokens, idx) => {
        const token = tokens[idx];
        const info = token.info.trim();

        if (type === "answers" && !includeAnswers) {
          if (token.nesting === 1) token._skip = true;
          logger.debug(`Skipping "answers" block (not included)`);
          return "";
        }

        if (token.nesting === 1) {
          const classList = ["admonition"];
          let titleHTML = "";

          if (type === "custom") {
            const match =
              info.match(new RegExp(`^${type}\\s+"(.+)"$`)) ||
              info.match(new RegExp(`^${type}\\s+(.*)$`));
            const title = match ? match[1].trim() : "";

            logger.info(`📝 Registering custom admonition ${title}`);

            if (title) {
              const slug = title
                .toLowerCase()
                .replace(/[^\w]+/g, "-")
                .replace(/^-+|-+$/g, "");
              classList.push(slug);
              titleHTML = `<div class="admonition-title">${md.utils.escapeHtml(
                title
              )}</div>`;
            } else {
              classList.push("custom");
            }
          } else if (type === "answers") {
            classList.push("answers");
            titleHTML = `<div class="admonition-title">Answers</div>`;
          } else {
            classList.push(type);
            const defaultTitle = type.charAt(0).toUpperCase() + type.slice(1);
            titleHTML = `<div class="admonition-title">${defaultTitle}</div>`;
          }

          logger.debug(`Rendering start of block: ${type}`);
          return `<div class="${classList.join(
            " "
          )}">${titleHTML}<div class="admonition-content">\n`;
        } else {
          logger.debug(`Rendering end of block: ${type}`);
          return `</div></div>\n`;
        }
      },

      marker: ":",
    });
  });
}

export function stripAnswersBlocks(markdown) {
  const lines = markdown.split("\n");
  const result = [];
  let insideAnswers = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("::: answers")) {
      insideAnswers = true;
      logger.debug(`Found "answers" block. Skipping content.`);
      continue;
    }
    if (insideAnswers && trimmed === ":::") {
      insideAnswers = false;
      logger.debug(`Ending "answers" block.`);
      continue;
    }
    if (!insideAnswers) {
      result.push(line);
    }
  }

  return result.join("\n");
}

export function markdownHasAnswersBlock(content) {
  return /::: *answers/.test(content);
}

// export function insertDatestamp(fileContent, datestamp) {
//   fileContent = fileContent.replace(
//     /^(# .*)$/m,
//     `$1\n\n<p class="datestamp" style="text-align:right; color: gray">${datestamp}</p>`
//   );

//   return fileContent;
// }

export function insertDatestamp(content, datestamp, hasInsertedDatestamp) {
  // If the datestamp has already been inserted, return the content as is
  if (hasInsertedDatestamp) {
    return { content, hasInsertedDatestamp };
  }

  // Use a regular expression to find the first H1 (e.g., "# Heading")
  const h1Regex = /^(# )(.*)$/m;

  // Replace the first H1 with the H1 followed by the datestamp
  const updatedContent = content.replace(h1Regex, (match, hash, heading) => {
    hasInsertedDatestamp = true;
    return `${hash}${heading}\n\n<p class="datestamp" style="text-align:right; color: gray">${datestamp}</p>`;
  });

  return { content: updatedContent, hasInsertedDatestamp };
}

export async function generateHtmlContent(
  files,
  sourceDir,
  formattedDate,
  variant
) {
  const md = markdownIt({ html: true });
  registerContainers(md, { includeAnswers: variant.includeAnswers });

  let markdownContent = "";
  let hasInsertedDatestamp = false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = path.basename(file, ".md");
    let fileContent = fs.readFileSync(file, "utf-8");

    const result = insertDatestamp(
      fileContent,
      formattedDate,
      hasInsertedDatestamp
    );
    fileContent = result.content;
    hasInsertedDatestamp = result.hasInsertedDatestamp;

    if (!variant.includeAnswers) {
      fileContent = stripAnswersBlocks(fileContent);
    }

    const htmlContent = md.render(
      embedLocalImagesInMarkdown(fileContent, sourceDir)
    );

    markdownContent += `<section class="section" data-file="${fileName}">\n${htmlContent}\n</section>`;

    if (i < files.length - 1) {
      markdownContent += '<div style="page-break-before: always;"></div>';
    }
  }

  // Generate CSS content
  const defaultCssPath = path.join(__dirname, "../styles", "style.css");
  const customCssPath = path.join(sourceDir, "custom.css");

  let cssContent = fs.readFileSync(defaultCssPath, "utf-8");

  const fontPath = path.join(
    __dirname,
    "../styles/fonts",
    "SplunkDataSansPro_Rg.ttf"
  );
  const fontData = fs.readFileSync(fontPath);
  const fontBase64 = fontData.toString("base64");
  const fontFace = `
@font-face {
  font-family: "Splunk Data Sans Pro";
  src: url(data:font/truetype;charset=utf-8;base64,${fontBase64}) format('truetype');
}
`;

  cssContent = `${fontFace}\n\n${cssContent}\n\n/* No syntax highlighting applied */`;

  if (fs.existsSync(customCssPath)) {
    const customCss = fs.readFileSync(customCssPath, "utf-8");
    cssContent += "\n\n/* Custom Styles */\n" + customCss;
    logger.info("🎨 Applying custom.css...");
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${cssContent}
        </style>
      </head>
      <body>
        ${markdownContent}
      </body>
    </html>
  `;
}
