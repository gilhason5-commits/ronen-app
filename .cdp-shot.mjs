import { chromium } from 'playwright';
const wd=setTimeout(()=>{console.log('WATCHDOG');process.exit(2);},25000);
try{
  const b=await chromium.connectOverCDP('http://localhost:9223');
  const page=b.contexts()[0].pages().find(p=>p.url().includes('supabase'))||b.contexts()[0].pages()[0];
  page.setDefaultTimeout(8000);
  console.log('URL:',page.url());
  const editors=await page.locator('.monaco-editor').count().catch(()=>0);
  console.log('monaco:',editors);
  await page.screenshot({path:'/tmp/sb-state.png'}).then(()=>console.log('shot ok')).catch(e=>console.log('shot err',e.message));
}catch(e){console.log('ERR',e.message);}
clearTimeout(wd);process.exit(0);
