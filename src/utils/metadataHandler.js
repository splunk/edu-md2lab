import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import logger from './logger.js';
import { parseDocument, stringify } from 'yaml';
import { isLegacySchema, buildManifestFromLegacy, writeMigratedManifest } from './migrator.js';

// ---------------------------------------------------------------------------
// Field accessors — support both new schema (camelCase) and legacy (snake_case)
// These receive the metadata object (manifest.metadata or legacy flat object)
// ---------------------------------------------------------------------------

export function getCourseTitle(metadata) {
    const courseTitle = metadata?.courseTitle || metadata?.course_title;
    if (courseTitle === undefined) {
        throw new Error("No 'courseTitle' found in the metadata");
    }
    return courseTitle;
}

export function getCourseId(metadata) {
    const courseId = metadata?.courseId || metadata?.course_id;
    if (courseId === undefined) {
        throw new Error("No 'courseId' found in the metadata");
    }
    return String(courseId).padStart(4, '0');
}

export function getVersion(metadata) {
    return metadata?.version;
}

export function getCourseFormat(metadata) {
    const courseFormat = metadata?.format;
    if (courseFormat === undefined) {
        throw new Error("No 'format' found in the metadata");
    }
    return courseFormat;
}

export function getCourseDuration(metadata) {
    const courseDuration = metadata?.duration;
    if (courseDuration === undefined) {
        throw new Error("No 'duration' found in the metadata");
    }
    return courseDuration;
}

export function getCourseAudience(metadata) {
    const courseAudience = metadata?.audience;
    if (courseAudience === undefined) {
        throw new Error("No 'audience' found in the metadata");
    }
    return courseAudience;
}

export function getCourseGA(metadata) {
    const courseGA = metadata?.ga;
    if (courseGA === undefined) {
        return [null, "No 'ga' found in the metadata"];
    }
    return [courseGA, null];
}

export function slugify(text) {
    logger.debug(`Slugifying text: "${text}"`);
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

// ---------------------------------------------------------------------------
// Metadata file loading (legacy API — used by existing code paths)
// ---------------------------------------------------------------------------

export async function getMetadataPath(sourceDir) {
    const extensions = ['json', 'yaml', 'yml'];
    for (const ext of extensions) {
        const filePath = path.join(sourceDir, `metadata.${ext}`);
        try {
            await fs.access(filePath);
            return filePath;
        } catch {
            // try next
        }
    }
    logger.error('Metadata file not found (metadata.json, metadata.yaml, or metadata.yml)');
    process.exit(1);
}

export async function loadMetadata(metadataPath) {
    const raw = await fs.readFile(metadataPath, 'utf8');
    const metadata = metadataPath.endsWith('.json') ? JSON.parse(raw) : yaml.load(raw) || {};

    // Normalize legacy course_id padding
    if (metadata.course_id) {
        metadata.course_id = metadata.course_id.toString().padStart(4, '0');
    }

    logger.info(`🚚 Loading metadata ${metadataPath}`);
    return metadata;
}

// ---------------------------------------------------------------------------
// New schema: loadMetadataAndManifest — used by the pipeline Load stage
// ---------------------------------------------------------------------------

/**
 * Loads metadata from metadata.json / metadata.yaml / metadata.yml in sourceDir.
 * Detects legacy flat schema and migrates in-memory; writes a *.new.yaml for review.
 * Returns a normalized manifest object: { metadata, input, output, plugins?, _metadataPath, _legacy }
 */
export async function loadMetadataAndManifest(sourceDir, { migrateFormat = 'yaml' } = {}) {
    const candidates = ['metadata.json', 'metadata.yaml', 'metadata.yml'];
    let metadataPath = null;
    let raw = null;

    for (const candidate of candidates) {
        const isJson = candidate.endsWith('.json');
        const p = path.join(sourceDir, candidate);
        try {
            await fs.access(p);
            metadataPath = p;
            const content = await fs.readFile(p, 'utf8');
            raw = isJson ? JSON.parse(content) : yaml.load(content) || {};
            break;
        } catch {
            // try next candidate
        }
    }

    if (!raw) {
        throw new Error(
            `No metadata file found in "${sourceDir}" (checked: ${candidates.join(', ')})`,
        );
    }

    logger.info(`🚚 Loading metadata ${metadataPath}`);

    let manifest = raw;
    let isLegacy = false;

    if (isLegacySchema(raw)) {
        isLegacy = true;
        logger.warn('⚠️  Legacy metadata format detected (snake_case fields).');
        logger.warn('    Consider migrating to the new schema. See docs/metadata-schema.md');
        manifest = buildManifestFromLegacy(raw);
        // Write a draft of the new schema for the user to review
        await writeMigratedManifest(metadataPath, manifest, migrateFormat).catch(() => {
            // Non-fatal — just warn
            logger.warn('    Could not write migration draft (check file permissions).');
        });
    }

    // Ensure required nested structure exists
    if (!manifest.metadata) {
        throw new Error(`Invalid metadata file: missing "metadata" key. File: ${metadataPath}`);
    }

    // Normalize courseId padding
    if (manifest.metadata.courseId) {
        manifest.metadata.courseId = String(manifest.metadata.courseId).padStart(4, '0');
    }

    manifest._metadataPath = metadataPath;
    manifest._legacy = isLegacy;

    // Load optional separate manifest file (manifest.json / manifest.yaml / manifest.yml).
    // Its top-level keys (output, input, plugins, etc.) override anything from the metadata file,
    // but the `metadata` section always comes from the metadata file.
    const manifestCandidates = ['manifest.json', 'manifest.yaml', 'manifest.yml'];
    for (const candidate of manifestCandidates) {
        const isJson = candidate.endsWith('.json');
        const p = path.join(sourceDir, candidate);
        try {
            await fs.access(p);
            const content = await fs.readFile(p, 'utf8');
            const manifestFile = isJson ? JSON.parse(content) : yaml.load(content) || {};
            logger.info(`🚚 Loading manifest ${p}`);
            const { metadata: _discard, ...manifestFileConfig } = manifestFile;
            Object.assign(manifest, manifestFileConfig);
            break;
        } catch {
            // no separate manifest — fine
        }
    }

    return manifest;
}

// ---------------------------------------------------------------------------
// Metadata date update — supports both schema formats
// ---------------------------------------------------------------------------

export async function updateMetadataDate(metadataPath, manifestOrMetadata, courseUpdated) {
    const isJson = metadataPath.endsWith('.json');

    if (isJson) {
        const raw = await fs.readFile(metadataPath, 'utf8');
        const doc = JSON.parse(raw);
        if (doc.metadata) {
            doc.metadata.updated = courseUpdated;
        } else {
            doc.updated = courseUpdated;
        }
        await fs.writeFile(metadataPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    } else {
        const yamlContent = await fs.readFile(metadataPath, 'utf8');
        const yamlDoc = parseDocument(yamlContent);

        // Determine if new or legacy schema by looking at the raw doc structure
        const hasMetadataKey = yamlDoc.has('metadata');
        if (hasMetadataKey) {
            yamlDoc.setIn(['metadata', 'updated'], courseUpdated);
        } else {
            // Legacy: update top-level fields
            const legacyCourseId =
                manifestOrMetadata?.metadata?.courseId || manifestOrMetadata?.course_id;
            if (legacyCourseId) {
                yamlDoc.setIn(['course_id'], String(legacyCourseId).padStart(4, '0'));
            }
            yamlDoc.setIn(['updated'], courseUpdated);
        }

        await fs.writeFile(metadataPath, stringify(yamlDoc), 'utf8');
    }

    logger.info(`🏷️  Updating metadata.updated: ${courseUpdated}`);
}

export function getFormattedDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

export function valiDate(input) {
    const date = new Date(input);

    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format. Use YYYY-MM-DD. You entered: ${input}`);
    }
    return date.toISOString().split('T')[0];
}
