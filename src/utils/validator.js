import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validate a manifest object against the md2lab JSON schema.
 * @param {Object} manifest - The combined manifest object from loadMetadataAndManifest
 * @returns {{ valid: boolean, errors: Array }} Validation result
 */
export function validateManifest(manifest) {
    const ajv = new Ajv({ allErrors: true });

    const schemaPath = path.join(__dirname, '../../schemas/manifest.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    // Strip internal pipeline keys before validation
    const { _metadataPath, _legacy, ...manifestToValidate } = manifest;

    const validate = ajv.compile(schema);
    const valid = validate(manifestToValidate);

    return {
        valid,
        errors: validate.errors || [],
    };
}

/**
 * Format AJV validation errors into human-readable messages.
 * @param {Array} errors - AJV validation errors
 * @returns {Array<string>} Formatted error messages
 */
export function formatValidationErrors(errors) {
    return errors.map((error) => {
        const location = error.instancePath || 'manifest';

        switch (error.keyword) {
            case 'required':
                return `${location}: Missing required property '${error.params.missingProperty}'`;
            case 'type':
                return `${location}: Must be ${error.params.type}`;
            case 'enum':
                return `${location}: Must be one of: ${error.params.allowedValues.join(', ')}`;
            case 'pattern':
                return `${location}: Does not match required pattern (${error.params.pattern})`;
            case 'minLength':
                return `${location}: Must be at least ${error.params.limit} character(s)`;
            case 'minItems':
                return `${location}: Must have at least ${error.params.limit} item(s)`;
            case 'additionalProperties':
                return `${location}: Unknown property '${error.params.additionalProperty}'`;
            default:
                return `${location}: ${error.message}`;
        }
    });
}
