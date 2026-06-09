const { chromium } = require('playwright');
const path = require('path');

const iconHtml = (size) => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${size}px;
    height: ${size}px;
    background: #f4f1ec;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .m {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: ${Math.round(size * 0.78)}px;
    font-weight: 400;
    color: #1c1917;
    line-height: 1;
    /* nudge baseline up slightly to center optically */
    padding-bottom: ${Math.round(size * 0.04)}px;
  }
</style>
</head>
<body><span class="m">M</span></body>
</html>`;

async function generate() {
  const browser = await chromium.launch();
  const sizes = [
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon-32x32.png',    size: 32  },
  ];

  for (const { name, size } of sizes) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(iconHtml(size), { waitUntil: 'networkidle' });
    const outPath = path.join(__dirname, '..', 'public', name);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(`Generated ${outPath}`);
  }

  await browser.close();
}

generate().catch((err) => { console.error(err); process.exit(1); });
