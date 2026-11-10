import {auth,currentAccount,backgroundImage} from './accounts.mjs';
import {createSurvival} from './survival.mjs';
import yard from './yard.js';
import Dust from './dust.js';
import {avatarImage} from './avatars.mjs';
import {social,score,playerCode,matchPortrait,saveMatch,endlessState,dailyChampion} from './social.mjs';
import * as demolition from './demolition.mjs';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
const classicBoxes=JSON.parse(readFileSync(new URL('./classic-collision.json',import.meta.url)));
const statFile=process.env.GW_STATS_FILE||'gw-daily.json';
const day=()=>new Date(Date.now()+28800000).toISOString().slice(0,10);
let stats;try{stats=JSON.parse(readFileSync(statFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
function today(){if(stats?.day!==day())stats={day:day(),count:0,solo:{}};return stats;}
function save(){writeFileSync(statFile+'.tmp',JSON.stringify(stats));renameSync(statFile+'.tmp',statFile);}
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const iceServers=process.env.VOICE_ICE_SERVERS?JSON.parse(process.env.VOICE_ICE_SERVERS):undefined;
const visitors = new Map();
const matchQueue=new Map();
const virtualReservations=new Map();
function virtualModes(now){
  for(const [id,v] of visitors)if(now-v.seen>45000)visitors.delete(id);
  for(const [id,v] of virtualReservations)if(now>=v.until)virtualReservations.delete(id);
  const modes=[];
  for(let i=0;i<Math.max(0,displayCount(visitors.size,now)-visitors.size);i++){
    const cycle=Math.floor((now+i*17000)/60000),phase=(now+i*17000)%60000;
    modes.push(cycle%3===0?(phase<15000?'matching':'pvp'):cycle%3===1?'zombies':'pvp');
  }
  if(modes.filter(m=>m==='pvp').length===1)modes[modes.indexOf('pvp')]='matching';
  return modes.map((mode,i)=>virtualReservations.has(i)?'pvp':mode);
}

const matchNames=['我爱吃西瓜','风吹麦浪','橘子汽水','星河旅人','月下听风','一碗蛋炒饭','小熊不熬夜','晚风有信','山海之间','追风少年','柠檬不加糖','云边小店','雨后初晴','半夏微凉','一只小橘猫','银河邮差','清晨的面包','向日葵同学','海盐冰淇淋','路过的骑士','北岸晚星','南山看云','薄荷味夏天','山间有清风','一口小布丁','红豆糯米团','星星打瞌睡','夏日冰可乐','青柠乌龙茶','快乐小土豆','奶茶少放糖','秋日漫游','白昼流星','远方的灯塔','落日飞车','清风拂柳','等一场花开','沙漠里的鱼','咸鱼也冲锋','一只大西瓜','今天吃火锅','小鹿过山丘','长街听雨','桃子乌龙','周末去看海','山顶有风','熊猫爱竹子','披萨加芝士','纸飞机飞远','蓝天白云朵',...Array.from({length:50},(_,i)=>'游客_'+(1491+i*137))];
function matchBot(){
  return {id:randomUUID(),bot:true,matchBot:true,difficulty:'veteran',ready:true,name:matchNames[Math.floor(Math.random()*matchNames.length)],weapon:'m4a1',armorLevel:1,armor:100,hp:100,cash:500,xp:0,kills:0,deaths:0,progress:0,x:0,y:2,z:0,yaw:0,seen:Date.now(),lastShot:0};
}
let crowdSlot=-1,crowdBoost=0;
function displayCount(real,now){
  if(real>=5)return real;
  const slot=Math.floor(now/2700000);
  if(slot!==crowdSlot){crowdSlot=slot;crowdBoost=slot%2===0&&Math.random()<.6?1+Math.floor(Math.random()*3):0;}
  return Math.max(2,real)+crowdBoost;
}
const rooms = new Map();
const sessions = new Map();
function publicMember(p){const {token,profile,signals,lastReply,lastSequence,...member}=p;return member;}
function countGame(p,room,phase=room.phase){
  if(p.bot||p.counted)return;
  if(room.practice){p.counted=true;return;}
  rules.commitScore(room,p.profile);
  score(p.profile,'games');p.counted=true;
  const players=[...(room.departed||[]),...room.members.values()],others=players.filter(q=>q.id!==p.id);
  const coop=!!room.survival;
  const win=['tdm','bomb'].includes(room.mode)?room.winTeam===p.team:room.winner===p.id;
  const tally=['tdm','bomb'].includes(room.mode)&&room.score?[room.score[p.team]||0,room.score[1-p.team]||0]:
    [p.kills||0,Math.max(0,...others.map(q=>q.kills||0))];
  saveMatch(p.profile,{id:p.id,durationSec:(p.playMs||0)/1000,time:Date.now(),mode:room.mode,others:others.map(q=>q.name+(q.bot?'（人机）':'')),
    area:room.survival?.maxArea,cash:p.cash,kills:p.kills||0,score:coop?null:tally,wave:coop?room.survival.wave:null,alive:p.hp>0,
    outcome:phase==='abandoned'?'对局中断':phase!=='finished'?'中途离开':coop?(room.survival.evacuated?(p.hp>0?'撤离成功':'阵亡'):room.survival.cleared?'50 波通关':p.hp>0?'存活':'阵亡'):win?'胜利':'失败'});
}
function hostResults(room,p,msg){
  if(p.id!==room.localHost || !Array.isArray(msg.results))return;
  if(room.members.has(msg.winner))room.winner=msg.winner;
  if([0,1].includes(msg.winTeam))room.winTeam=msg.winTeam;
  if(room.survival && Number.isSafeInteger(msg.wave))room.survival.wave=msg.wave;
  if(room.mode==='endless'){
    if(Number.isSafeInteger(msg.maxArea))room.survival.maxArea=Math.max(1,Math.min(1000,msg.maxArea));
    if(msg.evacuated===true && msg.phase==='finished' && msg.wave>0 && msg.wave%10===0)room.survival.evacuated=true;
  }
  if(room.mode==='horde'&&msg.phase==='finished'&&msg.wave===50&&msg.cleared===true)room.survival.cleared=true;
  if(Array.isArray(msg.score)&&msg.score.length===2&&msg.score.every(n=>Number.isInteger(n)&&n>=0&&n<=(room.mode==='tdm'?60:3)))room.score=msg.score;
  for(const r of msg.results.slice(0,room.limit)){
    const member=room.members.get(r.id);if(!member)continue;
    if(room.mode==='endless' && Number.isFinite(r.cash))member.cash=Math.min(10000000,Math.max(0,r.cash));
    if(Number.isFinite(r.hp))member.hp=Math.max(0,Math.min(999,r.hp));
    if(r.team===0||r.team===1)member.team=r.team;
    if(Number.isFinite(r.playMs))member.playMs=Math.max(member.playMs||0,Math.min(r.playMs,(Date.now()-(room.hostSince||Date.now()))+(room.priorPlay?.[r.id]||0)));
    if(room.survival && Number.isInteger(r.dogKills) && r.dogKills>(member.dogKills||0) && r.dogKills<=r.kills){
      rules.queueScore(room,member.profile,'dogs',r.dogKills-(member.dogKills||0));member.dogKills=r.dogKills;
    }
    for(const key of ['kills','deaths']){
      const n=r[key];if(!Number.isSafeInteger(n)||n<=member[key]||n-member[key]>1000)continue;
      if(key==='kills'||room.survival)rules.queueScore(room,member.profile,key==='kills'?(room.survival?'zombies':'kills'):'zombiesDeaths',n-member[key]);
      member[key]=n;
    }
  }
  if(msg.phase==='finished')for(const member of room.members.values()){
    if(!member.bot&&!member.counted){
      if(!room.survival && (msg.winner===member.id || ['tdm','bomb'].includes(room.mode) && (member.team===0||member.team===1) && member.team===msg.winTeam))rules.queueScore(room,member.profile,'wins');
      countGame(member,room,'finished');
    }
  }
}
function leave(player) {
  sessions.delete(player.token);
  const room = rooms.get(player.room);
  if(room.phase!=='waiting' && (room.phase!=='countdown'||room.round>1)){
    countGame(player,room);
    (room.departed??=[]).push({id:player.id,name:player.name,kills:player.kills,bot:player.bot});
  }
  room.members.delete(player.id);
  if(room.localHost===player.id){room.localHost=null;room.phase='abandoned';for(const job of room.pending.values())job.finish(null);room.pending.clear();}
  if(player.id===room.host)room.host=[...room.members.values()].find(q=>!q.bot)?.id;
  if (!room.host) rooms.delete(player.room);
  else if(room.mode==='yard' || room.mode==='endless'||room.mode==='classic'||room.mode==='horde'){
    if(room.phase==='countdown' && room.members.size<2)room.phase='waiting';

  }
  else if((room.bomb || room.mode==='tdm') && !['waiting','finished'].includes(room.phase)){
    const teams=new Set([...room.members.values()].map(p=>p.team));if(teams.size<2)room.phase='abandoned';
  }
  else if (!['tdm','free'].includes(room.mode) && room.phase !== 'waiting' && room.phase !== 'finished') {
    room.phase = 'abandoned';
  }
}

import {matchRules} from './match-rules.mjs';
const rules=matchRules({yard,Dust,demolition,classicBoxes,score,headshot(count=1){today().count+=count;save();}});
const {beginRound,skillLevels}=rules;
setInterval(() => {
  for(const [name,room] of rooms)if(room.matchmaking && room.phase==='waiting' && Date.now()-room.created>25000){
    if(!room.members.size){rooms.delete(name);continue;}
    if(room.members.size===1){const bot=matchBot();room.members.set(bot.id,bot);beginRound(room);}
  }
  for (const p of sessions.values()) if (Date.now() - p.seen > 15000) leave(p);
}, 3000).unref();

let previousTick=Date.now();
setInterval(()=>{
  const now=Date.now(),dt=Math.min(.2,(now-previousTick)/1000);previousTick=now;
  for(const room of rooms.values()){
    if(!room.localHost){rules.tick(room,dt,now);if(room.phase==='finished')for(const p of room.members.values())countGame(p,room);}
  }
},50).unref();

http.createServer(async (req, res) => {
  const reply = (status, value) => {
    res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(value));
  };
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET') {
      const bg=path.match(/^\/backgrounds\/([0-9A-F]{12})\/([a-f0-9]{16})\.jpg$/);
      if(bg){const img=backgroundImage(bg[1],bg[2]);if(!img)return reply(404,{});res.writeHead(200,{'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff'});return res.end(img);}
      if(['/admin','/admin/','/geometric-warfare/admin','/Geometric-Warfare/admin'].includes(path)){
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'});return res.end(await readFile(new URL('./account-admin.html',import.meta.url)));
      }
      const avatar=path.match(/^\/avatars\/([A-F0-9]{12})\/([a-f0-9]{16})\.jpg$/);
      if(avatar){
        const data=avatarImage(avatar[1],avatar[2]);if(!data)return reply(404,{});
        res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'});return res.end(data);
      }
      if(path==='/stats')return reply(200,{day:today().day,count:stats.count,champion:dailyChampion()});
      if (path === '/rooms') return reply(200,[...rooms].filter(([,room])=>!room.matchmaking).map(([name,room])=>({name,mapId:room.mapId,nickname:room.nickname,allowJoin:room.allowJoin,count:room.members.size,mode:room.mode,light:room.light,phase:room.phase,limit:room.limit})));
      const file = path === '/' ? 'Geometric Warfare3.html' : decodeURIComponent(path.slice(1));
      const menuAsset=/^models\/menu-(?:classic|yard|endless|horde|duel|free|tdm|bomb)\.jpg$/.test(file);
      const modelAsset=/^models\/(?:maps\/(?:works|lanes)|attachments)(?:\/Textures)?\/[a-zA-Z0-9_-]+\.(?:glb|png)$/.test(file);
      if (!menuAsset && !modelAsset && !['player-actors.js','network.js','model-cache.js','Geometric Warfare3.html','account-ui.js','arena.js','yard.js','district-view.js','room-comms.js','daily.js','social.js','mobile.html','match-rules.mjs','demolition.mjs','classic-collision.json','models/operator-character.glb','models/first-person-arms.glb','models/zombie.glb','zombie-actors.js','models/boot-logo.png','models/game-logo.png','models/menu-reference.png','dust.js','gunsmith.js','models.js','models/three.min.js','models/PointerLockControls.js','models/GLTFLoader.js'].includes(file)) return reply(404,{});
      const data = await readFile(new URL('./' + file, import.meta.url));
      if(file==='Geometric Warfare3.html'){
        const boot=JSON.stringify(currentAccount(req)).replace(/</g,'\\u003c');
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'private,no-store','Vary':'Cookie'});
        return res.end(data.toString('utf8').replace('window.gwAccountBoot=null;',()=> 'window.gwAccountBoot='+boot+';'));
      }
      res.writeHead(200, {'Content-Type': file.endsWith('.json')?'application/json':file.endsWith('.glb')?'model/gltf-binary':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.png')?'image/png':file.endsWith('.html') ? 'text/html;charset=utf-8' : 'text/javascript;charset=utf-8'});
      return res.end(data);
    }
    if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json') return reply(405,{});
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > (path==='/local-pulse'?2097152:path==='/social'?420000:32768)) return reply(413,{}); }
    const msg = JSON.parse(raw);
    if(path.startsWith('/auth/')){
      if(req.headers['sec-fetch-site']==='cross-site')return reply(403,{error:'跨站请求已拒绝'});
      try{return reply(200,await auth(path,msg,req,res));}catch(e){return reply(400,{error:e.message});}
    }
    const account=currentAccount(req);
    if(path==='/matchmake'){
      const now=Date.now(),ticket=msg.ticket;
      if(typeof ticket!=='string'||!/^[-a-zA-Z0-9]{36}$/.test(ticket))return reply(400,{error:'无效匹配请求'});
      for(const [id,q] of matchQueue)if(now-q.seen>45000){matchQueue.delete(id);if(q.room && !rooms.get(q.room)?.members.size)rooms.delete(q.room);}
      let q=matchQueue.get(ticket);
      if(q && q.account!==(account?.id||null))return reply(403,{});
      if(msg.cancel){
        matchQueue.delete(ticket);for(const [seat,v] of virtualReservations)if(v.ticket===ticket)virtualReservations.delete(seat);
        if(q?.room){const room=rooms.get(q.room);
          if(room && room.phase==='waiting' && !room.members.size){rooms.delete(q.room);for(const other of matchQueue.values())if(other.room===q.room){other.room=null;other.started=now;}}
        }
        return reply(200,{cancelled:true});
      }
      if(!q){const seat=virtualModes(now).indexOf('matching');if(seat>=0)virtualReservations.set(seat,{ticket,until:now+6000});q={started:now,botSeat:seat,waitMs:seat>=0?1500:(Math.random()<.35?5+Math.floor(Math.random()*15):20+Math.floor(Math.random()*26))*1000,seen:now,account:account?.id||null,room:null};matchQueue.set(ticket,q);}
      q.seen=now;
      if(q.room && !rooms.has(q.room)){q.room=null;q.started=now;}
      if(!q.room){
        const rival=[...matchQueue.entries()].find(([id,other])=>id!==ticket&&!other.room&&now-other.seen<5000&&(!q.account||other.account!==q.account));
        if(rival || now-q.started>=q.waitMs){
          const name='M'+randomUUID().replaceAll('-','').slice(0,12);
          const tickets=new Set([ticket,...(rival?[rival[0]]:[])]);
          rooms.set(name,{matchmaking:true,tickets,created:now,mode:'duel',nickname:'1v1 匹配',allowJoin:false,teamCollision:true,limit:2,light:'day',phase:'waiting',round:0,startsAt:0,eventId:0,events:[],members:new Map(),matchBot:!rival});
          q.room=name;if(rival)rival[1].room=name;
        }
      }
      return reply(200,{room:q.room,elapsed:Math.floor((now-q.started)/1000)});
    }
    if(path==='/activity'){
      if(req.headers['sec-fetch-site']==='cross-site')return reply(403,{});
      if(typeof msg.device!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(msg.device))return reply(400,{});
      const now=Date.now();
      for(const [id,last] of visitors)if(now-last.seen>45000)visitors.delete(id);
      const id=account?'user:'+account.id:'device:'+msg.device;
      if(account)visitors.delete('device:'+msg.device);
      if(visitors.size<50000 || visitors.has(id))visitors.set(id,{seen:now,mode:['zombies','pvp','matching'].includes(msg.mode)?msg.mode:'home'});
      const total=displayCount(visitors.size,now),pop={zombies:0,pvp:0,matching:0};
      const roomUsers=new Map();
      for(const room of rooms.values())for(const member of room.members.values())if(!member.bot&&member.profile)roomUsers.set('user:'+member.profile,room.survival?'zombies':'pvp');
      for(const [id,visitor] of visitors){const mode=roomUsers.get(id)||visitor.mode;if(Object.hasOwn(pop,mode))pop[mode]++;}
      for(const kind of virtualModes(now))pop[kind]++;
      if(pop.pvp===1)pop.pvp=0;
      let duelPlaying=0;for(const room of rooms.values())if(room.mode==='duel'&&['countdown','playing','roundEnd'].includes(room.phase))duelPlaying+=Math.floor(room.members.size/2)*2;duelPlaying+=Math.floor(virtualModes(now).filter(kind=>kind==='pvp').length/2)*2;
      return reply(200,{count:total,...pop,duelPlaying});
    }
    if(path==='/social'){if(!account)return reply(401,{error:'请先登录账号'});const data=social(msg,rooms,sessions,account);return reply(data.error?400:200,data);}
    if(path==='/solo-stat'){
      if(!account)return reply(401,{error:'请先登录账号'});
      const s=today();
      if(msg.day!==s.day || !/^[a-f0-9-]{36}$/.test(msg.device)||!Number.isSafeInteger(msg.total)||msg.total<0||msg.total>100000)return reply(400,{});
      const prior=s.solo[msg.device]||0;if(msg.total>prior){s.count+=msg.total-prior;s.solo[msg.device]=msg.total;save();}return reply(200,{count:s.count});
    }
    if (path === '/create' || path === '/join') {
      if(typeof msg.room!=='string' || !/^[a-zA-Z0-9_-]{1,16}$/.test(msg.room)) return reply(400,{error:'房间码限 1–16 位字母、数字、短横线或下划线'});
      let room=rooms.get(msg.room);
      if(path==='/create'){
        if(room)return reply(409,{error:'房间码已被使用'});
        const mode=['coop','yard','endless','classic','horde','duel','tdm','bomb'].includes(msg.mode)?msg.mode:'free';
        room={mode,mapId:mode==='bomb'?Dust.get(msg.mapId).id:undefined,nickname:String(msg.nickname||msg.room).trim().slice(0,24)||msg.room,allowJoin:msg.allowJoin===true,teamCollision:msg.teamCollision!==false,limit:(['free','tdm','bomb'].includes(mode))?8:['yard','endless','classic','horde'].includes(mode)?4:2,light:['day','night'].includes(msg.light)?msg.light:['duel','free','tdm','bomb'].includes(mode)?'day':'night',phase:'waiting',round:0,startsAt:0,eventId:0,events:[],members:new Map()};
        if(['coop','yard'].includes(mode))room.survival=createSurvival(false);
        if(mode==='endless'){const save=endlessState(account?.id);room.survival=yard.createClassic(classicBoxes);Object.assign(room.survival,{marathon:true,maxArea:save.area,wave:save.wave+1,remaining:yard.waveCount(save.wave+1)});}
        if(mode==='classic'||mode==='horde')room.survival=yard.createClassic(classicBoxes,mode==='horde');
        rooms.set(msg.room,room);
      }
      if(!room)return reply(404,{error:'房间不存在'});
      if(room.matchmaking&&!room.tickets.has(msg.matchTicket))return reply(403,{error:'匹配已取消'});
      if(room.members.size>=room.limit || (room.phase!=='waiting' && !(room.allowJoin && ['playing','countdown'].includes(room.phase)))) return reply(409,{error:'房间已满或比赛已开始'});
      const p={publicCode:account?.id||null,guest:!account,profile:account?.id||null,id:randomUUID(),token:randomUUID(),room:msg.room,ready:false,armorLevel:1,armor:100,xp:0,cash:500,progress:0,ammoPacks:0,x:10+room.members.size*2,y:2,z:0,yaw:0,hp:100,kills:0,deaths:0,seen:Date.now(),lastShot:0};
      if(room.mode==='endless')p.cash=endlessState(p.profile).cash;
      Object.assign(p,matchPortrait(p.profile));
      p.name=account?.nick||'游客 '+(room.members.size+1);
      if(room.phase!=='waiting')rules.admit(room,p);else p.spawnX=p.x;room.host??=p.id;room.members.set(p.id,p);sessions.set(p.token,p);
      if(room.matchmaking){
        p.ready=true;matchQueue.delete(msg.matchTicket);
        if(room.matchBot){
          const bot=matchBot();
          room.members.set(bot.id,bot);
        }
        if(room.members.size===2)beginRound(room);
      }
      return reply(200,{token:p.token,id:p.id,x:p.x,z:p.z,mode:room.mode,mapId:room.mapId,limit:room.limit,iceServers});
    }
    const p = sessions.get(msg.token);
    if (!p || (p.profile && account?.id!==p.profile)) return reply(401,{error:'连接已过期'});
    if(msg.practice===true)rooms.get(p.room).practice=true;
    if(path==='/practice'){rooms.get(p.room).practice=true;return reply(200,{});}
    if (path === '/leave') { hostResults(rooms.get(p.room),p,msg);leave(p); return reply(200,{}); }
    const room=rooms.get(p.room);
    if(path==='/match-end'){if(p.id!==room.localHost)return reply(403,{});hostResults(room,p,msg);return reply(200,{});}
    if(path==='/options'){
      if(room.host!==p.id || room.phase!=='waiting')return reply(403,{error:'仅房主可设置'});
      room.nickname=String(msg.nickname||p.room).trim().slice(0,24)||p.room;room.allowJoin=msg.allowJoin===true;room.teamCollision=msg.teamCollision!==false;return reply(200,{});
    }
    if(path==='/bot-difficulty'){
      const bot=room.members.get(msg.bot);
      if(room.host!==p.id || room.phase!=='waiting' || !bot?.bot || !Object.hasOwn(skillLevels,msg.difficulty))return reply(403,{error:'仅房主可在等待时设置人机难度'});
      bot.difficulty=msg.difficulty;return reply(200,{});
    }
    if(path==='/bot'){
      if(room.host!==p.id || room.phase!=='waiting' || room.members.size>=room.limit)return reply(409,{error:'仅房主可在有空位时添加人机'});
      const bot={id:randomUUID(),bot:true,difficulty:"normal",ready:true,name:'人机 · '+(room.members.size),weapon:'m4a1',armorLevel:1,armor:100,hp:100,cash:500,xp:0,kills:0,deaths:0,progress:0,x:0,y:2,z:0,yaw:0,seen:Date.now(),lastShot:0};
      room.members.set(bot.id,bot);return reply(200,{});
    }
    if(path==='/lighting'||path==='/start'){
      if(p.id!==room.host||room.phase!=='waiting')return reply(403,{error:'仅房主可在等待时设置'});
      if(path==='/lighting'){room.light=msg.light==='day'?'day':'night';return reply(200,{});}
      if(room.members.size<2||[...room.members.values()].some(q=>q!==p&&!q.ready))return reply(409,{error:'请等待其他队员准备'});
      p.ready=true;
      if(msg.canHost && [...room.members.values()].every(q=>q===p || q.bot)){
        room.localHost=p.id;room.hostSince=Date.now();room.phase='countdown';room.pending=new Map();room.relayId=0;
        const players=[...room.members.values()].map(publicMember);
        return reply(200,{local:true,players,endlessStart:room.mode==='endless'?{wave:room.survival.wave,maxArea:room.survival.maxArea}:undefined,light:room.light,teamCollision:room.teamCollision,allowJoin:room.allowJoin,nickname:room.nickname});
      }
      beginRound(room);return reply(200,{});
    }
    if(path==='/ready'){
      p.ready=true;p.seen=Date.now();

      return reply(200,{});
    }
    if(path==='/chat'){
      const line=typeof msg.text==='string'?msg.text.trim().slice(0,200):'';
      if(line && Date.now()-(p.chatAt||0)>350){p.chatAt=Date.now();room.chat??=[];room.chat.push({name:p.name,text:line});if(room.chat.length>30)room.chat.shift();}
      return reply(200,{});
    }
    if(path==='/signal'){
      const to=room.members.get(msg.to);
      if(!to || to===p || !['offer','answer','candidate'].includes(msg.signal?.type))return reply(400,{});
      to.signals??=[];if(to.signals.length<160)to.signals.push({...msg.signal,from:p.id});return reply(200,{});
    }
    if(path==='/local-pulse'){
      if(room.localHost!==p.id)return reply(403,{});
      p.seen=Date.now();hostResults(room,p,msg);
      if(['countdown','playing','roundEnd','finished','abandoned'].includes(msg.phase))room.phase=msg.phase;
      for(const [id,body] of (Array.isArray(msg.replies)?msg.replies:[])){room.pending.get(id)?.finish(body);}
      return reply(200,{chat:room.chat||[],signals:p.signals?.splice(0)||[],members:[...room.members.values()].map(publicMember),jobs:[...room.pending].filter(([,v])=>!v.sent).map(([id,v])=>{v.sent=true;return {id,player:v.player,input:v.input};})});
    }
    if(path==='/sync' && room.localHost){
      p.seen=Date.now();if(p.id===room.localHost)return reply(200,{localPending:true});
      if(room.pending.size>=32)return reply(429,{error:'房主繁忙'});
      const id=++room.relayId,{token,...input}=msg;
      const body=await new Promise(resolve=>{
        const finish=value=>{clearTimeout(timer);room.pending.delete(id);resolve(value);};
        const timer=setTimeout(()=>finish(null),3500);
        room.pending.set(id,{player:p.id,input,finish});
      });
      if(!body)return reply(503,{error:'房主未响应'});
      return reply(200,{...body,chat:room.chat||[],signals:p.signals?.splice(0)||[]});
    }
    if (path !== '/sync') return reply(404,{});
    if(msg.canHost && !room.localHost && p.id===room.host && ['playing','countdown'].includes(room.phase) && room.members.size>1 && [...room.members.values()].every(q=>q===p||q.bot)){
      room.hostSince=Date.now();room.priorPlay=Object.fromEntries([...room.members.values()].map(q=>[q.id,q.playMs||0]));room.localHost=p.id;room.pending=new Map();room.relayId=0;
      const {grid,walk,baseBoxes,mobs,drops,...world}=room.survival||{};
      const handoff={round:room.round,phase:room.phase,startsAt:room.startsAt,eventId:room.eventId,events:room.events,score:room.score,swapped:room.swapped,bomb:room.bomb,highlights:room.highlights,
        world:mobs?{...world,mobs:[...mobs],drops:[...drops]}:null};
      return reply(200,{handoff,players:[...room.members.values()].map(publicMember),light:room.light,allowJoin:room.allowJoin,teamCollision:room.teamCollision,nickname:room.nickname});
    }
    const snapshot=rules.sync(room,p,msg);
    if(room.phase==='finished')for(const member of room.members.values())countGame(member,room,'finished');
    return reply(200,snapshot);
  } catch { reply(400,{error:'请求无效'}); }
}).listen(Number(process.env.PORT || 3080),process.env.HOST || '0.0.0.0');








