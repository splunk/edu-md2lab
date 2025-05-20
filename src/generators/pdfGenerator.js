import path from "path";
import fs from "fs";
import fse from "fs-extra";
import puppeteer from "puppeteer";
import beautifyPkg from "js-beautify";
const { html: beautify } = beautifyPkg;
import markdownIt from "markdown-it";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { embedLocalImagesInMarkdown } from "../utils/imageHandler.js";

import { getCourseTitle, slugify } from "../utils/metadataHandler.js";

import { getOrderedMarkdownFiles } from "../utils/fileHandler.js";

import { validateCss } from "../utils/cssValidator.mjs";

import {
  registerContainers,
  stripAnswersBlocks,
  markdownHasAnswersBlock,
} from "./htmlGenerator.js";

import logger from "../utils/logger.js";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function addHeadersAndFootersToPdfBuffer(
  pdfBuffer,
  logoPath,
  courseTitle = ""
) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const logoBytes = fs.readFileSync(logoPath);
  const image = await pdfDoc.embedPng(logoBytes);
  const imageDims = image.scale(0.25);

  const year = new Date().getFullYear();
  const footerLeft = `© ${year} Splunk Inc. All rights reserved.`;

  const marginLeft = 64;
  const marginBottom = 64;
  const marginTop = 72;

  pages.forEach((page, index) => {
    const { width, height } = page.getSize();

    page.drawImage(image, {
      x: marginLeft,
      y: height - imageDims.height - 32,
      width: imageDims.width,
      height: imageDims.height,
    });

    page.drawLine({
      start: { x: marginLeft, y: height - marginTop + 5 },
      end: { x: width - marginLeft, y: height - marginTop + 5 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText(footerLeft, {
      x: marginLeft,
      y: 45,
      size: 9,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    const titleSize = 9;
    const titleWidth = helveticaFont.widthOfTextAtSize(courseTitle, titleSize);
    page.drawText(courseTitle, {
      x: (width - titleWidth) / 2,
      y: 45,
      size: titleSize,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pageNumText = `${index + 1}`;
    const textWidth = helveticaFont.widthOfTextAtSize(pageNumText, 9);
    page.drawText(pageNumText, {
      x: width - textWidth - marginLeft,
      y: 45,
      size: 9,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return await pdfDoc.save();
}

export async function generatePdf(sourceDir, metadata, options = {}) {
  const { outputHtml = false, pdfOptions = {} } = options;
  const outputDir = path.join(sourceDir, "pdfs");
  await fse.ensureDir(outputDir);
  const files = await getOrderedMarkdownFiles(sourceDir);
  if (files.length === 0) {
    logger.error(`No Markdown files found in "${sourceDir}".`);
    logger.error(
      "Please make sure the directory contains one or more .md files."
    );
    process.exit(1);
  }

  let hasDetails = false;
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    if (markdownHasAnswersBlock(content)) {
      hasDetails = true;
      break;
    }
  }

  const renderVariants = [
    { includeAnswers: false, suffix: "", label: "without answers" },
  ];

  if (hasDetails) {
    renderVariants.push({
      includeAnswers: true,
      suffix: "-answers",
      label: "with answers",
    });
  }

  for (const variant of renderVariants) {
    const md = markdownIt();

    registerContainers(md, { includeAnswers: variant.includeAnswers });

    let markdownContent = "";
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = path.basename(file, ".md");
      let fileContent = fs.readFileSync(file, "utf-8");

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

    // const metadataPath = await getMetadataPath(sourceDir);
    // const metadata = await loadMetadata(metadataPath);

    const title = getCourseTitle(metadata);
    const slug = slugify(title);
    const outputPdfPath = path.join(
      outputDir,
      `${slug}-lab-guide${variant.suffix}.pdf`
    );

    const defaultCssPath = path.join(__dirname, "../styles", "style.css");
    const customCssPath = path.join(sourceDir, "custom.css");

    let cssContent = fs.readFileSync(defaultCssPath, "utf-8");
    cssContent = `${cssContent}\n\n/* No syntax highlighting applied */`;

    if (fs.existsSync(customCssPath)) {
      const customCss = fs.readFileSync(customCssPath, "utf-8");
      await validateCss(customCss, customCssPath);
      cssContent += "\n\n/* Custom Styles */\n" + customCss;
      logger.info("🎨 Applying custom.css");
    }

    const logoPath = path.join(__dirname, "../assets", "logo-splunk-cisco.png");

    const fullHtml = `
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

    if (outputHtml) {
      const prettyHtml = beautify(fullHtml, {
        indent_size: 2,
        space_in_empty_paren: true,
      });
      // logger.info("⚙️ Generating HTML ", prettyHtml);
      continue;
    }

    let browser;
    try {
      browser = await puppeteer.launch();
    } catch (err) {
      logger.error(
        "Failed to launch Puppeteer. Make sure Chromium is installed."
      );
      throw err;
    }

    const page = await browser.newPage();
    await page.setContent(fullHtml, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const pdfBuffer = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: {
        top: "1in",
        bottom: "0.75in",
        left: ".64in",
        right: ".64in",
      },
      preferCSSPageSize: true,
      scale: 0.9,
      ...pdfOptions,
    });

    await browser.close();

    if (fs.existsSync(logoPath)) {
      const finalBuffer = await addHeadersAndFootersToPdfBuffer(
        pdfBuffer,
        logoPath,
        title
      );
      fs.writeFileSync(outputPdfPath, finalBuffer);
    } else {
      fs.writeFileSync(outputPdfPath, pdfBuffer);
    }

    logger.info(`⚙️  Generating PDF ${variant.label} in ${outputPdfPath}`);
  }
}
