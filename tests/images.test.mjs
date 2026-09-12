import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('catalog images render as original assets without an image-service binding', async () => {
  const dir=await mkdtemp(join(tmpdir(),'flower-images-'));
  try {
    const out=join(dir,'images.mjs');
    await build({entryPoints:[resolve('components/shop-image.tsx')],outfile:out,bundle:true,platform:'node',format:'esm',external:['react','react/jsx-runtime'],jsx:'automatic',alias:{'next/image':resolve('node_modules/vinext/dist/shims/image.js')},logLevel:'silent'});
    // Keep React shared with this renderer when importing a temporary bundle.
    const bundled=await readFile(out,'utf8');
    const {writeFile}=await import('node:fs/promises');
    await writeFile(out,bundled.replace(/from "react"/g,`from ${JSON.stringify(pathToFileURL(resolve('node_modules/react/index.js')).href)}`).replace(/from "react\/jsx-runtime"/g,`from ${JSON.stringify(pathToFileURL(resolve('node_modules/react/jsx-runtime.js')).href)}`));
    const {default:Image}=await import(pathToFileURL(out));
    for(const src of ['/products/lilac-roses.webp','/brand/logo-watercolor.webp','/api/media?key=products/photo.webp']) {
      const html=renderToStaticMarkup(React.createElement(Image,{src,alt:'Букет',width:300,height:300}));
      assert.ok(html.includes(`src="${src}"`),html);
      assert.doesNotMatch(html,/_vinext\/image|_next\/image/);
    }
    const helper=join(dir,'source.mjs');
    await build({entryPoints:[resolve('lib/image-source.ts')],outfile:helper,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
    const {localImageSource}=await import(pathToFileURL(helper));
    assert.equal(localImageSource('/products/lilac-roses.webp'),'/products/lilac-roses.webp');
    assert.equal(localImageSource('/api/media?key=products/photo.webp'),'/api/media?key=products/photo.webp');
    for(const src of ['https://evil.test/image.webp','//evil.test/image.webp','/api/admin/data','/products/../../api/admin/data',null]) assert.equal(localImageSource(src),null);
  } finally {await rm(dir,{recursive:true,force:true});}
});
