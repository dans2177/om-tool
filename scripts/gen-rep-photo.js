const sharp = require('sharp');
const fs = require('fs');

async function main() {
  const text = '<span font_weight="bold" font="48" foreground="white">Representative Rendering</span>';

  const textImg = await sharp({
    text: { text, font: 'Helvetica', rgba: true, dpi: 144 },
  }).png().toBuffer();

  const meta = await sharp(textImg).metadata();
  console.log('Text image size:', meta.width, 'x', meta.height);

  const shadowTinted = await sharp(
    await sharp({
      text: { text, font: 'Helvetica', rgba: true, dpi: 144 },
    }).png().toBuffer()
  ).ensureAlpha().tint({ r: 0, g: 0, b: 0 }).png().toBuffer();

  const mainTinted = await sharp(textImg)
    .ensureAlpha()
    .tint({ r: 255, g: 255, b: 255 })
    .png()
    .toBuffer();

  const padding = 24;
  const canvasW = meta.width + padding * 2 + 2;
  const canvasH = meta.height + padding * 2 + 2;

  const final = await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: shadowTinted, left: padding + 2, top: padding + 2 },
      { input: mainTinted, left: padding, top: padding },
    ])
    .png()
    .toBuffer();

  fs.writeFileSync('public/rep-rendering.png', final);
  const finalMeta = await sharp(final).metadata();
  console.log('Final PNG:', finalMeta.width, 'x', finalMeta.height, '- saved to public/rep-rendering.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
