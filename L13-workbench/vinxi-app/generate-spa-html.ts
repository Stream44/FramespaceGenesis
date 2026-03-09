#!/usr/bin/env bun
/**
 * Post-build script: generates a proper SPA index.html from the vite manifest.
 *
 * Vinxi with ssr:false produces a nitro server that renders the HTML shell dynamically.
 * Since ModelServer replaces nitro, we need a static index.html that loads the client bundle.
 *
 * Reads: .output/public/_build/.vite/manifest.json
 * Writes: .output/public/index.html
 */

import { resolve, dirname } from 'path'

const outputDir = resolve(dirname(import.meta.path), '.output/public')
const manifestPath = resolve(outputDir, '_build/.vite/manifest.json')

const manifest = await Bun.file(manifestPath).json()

// Find the client entry point
const clientEntry = manifest['virtual:$vinxi/handler/client']
if (!clientEntry) {
    console.error('❌ Could not find client entry in vite manifest')
    process.exit(1)
}

// Collect CSS files (entry + imported chunks)
const cssFiles: string[] = []
const jsFiles: string[] = []

// Entry CSS
if (clientEntry.css) cssFiles.push(...clientEntry.css)

// Entry JS
jsFiles.push(clientEntry.file)

// Build link/script tags
const cssLinks = cssFiles.map(f => `    <link rel="stylesheet" href="/_build/${f}">`).join('\n')
const scriptTags = jsFiles.map(f => `    <script type="module" src="/_build/${f}"></script>`).join('\n')

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Framespace Genesis</title>
    <link rel="icon" href="/favicon.ico">
${cssLinks}
</head>
<body>
    <div id="app"></div>
${scriptTags}
</body>
</html>
`

await Bun.write(resolve(outputDir, 'index.html'), html)
console.log(`✅ Generated SPA index.html with ${cssFiles.length} CSS + ${jsFiles.length} JS entries`)
