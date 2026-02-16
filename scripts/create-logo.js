const sharp = require('sharp');

const width = 800;
const height = 200;

const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width/2}" y="75" font-size="72" fill="white" text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif" font-weight="bold" letter-spacing="12">MATTHEWS</text>
  <text x="${width/2 + 265}" y="45" font-size="16" fill="white"
    font-family="Arial, Helvetica, sans-serif">&#8482;</text>
  <line x1="${width/2 - 280}" y1="95" x2="${width/2 + 280}" y2="95" stroke="white" stroke-width="1.5"/>
  <text x="${width/2}" y="135" font-size="20" fill="white" text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif" font-weight="300" letter-spacing="6">REAL ESTATE INVESTMENT SERVICES</text>
</svg>`;

sharp(Buffer.from(svg))
  .resize(800, 200)
  .png()
  .toFile('public/logo.png')
  .then(() => {
    console.log('Logo created at public/logo.png');
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
