// Run against the production preview with an isolated browser and mocked auth.
// This checks the client contract; it does not authenticate a real account.
const { chromium } = require(process.env.AEGIS_PLAYWRIGHT_PATH || '/home/santapong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const out = __dirname;
const base = process.env.AEGIS_PREVIEW_URL || 'http://127.0.0.1:3098';
const checks = [];
let browser;
function check(name, ok, detail) { checks.push({name, passed: !!ok, detail}); if (!ok) throw new Error(name + ': ' + JSON.stringify(detail)); }
(async () => {
  browser = await chromium.launch({executablePath: process.env.AEGIS_BROWSER_PATH || '/usr/bin/brave-browser', headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let mode = '401';
  let loginCount = 0;
  let submitted;
  let release;
  await context.route('**/api/**', async route => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/api/auth/login') {
      loginCount++;
      submitted = {method: route.request().method(), data: route.request().postDataJSON()};
      if (mode === 'pending') await new Promise(resolve => { release = resolve; });
      if (mode === 'network') return route.abort('connectionfailed');
      if (mode === 'success' || mode === 'session') return route.fulfill({status:200, json:{access_token:'synthetic-test-token-do-not-store', token_type:'bearer'}});
      const status = mode === 'pending' ? 401 : Number(mode);
      return route.fulfill({status, json:{detail: status === 422 ? [{msg:'synthetic validation error'}] : 'Synthetic server error'}});
    }
    if (p === '/api/auth/me') return route.fulfill({status:mode==='session'?401:200, json:mode==='session'?{detail:'Session expired'}:{id:'synthetic-local-test', email:'ui-test@example.invalid', username:'UI test', is_active:true, created_at:'2026-09-28T00:00:00Z', onboarded_at:'2026-09-28T00:00:00Z'}});
    if (p === '/api/auth/logout') return route.fulfill({status:204});
    // Never forward test requests to a real backend.
    return route.fulfill({status:503, json:{detail:'Backend outside frontend test scope'}});
  });
  await page.goto(base+'/login', {waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
  check('Page title and one h1', await page.title()==='Sign in — Aegis' && await page.locator('h1').count()===1);
  check('No fabricated claims or recovery link', !(await page.locator('body').innerText()).match(/2\.4%|Anya K\.|last sync|forgot\?/));
  check('Google not offered when unconfigured', await page.locator('script[src*="accounts.google.com/gsi"]').count()===0);
  for(const width of [320,390,768,1024,1440,1920]) {
    await page.setViewportSize({width,height:width<500?844:900});
    const sizes = await page.evaluate(() => ({width:innerWidth, scroll:document.documentElement.scrollWidth, overflow:[...document.querySelectorAll('h1,h2,label,input,button')].filter(e=>e.getBoundingClientRect().height && e.scrollWidth>e.clientWidth+1).map(e=>e.textContent), small:[...document.querySelectorAll('a,button,input')].filter(e=>{const r=e.getBoundingClientRect(); return r.height && (r.width<44||r.height<44)}).map(e=>e.textContent||e.getAttribute('aria-label'))}));
    check(`Layout ${width}`, sizes.width>=sizes.scroll && !sizes.overflow.length, sizes);
    check(`44px controls ${width}`, !sizes.small.length, sizes.small);
    check(`Form first on compact view ${width}`, width>850 || !(await page.locator('aside').isVisible()));
    await page.screenshot({path:path.join(out,`viewport-${width}.png`),fullPage:true});
  }
  check('Autofill hints', await page.locator('#email').getAttribute('autocomplete')==='username' && await page.locator('#password').getAttribute('autocomplete')==='current-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  check('Empty form stays local', loginCount===0 && await page.locator('#email').evaluate(e=>document.activeElement===e));
  await page.locator('#email').fill('bad-address');
  await page.locator('#password').fill('synthetic-only');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  check('Malformed email stays local', loginCount===0 && await page.locator('#email').evaluate(e=>e.validity.typeMismatch));
  await page.locator('#email').fill('ui-test@example.invalid');
  await page.getByRole('button',{name:'Show password'}).click();
  check('Reveal preserves input', await page.locator('#password').getAttribute('type')==='text' && await page.locator('#password').inputValue()==='synthetic-only');
  await page.getByRole('button',{name:'Hide password'}).press('Enter');
  check('Keyboard hides password', await page.locator('#password').getAttribute('type')==='password');
  await page.locator('#email').focus(); await page.keyboard.press('Tab');
  check('Keyboard email to password', await page.locator('#password').evaluate(e=>document.activeElement===e));
  await page.keyboard.press('Tab');
  check('Keyboard password to reveal', await page.getByRole('button',{name:'Show password'}).evaluate(e=>document.activeElement===e));
  await page.keyboard.press('Tab');
  check('Visible keyboard focus on submit', await page.getByRole('button',{name:'Sign in',exact:true}).evaluate(e=>document.activeElement===e && getComputedStyle(e).outlineStyle!=='none'));
  mode='pending';
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'Signing in…',exact:true}).waitFor();
  check('Pending disables fields and announces progress', await page.locator('#email').isDisabled() && await page.locator('#password').isDisabled() && await page.getByRole('button',{name:'Signing in…',exact:true}).isDisabled() && await page.getByRole('status').innerText()==='Signing in. Please wait.');
  check('One POST with credentials in body', loginCount===1 && submitted.method==='POST' && submitted.data.email==='ui-test@example.invalid' && submitted.data.password==='synthetic-only' && !page.url().includes('synthetic'));
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'loading.png'),fullPage:true});
  release();
  await page.getByRole('alert').filter({hasText:'don’t match'}).waitFor();
  check('Error announces and receives focus', await page.locator('#sign-in-error').evaluate(e=>document.activeElement===e));
  check('Error retains input and permits retry', await page.locator('#email').inputValue()==='ui-test@example.invalid' && await page.locator('#password').inputValue()==='synthetic-only' && await page.getByRole('button',{name:'Sign in',exact:true}).isEnabled());
  await page.screenshot({path:path.join(out,'invalid-credentials.png'),fullPage:true});
  for(const [next, text] of [['429','Too many attempts'],['503','couldn’t reach sign-in'],['422','couldn’t sign you in'],['network','Check your connection'],['session','couldn’t confirm your session']]) {
    mode=next; await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.locator('#sign-in-error').filter({hasText:text}).waitFor();
    check('Recoverable '+next+' error', await page.getByRole('button',{name:'Sign in',exact:true}).isEnabled());
  }
  check('No client exceptions through errors', errors.length===0, errors);
  for(const [name, url] of [['Back to home','/landing'],['Create an account','/register'],['Documentation','/docs']]) {
    await page.getByRole('link',{name,exact:true}).click(); await page.waitForURL(base+url);
    check('Destination '+url, (await page.locator('body').innerText()).trim().length>30);
    await page.goto(base+'/login',{waitUntil:'networkidle'});
  }
  // Synthetic success verifies only the existing frontend handoff and store.
  mode='success';
  await page.locator('#email').fill('ui-test@example.invalid'); await page.locator('#password').fill('synthetic-only');
  await page.getByRole('button',{name:'Sign in',exact:true}).click(); await page.waitForURL(base+'/');
  const auth = await page.evaluate(()=>localStorage.getItem('aegis-auth'));
  check('Success redirects and sets user without token/password storage', JSON.parse(auth).state.isAuthenticated===true && !auth.includes('synthetic-test-token') && !auth.includes('synthetic-only') && !Object.hasOwn(JSON.parse(auth).state,'token'));
  await context.close();
  const noJS = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  await noJS.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const plain = await noJS.newPage(); await plain.goto(base+'/login',{waitUntil:'networkidle'});
  check('No JS visible fallback', await plain.locator('h1').isVisible() && await plain.locator('noscript p').isVisible() && (await plain.locator('noscript p').innerText()).includes('Enable JavaScript to sign in.'));
  check('No JS disables credential submission', await plain.locator('#email').isDisabled() && await plain.getByRole('button',{name:'Sign in',exact:true}).isDisabled());
  await plain.screenshot({path:path.join(out,'no-javascript.png'),fullPage:true}); await noJS.close();
  const clean = await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const final = await clean.newPage(); await final.goto(base+'/login',{waitUntil:'networkidle'});
  check('No canvas or decorative motion', await final.locator('canvas').count()===0 && await final.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)===0);
  await final.locator('img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));
  check('Brand image decoded', await final.locator('img').evaluateAll(es=>es.every(e=>e.complete && e.naturalWidth>0)));
  await final.screenshot({path:path.join(out,'desktop-final.png'),fullPage:true});
  await clean.close();
  fs.writeFileSync(path.join(out,'checks.json'), JSON.stringify({date:'2026-09-28',browser:await browser.version(),mode:'isolated headless Chromium; mocked auth responses; no real account',checks},null,2));
  console.log(`${checks.length} checks passed`);
  await browser.close();
})().catch(async e=>{fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,error:e.message},null,2));console.error(e);await browser?.close();process.exit(1)});
