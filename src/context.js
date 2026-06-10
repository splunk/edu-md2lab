export class Context {
    constructor(options = {}) {
        this.sourceDir = options.sourceDir; // top-level course directory
        this.labGuidesDir = null; // resolved lab-guides directory
        this.options = options;
        this.manifest = null; // full manifest (metadata + input + output)
        this.metadata = null; // shorthand: manifest.metadata
        this.markdownFiles = []; // ordered list of .md file paths
        this.htmlVariants = []; // [{ html, variant }] from stage 40
        this.datestamp = options.datestamp || null; // ISO date string e.g. '2026-05-07'
        this.formattedDate = null; // human-readable e.g. 'May 07, 2026'
        this.theme = null; // theme name e.g. 'splunk-edu'
        this.plugins = []; // plugin entries from manifest
        this.outputPaths = []; // written PDF paths
        this.errors = [];
        this.warnings = [];
    }

    addError(message, stage = 'unknown') {
        this.errors.push({ message, stage, timestamp: new Date().toISOString() });
    }

    addWarning(message, stage = 'unknown') {
        this.warnings.push({ message, stage, timestamp: new Date().toISOString() });
    }

    hasErrors() {
        return this.errors.length > 0;
    }

    getErrorMessages() {
        return this.errors.map((e) => `[${e.stage}] ${e.message}`);
    }
}
