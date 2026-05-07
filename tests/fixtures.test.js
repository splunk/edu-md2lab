import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
    headingToAnchor,
    extractFirstH1,
    hasTocContent,
    generateTocLinks,
    processToc,
} from '../src/utils/tocGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('TOC Generator', () => {
    describe('headingToAnchor', () => {
        it('converts heading to lowercase anchor', () => {
            expect(headingToAnchor('Getting Started')).toBe('getting-started');
        });

        it('removes special characters', () => {
            expect(headingToAnchor('Lab exercise 1: Testing')).toBe('lab-exercise-1-testing');
        });

        it('handles parentheses and optional markers', () => {
            expect(headingToAnchor('(Optional) Task 3: Do the other thing')).toBe(
                'optional-task-3-do-the-other-thing',
            );
        });

        it('collapses multiple hyphens', () => {
            expect(headingToAnchor('Test --- multiple -- hyphens')).toBe('test-multiple-hyphens');
        });
    });

    describe('extractFirstH1', () => {
        it('extracts H1 from toc-auto introduction', () => {
            const filePath = path.join(__dirname, 'fixtures/toc-auto/00-introduction.md');
            const h1 = extractFirstH1(filePath);
            expect(h1).toBe('Testing table of contents with automatic generation');
        });

        it('extracts H1 from toc-auto chapter 1', () => {
            const filePath = path.join(__dirname, 'fixtures/toc-auto/01-testing.md');
            const h1 = extractFirstH1(filePath);
            expect(h1).toBe('Lab exercise 1: Generating a TOC');
        });

        it('extracts H1 from toc-manual introduction', () => {
            const filePath = path.join(__dirname, 'fixtures/toc-manual/00-introduction.md');
            const h1 = extractFirstH1(filePath);
            expect(h1).toBe('Testing table of contents with manual override');
        });
    });

    describe('hasTocContent', () => {
        it('returns false when TOC is empty', () => {
            const content = `# Test\n\n## Table of contents\n\n\n## Next Section`;
            expect(hasTocContent(content)).toBe(false);
        });

        it('returns true when TOC has list items', () => {
            const content = `# Test\n\n## Table of contents\n\n* [Link](#link)\n* [Another](#another)\n\n## Next Section`;
            expect(hasTocContent(content)).toBe(true);
        });

        it('returns true for TOC with dash-style lists', () => {
            const content = `# Test\n\n## Table of contents\n\n- [Link](#link)\n- [Another](#another)\n\n## Next Section`;
            expect(hasTocContent(content)).toBe(true);
        });

        it('returns false when no TOC section exists', () => {
            const content = `# Test\n\n## Some Other Section\n\nContent here`;
            expect(hasTocContent(content)).toBe(false);
        });
    });

    describe('generateTocLinks', () => {
        it("generates TOC links from files with 'Introduction' for first file", () => {
            const files = [
                path.join(__dirname, 'fixtures/toc-auto/00-introduction.md'),
                path.join(__dirname, 'fixtures/toc-auto/01-testing.md'),
            ];

            const toc = generateTocLinks(files);
            const lines = toc.split('\n');

            expect(lines).toHaveLength(2);
            expect(lines[0]).toBe(
                '* [Introduction](#testing-table-of-contents-with-automatic-generation)',
            );
            expect(lines[1]).toBe(
                '* [Lab exercise 1: Generating a TOC](#lab-exercise-1-generating-a-toc)',
            );
        });
    });

    describe('processToc - Auto-generation', () => {
        it('auto-generates TOC when section is empty', () => {
            const introPath = path.join(__dirname, 'fixtures/toc-auto/00-introduction.md');
            const files = [introPath, path.join(__dirname, 'fixtures/toc-auto/01-testing.md')];

            const content = fs.readFileSync(introPath, 'utf-8');
            const processed = processToc(content, files);

            // Should contain the generated TOC
            expect(processed).toContain('* [Introduction]');
            expect(processed).toContain('* [Lab exercise 1: Generating a TOC]');
            expect(processed).toContain('#testing-table-of-contents-with-automatic-generation');
            expect(processed).toContain('#lab-exercise-1-generating-a-toc');
        });
    });

    describe('processToc - Manual override', () => {
        it('preserves manual TOC content', () => {
            const introPath = path.join(__dirname, 'fixtures/toc-manual/00-introduction.md');
            const files = [introPath, path.join(__dirname, 'fixtures/toc-manual/01-testing.md')];

            const content = fs.readFileSync(introPath, 'utf-8');
            const processed = processToc(content, files);

            // Should preserve the manual TOC
            expect(processed).toContain('* [Manual override]');
            expect(processed).toContain('* [Generating a TOC]');
            expect(processed).toContain('- [Optional task 3](#optional-task-3-do-the-other-thing)');

            // Should NOT contain auto-generated "Introduction" link
            expect(processed).not.toContain(
                '* [Introduction](#testing-table-of-contents-with-manual-override)',
            );
        });
    });

    describe('processToc - No TOC section', () => {
        it('returns content unchanged when no TOC section exists', () => {
            const content = `# Test Document\n\n## Some Section\n\nContent here`;
            const files = ['/fake/path1.md', '/fake/path2.md'];

            const processed = processToc(content, files);
            expect(processed).toBe(content);
        });
    });
});
