#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { Command } from "commander";
import { convertMarkdownToPdf } from "./generators/pdfGenerator.js";
import logger from "./utils/logger.js";

const program = new Command();

program
  .name("md2lab")
  .description("Convert a structured markdown lab into a styled PDF document.")
  .version("1.0.0");

program
  .argument(
    "[sourceDir]",
    "Path to the directory containing markdown files (defaults to current directory)"
  )
  .option("-H, --html", "Output rendered HTML instead of generating a PDF")
  .action((sourceDir = ".", options) => {
    const resolvedPath = path.resolve(sourceDir);

    if (
      !fs.existsSync(resolvedPath) ||
      !fs.lstatSync(resolvedPath).isDirectory()
    ) {
      logger.error(`The path "${resolvedPath}" is not a valid directory.`);
      process.exit(1);
    }

    convertMarkdownToPdf(resolvedPath, { outputHtml: options.html }).catch(
      (err) => {
        logger.error("Error generating output:", err);
        process.exit(1);
      }
    );
  });

program.parse();
