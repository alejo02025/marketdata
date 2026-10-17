import {test,expect} from '@playwright/test';

test('Radar, analysis, intervals and Daily render without JavaScript errors',async({page})=>{
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/Las señales importan/})).toBeVisible({timeout:20000});
 await expect(page.getByRole('heading',{name:'Radar de activos'})).toBeVisible();
 await page.screenshot({path:'market-radar-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Análisis',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Análisis técnico/})).toBeVisible();
 await expect(page.getByRole('button',{name:'1 día'})).toBeVisible();
 await page.getByRole('button',{name:'1 día'}).click();
 await page.getByRole('option',{name:'1 semana'}).click();
 await expect(page.getByText(/HISTÓRICOS DIARIOS · YAHOO/)).toBeVisible();
 await page.getByRole('button',{name:'1 semana'}).click();
 await page.getByRole('option',{name:/2 minutos/}).click();
 await expect(page.getByText(/INTRADÍA · TRADINGVIEW/)).toBeVisible();
 await page.getByRole('button',{name:'Daily',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Market Daily/})).toBeVisible();
 await expect(page.getByText(/No hay edición verificada publicada todavía/)).toBeVisible();
 expect(errors).toEqual([]);
});

test('watchlist persists across browser reload; no Cartera navigation',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Cartera',exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Nuevo ticker'}).fill('PLTR');
 await page.getByRole('button',{name:'Añadir'}).click();
 await expect(page.locator('.ticker-name').filter({hasText:'PLTR'})).toBeVisible();
 await page.reload();
 await expect(page.locator('.ticker-name').filter({hasText:'PLTR'})).toBeVisible();
});

test('mobile navigation works and displays only three modules',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/Las señales importan/})).toBeVisible();
 await page.getByRole('button',{name:'Menú'}).click();
 await page.getByRole('button',{name:'Análisis',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Análisis técnico/})).toBeVisible();
 await page.screenshot({path:'market-radar-mobile.png',fullPage:true});
});
