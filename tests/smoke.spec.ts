import {test,expect} from '@playwright/test';
for(const width of [1440,390]){
 test(`Radar, analysis and Daily at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/Panel de acciones/})).toBeVisible();
  await expect(page.locator('.board-stock')).toHaveCount(18);
  await expect(page.locator('.board-focus-pane .ma-reading')).toHaveCount(3);
  await expect(page.locator('.board-focus-pane .ma-three-grid')).toContainText('EMA 20');
  await expect(page.locator('.board-focus-pane .ma-three-grid')).toContainText('SMA 50');
  await expect(page.locator('.board-focus-pane .ma-three-grid')).toContainText('SMA 200');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/radar-${width}.png`,fullPage:true});
  await page.locator('.board-stock').filter({hasText:'GOOGL'}).first().click();
  await expect(page.locator('.board-focus-identity h3')).toHaveText('GOOGL');
  await page.getByRole('button',{name:'Análisis',exact:true}).click();
  await expect(page.locator('.financial-chart canvas').first()).toBeVisible();
  await expect(page.locator('.ma-analysis-title')).toBeVisible();
  await expect(page.locator('.ma-analysis-title+.ma-three-grid .ma-reading')).toHaveCount(3);
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
  await expect(page.locator('.daily-v2-metrics, .daily-v2-pending')).toBeVisible();
  await expect(page.locator('.daily-article')).toHaveCount(0);
  await page.screenshot({path:`test-results/daily-${width}.png`,fullPage:true});
  expect(errors).toEqual([]);
  await expect(page.getByRole('button',{name:'Cartera',exact:true})).toHaveCount(0);
 });
}
test('retains last good snapshot on refresh and reload failure',async({page})=>{
 await page.goto('/');await expect(page.locator('.board-stock')).toHaveCount(18);
 await page.route('**/data/market.json*',route=>route.abort());
 await page.getByRole('button',{name:'Actualizar datos de mercado'}).first().click();
 await expect(page.locator('.source-warning').first()).toBeVisible();
 await expect(page.locator('.board-stock')).toHaveCount(18);
 await page.reload();await expect(page.locator('.board-stock')).toHaveCount(18);
 await expect(page.locator('.board-stock-scroll')).not.toContainText('Sin datos');
});

test('Daily shows only a Spanish compact dashboard and supports refresh',async({page})=>{
 const body='# Market Briefing\\n\\n**EN:** Markets closed higher.\\n\\n**ES:** Los mercados cerraron al alza.';
 const webBrief={
  updatedAt:'2026-10-19T07:30:00-03:00',
  metrics:[
   {label:'Riesgo país',value:'648',change:'+26 pb',asOf:'Cierre 16/10'},
   {label:'Dólar MEP',value:'$1.536,73',asOf:'19/10'},
   {label:'Dólar CCL',value:'$1.613',asOf:'19/10'},
   {label:'S&P 500',value:'7.659',asOf:'16/10'},
   {label:'Nasdaq',value:'26.140',asOf:'16/10'},
   {label:'TAMAR',value:'24,50%',asOf:'15/10'}
  ],
  highlights:[{title:'Wall Street rebota',summary:'Apertura alcista tras una rueda negativa.',tag:'Global'},
              {title:'Balances tecnológicos',summary:'Se esperan resultados importantes.',tag:'Empresas'}],
  argentina:['Inflación de septiembre: 1,9%.','Vigilar el dólar financiero.'],
  watch:['Bonos soberanos','Dólar MEP','Resultados empresariales'],
  takeaway:'El rebote inicial no confirma un nuevo movimiento alcista.'
 };
 const edition={schema:1,date:'2026-10-19',title:'LO QUE NECESITÁS SABER PARA ARRANCAR LA JORNADA',
  status:'published',generatedAt:'2026-10-19T07:30:00-03:00',bodyMarkdown:body,webBrief,
  sourceLinks:[{title:'Fuente oficial',url:'https://www.bcra.gob.ar/'}]};
 await page.route('**/data/daily.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(edition)}));
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByRole('button',{name:'Daily',exact:true}).click();
 await expect(page.locator('.daily-v2-metric')).toHaveCount(6);
 await expect(page.locator('.daily-v2-story')).toHaveCount(2);
 await expect(page.locator('.daily-v2-argentina')).toContainText('Inflación');
 await expect(page.locator('.daily-v2-outlook')).toContainText('El rebote inicial');
 await expect(page.locator('.daily-v2')).not.toContainText('Markets closed higher.');
 await expect(page.locator('.daily-article')).toHaveCount(0);
 expect(await page.locator('.daily-v2-metrics').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByText('Fuentes, horarios y metodología').click();
 await expect(page.getByRole('link',{name:'Fuente oficial'})).toBeVisible();
 await page.getByRole('button',{name:'Actualizar Daily'}).click();
 await expect(page.locator('.daily-v2-metric')).toHaveCount(6);
});

test('Daily never displays a full bilingual article without a Spanish webBrief',async({page})=>{
 const edition={schema:1,date:'2026-10-19',title:'Daily',status:'published',generatedAt:'2026-10-19T07:30:00-03:00',
  bodyMarkdown:'# Full\\n\\n**EN:** Full English article.\\n\\n**ES:** Artículo completo.',sourceLinks:[]};
 await page.route('**/data/daily.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(edition)}));
 await page.goto('/');
 await page.getByRole('button',{name:'Daily',exact:true}).click();
 await expect(page.locator('.daily-v2-pending')).toBeVisible();
 await expect(page.locator('.daily-v2')).not.toContainText('Full English article');
});
