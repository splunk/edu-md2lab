import logger from '../utils/logger.js';
import container from 'markdown-it-container';
import markdownIt from 'markdown-it';
import hljs from 'highlight.js';
import path from 'path';
import fs from 'fs';
import { embedLocalImagesInMarkdown } from '../utils/imageHandler.js';
import { processToc, headingToAnchor } from '../utils/tocGenerator.js';
import { loadThemeCss } from '../utils/loadTheme.js';
import pluginManager from '../../plugins/pluginLoader.js';

export function registerContainers(md, { includeAnswers }) {
    const types = [
        'caution',
        'danger',
        'hint',
        'info',
        'note',
        'tip',
        'warning',
        'scenario',
        'custom',
        'answers',
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

                if (type === 'answers' && !includeAnswers) {
                    if (token.nesting === 1) token._skip = true;
                    logger.debug(`Skipping "answers" block (not included)`);
                    return '';
                }

                if (token.nesting === 1) {
                    const classList = ['admonition'];
                    let titleHTML = '';

                    if (type === 'custom') {
                        const match =
                            info.match(new RegExp(`^${type}\\s+"(.+)"$`)) ||
                            info.match(new RegExp(`^${type}\\s+(.*)$`));
                        const title = match ? match[1].trim() : '';

                        logger.info(`📝 Registering custom admonition ${title}`);

                        if (title) {
                            const slug = title
                                .toLowerCase()
                                .replace(/[^\w]+/g, '-')
                                .replace(/^-+|-+$/g, '');
                            classList.push(slug);
                            titleHTML = `<div class="admonition-title">${md.utils.escapeHtml(
                                title,
                            )}</div>`;
                        } else {
                            classList.push('custom');
                        }
                    } else if (type === 'answers') {
                        classList.push('answers');
                        titleHTML = `<div class="admonition-title">Answers</div>`;
                    } else {
                        classList.push(type);
                        const defaultTitle = type.charAt(0).toUpperCase() + type.slice(1);
                        titleHTML = `<div class="admonition-title">${defaultTitle}</div>`;
                    }

                    logger.debug(`Rendering start of block: ${type}`);
                    return `<div class="${classList.join(
                        ' ',
                    )}">${titleHTML}<div class="admonition-content">\n`;
                } else {
                    logger.debug(`Rendering end of block: ${type}`);
                    return `</div></div>\n`;
                }
            },

            marker: ':',
        });
    });
}

export function stripAnswersBlocks(markdown) {
    const lines = markdown.split('\n');
    const result = [];
    let insideAnswers = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('::: answers')) {
            insideAnswers = true;
            logger.debug(`Found "answers" block. Skipping content.`);
            continue;
        }
        if (insideAnswers && trimmed === ':::') {
            insideAnswers = false;
            logger.debug(`Ending "answers" block.`);
            continue;
        }
        if (!insideAnswers) {
            result.push(line);
        }
    }

    return result.join('\n');
}

export function markdownHasAnswersBlock(content) {
    return /::: *answers/.test(content);
}

/**
 * Strips JSX/React component blocks from MDX content.
 *
 * Detects components by their uppercase-first tag name, which is a fundamental
 * JSX/React convention. This preserves standard HTML and XML tags (which use
 * lowercase names) while removing React-style components.
 *
 * Handles block-level components only (tag must be at the start of a line).
 * Both self-closing (<Foo ... />) and paired (<Foo>...</Foo>) forms are supported.
 *
 * @param {string} content - The MDX file content.
 * @param {Function|null} transformFn - Optional function called with the raw
 *   component block string. Return a non-empty string to replace the component
 *   with static content; return '' or undefined to remove it entirely.
 * @returns {string} Content with JSX component blocks removed or transformed.
 */
export function stripJsxComponents(content, transformFn = null) {
    const lines = content.split('\n');
    const result = [];
    let state = 'normal'; // 'normal' | 'in-open-tag' | 'in-body'
    let closingTag = null;
    let rawBlock = [];

    const flushBlock = () => {
        if (transformFn) {
            const replacement = transformFn(rawBlock.join('\n'));
            if (replacement) result.push(replacement);
        }
        rawBlock = [];
    };

    for (const line of lines) {
        const trimmed = line.trim();

        if (state === 'normal') {
            const match = trimmed.match(/^<([A-Z][a-zA-Z0-9]*)/);
            if (!match) {
                result.push(line);
                continue;
            }

            const name = match[1];
            rawBlock = [line];
            const closingTagStr = `</${name}>`;

            if (trimmed.endsWith('/>')) {
                // Single-line self-closing: <Foo ... />
                flushBlock();
                continue;
            }
            if (trimmed.includes(closingTagStr)) {
                // Single-line paired: <Foo>...</Foo>
                flushBlock();
                continue;
            }
            if (trimmed.endsWith('>')) {
                // Opening tag closes with > on this line — body starts next
                state = 'in-body';
                closingTag = closingTagStr;
                continue;
            }
            // Multi-line opening tag (attributes span subsequent lines)
            state = 'in-open-tag';
            closingTag = closingTagStr;
        } else if (state === 'in-open-tag') {
            rawBlock.push(line);
            if (trimmed.endsWith('/>')) {
                // Self-closing tag ends here
                state = 'normal';
                closingTag = null;
                flushBlock();
            } else if (trimmed.endsWith('>')) {
                // Opening tag ends with >, body follows
                state = 'in-body';
            }
        } else if (state === 'in-body') {
            rawBlock.push(line);
            if (trimmed.includes(closingTag)) {
                state = 'normal';
                closingTag = null;
                flushBlock();
            }
        }
    }

    return result.join('\n');
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
    variant,
    themeName = 'splunk-edu',
    renderCode = {},
) {
    const md = markdownIt({
        html: true,
        highlight(code, lang) {
            if (lang === 'output') {
                return `<pre class="output"><code>${md.utils.escapeHtml(code)}</code></pre>`;
            }
            if (renderCode.theme) {
                const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
                const highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value;
                return `<pre class="hljs"><code>${highlighted}</code></pre>`;
            }
            return '';
        },
    });

    // Custom image renderer — supports scale= and align= in the title attribute
    // Usage: ![alt](image.png "scale=50% align=center")
    md.renderer.rules.image = function (tokens, idx) {
        const token = tokens[idx];
        const src = token.attrGet('src') ?? '';
        const alt = token.children ? token.children.reduce((acc, t) => acc + t.content, '') : '';
        const title = token.attrGet('title') ?? '';

        const scaleMatch = title.match(/\bscale=(\d+%|\d+px)/);
        const alignMatch = title.match(/\balign=(left|center|right)/);

        const cleanTitle = title
            .replace(/\bscale=\S+\s*/g, '')
            .replace(/\balign=\S+\s*/g, '')
            .trim();

        const styles = [];
        if (scaleMatch) styles.push(`width: ${scaleMatch[1]}`);
        if (alignMatch) {
            const align = alignMatch[1];
            if (align === 'center') {
                styles.push('display: block', 'margin-left: auto', 'margin-right: auto');
            } else if (align === 'left') {
                styles.push('display: block', 'margin-right: auto');
            } else if (align === 'right') {
                styles.push('display: block', 'margin-left: auto');
            }
        }

        const attrs = [
            `src="${src}"`,
            `alt="${md.utils.escapeHtml(alt)}"`,
            cleanTitle ? `title="${md.utils.escapeHtml(cleanTitle)}"` : '',
            styles.length ? `style="${styles.join('; ')}"` : '',
        ]
            .filter(Boolean)
            .join(' ');

        return `<img ${attrs}>`;
    };

    // Add IDs to headings for anchor links
    md.renderer.rules.heading_open = function (tokens, idx) {
        const token = tokens[idx];
        const level = token.tag;
        const nextToken = tokens[idx + 1];

        if (nextToken && nextToken.type === 'inline' && nextToken.content) {
            const id = headingToAnchor(nextToken.content);
            return `<${level} id="${id}">`;
        }

        return `<${level}>`;
    };

    registerContainers(md, { includeAnswers: variant.includeAnswers });

    let markdownContent = '';
    let hasInsertedDatestamp = false;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = path.basename(file).replace(/\.mdx?$/, '');
        let fileContent = fs.readFileSync(file, 'utf-8');

        // Strip JSX components from MDX files before further processing
        if (file.endsWith('.mdx')) {
            fileContent = stripJsxComponents(fileContent, (rawBlock) =>
                pluginManager.transformComponent(rawBlock),
            );
        }

        // Process TOC in the first file
        if (i === 0) {
            fileContent = processToc(fileContent, files);
        }

        const result = insertDatestamp(fileContent, formattedDate, hasInsertedDatestamp);
        fileContent = result.content;
        hasInsertedDatestamp = result.hasInsertedDatestamp;

        if (!variant.includeAnswers) {
            fileContent = stripAnswersBlocks(fileContent);
        }

        const htmlContent = md.render(embedLocalImagesInMarkdown(fileContent, path.dirname(file)));

        markdownContent += `<section class="section" data-file="${fileName}">\n${htmlContent}\n</section>`;

        if (i < files.length - 1) {
            markdownContent += '<div style="page-break-before: always;"></div>';
        }
    }

    // Load theme CSS (all fonts embedded as base64 data URIs)
    let cssContent = loadThemeCss(themeName);

    // Inject highlight.js theme (only when explicitly configured)
    if (renderCode.theme) {
        const hljsThemePath = new URL(
            `../../node_modules/highlight.js/styles/${renderCode.theme}.min.css`,
            import.meta.url,
        );
        cssContent += '\n\n' + fs.readFileSync(hljsThemePath, 'utf-8');
    }

    const customCssPath = path.join(sourceDir, 'custom.css');
    if (fs.existsSync(customCssPath)) {
        const customCss = fs.readFileSync(customCssPath, 'utf-8');
        cssContent += '\n\n/* Custom Styles */\n' + customCss;
        logger.info('🎨 Applying custom.css...');
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
