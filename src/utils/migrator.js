import path from 'path';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import logger from './logger.js';

/**
 * Detects whether the raw loaded metadata object uses the legacy flat schema.
 * Legacy schema has snake_case keys like course_id / course_title at the root level.
 */
export function isLegacySchema(raw) {
    return (
        raw !== null &&
        typeof raw === 'object' &&
        !raw.metadata &&
        (raw.course_id !== undefined || raw.course_title !== undefined)
    );
}

/**
 * Maps a legacy flat metadata object to the new nested manifest schema.
 *
 * Legacy fields:
 *   course_id, course_title, slug, version, format (string), duration, audience (array), ga, updated
 *
 * New schema:
 *   metadata.courseId, metadata.courseTitle, metadata.slug, metadata.version,
 *   metadata.format (array of {mode, duration}), metadata.roles ({customer, internal}),
 *   metadata.ga, metadata.updated
 *   input.labGuides, output.destination
 */
export function buildManifestFromLegacy(legacy) {
    const courseId =
        legacy.course_id !== undefined ? String(legacy.course_id).padStart(4, '0') : undefined;

    // Derive slug from courseId when not explicitly present in legacy data
    const slug = legacy.slug || courseId;

    // Map course_developer (string or array) → courseDeveloper (array)
    let courseDeveloper;
    if (legacy.course_developer !== undefined) {
        courseDeveloper = Array.isArray(legacy.course_developer)
            ? legacy.course_developer
            : [legacy.course_developer].filter(Boolean);
    }

    // Map legacy format string + duration string → new format array of objects
    let format;
    if (legacy.format !== undefined || legacy.duration !== undefined) {
        format = [
            {
                ...(legacy.format !== undefined && { mode: legacy.format }),
                ...(legacy.duration !== undefined && { duration: legacy.duration }),
            },
        ];
    }

    // Map legacy audience array → new roles object
    let roles;
    if (legacy.audience !== undefined) {
        const customer = Array.isArray(legacy.audience)
            ? legacy.audience
            : [legacy.audience].filter(Boolean);
        roles = { customer, internal: [] };
    }

    // Map legacy top-level version → splunk.platform.version
    let splunk;
    if (legacy.version !== undefined) {
        splunk = { platform: { version: String(legacy.version) } };
    }

    const manifest = {
        ...(courseId !== undefined && { courseId }),
        ...(legacy.course_title !== undefined && { courseTitle: legacy.course_title }),
        ...(slug !== undefined && { slug }),
        ...(courseDeveloper !== undefined && { courseDeveloper }),
        ...(format !== undefined && { format }),
        ...(roles !== undefined && { roles }),
        ...(legacy.ga !== undefined && { ga: legacy.ga }),
        ...(legacy.updated !== undefined && { updated: legacy.updated }),
        ...(splunk !== undefined && { splunk }),
    };

    return manifest;
}

/**
 * Generates the YAML string for the new manifest schema.
 */
export function serializeManifestAsYaml(manifest) {
    return yaml.dump(manifest, { lineWidth: 120, noRefs: true });
}

/**
 * Generates the JSON string for the new manifest schema.
 */
export function serializeManifestAsJson(manifest) {
    return JSON.stringify(manifest, null, 2) + '\n';
}

/**
 * Renames the original legacy metadata file to <name>.yaml.legacy, then writes
 * the migrated manifest as the canonical metadata file (metadata.yaml by default,
 * or metadata.json when explicitly requested).
 *
 * @param {string} metadataPath - Original metadata file path
 * @param {Object} manifest - Migrated manifest object
 * @param {'json'|'yaml'} [format='yaml'] - Output format for the migrated file
 */
export async function writeMigratedManifest(metadataPath, manifest, format = 'yaml') {
    const srcExt = path.extname(metadataPath);
    const base = path.basename(metadataPath, srcExt);
    const dir = path.dirname(metadataPath);

    // Preserve the original under a .legacy extension
    const legacyPath = metadataPath + '.legacy';
    await fs.rename(metadataPath, legacyPath);

    // Write the migrated file with the canonical name
    const outExt = format === 'json' ? '.json' : '.yaml';
    const newPath = path.join(dir, `${base}${outExt}`);

    const content =
        format === 'json' ? serializeManifestAsJson(manifest) : serializeManifestAsYaml(manifest);

    await fs.writeFile(newPath, content, 'utf8');

    logger.warn(`  Original preserved as: ${path.basename(legacyPath)}`);
    logger.warn(`  Migrated schema written to: ${path.basename(newPath)}`);

    return newPath;
}
