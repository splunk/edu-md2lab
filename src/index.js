#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { Command } from "commander";

import { generatePdf } from "./generators/pdfGenerator.js";
import {
  getMetadataPath,
  loadMetadata,
  updateMetadataDate,
  getFormattedDate,
} from "./utils/metadataHandler.js";
import logger from "./utils/logger.js";
import { validateSourcePath } from "./utils/fileHandler.js";

const program = new Command();

program
  .name("md2lab")
  .description("Convert Markdown into a styled PDF.")
  .version("1.0.0");

program
  .argument(
    "[sourcePath]",
    "Path to the directory containing Markdown files (defaults to current directory)"
    // process.cwd()
  )
  .option("-H, --html", "Output HTML instead of generating a PDF")
  .option(
    "-d, --date <date>",
    "Use custom date in YYYY-MM-DD format instead of current date"
  )
  .action(async (sourcePath = ".", options) => {
    try {
      // Validate source path
      logger.info("Validating source path...");
      const sourceDir = await validateSourcePath(sourcePath); // Await the result

      // Get metadata
      const metadataPath = await getMetadataPath(sourceDir);
      const metadata = await loadMetadata(metadataPath);

      // Update date
      const updatedDate = getFormattedDate(options.date);

      // Generate PDF
      await generatePdf(sourceDir, metadata, {
        outputHtml: options.html,
      }).catch((err) => {
        logger.error("Error generating output:", err);
        process.exit(1);
      });

      // Update metadata
      await updateMetadataDate(metadataPath, metadata, updatedDate);
    } catch (err) {
      logger.error("Error:", err.stack || err.message || err);
      console.error(err);
      process.exit(1); // Exit the process on error
    }
  });

program.parse();
