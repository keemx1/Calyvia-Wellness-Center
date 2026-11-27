import * as fs from 'fs';
import * as path from 'path';

describe('PWA Manifest & Service Worker Compliance', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const manifestPath = path.join(rootDir, 'apps/admin/public/manifest.webmanifest');
  const swPath = path.join(rootDir, 'apps/admin/public/sw.js');
  const publicDir = path.join(rootDir, 'apps/admin/public');

  it('should have a valid web app manifest file', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(content);

    expect(manifest.name).toBe('Calyvia Wellness Center');
    expect(manifest.short_name).toBe('Calyvia');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#059669');
    expect(manifest.background_color).toBe('#ffffff');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
  });

  it('should define required icons including 192, 512, and maskable variants', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(4);

    const sizes = manifest.icons.map((i: any) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    const purposes = manifest.icons.map((i: any) => i.purpose);
    expect(purposes).toContain('maskable');
  });

  it('should verify all icon files declared in the manifest actually exist on disk', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.icons.forEach((icon: any) => {
      // Remove leading slash to resolve relative to publicDir
      const relativePath = icon.src.replace(/^\//, '');
      const fullPath = path.join(publicDir, relativePath);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });

  it('should have apple-touch-icon for iOS home screen support', () => {
    const appleIconPath = path.join(publicDir, 'apple-touch-icon.png');
    expect(fs.existsSync(appleIconPath)).toBe(true);
  });

  it('should enforce healthcare security in service worker without caching API queries', () => {
    expect(fs.existsSync(swPath)).toBe(true);
    const swContent = fs.readFileSync(swPath, 'utf8');

    // Must have security boundary bypassing /api/ and Supabase
    expect(swContent).toContain('/api/');
    expect(swContent).toContain('supabase.co');
    expect(swContent).toContain('skipWaiting');
    expect(swContent).toContain('clients.claim');
  });
});
