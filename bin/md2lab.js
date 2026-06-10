#!/usr/bin/env node

import { Command } from 'commander';
import { generateLabGuide } from '../src/index.js';

const program = new Command();

program
    .name('md2lab')
    .description('Convert Markdown lab guides to a styled PDF.')
    .version('1.0.0')
    .argument(
        '[sourcePath]',
        'Path to the directory containing lab guide Markdown files (defaults to current directory)',
    )
    .option('-H, --html', 'Output HTML to console instead of generating a PDF')
    .option(
        '-d, --date <date>',
        'Use a custom date in YYYY-MM-DD format instead of the current date',
    )
    .option('-t, --theme <name>', 'Override the theme (e.g., splunk-edu, cisco)')
    .option(
        '-m, --migrate <format>',
        'Output format for migrated legacy metadata: json or yaml (default: yaml)',
    )
    .action(async (sourcePath = '.', options) => {
        if (options.migrate && !['json', 'yaml'].includes(options.migrate)) {
            console.error(`❌ Invalid --migrate format: "${options.migrate}". Use json or yaml.`);
            process.exit(1);
        }
        try {
            await generateLabGuide(sourcePath, options);
        } catch (err) {
            console.error(' ❌', err.message || err);
            process.exit(1);
        }
    });

program.parse();
