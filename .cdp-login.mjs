import { chromium } from 'playwright';
const wd=setTimeout(()=>{console.log('WATCHDOG');process.exit(2);},45000);
try{
  const b=await chromium.connectOverCDP('http://localhost:9223');
  const page=b.contexts()[0].pages().find(p=>p.url().includes('supabase'))||b.contexts()[0].pages()[0];
  page.setDefaultTimeout(10000);
  const email=page.locator('input[type=email], input[name=email]').first();
  const val=await email.inputValue().catch(()=>'');
  console.log('email current:', JSON.stringify(val));
  if(!val){ await email.fill('gilhason5@gmail.com'); console.log('filled email'); }
  await page.getByRole('button',{name:/^Sign in$/}).click();
  console.log('clicked sign in');
  // wait for editor or error
  await page.waitForURL(/\/sql\//,{timeout:20000}).then(()=>console.log('navigated to sql')).catch(()=>console.log('no sql nav'));
  await page.waitForTimeout(2500);
  console.log('URL:',page.url());
  console.log('monaco:', await page.locator('.monaco-editor').count().catch(()=>0));
  const err=await page.locator('text=/invalid|incorrect|wrong|error/i').first().innerText().catch(()=>'');
  if(err) console.log('PAGE ERR TEXT:', err);
  await page.screenshot({path:'/tmp/sb-state.png'});
}catch(e){console.log('ERR',e.message);}
clearTimeout(wd);process.exit(0);
