import { chromium } from 'playwright';
const wd=setTimeout(()=>{process.exit(2);},20000);
const b=await chromium.connectOverCDP('http://localhost:9223');
const page=b.contexts()[0].pages().find(p=>p.url().includes('/sql/'));
await page.waitForTimeout(1500);
await page.screenshot({path:'/tmp/sb-state.png'});
console.log('ok');
clearTimeout(wd);process.exit(0);
