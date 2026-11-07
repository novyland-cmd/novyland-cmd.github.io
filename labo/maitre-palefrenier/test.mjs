import assert from 'node:assert/strict';
import fs from 'node:fs';
import {simulate,profiles,progress,compatible,interval,scenarioDefaults} from './engine.mjs';
const d=JSON.parse(fs.readFileSync(new URL('./data.json',import.meta.url)));
assert.equal(d.horses.length,30);assert.equal(d.tasks.reduce((s,t)=>s+t.quantite,0),45);assert(d.horses.every(h=>h.needs.length>0));
const h=(size,color,value=3)=>({size,color,value,needs:[],origin:'europe'});
let g={id:14,horses:[],done:false};let both=h('grand','brun');assert.equal(progress(g,[both]),.2,'Un cheval ne peut couvrir deux critères');assert.equal(progress(g,[both,both,both,both,both]),1);
g={id:4,horses:[h('petit','brun',5),h('petit','brun',5)],done:false};assert(!compatible(g,h('petit','brun',5)));assert(compatible(g,h('petit','brun',1)));assert.equal(progress(g,[...g.horses,h('petit','brun',1),h('petit','brun',1)]),1);
assert(!compatible({id:8,horses:[]},{needs:['nourrir','brosser','promener'],onlyWild:false}));assert(compatible({id:8,horses:[]},{needs:['nourrir','brosser','promener'],onlyWild:true}));
assert.equal(interval(0,100)[0],0);assert(interval(100,100)[1]>.99);
let total=0;for(let scenario=1;scenario<=5;scenario++)for(let profile of Object.keys(profiles))for(let seed=42;seed<142;seed++){const result=simulate(d,{scenario,profile,seed});assert(result.ended);assert(result.turns>0&&result.turns<100);assert(result.healed<=30);assert.equal(result.win,result.inspections.every(g=>g.done));total++;}
let a=simulate(d,{seed:42,trace:true}),b=simulate(d,{seed:42,trace:true});assert.deepEqual(a,b,'Relecture déterministe');assert(a.win ? a.logs.at(-1).events.some(e=>e.includes('Victoire immédiate')) : a.logs.at(-1).events.some(e=>e.includes('Inspecteur')),'Le dernier tour explique la fin de partie');
assert(a.win);assert.equal(a.turns,19,'La graine 42 doit se terminer au tour de la dernière inspection');assert(a.logs.slice(0,-1).every(t=>t.inspections.some(g=>!g.done)),'Aucun tour après la victoire');assert(!a.logs.slice(0,-1).some(t=>t.events.some(e=>e.includes('Inspecteur'))));
for(const config of [{recycle:false},{total13:6},{transfer:false}])assert(simulate(d,{...config,seed:123,scenario:4}).ended);
console.log(`Contrôles réussis : ${total} parties, conservation des cartes, box propres, critères multiples, somme exacte, soins universels, dernier tour et relecture.`);

assert.equal(progress({id:13,horses:[]},Array.from({length:5},()=>h('petit','brun'))),5/6);
assert.equal(progress({id:13,horses:[]},Array.from({length:6},()=>h('petit','brun'))),1);
assert(Array.from({length:30},(_,seed)=>simulate(d,{seed,trace:true})).some(g=>g.logs.some(t=>t.events.some(e=>e.includes('défausse remélangée')))), 'Remélange de la défausse observé');

const americas={id:15,horses:[],done:false};
assert(compatible(americas,{...h('petit','blanc'),origin:'amerique du sud'}),'Amérique du Sud admise');
assert(compatible(americas,{...h('petit','blanc'),origin:'amerique'}),'Amérique du Nord admise');
assert(!compatible(americas,{...h('petit','blanc'),origin:'europe'}),'Europe exclue du critère Amérique');

const joker={...h('petit','brun',2),wild:true};
assert.equal(progress({id:10,horses:[]},[joker]),.1,'Le joker vaut ses 2 points imprimés pour le total de 20');
assert.equal(progress({id:4,horses:[]},[h('petit','brun',3),h('petit','brun',3),h('petit','brun',4),joker]),1,'Le joker conserve 2 pour la somme exacte de 12');
assert(progress({id:4,horses:[]},[h('petit','brun',3),h('petit','brun',3),h('petit','brun',3),joker])<1,'Le joker ne transforme pas une somme de 11 en 12');
assert(compatible({id:1,horses:[],done:false},joker),'Le joker brun contourne le critère blanc');

const custom=simulate(d,{scenario:1,seed:42,trace:true,settings:{initialBoxes:1,inspectionPoints:2,unlockAt:1,allowTransfer:true}});
assert.equal(custom.settings.initialBoxes,1);assert.equal(custom.inspections.length,1);
assert(custom.logs.every(t=>t.boxes.length<=2),'Un seul box supplémentaire peut être débloqué');
assert.throws(()=>simulate(d,{settings:{initialBoxes:0}}),/invalides/);
assert.throws(()=>simulate(d,{settings:{initialBoxes:4,unlockAt:10}}),/invalides/);
const four=simulate(d,{seed:42,trace:true,settings:{initialBoxes:4,inspectionPoints:6,unlockAt:null,allowTransfer:false}});
assert(four.logs.every(t=>t.boxes.length===4));

assert.equal(scenarioDefaults(2).unlockAt,1);assert.equal(scenarioDefaults(4).unlockAt,2);
let openings=0,transfers=0;
for(const scenario of [2,4])for(let seed=0;seed<100;seed++){
 const game=simulate(d,{scenario,seed,trace:true});const completedAt=new Map();
 for(const t of game.logs){
  for(const event of t.events){const done=event.match(/^Inspection (\d+) accomplie/);if(done)completedAt.set(+done[1],t.turn);
   const moved=event.match(/depuis l’inspection (\d+)/);if(moved){transfers++;assert.equal(completedAt.get(+moved[1]),t.turn,'Transfert au tour de l’accomplissement uniquement');}}
  if(t.events.some(e=>e.startsWith('Nouveau box ouvert'))){openings++;assert(t.inspections.filter(g=>g.done).length>=scenarioDefaults(scenario).unlockAt);assert.equal(t.boxes.length,scenarioDefaults(scenario).initialBoxes+1);}
  else if(!t.inspections.every(g=>g.done)&&t.inspections.filter(g=>g.done).length>=scenarioDefaults(scenario).unlockAt)assert.equal(t.boxes.length,scenarioDefaults(scenario).initialBoxes+1);
 }
}
assert(openings>0);assert(transfers>0);
console.log('Déblocage par inspections et réaffectations à l’accomplissement vérifiés.');

const campaign=[
 {initialBoxes:2,inspectionPoints:6,unlockAt:null,allowTransfer:false},
 {initialBoxes:2,inspectionPoints:12,unlockAt:1,allowTransfer:true},
 {initialBoxes:3,inspectionPoints:14,unlockAt:null,allowTransfer:true},
 {initialBoxes:3,inspectionPoints:12,unlockAt:2,allowTransfer:false},
 {initialBoxes:4,inspectionPoints:18,unlockAt:null,allowTransfer:true}
];
campaign.forEach((expected,i)=>assert.deepEqual(scenarioDefaults(i+1),expected));
for(let seed=0;seed<30;seed++)assert.equal(simulate(d,{scenario:4,seed}).reassignments,0,'Aucune réaffectation au scénario 4');
console.log('Nouvelles valeurs de campagne vérifiées.');
