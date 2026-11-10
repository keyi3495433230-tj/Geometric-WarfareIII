import {accountDB,registration,backURL,saveBackground,renameAccount} from './accounts.mjs';
import yard from './yard.js';
import {avatarUrl,saveAvatar} from './avatars.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
const file=process.env.GW_SOCIAL_FILE||process.env.GW_STATS_FILE?.replace(/[^/\\]+$/,'gw-social.json')||'gw-social.json';
// Existing profiles migrate once. Only profiles touched since the last flush are cached.
accountDB.exec('CREATE TABLE IF NOT EXISTS profiles(code TEXT PRIMARY KEY,data TEXT NOT NULL);CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY)');
const put=accountDB.prepare('INSERT OR REPLACE INTO profiles VALUES(?,?)'),read=accountDB.prepare('SELECT data FROM profiles WHERE code=?');
if(!accountDB.prepare("SELECT 1 FROM migrations WHERE name='social-json'").get()){
  let old={};try{old=JSON.parse(readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  accountDB.exec('BEGIN');try{for(const [id,profile] of Object.entries(old))put.run(id,JSON.stringify(profile));
    accountDB.exec("INSERT INTO migrations VALUES('social-json');COMMIT");}catch(e){accountDB.exec('ROLLBACK');throw e;}
}
accountDB.exec(`CREATE TABLE IF NOT EXISTS leaderboard(code TEXT PRIMARY KEY,total INTEGER,day TEXT,daykills INTEGER,month TEXT,monthkills INTEGER);
CREATE INDEX IF NOT EXISTS lb_total ON leaderboard(total DESC,code);
CREATE INDEX IF NOT EXISTS lb_day ON leaderboard(day,daykills DESC,code);
CREATE INDEX IF NOT EXISTS lb_month ON leaderboard(month,monthkills DESC,code);`);
const putRank=accountDB.prepare('INSERT OR REPLACE INTO leaderboard VALUES(?,?,?,?,?,?)');
function indexScore(id,p){putRank.run(id,(p.kills||0)+(p.zombies||0),p.day?.date||'',p.day?.count||0,p.month?.date||'',p.month?.count||0);}
if(!accountDB.prepare("SELECT 1 FROM migrations WHERE name='rank-v1'").get()){
  accountDB.exec('BEGIN');try{for(const r of accountDB.prepare('SELECT code,data FROM profiles').iterate())indexScore(r.code,JSON.parse(r.data));
    accountDB.exec("INSERT INTO migrations VALUES('rank-v1');COMMIT");}catch(e){accountDB.exec('ROLLBACK');throw e;}
}
const cache=new Map(),records=new Proxy({},{
  get(_,id){if(typeof id!=='string')return;if(!cache.has(id)){const r=read.get(id);if(!r)return;cache.set(id,JSON.parse(r.data));}return cache.get(id);},
  set(_,id,value){cache.set(id,value);return true;}
});
const live=new Map(),requests=new Map();
for(const r of accountDB.prepare("SELECT code,json_extract(data,'$.pending') AS pending FROM profiles WHERE json_array_length(data,'$.pending')>0").all())
  requests.set(r.code,JSON.parse(r.pending).filter(m=>m.until>Date.now()));
let dirty=false;
function flush(){
  if(dirty){accountDB.exec('BEGIN');try{for(const [id,p] of cache){put.run(id,JSON.stringify(p));indexScore(id,p);}accountDB.exec('COMMIT');dirty=false;}catch(e){accountDB.exec('ROLLBACK');throw e;}}
  cache.clear();
}
setInterval(flush,10000).unref();
process.on('exit',flush);
process.once('SIGTERM',()=>{flush();process.exit(0);});
export function playerCode(secret){
  if(typeof secret!=='string'||!/^[a-f0-9-]{36}$/i.test(secret))return '';
  return createHash('sha256').update(secret).digest('hex').slice(0,12).toUpperCase();
}
export function matchPortrait(code){return {backgroundUrl:code?backURL(code):null,avatarUrl:code?avatarUrl(code):null,avatar:records[code]?.avatar??-1,profileLevel:code?rankInfo(records[code]||{}).level:null};}
const soloModes=new Map();
accountDB.exec(`CREATE TABLE IF NOT EXISTS friend_messages(
 id INTEGER PRIMARY KEY AUTOINCREMENT,pair TEXT NOT NULL,sender TEXT NOT NULL,recipient TEXT NOT NULL,
 nonce TEXT NOT NULL,body TEXT NOT NULL,sent INTEGER NOT NULL,UNIQUE(sender,nonce));
 CREATE INDEX IF NOT EXISTS dm_pair ON friend_messages(pair,id);
 CREATE INDEX IF NOT EXISTS dm_recipient ON friend_messages(recipient,sender,id);`);
const insertDM=accountDB.prepare('INSERT OR IGNORE INTO friend_messages(pair,sender,recipient,nonce,body,sent) VALUES(?,?,?,?,?,?)');
const trimDM=accountDB.prepare('DELETE FROM friend_messages WHERE pair=? AND id < (SELECT id FROM friend_messages WHERE pair=? ORDER BY id DESC LIMIT 1 OFFSET 29)');
const readDM=accountDB.prepare('SELECT id,sender,body,sent FROM friend_messages WHERE pair=? ORDER BY id');
const unreadDM=accountDB.prepare('SELECT count(*) AS n FROM friend_messages WHERE recipient=? AND sender=? AND id>?');
function roomStatus(profile,rooms,sessions,now){
  for(const member of sessions.values()){
    if(member.profile!==profile||now-member.seen>20000)continue;
    const room=rooms.get(member.room);if(!room)continue;
    return {mode:room.mode,roomName:room.nickname||member.room,room:member.room,phase:room.phase,joinable:room.members.size<room.limit &&
      (room.phase==='waiting'||room.allowJoin&&['playing','countdown'].includes(room.phase))};
  }
  return null;
}
function periods(now){const day=new Date(now+28800000).toISOString().slice(0,10);return {day,month:day.slice(0,7)};}
const gunNames=Object.fromEntries(yard.weapons.map(w=>[w.id,w.name]));
Object.assign(gunNames,{sp_gatling:'加特林重机枪',sp_rocket:'火箭发射器',sp_a2g:'空对地导弹',sp_smart:'智能手枪'});
const levelCost=lv=>10n<<BigInt(lv-1);
function rankInfo(p){
  let xp=BigInt(p.rankXP||0),lv=1;
  while(lv<100 && xp>=levelCost(lv)){
    if(lv===99 && (p.playSeconds||0)<=360000)break;
    xp-=levelCost(lv++);
  }
  return {level:lv,levelXP:xp.toString(),levelGoal:levelCost(lv).toString(),playSeconds:p.playSeconds||0};
}
function awardMatchXP(player,entry){
  const seconds=Math.min(86400,Math.max(0,Math.floor(Number(entry.durationSec)||0)));
  entry.durationSec=seconds;player.playSeconds=(player.playSeconds||0)+seconds;
  const {level}=rankInfo(player);
  if(level===100||seconds<1&&['中途离开','对局中断'].includes(entry.outcome)){entry.rankEarned='0';return;}
  const roll=1+Math.floor(Math.random()*30);
  // Later brackets require increasingly longer active sessions to complete a level.
  const target=3000+600*Math.floor(level/10);
  const gain=level<=10?BigInt(roll):1n+levelCost(level)*BigInt(seconds*(90+roll))/BigInt(target*105);
  entry.rankEarned=gain.toString();player.rankXP=(BigInt(player.rankXP||0)+gain).toString();
}
function profileCard(p){
  const earned={};
  if(p.wins>=1)earned.victor='首战告捷';
  if(p.zombies>=100)earned.hunter='百尸猎手';
  if(p.dogs>=50)earned.hound='猎犬克星';
  if(p.clearedHorde)earned.survivor='浪潮征服者';
  for(const [gun,value] of Object.entries(p.mastery||{}))if(value>=10000&&gunNames[gun])earned['gun_'+gun]=gunNames[gun]+'精通';
  const featured=(p.medals||[]).filter(id=>earned[id]).slice(0,3);
  return {...rankInfo(p),endlessBest:p.endlessBest||0,background:p.background||'slate',signature:p.signature||'',featured,earned};
}
export function endlessState(code){
  const p=records[code];return {wave:p?.savedWave||0,area:p?.savedArea||1,cash:p?.savedCash??500,best:p?.endlessBest||0};
}
export function saveMatch(code,entry){
  if(!code)return;
  const player=records[code]??={name:'队员 '+code.slice(-4),avatar:0,friends:[],last:Date.now(),kills:0};
  const history=player.history??=[];
  if(history.some(row=>row.id===entry.id))return;
  if(entry.mode==='endless'){
    player.endlessBest=Math.max(player.endlessBest||0,entry.wave||1);
    if(entry.alive && entry.outcome==='撤离成功' && entry.wave>0 && entry.wave%10===0){
      player.savedWave=entry.wave;player.savedArea=Math.max(1,Math.min(1000,Number(entry.area)||1));player.savedCash=Math.max(0,Math.min(10000000,Number(entry.cash)||0));
    }else if(!entry.alive){player.savedWave=0;player.savedArea=1;player.savedCash=500;}
  }
  if(entry.outcome==='50 波通关')player.clearedHorde=true;
  if((entry.mode==='classic' && entry.outcome==='撤离成功')||entry.outcome==='50 波通关')player.redTickets=(player.redTickets||0)+1;
  awardMatchXP(player,entry);history.unshift(entry);history.sort((a,b)=>b.time-a.time);
  if(history.length>100)history.length=100;
  dirty=true;
}
export function score(code,kind='kills',amount=1){
  const p=records[code];if(!p)return;
  p[kind]=(p[kind]||0)+amount;
  if(kind==='kills'||kind==='zombies'){
    for(const [key,date] of Object.entries(periods(Date.now()))){
      if(p[key]?.date!==date)p[key]={date,count:0};
      p[key].count+=amount;
    }
  }
  dirty=true;
}
export function social(msg,rooms,sessions,account){
  const code=account?.id;
  if(!code)return {error:'身份无效'};
  if(!records[code])dirty=true;
  const now=Date.now(),p=records[code]??={name:account.nick,avatar:-1,friends:[],last:now,kills:0};
  if(p.name!==account.nick){p.name=account.nick;dirty=true;}
  if(Object.hasOwn(msg,'playing')){if(['yard','endless','classic','horde'].includes(msg.playing))soloModes.set(code,msg.playing);else soloModes.delete(code);}
  live.set(code,now);if(now-p.last>15000){p.last=now;dirty=true;}
  if(msg.action==='solo-start'||msg.action==='solo-finish'){
    if(!/^[a-f0-9-]{36}$/i.test(msg.match||''))return {error:'无效对局'};
    p.soloRuns??={};
    for(const [id,entry] of Object.entries(p.soloRuns))if(now-entry.start>7*86400000)delete p.soloRuns[id];
    const run=p.soloRuns[msg.match];
    if(msg.action==='solo-start'){
      if(!run){p.soloRuns[msg.match]={start:now};dirty=true;}
    }else if(!run)return {error:'对局已过期'};
    else if(!run.done){
      if(msg.practice===true){run.done=true;dirty=true;flush();return {saved:false};}
      const limit=100+Math.floor((now-run.start)/100);
      if(!Number.isSafeInteger(msg.kills)||msg.kills<0||msg.kills>limit)return {error:'击杀数无效'};
      score(code,'zombies',msg.kills);score(code,'dogs',Math.min(msg.kills,Math.max(0,Number(msg.dogs)|0)));score(code,'games');if(msg.dead)score(code,'zombiesDeaths');
      saveMatch(code,{id:msg.match,durationSec:Math.min(Number(msg.durationSec)||0,(now-run.start)/1000),time:Math.min(now,Math.max(run.start,Number(msg.time)||now)),
        mode:['yard','endless','horde'].includes(msg.mode)?msg.mode:'classic',solo:true,outcome:msg.dead?'阵亡':msg.extracted?(msg.mode==='horde'&&msg.wave===50?'50 波通关':'撤离成功'):'中途离开',
        area:msg.area,cash:msg.cash,alive:!msg.dead,wave:Math.min(9999,Math.max(1,Number(msg.wave)|0)),kills:msg.kills,others:[]});
      run.done=true;dirty=true;flush();
    }
    return {saved:true};
  }
  const rewardInfo=()=>({mastery:p.mastery||{},zombies:p.zombies||0,dogs:p.dogs||0,tickets:p.redTickets||0,red:p.redGuns||[]});
  if(msg.action==='mastery'){
    if(!/^[a-f0-9-]{36}$/i.test(msg.batch||'')||!msg.points||typeof msg.points!=='object')return {error:'无效熟练度记录'};
    p.masteryBatches??=[];if(!p.masteryBatches.includes(msg.batch)){
      const entries=Object.entries(msg.points);
      if(entries.some(([gun,n])=>!Object.hasOwn(gunNames,gun)||!Number.isInteger(n)||n<1||n>10000))return {error:'无效熟练度'};
      p.mastery??={};for(const [gun,n] of entries)p.mastery[gun]=Math.min(1000000000,(p.mastery[gun]||0)+n);
      p.masteryBatches.push(msg.batch);if(p.masteryBatches.length>256)p.masteryBatches.shift();dirty=true;
    }
    return {saved:true};
  }
  if(msg.action==='endless-state')return endlessState(code);
  if(msg.action==='skins')return rewardInfo();
  if(msg.action==='redeem-red'){
    if(!Object.hasOwn(gunNames,msg.gun))return {error:'请选择枪械'};
    p.redGuns??=[];
    if(!p.redGuns.includes(msg.gun)){
      if(!(p.redTickets>0))return {error:'需要一次僵尸模式通关'};
      p.redTickets--;p.redGuns.push(msg.gun);dirty=true;flush();
    }
    return rewardInfo();
  }
  if(msg.action==='history'){
    const target=msg.target?String(msg.target).toUpperCase():code;
    if(!/^[0-9A-F]{12}$/.test(target)||!records[target])return {error:'玩家不存在'};
    return {name:records[target].name,history:(records[target].history||[]).map(({id,...row})=>row)};
  }
  if(msg.action==='profile'){
    if(msg.customBackground!==undefined){try{saveBackground(code,msg.customBackground);}catch(e){return {error:e.message};}}
    if(msg.background!==undefined&&!['slate','forest','ember','ocean'].includes(msg.background))return {error:'未知背景'};
    const earned=profileCard(p).earned;
    if(msg.medals!==undefined&&(!Array.isArray(msg.medals)||msg.medals.length>3||msg.medals.some(id=>!Object.hasOwn(earned,id))))return {error:'只能展示最多三枚已解锁的勋章'};
    if(msg.image!==undefined){try{saveAvatar(code,msg.image);}catch(e){return {error:e.message};}}
    if(msg.background!==undefined)p.background=msg.background;
    if(msg.signature!==undefined)p.signature=String(msg.signature).trim().slice(0,80);
    if(msg.medals!==undefined)p.medals=[...new Set(msg.medals)];
    p.name=String(msg.name||p.name).trim().slice(0,16)||p.name;if(msg.avatar!==undefined)p.avatar=Math.min(5,Math.max(-1,Number(msg.avatar)|0));renameAccount(code,p.name);dirty=true;
  }
  const peer=String(msg.target||'').toUpperCase(),other=/^[0-9A-F]{12}$/.test(peer)?records[peer]:null;
  const inbox=requests.get(code)||[];
  if(['dm-read','dm-send','remove-friend','friend-join'].includes(msg.action)){
    if(!other||!p.friends.includes(peer)||!other.friends?.includes(code))return {error:'双方需要先成为好友'};
    if(msg.action==='remove-friend'){
      p.friends=p.friends.filter(id=>id!==peer);other.friends=other.friends.filter(id=>id!==code);
      for(const [id,from,profile] of [[code,peer,p],[peer,code,other]]){
        const pending=(requests.get(id)||[]).filter(m=>m.from!==from);requests.set(id,pending);profile.pending=pending.filter(m=>m.type==='add');
      }
      dirty=true;flush();return {removed:true};
    }
    if(msg.action==='friend-join'){
      if([...sessions.values()].some(s=>s.profile===code))return {error:'请先离开当前房间'};
      const status=roomStatus(peer,rooms,sessions,now);
      if(!status?.joinable)return {error:'房间已满、已关闭或好友已离开'};
      return {join:status.room};
    }
    const pair=[peer,code].sort().join(':');
    if(msg.action==='dm-send'){
      const body=typeof msg.text==='string'?msg.text.trim():'';
      if(!body||Array.from(body).length>500||!/^[-a-f0-9]{36}$/i.test(msg.nonce||''))return {error:'请输入 1–500 字的私信'};
      accountDB.exec('BEGIN IMMEDIATE');try{insertDM.run(pair,code,peer,msg.nonce,body,now);trimDM.run(pair,pair);accountDB.exec('COMMIT');}
      catch(e){accountDB.exec('ROLLBACK');throw e;}
    }
    const messages=readDM.all(pair);
    if(messages.length){p.dmRead??={};const last=messages.at(-1).id;if(last>(p.dmRead[peer]||0)){p.dmRead[peer]=last;dirty=true;}}
    return {messages};
  }
  if(msg.action==='add'||msg.action==='invite'){
    if(!other||peer===code)return {error:'找不到这个好友码'};
    const type=msg.action;let room='';
    if(type==='invite'){
      const session=sessions.get(msg.token),r=rooms.get(session?.room);
      if(!p.friends.includes(peer)||now-(live.get(peer)||0)>25000)return {error:'好友未在线'};
      if(!r||session.profile!==code||!(r.phase==='waiting'||r.allowJoin && ['playing','countdown'].includes(r.phase))||r.members.size>=r.limit)return {error:'请先进入有空位的等待房间'};
      room=session.room;
    }else if(p.friends.includes(peer))return {error:'已经是好友'};
    const next=(requests.get(peer)||[]).filter(m=>m.until>now && !(m.from===code && m.type===type));
    if(next.length>=30)return {error:'对方请求已满'};
    next.push({from:code,type,room,until:now+(type==='add'?86400000:90000)});requests.set(peer,next);other.pending=next.filter(m=>m.type==='add');dirty=true;
  }
  if(msg.action==='accept'||msg.action==='dismiss'){
    const entry=inbox.find(m=>m.from===peer && m.type===msg.type && m.until>now);
    if(!entry)return {error:'邀请已过期'};
    inbox.splice(inbox.indexOf(entry),1);p.pending=inbox.filter(m=>m.type==='add' && m.until>now);dirty=true;
    if(msg.action==='accept' && entry.type==='add' && other){for(const [a,b] of [[p,peer],[other,code]])if(!a.friends.includes(b))a.friends.push(b);dirty=true;}
    if(msg.action==='accept' && entry.type==='invite'){
      const r=rooms.get(entry.room);if(!r||!(r.phase==='waiting'||r.allowJoin && ['playing','countdown'].includes(r.phase))||r.members.size>=r.limit)return {error:'房间已开始或已满'};return {join:entry.room};
    }
  }
  const info=id=>{const account=accountDB.prepare('SELECT nick,registered FROM accounts WHERE id=?').get(id);const record=records[id]??={name:account?.nick||'玩家',avatar:-1,friends:[],last:account?.registered||0,kills:0};return {code:id,registered:account?.registered||null,backgroundUrl:backURL(id),background:record.background||'slate',name:record.name,avatar:record.avatar,avatarUrl:avatarUrl(id),last:record.last,online:now-(live.get(id)||0)<25000||!!roomStatus(id,rooms,sessions,now)};};
  const details=id=>({...info(id),...profileCard(records[id]),kills:records[id].kills||0,zombies:records[id].zombies||0,wins:records[id].wins||0,zombiesDeaths:records[id].zombiesDeaths||0,games:records[id].games||0});
  if(msg.action==='inspect')return other?{player:details(peer),friend:p.friends.includes(peer)}:{error:'玩家不存在'};
  let ranking,total=0,rank=null,page=0,pageCount=1;
  if(msg.action==='ranking'){
    const period=['day','month'].includes(msg.period)?msg.period:'all',date=periods(now)[period];flush();let rows;
    if(period==='all'){
      const count=accountDB.prepare('SELECT count(*) AS n FROM accounts').get().n;pageCount=Math.max(1,Math.ceil(count/20));page=Math.min(pageCount-1,Math.max(0,Number.isSafeInteger(msg.page)?msg.page:0));
      rows=accountDB.prepare('SELECT a.id,COALESCE(l.total,0) AS kills FROM accounts a LEFT JOIN leaderboard l ON l.code=a.id ORDER BY kills DESC,a.id LIMIT 20 OFFSET ?').all(page*20);
      total=accountDB.prepare('SELECT COALESCE(sum(total),0) AS n FROM leaderboard').get().n;const mine=accountDB.prepare('SELECT COALESCE(total,0) AS n FROM leaderboard WHERE code=?').get(code)?.n||0;
      rank=1+accountDB.prepare('SELECT count(*) AS n FROM accounts a LEFT JOIN leaderboard l ON l.code=a.id WHERE COALESCE(l.total,0)>? OR (COALESCE(l.total,0)=? AND a.id<?)').get(mine,mine,code).n;
    }else{
      const col=period+'kills',where=col+'>0 AND '+period+'=?';const count=accountDB.prepare('SELECT count(*) AS n FROM leaderboard WHERE '+where).get(date).n;pageCount=Math.max(1,Math.ceil(count/20));page=Math.min(pageCount-1,Math.max(0,Number.isSafeInteger(msg.page)?msg.page:0));
      rows=accountDB.prepare('SELECT code AS id,'+col+' AS kills FROM leaderboard WHERE '+where+' ORDER BY '+col+' DESC,code LIMIT 20 OFFSET ?').all(date,page*20);
      total=accountDB.prepare('SELECT COALESCE(sum('+col+'),0) AS n FROM leaderboard WHERE '+where).get(date).n;
      const mine=accountDB.prepare('SELECT '+col+' AS n FROM leaderboard WHERE '+where+' AND code=?').get(date,code);rank=mine?1+accountDB.prepare('SELECT count(*) AS n FROM leaderboard WHERE '+where+' AND ('+col+'>? OR ('+col+'=? AND code<?))').get(date,mine.n,mine.n,code).n:0;
    }
    ranking=rows.map(({id,kills})=>({...info(id),kills}));
  }

  return {total,rank,page,pageCount,me:{...info(code),...profileCard(p),mastery:p.mastery||{},gunNames,kills:p.kills||0,zombies:p.zombies||0,wins:p.wins||0,zombiesDeaths:p.zombiesDeaths||0,games:p.games||0},friends:p.friends.filter(id=>records[id]).map(id=>{
    const friend=info(id),room=roomStatus(id,rooms,sessions,now);
    return {...friend,online:friend.online||!!room,activity:room||((friend.online&&soloModes.has(id))?{mode:soloModes.get(id),solo:true}:null),unread:unreadDM.get(code,id,p.dmRead?.[id]||0).n};
  }),inbox:inbox.filter(m=>m.until>now).map(m=>({...m,name:records[m.from].name})),ranking};
}

export function dailyChampion(){const row=accountDB.prepare('SELECT a.id,a.nick,l.daykills AS kills FROM leaderboard l JOIN accounts a ON a.id=l.code WHERE l.day=? AND l.daykills>0 ORDER BY l.daykills DESC,a.id LIMIT 1').get(periods(Date.now()).day);return row?{code:row.id,name:records[row.id]?.name||row.nick,kills:row.kills}:null;}
