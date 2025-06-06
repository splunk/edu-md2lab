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

import {
  getCourseTitle,
  getCourseId,
  getVersion,
  slugify,
  getFormattedDate,
} from "../utils/metadataHandler.js";

import { getOrderedMarkdownFiles } from "../utils/fileHandler.js";

// TODO: DEBUG
// import { validateCss } from "../utils/cssValidator.mjs";

import { insertDatestamp } from "./htmlGenerator.js";

import {
  registerContainers,
  stripAnswersBlocks,
  markdownHasAnswersBlock,
} from "./htmlGenerator.js";

import logger from "../utils/logger.js";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function setPdfMetadata(pdfDoc, metadata = {}) {
  pdfDoc.setCreator("md2splunk");
  pdfDoc.setAuthor("Splunk EDU");
  // USING DEFAULT PRODUCER (pdf-lib)
  // pdfDoc.setProducer(TODO);
  if (metadata.course_title) pdfDoc.setTitle(metadata.course_title);
  if (metadata.ga) pdfDoc.setCreationDate(new Date(metadata.ga));
  if (metadata.updated) pdfDoc.setModificationDate(new Date(metadata.updated));
  // TODO: USE UNIQUE SUBJECT?
  if (metadata.course_title) pdfDoc.setSubject(metadata.course_title);
}

export async function addHeadersAndFootersToPdfBuffer(
  pdfDoc,
  pdfBuffer,
  logoPath,
  courseTitle = "",
  metadata = {}
) {
  const pages = pdfDoc.getPages();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const logoBytes = fs.readFileSync(logoPath);
  const image = await pdfDoc.embedPng(logoBytes);
  const imageDims = image.scale(0.25);

  const year = new Date().getFullYear();
  const footerLeft = `© ${year} Splunk LLC. All rights reserved.`;

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

export async function generatePdf(
  sourceDir,
  metadata,
  datestamp,
  options = {}
) {
  const { outputHtml = false, pdfOptions = {} } = options;
  // 20250605: removed "pdfs" from outputDir; now using "./lab-guides"
  const outputDir = path.join(sourceDir, "");
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

  let formattedDate = getFormattedDate(datestamp);

  for (const variant of renderVariants) {
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

    let courseId, courseTitle;

    try {
      courseId = getCourseId(metadata);
      courseTitle = getCourseTitle(metadata);
    } catch (err) {
      logger.error(`Uh oh! ${err.message}`);
      process.exit(1);
    }

    const version = getVersion(metadata);

    if (!version) {
      logger.info("ℹ️  No 'version' found in metadata. Proceeding without it.");
    }

    const slug = slugify(courseTitle);

    const outputTitle = `${courseId}-${slug}${
      version ? "-" + version : ""
    }-lab-guide${variant.suffix}.pdf`;

    const outputPdfPath = path.join(outputDir, outputTitle);

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
      // await validateCss(customCss, customCssPath);
      cssContent += "\n\n/* Custom Styles */\n" + customCss;
      logger.info("🎨 Applying custom.css...");
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
      console.log(prettyHtml);
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

    // await page.setContent(fullHtml, {
    //   waitUntil: "networkidle0", // Or "networkidle2"
    //   timeout: 60000,
    // });

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

    const pdfDoc = await PDFDocument.load(pdfBuffer);

    await browser.close();

    if (fs.existsSync(logoPath)) {
      await setPdfMetadata(pdfDoc, metadata);
      const finalBuffer = await addHeadersAndFootersToPdfBuffer(
        pdfDoc,
        pdfBuffer,
        logoPath,
        courseTitle,
        metadata
      );
      fs.writeFileSync(outputPdfPath, finalBuffer);
    } else {
      fs.writeFileSync(outputPdfPath, pdfBuffer);
    }

    logger.info(`⚙️  Generating PDF ${variant.label} ${outputPdfPath}`);
  }
}
