import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 },
});

async function capturePage(url, name) {
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(30000);
    console.log(`\n=== Capturing: ${name} (${url}) ===`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 6000));

    // Get comprehensive visual information
    const report = await page.evaluate(() => {
      const result = {
        url: window.location.href,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        bodyClass: document.body.className,
      };

      // Get all visible elements with their computed styles
      result.elements = [];
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const style = window.getComputedStyle(el);
          const display = style.display;
          const visibility = style.visibility;
          if (display === 'none' || visibility === 'hidden') return;
          if (rect.width < 5 || rect.height < 5) return;
          
          const text = (el.innerText || '').trim();
          if (!text && el.tagName !== 'DIV' && el.tagName !== 'SPAN' && el.tagName !== 'SECTION') return;
          
          result.elements.push({
            tag: el.tagName,
            className: (el.className || '').toString().slice(0, 80),
            text: text.slice(0, 200),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            color: style.color,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
          });
        }
      });

      // Get key sections
      result.sections = [];
      document.querySelectorAll('section, header, nav, footer, main, aside').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 50) {
          result.sections.push({
            tag: el.tagName,
            className: (el.className || '').toString().slice(0, 100),
            text: (el.innerText || '').trim().slice(0, 300),
          });
        }
      });

      // Get images
      result.images = Array.from(document.querySelectorAll('img, svg[role="img"]')).map(el => ({
        src: el.src || el.getAttribute('src') || '',
        alt: el.alt || '',
        width: el.width,
        height: el.height,
      }));

      // Get CSS variables
      result.cssVars = {};
      const styles = getComputedStyle(document.documentElement);
      ['--accent-brand', '--text-primary', '--text-secondary', '--elevated-2', '--border-default', '--bg-base'].forEach(v => {
        result.cssVars[v] = styles.getPropertyValue(v).trim();
      });

      // Get fonts
      result.fonts = Array.from(document.querySelectorAll('*')).reduce((acc, el) => {
        const f = window.getComputedStyle(el).fontFamily;
        if (f && !acc[f]) acc[f] = true;
        return acc;
      }, {});

      return result;
    });

    // Print structured report
    console.log('URL:', report.url);
    console.log('Title:', report.title);
    console.log('Viewport:', report.viewport.width + 'x' + report.viewport.height);
    console.log('Page scroll:', report.scrollWidth + 'x' + report.scrollHeight);
    console.log('CSS Variables:', JSON.stringify(report.cssVars));
    console.log('Fonts:', Object.keys(report.fonts).slice(0, 5).join(', '));
    console.log('Visible elements:', report.elements.length);
    console.log('Sections:', report.sections.length);
    console.log('Images:', report.images.length);

    console.log('\n--- TOP-LEVEL LAYOUT ---');
    report.sections.forEach((s, i) => {
      console.log(`${i+1}. ${s.tag}: ${s.text.slice(0, 150)}`);
    });

    // Print key UI elements (buttons, inputs, links, headings)
    console.log('\n--- KEY UI ELEMENTS ---');
    report.elements.forEach(el => {
      const tag = el.tag;
      const isImportant = ['H1','H2','H3','H4','BUTTON','INPUT','A','LABEL','SELECT'].includes(tag) ||
                          el.text.includes('Sign') || el.text.includes('Login') ||
                          el.text.includes('Save') || el.text.includes('Submit') ||
                          el.className.includes('button') || el.className.includes('btn');
      if (isImportant && el.text) {
        console.log(`  ${tag}.${el.className}: "${el.text}" @ ${el.x},${el.y} (${el.width}x${el.height})`);
      }
    });

    await page.screenshot({ path: `C:/Code/VS_Workspace/stock-selector/vision-${name}.png`, fullPage: true });
    console.log('Screenshot saved: vision-' + name + '.png');
    await page.close();
    return report;
  } catch (e) {
    console.error('Error:', e.message);
    return null;
  }
}

(async () => {
  await capturePage('https://stock-selector-deploy.vercel.app/', 'home');
  await browser.close();
  console.log('\nDone');
})();
