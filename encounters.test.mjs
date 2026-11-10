import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import yard from './yard.js';
const boxes=JSON.parse(readFileSync(new URL('./classic-collision.json',import.meta.url)));
function setup(){const g=yard.createClassic(boxes),p={id:'p',name:'test',x:0,z:25,y:2.05,hp:100,armor:100,cash:5000,scrap:100,lastShot:0,kills:0,deaths:0,seen:1000};return {g,p,room:{phase:'playing',survival:g,members:new Map([['p',p]])}};}
test('classic dog waves are 6,16,26,36 and every monster is a dog',()=>{
 for(const wave of [6,16,26,36]){const {g,room}=setup();g.wave=wave;g.remaining=3;for(let i=0;i<3;i++){yard.stepSurvival(room,.05,1000+i*1200);for(const m of g.mobs.values())assert.equal(m.type,'dog');g.mobs.clear();}}
 assert(!yard.dogWave(7));assert(!yard.dogWave(5));
});
test('armour must break before elite health is reduced',()=>{const m={armor:300,hp:400};m.hp-=yard.armouredDamage(m,200);assert.equal(m.hp,400);assert.equal(m.armor,100);m.hp-=yard.armouredDamage(m,150);assert.equal(m.hp,350);assert.equal(m.armor,0);});
test('evacuation only opens on eligible classic waves and timeout continues the match',()=>{
 const {g,p,room}=setup();g.remaining=0;g.wave=5;yard.stepSurvival(room,.05,1000);assert(g.evacAvailable);p.x=8;p.z=25;yard.survivalInput(room,p,{interact:true,target:'radio'},1100);assert(g.extraction.active);assert(g.remaining>=55);assert(!yard.requestEvac(g,1200));
 g.mobs.set(999,{id:999,type:'normal',x:35,z:35,entry:null,hp:100,maxHp:100,nextSprint:999999,nextAttack:999999});g.nextSpawn=999999;
 yard.stepSurvival(room,.05,101101);assert(g.extraction.failed);assert.equal(room.phase,'playing');assert.equal(g.remaining,0);
 g.mobs.clear();yard.stepSurvival(room,.05,101200);yard.stepSurvival(room,.05,106300);assert.equal(g.wave,6);
});
test('evacuation succeeds only after queued and living enemies are cleared',()=>{const {g,room}=setup();g.evacAvailable=true;g.wave=5;assert(yard.requestEvac(g,1000));g.remaining=0;yard.stepSurvival(room,.05,1200);assert.equal(room.phase,'finished');assert(g.evacuated);});
test('boss telegraphs three different attacks and jumping clears the rotating beam',()=>{
 const g={},m={id:1,type:'boss',hp:1000,maxHp:3000,x:0,z:0,y:0},p={x:10,y:2.05,z:0,hp:100};
 yard.specialAttack(g,m,[p],.05,1000);assert(g.hazards.some(h=>h.kind==='charge'));
 yard.specialAttack(g,m,[p],.05,10000);assert(g.hazards.some(h=>h.kind==='bomb'));
 yard.specialAttack(g,m,[p],.05,20000);assert(g.hazards.some(h=>h.kind==='laser'));
 const beam={id:1,kind:'laser',x:0,z:0,y:0,r:21,angle:0,fire:1000,end:5000,nextHit:0};let damage=0;
 yard.stepHazards({hazards:[{...beam}]},[p],1000,(_,n)=>damage+=n);assert.equal(damage,28);
 damage=0;p.y=3.1;yard.stepHazards({hazards:[{...beam}]},[p],1000,(_,n)=>damage+=n);assert.equal(damage,0);
});
test('helicopter purchase is gated by scrap and workbench distance, with three rockets and thirty seconds',()=>{
 const {g,p,room}=setup();yard.survivalInput(room,p,{actions:[{type:'chopper-buy'}]},1000);assert(!p.chopperUntil);
 [p.x,p.z]=g.stations[4];yard.survivalInput(room,p,{actions:[{type:'chopper-buy'}]},2000);assert.equal(p.chopperUntil,32000);assert.equal(p.chopperRockets,3);assert.equal(p.scrap,0);assert.equal(p.cash,5000);
 for(let i=0;i<4;i++){const id=100+i;g.mobs.set(id,{id,type:'normal',x:0,z:0,hp:1000,maxHp:1000,entry:null});yard.survivalInput(room,p,{hits:[{id,rocket:true}]},3000+i*1000);assert.equal(g.mobs.get(id).hp,i<3?200:1000);}
 assert.equal(p.chopperRockets,0);
});
test('helicopter rocket explodes across nearby enemies and spends only one round',()=>{const {g,p,room}=setup();p.chopperUntil=31000;p.chopperRockets=3;for(const id of [800,801])g.mobs.set(id,{id,type:'normal',x:id===800?0:2,z:0,hp:1000,maxHp:1000,entry:null});yard.survivalInput(room,p,{actions:[{type:'chopper-rocket',x:0,z:0}]},1000);assert.equal(p.chopperRockets,2);assert.equal(g.mobs.get(800).hp,200);assert.equal(g.mobs.get(801).hp,200);});
test('helicopter operator is invulnerable for thirty seconds and damage resumes afterward',()=>{const p={hp:100,armor:100,chopperUntil:31000,combatTime:1000};yard.applyDamage(p,150);assert.equal(p.hp,100);assert.equal(p.armor,100);p.combatTime=31001;yard.applyDamage(p,150);assert.equal(p.hp,50);assert.equal(p.armor,0);});
