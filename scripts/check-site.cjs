// Static regression checks. Run from the parent: node notepin-site/scripts/check-site.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require('sharp');
const CleanCSS = require('clean-css');

const root = path.resolve(__dirname, '..');
const origin = 'https://notepin.cloud';
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 12);

async function check() {
    const pages = (await fs.readdir(root)).filter(file => file.endsWith('.html')).sort();
    const titles = new Set();
    const canonicalUrls = new Set();
    const minified = new CleanCSS({ level: 1 }).minify(await fs.readFile(path.join(root, 'style.css'), 'utf8'));
    assert.deepEqual(minified.errors, []);
    assert.equal(await fs.readFile(path.join(root, 'style.min.css'), 'utf8'), minified.styles, 'Rebuild the stylesheet');
    let imageCount = 0;
    let schemaCount = 0;
    for (const page of pages) {
        const html = await fs.readFile(path.join(root, page), 'utf8');
        const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
        assert(title && !titles.has(title), `${page}: missing or duplicate title`);
        titles.add(title);
        assert.equal((html.match(/<h1\b/g) || []).length, 1, `${page}: expected one h1`);
        assert(!/<meta\b[^>]*content="[^"]*noindex/i.test(html), `${page}: unexpected noindex`);
        const canonical = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)];
        assert.equal(canonical.length, 1, `${page}: expected one canonical`);
        const expected = `${origin}/${page === 'index.html' ? '' : page}`;
        assert.equal(attr(canonical[0][0], 'href'), expected, `${page}: wrong canonical`);
        canonicalUrls.add(expected);
        assert(html.includes(`href="style.min.css?v=${hash(minified.styles)}"`), `${page}: stale CSS version`);
        for (const script of ['index.js', 'manual.js']) {
            if (html.includes(`src="${script}`)) {
                const bytes = await fs.readFile(path.join(root, script));
                assert(html.includes(`src="${script}?v=${hash(bytes)}"`), `${page}: stale ${script}`);
            }
        }
        for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
            JSON.parse(match[1]);
            schemaCount++;
        }
        for (const match of html.matchAll(/<(?:a|link|script|img|button)\b[^>]*>/g)) {
            const tag = match[0];
            for (const name of ['href', 'src', 'data-fullsrc', 'data-previewsrc']) {
                const value = attr(tag, name);
                if (!value || /^(?:[a-z]+:|\/\/)/i.test(value)) continue;
                const url = new URL(value.replace(/&amp;/g, '&'), `${origin}/${page}`);
                const file = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
                await fs.access(path.join(root, file));
                if (url.hash && file.endsWith('.html')) {
                    const target = await fs.readFile(path.join(root, file), 'utf8');
                    assert(target.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `${page}: broken anchor ${value}`);
                }
            }
            for (const name of ['srcset', 'data-previewsrcset']) {
                const value = attr(tag, name);
                if (!value) continue;
                for (const candidate of value.split(',')) {
                    const [file, width] = candidate.trim().split(/\s+/);
                    const info = await sharp(path.join(root, file)).metadata();
                    assert.equal(`${info.width}w`, width, `${page}: wrong srcset width`);
                }
            }
            const source = attr(tag, 'data-image-source');
            if (tag.startsWith('<img') && source) {
                const info = await sharp(path.join(root, source)).metadata();
                assert.equal(Number(attr(tag, 'width')), info.width, `${page}: wrong image width`);
                assert.equal(Number(attr(tag, 'height')), info.height, `${page}: wrong image height`);
                assert(attr(tag, 'src').endsWith('.webp'), `${page}: missing WebP preview`);
                assert(attr(tag, 'sizes') && attr(tag, 'srcset') && attr(tag, 'alt'), `${page}: incomplete responsive image`);
                imageCount++;
            }
        }
    }
    const sitemap = await fs.readFile(path.join(root, 'sitemap.xml'), 'utf8');
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    assert.equal(new Set(locations).size, locations.length, 'Duplicate sitemap URLs');
    assert.deepEqual(new Set(locations), canonicalUrls, 'Sitemap must match canonical pages');
    const robots = await fs.readFile(path.join(root, 'robots.txt'), 'utf8');
    assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`), 'Incorrect sitemap in robots.txt');
    assert(!/^Disallow:\s*\/\s*$/mi.test(robots), 'Unexpected sitewide crawl block');
    console.log(`PASS: ${pages.length} pages, ${imageCount} responsive images, ${schemaCount} JSON-LD blocks; links, dimensions, asset versions, canonicals, sitemap and robots.txt checked.`);
}

check().catch(error => { console.error(error); process.exitCode = 1; });
