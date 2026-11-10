import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';

const path=process.env.GW_AVATAR_DB || join(dirname(process.env.GW_SOCIAL_FILE || process.env.GW_STATS_FILE || 'gw-social.json'),'gw-avatars.sqlite');
const db=new DatabaseSync(path);
db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS avatars (player TEXT PRIMARY KEY, version TEXT NOT NULL, image BLOB NOT NULL)');
const read=db.prepare('SELECT version,image FROM avatars WHERE player=?');
const version=db.prepare('SELECT version FROM avatars WHERE player=?');
const put=db.prepare('INSERT INTO avatars(player,version,image) VALUES(?,?,?) ON CONFLICT(player) DO UPDATE SET version=excluded.version,image=excluded.image');

export function avatarUrl(code){
  const row=version.get(code);
  return row?'./avatars/'+code+'/'+row.version+'.jpg':null;
}
export function avatarImage(code,revision){
  const row=read.get(code);
  return row?.version===revision?row.image:null;
}
export function saveAvatar(code,data){
  if(typeof data!=='string'||data.length>23000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('头像格式无效');
  const image=Buffer.from(data.slice(data.indexOf(',')+1),'base64');
  if(image.length>16384||image[0]!==255||image[1]!==216||image.at(-2)!==255||image.at(-1)!==217)throw Error('头像应小于 16 KB');
  let valid=false;
  for(let i=2;i+8<image.length;){
    if(image[i]!==255)break;
    const marker=image[i+1],size=image.readUInt16BE(i+2);
    if(size<2||i+2+size>image.length)break;
    if(marker===192||marker===194){valid=image.readUInt16BE(i+5)===128&&image.readUInt16BE(i+7)===128;break;}
    if(marker===218)break;
    i+=2+size;
  }
  if(!valid)throw Error('头像尺寸应为 128 × 128');
  put.run(code,createHash('sha256').update(image).digest('hex').slice(0,16),image);
}
