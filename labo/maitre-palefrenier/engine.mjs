export const profiles={random:'Aléatoire',efficient:'Soigneur efficace',inspection:'Inspecteur méthodique',careful:'Gestionnaire prévoyant',balanced:'Stratège équilibré'};
export function rng(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=Math.imul(x^x>>>15,1|x);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
export function shuffle(a,r){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const count=(a,v)=>a.filter(x=>x===v).length;
const sum=a=>a.reduce((s,h)=>s+h.value,0);
export function slots(id,total13=6){switch(id){case 1:return Array(2).fill(h=>h.color==='blanc');case 2:return ['petit','moyen','grand'].map(v=>h=>h.size===v);case 3:return Array(4).fill(h=>h.value>=4);case 5:return Array(4).fill(h=>h.needs.includes('soins_de_sante'));case 6:return Array(5).fill(h=>h.needs.includes('nourrir'));case 7:return Array(4).fill(h=>count(h.needs,'brosser')>=2);case 8:return [h=>h.needs.length===3&&h.onlyWild];case 9:return [h=>new Set(h.needs).size===4];case 11:return Array(5).fill(h=>h.value===2);case 12:return Array(5).fill(h=>h.origin==='europe');case 13:return Array(total13).fill(()=>true);case 14:return [...Array(2).fill(h=>h.color==='brun'),...Array(3).fill(h=>h.size==='grand')];case 15:return [...Array(2).fill(h=>['amerique','ameriquedusud','ameriquedunord'].includes(h.origin.replace(/[^a-z]/g,''))),h=>h.color==='noir',...Array(2).fill(h=>h.size==='moyen')];default:return [];}}
function matched(hs,ss){const owner=Array(ss.length).fill(-1);function visit(i,seen){for(let j=0;j<ss.length;j++)if(!seen.has(j)&&(hs[i].wild||ss[j](hs[i]))){seen.add(j);if(owner[j]<0||visit(owner[j],seen)){owner[j]=i;return true;}}return false;}let n=0;hs.forEach((_,i)=>{if(visit(i,new Set()))n++;});return n;}
export function progress(g,hs=g.horses,total13=6){if(g.id===4)return hs.length===4&&sum(hs)===12?1:Math.min(.99,hs.length/4);if(g.id===10)return Math.min(1,sum(hs)/20);let ss=slots(g.id,total13);return matched(hs,ss)/ss.length;}
export function compatible(g,h,total13=6){if(g.done)return false;if(g.id===4){let a=[...g.horses,h];return a.length<=4&&sum(a)<=12&&sum(a)+(4-a.length)<=12&&sum(a)+(4-a.length)*5>=12;}if(g.id===10)return true;return progress(g,[...g.horses,h],total13)>progress(g,g.horses,total13);}
export function scenarioDefaults(scenario){return {initialBoxes:[0,2,2,3,3,4][scenario],inspectionPoints:[0,6,12,14,12,18][scenario],unlockAt:scenario===2?1:scenario===4?2:null,allowTransfer:[2,3,5].includes(scenario)};}
export function simulate(data,opt={}){
const {seed=1,scenario=1,profile='balanced',trace=false,transfer=true}=opt;
const total13=6,recycle=true;
const settings={...scenarioDefaults(scenario),...opt.settings};
if(!Number.isInteger(settings.initialBoxes)||settings.initialBoxes<1||settings.initialBoxes>4||!Number.isInteger(settings.inspectionPoints)||settings.inspectionPoints<1||settings.inspectionPoints>data.inspections.reduce((s,g)=>s+g.value,0)||!(settings.unlockAt===null||Number.isInteger(settings.unlockAt)&&settings.unlockAt>=1&&settings.initialBoxes<4))throw Error('Paramètres du scénario invalides');
let unlocked=false;
const completionQueue=[];
const world=rng(seed),decide=rng(seed^0x91e10da5),pick=(items,score)=>{if(!items.length)return undefined;if(profile==='random')return items[Math.floor(decide()*items.length)];return items.reduce((a,b)=>score(b)>score(a)?b:a);};
let horseDeck=shuffle(data.horses,world);const tail=shuffle([...horseDeck.splice(-5),null],world);horseDeck.push(...tail);
let taskDeck=shuffle(data.tasks.flatMap(t=>Array.from({length:t.quantite},()=>({...t}))),world),discard=[],hand=[],visible=[],market=[],turn=0,end=false,lastRecruit=true,prestige=0,healed=0,logs=[],honor=[],reassignments=0;
let boxes=Array.from({length:settings.initialBoxes},()=>({dirty:false,horse:null}));let inspections=[],v=0;for(const g of shuffle(data.inspections,world)){inspections.push({...g,horses:[],done:false,moved:0});v+=g.value;if(v>=settings.inspectionPoints)break;}
function log(message){if(trace)events.push(message);}let events=[];
function task(){if(!taskDeck.length&&recycle&&discard.length){taskDeck=shuffle(discard,world);discard=[];log('Pioche Tâche vide : défausse remélangée.');}return taskDeck.shift();}
function horse(){if(!horseDeck.length){end=true;return undefined;}let h=horseDeck.shift();if(h===null){end=true;log('Inspecteur révélé : ce tour est le dernier.');return undefined;}return {...h,remaining:[...h.needs],used:[],onlyWild:true};}
for(let i=0;i<3;i++){hand.push(task());visible.push(task());market.push(horse());}
function usefulness(h){const prospect={...h,onlyWild:h.used?.length?h.onlyWild:h.needs.length===3};return inspections.filter(g=>compatible(g,prospect,total13)).length;}
function horseScore(h){let useful=usefulness(h),missing=h.remaining.length,available=hand.filter(t=>t.actions_au_choix.some(a=>h.remaining.includes(a))).length;return profile==='efficient'?10/(missing+1)+available:profile==='inspection'?useful*10+available-missing:profile==='careful'?available*4-missing*2+useful:useful*5+available*2-missing;}
function taskScore(t){let active=boxes.filter(b=>b.horse).map(b=>b.horse);let val=Math.max(0,...active.map(h=>t.actions_au_choix.some(a=>h.remaining.includes(a))?8+usefulness(h):0),...market.map(h=>t.actions_au_choix.some(a=>h.remaining.includes(a))?2:0));if(t.actions_au_choix.includes('nettoyer'))val=Math.max(val,boxes.some(b=>b.dirty)?6:profile==='careful'?4:1);if(t.id==='soins_de_base'||t.id==='soins_universels')val+=1;return val;}
function assign(h){let gs=inspections.filter(g=>compatible(g,h,total13));let g=pick(gs,g=>progress(g,[...g.horses,h],total13)-progress(g,g.horses,total13));if(g){g.horses.push(h);log(`${h.name} → inspection ${g.id}.`);if(progress(g,g.horses,total13)===1){g.done=true;g.transferQuota=Math.floor(g.horses.length/2);completionQueue.push(g);log(`Inspection ${g.id} accomplie.`);}}else{honor.push(h);log(`${h.name} → Champ d’honneur.`);}}
while(!end&&turn<150){turn++;events=[];log(`Début du tour ${turn}.`);
if(!lastRecruit){let h=horse();if(h)log(`Recrutement obligatoire : ${h.name} défaussé.`);}lastRecruit=false;
// Step 1: discard only before drafting. Random keeps/discards independently.
hand=hand.filter(t=>{let drop=profile==='random'?decide()<.45:taskScore(t)<4;if(drop){discard.push(t);log(`Défausse : ${t.nom}.`);}return !drop;});
while(hand.length<5){if(visible.length===3&&visible.every(t=>t.id===visible[0].id)){discard.push(...visible);visible=[];for(let i=0;i<3;i++){let t=task();if(t)visible.push(t);}log('Trois tâches identiques : renouvellement.');continue;}
let choices=[...visible,{id:'blind',nom:'Pioche cachée'}];let t=pick(choices,t=>t.id==='blind'?1.5:taskScore(t));if(!t)break;if(t.id==='blind'){t=task();if(!t)break;}else{visible.splice(visible.indexOf(t),1);let n=task();if(n)visible.push(n);}hand.push(t);log(`Pioche : ${t.nom}${t.unites===2?' ×2':''}.`);}
// Step 2: cleaning does not consume the step 4 allowance.
for(let b of boxes.filter(b=>b.dirty&&!b.horse)){let t=pick(hand.filter(t=>t.actions_au_choix.includes('nettoyer')),t=>t.id==='nettoyer'?2:1);if(t&&(profile!=='random'||decide()<.8)){hand.splice(hand.indexOf(t),1);discard.push(t);b.dirty=false;log('Nettoyage d’un box (étape 2).');}}
// Step 3: at most one arrival.
let free=boxes.find(b=>!b.dirty&&!b.horse);if(free&&market.length){let h=pick(market,horseScore);free.horse=h;market.splice(market.indexOf(h),1);let n=horse();if(n)market.push(n);lastRecruit=true;log(`Accueil de ${h.name} : ${profile==='random'?'choix aléatoire':`priorité ${profiles[profile]}`}.`);}
let limit=boxes.length,played=0;
for(;played<limit;played++){let choices=[];for(let t of hand)for(let b of boxes)if(b.horse)for(let a of t.actions_au_choix)if(b.horse.remaining.includes(a))choices.push({t,b,a});let c=pick(choices,c=>horseScore(c.b.horse)+Math.min(c.t.unites,count(c.b.horse.remaining,c.a))*2+(c.b.horse.remaining.length<=c.t.unites?4:0));if(!c)break;let {t,b,a}=c;hand.splice(hand.indexOf(t),1);for(let i=0;i<t.unites;i++){let idx=b.horse.remaining.indexOf(a);if(idx>=0)b.horse.remaining.splice(idx,1);}b.horse.used.push(t);b.horse.onlyWild&&=['soins_de_base','soins_universels'].includes(t.id);log(`${t.nom}${t.unites===2?' ×2':''} → ${b.horse.name} (${b.horse.remaining.length} besoin(s) restant(s)).`);}
function resolveTransfers(){while(completionQueue.length){const g=completionQueue.shift();if(!transfer||!settings.allowTransfer)continue;for(const h of [...g.horses]){if(g.moved>=g.transferQuota||inspections.every(x=>x.done))break;if(inspections.some(other=>other!==g&&compatible(other,h,total13))){g.horses.splice(g.horses.indexOf(h),1);g.moved++;reassignments++;log(`Réaffectation de ${h.name} depuis l’inspection ${g.id} (quota ${g.transferQuota}).`);assign(h);}}}}
function resolveHonor(){while(honor.length>=3&&!inspections.every(g=>g.done)){const candidates=honor.filter(h=>inspections.some(g=>compatible(g,{...h,wild:true},total13)));let h=pick(candidates,h=>h.value);if(!h)break;honor.splice(honor.indexOf(h),1);honor.splice(0,2);log(`Champ d’honneur : ${h.name} devient un joker, deux chevaux défaussés.`);assign({...h,wild:true});resolveTransfers();}}
for(let b of boxes)if(b.horse&&!b.horse.remaining.length){let h=b.horse;prestige+=h.value;healed++;discard.push(...h.used);b.horse=null;b.dirty=true;assign(h);resolveTransfers();resolveHonor();if(inspections.every(g=>g.done))break;}

if(inspections.every(g=>g.done)){end=true;log('Victoire immédiate : toutes les inspections sont accomplies.');}
if(!end&&!unlocked&&settings.unlockAt!==null&&inspections.filter(g=>g.done).length>=settings.unlockAt){unlocked=true;boxes.push({dirty:false,horse:null});log(`Nouveau box ouvert : ${boxes.length} box après ${inspections.filter(g=>g.done).length} inspection(s) accomplie(s).`);}
if(hand.length>5||played>limit)throw Error('Invariant de tour violé');
const taskCount=hand.length+visible.length+taskDeck.length+discard.length+boxes.reduce((s,b)=>s+(b.horse?.used.length??0),0);
if(taskCount!==45)throw Error('Conservation des 45 cartes Tâche violée');
if(boxes.some(b=>b.horse&&b.dirty))throw Error('Cheval dans un box sale');
if(trace)logs.push({turn,events:[...events],hand:hand.map(t=>t.nom),boxes:boxes.map(b=>({dirty:b.dirty,name:b.horse?.name,remaining:b.horse?.remaining})),inspections:inspections.map(g=>({id:g.id,done:g.done,progress:progress(g,g.horses,total13),horses:g.horses.map(h=>h.name)})),prestige});
}
return {seed,scenario,settings,profile,win:inspections.every(g=>g.done),healed,turns:turn,prestige,reassignments,ended:end,inspections:inspections.map(g=>({id:g.id,text:g.text,done:g.done,progress:progress(g,g.horses,total13)})),logs};
}
export function interval(w,n){let p=w/n,z=1.96,d=1+z*z/n,c=(p+z*z/(2*n))/d,m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-m),Math.min(1,c+m)];}
