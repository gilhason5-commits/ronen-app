import { chromium } from 'playwright';
const wd=setTimeout(()=>{console.log('WATCHDOG');process.exit(2);},40000);
const SQL = process.argv[2];
try{
  const b=await chromium.connectOverCDP('http://localhost:9223');
  const page=b.contexts()[0].pages().find(p=>p.url().includes('/sql/'));
  page.setDefaultTimeout(10000);
  await page.locator('.monaco-editor').first().click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(SQL);
  await page.waitForTimeout(400);
  await page.keyboard.press('Meta+Enter');
  await page.waitForTimeout(3500);
  // handle confirm modal for writes
  const confirm = page.getByRole('dialog').getByRole('button',{name:/^Run/});
  if(await confirm.count().catch(()=>0)){ console.log('confirm->run'); await confirm.first().click().catch(()=>{}); await page.waitForTimeout(2500); }
  await page.screenshot({path:'/tmp/sb-state.png'});
  const body=await page.locator('body').innerText().catch(()=> '');
  const lines=body.split('\n').map(s=>s.trim()).filter(Boolean);
  const idx=lines.findIndex(l=>/Results|Success|rows|error/i.test(l));
  console.log('TAIL:', JSON.stringify(lines.slice(Math.max(0,idx-1), idx+25)));
}catch(e){console.log('ERR',e.message);}
clearTimeout(wd);process.exit(0);
