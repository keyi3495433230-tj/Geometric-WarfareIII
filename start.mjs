import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
if(Number(process.versions.node.split('.')[0])<24){console.error('Install Node.js 24 LTS or newer.');process.exit(1);}
const root=fileURLToPath(new URL('.',import.meta.url));process.chdir(root);
const data=join(root,'data');mkdirSync(data,{recursive:true});
for(const [key,file] of Object.entries({GW_STATS_FILE:'daily.json',GW_SOCIAL_FILE:'social.json',GW_ACCOUNT_DB:'accounts.sqlite',GW_AVATAR_DB:'avatars.sqlite'}))process.env[key]=join(data,file);
process.env.PORT=process.env.PORT||'3080';process.env.HOST=process.env.HOST||'127.0.0.1';
process.on('uncaughtException',e=>{console.error(e.code==='EADDRINUSE'?'Port already in use. Close the previous game process or select another PORT.':e);process.exit(1);});
await import('./server.mjs');
console.log(`Singleplayer: http://127.0.0.1:${process.env.PORT}/\nSaves: ${data}\nPress Ctrl+C to exit.`);
