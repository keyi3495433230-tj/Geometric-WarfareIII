import test from 'node:test';
import assert from 'node:assert/strict';
import yard from './yard.js';

function setup(){
  const player={x:0,z:40,hp:100,cash:500,kills:0,deaths:0,lastShot:0,ammoPacks:0};
  const room={phase:'playing',survival:yard.createSurvival(),members:new Map([['p',player]])};
  return {player,room,g:room.survival};
}
test('all ten windows hold for three swings and can be resealed',()=>{
  for(let index=0;index<10;index++){
    const {player,room,g}=setup();
    g.area=4;g.remaining=1;g.nextId=index+1;
    yard.stepSurvival(room,.05,1000);
    const mob=g.mobs.get(index+1),window=yard.windows[index];
    assert.equal(mob.entry,index);
    for(let i=0;i<3;i++){
      yard.stepSurvival(room,.05,1850+i*2300);
      assert.equal(g.boards[index],2-i);assert.equal(mob.entry,index);
    }
    for(let i=0;i<26;i++)yard.stepSurvival(room,.05,6500+i*50);
    assert.equal(mob.entry,null);
    Object.assign(player,{x:window.x+window.nx*1.8,z:window.z+window.nz*1.8});
    yard.survivalInput(room,player,{target:window.id,interact:true},8000);
    yard.stepSurvival(room,.05,10999);assert.equal(g.boards[index],0);
    yard.stepSurvival(room,.05,11000);
    assert.equal(g.boards[index],3);
  }
});
test('a paid gate opens for everyone exactly once; later zones cannot be skipped',()=>{
  const {player,room,g}=setup();
  const friend={...player,cash:6000};room.members.set('q',friend);
  yard.acceptPosition(g,friend,40,39);assert(friend.x<11);
  for(const gate of yard.gates){
    Object.assign(player,{x:gate.x+(gate.axis==='z'?-2:0),z:gate.z+(gate.axis==='x'?2:0),cash:gate.price-1});
    Object.assign(friend,{x:player.x,z:player.z});const otherCash=friend.cash;
    const buy={target:gate.id,interact:true};
    yard.survivalInput(room,player,buy,1000);assert.equal(g.area,gate.area-1);
    player.cash++;yard.survivalInput(room,player,buy,1050);yard.survivalInput(room,friend,buy,1050);
    assert.equal(player.cash,0);assert.equal(friend.cash,otherCash);assert.equal(g.area,gate.area);
  }
});
test('route from loading yard to spawn uses both open gateways around cover',()=>{
  const {player,room,g}=setup();player.cash=6000;
  for(const gate of yard.gates){
    Object.assign(player,{x:gate.x+(gate.axis==='z'?-2:0),z:gate.z+(gate.axis==='x'?2:0)});
    yard.survivalInput(room,player,{interact:true,target:gate.id},1);
  }
  Object.assign(player,{x:0,z:40});
  g.remaining=1;g.nextId=9;g.boards.fill(0);
  for(let i=0;i<1900 && player.hp===100;i++){
    yard.stepSurvival(room,.05,i*50);
    const m=g.mobs.get(9);
    if(m.entry===null){
      for(const c of yard.cover)assert(!(Math.abs(m.x-c.x)<c.w/2 && Math.abs(m.z-c.z)<c.d/2),'walked inside cover');
    }
  }
  assert(player.hp<100,'zombie never reached player');
});
test('a nearby aimed shot can trigger a sidestep after its hit was applied',t=>{
  t.mock.method(Math,'random',()=>.25);
  const {player,room,g}=setup();Object.assign(player,{x:3,z:42,yaw:0});
  g.remaining=1;yard.stepSurvival(room,.05,500);
  const m=g.mobs.get(1);
  Object.assign(m,{entry:null,x:3,z:37,nextSprint:9000,maxHp:100,hp:100});
  yard.survivalInput(room,player,{hits:[{id:1}],actions:[{type:'shot'}]},1000);
  assert.equal(m.hp,65);
  yard.stepSurvival(room,.05,1050);assert.equal(m.action,'dodge');assert.notEqual(m.x,3);
  t.mock.method(Math,'random',()=>.01);assert.equal(yard.sprintChance(2),.05);assert.equal(yard.sprintChance(20),.5);
  Object.assign(m,{nextSprint:1100,dodgeUntil:0});
  yard.stepSurvival(room,.05,1150);assert.equal(m.action,'sprint');
});

test('a kill is credited once and can be replayed independently by each teammate',()=>{
  const {player,room,g}=setup();
  Object.assign(player,{id:'a',name:'Alpha'});
  const other={...player,id:'b',name:'Bravo'};room.members.set('b',other);
  yard.stepSurvival(room,.05,500);
  const mob=g.mobs.get(1),shot={hits:[{id:mob.id,head:true}]};
  assert(yard.survivalInput(room,player,shot,650).lethal);
  assert.equal(yard.survivalInput(room,other,shot,650),null);
  const first=yard.survivalSnapshot(g,0),second=yard.survivalSnapshot(g,0);
  assert.deepEqual(first.kills,second.kills);
  assert.deepEqual(first.kills,[{seq:1,mob:mob.id,by:'a',name:'Alpha',x:mob.x,y:0,z:mob.z,yaw:mob.yaw,head:true}]);
  assert.equal(first.mobs.length,0);
  assert.equal(yard.survivalSnapshot(g,first.killCursor).kills.length,0);
  assert.deepEqual([player.kills,other.kills,player.cash,other.cash],[1,0,600,500]);
});

test('defence and endless continue purchasing and crossing gates past district 20',()=>{
  for(const endless of [false,true]){
    const {player,room}=setup(),g=room.survival=yard.createSurvival(endless);
    player.cash=1e6;
    for(let n=g.area+1;n<=26;n++){
      const gate=yard.gateFor(n),x=gate.x-(gate.axis==='z'?2:0),z=gate.z+(gate.axis==='x'?2:0);
      Object.assign(player,{x,z});
      const dest={x:gate.x+(gate.axis==='z'?2:0),z:gate.z-(gate.axis==='x'?2:0)};
      yard.acceptPosition(g,player,dest.x,dest.z);
      assert.deepEqual([player.x,player.z],[x,z],'crossed a closed gate '+n);
      yard.survivalInput(room,player,{interact:true,target:gate.id},n*1000);
      assert.equal(g.area,n);
      yard.acceptPosition(g,player,dest.x,dest.z);
      assert.deepEqual([player.x,player.z],[dest.x,dest.z],'open gate blocked '+n);
    }
    const w=yard.street(26).windows[0];
    Object.assign(player,{x:w.x,z:w.z+1.8});
    g.remaining=0;g.wave=80;g.nextWave=100;
    yard.stepSurvival(room,.05,200);assert.equal(g.wave,81);
    yard.stepSurvival(room,.05,250);
    const mob=[...g.mobs.values()][0];assert(mob.x>500);
    if(endless){assert.equal(mob.entry,null);assert.notEqual(mob.action,'climb');}else assert.equal(yard.durability(g,mob.entry),3);
    const snap=yard.survivalSnapshot(g,0,player);assert.equal(snap.area,26);assert.equal(snap.endless,endless);
  }
});

test('shop doors are passable and purchases and hit rewards match the credited balance',()=>{
  const {player,room,g}=setup();g.area=5;
  const shop=yard.street(5),box=shop.cover.find(p=>p.kind==='box');
  Object.assign(player,{x:shop.left+7,z:35,cash:749});
  yard.acceptPosition(g,player,player.x,28);assert.equal(player.z,28);
  Object.assign(player,{x:shop.left+13,z:35});yard.acceptPosition(g,player,player.x,28);assert.equal(player.z,35);
  Object.assign(player,{x:box.x,z:box.z+1.8});
  const use={interact:true,target:yard.interaction(g,player).id};
  yard.survivalInput(room,player,use,1200);assert.equal(player.draws,undefined);
  player.cash=1000;yard.survivalInput(room,player,use,1300);yard.survivalInput(room,player,use,1350);
  assert.equal(player.draws,undefined);assert.equal(player.cash,250);
  const offer=g.boxes[use.target],stranger={...player,id:'other'};
  yard.survivalInput(room,stranger,use,offer.ready);assert.equal(stranger.draws,undefined);
  yard.survivalInput(room,player,use,offer.ready);assert.equal(player.draws,1);
  assert.equal(player.boxWeapon,offer.weapon);assert.equal(g.boxes[use.target],undefined);
  yard.stepSurvival(room,.05,1400);
  const shot={hits:[{id:1}]},body=yard.survivalInput(room,player,shot,1500);
  assert.equal(body.reward,10);assert.equal(player.cash,260);
  const kill=yard.survivalInput(room,player,shot,1700);assert.equal(kill.reward,100);assert.equal(player.cash,360);
  assert.equal(yard.survivalInput(room,player,shot,2000),null);assert.equal(player.cash,360);
});
