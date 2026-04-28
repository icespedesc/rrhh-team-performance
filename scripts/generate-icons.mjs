import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const sourceSvg = join(projectRoot, 'assets', 'icons', 'icon-master.svg');
const outputRoot = join(projectRoot, 'assets', 'icons', 'generated');
const pngRoot = join(outputRoot, 'png');
const iconsetRoot = join(outputRoot, 'icon.iconset');

const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const iconsetEntries = [
  { fileName: 'icon_16x16.png', size: 16 },
  { fileName: 'icon_16x16@2x.png', size: 32 },
  { fileName: 'icon_32x32.png', size: 32 },
  { fileName: 'icon_32x32@2x.png', size: 64 },
  { fileName: 'icon_128x128.png', size: 128 },
  { fileName: 'icon_128x128@2x.png', size: 256 },
  { fileName: 'icon_256x256.png', size: 256 },
  { fileName: 'icon_256x256@2x.png', size: 512 },
  { fileName: 'icon_512x512.png', size: 512 },
  { fileName: 'icon_512x512@2x.png', size: 1024 }
];

async function ensureCleanDirectory(path) {
  await rm(path, { recursive: true, force: true });
  await mkdir(path, { recursive: true });
}

async function renderPng(size, targetPath) {
  await sharp(sourceSvg)
    .resize(size, size)
    .png()
    .toFile(targetPath);
}

async function generatePngs() {
  await ensureCleanDirectory(pngRoot);

  for (const size of pngSizes) {
    await renderPng(size, join(pngRoot, `${size}x${size}.png`));
  }
}

async function generateIco() {
  const icoBuffer = await pngToIco([
    join(pngRoot, '16x16.png'),
    join(pngRoot, '32x32.png'),
    join(pngRoot, '48x48.png'),
    join(pngRoot, '64x64.png'),
    join(pngRoot, '128x128.png'),
    join(pngRoot, '256x256.png')
  ]);

  await writeFile(join(outputRoot, 'icon.ico'), icoBuffer);
}

async function generateIcns() {
  await ensureCleanDirectory(iconsetRoot);

  for (const entry of iconsetEntries) {
    await renderPng(entry.size, join(iconsetRoot, entry.fileName));
  }

  const iconutil = spawnSync('iconutil', ['-c', 'icns', iconsetRoot, '-o', join(outputRoot, 'icon.icns')], {
    stdio: 'inherit'
  });

  if (iconutil.status !== 0) {
    throw new Error('iconutil failed while generating assets/icons/generated/icon.icns');
  }
}

async function main() {
  await ensureCleanDirectory(outputRoot);
  await generatePngs();
  await generateIco();

  if (process.platform === 'darwin') {
    await generateIcns();
  } else {
    console.warn('Skipping ICNS generation because iconutil is only available on macOS.');
  }

  console.log('Icons generated in assets/icons/generated');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});