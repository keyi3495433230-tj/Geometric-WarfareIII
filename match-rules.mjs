// The dedicated server and the solo host run the same match rules.
export function matchRules({yard,Dust,demolition,classicBoxes,score=()=>{},headshot=()=>{}}){
const {survivalInput,stepSurvival,survivalSnapshot}=yard;
function queueScore(room,code,kind='kills',amount=1){
  if(!code||room.practice)return;
  room.pendingStats??=new Map();const stats=room.pendingStats.get(code)||{};
  stats[kind]=(stats[kind]||0)+amount;room.pendingStats.set(code,stats);
}
function commitScore(room,code){
  if(room.practice)return;
  for(const [kind,amount] of Object.entries(room.pendingStats?.get(code)||{}))score(code,kind,amount);
  room.pendingStats?.delete(code);
  if(room.pendingHeads){headshot(room.pendingHeads);room.pendingHeads=0;}
}

// Town streets, lawns, courtyards and the ground floors of both houses.
const freeAnchors=[[-26,0],[26,0],[-26,4],[26,-4],[-14,15],[14,-15],[-14,-16],[14,16],
  [-34,19],[34,-19],[-36,-21],[36,21],[-8,30],[8,-30],[-18,-35],[18,35],
  [-40,6],[40,-6],[0,18],[0,-18],[9,5],[-9,-5],[-21,24],[21,-24]];
function freeSpawn(room,p){
  const town=room.spawnTown??=yard.createClassic(classicBoxes);
  room.duelGrid??=town.grid;
  const peers=[...room.members.values()].filter(q=>q!==p&&q.hp>0);
  const choices=[];
  for(const [ax,az] of freeAnchors){
    const x=ax+(Math.random()-.5)*3,z=az+(Math.random()-.5)*3;
    if(!town.walk(x,z))continue;
    const gap=Math.min(24,...peers.map(q=>Math.hypot(q.x-x,q.z-z)));
    const fresh=!Number.isFinite(p.spawnZ)||Math.hypot(x-p.spawnX,z-p.spawnZ)>7;
    choices.push({x,z,gap,fresh});
  }
  if(!choices.length){for(const [x,z] of freeAnchors)if(town.walk(x,z))choices.push({x,z,gap:0,fresh:false});}
  const safe=choices.filter(q=>q.gap>=10&&q.fresh);
  const spot=safe.length?safe[Math.floor(Math.random()*safe.length)]:choices.sort((a,b)=>b.gap-a.gap)[0];
  const yaw=Math.atan2(spot.x,spot.z);
  Object.assign(p,{spawnX:spot.x,spawnZ:spot.z,spawnYaw:yaw,x:spot.x,y:2,z:spot.z,yaw,pitch:0,stance:'stand',floorHeight:0});
}
function respawnFree(room,p,now){
  freeSpawn(room,p);Object.assign(p,{spentThrow:false,firedTube:false,stunUntil:0,hp:100,armor:(p.armorLevel||1)*100,
    poseAt:now,positionEpoch:(p.positionEpoch||0)+1,respawned:true});
}
function teamHome(room,p){
  const side=(p.team===0?1:-1)*(room.swapped?-1:1);
  const team=[...room.members.values()].filter(q=>q.team===p.team),i=Math.max(0,team.indexOf(p));
  Object.assign(p,{x:side*26,y:2,z:[0,-2,2,4][i%4],yaw:side*Math.PI/2,pitch:0,stance:'stand',poseAt:Date.now(),positionEpoch:(p.positionEpoch||0)+1});
  Object.assign(p,{spawnX:p.x,spawnZ:p.z,spawnYaw:p.yaw});
}
function respawnCombat(room,p,now){
  if(room.mode!=='tdm')return respawnFree(room,p,now);
  teamHome(room,p);Object.assign(p,{hp:100,armor:(p.armorLevel||1)*100,spentThrow:false,firedTube:false,stunUntil:0,respawned:true});
}
function beginRound(room) {
  room.round++;
  room.phase = 'countdown';
  room.startsAt = Date.now()+(room.survival || room.round>1?3000:10000);
  if(room.mode==='tdm'){
    const roster=[...room.members.values()];
    for(let i=roster.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[roster[i],roster[j]]=[roster[j],roster[i]];}
    roster.forEach((p,i)=>p.team=i%2);room.score=[0,0];room.swapped=false;
  }
  let index=0;
  for(const player of room.members.values()) {
    const side = (index++ + room.round) % 2 ? 1 : -1;
    Object.assign(player,{pendingPush:null,spentThrow:false,firedTube:false,stunUntil:0,hp:100,armor:(player.armorLevel||1)*100,x:0,y:2,z:side*18,yaw:side>0?0:Math.PI,lastShot:0});
    if(room.mode==='tdm')teamHome(room,player);else if(room.mode==='free')freeSpawn(room,player);
    else if(!room.survival){
      player.spawnX=side*26;player.spawnZ=[0,-2,2,4][Math.floor((index-1)/2)];player.spawnYaw=side*Math.PI/2;
      Object.assign(player,{x:player.spawnX,z:player.spawnZ,yaw:player.spawnYaw});
    }
    if(room.survival?.classic)Object.assign(player,{x:index*2-5,z:25,yaw:0});
    else if(room.survival){const endless=room.survival.endless;Object.assign(player,{x:(endless?90:0)+(index%2?2:-2),z:(endless?32:40)+(index<=2?0:4),yaw:Math.PI});}
  }
  if(room.mode==='bomb'){room.duelGrid??=Dust.get(room.mapId).grid(yard);demolition.deploy(room,Date.now());}
}
function replayPose(p){return [p.x,p.y,p.z,p.yaw||0,p.pitch||0,p.stance||'stand'];}
function saveHighlight(room,killer,victim,now,kind){
  const frames=[];
  for(const f of room.replayHistory||[]){
    const a=f.players.get(killer.id),b=f.players.get(victim.id);
    if(f.round===room.round && now-f.time<=5500 && a && b && a.life===killer.deaths && b.life===victim.deaths)
      frames.push([f.time-now,a.pose,b.pose]);
  }
  frames.push([0,replayPose(killer),replayPose(victim)]);
  room.highlights??=[];room.highlights.push({killer:killer.name,victim:victim.name,weapon:killer.weapon||'glock',crosshair:killer.crosshair,avatarUrl:killer.avatarUrl,backgroundUrl:killer.backgroundUrl,shots:[...room.events.filter(e=>e.by===killer.id&&e.round===room.round&&e.action==='shot'&&now-e.time<=5500).map(e=>e.time-now),0],round:room.round,kind,frames});
  if(room.highlights.length>3)room.highlights.shift();
}
const streaks={uav:2,drone:3,jammer:4,missile:5,mortar:6,juggernaut:8,chopper:10,gunship:12};
function enemy(room,p,q){return p!==q && (!(room.bomb || room.mode==='tdm') || p.team!==q.team);}
function streakEvent(room,p,kind,point,now){
  room.events.push({seq:++room.eventId,by:p.id,action:kind,x:point.x,y:point.y||0,z:point.z,round:room.round,time:now});
  if(room.events.length>150)room.events.shift();
}
function useStreak(room,p,item,now){
  const kind=item.type.slice(7),point={x:item.x,y:item.y,z:item.z};
  if(room.survival||p.stunUntil>now||!p.hp)return;
  if(![point.x,point.y,point.z].every(Number.isFinite)||Math.hypot(p.x-point.x,p.z-point.z)>150)return;
  if(kind==='fire'){
    if(!(p.airUntil>now)||now<(p.airNext||0))return;
    p.airNext=now+(p.airKind==='gunship'?850:320);
  }else{
    if(!p.rewards?.includes(kind))return;
    p.rewards.splice(p.rewards.indexOf(kind),1);
    if(kind==='uav'||kind==='jammer'){p[kind+'Until']=now+18000;return;}
    if(kind==='juggernaut'){p.heavyUntil=now+20000;p.armor=Math.max(p.armor,200);return;}
    if(kind==='chopper'||kind==='gunship'){p.airKind=kind;p.airUntil=now+15000;p.airNext=now;return;}
  }
  const drone=kind==='drone',mortar=kind==='mortar',burst=kind==='fire';
  if(drone){const target=nearest(point,room.members.values(),q=>q.hp>0&&enemy(room,p,q)&&distance(q,point)<20);if(target){point.x=target.x;point.z=target.z;}}
  const salvos=mortar?4:1;
  for(let i=0;i<salvos;i++){
    const angle=i*2.4,offset=mortar&&i?3:0;
    (room.strikes??=[]).push({by:p.id,round:room.round,x:point.x+Math.cos(angle)*offset,z:point.z+Math.sin(angle)*offset,y:point.y,
      at:now+(burst?80:drone?1300:950)+i*450,radius:burst?(p.airKind==='gunship'?7:3):mortar?6:drone?5:9,
      damage:burst?(p.airKind==='gunship'?130:55):mortar?90:200});
  }
  streakEvent(room,p,'support-in',point,now);
}
function runStrikes(room,now){
  if(!room.strikes?.length)return;
  const pending=room.strikes;room.strikes=[];
  for(const strike of pending){
    if(strike.round!==room.round||room.phase!=='playing')continue;
    if(strike.at>now){room.strikes.push(strike);continue;}
    const p=room.members.get(strike.by);if(!p)continue;
    streakEvent(room,p,'support-hit',strike,now);
    for(const q of room.members.values()){
      const gap=distance(strike,q);
      if(q.hp>0&&enemy(room,p,q)&&gap<strike.radius)pvpHit(room,p,q,Math.ceil(strike.damage*(1-.55*gap/strike.radius)),now,'support');
      if(room.phase!=='playing')break;
    }
  }
}
function supportState(room,p,now){
  if(room.survival)return;
  let scan=false,jammed=false;
  for(const q of room.members.values()){
    if(!enemy(room,p,q)&&q.uavUntil>now)scan=true;
    if(enemy(room,p,q)&&q.jammerUntil>now)jammed=true;
  }
  return {chain:p.chain||0,ready:p.rewards||[],scan:scan&&!jammed,jammed,heavy:p.heavyUntil>now,air:p.airUntil>now?p.airKind:null};
}
function combatLog(p){return p.combat??={damage:0,shots:0,hits:0,weapons:{}};}
function fired(p){const log=combatLog(p);log.shots++;const id=p.weapon||'glock';log.weapons[id]=(log.weapons[id]||0)+1;}
function pvpHit(room,shooter,target,damage,now,kind='shot'){
  if(!enemy(room,shooter,target))return null;
  shooter.lastShot=now;
  if(shooter.heavyUntil>now && (kind==='shot'||kind==='headshot'))damage*=1.35;
  const before=target.hp+(target.armor||0);
  yard.applyDamage(target,target.heavyUntil>now?Math.ceil(damage*.6):damage);
  if(room.mode==='duel'){
    const log=combatLog(shooter);log.damage+=Math.max(0,before-Math.max(0,target.hp)-Math.max(0,target.armor||0));
    if(kind==='shot'||kind==='headshot'){log.hits++;if(log.shots<log.hits)fired(shooter);}
    if(!Object.hasOwn(log.weapons,shooter.weapon||'glock'))log.weapons[shooter.weapon||'glock']=0;
  }
  const impact={head:kind==='headshot',lethal:target.hp<=0,x:target.x,y:target.y-.65,z:target.z};
  if(impact.lethal){
    target.chain=0;target.heavyUntil=target.airUntil=0;
    if(kind!=='support'){
      shooter.chain=(shooter.chain||0)+1;shooter.rewards??=[];
      for(const [id,threshold] of Object.entries(streaks))if(shooter.chain===threshold && !shooter.rewards.includes(id))shooter.rewards.push(id);
    }
    saveHighlight(room,shooter,target,now,kind);
    queueScore(room,shooter.profile);target.deaths++;shooter.kills++;shooter.cash+=250;if(!shooter.guest)shooter.xp+=100;impact.reward=250;
    if(room.mode==='bomb'){target.hp=0;}
    else if(room.mode==='tdm'){
      target.respawnAt=now+5000;const points=++room.score[shooter.team];
      if(points>=60){room.phase='finished';room.winTeam=shooter.team;for(const q of room.members.values())if(q.team===room.winTeam)queueScore(room,q.profile,'wins');}
      else if(points===30&&!room.swapped){room.swapped=true;for(const q of room.members.values())if(q.hp>0)teamHome(room,q);}
    }
    else if(room.mode==='free'){target.hp=0;target.respawnAt=now+1500;}
    else {
      room.phase='roundEnd';
      room.roundEnd={round:room.round,name:shooter.name,avatar:shooter.avatar??-1,avatarUrl:shooter.avatarUrl||null,
        until:now+2000,clip:kind==='headshot'?room.highlights.at(-1):null};
      if(shooter.kills>=3){room.winner=shooter.id;queueScore(room,shooter.profile,'wins');for(const member of room.members.values())if(!member.guest)member.xp+=50;}
    }
  }
  return impact;
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function nearest(origin,items,accept){
  let found,best=Infinity;
  for(const item of items){const d=distance(origin,item);if(d<best && accept(item)){best=d;found=item;}}
  return found;
}
const skillLevels={
  easy:{aim:4,delay:900,accuracy:.40,dodge:2400},
  normal:{aim:6,delay:620,accuracy:.59,dodge:1500},
  veteran:{aim:9,delay:430,accuracy:.76,dodge:950}
};
function stepBot(room,b,dt,now){
  b.seen=now;
  if(!b.hp){
    if(['free','tdm'].includes(room.mode)&&now>=b.respawnAt)respawnCombat(room,b,now);
    return;
  }
  if(b.stunUntil>now)return;
  const g=room.survival,grid=g?.grid || (room.duelGrid??=yard.createClassic(classicBoxes).grid);
  const visible=t=>grid.visible(b.x,b.z,t.x,t.z);
  const skill=skillLevels[b.difficulty]||skillLevels.normal;
  const players=room.members.values();
  const rescue=g && nearest(b,players,q=>q!==b && !q.hp);
  const foe=q=>q.hp>0 && enemy(room,b,q);
  const target=g?nearest(b,g.mobs.values(),m=>distance(b,m)<38 && visible(m)):(nearest(b,room.members.values(),q=>foe(q)&&visible(q))||nearest(b,room.members.values(),foe));
  const leader=room.members.get(room.host);
  const bomb=room.bomb;
  const objective=bomb && (b.team===bomb.attack?!bomb.site:!!bomb.site)?(bomb.site?Dust.get(room.mapId).sites[bomb.site]:nearest(b,Object.values(Dust.get(room.mapId).sites),()=>true)):null;
  if(objective && demolition.actionSite(room,b)){demolition.interact(room,b,now);if(bomb.job?.id===b.id)return;}
  const goal=objective && !(target && visible(target))?objective:rescue || (g?(leader?.hp?leader:nearest(b,room.members.values(),q=>!q.bot && q.hp)):target);
  const combat=target && visible(target) && !rescue;
  if(!goal)return;
  const targetFeet=(goal.y||2)-(goal.stance==='prone'?.4:goal.stance==='crouch'?1.1:2);
  const climb=g?.classic?yard.stairGoal(b,b.floorHeight||0,goal,targetFeet,g.area):goal;
  const path=grid.next(b,climb);
  let dx=path.x-b.x,dz=path.z-b.z,speed=5.4;
  if(!g && combat && distance(b,target)<30){
    if(now>=(b.nextDodge||0)){
      b.side=-(b.side||1);b.slideUntil=now+480;b.nextDodge=now+skill.dodge+Math.random()*800;
    }
    const range=distance(b,target);const forward=range>15?.65:range<6?-.85:.04;
    dx=(target.x-b.x)*forward+(target.z-b.z)*b.side;
    dz=(target.z-b.z)*forward-(target.x-b.x)*b.side;
    speed=now<b.slideUntil?10:4.8;
  }else if(g && climb===goal && distance(b,goal)<(rescue?2:3.5)){dx=dz=0;}
  const len=Math.hypot(dx,dz);
  if(len>.03 && !(b.pushUntil>now)){
    const k=Math.min(1,speed*dt/len),x=b.x+dx*k,z=b.z+dz*k;
    if(grid.visible(b.x,b.z,x,z))yard.playerMotion(room,b,x,z);
    else if(!g){b.nextDodge=0;const bypass=grid.next(b,goal),gap=distance(b,bypass);if(gap>.05){const n=Math.min(1,dt*5/gap);yard.playerMotion(room,b,b.x+(bypass.x-b.x)*n,b.z+(bypass.z-b.z)*n);}}
  }
  if(g?.classic)b.floorHeight=yard.stairFeet(b.x,b.z,b.floorHeight||0,g.area);
  b.poseAt=now;b.stance=now<b.slideUntil?'crouch':'stand';b.y+=(((b.stance==='crouch'?1.15:2)+(room.bomb?Dust.get(room.mapId).elevation(b.x,b.z):b.floorHeight||0))-b.y)*Math.min(1,dt*12);
  const aim=combat?target:path;
  const yaw=Math.atan2(b.x-aim.x,b.z-aim.z),delta=yaw-b.yaw;
  b.yaw+=Math.atan2(Math.sin(delta),Math.cos(delta))*Math.min(1,dt*skill.aim);
  b.pitch=Math.atan2((aim.y??1.9)-(combat?(b.matchBot?.05:.48):0)-b.y,Math.max(.1,distance(b,aim)));b.aim=!!combat;
  const fire=combat && Math.abs(Math.atan2(Math.sin(yaw-b.yaw),Math.cos(yaw-b.yaw)))<.17 && now-(b.lastAttempt||0)>=skill.delay;
  if(fire){
    b.lastAttempt=now;if(room.mode==='duel')fired(b);
    room.events.push({seq:++room.eventId,by:b.id,action:'shot',x:b.x,y:b.y,z:b.z,round:room.round,time:now});
    if(room.events.length>150)room.events.shift();
  }
  if(g){
    const impact=survivalInput(room,b,{use:!!rescue && (b.rescueId===rescue.id || distance(b,rescue)<2.9),rescueOnly:rescue?.id,hits:fire && Math.random()<skill.accuracy?[{id:target.id,head:Math.random()<skill.accuracy*.18}]:[],actions:fire?[{type:'shot'}]:[]},now);
    if(impact?.lethal && impact.head){room.pendingHeads=(room.pendingHeads||0)+1;}
  }else if(fire && Math.random()<skill.accuracy){
    const head=Math.random()<(b.matchBot?.38:.08);
    pvpHit(room,b,target,head?52:35,now,head?'headshot':'shot');
  }
}

function tick(room,dt,now){
    if(room.phase==='roundEnd' && now>=room.roundEnd.until){
      room.roundEnd=null;
      if(room.winner)room.phase='finished';else beginRound(room);
    }
    if(room.phase!=='playing')return;
    for(const p of room.members.values())if(!p.bot)p.playMs=(p.playMs||0)+Math.min(200,dt*1000);
    runStrikes(room,now);if(room.phase!=='playing')return;
    if(!room.survival && now>=(room.nextReplay||0)){
      room.nextReplay=now+120;room.replayHistory??=[];
      const players=new Map();
      for(const p of room.members.values())if(p.hp>0)players.set(p.id,{life:p.deaths,pose:replayPose(p)});
      room.replayHistory.push({round:room.round,time:now,players});if(room.replayHistory.length>48)room.replayHistory.shift();
    }
    for(const p of room.members.values())if(p.bot && room.phase==='playing')stepBot(room,p,dt,now);
    if(room.bomb && room.phase==='playing'){
      const win=demolition.advance(room,now);
      if(win!==null){room.score[win]++;if(room.score[win]>=3){room.phase='finished';room.winTeam=win;for(const q of room.members.values())if(q.team===win)queueScore(room,q.profile,'wins');}else beginRound(room);}
    }
    if(room.survival && room.phase==='playing'){
      stepSurvival(room,dt,now);
      for(const q of room.members.values())if(q.deaths>(q.recordedDeaths||0)){queueScore(room,q.profile,'zombiesDeaths',q.deaths-(q.recordedDeaths||0));q.recordedDeaths=q.deaths;}
    }
}
function rewindTarget(room,target,time,now){
  if(!target||!Number.isFinite(time))return target;
  const at=Math.min(now,Math.max(now-1000,time));
  let prior;
  for(const frame of room.replayHistory||[]){
    const pose=frame.players.get(target.id);
    if(frame.round!==room.round||pose?.life!==target.deaths)continue;
    if(frame.time>at){
      if(!prior)return target;
      const t=(at-prior.time)/(frame.time-prior.time);
      return {x:prior.pose[0]+(pose.pose[0]-prior.pose[0])*t,y:prior.pose[1]+(pose.pose[1]-prior.pose[1])*t,z:prior.pose[2]+(pose.pose[2]-prior.pose[2])*t};
    }
    prior={time:frame.time,pose:pose.pose};
  }
  return prior?{x:prior.pose[0],y:prior.pose[1],z:prior.pose[2]}:target;
}
function sync(room,p,msg){
    if(msg.practice===true)room.practice=true;
    if(Number.isSafeInteger(msg.sequence) && msg.sequence<=p.lastSequence && p.lastReply)return p.lastReply;
    p.seen = Date.now();
    if(room.phase==='countdown' && Date.now()>=room.startsAt)room.phase='playing';
    if(['free','tdm'].includes(room.mode)&&room.phase==='playing'&&p.hp===0 && p.seen>=p.respawnAt){
      respawnCombat(room,p,p.seen);
    }
    if(p.chopperAnchor&&p.chopperUntil>p.seen){msg.x=p.chopperAnchor.x;msg.y=p.chopperAnchor.y;msg.z=p.chopperAnchor.z;}
    const placement=(p.positionEpoch||0)!==(msg.positionEpoch||0);
    const live=!placement && !p.respawned && (room.survival || p.hp>0) && room.phase==='playing' && p.ready && (room.mode==='free' || msg.round===room.round);
    const warm=!room.survival && room.phase==='countdown' && room.round>1 && msg.round===room.round;
    if(warm){
      if(!yard.canStage(room.mode,p,msg.x,msg.z)){msg.x=p.x;msg.z=p.z;}
    }
    if ((live || warm) && [msg.x,msg.y,msg.z,msg.yaw].every(Number.isFinite) && (room.survival || (Math.abs(msg.x)<100 && Math.abs(msg.z)<100))) {
      p.y=msg.y;p.stance=['stand','crouch','prone'].includes(msg.stance)?msg.stance:'stand';
      if( (!(room.bomb||warm) || (room.duelGrid??=yard.createClassic(classicBoxes).grid).visible(p.x,p.z,msg.x,msg.z)))yard.playerMotion(room,p,msg.x,msg.z);
      if(p.pendingPush){yard.playerMotion(room,p,p.x+p.pendingPush.x,p.z+p.pendingPush.z);p.pendingPush=null;}
      p.y=msg.y;p.yaw=msg.yaw;p.poseAt=p.seen;
    }

    if(live){
      if(room.bomb && msg.bombUse)demolition.interact(room,p,p.seen);
      if(!room.survival && msg.buyArmor && Math.hypot(p.x+48.8,p.z)<3)yard.upgradeArmor(p);
      p.stance=['stand','crouch','prone'].includes(msg.stance)?msg.stance:'stand';
      p.pitch=Number.isFinite(msg.pitch)?Math.max(-1.57,Math.min(1.57,msg.pitch)):0;
      if(msg.crosshair&&typeof msg.crosshair==='object'){
        const c=msg.crosshair,out={};for(const [k,min,max] of [['size',3,28],['gap',0,20],['width',1,6],['opacity',20,100]])if(Number.isFinite(c[k]))out[k]=Math.max(min,Math.min(max,c[k]));
        if(/^#[0-9a-f]{6}$/i.test(c.color))out.color=c.color;
        if(['cross','dot','circle','t'].includes(c.style))out.style=c.style;
        for(const k of ['dot','outline','dynamic','visible'])if(typeof c[k]==='boolean')out[k]=c[k];p.crosshair=out;
      }
      p.look=!p.guest&&Number.isInteger(msg.look)?msg.look&32767:0;p.aim=msg.aim===true;p.weapon=typeof msg.weapon==='string' && /^[a-z0-9_]{1,20}$/.test(msg.weapon)?msg.weapon:'glock';
      if(Array.isArray(msg.actions)){
        for(const item of msg.actions.slice(0,10)){
          const action=item?.type;
          if(typeof action==='string' && action.startsWith('streak:')){useStreak(room,p,item,p.seen);continue;}
          if(!['shot','reload','slash','inspect','blast','stun','tube'].includes(action))continue;
          if(room.mode==='duel'&&action==='shot')fired(p);
          const point=(action==='blast'||action==='stun'||action==='tube') && [item.x,item.y,item.z].every(Number.isFinite) && Math.hypot(item.x-p.x,item.z-p.z)<150?item:p;
          room.events.push({seq:++room.eventId,by:p.id,action,x:point.x,y:point.y,z:point.z,round:room.round,time:Date.now()});
          if(!room.survival && (action==='blast'||action==='stun'||action==='tube') && !(action==='tube'?p.firedTube:p.spentThrow) && point!==p && Math.hypot(point.x-p.x,point.z-p.z)<55){
            if(action==='tube')p.firedTube=true;else p.spentThrow=true;
            const grid=(room.duelGrid??=yard.createClassic(classicBoxes).grid);
            for(const q of room.members.values()){
              if(!enemy(room,p,q) || !q.hp || Math.hypot(q.x-point.x,q.z-point.z,q.y-1-point.y)>(action==='stun'?8:6) || !grid.visible(point.x,point.z,q.x,q.z))continue;
              if(action==='stun')q.stunUntil=p.seen+1500;
              else pvpHit(room,p,q,85,p.seen,action);
              if(room.phase!=='playing')break;
            }
          }
          if(room.phase!=='playing')break;
        }
        if(room.events.length>150)room.events.splice(0,room.events.length-150);
      }
    }
    const since=Number.isSafeInteger(msg.cursor)?msg.cursor:room.eventId;
    const events=room.events.filter(e=>e.seq>since && (e.by!==p.id || e.action.startsWith('support-')) && e.round===room.round && Date.now()-e.time<1500);
    const priorKills=p.kills,priorDogs=p.dogKills||0;
    let impact=room.survival && live?survivalInput(room,p,msg,p.seen):null;
    if(p.dogKills>priorDogs)queueScore(room,p.profile,'dogs',p.dogKills-priorDogs);
    if(p.kills>priorKills)queueScore(room,p.profile,"zombies",p.kills-priorKills);
    if(impact?.lethal && impact.head){room.pendingHeads=(room.pendingHeads||0)+1;}
    const heavy=msg.hit?.kind==='heavy',melee=heavy||msg.hit?.kind==='melee';
    const target=room.members.get(msg.hit?.id??msg.hit);
    const targetPose=rewindTarget(room,target,msg.shotTime,p.seen);
    const inReach=!melee || (targetPose && ['axe','knife','karambit','butterfly'].includes(p.weapon) && Math.hypot(p.x-targetPose.x,p.z-targetPose.z,p.y-targetPose.y)<=3.8);
    if (!room.survival && room.phase==="playing" && !(p.stunUntil>p.seen) && live && target?.ready && target.hp>0 && enemy(room,p,target) && (!room.bomb || target.team!==p.team && room.duelGrid.visible(p.x,p.z,targetPose.x,targetPose.z)) && inReach && p.seen-p.lastShot>=(heavy?800:melee?400:180)) {
      const aimHeight=p.y+Math.tan(p.pitch||0)*Math.hypot(targetPose.x-p.x,targetPose.z-p.z);
      const head=!melee && msg.hit?.kind==='head' && Math.abs(aimHeight-targetPose.y)<.38;
      impact=pvpHit(room,p,target,heavy?100:melee?50:25,p.seen,melee?'slash':head?'headshot':'shot');
    }
    p.respawned=false;
    const world=room.survival?survivalSnapshot(room.survival,Number.isSafeInteger(msg.afterKill)?msg.afterKill:0,p):undefined;
    const result={clockId:room.clockId||'server',practice:!!room.practice,duelReport:room.mode==='duel'&&room.phase==='finished'?[...room.members.values()].map(q=>({
      id:q.id,level:q.profileLevel||null,code:q.publicCode||q.profile||null,name:q.name,bot:!!q.bot,avatar:q.avatar??-1,avatarUrl:q.avatarUrl||null,kills:q.kills,...combatLog(q)
    })):undefined,teamMatch:room.mode==='tdm'&&room.round>0?{score:room.score||[0,0],team:p.team,swapped:!!room.swapped,winTeam:room.winTeam,respawnMs:Math.max(0,(p.respawnAt||0)-p.seen)}:null,support:supportState(room,p,p.seen),roundEnd:room.phase==='roundEnd'?room.roundEnd:null,serverTime:Date.now(),ackSequence:msg.sequence,highlights:room.phase==='finished'&&!room.survival?(room.highlights||[]):undefined,bomb:room.bomb?{...room.bomb,team:p.team,canUse:demolition.actionSite(room,p),seconds:Math.max(0,Math.ceil((room.bomb.deadline-p.seen)/1000)),score:room.score,winTeam:room.winTeam}:undefined,host:room.host,nickname:room.nickname,allowJoin:room.allowJoin,teamCollision:room.teamCollision,light:room.light,chat:room.chat||[],signals:p.signals?.splice(0)||[],survival:world,stunMs:Math.max(0,(p.stunUntil||0)-p.seen),impact,events,cursor:room.eventId,phase:room.phase,round:room.round,winner:room.winner,introMs:Math.max(0,room.startsAt-Date.now()),countdown:Math.max(0,Math.ceil((room.startsAt-Date.now())/1000)),players:[...room.members.values()].map(({id,bot,difficulty,team,positionEpoch,crosshair,look,x,y,z,yaw,poseAt,hp,armor,armorLevel,rescueId,xp,kills,deaths,ready,stance,pitch,aim,weapon,cash,progress,ammoPacks,draws,boxWeapon,name,heavyUntil})=>({heavy:heavyUntil>p.seen,id,bot,difficulty,team,positionEpoch,crosshair,look,x,y,z,yaw,poseAt,hp,armor,armorLevel,rescueId,xp,kills,deaths,ready,stance,pitch,aim,weapon,cash,progress,ammoPacks,draws,boxWeapon,name}))};
    if(Number.isSafeInteger(msg.sequence)){p.lastSequence=msg.sequence;p.lastReply=result;}
    return result;
}
function admit(room,p){
  if(room.mode==='tdm'){const team=[...room.members.values()].filter(q=>q!==p);p.team=team.filter(q=>q.team===0).length<=team.filter(q=>q.team===1).length?0:1;p.ready=true;teamHome(room,p);return;}
  if(room.mode==='free'){p.ready=true;freeSpawn(room,p);return;}
  const partners=[...room.members.values()].filter(q=>q!==p);
  if(room.bomb){const defenders=partners.filter(q=>q.team===0).length;p.team=defenders<=partners.length/2?0:1;}
  const mate=partners.find(q=>(!room.bomb || q.team===p.team) && Number.isFinite(q.spawnX));
  const x=room.survival?(mate?.x??2):(mate?.spawnX??26),z=room.survival?(mate?.z??40):(mate?.spawnZ??0);
  Object.assign(p,{ready:true,spawnX:x,spawnZ:z,spawnYaw:mate?.spawnYaw||0,x,z,y:room.survival?(mate?.y||2):2,yaw:mate?.spawnYaw||0});
}
return {beginRound,tick,sync,skillLevels,admit,queueScore,commitScore};
}
