import {spawn,spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {existsSync} from 'node:fs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), artifacts=path.join(root,'tests/artifacts');
await mkdir(artifacts,{recursive:true});
const php=process.env.PHP_BINARY || (process.platform==='win32'?'C:/xampp/php/php.exe':'php');
const chrome=process.env.CHROME_BIN || (process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync));
if(!chrome)throw new Error('Set CHROME_BIN to a Chrome/Chromium executable.');
const setup=spawnSync(php,['tests/fixture.php'],{cwd:root,encoding:'utf8',windowsHide:true});
if(setup.status!==0)throw new Error(setup.error?.message||setup.stderr||setup.stdout||'PHP fixture could not start.');
const fixture=JSON.parse(setup.stdout);
const server=spawn(php,['-S','127.0.0.1:8089','tools/router.php'],{cwd:root,env:{...process.env,APP_DSN:'sqlite:'+fixture.database},windowsHide:true,stdio:'ignore'});
const browser=spawn(chrome,['--headless=new',...(process.env.CI?['--no-sandbox']:[]),'--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9224','--remote-allow-origins=http://localhost:9224','--user-data-dir='+path.join(artifacts,'chrome-profile'),'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,seq=0;const pending=new Map(),errors=[];let passes=0;
function check(value,label){if(!value)throw new Error('FAIL '+label);passes++;console.log('PASS '+label);}
async function ready(url){for(let i=0;i<60;i++){try{const r=await fetch(url);if(r.ok)return await r.json();}catch{}await sleep(250);}throw new Error('Service not ready: '+url);}
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value;}
async function go(url){await cdp('Page.navigate',{url:'http://127.0.0.1:8089'+url});await until(`location.pathname+location.search===${JSON.stringify(url)} && document.readyState==='complete'`);}
async function until(expression,timeout=12000){const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await sleep(150);}throw new Error('Timed out: '+expression);}
async function screenshot(name){await evaluate(`(async()=>{const y=scrollY;for(let p=0;p<document.body.scrollHeight;p+=600){scrollTo(0,p);await new Promise(r=>setTimeout(r,60));}await Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r;setTimeout(r,1500);})));scrollTo(0,y);})()`);const s=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(artifacts,name+'.png'),Buffer.from(s.data,'base64'));}
try{
  await ready('http://127.0.0.1:9224/json/version');await ready('http://127.0.0.1:8089/api/results.php');
  const target=await (await fetch('http://127.0.0.1:9224/json/new?about:blank',{method:'PUT'})).json();
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(p){clearTimeout(p.timer);pending.delete(message.id);if(message.error)p.reject(new Error(message.error.message));else p.resolve(message.result);}}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);};
  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await go('/index.php');await until(`document.querySelectorAll('#cup-live-cards [data-game-id]').length===2`);
  check(await evaluate(`getComputedStyle(document.querySelector('label[hidden]')).display==='none'`),'honeypot is hidden from the public form');
  check(await evaluate(`document.querySelector('#cup-live-title').textContent==='Live now'`),'concurrent categories displayed as live');
  check(await evaluate(`document.querySelectorAll('#cup-ticker-track a').length===2`),'ticker includes both matches');
  check(await evaluate(`document.querySelectorAll('#cup-posters img').length===1`),'managed poster displayed');
  check(await evaluate(`document.querySelectorAll('head').length===1 && document.querySelectorAll('body').length===1`),'one document shell');
  await screenshot('home-desktop');
  await evaluate(`document.querySelector('#cup-category-filter').value='1';document.querySelector('#cup-category-filter').dispatchEvent(new Event('change'))`);
  check(await evaluate(`document.querySelectorAll('#cup-live-cards [data-game-id]').length===1`),'category filter works');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:600});
  const moving=await evaluate(`document.querySelector('#cup-ticker-track').scrollLeft`);await sleep(650);check(await evaluate(`document.querySelector('#cup-ticker-track').scrollLeft`)>moving,'ticker automatically scrolls when overflowing');
  await evaluate(`document.querySelector('#cup-ticker-pause').click()`);check(await evaluate(`document.querySelector('#cup-ticker-pause').getAttribute('aria-pressed')==='true'`),'ticker pause works');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const before=await evaluate(`document.querySelector('#cup-ticker-track').scrollLeft`);await sleep(400);check(before===await evaluate(`document.querySelector('#cup-ticker-track').scrollLeft`),'reduced motion keeps ticker stationary');
  await sleep(5100);check(before===await evaluate(`document.querySelector('#cup-ticker-track').scrollLeft`),'polling preserves ticker scroll position');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await go('/index.php');await until(`document.querySelectorAll('#cup-live-cards [data-game-id]').length===2`);
  check(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),'mobile has no horizontal page overflow');
  await evaluate(`document.querySelector('.cup-menu-toggle').click()`);check(await evaluate(`document.querySelector('.cup-nav').classList.contains('is-open')`),'mobile menu opens');await screenshot('home-mobile');
  check(await evaluate(`[...document.images].every(i=>i.complete && i.naturalWidth>0)`),'all public home images load');
  await go('/admin/');await evaluate(`document.querySelector('[name=email]').value='browser@example.test';document.querySelector('[name=password]').value='Browser-test-only-2026';document.querySelector('#login').requestSubmit()`);await until(`!!document.querySelector('[data-tab=teams]')`);
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await screenshot('admin');
  for(const resource of ['seasons','categories','competitions','teams','entries','players','rosters','venues','fields','posters','users','audit','account']){
    await evaluate(`document.querySelector('[data-tab="${resource}"]').click()`);check(await evaluate(`document.querySelector('#workspace').textContent.trim().length>0`),'admin view '+resource);
  }
  await evaluate(`document.querySelector('[data-tab=teams]').click();document.querySelector('#entity-form [name=name]').value='Created through browser';document.querySelector('#entity-form').requestSubmit()`);await until(`document.querySelector('#notice').textContent==='Registro guardado.'`);check(await evaluate(`document.querySelector('tbody').textContent.includes('Created through browser')`),'team creation persists through admin form');
  await evaluate(`document.querySelector('[data-tab=organize]').click();const s=document.querySelector('#org-select');s.value='3';s.dispatchEvent(new Event('change'));document.querySelector('#draw-form').requestSubmit()`);await until(`!!document.querySelector('#publish-draw')`);check(await evaluate(`document.querySelector('#draw-preview').textContent.includes('Grupo 2')`),'roulette previews balanced groups');
  await evaluate(`document.querySelector('#publish-draw').click()`);await until(`document.querySelector('#notice').textContent.startsWith('Sorteo publicado')`);check(true,'draw publication succeeds from admin');
  await evaluate(`document.querySelector('[data-tab=matches]').click()`);
  await evaluate(`document.querySelector('[data-match="1"]').click()`);await until(`!!document.querySelector('#goal-form')`);
  await evaluate(`document.querySelector('#goal-form').requestSubmit()`);await until(`document.querySelector('#notice').textContent==='Cambio guardado.'`);
  check(await evaluate(`document.querySelector('#live-summary').textContent.includes('1 – 0')`),'admin records goal');await screenshot('scoring');
  const security=await evaluate(`(async()=>{const r=await fetch('/admin/api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',csrf:'invalid',resource:'teams',data:{name:'Attack'}})});return r.status})()`);check(security===422,'invalid CSRF rejected');
  await go('/index.php');await until(`document.querySelector('[data-game-id="1"] [data-home-score]').textContent==='1'`);check(true,'saved goal reaches public score');
  await cdp('Network.enable');await cdp('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});await until(`!document.querySelector('#cup-stale').hidden`,9000);
  check(await evaluate(`document.querySelectorAll('#cup-live-cards [data-game-id]').length===2`),'offline retains previous matches');
  await cdp('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await until(`document.querySelector('#cup-stale').hidden`,9000);check(true,'automatic reconnection clears stale indicator');
  for(const url of ['/tournament.php?view=standings','/tournament.php?view=bracket','/tournament.php?view=scorers','/match.php?id=1','/about.php','/contact.php','/gallery.php']){await go(url);check(await evaluate(`document.querySelectorAll('head').length===1 && document.querySelectorAll('body').length===1`),'page renders '+url);}
  const protection=await evaluate(`(async()=>{const urls=['/config/example.php','/storage/cup.sqlite','/app/bootstrap.php','/.htaccess','/php/text.php'];return await Promise.all(urls.map(async u=>(await fetch(u)).status))})()`);check(protection.every(x=>x===404),'private files blocked by development router');
  const legacy=await evaluate(`(async()=>{const r=await fetch('/score/record_goal.php',{method:'POST'});return r.status})()`);check(legacy===410,'legacy unauthenticated write endpoint retired');
  await go('/admin/');await until(`!!document.querySelector('#logout')`);await evaluate(`document.querySelector('#logout').click()`);await until(`!!document.querySelector('#login') && !document.querySelector('#login button').disabled && document.readyState==='complete'`);
  await evaluate(`document.querySelector('[name=email]').value='scorer@example.test';document.querySelector('[name=password]').value='Browser-test-only-2026';document.querySelector('#login').requestSubmit()`);await until(`!!document.querySelector('[data-match]')`);
  check(await evaluate(`!document.querySelector('[data-tab=teams]') && document.querySelectorAll('[data-match]').length===1`),'scorer sees only assigned match and permitted views');
  const forged=await evaluate(`(async()=>{const r=await fetch('/admin/api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',csrf:window.CUP_ADMIN.csrf,resource:'teams',data:{name:'Forbidden'}})});return r.status})()`);check(forged===403,'server rejects forged scorer administration request');
  check(errors.length===0,'no uncaught browser JavaScript errors');
  console.log(`\n${passes} browser checks passed. Screenshots: tests/artifacts/`);
}catch(error){try{await writeFile(path.join(artifacts,'failure.html'),await evaluate('document.documentElement.outerHTML'));await screenshot('failure');}catch{}throw error;}
finally{if(ws?.readyState===1){try{await cdp('Browser.close');}catch{}ws.close();}browser.kill();server.kill();}
