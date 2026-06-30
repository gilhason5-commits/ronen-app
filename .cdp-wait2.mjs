import { chromium } from 'playwright';
const wd=setTimeout(()=>{process.exit(2);},25000);
const b=await chromium.connectOverCDP('http://localhost:9223');
const page=b.contexts()[0].pages().find(p=>p.url().includes('/sql/'));
for(let i=0;i<6;i++){
  await page.waitForTimeout(2500);
  const running=await page.locator('text=Running...').count().catch(()=>0);
  if(!running){ break; }
}
await page.screenshot({path:'/tmp/sb-state.png'});
console.log('done');
clearTimeout(wd);process.exit(0);
