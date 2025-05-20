import logger from "../utils/logger.js";
import container from "markdown-it-container";

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
