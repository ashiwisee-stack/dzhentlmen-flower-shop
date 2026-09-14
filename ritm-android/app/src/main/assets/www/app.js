(function(){
'use strict';
const C=window.Core, native=window.Android;
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
 pulse:'M2 13h5l3-9 4 16 3-10h5',home:'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',
 drop:'M12 3C10 7 5 11 5 15a7 7 0 0014 0c0-4-5-8-7-12z',
 sun:'M12 8a4 4 0 100 8 4 4 0 000-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1',
 moon:'M20 15a8 8 0 01-11-11 9 9 0 1011 11z',
 chart:'M4 20V10 M10 20V4 M16 20v-8 M22 20V7',
 train:'M3 7v10 M6 5v14 M6 12h12 M18 5v14 M21 7v10',
 gear:'M12 8a4 4 0 100 8 4 4 0 000-8 M9 3l-1 3-3 1-2 3 2 2-1 4 3 2 3-1 2 3 4-1 1-3 3-1 1-4-3-2V6l-4-2z',
 check:'M5 12l4 4L20 5',arrow:'M5 12h14 M14 7l5 5-5 5',back:'M15 5l-7 7 7 7',
 plus:'M12 5v14 M5 12h14',clock:'M12 3a9 9 0 100 18 9 9 0 000-18 M12 7v6l4 2',
 bell:'M6 9a6 6 0 0112 0v7l2 2H4l2-2z M10 21h4',
 leaf:'M5 19C-1 7 13 3 21 3c0 12-5 19-13 16 M5 21L17 7',
 face:'M5 4h14v9a7 7 0 01-14 0z M8 9h1 M15 9h1 M9 14q3 3 6 0',
 camera:'M3 7h5l2-3h4l2 3h5v13H3z M12 10a3 3 0 100 6 3 3 0 000-6',
 steam:'M6 20h12 M7 15c-4-4 4-5 0-10 M12 15c-4-4 4-5 0-12 M17 15c-4-4 4-5 0-10',
 shield:'M12 2l8 4v7c0 5-8 9-8 9s-8-4-8-9V6z M8 11l3 3 5-6'
};
const icon=n=>'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[n]||paths.leaf)+'"/></svg>';
const button=(label,action,extra='',cls='btn')=>'<button type="button" class="'+cls+'" data-action="'+action+'" '+extra+'>'+label+'</button>';
let state,readError=false;
function read(){
 let text=native?native.load():localStorage.getItem('ritm.v1');
 if(!text||text==='{}')return C.defaults();
 const raw=JSON.parse(text);if(raw.loadError)throw Error('Не удалось прочитать журнал');
 return C.normalize(raw);
}
try{state=read();}catch(e){state=C.defaults();readError=true;}
let page='today',date=C.dateKey(),careTab='plan',period='am',reportDays=7,lastToday=C.dateKey(),timerEnd=0,timerPaused=0,timerInterval,photoDate;
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),3600);}
function mutate(fn){
 if(readError){toast('Сначала сохрани резервную копию и восстанови журнал.');return false;}
 try{state=read();fn(state);state.revision++;
 const value=JSON.stringify(state);
 if(value.length>15*1024*1024)throw Error('Журнал слишком большой. Сохрани копию и удали старые фото.');
 if(native){if(!native.save(value))throw Error('Не удалось сохранить: журнал изменился или нет места. Повтори действие.');}
 else localStorage.setItem('ritm.v1',value);
 return true;
 }catch(e){try{state=read();}catch(ignored){}toast(e.message||'Не удалось сохранить');return false;}
}
function editDay(s){return s.days[date]||(s.days[date]=C.emptyDay());}
function fmtDate(k){return new Date(k+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'});}
function duration(n){return Math.floor(n/60)+' ч '+Math.round(n%60)+' мин';}
function d(){return C.day(state,date);}
function close(){const m=$('#modal');if(m.open)m.close();}
function modal(title,body,actions=''){
 close();const m=$('#modal');m.innerHTML='<div class="row"><h2>'+title+'</h2>'+button('×','close','aria-label="Закрыть"','close')+'</div><div class="dialogbody">'+body+'</div>'+actions;m.showModal();
}
function header(title,sub){return '<div class="page-head"><div><div class="eyebrow">Маленькие шаги · каждый день</div><h1 class="gap">'+title+'</h1><p>'+sub+'</p></div></div>';}
function datebar(){return '<div class="datebar">'+button(icon('back'),'prev','aria-label="Предыдущий день"')+button((date===C.dateKey()?'Сегодня, ':date===C.shift(C.dateKey(),-1)?'Вчера, ':'')+fmtDate(date),'date','','date')+button(icon('arrow'),'next','aria-label="Следующий день" '+(date>=C.dateKey()?'disabled':''))+'</div>';}
function render(){
 const p=C.phase(state.settings,date);
 const labels=[['today','home','Сегодня'],['care','face','Уход'],['train','train','Тренировка'],['sleep','moon','Сон'],['stats','chart','Прогресс']];
 $('#app').innerHTML='<div class="shell"><header class="top"><div class="brand"><span class="brandmark">'+icon('pulse')+'</span>РИТМ</div><div class="top-actions">'+button(icon('bell'),'notifications','aria-label="Уведомления"','iconbtn')+button(icon('gear'),'settings','aria-label="Настройки"','iconbtn')+'</div></header><main class="page">'+(readError?'<div class="card"><h2>Журнал не удалось прочитать</h2><p class="intro">Данные не перезаписаны. Сохрани файл для восстановления.</p>'+button('Сохранить копию','export')+'</div>':'')+(page==='settings'?settings():page==='care'?care():page==='train'?train():page==='sleep'?sleep():page==='stats'?stats():today(p))+'</main></div><nav class="nav" aria-label="Разделы">'+labels.map(([id,i,label])=>button('<span class="nav-icon">'+icon(i)+'</span><span>'+label+'</span>','nav','data-page="'+id+'" aria-current="'+(page===id?'page':'false')+'"',page===id?'active':'')).join('')+'</nav>';
 if(!state.onboarded&&!readError&&!$('#modal').open)onboard();
}
function today(p){
 const day=d(),t=C.totals(day),tr=C.training(state,date);
 const planned=['am','pm',...(tr.planned?['workout']:[])],complete=planned.filter(k=>day.done[k]).length;
 const ratio=Math.round(complete/planned.length*100),capacity=(1+day.thermosRefills)*1000,remaining=Math.max(0,capacity-t.thermos);
 const task=(key,title,sub,i,target)=>'<div class="task '+(day.done[key]?'checked':'')+'">'+button(day.done[key]?icon('check'):'','toggle-done','data-key="'+key+'" aria-label="'+(day.done[key]?'Снять отметку: ':'Готово: ')+title+'" aria-pressed="'+!!day.done[key]+'"','check '+(day.done[key]?'checked':''))+'<div class="tasktext"><h3>'+title+'</h3><p>'+sub+'</p></div>'+button(icon(i),'nav','data-page="'+target+'" aria-label="Открыть '+title+'"','iconbtn')+'</div>';
 return header('Твой день.<br>Твой ритм.','Уход, движение и отдых — в одном месте.')+datebar()+
 '<div class="phasebar" aria-label="День цикла">'+C.phases.map((x,i)=>button('<strong>'+x+'</strong><small>'+(i<4?'08:00–17:00':'Выходной')+'</small>','phase','data-phase="'+i+'" aria-label="Выбрать '+x+'"','phasebtn '+(p===i?'active ':'')+(state.settings.bathDays.includes(i)?'bath':''))).join('')+'</div>'+
 '<div class="dashboard"><section class="card hero"><div><span class="pill green">'+(p<4?'Рабочий день '+(p+1):'Выходной '+(p-3))+'</span><h2 class="gap">'+(complete===planned.length?'Ты уделил<br>себе время.':tr.bath?'Мягкий вечер<br>после работы.':'Понемногу.<br>И регулярно.')+'</h2><p>'+(tr.bath?'Сегодня по плану баня и восстановление.':tr.planned?'Сегодня — уход и тренировка корпуса.':'Сегодня — уход и свободный темп.')+'</p></div><div class="ring" style="--value:'+ratio+'%"><div><strong>'+complete+'/'+planned.length+'</strong><span>ЗАДАЧ НА ДЕНЬ</span></div></div></section>'+
 '<section class="card blue"><div class="water-top"><div><span class="pill blue">'+icon('drop')+' Вода</span><div class="metric">'+(t.water/1000).toFixed(2).replace('.',',')+'<small>л выпито</small></div><p class="small muted">В термосе осталось '+remaining+' мл</p><p class="small muted">Все напитки: '+t.all+' мл'+(state.settings.waterGoal?' · цель воды '+state.settings.waterGoal+' мл':'')+'</p></div><div class="thermos" aria-label="Остаток в термосе '+remaining+' миллилитров"><div class="fill" style="--fill:'+Math.min(100,remaining/10)+'%"></div></div></div><div class="water-actions">'+button('+200 мл','water','data-ml="200"')+button('+250 мл','water','data-ml="250"')+button('Из термоса','thermos')+'</div><div class="row">'+button('Сок и другие напитки','drink','','linkbtn')+button('Журнал','drinks','','linkbtn')+'</div></section></div>'+
 '<div class="section-title"><h2>План на сегодня</h2><small>'+complete+' из '+planned.length+'</small></div><section class="card">'+task('am','Утренний уход','Очищение · увлажнение · SPF','sun','care')+task('pm','Вечерний уход','Очищение · твой график средств','moon','care')+(tr.planned?task('workout','Пресс и спина',tr.light?'Сегодня лучше облегчить нагрузку':'30–40 минут · без спешки','train','train'):'<div class="task"><span class="task-icon">'+icon(tr.bath?'steam':'leaf')+'</span><div class="tasktext"><h3>'+(tr.bath?'Баня и восстановление':'День восстановления')+'</h3><p>Тяжёлая тренировка не запланирована</p></div></div>')+'</section>'+
 '<div class="two"><section class="card mini purple"><h3>Сон прошлой ночью</h3><div class="metric">'+(day.sleep?(day.sleep.minutes/60).toFixed(1).replace('.',',')+'<small>ч</small>':'—')+'</div>'+button(day.sleep?'Изменить запись':'Записать сон','nav','data-page="sleep"','linkbtn')+'</section><section class="card mini"><h3>Самочувствие кожи</h3><div class="metric">'+(day.skin.redness==null?'—':['Спокойно','Немного','Заметно','Сильно'][day.skin.redness])+'</div>'+button('Отметить состояние','skin','','linkbtn')+'</section></div>'+
 '<section class="card gap"><div class="toggle-row"><label>Сегодня брился<small>Поможет заметить реакцию кожи</small></label>'+toggle('shaved',day.shaved)+'</div><div class="toggle-row"><label>Сегодня была баня<small>Фактическая отметка, отдельно от плана</small></label>'+toggle('bath',day.bath===true)+'</div>'+button('Заметка о дне','note','','linkbtn')+'</section>';
}
function toggle(key,on){return button('','toggle','data-key="'+key+'" role="switch" aria-label="'+(key==='shaved'?'Сегодня брился':'Сегодня была баня')+'" aria-checked="'+!!on+'"','switch');}
function care(){
 const plan=C.carePlan(state,date,period),day=d();
 return header('Уход без суеты.','Твои средства. Понятная последовательность.')+datebar()+
 '<div class="tabs">'+button('План','care-tab','data-tab="plan"',careTab==='plan'?'active':'')+button('Мои средства','care-tab','data-tab="products"',careTab==='products'?'active':'')+'</div>'+
 (careTab==='products'?'<p class="intro">Активные средства добавляются в расписание вручную. Начни с уже знакомого, переносимого ухода.</p>'+C.products.map(p=>'<article class="product"><div class="row start"><span class="mono">'+esc(p.name.slice(0,2).toUpperCase())+'</span><div style="flex:1"><h3>'+p.name+'</h3><p>'+p.sub+'</p></div></div><p class="desc">'+p.text+'</p>'+button(state.settings.productDays[p.id]?.days.length?'Изменить расписание':'Настроить расписание','product','data-id="'+p.id+'"','linkbtn')+'</article>').join(''):
 '<div class="tabs">'+button(icon('sun')+' Утро','period','data-period="am"',period==='am'?'active':'')+button(icon('moon')+' Вечер','period','data-period="pm"',period==='pm'?'active':'')+'</div><div class="card">'+plan.map((p,i)=>'<div class="task '+(p.checked?'checked':'')+'">'+button(p.checked?icon('check'):p.skipped?'−':'','care-check','data-id="'+p.key+'" aria-label="Отметить '+p.name+'" aria-pressed="'+p.checked+'"','check '+(p.checked?'checked':p.skipped?'skipped':''))+'<div class="tasktext"><h3>'+esc(p.id==='moisturizer'&&state.settings.moisturizer?state.settings.moisturizer:p.name)+'</h3><p>'+(p.skipped?'Пропущено':p.sub)+'</p>'+button('Как использовать','product-info','data-id="'+p.id+'"','linkbtn')+'</div>'+button('−','skip','data-id="'+p.key+'" aria-label="Пропустить '+p.name+'"','iconbtn')+'</div>').join('')+'</div>'+
 '<div class="info">Раздражение после бритья или бани — повод не добавлять новые активы. План лекарства согласуй с инструкцией и врачом. Гуаша по воспалённым участкам исключён.</div>'+button('Отметить реакцию кожи','skin','','btn secondary full gap'))+
 '<div class="info">При сохраняющихся высыпаниях и появлении рубчиков полезна консультация дерматолога. <a href="https://www.aad.org/public/diseases/acne/skin-care/tips">Рекомендации по уходу</a></div>';
}
function figure(name){
 const shapes={row:'M40 68L160 68 M67 53L91 29 129 34 M90 29L88 8 M92 9a7 7 0 11-14 0 7 7 0 0114 0 M129 34L151 63 M67 53L54 70 M100 34L112 52 101 62 M94 63h15',
 bird:'M25 71h155 M63 37h65 M63 37L49 59 47 71 M128 37L136 60 155 68 M67 36L38 23 M128 37L164 23 M137 26a8 8 0 110-16 8 8 0 010 16',
 dead:'M25 72h155 M75 57h54 M64 56a8 8 0 110-16 8 8 0 010 16 M90 55L97 27 116 28 M124 57L141 36 160 39 M82 56L59 28',
 plank:'M25 72h155 M52 64L70 45 119 57 147 69 M72 45L68 69 47 69 M63 39a8 8 0 110-16 8 8 0 010 16',
 side:'M25 72h155 M65 49L122 40 147 69 M68 49L63 69 43 69 M73 45L105 23 M58 41a8 8 0 110-16 8 8 0 010 16',
 wall:'M80 10v64 M97 28v29 M94 20a7 7 0 110-14 7 7 0 010 14 M97 34L119 35 124 15 M97 56L112 74 M97 56L85 74'};
 return '<div class="art"><svg class="figure" viewBox="0 0 200 85" role="img" aria-label="Условная схема положения тела"><path d="'+(shapes[name]||shapes.plank)+'"/></svg></div>';
}
function train(){
 const tr=C.training(state,date),day=d(),w=day.workout,sets=w?.sets||{};
 return header('Сильнее основа.','Спина и пресс · спокойная, контролируемая техника')+datebar()+
 '<section class="card hero"><div><span class="pill green">'+(tr.planned?'По плану сегодня':'Восстановление')+'</span><h2 class="gap">'+(tr.light?'Лёгкий режим.':'30–40 минут<br>для себя.')+'</h2><p>'+(tr.light?'По журналу есть недосып или усталость. Можно отдохнуть либо сделать 1–2 лёгких подхода.':tr.bath?'Сегодня баня. Тяжёлую тренировку перенеси на другой день.':'5 минут разминки, упражнения с отдыхом и спокойная заминка.')+'</p></div>'+icon('train')+'</section>'+
 '<div class="info">Руки участвуют в тягах и опоре, но отдельных упражнений на руки и ноги нет. При боли, головокружении или потере техники остановись.</div>'+
 '<section class="card gap"><h3>01 · Разминка, 5 минут</h3><p class="intro">Спокойная ходьба на месте, мягкие движения плечами, лопатками и тазом. Не делай резких кругов шеей.</p><div class="buttons">'+button(w?.started?'Тренировка начата':'Начать тренировку','work-start')+button('Таймер 5:00','timer','data-seconds="300"','btn secondary')+'</div></section>'+
 '<div class="section-title"><h2>02 · Основная часть</h2><small>Отдых 60–90 секунд</small></div><div class="exercise-grid">'+tr.ids.map((id,index)=>{
 const e=C.exercises[id],saved=sets[id]||[];
 return '<article class="card exercise"><div class="row"><span class="eyebrow">'+String(index+1).padStart(2,'0')+' / '+e.tag+'</span><span class="pill green">3 подхода</span></div><h3 class="gap">'+e.name+'</h3>'+figure(e.figure)+'<p class="small muted">'+e.dose+'</p><ol class="steps">'+e.steps.map(x=>'<li>'+x+'</li>').join('')+'</ol><p class="small muted">'+e.hint+'</p><div class="set-inputs gap"><label>'+e.unit+' в подходе<input id="reps-'+id+'" type="number" inputmode="numeric" min="1" max="300" value="'+(saved.filter(Boolean).slice(-1)[0]?.n||e.n)+'"></label><label>'+(id==='row'?'Вес гантели, кг':'Отдых, сек.')+'<input id="kg-'+id+'" type="number" inputmode="decimal" min="0" max="100" value="'+(id==='row'?(saved.filter(Boolean).slice(-1)[0]?.kg||0):60)+'" '+(id==='row'?'step="0.5"':'readonly')+'></label></div><div class="setrow">'+[0,1,2].map(n=>button((saved[n]?'✓ ':'')+(n+1)+'<span>'+(saved[n]?saved[n].n+' '+e.unit:'подход')+'</span>','set','data-id="'+id+'" data-set="'+n+'" aria-label="'+e.name+', подход '+(n+1)+'" aria-pressed="'+!!saved[n]+'"',saved[n]?'done':'')).join('')+'</div></article>';
 }).join('')+'</div><section class="card gap"><h3>03 · Заминка, 3–5 минут</h3><p class="intro">Спокойное дыхание и мягкие движения в комфортной амплитуде. Не тяни мышцы через боль.</p>'+button(day.done.workout?'Тренировка отмечена ✓':'Завершить и оценить','work-finish','','btn full')+'</section><div class="info">Программа — стартовый шаблон, а не лечение заболеваний спины. Турник пока оставлен в арсенале; ролик можно включить в настройках при уверенной технике. <a href="https://orthoinfo.aaos.org/en/recovery/spine-conditioning-program/">О технике и укреплении спины</a></div>';
}
function sleep(){
 const day=d(),next=C.shift(date,1),p=C.phase(state.settings,next),wake=state.settings[p<4?'wakeWork':'wakeOff'],bed=C.clock(C.timeMinutes(wake)-state.settings.sleepGoal*60-state.settings.latency);
 const now=new Date(),nextWake=C.nextWake(state.settings,now),actualWake=nextWake.time;
 const available=Math.max(0,Math.floor((nextWake.at-now)/60000)-state.settings.latency);
 return header('Время восстановиться.','Больше сна важнее красивой кратности.')+datebar()+
 '<section class="card center"><div class="sleep-orb">'+icon('moon')+'</div><div class="eyebrow">Лечь в кровать</div><div class="sleepbig">'+bed+'</div><p class="muted">Подъём '+fmtDate(next)+' в '+wake+'</p><p class="small muted gap">'+state.settings.sleepGoal+' ч сна + '+state.settings.latency+' мин на засыпание</p>'+button(day.sleep?'Изменить запись сна':'Записать прошлую ночь','sleep-log','','btn full gap')+'</section>'+
 (date===C.dateKey()?'<section class="card purple"><div class="row"><h3>Если лечь сейчас</h3><span class="pill">'+icon('clock')+'</span></div><div class="metric gap">'+duration(available)+'</div><p class="small muted">Оценка до '+actualWake+' с учётом засыпания</p><div class="info '+(available<420?'warn':'')+'">'+(available<420?'Ночь получится короткой. Лучше лечь сейчас: ожидание «правильного цикла» только уменьшит время сна.':'Можно использовать это время для полноценного отдыха.')+'</div></section>':'')+
 '<section class="card"><h3>Про циклы 70–90 минут</h3><p class="intro">Циклы не работают как точный таймер. NIH описывает типичный интервал около 80–100 минут; продолжительность меняется в течение ночи. По часам нельзя определить конец твоего цикла.</p><p class="small muted">Поэтому приложение не советует сокращать сон с 5 часов до 4,5 ради кратности. Обычный ориентир для взрослого — 7–9 часов, с учётом самочувствия.</p><div class="gap"><a href="https://www.nhlbi.nih.gov/health/sleep/stages-of-sleep">Как устроены циклы сна</a></div></section>'+
 '<div class="two"><section class="card mini"><h3>Последняя запись за день</h3><div class="metric">'+(day.sleep?(day.sleep.minutes/60).toFixed(1)+'<small>ч</small>':'—')+'</div></section><section class="card mini purple"><h3>Самочувствие утром</h3><div class="metric">'+(day.sleep?day.sleep.quality+'<small>из 5</small>':'—')+'</div></section></div>';
}
function stats(){
 const st=C.stats(state,date,reportDays),photos=state.photos,rows=C.insights(state,date);
 return header('Замечай изменения.','Твоя история, без выдуманных оценок внешности.')+datebar()+
 '<div class="tabs">'+button('7 дней','report','data-count="7"',reportDays===7?'active':'')+button('Цикл · 6 дней','report','data-count="6"',reportDays===6?'active':'')+button('30 дней','report','data-count="30"',reportDays===30?'active':'')+'</div>'+
 '<div class="two"><section class="card mini"><h3>Тренировки</h3><div class="metric">'+st.workouts+'</div><p class="small muted">За выбранные '+reportDays+' дней</p></section><section class="card mini purple"><h3>Средний сон</h3><div class="metric">'+(st.sleepMean==null?'—':(st.sleepMean/60).toFixed(1)+'<small>ч</small>')+'</div><p class="small muted">'+st.sleepN+' ночей с записью</p></section></div>'+
 '<section class="card blue gap"><div class="row"><h3>Учтённая вода</h3><span class="pill blue">мл / день</span></div><div class="bars">'+st.keys.map(k=>{const day=C.day(state,k),v=C.totals(day).water;return '<div class="barcol"><small>'+(reportDays<10?(day.drinks.length?v:'—'):'')+'</small><div class="bar" style="height:'+Math.min(100,v/30)+'px;opacity:'+(day.drinks.length?1:.2)+'"></div><span>'+(reportDays<10?new Date(k+'T12:00:00').getDate():'')+'</span></div>';}).join('')+'</div><p class="small muted">'+st.waterN+' дней с напитками. Пустые дни — нет записи, а не ноль выпитого.</p></section>'+
 '<div class="section-title"><h2>Автоматическая сводка</h2><small>Последние 7 дней</small></div><div class="note-list">'+rows.map(x=>'<article><h3>'+esc(x.title)+'</h3><p>'+esc(x.text)+'</p></article>').join('')+'</div>'+
 '<div class="section-title"><h2>Фото прогресса</h2><span class="pill">'+icon('shield')+' На телефоне</span></div><section class="card"><p class="small muted">Один свет, расстояние и положение головы. Достаточно одного набора в неделю. Хранится до 30 снимков.</p><div class="photo-grid gap">'+['front','left','right'].map((slot,i)=>{const photo=photos.filter(x=>x.date===date&&x.slot===slot).slice(-1)[0];return button((photo?'<img src="'+photo.data+'" alt="Фото '+['анфас','слева','справа'][i]+'">':icon('camera'))+'<span>'+['Анфас','Слева','Справа'][i]+'</span>','photo','data-slot="'+slot+'"','photo-slot');}).join('')+'</div>'+button('Сравнить фотографии','compare','','linkbtn')+'</section>'+
 '<div class="section-title"><h2>История дней</h2></div><section class="card">'+(st.keys.slice().reverse().filter(k=>state.days[k]).map(k=>'<div class="history-row"><div><strong>'+fmtDate(k)+'</strong><p class="small muted">'+(state.days[k].done.workout?'Тренировка · ':'')+C.totals(state.days[k]).all+' мл напитков'+(state.days[k].sleep?' · сон '+duration(state.days[k].sleep.minutes):'')+'</p></div>'+button(icon('arrow'),'open-day','data-date="'+k+'" aria-label="Открыть '+fmtDate(k)+'"','iconbtn')+'</div>').join('')||'<p class="empty">Здесь появятся дни, в которых ты что-то отметил.</p>')+'</section>';
}
function timeField(id,label,val){return '<label><span class="label">'+label+'</span><input type="time" id="'+id+'" value="'+val+'"></label>';}
function chips(name,values){return '<div class="chip-grid">'+C.phases.map((p,i)=>'<label>'+p+'<input name="'+name+'" type="checkbox" value="'+i+'" '+(values.includes(i)?'checked':'')+'></label>').join('')+'</div>';}
function settings(){
 const s=state.settings,ns=native?JSON.parse(native.notificationStatus()):{enabled:false,exact:false};
 return header('Под твой график.','Все времена указаны по часовому поясу телефона.')+
 '<form id="settings-form"><section class="card"><h3>Работа и восстановление</h3><p class="small muted gap">Цикл 4/2 · работа 08:00–17:00</p><div class="fieldrow"><label><span class="label">Опорная дата</span><input id="anchorDate" type="date" value="'+s.anchorDate+'" required></label><label><span class="label">День в эту дату</span><select id="anchorPhase">'+C.phases.map((p,i)=>'<option value="'+i+'" '+(i===s.anchorPhase?'selected':'')+'>'+p+'</option>').join('')+'</select></label></div><span class="label">Баня после работы</span>'+chips('bathDays',s.bathDays)+'<span class="label">Дни тренировок</span>'+chips('trainingDays',s.trainingDays)+'<p class="small muted gap">Если в один день выбраны баня и тренировка, приоритет у восстановления.</p></section>'+
 '<section class="card"><h3>Сон и время напоминаний</h3><div class="fieldrow">'+timeField('wakeWork','Подъём в рабочий',''+s.wakeWork)+timeField('wakeOff','Подъём в выходной',s.wakeOff)+timeField('trainingTime','Тренировка / баня',s.trainingTime)+timeField('eveningTime','Вечерний уход',s.eveningTime)+'</div><div class="fieldrow"><label><span class="label">Цель сна, ч</span><input id="sleepGoal" type="number" min="7" max="9" step=".5" value="'+s.sleepGoal+'"></label><label><span class="label">Засыпание, мин</span><input id="latency" type="number" min="0" max="90" value="'+s.latency+'"></label></div><div class="fieldrow">'+timeField('quietStart','Тишина с',s.quietStart)+timeField('quietEnd','Тишина до',s.quietEnd)+'</div></section>'+
 '<section class="card blue"><h3>Вода и напитки</h3><label><span class="label">Объём стакана, мл</span><input id="cupMl" type="number" min="50" max="1000" step="50" value="'+s.cupMl+'"></label><label><span class="label">Личная цель воды, мл · 0 = без цели</span><input id="waterGoal" type="number" min="0" max="4000" step="100" value="'+s.waterGoal+'"></label><label><span class="label">Напоминания через запятую</span><input id="waterTimes" value="'+esc(s.waterTimes)+'" placeholder="10:00,14:00,16:00"></label><p class="small muted gap">Термос — 1 литр. Цель не назначается автоматически. Дополнительная вода не гарантирует исчезновения отёков.</p></section>'+
 '<section class="card"><h3>Уход и упражнения</h3><label><span class="label">Твой увлажняющий крем</span><input id="moisturizer" maxlength="100" value="'+esc(s.moisturizer)+'" placeholder="Название, если уже есть"></label><label class="toggle-row"><span>Использовать ролик вместо планки<small>Только при уверенном контроле поясницы</small></span><input id="roller" type="checkbox" '+(s.roller?'checked':'')+'></label></section>'+
 '<section class="card"><h3>Уведомления</h3><label class="toggle-row"><span>Напоминания Ритма</span><input id="notifications" type="checkbox" '+(s.notifications?'checked':'')+'></label><p class="small muted">Разрешение Android: '+(ns.enabled?'есть':'не выдано')+' · точное время: '+(ns.exact?'доступно':'возможны задержки')+'</p><div class="buttons gap">'+button('Разрешение Android','permission','type="button"','btn secondary tiny')+button('Точное время','exact','type="button"','btn secondary tiny')+'</div>'+button('Пробное уведомление','test-notification','type="button"','linkbtn')+'<p class="small muted">После принудительной остановки приложения напоминания возобновятся при открытии. Энергосбережение телефона может задерживать доставку.</p></section>'+
 '<button class="btn full" type="submit">Сохранить настройки</button></form>'+
 '<section class="card gap"><h3>Твои данные</h3><p class="intro">Записи и фото хранятся локально. При удалении приложения они исчезнут: заранее сохрани резервную копию.</p><div class="buttons">'+button('Сохранить копию','export','','btn secondary')+button('Восстановить','import','','btn secondary')+'</div></section><p class="small muted center">Ритм 1.0 · без аккаунта и рекламы</p>';
}
function onboard(){
 modal('<span class="onboardmark">'+icon('pulse')+'</span>Добро пожаловать в Ритм','<p class="intro">Твой уход, движение и восстановление. Для начала выбери, какой сегодня день цикла.</p><label><span class="label">Сегодня</span><select id="start-phase"><option value="" selected disabled>Выбрать день</option>'+C.phases.map((p,i)=>'<option value="'+i+'">'+p+' — '+(i<4?'рабочий':'выходной')+'</option>').join('')+'</select></label><p class="info">Время подъёма пока 07:00 в рабочие дни и 09:00 в выходные. Измени его под себя в настройках.</p>','<div class="modal-actions">'+button('Начать','onboard')+'</div>');
}
function skin(){
 const s=d().skin,labels={redness:'Покраснение',dryness:'Сухость / жжение',spots:'Новые высыпания',fatigue:'Общая усталость'};
 modal('Как ты сегодня?',Object.entries(labels).map(([k,label])=>'<div class="gap"><h3>'+label+'</h3><div class="rating">'+['Нет','Немного','Заметно','Сильно'].map((t,i)=>button(t,'rate','data-key="'+k+'" data-value="'+i+'" aria-pressed="'+(s[k]===i)+'"',s[k]===i?'active':'')).join('')+'</div></div>').join('')+'<p class="small muted gap">Каждая отметка сохраняется сразу. Можно оставить незаполненное.</p>');
}
function product(id,infoOnly){
 const p=C.products.find(x=>x.id===id);if(!p)return;
 const plan=state.settings.productDays[id]||{days:[],period:'pm'};
 modal(p.name,'<p class="intro">'+p.text+'</p>'+(infoOnly?'':'<label><span class="label">Время</span><select id="product-period"><option value="am" '+(plan.period==='am'?'selected':'')+'>Утро</option><option value="pm" '+(plan.period==='pm'?'selected':'')+'>Вечер</option></select></label><span class="label">Дни цикла</span>'+chips('product-days',plan.days)+(p.active?'<p class="info warn">Укажи уже согласованную и переносимую схему. Не добавляй все активы одновременно.</p>':'')),infoOnly?'':'<div class="modal-actions">'+button('Сохранить расписание','product-save','data-id="'+id+'"')+'</div>');
}
function sleepLog(){
 const s=d().sleep||{bed:'23:00',wake:state.settings[C.phase(state.settings,date)<4?'wakeWork':'wakeOff'],latency:state.settings.latency,quality:3};
 modal('Сон к '+fmtDate(date),'<p class="small muted">Дата записи — день пробуждения. Укажи время, когда лёг, и фактический подъём.</p><div class="fieldrow">'+timeField('sleep-bed','Лёг в кровать',s.bed)+timeField('sleep-wake','Проснулся',s.wake)+'</div><div class="fieldrow"><label><span class="label">Засыпание, мин</span><input id="sleep-latency" type="number" min="0" max="90" value="'+s.latency+'"></label><label><span class="label">Бодрость утром, 1–5</span><input id="sleep-quality" type="number" min="1" max="5" value="'+s.quality+'"></label></div><p class="info">Расчёт приблизительный: ночные пробуждения автоматически не измеряются.</p>','<div class="modal-actions">'+(d().sleep?button('Удалить запись','sleep-delete','','btn subtle'):'')+button('Сохранить','sleep-save')+'</div>');
}
function drinks(){
 const day=d(),t=C.totals(day),names={water:'Вода',juice:'Сок',tea:'Чай',coffee:'Кофе'};
 modal('Напитки за день','<div class="metric">'+t.all+'<small>мл всего</small></div><p class="small muted">Вода '+t.water+' мл · сок '+t.juice+' мл</p><div class="gap">'+(day.drinks.slice().reverse().map(x=>'<div class="history-row"><div>'+names[x.type]+' · '+x.ml+' мл<p class="small muted">'+(x.source==='thermos'?'Из термоса · ':'')+new Date(x.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'</p></div>'+button('×','delete-drink','data-id="'+esc(x.id)+'" aria-label="Удалить запись напитка"')+'</div>').join('')||'<p class="empty">Пока без записей</p>')+'</div>');
}
function addDrink(type,ml,source){
 if(!Number.isFinite(ml)||ml<=0||ml>2000){toast('Укажи объём от 1 до 2000 мл');return false;}
 const ok=mutate(s=>{const day=editDay(s);if(source==='thermos'&&C.totals(day).thermos+ml>(1+day.thermosRefills)*1000)throw Error('В термосе меньше воды. Сначала отметь долив.');
 day.drinks.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),type,ml,source,at:Date.now()});});
 if(ok){render();toast('Записано '+ml+' мл');}return ok;
}
function compare(){
 const photos=state.photos.slice().sort((a,b)=>a.date.localeCompare(b.date));
 if(photos.length<2){toast('Для сравнения добавь хотя бы два фото');return;}
 const opts=selected=>photos.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selected?'selected':'')+'>'+fmtDate(p.date)+' · '+({front:'анфас',left:'слева',right:'справа'}[p.slot])+'</option>').join('');
 const a=photos[0],b=photos[photos.length-1];
 modal('Фото рядом','<p class="small muted">Сравнивай одинаковые ракурсы. Освещение может менять вид кожи.</p><div class="comparison gap"><div><select id="compare-a">'+opts(a.id)+'</select><img id="image-a" src="'+a.data+'" alt="Первое фото">'+button('Удалить фото','delete-photo','data-side="a"','linkbtn')+'</div><div><select id="compare-b">'+opts(b.id)+'</select><img id="image-b" src="'+b.data+'" alt="Второе фото">'+button('Удалить фото','delete-photo','data-side="b"','linkbtn')+'</div></div>');
}
function startTimer(seconds){
 clearInterval(timerInterval);timerPaused=0;timerEnd=Date.now()+seconds*1000;
 sessionStorage.setItem('ritm.timer',String(timerEnd));timerInterval=setInterval(tickTimer,250);tickTimer();
}
function tickTimer(){
 const seconds=Math.max(0,Math.ceil((timerEnd-Date.now())/1000)),t=$('#timer');
 t.classList.remove('hidden');
 t.innerHTML='<div><small>'+(seconds?'Таймер отдыха':'Время вышло')+'</small><br><strong>'+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+'</strong></div>'+button(seconds?'Пауза':'Готово',seconds?'timer-pause':'timer-close')+button('×','timer-close','aria-label="Закрыть таймер"');
 if(seconds===0){clearInterval(timerInterval);sessionStorage.removeItem('ritm.timer');if(navigator.vibrate)navigator.vibrate([150,80,150]);}
}
function download(name,text){
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function importState(text){
 try{
  if(text.length>15*1024*1024)throw Error('Файл слишком большой');
  const imported=C.normalize(JSON.parse(text));window.pendingImport=imported;
  modal('Восстановить копию?','<p class="intro">В копии '+Object.keys(imported.days).length+' дней и '+imported.photos.length+' фото. Текущий журнал будет заменён. Сначала сохрани его, если он нужен.</p>','<div class="modal-actions">'+button('Отмена','close','','btn secondary')+button('Восстановить','import-confirm')+'</div>');
 }catch(e){toast(e.message||'Не удалось прочитать копию');}
}
function photoResult(text){
 try{
  const data=JSON.parse(text);if(!/^data:image\/jpeg;base64,/.test(data.data))return;
  const target=photoDate||date;
  const ok=mutate(s=>{
   const existing=s.photos.findIndex(x=>x.date===target&&x.slot===data.slot);
   if(existing<0&&s.photos.length>=30)throw Error('Сохрани копию и удали старые фото: лимит 30 снимков.');
   const p={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),date:target,slot:data.slot,data:data.data};
   if(existing>=0)s.photos[existing]=p;else s.photos.push(p);
  });if(ok){render();toast('Фото сохранено на устройстве');}
 }catch(e){toast('Не удалось добавить фото');}
}
async function browserPhoto(slot){
 const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=async()=>{
 try{
 const file=input.files[0];if(!file)return;
 const bmp=await createImageBitmap(file),scale=Math.min(1,720/Math.max(bmp.width,bmp.height)),canvas=document.createElement('canvas');
 canvas.width=Math.round(bmp.width*scale);canvas.height=Math.round(bmp.height*scale);canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close();
 photoResult(JSON.stringify({slot,data:canvas.toDataURL('image/jpeg',.78)}));
 }catch(e){toast('Не удалось прочитать изображение');}};input.click();
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b)return;
 if(b.closest('form'))e.preventDefault();
 const a=b.dataset.action,k=b.dataset.key;
 if(a==='close'){close();return;}
 if(a==='nav'){page=b.dataset.page;if(page==='care')period=new Date().getHours()<15?'am':'pm';render();window.scrollTo(0,0);return;}
 if(a==='settings'){page='settings';render();window.scrollTo(0,0);return;}
 if(a==='prev'||a==='next'){date=C.shift(date,a==='prev'?-1:1);if(date>C.dateKey())date=C.dateKey();render();return;}
 if(a==='date'){modal('Открыть день','<input type="date" id="pick-date" max="'+C.dateKey()+'" value="'+date+'">','<div class="modal-actions">'+button('Сегодня','today')+button('Открыть','pick-date')+'</div>');return;}
 if(a==='today'){date=C.dateKey();close();render();return;}
 if(a==='pick-date'){const v=$('#pick-date').value;if(C.validDate(v)&&v<=C.dateKey()){date=v;close();render();}return;}
 if(a==='open-day'){date=b.dataset.date;page='today';render();window.scrollTo(0,0);return;}
 if(a==='onboard'){const v=$('#start-phase').value;if(v===''){toast('Выбери день цикла');return;}if(mutate(s=>{s.onboarded=true;s.settings.anchorDate=C.dateKey();s.settings.anchorPhase=Number(v);})){close();render();}return;}
 if(a==='phase'){
  const p=Number(b.dataset.phase);
  modal('Сегодня '+C.phases[p]+'?','<p class="intro">Опорной датой станет '+fmtDate(date)+'. Следующие дни цикла и напоминания пересчитаются.</p>','<div class="modal-actions">'+button('Отмена','close','','btn secondary')+button('Да, сохранить','phase-confirm','data-phase="'+p+'"')+'</div>');return;
 }
 if(a==='phase-confirm'){if(mutate(s=>{s.settings.anchorDate=date;s.settings.anchorPhase=Number(b.dataset.phase);})){close();render();}return;}
 if(a==='toggle-done'){mutate(s=>{const day=editDay(s);day.done[k]=!day.done[k];if(!day.done[k]&&(k==='am'||k==='pm'))Object.keys(day.checks).forEach(id=>{if(id.startsWith(k+'-'))delete day.checks[id];});});render();return;}
 if(a==='toggle'){mutate(s=>{const day=editDay(s);day[k]=!day[k];});render();return;}
 if(a==='skin'){skin();return;}
 if(a==='rate'){mutate(s=>{editDay(s).skin[k]=Number(b.dataset.value);});render();skin();return;}
 if(a==='note'){modal('Заметка о дне','<textarea id="day-note" maxlength="2000" placeholder="Самочувствие, реакция на средство, нагрузка на работе…">'+esc(d().notes)+'</textarea>','<div class="modal-actions">'+button('Сохранить','note-save')+'</div>');return;}
 if(a==='note-save'){const text=$('#day-note').value;if(mutate(s=>editDay(s).notes=text)){close();render();}return;}
 if(a==='water'){addDrink('water',Number(b.dataset.ml),'cup');return;}
 if(a==='thermos'){const left=Math.max(0,(1+d().thermosRefills)*1000-C.totals(d()).thermos);modal('Термос · 1 литр','<p class="intro">Осталось '+left+' мл. Отмечай только выпитое.</p><div class="buttons">'+button('250 мл','thermos-add','data-ml="250"')+button('500 мл','thermos-add','data-ml="500"')+'</div>'+button('Выпил остаток ('+left+' мл)','thermos-add','data-ml="'+left+'" '+(!left?'disabled':''),'btn secondary full gap')+'<div class="divider"></div>'+button('Долил ещё 1 литр','refill','','btn subtle full'));return;}
 if(a==='thermos-add'){if(addDrink('water',Number(b.dataset.ml),'thermos'))close();return;}
 if(a==='refill'){if(mutate(s=>{const day=editDay(s);if(day.thermosRefills>=10)throw Error('Проверь записи: слишком много доливов');day.thermosRefills++;})){close();render();toast('Долив записан. Выпитая вода не изменилась.');}return;}
 if(a==='drink'){modal('Добавить напиток','<label><span class="label">Напиток</span><select id="drink-type"><option value="juice">Сок</option><option value="water">Вода</option><option value="tea">Чай</option><option value="coffee">Кофе</option></select></label><label><span class="label">Объём, мл</span><input id="drink-ml" type="number" min="1" max="2000" value="'+state.settings.cupMl+'"></label><p class="small muted gap">Стакан в настройках: '+state.settings.cupMl+' мл. Все напитки учитываются в общем объёме.</p>','<div class="modal-actions">'+button('Записать','drink-save')+'</div>');return;}
 if(a==='drink-save'){if(addDrink($('#drink-type').value,Number($('#drink-ml').value),'cup'))close();return;}
 if(a==='drinks'){drinks();return;}
 if(a==='delete-drink'){mutate(s=>{const day=editDay(s);day.drinks=day.drinks.filter(x=>x.id!==b.dataset.id);});render();drinks();return;}
 if(a==='care-tab'){careTab=b.dataset.tab;render();return;}
 if(a==='period'){period=b.dataset.period;render();return;}
 if(a==='product'||a==='product-info'){product(b.dataset.id,a==='product-info');return;}
 if(a==='product-save'){const days=$$('input[name="product-days"]:checked').map(x=>Number(x.value)),p=$('#product-period').value;if(mutate(s=>s.settings.productDays[b.dataset.id]={days,period:p})){close();render();}return;}
 if(a==='care-check'||a==='skip'){
  const id=b.dataset.id;
  mutate(s=>{const day=editDay(s);if(day.done[period]){C.carePlan(s,date,period).forEach(x=>{day.checks[x.key]=true;});delete day.done[period];}
  if(a==='skip'){day.skipped[id]=!day.skipped[id];delete day.checks[id];}else{day.checks[id]=!day.checks[id];delete day.skipped[id];}
  const plan=C.carePlan(s,date,period);day.done[period]=plan.every(x=>day.checks[x.key]||day.skipped[x.key]);});
  render();return;
 }
 if(a==='work-start'){mutate(s=>{const day=editDay(s);day.workout=day.workout||{sets:{},started:0,ended:0,effort:5};if(!day.workout.started)day.workout.started=Date.now();});render();toast('Начни с разминки');return;}
 if(a==='set'){
  const id=b.dataset.id,i=Number(b.dataset.set),n=Number($('#reps-'+id).value),kg=id==='row'?Number($('#kg-'+id).value):0;
  if(!Number.isFinite(n)||n<1||n>300||!Number.isFinite(kg)||kg<0||kg>100){toast('Проверь повторения и вес');return;}
  let marked=false;
  if(mutate(s=>{const day=editDay(s);day.workout=day.workout||{sets:{},started:Date.now(),ended:0,effort:5};const sets=day.workout.sets[id]||(day.workout.sets[id]=[]);marked=!sets[i];sets[i]=marked?{n,kg}:null;})){render();if(marked)startTimer(60);}return;
 }
 if(a==='work-finish'){modal('Как прошла тренировка?','<p class="intro">Оцени общую сложность: 1 — очень легко, 10 — предельное усилие. Стремиться к максимуму не нужно.</p><input id="effort" type="number" min="1" max="10" value="'+(d().workout?.effort||5)+'">','<div class="modal-actions">'+button('Сохранить','work-save')+'</div>');return;}
 if(a==='work-save'){const effort=Number($('#effort').value);if(effort<1||effort>10||!Number.isFinite(effort))return;if(mutate(s=>{const day=editDay(s);day.done.workout=true;day.workout=day.workout||{sets:{},started:0};day.workout.ended=Date.now();day.workout.effort=effort;})){close();render();toast('Тренировка сохранена');}return;}
 if(a==='timer'){startTimer(Number(b.dataset.seconds));return;}
 if(a==='timer-close'){clearInterval(timerInterval);timerEnd=0;timerPaused=0;sessionStorage.removeItem('ritm.timer');$('#timer').classList.add('hidden');return;}
 if(a==='timer-pause'){timerPaused=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));clearInterval(timerInterval);sessionStorage.removeItem('ritm.timer');$('#timer').innerHTML='<span>На паузе · '+timerPaused+' сек.</span>'+button('Продолжить','timer-resume')+button('×','timer-close');return;}
 if(a==='timer-resume'){startTimer(timerPaused);return;}
 if(a==='sleep-log'){sleepLog();return;}
 if(a==='sleep-save'){
  const bed=$('#sleep-bed').value,wake=$('#sleep-wake').value,latency=Number($('#sleep-latency').value),quality=Number($('#sleep-quality').value);
  if(!bed||!wake||latency<0||latency>90||quality<1||quality>5||!Number.isFinite(latency)||!Number.isFinite(quality)){toast('Проверь время и оценку');return;}
  const minutes=C.sleepMinutes(bed,wake,latency);
  if(minutes<=0||minutes>16*60){toast('Проверь время: сон должен быть от 1 минуты до 16 часов');return;}
  if(mutate(s=>editDay(s).sleep={bed,wake,latency,quality,minutes})){close();render();}return;
 }
 if(a==='sleep-delete'){mutate(s=>{delete editDay(s).sleep;});close();render();return;}
 if(a==='report'){reportDays=Number(b.dataset.count);render();return;}
 if(a==='photo'){photoDate=date;if(native)native.photo(b.dataset.slot);else browserPhoto(b.dataset.slot);return;}
 if(a==='compare'){compare();return;}
 if(a==='delete-photo'){const id=$('#compare-'+b.dataset.side).value;modal('Удалить фото?','<p class="intro">Фото будет удалено из приложения. Сохрани резервную копию, если оно нужно.</p>','<div class="modal-actions">'+button('Отмена','close','','btn secondary')+button('Удалить','photo-delete-confirm','data-id="'+esc(id)+'"','btn danger')+'</div>');return;}
 if(a==='photo-delete-confirm'){mutate(s=>s.photos=s.photos.filter(x=>x.id!==b.dataset.id));close();render();return;}
 if(a==='notifications'){modal('Напоминания Ритма','<p class="intro">Уход, вода, тренировка и подготовка ко сну. Часы и тихий период можно изменить в настройках.</p><p class="small muted">'+(native?'Для Android 13+ требуется разрешение на уведомления.':'В браузере фоновые напоминания не работают. Для них установи APK.')+'</p>','<div class="modal-actions">'+button('Настроить','notifications-settings')+'</div>');return;}
 if(a==='notifications-settings'){close();page='settings';render();return;}
 if(a==='permission'){if(native)native.requestNotifications();else toast('Разрешение доступно в Android-приложении');return;}
 if(a==='exact'){if(native)native.requestExact();else toast('Точное время доступно в APK');return;}
 if(a==='test-notification'){if(native)native.testNotification();else toast('Пробное уведомление доступно в APK');return;}
 if(a==='export'){if(native)native.exportBackup();else download('Ritm-'+C.dateKey()+'.json',JSON.stringify(state));return;}
 if(a==='import'){if(native)native.importBackup();else{const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{if(input.files[0])importState(await input.files[0].text());};input.click();}return;}
 if(a==='import-confirm'){
  const copy=window.pendingImport;if(!copy)return;
  if(mutate(s=>{const revision=s.revision;Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,copy,{revision});})){window.pendingImport=null;date=C.dateKey();close();render();toast('Копия восстановлена');}return;
 }
});
document.addEventListener('change',e=>{
 if(e.target.id==='compare-a'||e.target.id==='compare-b'){const side=e.target.id.slice(-1),p=state.photos.find(x=>x.id===e.target.value);if(p)$('#image-'+side).src=p.data;}
});
document.addEventListener('submit',e=>{
 if(e.target.id!=='settings-form')return;e.preventDefault();
 const value=id=>$('#'+id).value;
 const times=value('waterTimes').split(',').map(x=>x.trim()).filter(Boolean);
 if(times.some(x=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(x))||times.length>12){toast('Время воды: ЧЧ:ММ через запятую, до 12 отметок');return;}
 if(!C.validDate(value('anchorDate'))){toast('Проверь опорную дату');return;}
 const patch={anchorDate:value('anchorDate'),anchorPhase:Number(value('anchorPhase')),waterTimes:times.join(','),moisturizer:value('moisturizer'),roller:$('#roller').checked,notifications:$('#notifications').checked};
 ['wakeWork','wakeOff','eveningTime','trainingTime','quietStart','quietEnd'].forEach(k=>patch[k]=value(k));
 ['sleepGoal','latency','cupMl','waterGoal'].forEach(k=>patch[k]=Number(value(k)));
 ['bathDays','trainingDays'].forEach(k=>patch[k]=$$('input[name="'+k+'"]:checked').map(x=>Number(x.value)));
 if(mutate(s=>Object.assign(s.settings,patch))){render();toast('Настройки сохранены');if(patch.notifications&&native&&!JSON.parse(native.notificationStatus()).enabled)native.requestNotifications();}
});
function resume(){
 if(readError)return;
 const today=C.dateKey(),wasCurrent=date===lastToday;if(wasCurrent&&today!==lastToday)date=today;lastToday=today;
 try{const loaded=read();if(loaded.revision!==state.revision){state=loaded;if(!$('#modal').open&&page!=='settings')render();}}catch(e){toast('Не удалось обновить журнал');}
 if(!$('#modal').open&&page==='sleep')render();
 if(timerEnd&&!timerPaused)tickTimer();
}
window.Ritm={resume,importState,photoResult,back:()=>{if($('#modal').open){close();return;}if(page!=='today'){page='today';render();return;}modal('Ритм','<p class="intro">Все изменения сохранены. Приложение можно свернуть кнопкой «Домой».</p>');}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume();});
setInterval(()=>{if(C.dateKey()!==lastToday)resume();},30000);
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
render();
const saved=Number(sessionStorage.getItem('ritm.timer'));if(saved>Date.now())startTimer(Math.ceil((saved-Date.now())/1000));
})();
