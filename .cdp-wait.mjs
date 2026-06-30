import { chromium } from 'playwright';
const wd=setTimeout(()=>{console.log('WATCHDOG');process.exit(2);},30000);
try{
  const b=await chromium.connectOverCDP('http://localhost:9223');
  const page=b.contexts()[0].pages().find(p=>p.url().includes('supabase'))||b.contexts()[0].pages()[0];
  page.setDefaultTimeout(8000);
  for(let i=0;i<6;i++){
    await page.waitForTimeout(2500);
    const url=page.url(); const m=await page.locator('.monaco-editor').count().catch(()=>0);
    console.log(`[${i}] monaco=${m} url=${url.includes('/sql/')?'SQL':url.includes('sign-in')?'SIGN-IN':url}`);
    if(m>0) break;
  }
  await page.screenshot({path:'/tmp/sb-state.png'});
  // capture any visible error toast
  const t=await page.locator('[role=alert], .toast, text=/invalid login|incorrect|captcha/i').allInnerTexts().catch(()=>[]);
  if(t.length) console.log('ALERTS:', JSON.stringify(t.slice(0,4)));
}catch(e){console.log('ERR',e.message);}
clearTimeout(wd);process.exit(0);
