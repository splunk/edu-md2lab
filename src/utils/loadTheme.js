import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THEMES_DIR = path.join(__dirname, '../../themes');
const DEFAULT_THEME = 'splunk-edu';

export function getThemeDir(themeName) {
    return path.join(THEMES_DIR, themeName);
}

export function getThemeAssetPath(themeName, assetName) {
    return path.join(THEMES_DIR, themeName, 'assets', assetName);
}

export async function loadThemeConfig(themeName) {
    const configPath = path.join(THEMES_DIR, themeName, 'theme.config.js');
    if (!fs.existsSync(configPath)) {
        return null;
    }
    const module = await import(configPath);
    return module.default;
}

/**
 * Loads theme CSS and replaces relative font url() references with
 * inline base64 data URIs so the CSS can be safely inlined in HTML
 * for Puppeteer rendering.
 */
export function loadThemeCss(themeName = DEFAULT_THEME) {
    const themeDir = path.join(THEMES_DIR, themeName);
    const cssPath = path.join(themeDir, 'style.css');

    if (!fs.existsSync(cssPath)) {
        throw new Error(`Theme CSS not found: ${cssPath}`);
    }

    let css = fs.readFileSync(cssPath, 'utf-8');

    // Replace url('./fonts/<file>') with base64 data URI
    css = css.replace(/url\(['"]?\.\/fonts\/([^'")\s]+)['"]?\)/g, (_match, fontFile) => {
        const fontPath = path.join(themeDir, 'fonts', fontFile);
        if (fs.existsSync(fontPath)) {
            const fontData = fs.readFileSync(fontPath);
            const base64 = fontData.toString('base64');
            const ext = path.extname(fontFile).slice(1).toLowerCase();
            const mimeType = ext === 'ttf' ? 'font/truetype' : `font/${ext}`;
            return `url(data:${mimeType};charset=utf-8;base64,${base64})`;
        }
        return _match; // keep original reference if file not found
    });

    return css;
}

export function getThemeConstants() {
    return { THEMES_DIR, DEFAULT_THEME };
}
