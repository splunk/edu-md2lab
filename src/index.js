#!/usr/bin/env node
const fs = require("fs");
const { Command } = require("commander");
const { convertMarkdownToPdf } = require("./generators/pdfGenerator");

const program = new Command();
const path = require("path");

program
  .name("md2lab")
  .description("Convert a structured markdown lab into a styled PDF document.")
  .version("1.0.0");

program
  .argument(
    "[sourceDir]",
    "Path to the directory containing markdown files (defaults to current directory)"
  )
  .option("-h, --html", "Output rendered HTML instead of generating a PDF")
  .action((sourceDir = ".", options) => {
    const resolvedPath = path.resolve(sourceDir);

    if (
      !fs.existsSync(resolvedPath) ||
      !fs.lstatSync(resolvedPath).isDirectory()
    ) {
      console.error(`❌ The path "${resolvedPath}" is not a valid directory.`);
      process.exit(1);
    }

    convertMarkdownToPdf(resolvedPath, { outputHtml: options.html }).catch(
      (err) => {
        console.error("❌ Error generating output:", err);
        process.exit(1);
      }
    );
  });

program.parse();
