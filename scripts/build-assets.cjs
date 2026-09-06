// Rebuild website delivery assets from the screenshot pipeline's original PNGs.
// Run: node notepin-site/scripts/build-assets.cjs (from the parent NotePin folder).
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require('sharp');
const CleanCSS = require('clean-css');

const siteRoot = path.resolve(__dirname, '..');
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 12);
const escapeAttribute = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

function setAttribute(tag, name, value) {
    const pattern = new RegExp(`(\\s${name}=")[^"]*(")`);
    const escaped = escapeAttribute(value);
    return pattern.test(tag)
        ? tag.replace(pattern, (_match, before, after) => before + escaped + after)
        : tag.replace(/>$/, ` ${name}="${escaped}">`);
}

async function writeIfChanged(file, content) {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const current = await fs.readFile(file).catch(error => {
        if (error.code !== 'ENOENT') throw error;
        return null;
    });
    if (!current?.equals(bytes)) await fs.writeFile(file, bytes);
}

async function buildAssets() {
    const images = new Map();
    for (const directory of ['img/screenshots', 'img/manual']) {
        const files = (await fs.readdir(path.join(siteRoot, directory))).sort();
        for (const file of files.filter(name => name.endsWith('.png') && !name.endsWith('_thumb.png'))) {
            const source = `${directory}/${file}`;
            const original = await fs.readFile(path.join(siteRoot, source));
            const { width, height } = await sharp(original).metadata();
            const widths = [...new Set([480, 800, width].filter(size => size <= width))].sort((a, b) => a - b);
            const variants = [];
            for (const size of widths) {
                const buffer = await sharp(original)
                    .resize({ width: size, withoutEnlargement: true })
                    .webp({ quality: 85, effort: 6 })
                    .toBuffer();
                const output = `${directory}/${path.basename(file, '.png')}-${size}w-${hash(buffer)}.webp`;
                await writeIfChanged(path.join(siteRoot, output), buffer);
                variants.push({ url: output, width: size, bytes: buffer.length });
            }
            images.set(source, {
                width, height, originalBytes: original.length,
                src: variants.at(-1).url,
                srcset: variants.map(variant => `${variant.url} ${variant.width}w`).join(', '),
                variants
            });
        }
    }

    const stylesheet = await fs.readFile(path.join(siteRoot, 'style.css'), 'utf8');
    const minified = new CleanCSS({ level: 1 }).minify(stylesheet);
    if (minified.errors.length) throw new Error(minified.errors.join('\n'));
    await writeIfChanged(path.join(siteRoot, 'style.min.css'), minified.styles);
    const assetUrls = { 'style.min.css': `style.min.css?v=${hash(minified.styles)}` };
    for (const script of ['index.js', 'manual.js']) {
        assetUrls[script] = `${script}?v=${hash(await fs.readFile(path.join(siteRoot, script)))}`;
    }

    const files = (await fs.readdir(siteRoot)).filter(file => file.endsWith('.html')).sort();
    for (const file of files) {
        let html = await fs.readFile(path.join(siteRoot, file), 'utf8');
        html = html.replace(/<img\b[^>]*>/gs, tag => {
            const source = attribute(tag, 'data-image-source') || attribute(tag, 'src');
            const image = images.get(source);
            if (!image) return tag;
            // The slot never exceeds the source's natural width; the browser also
            // accounts for device pixel density when choosing a srcset candidate.
            const fullScreen = source.includes('/fullscreen_');
            const maxWidth = file === 'index.html' ? (fullScreen ? 1100 : 860) : Math.min(image.width, 836);
            const sizes = file === 'index.html'
                ? `(max-width: 1100px) calc(100vw - 50px), ${maxWidth}px`
                : `(max-width: 1000px) min(${image.width}px, calc(100vw - 48px)), (max-width: 1200px) min(${image.width}px, calc(100vw - 364px)), ${maxWidth}px`;
            for (const [name, value] of Object.entries({
                'data-image-source': source, src: image.src, srcset: image.srcset,
                sizes, width: image.width, height: image.height
            })) tag = setAttribute(tag, name, value);
            return tag;
        });
        html = html.replace(/<button\b[^>]*\bdata-previewsrc="[^\"]*"[^>]*>/gs, tag => {
            const source = attribute(tag, 'data-fullsrc');
            const image = images.get(source);
            if (!image) return tag;
            tag = setAttribute(tag, 'data-previewsrc', image.src);
            return setAttribute(tag, 'data-previewsrcset', image.srcset);
        });
        html = html.replace(/href="style(?:\.min)?\.css(?:\?[^\"]*)?"/g,
            `href="${assetUrls['style.min.css']}"`);
        for (const script of ['index.js', 'manual.js']) {
            const pattern = new RegExp(`src="${script.replace('.', '\\.')}([?][^"]*)?"`, 'g');
            html = html.replace(pattern, `src="${assetUrls[script]}"`);
        }
        await writeIfChanged(path.join(siteRoot, file), html);
    }

    const originalBytes = [...images.values()].reduce((total, image) => total + image.originalBytes, 0);
    const webpBytes = [...images.values()].reduce((total, image) => total + image.variants.at(-1).bytes, 0);
    console.log(`Website assets: ${images.size} images, ${files.length} pages; full-size images ${originalBytes} -> ${webpBytes} bytes; CSS ${Buffer.byteLength(stylesheet)} -> ${Buffer.byteLength(minified.styles)} bytes.`);
}

if (require.main === module) buildAssets().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
module.exports = { buildAssets };
