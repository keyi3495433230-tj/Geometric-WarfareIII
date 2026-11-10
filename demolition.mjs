import * as dustModule from './dust.js';
const map=dustModule.default || Dust;
export function deploy(room,now){
  room.score??=[0,0];
  const attack=(room.round-1)%2;
  room.bomb={attack,deadline:(room.startsAt??now)+90000,site:null,job:null};
  let i=0;
  for(const p of room.members.values()){
    p.team=i%2;const attacker=p.team===attack;
    p.x=(Math.floor(i++/2)-1)*2.8;p.z=attacker?37:-38;p.yaw=attacker?0:Math.PI;p.y=2;
    p.spawnX=p.x;p.spawnZ=p.z;p.spawnYaw=p.yaw;p.firedTube=false;
  }
}
export function actionSite(room,p){
  const b=room.bomb;
  if(!b || !p.hp || room.phase!=='playing')return null;
  if(b.site && p.team===b.attack || !b.site && p.team!==b.attack)return null;
  return Object.entries(map.get(room.mapId).sites).find(([id,s])=>(!b.site || b.site===id) && Math.hypot(p.x-s.x,p.z-s.z)<4.4 && p.y<map.get(room.mapId).elevation(p.x,p.z)+3.4)?.[0];
}
export function interact(room,p,now){
  const site=actionSite(room,p);
  if(!site || room.bomb.job || now>=room.bomb.deadline)return;
  room.bomb.job={id:p.id,site,x:p.x,z:p.z,end:now+(room.bomb.site?5000:3000)};
}
export function advance(room,now){
  const b=room.bomb,alive=[...room.members.values()].filter(p=>p.hp>0);
  if(!alive.some(p=>p.team!==b.attack))return b.attack;
  if(!b.site && !alive.some(p=>p.team===b.attack))return 1-b.attack;
  if(b.job){
    const j=b.job,p=room.members.get(j.id);
    if(!p || !p.hp || Math.hypot(p.x-j.x,p.z-j.z)>.8 || actionSite(room,p)!==j.site)b.job=null;
    else if(now>=j.end && j.end<=b.deadline){
      b.job=null;if(b.site)return 1-b.attack;
      b.site=j.site;b.deadline=j.end+35000;
    }
  }
  if(now>=b.deadline)return b.site?b.attack:1-b.attack;
  return null;
}
