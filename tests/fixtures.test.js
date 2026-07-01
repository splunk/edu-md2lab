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
import { stripJsxComponents, generateHtmlContent } from '../src/generators/htmlGenerator.js';
import { getOrderedMarkdownFiles } from '../src/utils/fileHandler.js';

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
            const filePath = path.join(
                __dirname,
                'fixtures/toc-auto/lab-guides/00-introduction.md',
            );
            const h1 = extractFirstH1(filePath);
            expect(h1).toBe('Testing table of contents with automatic generation');
        });

        it('extracts H1 from toc-auto chapter 1', () => {
            const filePath = path.join(__dirname, 'fixtures/toc-auto/lab-guides/01-testing.md');
            const h1 = extractFirstH1(filePath);
            expect(h1).toBe('Lab exercise 1: Generating a TOC');
        });

        it('extracts H1 from toc-manual introduction', () => {
            const filePath = path.join(
                __dirname,
                'fixtures/toc-manual/lab-guides/00-introduction.md',
            );
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
                path.join(__dirname, 'fixtures/toc-auto/lab-guides/00-introduction.md'),
                path.join(__dirname, 'fixtures/toc-auto/lab-guides/01-testing.md'),
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
            const introPath = path.join(
                __dirname,
                'fixtures/toc-auto/lab-guides/00-introduction.md',
            );
            const files = [
                introPath,
                path.join(__dirname, 'fixtures/toc-auto/lab-guides/01-testing.md'),
            ];

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
            const introPath = path.join(
                __dirname,
                'fixtures/toc-manual/lab-guides/00-introduction.md',
            );
            const files = [
                introPath,
                path.join(__dirname, 'fixtures/toc-manual/lab-guides/01-testing.md'),
            ];

            const content = fs.readFileSync(introPath, 'utf-8');
            const processed = processToc(content, files);

            // Should preserve the manual TOC
            expect(processed).toContain('- [Manual override]');
            expect(processed).toContain('- [Generating a TOC]');
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

describe('stripJsxComponents', () => {
    it('removes a single-line self-closing component', () => {
        const input = 'Before\n<Foo bar="baz" />\nAfter';
        expect(stripJsxComponents(input)).toBe('Before\nAfter');
    });

    it('removes a multi-line self-closing component', () => {
        const input = 'Before\n<Foo\n  bar="baz"\n  qux={1}\n/>\nAfter';
        expect(stripJsxComponents(input)).toBe('Before\nAfter');
    });

    it('removes a multi-line self-closing component with nested JSX expressions', () => {
        const input = [
            'Before',
            '<MultipleChoice',
            '  question="Select the correct answer"',
            '  options={[',
            "    { text: 'Option A', feedback: 'Not quite!' },",
            "    { text: 'Option B', feedback: 'Correct!' },",
            '  ]}',
            '  correctIndex={1}',
            '/>',
            'After',
        ].join('\n');
        expect(stripJsxComponents(input)).toBe('Before\nAfter');
    });

    it('removes a paired component on a single line', () => {
        const input = 'Before\n<Foo bar="baz">child text</Foo>\nAfter';
        expect(stripJsxComponents(input)).toBe('Before\nAfter');
    });

    it('removes a multi-line paired component', () => {
        const input = 'Before\n<Foo bar="baz">\nchild content\n</Foo>\nAfter';
        expect(stripJsxComponents(input)).toBe('Before\nAfter');
    });

    it('removes multiple consecutive components', () => {
        const input = 'Before\n<Foo />\nMiddle\n<Bar\n  prop="val"\n/>\nAfter';
        expect(stripJsxComponents(input)).toBe('Before\nMiddle\nAfter');
    });

    it('preserves lowercase HTML tags', () => {
        const input = 'Text with <strong>bold</strong> and <em>italic</em>.';
        expect(stripJsxComponents(input)).toBe(input);
    });

    it('preserves lowercase XML blocks (e.g. Splunk dashboard XML)', () => {
        const input = [
            '```xml',
            '<dashboard>',
            '  <row>',
            '    <panel />',
            '  </row>',
            '</dashboard>',
            '```',
        ].join('\n');
        expect(stripJsxComponents(input)).toBe(input);
    });

    it('preserves ordinary paragraph content', () => {
        const input = '# Heading\n\nSome paragraph text.\n\n- list item';
        expect(stripJsxComponents(input)).toBe(input);
    });

    it('calls transformFn with the raw block and uses the return value', () => {
        const input = 'Before\n<Foo\n  bar="baz"\n/>\nAfter';
        let capturedBlock = null;
        const result = stripJsxComponents(input, (rawBlock) => {
            capturedBlock = rawBlock;
            return '[Component removed]';
        });
        expect(capturedBlock).toBe('<Foo\n  bar="baz"\n/>');
        expect(result).toBe('Before\n[Component removed]\nAfter');
    });

    it('removes the component when transformFn returns an empty string', () => {
        const input = 'Before\n<Foo />\nAfter';
        const result = stripJsxComponents(input, () => '');
        expect(result).toBe('Before\nAfter');
    });

    it('strips components from the component-course fixture introduction', () => {
        const fixturePath = path.join(
            __dirname,
            'fixtures/component-course/lab-guides/00-introduction.mdx',
        );
        const content = fs.readFileSync(fixturePath, 'utf-8');
        const stripped = stripJsxComponents(content);
        expect(stripped).not.toContain('<SimpleMultipleChoice');
        expect(stripped).not.toContain('<MultipleChoice');
        // Non-component content is preserved
        expect(stripped).toContain('# Component Course');
        expect(stripped).toContain('## Interactive Quiz');
        expect(stripped).toContain('1. First item');
    });
});

describe('getOrderedMarkdownFiles with .mdx files', () => {
    it('includes .mdx files alongside .md files', async () => {
        const labGuidesDir = path.join(__dirname, 'fixtures/component-course/lab-guides');
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        expect(files.length).toBeGreaterThan(0);
        expect(files.some((f) => f.endsWith('.mdx'))).toBe(true);
    });

    it('places 00-introduction.mdx first', async () => {
        const labGuidesDir = path.join(__dirname, 'fixtures/component-course/lab-guides');
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        expect(files[0]).toMatch(/00-introduction\.mdx$/);
    });

    it('places 98-resources.md last', async () => {
        const labGuidesDir = path.join(__dirname, 'fixtures/component-course/lab-guides');
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        expect(files[files.length - 1]).toMatch(/98-resources\.md$/);
    });
});

describe('generateHtmlContent with component-course fixture', () => {
    it('generates HTML without JSX component tags', async () => {
        const labGuidesDir = path.join(__dirname, 'fixtures/component-course/lab-guides');
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        const html = await generateHtmlContent(files, labGuidesDir, '2024-01-01', {
            includeAnswers: false,
            suffix: '',
            label: 'without answers',
        });

        expect(html).not.toContain('<SimpleMultipleChoice');
        expect(html).not.toContain('<MultipleChoice');
    });

    it('generates HTML that includes content from both .mdx and .md files', async () => {
        const labGuidesDir = path.join(__dirname, 'fixtures/component-course/lab-guides');
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        const html = await generateHtmlContent(files, labGuidesDir, '2024-01-01', {
            includeAnswers: false,
            suffix: '',
            label: 'without answers',
        });

        // Content from 00-introduction.mdx
        expect(html).toContain('Component Course');
        // Content from 01-admonitions.md
        expect(html).toContain('Admonitions');
    });

    it('uses the .mdx basename (without extension) as the section data-file attribute', async () => {
        const labGuidesDir = path.join(__dirname, 'fixtures/component-course/lab-guides');
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        const html = await generateHtmlContent(files, labGuidesDir, '2024-01-01', {
            includeAnswers: false,
            suffix: '',
            label: 'without answers',
        });

        expect(html).toContain('data-file="00-introduction"');
    });
});
