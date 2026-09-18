import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
await page.goto('https://stock-selector-deploy.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

// Look for the actual sign-in mechanism
const authInfo = await page.evaluate(() => {
  const result = {
    signInButtons: [],
    authLinks: [],
    storage: {},
    route: window.location.pathname,
    hasToken: false,
  };
  
  // Find sign-in related buttons
  document.querySelectorAll('button, a').forEach(el => {
    const text = (el.textContent || el.innerText || '').toLowerCase();
    if (text.includes('sign') || text.includes('login') || text.includes('auth')) {
      result.signInButtons.push({ text: el.textContent?.trim(), href: el.href, onclick: el.getAttribute('onclick') });
    }
  });
  
  // Check for auth state
  try {
    const tokens = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    result.hasToken = tokens.length > 0;
    result.storage.tokenLen = tokens.length;
  } catch(e) {}
  
  return result;
});

console.log('Auth info:', JSON.stringify(authInfo, null, 2));

// Also check navigation links
const navInfo = await page.evaluate(() => {
  const navs = Array.from(document.querySelectorAll('nav, [role="navigation"], header, .header, .sidebar, .sidebar-inner')).map(el => el.innerText?.slice(0, 200));
  return { navTexts: navs.filter(Boolean), navHTML: document.querySelector('nav')?.outerHTML?.slice(0, 500) || '' };
});
console.log('Nav info:', JSON.stringify(navInfo, null, 2));

await browser.close();
