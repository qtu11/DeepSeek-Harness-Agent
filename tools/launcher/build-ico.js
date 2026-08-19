import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const svgPath = path.resolve('website/public/favicon.svg');
const svgRaw = fs.readFileSync(svgPath, 'utf8');

const enhancedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
  </defs>
  <!-- Rounded Base Background -->
  <rect x="16" y="16" width="480" height="480" rx="100" fill="url(#bg)" />
  
  <!-- Whale Graphic scaled & centered in white -->
  <g transform="translate(68, 68) scale(7.52)">
    ${svgRaw.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '').replace(/fill="#4D6BFE"/g, 'fill="#ffffff"')}
  </g>
</svg>
`;

const sizes = [256, 128, 64, 48, 32, 16];

async function generateIcons() {
  const winresDir = path.resolve('tools/launcher/winres');
  if (!fs.existsSync(winresDir)) fs.mkdirSync(winresDir, { recursive: true });

  const pngBuffers = [];
  for (const size of sizes) {
    const png = await sharp(Buffer.from(enhancedSvg))
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buffer: png });
    fs.writeFileSync(path.join(winresDir, `icon_${size}.png`), png);
  }

  // Also write main icon.png and icon16.png
  fs.writeFileSync(path.join(winresDir, 'icon.png'), pngBuffers[0].buffer);
  fs.writeFileSync(path.join(winresDir, 'icon16.png'), pngBuffers[5].buffer);

  // Build standard ICO
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngBuffers.length, 4);

  let currentOffset = 6 + (16 * pngBuffers.length);
  const dirEntries = [];

  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(item.size === 256 ? 0 : item.size, 0);
    entry.writeUInt8(item.size === 256 ? 0 : item.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(item.buffer.length, 8);
    entry.writeUInt32LE(currentOffset, 12);
    dirEntries.push(entry);
    currentOffset += item.buffer.length;
  }

  const icoBuffer = Buffer.concat([
    header,
    ...dirEntries,
    ...pngBuffers.map(p => p.buffer)
  ]);

  const outputIco = path.resolve('tools/launcher/deepseek.ico');
  fs.writeFileSync(outputIco, icoBuffer);
  fs.writeFileSync(path.join(winresDir, 'deepseek.ico'), icoBuffer);
  console.log('Successfully generated all icons!');
}

generateIcons().catch(console.error);
