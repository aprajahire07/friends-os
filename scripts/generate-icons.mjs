import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateIcons() {
  const iconSvg = fs.readFileSync(path.join(process.cwd(), 'public/icons/icon.svg'));
  const maskableSvg = fs.readFileSync(path.join(process.cwd(), 'public/icons/icon-maskable.svg'));

  await sharp(iconSvg).resize(192, 192).png().toFile('public/icons/icon-192.png');
  console.log('✓ Generated icon-192.png');

  await sharp(iconSvg).resize(512, 512).png().toFile('public/icons/icon-512.png');
  console.log('✓ Generated icon-512.png');

  await sharp(iconSvg).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
  console.log('✓ Generated apple-touch-icon.png');

  await sharp(iconSvg).resize(64, 64).png().toFile('public/favicon.png');
  console.log('✓ Generated favicon.png');

  await sharp(maskableSvg).resize(192, 192).png().toFile('public/icons/icon-maskable-192.png');
  console.log('✓ Generated icon-maskable-192.png');

  await sharp(maskableSvg).resize(512, 512).png().toFile('public/icons/icon-maskable-512.png');
  console.log('✓ Generated icon-maskable-512.png');

  fs.copyFileSync('public/icons/icon.svg', 'public/favicon.svg');
  console.log('✓ Copied favicon.svg');
}

generateIcons().catch(err => {
  console.error(err);
  process.exit(1);
});
