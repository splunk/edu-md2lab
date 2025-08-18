import path from "path";
import fs from "fs";
import fse from "fs-extra";
import puppeteer from "puppeteer";
import beautifyPkg from "js-beautify";
const { html: beautify } = beautifyPkg;
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
  generateHtmlContent,
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
  if (metadata.ga)
    pdfDoc.setCreationDate(new Date(getFormattedDate(metadata.ga)));
  if (metadata.updated)
    pdfDoc.setModificationDate(new Date(getFormattedDate(metadata.updated)));
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

    // Draw logo
    page.drawImage(image, {
      x: marginLeft,
      y: height - imageDims.height - 32,
      width: imageDims.width,
      height: imageDims.height,
    });

    // Draw header line
    page.drawLine({
      start: { x: marginLeft, y: height - marginTop + 5 },
      end: { x: width - marginLeft, y: height - marginTop + 5 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Draw footer copyright
    page.drawText(footerLeft, {
      x: marginLeft,
      y: 32,
      size: 9,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Calculate available space for course title
    const copyrightWidth = helveticaFont.widthOfTextAtSize(footerLeft, 9);
    const pageNumText = `${index + 1}`;
    const pageNumWidth = helveticaFont.widthOfTextAtSize(pageNumText, 9);

    // Available space for title (with some padding)
    const padding = 20; // 20 points padding on each side
    const availableWidth =
      width -
      (marginLeft + copyrightWidth + padding) -
      (pageNumWidth + marginLeft + padding);

    // Truncate title if necessary
    let displayTitle = courseTitle;
    let titleWidth = helveticaFont.widthOfTextAtSize(displayTitle, 9);

    if (titleWidth > availableWidth) {
      // Truncate and add ellipsis
      while (titleWidth > availableWidth && displayTitle.length > 3) {
        displayTitle = displayTitle.slice(0, -1);
        titleWidth = helveticaFont.widthOfTextAtSize(displayTitle + "...", 9);
      }
      displayTitle += "...";
      titleWidth = helveticaFont.widthOfTextAtSize(displayTitle, 9);
    }

    // Draw course title in center of available space
    const titleStartX = marginLeft + copyrightWidth + padding;
    const titleCenterX = titleStartX + (availableWidth - titleWidth) / 2;

    page.drawText(displayTitle, {
      x: titleCenterX,
      y: 32,
      size: 9,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Draw page number
    page.drawText(pageNumText, {
      x: width - pageNumWidth - marginLeft,
      y: 32,
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
    const fullHtml = await generateHtmlContent(
      files,
      sourceDir,
      formattedDate,
      variant
    );

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

    const logoPath = path.join(__dirname, "../assets", "logo-splunk-cisco.png");

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
