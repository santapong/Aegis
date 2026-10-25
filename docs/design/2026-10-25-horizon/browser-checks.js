async (page) => {
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error' && /hydrat|<title>|did not match/i.test(m.text()))errors.push(m.text())});
  await page.setViewportSize({width:1440,height:1000});
  await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Preview service unavailable. No real data is connected.'})}));
  const publicResults=[];
  for(const path of ['/landing','/login','/register','/welcome','/docs','/docs/guides/first-steps','/docs/developers/local-setup','/demo','/changelog']){
    const r=await page.goto('http://127.0.0.1:3118'+path,{waitUntil:'networkidle',timeout:15000});
    publicResults.push({path,status:r?.status(),heading:await page.locator('h1').allTextContents(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
  }
  await page.goto('http://127.0.0.1:3118/login',{waitUntil:'networkidle'});
  await page.getByLabel('Email address').fill('preview@example.test');
  await page.getByLabel('Password',{exact:true}).fill('synthetic-preview');
  await page.getByRole('button',{name:'Show password',exact:true}).click();
  const reveal=await page.getByLabel('Password',{exact:true}).getAttribute('type');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('[role="alert"][tabindex="-1"]').waitFor();
  const signIn={reveal,error:await page.locator('[role="alert"][tabindex="-1"]').innerText(),emailPreserved:await page.getByLabel('Email address').inputValue()};
  await page.screenshot({path:'.playwright-mcp/aegis-horizon-login-desktop.png'});
  await page.goto('http://127.0.0.1:3118/register',{waitUntil:'networkidle'});
  await page.getByLabel('Your name').fill('Preview');
  await page.getByLabel('Email address').fill('preview@example.test');
  await page.locator('#register-password').fill('synthetic-preview');
  await page.getByLabel('Confirm password',{exact:true}).fill('different-preview');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  const register={mismatch:await page.locator('[role="alert"][tabindex="-1"]').innerText(),emailPreserved:await page.getByLabel('Email address').inputValue()};
  await page.addInitScript(()=>{
    if(location.origin!=='http://127.0.0.1:3118')return;
    localStorage.setItem('aegis-auth',JSON.stringify({state:{isAuthenticated:true,user:{id:'horizon-fixture',username:'Preview workspace',email:'preview@example.test',is_active:true,created_at:'2026-10-25T00:00:00Z'}},version:0}));
    if(!sessionStorage.getItem('aegis-horizon-fixture-installed')) localStorage.setItem('aegis-app-store',JSON.stringify({state:{theme:'horizon',hasSeenTour:true,sidebarOpen:true,collapsedClusters:[]},version:2}));
    sessionStorage.setItem('aegis-horizon-fixture-installed','1');
  });
  const workspaceResults=[];
  for(const path of ['/','/cashflow','/accounts','/review','/transactions','/reports','/budgets','/savings','/investments','/debts','/calendar','/gantt','/trips','/plans','/settings','/payments']){
    const r=await page.goto('http://127.0.0.1:3118'+path,{waitUntil:'networkidle',timeout:15000});
    await page.waitForTimeout(1200);
    workspaceResults.push({path,status:r?.status(),heading:await page.locator('h1').allTextContents(),theme:await page.locator('body').getAttribute('class'),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
    if(['/','/cashflow','/accounts','/settings'].includes(path))await page.screenshot({path:'.playwright-mcp/aegis-horizon-app-'+(path.slice(1)||'dashboard')+'.png'});
  }
  await page.goto('http://127.0.0.1:3118/settings',{waitUntil:'networkidle'});
  const currency=page.getByRole('combobox').first();
  await currency.selectOption('THB');
  await page.getByRole('button',{name:'Apply Meridian theme',exact:true}).click();
  const meridian=await page.locator('body').getAttribute('class');
  const retained=await currency.inputValue();
  await page.goto('http://127.0.0.1:3118/landing',{waitUntil:'networkidle'});
  const publicCanvas=await page.locator('[data-theme="horizon-landing"]').evaluate(e=>getComputedStyle(e).backgroundColor);
  await page.goto('http://127.0.0.1:3118/settings',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Apply Horizon theme',exact:true}).click();
  const themeBoundary={meridian,currencyRetained:retained,publicCanvas,horizon:await page.locator('body').getAttribute('class')};
  await page.setViewportSize({width:320,height:800});
  const narrow=[];
  for(const path of ['/landing','/docs','/demo','/cashflow','/accounts','/review','/settings','/calendar','/gantt']){
    await page.goto('http://127.0.0.1:3118'+path,{waitUntil:'networkidle',timeout:15000});
    narrow.push({path,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
    if(path==='/landing'||path==='/cashflow')await page.screenshot({path:'.playwright-mcp/aegis-horizon-'+path.slice(1)+'-320.png'});
  }
  return {publicResults,signIn,register,workspaceResults,narrow,themeBoundary,errors,scope:'Synthetic browser auth state; all API requests intercepted with 503. No real account or backend write.'};
}
