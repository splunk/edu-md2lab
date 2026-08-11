import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
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
import {
    loadMetadataAndManifest,
    getCourseTitle,
    getCourseId,
    getCourseFormat,
    getCourseDuration,
    getCourseAudience,
    getCourseGA,
    getVersion,
} from '../src/utils/metadataHandler.js';
import { isLegacySchema, buildManifestFromLegacy } from '../src/utils/migrator.js';
import { generateSlug } from '../src/utils/slugger.js';
import pluginManager from '../plugins/pluginLoader.js';
import { postProcessHtml } from '../plugins/webpage/index.js';

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

describe('component-course metadata parsing (new schema)', () => {
    let manifest;

    beforeAll(async () => {
        const fixtureDir = path.join(__dirname, 'fixtures/component-course');
        manifest = await loadMetadataAndManifest(fixtureDir);
    });

    it('detects new schema (not legacy)', () => {
        expect(manifest._legacy).toBe(false);
    });

    it('wraps fields under manifest.metadata', () => {
        expect(manifest.metadata).toBeDefined();
    });

    it('parses courseId correctly', () => {
        expect(getCourseId(manifest.metadata)).toBe('component-course');
    });

    it('parses courseTitle correctly', () => {
        expect(getCourseTitle(manifest.metadata)).toBe('Component Course');
    });

    it('parses format as an array', () => {
        const format = getCourseFormat(manifest.metadata);
        expect(Array.isArray(format)).toBe(true);
        expect(format[0].mode).toBe('eLearning');
    });

    it('parses duration from format[0].duration', () => {
        expect(getCourseDuration(manifest.metadata)).toBe('5 hours');
    });

    it('parses audience from roles.customer', () => {
        const audience = getCourseAudience(manifest.metadata);
        expect(audience).toContain('sysadmin');
        expect(audience).toContain('power user');
    });

    it('parses ga date correctly', () => {
        const [ga, err] = getCourseGA(manifest.metadata);
        expect(err).toBeNull();
        expect(ga).toBe('2025-11-01');
    });

    it('returns undefined for version when not set', () => {
        expect(getVersion(manifest.metadata)).toBeUndefined();
    });

    it('merges input/output config from manifest.json', () => {
        expect(manifest.input?.labGuides).toBe('./lab-guides');
        expect(manifest.output?.formats).toContain('app');
    });
});

describe('custom-input metadata and manifest parsing', () => {
    let manifest;

    beforeAll(async () => {
        const fixtureDir = path.join(__dirname, 'fixtures/custom-input');
        manifest = await loadMetadataAndManifest(fixtureDir);
    });

    it('detects new schema (not legacy)', () => {
        expect(manifest._legacy).toBe(false);
    });

    it('parses courseId correctly', () => {
        expect(getCourseId(manifest.metadata)).toBe('custom-input');
    });

    it('parses courseTitle correctly', () => {
        expect(getCourseTitle(manifest.metadata)).toBe('Custom Input');
    });

    it('parses projectId from metadata', () => {
        expect(manifest.metadata.projectId).toBe('PROJ-1234');
    });

    it('parses courseDeveloper as an array with multiple entries', () => {
        expect(Array.isArray(manifest.metadata.courseDeveloper)).toBe(true);
        expect(manifest.metadata.courseDeveloper).toContain('Buttercup Pwny');
        expect(manifest.metadata.courseDeveloper).toContain('Splunk EDU');
    });

    it('manifest.json overrides input.labGuides to ./custom-dir', () => {
        expect(manifest.input?.labGuides).toBe('./custom-dir');
    });

    it('resolves markdown files from the custom-dir', async () => {
        const fixtureDir = path.join(__dirname, 'fixtures/custom-input');
        const customDir = path.join(fixtureDir, manifest.input.labGuides);
        const files = await getOrderedMarkdownFiles(customDir);
        expect(files.length).toBe(2);
        expect(files[0]).toMatch(/00-introduction\.md$/);
        expect(files[1]).toMatch(/01-placeholder\.md$/);
    });

    it('generates HTML content from custom-dir files', async () => {
        const fixtureDir = path.join(__dirname, 'fixtures/custom-input');
        const customDir = path.join(fixtureDir, manifest.input.labGuides);
        const files = await getOrderedMarkdownFiles(customDir);
        const html = await generateHtmlContent(files, customDir, '2024-01-01', {
            includeAnswers: false,
            suffix: '',
            label: 'without answers',
        });
        expect(html).toContain('Testing custom input');
    });
});

describe('custom-output metadata and manifest parsing', () => {
    let manifest;

    beforeAll(async () => {
        const fixtureDir = path.join(__dirname, 'fixtures/custom-output');
        manifest = await loadMetadataAndManifest(fixtureDir);
    });

    it('detects new schema (not legacy)', () => {
        expect(manifest._legacy).toBe(false);
    });

    it('parses courseId correctly', () => {
        expect(getCourseId(manifest.metadata)).toBe('custom-output');
    });

    it('parses courseTitle correctly', () => {
        expect(getCourseTitle(manifest.metadata)).toBe('Testing custom output');
    });

    it('parses ILT format mode', () => {
        const format = getCourseFormat(manifest.metadata);
        expect(Array.isArray(format)).toBe(true);
        expect(format[0].mode).toBe('Instructor-led training with labs');
    });

    it('parses duration from format[0].duration', () => {
        expect(getCourseDuration(manifest.metadata)).toBe('9 hours');
    });

    it('parses audience from roles.customer', () => {
        const audience = getCourseAudience(manifest.metadata);
        expect(audience).toEqual(['Splunk administrators']);
    });

    it('has no internal roles', () => {
        expect(manifest.metadata.roles.internal).toBeUndefined();
    });

    it('parses ga date correctly', () => {
        const [ga, err] = getCourseGA(manifest.metadata);
        expect(err).toBeNull();
        expect(ga).toBe('2025-08-11');
    });

    it('returns undefined for version when not set', () => {
        expect(getVersion(manifest.metadata)).toBeUndefined();
    });

    it('manifest.json overrides output.destination to ./custom', () => {
        expect(manifest.output?.destination).toBe('./custom');
    });

    it('manifest.json sets custom PDF filename via output.pdfs.labGuide', () => {
        expect(manifest.output?.pdfs?.labGuide).toBe('custom-filename.pdf');
    });

    it('has no custom input override (uses default lab-guides)', () => {
        expect(manifest.input).toBeUndefined();
    });

    it('resolves markdown files from the default lab-guides dir', async () => {
        const fixtureDir = path.join(__dirname, 'fixtures/custom-output');
        const labGuidesDir = path.join(fixtureDir, 'lab-guides');
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        expect(files.length).toBe(1);
        expect(files[0]).toMatch(/00-introduction\.md$/);
    });

    it('generates HTML content from lab-guides files', async () => {
        const fixtureDir = path.join(__dirname, 'fixtures/custom-output');
        const labGuidesDir = path.join(fixtureDir, 'lab-guides');
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        const html = await generateHtmlContent(files, labGuidesDir, '2024-01-01', {
            includeAnswers: false,
            suffix: '',
            label: 'without answers',
        });
        expect(html).toContain('Testing table of content with one file');
    });
});

describe('format-precedence: JSON takes priority over YAML', () => {
    let manifest;

    beforeAll(async () => {
        const fixtureDir = path.join(__dirname, 'fixtures/format-precedence');
        manifest = await loadMetadataAndManifest(fixtureDir);
    });

    it('loads metadata.json when both metadata.json and metadata.yaml are present', () => {
        expect(manifest._metadataPath).toMatch(/metadata\.json$/);
    });

    it('does not load the yaml file', () => {
        expect(manifest._metadataPath).not.toMatch(/metadata\.ya?ml$/);
    });

    it('parses the JSON content correctly', () => {
        expect(getCourseTitle(manifest.metadata)).toBe('Testing custom output');
    });
});

describe.each([
    { fixture: 'toc-auto', courseId: 'toc-auto', courseTitle: 'Table of Contents Auto' },
    { fixture: 'toc-manual', courseId: 'toc-manual', courseTitle: 'Table of Contents Manual' },
    { fixture: 'toc-one', courseId: 'toc-one', courseTitle: 'Table of Contents One' },
])('$fixture metadata (no manifest — default settings)', ({ fixture, courseId, courseTitle }) => {
    let manifest;

    beforeAll(async () => {
        manifest = await loadMetadataAndManifest(path.join(__dirname, 'fixtures', fixture));
    });

    it('detects new schema (not legacy)', () => {
        expect(manifest._legacy).toBe(false);
    });

    it('parses courseId correctly', () => {
        expect(getCourseId(manifest.metadata)).toBe(courseId);
    });

    it('parses courseTitle correctly', () => {
        expect(getCourseTitle(manifest.metadata)).toBe(courseTitle);
    });

    it('has no manifest overrides (input and output are undefined)', () => {
        expect(manifest.input).toBeUndefined();
        expect(manifest.output).toBeUndefined();
    });
});

describe('toc-one single-file lab guide', () => {
    it('resolves exactly one markdown file', async () => {
        const labGuidesDir = path.join(__dirname, 'fixtures/toc-one/lab-guides');
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        expect(files.length).toBe(1);
        expect(files[0]).toMatch(/00-introduction\.md$/);
    });

    it('generates HTML from a single file', async () => {
        const labGuidesDir = path.join(__dirname, 'fixtures/toc-one/lab-guides');
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        const html = await generateHtmlContent(files, labGuidesDir, '2024-01-01', {
            includeAnswers: false,
            suffix: '',
            label: 'without answers',
        });
        expect(html).toContain('Testing table of content with one file');
    });
});

describe('multiple-manifests metadata and manifest parsing', () => {
    let manifest;

    beforeAll(async () => {
        const fixtureDir = path.join(__dirname, 'fixtures/multiple-manifests');
        manifest = await loadMetadataAndManifest(fixtureDir);
    });

    it('detects new schema (not legacy)', () => {
        expect(manifest._legacy).toBe(false);
    });

    it('pads numeric courseId to 4 characters', () => {
        expect(getCourseId(manifest.metadata)).toBe('1234');
    });

    it('parses courseTitle correctly', () => {
        expect(getCourseTitle(manifest.metadata)).toBe('Custom Output');
    });

    it('parses projectId from metadata', () => {
        expect(manifest.metadata.projectId).toBe('PROJ-1234');
    });

    it('input.labGuides is an array', () => {
        expect(Array.isArray(manifest.input?.labGuides)).toBe(true);
    });

    it('input.labGuides references both subdirectories', () => {
        expect(manifest.input.labGuides).toContain('./dir01/');
        expect(manifest.input.labGuides).toContain('./dir02/manifest.json');
    });

    it('input.courseDescription points to the custom description file', () => {
        expect(manifest.input?.courseDescription).toBe('./custom-filename.md');
    });

    it('dir02 has its own manifest with output.destination', () => {
        const dir02Manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, 'fixtures/multiple-manifests/dir02/manifest.json'),
                'utf-8',
            ),
        );
        expect(dir02Manifest.output?.destination).toBe('./custom');
    });

    it('dir02 manifest specifies a custom PDF filename', () => {
        const dir02Manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, 'fixtures/multiple-manifests/dir02/manifest.json'),
                'utf-8',
            ),
        );
        expect(dir02Manifest.output?.pdfs?.labGuide).toBe('custom-filename.pdf');
    });
});

describe('yaml-all-the-things: YAML metadata and manifest parsing', () => {
    let manifest;

    beforeAll(async () => {
        const fixtureDir = path.join(__dirname, 'fixtures/yaml-all-the-things');
        manifest = await loadMetadataAndManifest(fixtureDir);
    });

    it('loads metadata.yaml (not a .json file)', () => {
        expect(manifest._metadataPath).toMatch(/metadata\.yaml$/);
    });

    it('detects new schema (not legacy)', () => {
        expect(manifest._legacy).toBe(false);
    });

    it('parses courseId correctly', () => {
        expect(getCourseId(manifest.metadata)).toBe('yaml-all-the-things');
    });

    it('parses courseTitle correctly', () => {
        expect(getCourseTitle(manifest.metadata)).toBe('YAML All The Things');
    });

    it('parses projectId', () => {
        expect(manifest.metadata.projectId).toBe('PROJ-9999');
    });

    it('parses version string', () => {
        expect(getVersion(manifest.metadata)).toBe('2.1.0');
    });

    it('parses courseDeveloper as a multi-entry array', () => {
        expect(manifest.metadata.courseDeveloper).toContain('Buttercup Pwny');
        expect(manifest.metadata.courseDeveloper).toContain('Splunk EDU');
    });

    it('parses format array with mode and duration', () => {
        const format = getCourseFormat(manifest.metadata);
        expect(Array.isArray(format)).toBe(true);
        expect(format[0].mode).toBe('Instructor-led training with labs');
        expect(getCourseDuration(manifest.metadata)).toBe('9 hours');
    });

    it('parses roles.customer array', () => {
        const audience = getCourseAudience(manifest.metadata);
        expect(audience).toContain('sysadmin');
        expect(audience).toContain('power user');
    });

    it('parses roles.internal array', () => {
        expect(manifest.metadata.roles.internal).toContain('professional services');
        expect(manifest.metadata.roles.internal).toContain('sales engineer');
    });

    it('parses quoted ga date string', () => {
        const [ga, err] = getCourseGA(manifest.metadata);
        expect(err).toBeNull();
        expect(ga).toBe('2025-08-11');
    });

    it('parses nested splunk.platform fields', () => {
        expect(manifest.metadata.splunk?.platform?.deployment).toBe('Enterprise | Cloud');
        expect(manifest.metadata.splunk?.platform?.version).toBe('10.2.1');
    });

    it('merges output.destination from manifest.yaml', () => {
        expect(manifest.output?.destination).toBe('./custom');
    });

    it('merges output.pdfs.labGuide from manifest.yaml', () => {
        expect(manifest.output?.pdfs?.labGuide).toBe('yaml-output.pdf');
    });

    it('merges input.labGuides from manifest.yaml', () => {
        expect(manifest.input?.labGuides).toBe('./lab-guides');
    });
});

describe('metadata-migration: legacy YAML schema detection and migration', () => {
    let legacyRaw;
    let migrated;
    let expectedMetadata;

    beforeAll(() => {
        const fixturePath = path.join(__dirname, 'fixtures/metadata-migration/bak');
        legacyRaw = yaml.load(fs.readFileSync(path.join(fixturePath, 'metadata.yaml'), 'utf-8'));
        migrated = buildManifestFromLegacy(legacyRaw);
        expectedMetadata = JSON.parse(
            fs.readFileSync(path.join(fixturePath, 'metadata.json'), 'utf-8'),
        );
    });

    it('detects legacy schema via snake_case keys', () => {
        expect(isLegacySchema(legacyRaw)).toBe(true);
    });

    it('does not detect new-schema metadata as legacy', () => {
        expect(isLegacySchema(expectedMetadata)).toBe(false);
    });

    it('migrates courseId from course_id', () => {
        expect(migrated.courseId).toBe('metadata-migration');
    });

    it('migrates courseTitle from course_title', () => {
        expect(migrated.courseTitle).toBe('Migrating Legacy Metadata Schemas');
    });

    it('derives slug from courseId when not present in legacy data', () => {
        expect(migrated.slug).toBe('metadata-migration');
    });

    it('migrates course_developer string to courseDeveloper array', () => {
        expect(Array.isArray(migrated.courseDeveloper)).toBe(true);
        expect(migrated.courseDeveloper).toContain('Splunk EDU');
    });

    it('migrates format string and duration to format array', () => {
        expect(Array.isArray(migrated.format)).toBe(true);
        expect(migrated.format[0].mode).toBe('Instructor-led training with labs');
        expect(migrated.format[0].duration).toBe('9 hours');
    });

    it('migrates audience to roles.customer array', () => {
        expect(migrated.roles.customer).toContain('Splunk administrators');
    });

    it('initialises roles.internal as empty array', () => {
        expect(migrated.roles.internal).toEqual([]);
    });

    it('nests version under splunk.platform.version', () => {
        expect(migrated.splunk?.platform?.version).toBe('10.2');
    });

    it('does not include deployment (cannot be auto-migrated)', () => {
        expect(migrated.splunk?.platform?.deployment).toBeUndefined();
    });

    it('migrated manifest matches the expected metadata.json fixture', () => {
        expect(migrated).toEqual(expectedMetadata);
    });

    it('does not include input or output defaults', () => {
        expect(migrated.input).toBeUndefined();
        expect(migrated.output).toBeUndefined();
    });
});

describe('slugger: generateSlug', () => {
    it('lowercases and hyphenates words', () => {
        expect(generateSlug('Cloud Administration')).toBe('cloud-admin');
    });

    it('removes Splunk from the title', () => {
        expect(generateSlug('Splunk Cloud Administration')).toBe('cloud-admin');
    });

    it('removes Enterprise from the title', () => {
        expect(generateSlug('Enterprise Data Management')).toBe('data-management');
    });

    it('shortens Administrator to admin', () => {
        expect(generateSlug('Splunk Administrator Basics')).toBe('admin-basics');
    });

    it('collapses multiple hyphens', () => {
        expect(generateSlug('Splunk Enterprise Administration')).toBe('admin');
    });

    it('strips leading and trailing hyphens', () => {
        expect(generateSlug('Splunk Basics')).toBe('basics');
    });
});

describe('syntax-highlighting fixture', () => {
    const fixtureDir = path.join(__dirname, 'fixtures/syntax-highlighting');
    const labGuidesDir = path.join(fixtureDir, 'lab-guides');
    let manifest;
    let html;

    beforeAll(async () => {
        manifest = await loadMetadataAndManifest(fixtureDir);
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        const renderCode = manifest.output?.render?.code ?? {};
        html = await generateHtmlContent(
            files,
            labGuidesDir,
            '2026-07-31',
            { includeAnswers: false, suffix: '', label: 'without answers' },
            manifest.output?.render?.theme ?? 'splunk-edu',
            renderCode,
        );
    });

    it('reads output.render.theme from manifest', () => {
        expect(manifest.output?.render?.theme).toBe('splunk-edu');
    });

    it('reads output.render.code.theme from manifest', () => {
        expect(manifest.output?.render?.code?.theme).toBe('atom-one-dark');
    });

    it('renders hljs-highlighted pre blocks', () => {
        expect(html).toContain('class="hljs"');
    });

    it('applies hljs spans to JavaScript code', () => {
        expect(html).toContain('<span class="hljs-');
    });

    it('injects the atom-one-dark highlight.js theme CSS', () => {
        expect(html).toContain('.hljs{');
    });

    it('renders the plain (no-language) code block without error', () => {
        expect(html).toContain('just plain text');
        expect(html).toContain('no highlighting');
    });
});

describe('webpage plugin', () => {
    const fixtureDir = path.join(__dirname, 'fixtures/plugin-webpage');
    const labGuidesDir = path.join(fixtureDir, 'lab-guides');
    let manifest;
    let rawHtml;
    let processedHtml;

    beforeAll(async () => {
        manifest = await loadMetadataAndManifest(fixtureDir);
        const files = await getOrderedMarkdownFiles(labGuidesDir);
        rawHtml = await generateHtmlContent(files, labGuidesDir, '2026-07-31', {
            includeAnswers: false,
            suffix: '',
            label: 'without answers',
        });
        processedHtml = postProcessHtml(rawHtml);
    });

    afterAll(() => {
        pluginManager.reset();
    });

    it('manifest declares the webpage plugin', () => {
        expect(manifest.plugins?.[0]?.name).toBe('webpage');
    });

    it('plugin exports outputMode as html', async () => {
        const { default: plugin } = await import('../plugins/webpage/index.js');
        expect(plugin.hooks.outputMode).toBe('html');
    });

    it('injects the toc-sidebar nav element', () => {
        expect(processedHtml).toContain('id="toc-sidebar"');
    });

    it('injects the toc-list ul element', () => {
        expect(processedHtml).toContain('id="toc-list"');
    });

    it('injects sidebar CSS', () => {
        expect(processedHtml).toContain('#toc-sidebar');
    });

    it('injects copy button script', () => {
        expect(processedHtml).toContain('copy-btn');
    });

    it('injects IntersectionObserver script for active TOC links', () => {
        expect(processedHtml).toContain('IntersectionObserver');
    });

    it('injects exactly one sidebar into the output', () => {
        const count = (processedHtml.match(/id="toc-sidebar"/g) || []).length;
        expect(count).toBe(1);
    });
});
