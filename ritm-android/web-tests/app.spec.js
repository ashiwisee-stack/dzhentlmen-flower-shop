const {test,expect}=require('@playwright/test');
const C=require('../app/src/main/assets/www/core.js');
test('cycle and sleep retain elapsed time across date boundaries',()=>{
 const s=C.defaults('2026-12-30');s.settings.anchorPhase=2;
 expect(C.phase(s.settings,'2027-01-01')).toBe(4);
 expect(C.phase(s.settings,'2026-12-27')).toBe(5);
 expect(C.sleepMinutes('23:20','07:00',20)).toBe(440);
 expect(C.stats(s,'2026-12-30').sleepMean).toBeNull();
 const raw={...s,days:{'2026-12-30':{sleep:{bed:'23:20',wake:'07:00',latency:20,quality:4,minutes:999}}}};
 expect(C.normalize(raw).days['2026-12-30'].sleep.minutes).toBe(440);
 expect(C.normalize({...s,settings:{...s.settings,anchorDate:'2026-02-30'}}).settings.anchorDate).not.toBe('2026-02-30');
});
test('water accounts for source and sleep never rounds to a cycle',()=>{
 const s=C.defaults('2026-09-14'),d=C.emptyDay();
 d.drinks=[{type:'juice',ml:250,source:'cup'},{type:'water',ml:200,source:'thermos'}];s.days['2026-09-14']=d;
 expect(C.totals(d)).toEqual({all:450,water:200,thermos:200,juice:250});
 expect(C.stats(s,'2026-09-14').waterMean).toBe(200);
 expect(C.sleepMinutes('05:40','07:00',20)).toBe(60);
 d.sleep={minutes:330};expect(C.training(s,'2026-09-14').light).toBe(true);
});
async function start(page){
 await page.goto('/');
 await page.locator('#start-phase').selectOption('0');
 await page.getByRole('button',{name:'Начать',exact:true}).click();
}
test('daily tracking persists, thermos does not double-count, undo works',async({page})=>{
 await start(page);
 await page.getByRole('button',{name:'+200 мл',exact:true}).click();
 await page.reload();
 await expect(page.getByText('Все напитки: 200 мл')).toBeVisible();
 await page.getByRole('button',{name:'Из термоса',exact:true}).click();
 await page.getByRole('button',{name:'250 мл',exact:true}).click();
 await expect(page.getByText('В термосе осталось 750 мл')).toBeVisible();
 await page.getByRole('button',{name:'Из термоса',exact:true}).click();
 await page.getByRole('button',{name:'Долил ещё 1 литр'}).click();
 await expect(page.getByText('Все напитки: 450 мл')).toBeVisible();
 await page.getByRole('button',{name:'Журнал',exact:true}).click();
 await page.getByRole('button',{name:'Удалить запись напитка'}).first().click();
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await expect(page.getByText('Все напитки: 200 мл')).toBeVisible();
 await page.screenshot({path:'screenshots/today.png',fullPage:true});
});
test('care steps, sleep, workout and settings are functional',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await start(page);
 await page.locator('.nav [data-page="care"]').click();
 await page.locator('[data-period="am"]').click();
 await page.getByRole('button',{name:'Отметить Пенка для умывания',exact:true}).click();
 await page.reload();
 await page.locator('.nav [data-page="care"]').click();
 await page.locator('[data-period="am"]').click();
 await expect(page.getByRole('button',{name:'Отметить Пенка для умывания',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.locator('.nav [data-page="sleep"]').click();
 await page.getByRole('button',{name:'Записать прошлую ночь'}).click();
 await page.locator('#sleep-bed').fill('23:20');await page.locator('#sleep-wake').fill('07:00');
 await page.locator('#sleep-latency').fill('20');await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.locator('.nav [data-page="train"]').click();
 await page.locator('#reps-row').fill('10');await page.locator('#kg-row').fill('4');
 await page.locator('[data-action="set"][data-id="row"][data-set="0"]').click();
 await expect(page.locator('#timer')).toBeVisible();
 await page.locator('[data-action="timer-close"]').click();
 await page.getByRole('button',{name:'Завершить и оценить'}).click();
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.locator('.nav [data-page="stats"]').click();
 await page.screenshot({path:'screenshots/progress.png',fullPage:true});
 await page.getByRole('button',{name:'Настройки',exact:true}).click();
 await page.locator('#wakeWork').fill('06:45');
 await page.getByRole('button',{name:'Сохранить настройки',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Настройки',exact:true}).click();
 await expect(page.locator('#wakeWork')).toHaveValue('06:45');
 expect(errors).toEqual([]);
});
test('no horizontal overflow on small phones, all sections load',async({page})=>{
 await page.setViewportSize({width:320,height:720});await start(page);
 for(const id of ['today','care','train','sleep','stats']){
  await page.locator('.nav [data-page="'+id+'"]').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 await page.setViewportSize({width:393,height:852});
 await page.locator('.nav [data-page="train"]').click();
 await page.screenshot({path:'screenshots/training.png',fullPage:true});
 await page.locator('.nav [data-page="sleep"]').click();
 await page.screenshot({path:'screenshots/sleep.png',fullPage:true});
});
test('backup schema rejects foreign files and excludes executable photo payloads',()=>{
 expect(()=>C.normalize({hello:'world'})).toThrow();
 const s=C.defaults();s.photos=[{id:'x',date:C.dateKey(),slot:'front',data:'javascript:alert(1)'}];
 expect(C.normalize(s).photos).toEqual([]);
 s.days[C.dateKey()]=C.emptyDay();s.days[C.dateKey()].skin.redness=0;
 expect(C.normalize(s).days[C.dateKey()].skin.redness).toBe(0);
});

test('backup replacement restores data through the actual dialog',async({page})=>{
 await start(page);
 await page.getByRole('button',{name:'+200 мл',exact:true}).click();
 const snapshot=await page.evaluate(()=>localStorage.getItem('ritm.v1'));
 await page.getByRole('button',{name:'+250 мл',exact:true}).click();
 await expect(page.getByText('Все напитки: 450 мл')).toBeVisible();
 await page.evaluate(text=>window.Ritm.importState(text),snapshot);
 await page.getByRole('button',{name:'Восстановить',exact:true}).click();
 await page.reload();await expect(page.getByText('Все напитки: 200 мл')).toBeVisible();
});
