import { describe, it, expect } from 'vitest';
import { loadThemeConfig, getThemeAssetPath } from '../src/utils/loadTheme.js';
import fs from 'fs';

describe('loadThemeConfig', () => {
    it('loads theme config via dynamic import on Windows absolute paths', async () => {
        const config = await loadThemeConfig('splunk-edu');
        expect(config).not.toBeNull();
        expect(config.name).toBe('splunk-edu');
        expect(config.header.logo).toBe('logo-splunk-cisco.png');
    });

    it('returns null for missing theme', async () => {
        const config = await loadThemeConfig('nonexistent-theme');
        expect(config).toBeNull();
    });
});

describe('getThemeAssetPath', () => {
    it('resolves theme asset paths that exist on disk', () => {
        const logoPath = getThemeAssetPath('splunk-edu', 'logo-splunk-cisco.png');
        expect(fs.existsSync(logoPath)).toBe(true);
    });
});
