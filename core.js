export const STORAGE_KEY='cixu.progress.v1';
export const DAY=86400000;
// IDs removed when duplicate OCR entries were merged during proofreading.
const LEGACY_IDS={
 '978bbb7dbb0856f7':'02845dd3e44eb5ce', // extraordinarily, 2014
 'f3a2ea81f46b75a7':'f906f741e7edbc73', // grimly, 2021
 '60b3063940715f9a':'d0d00b387c6a69ba', // deliberately, 2013
 '051ba5c767205813':'14f5576b84e67954'  // vague, 2019
};
export function dateKey(time=Date.now()){const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function emptyState(){return {version:1,progress:{},favorites:[],history:{},settings:{goal:30,batch:20,voice:'en-US',rate:0.85,shuffle:true},session:null};}
export function normalizeAnswer(s){return s.toLowerCase().normalize('NFKC').replace(/[’‘]/g,"'").replace(/[.…]+/g,' ').replace(/\s+/g,' ').trim();}
export function schedule(previous,grade,now=Date.now()){
 const p=previous||{reps:0,interval:0,lapses:0,seen:0};
 let interval=0,reps=p.reps||0,lapses=p.lapses||0;
 if(grade==='again'){reps=0;lapses++;interval=0;}
 else if(grade==='hard'){interval=Math.max(1,Math.round((p.interval||0)*1.2));reps++;}
 else{interval=reps===0?1:reps===1?3:Math.max(7,Math.round((p.interval||3)*2.2));reps++;}
 return {reps,interval,lapses,seen:(p.seen||0)+1,last:now,due:now+(grade==='again'?600000:interval*DAY)};
}
export function statusOf(p,now=Date.now()){if(!p)return 'new';if(p.due<=now)return 'due';if(p.interval>=21)return 'mastered';return 'learning';}
export function validateState(value,ids){
 if(!value||value.version!==1||typeof value.progress!=='object'||Array.isArray(value.progress)||!value.progress||!Array.isArray(value.favorites)||!value.history||typeof value.history!=='object'||Array.isArray(value.history))throw Error('备份格式不正确，请选择本网站导出的 JSON 文件。');
 const out=emptyState();
 const currentId=id=>ids.has(id)?id:(ids.has(LEGACY_IDS[id])?LEGACY_IDS[id]:null);
 for(const [oldId,p]of Object.entries(value.progress)){const id=currentId(oldId);if(!id)continue;if(!p||!['reps','interval','lapses','seen','last','due'].every(k=>Number.isFinite(p[k])&&p[k]>=0))throw Error('备份中的学习记录无效。');if(!out.progress[id]||p.last>out.progress[id].last)out.progress[id]={reps:p.reps,interval:p.interval,lapses:p.lapses,seen:p.seen,last:p.last,due:p.due};}
 out.favorites=[...new Set(value.favorites.map(currentId).filter(Boolean))];
 for(const [day,h]of Object.entries(value.history)){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!h||!Number.isFinite(h.reviews)||h.reviews<0||!Number.isFinite(h.correct)||h.correct<0||h.correct>h.reviews||!Array.isArray(h.ids))throw Error('备份中的统计记录无效。');out.history[day]={reviews:h.reviews,correct:h.correct,ids:[...new Set(h.ids.map(currentId).filter(Boolean))]};}
 const s=value.settings||{};out.settings={goal:Math.min(500,Math.max(1,Math.round(Number(s.goal)||30))),batch:Math.min(100,Math.max(5,Math.round(Number(s.batch)||20))),voice:s.voice==='en-GB'?'en-GB':'en-US',rate:[0.65,0.85,1].includes(s.rate)?s.rate:0.85,shuffle:s.shuffle!==false};
 if(value.session&&Array.isArray(value.session.queue)){const q=value.session.queue.map(currentId).filter(Boolean);const n=value.session.index;if(q.length<=1000&&Number.isInteger(n)&&n>=0&&n<=q.length)out.session={queue:q,index:n,year:String(value.session.year||'all'),mode:['cards','spell','listen'].includes(value.session.mode)?value.session.mode:'cards',correct:Number(value.session.correct)||0,answered:Number(value.session.answered)||0};}
 return out;
}
export function makeQueue(words,state,{year='all',kind='all',now=Date.now(),random=Math.random}={}){
 let pool=words.filter(w=>year==='all'||String(w.year)===String(year));
 if(kind==='favorites')pool=pool.filter(w=>state.favorites.includes(w.id));
 if(kind==='mistakes')pool=pool.filter(w=>(state.progress[w.id]?.lapses||0)>0);
 if(kind==='due')pool=pool.filter(w=>state.progress[w.id]?.due<=now);
 const shuffle=a=>{if(state.settings.shuffle)for(let i=a.length-1;i>0;i--){let j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const due=shuffle(pool.filter(w=>state.progress[w.id]?.due<=now));
 const fresh=shuffle(pool.filter(w=>!state.progress[w.id]));
 const rest=shuffle(pool.filter(w=>state.progress[w.id]&&state.progress[w.id].due>now));
 const available=kind==='all'||kind==='due'?[...due,...fresh]:[...due,...fresh,...rest];
 return available.slice(0,state.settings.batch).map(w=>w.id);
}
