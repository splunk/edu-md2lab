#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { Command } from "commander";

import { generatePdf } from "./generators/pdfGenerator.js";
import {
  getMetadataPath,
  loadMetadata,
  updateMetadataDate,
  valiDate,
  getCourseGA,
} from "./utils/metadataHandler.js";
import logger from "./utils/logger.js";
import {
  isValidDirectory,
  getLabGuidesPath,
  // validateSourcePath,
} from "./utils/fileHandler.js";

const program = new Command();

async function processCommand(sourcePath = ".", options) {
  try {
    // Validate source path
    const valid = await isValidDirectory(sourcePath);
    if (!valid) {
      logger.error("Uh oh! Not a valid path!");
      process.exit();
    }

    const sourceDir = await getLabGuidesPath(sourcePath);

    // Get metadata
    const metadataPath = await getMetadataPath(sourcePath);
    const metadata = await loadMetadata(metadataPath);

    const [courseGA, warnGA] = getCourseGA(metadata);

    if (warnGA) {
      logger.warn(warnGA);
    }

    const currDate = new Date().toISOString().split("T")[0];
    let datestamp;

    if (options.date) {
      datestamp = valiDate(options.date);
      logger.info(`📅 Using custom date for datestamp...`);
    } else if (courseGA > currDate) {
      datestamp = courseGA;
      logger.info(`📅 Using GA date for datestamp...`);
    } else {
      datestamp = currDate;
      logger.info(`📅 Using current date for datestamp...`);
    }

    // Generate PDF
    await generatePdf(sourceDir, metadata, datestamp, {
      outputHtml: options.html,
    }).catch((err) => {
      logger.error("Error generating output:", err);
      process.exit(1);
    });

    // Update metadata
    await updateMetadataDate(metadataPath, metadata, datestamp);
  } catch (err) {
    logger.error("Error:", err.stack || err.message || err);
    console.error(err);
    process.exit(1);
  }
}

program
  .name("md2lab")
  .description("Convert Markdown into a styled PDF.")
  .version("1.0.0");

program
  .argument(
    "[sourcePath]",
    "Path to the directory containing Markdown files (defaults to current directory)"
  )
  .option("-H, --html", "Output HTML instead of generating a PDF")
  .option(
    "-d, --date <date>",
    "Use custom date in YYYY-MM-DD format instead of current date"
  )
  .action(processCommand);

program.parse();
