(function(root){
'use strict';
const phases=['1р','2р','3р','4р','1в','2в'];
const products=[
{id:'oil',name:'Гидрофильное масло',sub:'Первый этап очищения',type:'Очищение',text:'Для снятия стойкого SPF, если это нужно. Используй по инструкции средства, эмульгируй водой и смой. Затем мягкая пенка.',active:false},
{id:'foam',name:'Пенка для умывания',sub:'Пантенол · ниацинамид',type:'Очищение',text:'Нанеси на влажную кожу, мягко распредели пальцами и смой тёплой водой. Не три кожу скребком или щёткой.',active:false},
{id:'moisturizer',name:'Увлажняющий крем',sub:'Уточни свой крем в настройках',type:'База',text:'Обычный крем для лица без раздражающих добавок. Если своего крема пока нет, этот шаг можно пропустить с отметкой.',active:false},
{id:'spf',name:'O’CARE SPF 50',sub:'Солнцезащита',type:'База',text:'Перед выходом на дневной свет нанеси по инструкции упаковки. На улице обновляй примерно каждые 2 часа и после пота или воды. Проверь срок годности.',active:false},
{id:'azelik',name:'Азелик',sub:'Лекарственный гель',type:'Актив',text:'Следуй инструкции препарата и назначению врача. Приложение не подбирает дозировку. Укажи свой переносимый график; при выраженном раздражении нужна коррекция ухода.',active:true},
{id:'bha',name:'Paula’s Choice 2% BHA',sub:'Салициловая кислота',type:'Актив',text:'Не вводи одновременно с другими новыми активами. Не наноси на раздражённую или повреждённую бритьём кожу. Частоту добавь только после проверки переносимости.',active:true},
{id:'txa',name:'Medicube TXA Niacinamide',sub:'15 Serum',type:'Сыворотка',text:'На этикетке указано TXA + niacinamide 15%; доли компонентов по фото не подтверждены. Используй по инструкции, вводи по одному средству.',active:true},
{id:'peptide',name:'NEOGEN Real Peptide',sub:'Пептидная сыворотка',type:'Сыворотка',text:'Дополнительный шаг по желанию и переносимости. Не заменяет лечение высыпаний и не обещает устранить рубцы.',active:true},
{id:'eye',name:'ART&FACT Caffeine 3%',sub:'Крем вокруг глаз',type:'Дополнительно',text:'Небольшое количество по инструкции, избегая попадания в глаза. При жжении прекрати нанесение.',active:true},
{id:'gua',name:'Гуаша',sub:'Скребок · необязательный шаг',type:'Инвентарь',text:'Пока есть воспалённые участки, не проводи по ним скребком. Гуаша не меняет кости лица и не является лечением акне.',active:true}
];
const exercises={
row:{name:'Тяга гантели с опорой',tag:'Спина',dose:'8–12 на сторону',unit:'повт.',n:8,steps:['Упрись свободной рукой в устойчивую опору. Спина в удобном нейтральном положении.','Веди локоть к тазу без разворота корпуса и рывка. Плавно опускай гантель.','Начни с лёгкого веса, оставляя 2–3 повтора в запасе. Выполни обе стороны.'],hint:'Рука помогает тянуть, основная цель — мышцы спины.',figure:'row'},
bird:{name:'Bird dog',tag:'Стабильность спины',dose:'6 на сторону',unit:'повт.',n:6,steps:['Встань на четвереньки: ладони под плечами, колени под тазом.','Вытяни противоположные руку и ногу, не прогибая поясницу и не разворачивая таз.','Задержись на 3 секунды и плавно вернись. Повтори другой стороной.'],hint:'Движение небольшое: качество важнее высоты.',figure:'bird'},
dead:{name:'Dead bug',tag:'Глубокие мышцы корпуса',dose:'6–8 на сторону',unit:'повт.',n:6,steps:['Ляг на спину, подними руки и согнутые ноги.','На выдохе медленно отведи противоположные руку и ногу. Поясница не усиливает прогиб.','Вернись и смени сторону. Если тяжело — двигай только ногами с короткой амплитудой.'],hint:'Не задерживай дыхание.',figure:'dead'},
plank:{name:'Планка с колен',tag:'Пресс',dose:'20–30 секунд',unit:'сек.',n:20,steps:['Опора на предплечья и колени. Локти под плечами.','Удерживай линию от плеч до колен без провала в пояснице.','Дыши спокойно. Заверши подход, если положение тела перестаёт удерживаться.'],hint:'Усложняй до полной планки только при уверенном контроле.',figure:'plank'},
side:{name:'Боковая планка с колен',tag:'Боковые мышцы корпуса',dose:'15–25 сек. на сторону',unit:'сек.',n:15,steps:['Ляг на бок, согни колени, поставь локоть под плечо.','Подними таз до прямой линии плечо–таз–колени.','Удерживай без боли, затем выполни другую сторону.'],hint:'Не заваливай плечо к уху.',figure:'side'},
wall:{name:'Скольжение рук у стены',tag:'Контроль лопаток',dose:'8–10 повторов',unit:'повт.',n:8,steps:['Встань спиной к стене, стопы немного впереди.','Медленно поднимай руки в комфортной амплитуде, сохраняя спокойное положение рёбер.','Не прижимай руки силой и не прогибай поясницу ради высоты.'],hint:'Это мягкое движение, без боли и рывков.',figure:'wall'},
roller:{name:'Ролик с колен',tag:'Усложнение · необязательно',dose:'4–6 коротких повторов',unit:'повт.',n:4,steps:['Только если уверенно удерживаешь корпус без боли. Начни с короткого движения к стене-ограничителю.','Напряги пресс, не допускай провала поясницы.','Вернись до потери контроля. Если поясница прогибается — замени на dead bug.'],hint:'По умолчанию выключен. Не используй на сильной усталости.',figure:'plank'}
};
function dateKey(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
function ordinal(s){return Math.floor(Date.parse(s+'T12:00:00Z')/86400000);}
function shift(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function phase(s,date){return ((ordinal(date)-ordinal(s.anchorDate)+s.anchorPhase)%6+6)%6;}
function defaults(today=dateKey()){return {version:1,revision:0,onboarded:false,settings:{anchorDate:today,anchorPhase:0,bathDays:[1,3],trainingDays:[0,2,4],wakeWork:'07:00',wakeOff:'09:00',eveningTime:'20:30',trainingTime:'18:30',quietStart:'22:00',quietEnd:'07:00',waterTimes:'10:00,12:00,14:00,16:00,20:00',latency:20,sleepGoal:8,waterGoal:0,cupMl:250,notifications:false,roller:false,moisturizer:'',productDays:{}},days:{},photos:[],handled:[]};}
function emptyDay(){return {done:{},checks:{},skipped:{},drinks:[],skin:{},shaved:false,notes:'',thermosRefills:0};}
function day(state,key){return state.days[key]||emptyDay();}
function timeMinutes(s){const a=s.split(':').map(Number);return a[0]*60+a[1];}
function nextWake(settings,now=new Date()){
 for(let i=0;i<3;i++){const date=shift(dateKey(now),i),p=phase(settings,date),time=settings[p<4?'wakeWork':'wakeOff'];const at=new Date(date+'T'+time+':00');if(at>now)return {at,time,date};}
 throw Error('Не удалось рассчитать подъём');
}
function clock(n){n=((Math.round(n)%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function sleepMinutes(bed,wake,latency){return Math.max(0,((timeMinutes(wake)-timeMinutes(bed)+1440)%1440)-latency);}
function num(n,a,b,f){return Number.isFinite(Number(n))?Math.max(a,Math.min(b,Number(n))):f;}
function normalize(raw,today=dateKey()){
 if(!raw||raw.version!==1||!raw.settings||!raw.days||Array.isArray(raw.days))throw Error('Это не резервная копия Ритма');
 const out=defaults(today),s=raw.settings;
 out.onboarded=!!raw.onboarded;out.revision=num(raw.revision,0,1e12,0);
 if(validDate(s.anchorDate))out.settings.anchorDate=s.anchorDate;
 out.settings.anchorPhase=Math.floor(num(s.anchorPhase,0,5,0));
 ['wakeWork','wakeOff','eveningTime','trainingTime','quietStart','quietEnd'].forEach(k=>{if(typeof s[k]==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s[k]))out.settings[k]=s[k];});
 ['bathDays','trainingDays'].forEach(k=>{if(Array.isArray(s[k]))out.settings[k]=[...new Set(s[k].filter(x=>Number.isInteger(x)&&x>=0&&x<6))];});
 out.settings.waterTimes=typeof s.waterTimes==='string'?s.waterTimes.split(',').map(x=>x.trim()).filter(x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x)).slice(0,12).join(','):out.settings.waterTimes;
 for(const [k,a,b]of[['latency',0,90],['sleepGoal',7,9],['waterGoal',0,4000],['cupMl',50,1000]])out.settings[k]=num(s[k],a,b,out.settings[k]);
 ['notifications','roller'].forEach(k=>out.settings[k]=!!s[k]);out.settings.moisturizer=String(s.moisturizer||'').slice(0,100);
 for(const p of products){const plan=s.productDays?.[p.id];if(plan&&Array.isArray(plan.days))out.settings.productDays[p.id]={days:plan.days.filter(x=>Number.isInteger(x)&&x>=0&&x<6),period:plan.period==='am'?'am':'pm'};}
 for(const [k,v]of Object.entries(raw.days).slice(-2000)){
  if(!validDate(k)||!v||typeof v!=='object')continue;
  const d=emptyDay();['am','pm','workout','bath','sleep'].forEach(x=>{if(v.done?.[x])d.done[x]=true;});
  for(const p of ['foam','moisturizer','spf',...products.map(x=>x.id)])for(const period of ['am','pm']){
    const id=period+'-'+p;if(v.checks?.[id])d.checks[id]=true;if(v.skipped?.[id])d.skipped[id]=true;
  }
  d.drinks=Array.isArray(v.drinks)?v.drinks.filter(x=>x&&['water','juice','tea','coffee'].includes(x.type)&&Number.isFinite(x.ml)&&x.ml>0&&x.ml<=2000).slice(-100).map(x=>({id:String(x.id||'').slice(0,100),type:x.type,ml:x.ml,source:x.source==='thermos'?'thermos':'cup',at:num(x.at,0,1e14,0)})):[];
  for(const r of ['redness','dryness','spots','fatigue'])if(Number.isInteger(v.skin?.[r])&&v.skin[r]>=0&&v.skin[r]<=3)d.skin[r]=v.skin[r];
  d.shaved=!!v.shaved;if(typeof v.bath==='boolean')d.bath=v.bath;
  d.thermosRefills=Math.floor(num(v.thermosRefills,0,10,0));d.notes=String(v.notes||'').slice(0,2000);
  if(v.sleep&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v.sleep.bed)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v.sleep.wake)){
    d.sleep={bed:v.sleep.bed,wake:v.sleep.wake,latency:num(v.sleep.latency,0,90,20),quality:num(v.sleep.quality,1,5,3)};
    d.sleep.minutes=sleepMinutes(d.sleep.bed,d.sleep.wake,d.sleep.latency);
  }
  if(v.workout&&typeof v.workout==='object'){
   d.workout={sets:{},started:num(v.workout.started,0,1e14,0),ended:num(v.workout.ended,0,1e14,0),effort:num(v.workout.effort,1,10,5)};
   for(const id of Object.keys(exercises))if(Array.isArray(v.workout.sets?.[id]))d.workout.sets[id]=v.workout.sets[id].slice(0,3).map(x=>x?{n:num(x.n,1,300,1),kg:num(x.kg,0,100,0)}:null);
  }
  out.days[k]=d;
 }
 out.photos=Array.isArray(raw.photos)?raw.photos.filter(x=>x&&validDate(x.date)&&['front','left','right'].includes(x.slot)&&typeof x.data==='string'&&x.data.length<700000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=\r\n]+$/.test(x.data)).slice(-30).map(x=>({id:String(x.id).slice(0,100),date:x.date,slot:x.slot,data:x.data})):[];
 out.handled=Array.isArray(raw.handled)?raw.handled.filter(x=>typeof x==='string').slice(-50):[];
 return out;
}
function totals(d){return d.drinks.reduce((a,x)=>{a.all+=x.ml;if(x.type==='water')a.water+=x.ml;if(x.source==='thermos')a.thermos+=x.ml;if(x.type==='juice')a.juice+=x.ml;return a;},{all:0,water:0,thermos:0,juice:0});}
function carePlan(state,date,period){
 const p=phase(state.settings,date),d=day(state,date);
 let list=period==='am'?['foam','moisturizer','spf']:['foam','moisturizer'];
 const extra=products.filter(x=>state.settings.productDays[x.id]?.days.includes(p)&&state.settings.productDays[x.id].period===period).map(x=>x.id);
 list=[...new Set([...list,...extra])];
 const order=['oil','foam','azelik','bha','txa','peptide','eye','moisturizer','spf','gua'];
 list.sort((a,b)=>order.indexOf(a)-order.indexOf(b));
 return list.map(id=>({ ...products.find(x=>x.id===id),key:period+'-'+id,checked:!d.skipped[period+'-'+id]&&!!(d.done[period]||d.checks[period+'-'+id]),skipped:!!d.skipped[period+'-'+id] }));
}
function training(state,date){const p=phase(state.settings,date),d=day(state,date),bath=d.bath??state.settings.bathDays.includes(p);
 return {planned:state.settings.trainingDays.includes(p)&&!bath,bath,light:(d.sleep?.minutes!=null&&d.sleep.minutes<360)||(d.skin.fatigue??0)>=2,
 ids:p===2?['row','bird','side','wall']:['row','dead',state.settings.roller?'roller':'plank','bird']};}
function stats(state,end,count=7){
 const keys=Array.from({length:count},(_,i)=>shift(end,i-count+1));
 const recorded=keys.filter(k=>state.days[k]);
 const logged=recorded.map(k=>state.days[k]),sleep=logged.filter(d=>d.sleep),drink=logged.filter(d=>d.drinks.length);
 return {keys,recorded:recorded.length,workouts:logged.filter(d=>d.done.workout).length,sleepN:sleep.length,sleepMean:sleep.length?sleep.reduce((s,d)=>s+d.sleep.minutes,0)/sleep.length:null,
 waterN:drink.length,waterMean:drink.length?drink.reduce((s,d)=>s+totals(d).water,0)/drink.length:null,
 careDone:logged.reduce((n,d)=>n+(d.done.am?1:0)+(d.done.pm?1:0),0)};
}
function insights(state,date){
 const a=stats(state,date,7),out=[];
 if(a.recorded===0)return [{title:'Начнём с наблюдений',text:'Отмечай воду, сон и уход. По мере записей здесь появится твоя сводка.'}];
 if(a.sleepN)out.push({title:'Сон: '+Math.round(a.sleepMean/6)/10+' ч в среднем',text:'По '+a.sleepN+' записям за 7 дней. '+(a.sleepMean<420?'Сна меньше обычного ориентира 7–9 часов. Приоритет — больше времени на сон.':'Следи также за бодростью утром и регулярностью.')});
 out.push({title:a.workouts+' тренировок за 7 дней',text:'Уход отмечен '+a.careDone+' раз. Пропущенные записи не считаются плохим самочувствием.'});
 const d=day(state,date);
 if((d.skin.redness??0)>=2||(d.skin.dryness??0)>=2)out.push({title:'Кожа просит внимания',text:'Есть запись о заметном раздражении. Не добавляй новые активы; если реакция сохраняется или усиливается, обратись к дерматологу.'});
 if(a.waterN)out.push({title:'Вода: '+Math.round(a.waterMean)+' мл в день с записями',text:'По '+a.waterN+' дням. Это учтённая вода, а не точная оценка потребности организма.'});
 const rated=Object.entries(state.days).filter(([k])=>k>=shift(date,-29)&&k<=date).map(([,d])=>d).filter(x=>x.skin.redness!=null),shaved=rated.filter(x=>x.shaved),other=rated.filter(x=>!x.shaved);
 if(shaved.length>=3&&other.length>=3){const avg=x=>x.reduce((n,d)=>n+d.skin.redness,0)/x.length;
 if(avg(shaved)-avg(other)>=0.7)out.push({title:'Наблюдение: бритьё и покраснение',text:'В дни с бритьём средняя отметка покраснения выше. Это совпадение в журнале, а не доказанная причина.'});}
 const sessions=Object.entries(state.days).sort(([a],[b])=>a.localeCompare(b)).map(([,d])=>d).filter(x=>x.done.workout&&x.workout).slice(-2);
 if(sessions.length===2&&sessions.every(x=>x.workout.effort<=6))out.push({title:'Можно оценить следующий шаг',text:'Две записанные тренировки ощущались умеренными. Если техника уверенная и боли нет, добавь один повтор в подходе, без автоматического увеличения веса.'});
 return out;
}
const api={nextWake,phases,products,exercises,dateKey,validDate,shift,phase,defaults,emptyDay,day,timeMinutes,clock,sleepMinutes,normalize,totals,carePlan,training,stats,insights};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Core=api;
})(typeof window!=='undefined'?window:globalThis);
