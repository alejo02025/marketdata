import {test,expect} from '@playwright/test';
for(const width of [1440,390]){
 test(`Radar, analysis and Daily at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Radar',exact:true})).toBeVisible();
  await expect(page.locator('.simple-table tbody tr')).toHaveCount(18);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/radar-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Análisis',exact:true}).click();
  await expect(page.locator('.financial-chart canvas').first()).toBeVisible();
  for(const frame of ['1W','1M','1D']){
   await page.locator('.simple-time-group').first().getByRole('button',{name:frame,exact:true}).click();
   await expect(page.getByRole('img',{name:new RegExp('Velas '+frame)})).toBeVisible();
  }
  for(const range of ['1M','3M','6M','1A','3A','5A','MAX']){
   await page.locator('.simple-range-group').getByRole('button',{name:range,exact:true}).click();
   await expect(page.locator('.simple-range-group').getByRole('button',{name:range,exact:true})).toHaveAttribute('aria-pressed','true');
  }
  await page.getByLabel('Activo seleccionado').selectOption('JPM');
  await expect(page.locator('.simple-asset-quote')).toContainText('JPM');
  await page.screenshot({path:`test-results/analysis-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Daily',exact:true}).click();
  await expect(page.getByRole('heading',{name:/Market Daily/})).toBeVisible();
  await expect(page.locator('.daily-pending, .daily-article')).toBeVisible();
  await page.screenshot({path:`test-results/daily-${width}.png`,fullPage:true});
  expect(errors).toEqual([]);
  await expect(page.getByRole('button',{name:'Cartera',exact:true})).toHaveCount(0);
 });
}
test('retains last good snapshot on refresh and reload failure',async({page})=>{
 await page.goto('/');await expect(page.locator('.simple-table tbody tr')).toHaveCount(18);
 await page.route('**/data/market.json*',route=>route.abort());
 await page.getByRole('button',{name:'Actualizar datos'}).first().click();
 await expect(page.locator('.source-warning').first()).toBeVisible();
 await expect(page.locator('.simple-table tbody tr')).toHaveCount(18);
 await page.reload();await expect(page.locator('.simple-table tbody tr')).toHaveCount(18);
 await expect(page.locator('.simple-table tbody')).not.toContainText('Sin datos');
});
