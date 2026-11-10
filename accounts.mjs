import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {dirname,join} from 'node:path';
import {readFileSync} from 'node:fs';

const hash=s=>createHash('sha256').update(s).digest('hex'),derive=promisify(scrypt);
export const accountDB=new DatabaseSync(process.env.GW_ACCOUNT_DB||join(dirname(process.env.GW_SOCIAL_FILE||process.env.GW_STATS_FILE||'gw-social.json'),'gw-accounts.sqlite'));
const db=accountDB;
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE, nick TEXT NOT NULL, salt TEXT NOT NULL, pass TEXT NOT NULL, registered INTEGER NOT NULL,device TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS accounts_device ON accounts(device);
CREATE TABLE IF NOT EXISTS device_keys(id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS login_sessions(token TEXT PRIMARY KEY,account TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_account ON login_sessions(account);
CREATE INDEX IF NOT EXISTS sessions_expiry ON login_sessions(expires);
CREATE TABLE IF NOT EXISTS backgrounds(account TEXT PRIMARY KEY,revision TEXT NOT NULL,image BLOB NOT NULL);`);
const queries=new Map();
function sql(s){if(!queries.has(s))queries.set(s,db.prepare(s));return queries.get(s);}
const day=86400000,limits=new Map();
setInterval(()=>{for(const [k,r] of limits)if(r.end<Date.now())limits.delete(k);sql('DELETE FROM login_sessions WHERE expires<?').run(Date.now());},600000).unref();
function limit(key,max){let r=limits.get(key);if(!r||r.end<Date.now()){r={hits:0,end:Date.now()+600000};limits.set(key,r);}if(++r.hits>max)throw Error('尝试过于频繁，请稍后再试');}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=')));}
function setCookie(req,res,name,value,days){
  const old=res.getHeader('Set-Cookie')||[];
  const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https'||!['127.0.0.1','localhost','[::1]'].includes(String(req.headers.host||'').replace(/:\d+$/,''));
  res.setHeader('Set-Cookie',[...old,name+'='+value+'; Path=/; Max-Age='+days*86400+'; HttpOnly; SameSite=Strict'+(secure?'; Secure':'')]);
}
function device(req,res,recovery){
  const found=cookies(req).gw_device;
  const known=id=>typeof id==='string' && /^[a-f0-9]{64}$/.test(id) && sql('SELECT 1 FROM device_keys WHERE id=?').get(hash(id));
  if(known(found))return found;
  const id=known(recovery)?recovery:randomBytes(32).toString('hex');sql('INSERT OR IGNORE INTO device_keys VALUES(?)').run(hash(id));setCookie(req,res,'gw_device',id,3650);return id;
}
export function currentAccount(req){
  const token=cookies(req).gw_login;if(!/^[a-f0-9]{64}$/.test(token||''))return null;
  return sql('SELECT a.id,a.login,a.nick,a.registered FROM login_sessions s JOIN accounts a ON a.id=s.account WHERE s.token=? AND s.expires>?').get(hash(token),Date.now())||null;
}
export function registration(id){return sql('SELECT registered FROM accounts WHERE id=?').get(id)?.registered||null;}
export function backURL(id){const row=sql('SELECT revision FROM backgrounds WHERE account=?').get(id);return row?'./backgrounds/'+id+'/'+row.revision+'.jpg':null;}
export function backgroundImage(id,rev){return sql('SELECT image FROM backgrounds WHERE account=? AND revision=?').get(id,rev)?.image;}
export function saveBackground(id,data){
  if(data===null){sql('DELETE FROM backgrounds WHERE account=?').run(id);return;}
  if(typeof data!=='string'||data.length>350000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('背景图片无效');
  const b=Buffer.from(data.slice(23),'base64');
  if(b.length>256*1024||b[0]!==255||b[1]!==216||b.at(-2)!==255||b.at(-1)!==217)throw Error('背景需为 256 KB 以内的 JPEG');
  let valid=false;for(let i=2;i+8<b.length&&b[i]===255;){const marker=b[i+1],len=b.readUInt16BE(i+2);if(len<2||i+len+2>b.length)break;if(marker===192||marker===194){valid=b.readUInt16BE(i+5)===360&&b.readUInt16BE(i+7)===960;break;}i+=len+2;}
  if(!valid)throw Error('背景尺寸应为 960 × 360');
  sql('INSERT OR REPLACE INTO backgrounds VALUES(?,?,?)').run(id,hash(b).slice(0,16),b);
}
function credentials(login,password){
  if(typeof login!=='string'||!/^[-_.\p{L}\d]{3,32}$/u.test(login))throw Error('账号需为 3–32 个字母、汉字、数字或 -_.');
  if(typeof password!=='string'||password.length<8||password.length>128)throw Error('密码需为 8–128 个字符');
}
function session(req,res,id){
  const token=randomBytes(32).toString('hex');
  sql('INSERT INTO login_sessions VALUES(?,?,?)').run(hash(token),id,Date.now()+30*day);setCookie(req,res,'gw_login',token,30);
}
export async function auth(path,msg,req,res){
  const ident=device(req,res,msg.deviceKey),ip=(['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&req.headers['x-real-ip'])||req.socket.remoteAddress||'local',login=String(msg.login||'').trim().toLowerCase();
  if(path==='/auth/me')return {account:currentAccount(req),deviceKey:ident};
  if(path==='/auth/logout'){
    sql('DELETE FROM login_sessions WHERE token=?').run(hash(cookies(req).gw_login||''));setCookie(req,res,'gw_login','',0);return {ok:true};
  }
  if(path==='/auth/admin-reset'){
    limit('admin:'+ip,15);
    let expected;try{expected=readFileSync(process.env.GW_ADMIN_HASH||'gw-admin.hash','utf8').trim();}catch{throw Error('管理员入口尚未配置');}
    if(!/^[a-f0-9]{64}$/.test(expected)||typeof msg.admin!=='string'||!timingSafeEqual(Buffer.from(hash(msg.admin)),Buffer.from(expected)))throw Error('管理员密码不正确');
    credentials(login,msg.password);const row=sql('SELECT id FROM accounts WHERE login=?').get(login);if(!row)throw Error('账号不存在');
    const salt=randomBytes(16).toString('hex'),pass=(await derive(msg.password,salt,64)).toString('hex');
    db.exec('BEGIN IMMEDIATE');try{sql('UPDATE accounts SET salt=?,pass=? WHERE id=?').run(salt,pass,row.id);sql('DELETE FROM login_sessions WHERE account=?').run(row.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return {ok:true};
  }
  if(!['/auth/login','/auth/register'].includes(path))throw Error('入口不存在');
  credentials(login,msg.password);limit('login:'+login,30);limit('device:'+ident,45);limit('network:'+ip,600);
  if(path==='/auth/register'){
    const nick=String(msg.nickname||'').trim();if(!nick||nick.length>16)throw Error('请设置 1–16 个字符的昵称');
    if(!cookies(req).gw_device)throw Error('请允许 Cookie 后重试');
    const salt=randomBytes(16).toString('hex'),pass=(await derive(msg.password,salt,64)).toString('hex');
    const legacy=/^[a-f0-9-]{36}$/i.test(msg.legacy||'')?hash(msg.legacy).slice(0,12).toUpperCase():null;
    const registered=Date.now();
    let id=hash(randomUUID()).slice(0,12).toUpperCase();
    db.exec('BEGIN IMMEDIATE');try{
      if(sql('SELECT count(*) AS n FROM accounts WHERE device=?').get(hash(ident)).n>=3)throw Error('本设备已达到 3 个账号的注册上限');
      if(sql('SELECT id FROM accounts WHERE login=?').get(login))throw Error('这个账号已被注册');
      if(legacy&&!registration(legacy)&&sql('SELECT code FROM profiles WHERE code=?').get(legacy))id=legacy;
      sql('INSERT INTO accounts VALUES(?,?,?,?,?,?,?)').run(id,login,nick,salt,pass,registered,hash(ident));session(req,res,id);db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}return {account:{id,login,nick,registered}};
  }
  const row=sql('SELECT * FROM accounts WHERE login=?').get(login);
  const check=await derive(msg.password,row?.salt||'68398fe2e36fd764f5445de6176a0452',64);
  if(!row||!timingSafeEqual(check,Buffer.from(row.pass,'hex'))||sql('SELECT pass FROM accounts WHERE id=?').get(row.id)?.pass!==row.pass)throw Error('账号或密码不正确');
  session(req,res,row.id);return {account:{id:row.id,login,nick:row.nick,registered:row.registered}};
}
export function renameAccount(id,nick){sql('UPDATE accounts SET nick=? WHERE id=?').run(nick,id);}

