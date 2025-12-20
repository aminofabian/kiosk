import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join } from 'path';

const sizes = [192, 512];
const themeColor = '#4bee2b';

async function generateIcon(size) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4bee2b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#10b981;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.2}"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.6}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">🛒</text>
    </svg>
  `;

  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return pngBuffer;
}

async function main() {
  const publicDir = join(process.cwd(), 'public');
  
  for (const size of sizes) {
    try {
      const icon = await generateIcon(size);
      const filename = `icon-${size}.png`;
      const filepath = join(publicDir, filename);
      writeFileSync(filepath, icon);
      console.log(`✓ Generated ${filename}`);
    } catch (error) {
      console.error(`✗ Failed to generate icon-${size}.png:`, error.message);
    }
  }
}

main().catch(console.error);
