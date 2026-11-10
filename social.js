const GWRun=(()=>{
  let active=false,practice=false,pendingPractice=false,credits=[],heads=0,noticeTimer;
  const notice=document.createElement('div');notice.hidden=true;
  notice.textContent='本局内容不会被记录';
  Object.assign(notice.style,{position:'fixed',top:'8%',left:'50%',transform:'translateX(-50%)',zIndex:12000,padding:'10px 18px',background:'#222d',color:'#ffd277',pointerEvents:'none',textAlign:'center'});
  document.body.append(notice);
  function mark(){
    if(!active)pendingPractice=true;practice=true;credits=[];heads=0;notice.hidden=false;clearTimeout(noticeTimer);
    noticeTimer=setTimeout(()=>notice.hidden=true,5000);
    window.dispatchEvent(new Event('gw-practice'));
  }
  document.addEventListener('click',e=>{if(e.target.closest?.('#cheatMenu button,#cheatMenu input,#cheatMenu select'))mark();},true);
  document.addEventListener('change',e=>{if(e.target.closest?.('#cheatMenu'))mark();},true);
  return {get practice(){return practice;},
    start(){if(active)return;active=true;practice=pendingPractice;pendingPractice=false;credits=[];heads=0;if(practice || document.querySelector('#cheatMenu input:checked'))mark();},
    credit(id,head){if(!practice)credits.push([id,head]);},
    head(){if(!practice)heads++;},
    finish(){if(!active)return;active=false;if(!practice){for(const args of credits)Smith.credit(...args);if(heads)commitSoloHead(heads);}credits=[];heads=0;},
    mark};
})();
const GWKeys=(()=>{
  const actions={KeyW:'前进',KeyS:'后退',KeyA:'左移',KeyD:'右移',ShiftLeft:'冲刺',Space:'跳跃',KeyC:'蹲伏 / 滑铲',KeyZ:'卧倒',KeyE:'互动',KeyR:'换弹',KeyF:'检视',KeyG:'手雷',KeyQ:'震撼弹',KeyX:'下挂榴弹',Digit1:'主武器',Digit2:'副武器',Digit3:'近战',Digit4:'加特林',Digit5:'火箭筒',Digit6:'智能手枪',Digit7:'空中支援',KeyV:'语音',KeyT:'计分板',KeyH:'使用连杀',KeyJ:'切换连杀',Enter:'聊天'};
  const choices=[...new Set([...Object.keys(actions),...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ',x=>'Key'+x),...Array.from('0123456789',x=>'Digit'+x),'ControlLeft','AltLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])];
  let saved={};try{saved=JSON.parse(localStorage.gwPCKeys||'{}')||{};}catch{}
  const mapping=Object.fromEntries(Object.keys(actions).map(k=>[k,choices.includes(saved[k])?saved[k]:k]));
  function code(e){if(!e.isTrusted)return e.code;
    return Object.keys(mapping).find(k=>mapping[k]===e.code)||(Object.hasOwn(actions,e.code)?'':e.code);}
  function panel(parent){
    if(matchMedia('(pointer:coarse)').matches)return;
    const box=document.createElement('details'),title=document.createElement('summary');title.textContent='自定义键位';box.append(title);parent.append(box);
    function draw(){box.replaceChildren(title);
      for(const [id,action] of Object.entries(actions)){
        const label=document.createElement('label'),pick=document.createElement('select');label.append(action+' ',pick);
        for(const c of choices)pick.add(new Option(c.replace(/^Key|^Digit/,''),c));pick.value=mapping[id];
        pick.onchange=()=>{const other=Object.keys(mapping).find(k=>mapping[k]===pick.value);
          if(other)mapping[other]=mapping[id];mapping[id]=pick.value;localStorage.gwPCKeys=JSON.stringify(mapping);draw();};box.append(label);
      }
    }draw();
  }
  return {code,panel};
})();
const GWGraphics=(()=>{
  let level=['low','medium','high'].includes(localStorage.gwQuality)?localStorage.gwQuality:matchMedia('(pointer:coarse)').matches?'low':'medium';
  let apply=()=>{},slow=0,cooldown=0;
  function set(value){level=value;localStorage.gwQuality=value;apply(value);window.dispatchEvent(new Event('gw-quality'));}
  return {get level(){return level;},set,
    bind(fn){apply=fn;apply(level);},
    panel(parent){const label=document.createElement('label');label.append('画质 ');const select=document.createElement('select');
      for(const [value,text] of [['low','低画质'],['medium','中画质'],['high','高画质']])select.add(new Option(text,value));
      select.value=level;select.onchange=()=>set(select.value);label.append(select);parent.append(label);GWVisual.panel(parent);const news=document.createElement('button');news.textContent='更新公告';news.onclick=()=>GWNews.open();parent.append(news);
    },
    tick(dt){if(performance.now()<cooldown)return;slow=dt>.065?slow+Math.min(dt,.2):Math.max(0,slow-.04);
      if(slow>3){slow=0;cooldown=performance.now()+30000;ZombieActors.trim(0);if(level==='high')set('medium');else if(level==='medium')set('low');}
    }
  };
})();
const GWSettings={
  textColors(parent){
    for(const [name,key,fallback] of [['伤害飘字颜色','gwDamageColor','#ffd799'],['金钱飘字颜色','gwMoneyColor','#ffd155']]){
      const l=document.createElement('label'),input=document.createElement('input');input.type='color';input.value=localStorage.getItem(key)||fallback;
      input.oninput=()=>localStorage.setItem(key,input.value);l.append(name+' ',input);parent.append(l);
    }
  },
  arrange(parent){
    if(parent.querySelector(':scope > .settingsTabs'))return;
    const nodes=[...parent.children];parent.replaceChildren();const nav=document.createElement('nav');nav.className='settingsTabs';nav.setAttribute('role','tablist');parent.append(nav);
    const groups=new Map();for(const el of nodes){const text=el.textContent,section=el.dataset.settingsTab||(/准星/.test(text)?'准星':/摇杆|键位|开火|灵敏度/.test(text)?'操作':/音量|语音/.test(text)?'声音':/画质|亮度|光照|画面/.test(text)?'画面':'其他');
      if(!groups.has(section)){const f=document.createElement('div');f.className='settingsContent';f.setAttribute('role','tabpanel');groups.set(section,f);parent.append(f);}groups.get(section).append(el);}
    for(const [name,section] of groups){const btn=document.createElement('button');btn.type='button';btn.textContent=name;btn.setAttribute('role','tab');nav.append(btn);btn.onclick=()=>{for(const [label,panel] of groups){panel.hidden=label!==name;}for(const b of nav.children)b.setAttribute('aria-selected',String(b===btn));};}
    nav.firstElementChild?.click();
  }
};
const SquadUI=(()=>{
  const marks=['★','◆','⚡','☠','♜','✦'];
  let secret=localStorage.getItem('gw-profile-key');
  if(!secret){const bytes=crypto.getRandomValues(new Uint8Array(16));secret=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').replace(/^(........)(....)(....)(....)(............)$/,'$1-$2-$3-$4-$5');localStorage.setItem('gw-profile-key',secret);}
  let activeSolo=null,refresh=()=>{};
  async function sendSolo(action,match,extra={}){
    const res=await fetch('./social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,action,match,...extra}),keepalive:true});
    if(!res.ok)throw Error('战绩同步失败');
  }
  const masteryPending={};
  let sending=false;
  const owner=()=>GWAccount.user?.id;
  function train(gun,points){if(!GWRun.practice&&owner()&&gun)masteryPending[gun]=Math.min(10000,(masteryPending[gun]||0)+points);}
  async function flushTraining(){
    if(!owner())return;
    const prefix='gw-training-'+owner()+'-';
    if(Object.keys(masteryPending).length){
      const batch=crypto.randomUUID();
      localStorage.setItem(prefix+batch,JSON.stringify({...masteryPending}));
      for(const k of Object.keys(masteryPending))delete masteryPending[k];
    }
    if(sending)return;sending=true;
    try{for(const key of Object.keys(localStorage).filter(k=>k.startsWith(prefix))){
      const batch=key.slice(prefix.length),points=JSON.parse(localStorage.getItem(key));
      await sendSolo('mastery',batch,{batch,points});localStorage.removeItem(key);
    }}catch{}finally{sending=false;}
  }
  window.addEventListener('gw-practice',()=>{for(const key of Object.keys(masteryPending))delete masteryPending[key];});
  function beginSolo(mode='classic'){
    GWRun.start();
    if(!owner()||activeSolo)return;
    const id=crypto.randomUUID();activeSolo={id,mode,activeSec:0,started:sendSolo('solo-start',id).catch(()=>{})};
  }
  function clock(seconds){
    if(activeSolo && Number.isFinite(seconds) && seconds>0)activeSolo.activeSec+=Math.min(1,seconds);
  }
  let draining=null;
  async function syncResults(){
    if(!owner())return;if(draining)return draining;let settled;draining=new Promise(resolve=>settled=resolve);
    try{
      for(const key of Object.keys(localStorage).filter(k=>k.startsWith('gw-result-'+owner()+'-'))){
        const r=JSON.parse(localStorage.getItem(key));if(!r)continue;
        if(Date.now()-r.time>7*86400000){localStorage.removeItem(key);continue;}
        await sendSolo('solo-start',r.id);await sendSolo('solo-finish',r.id,r);localStorage.removeItem(key);
      }
    }catch{}finally{draining=null;settled();refresh();}
  }
  function finishSolo(kills,dead,wave,extracted=false,dogs=0,area=1,cash=0){
    GWRun.finish();if(!GWRun.practice)flushTraining();
    if(!activeSolo)return;const run=activeSolo;activeSolo=null;
    if(GWRun.practice){sendSolo('solo-finish',run.id,{practice:true}).catch(()=>{});return;}
    localStorage.setItem('gw-result-'+owner()+'-'+run.id,JSON.stringify({id:run.id,mode:run.mode,durationSec:run.activeSec,kills,dead,wave,extracted,dogs,area,cash,time:Date.now()}));run.started.then(syncResults);
  }
  function connect({post,session,join,mode,browse}){
    const $=id=>document.getElementById(id),sheet=$('socialSheet'),body=sheet.querySelector('section'),note=sheet.querySelector('output'),picker=$('menuSheet');
    let view='',period='day',rankPage=0,data=null,seq=0,mutating=false;
    const request=(action,params={})=>post('/social',{secret,action,playing:activeSolo?.mode||null,...params});
    function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
    function button(label,click,go=false){const b=node('button',label);if(go)b.className='go';b.onclick=click;return b;}
    function row(msg,...actions){const line=node('div');line.className='row';line.append(node('span',msg),...actions);body.append(line);}
    async function change(action,params){
      if(mutating)return;mutating=true;
      try{
        if(action==='accept' && params.type==='invite' && session())throw Error('请先退出当前房间，再接受邀请');
        const result=await request(action,{...params,token:session()?.token});
        if(result.join){sheet.close();await join(result.join);return;}
        note.textContent=action==='invite'?'邀请已发送':action==='add'?'好友申请已发送':action==='remove-friend'?'已删除好友':'已保存';
        if(action==='add' && view==='inspect'){const add=body.querySelector('button.go');if(add&&add.textContent==='加好友'){add.disabled=true;add.textContent='申请已发送';}}
        await poll(true);
      }catch(e){note.textContent=e.message;}finally{mutating=false;}
    }
    function portrait(player){
      const el=node('span');el.className='avatar';
      if(player.avatarUrl){const img=node('img');img.src=player.avatarUrl;img.alt=player.name+'的头像';img.loading='lazy';el.append(img);}
      else el.textContent=marks[player.avatar]||Array.from(player.name||'?')[0];
      return el;
    }
    function card(player){
      const box=node('article');box.className='publicCard';box.dataset.theme=player.background||'slate';
      if(player.backgroundUrl&&/^\.\/backgrounds\/[A-F0-9]{12}\/[a-f0-9]{16}\.jpg$/.test(player.backgroundUrl))box.style.backgroundImage='linear-gradient(90deg,#101920d9,#10192066),url('+player.backgroundUrl+')';
      box.append(portrait(player),node('strong',player.name));
      const secs=player.playSeconds||0,play=secs<3600?Math.floor(secs/60)+' 分钟':(secs/3600).toFixed(1)+' 小时';
      box.append(node('small','LV.'+(player.level||1)+'　·　游玩 '+play+(player.level<100?'　·　经验 '+player.levelXP+' / '+player.levelGoal:'')));
      box.append(node('small',player.registered?'注册于 '+new Date(player.registered).toLocaleString('zh-CN',{hour12:false}):'尚未注册'));
      if(player.signature)box.append(node('p',player.signature));
      const badges=node('div');for(const id of player.featured||[])badges.append(node('span','◆ '+player.earned[id]));box.append(badges);return box;
    }
    function career(player){
      const stats=node('div');stats.className='career';
      for(const [title,key] of [['无尽最高波次','endlessBest'],['已结束对局','games'],['玩家击杀','kills'],['僵尸击杀','zombies'],['对战获胜','wins'],['僵尸模式倒地','zombiesDeaths']]){
        const tile=node('div',title);tile.append(node('strong',player[key]||0));stats.append(tile);
      }
      return stats;
    }
    let inspectFrom='ranking';
    async function inspect(code){
      if(view==='friends'||view==='ranking')inspectFrom=view;
      const ticket=++seq;view='inspect';body.replaceChildren(node('p','正在获取资料…'));sheet.querySelector('h2').textContent='玩家信息';
      try{
        const result=await request('inspect',{target:code});if(ticket!==seq||view!=='inspect')return;
        const p=result.player,identity=node('div');identity.className='identity';identity.append(portrait(p),node('strong',p.name));
        body.replaceChildren(card(p),career(p),button('查看战绩',()=>history(p.code),true));
        if(p.code!==data.me.code){const add=button(result.friend?'已是好友':'加好友',()=>change('add',{target:p.code}),true);add.disabled=result.friend;body.append(add);}
        body.append(button(inspectFrom==='friends'?'返回好友':'返回排行榜',()=>open(inspectFrom)));
      }catch(e){note.textContent=e.message;}
    }
    async function compress(file,background=false){
      if(!file || !file.type.startsWith('image/') || file.size>12*1024*1024)throw Error('请选择 12 MB 以内的图片');
      const url=URL.createObjectURL(file),img=new Image();
      try{
        img.src=url;await img.decode();
        const canvas=document.createElement('canvas');canvas.width=background?960:128;canvas.height=background?360:128;
        const ctx=canvas.getContext('2d'),ratio=canvas.width/canvas.height,w=Math.min(img.naturalWidth,img.naturalHeight*ratio),h=w/ratio;
        ctx.fillStyle='#383838';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,(img.naturalWidth-w)/2,(img.naturalHeight-h)/2,w,h,0,0,canvas.width,canvas.height);
        for(const quality of [.86,.7,.5,.3]){const data=canvas.toDataURL('image/jpeg',quality);if(atob(data.split(',')[1]).length<=(background?256*1024:16384))return data;}
        throw Error('图片压缩失败，请换一张图片');
      }finally{URL.revokeObjectURL(url);}
    }
    async function history(target){
      const source=view;
      view='history';const ticket=++seq;sheet.querySelector('h2').textContent='个人战绩';body.replaceChildren(node('p','正在读取战绩…'));
      try{
        const result=await request('history',target?{target}:{});if(ticket!==seq||view!=='history')return;
        sheet.querySelector('h2').textContent=target?result.name+'的战绩':'个人战绩';
        body.replaceChildren(button(source==='friends'?'← 我的好友':target?'← 玩家信息':'← 个人信息',()=>source==='friends'?open('friends'):target?inspect(target):open('profile')));
        const modes={classic:'经典生存',horde:'排山倒海',yard:'线性生存',endless:'无尽模式',coop:'合作生存',duel:'1v1',free:'自由乱斗',tdm:'冲锋团队竞技',bomb:'爆破'};
        for(const r of result.history){
          const item=node('article');item.className='matchEntry';
          item.append(node('strong',(modes[r.mode]||r.mode)+' · '+r.outcome),
            node('time',new Date(r.time).toLocaleString('zh-CN',{hour12:false})));
          item.append(node('p',r.score?'比分 '+r.score.join(' : '):'第 '+r.wave+' 波 · '+(r.alive?'存活':'阵亡')+' · '+r.kills+' 击杀'));
          if(r.rankEarned!==undefined)item.append(node('small','等级经验 +'+r.rankEarned));
          if(r.others.length)item.append(node('p',(r.score?'同场玩家：':'队友：')+r.others.join('、')));
          body.append(item);
        }
        if(!result.history.length)body.append(node('p','尚无对局记录。新对局结算后会显示在这里。'));
      }catch(e){if(view==='history')note.textContent=e.message;}
    }
    const modeNames={duel:'1v1',free:'自由乱斗',tdm:'冲锋团队竞技',bomb:'爆破',yard:'线性生存',classic:'经典生存',coop:'合作生存',endless:'无尽模式',horde:'排山倒海'};
    let chatFriend=null,dmSeq=0,lastMessage=0;
    async function updateDM(action='dm-read',extra={}){
      const peer=chatFriend,ticket=++dmSeq;
      try{
        const {messages}=await request(action,{target:peer.code,...extra});
        if(view!=='dm'||peer!==chatFriend)return;
        if(ticket!==dmSeq)return true;
        const log=body.querySelector('.dmLog');if(!log)return;
        if((messages.at(-1)?.id||0)!==lastMessage){
          lastMessage=messages.at(-1)?.id||0;
          log.replaceChildren(...messages.map(m=>{
            const line=node('article'),mine=m.sender===data.me.code;line.className=mine?'mine':'';
            line.append(node('small',(mine?'我':peer.name)+' · '+new Date(m.sent).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})),node('p',m.body));return line;
          }));log.scrollTop=log.scrollHeight;
        }
        if(!messages.length)log.textContent='还没有私信';
        return true;
      }catch(e){if(view==='dm'&&peer===chatFriend)note.textContent=e.message;return false;}
    }
    function openDM(peer){
      ++seq;view='dm';chatFriend=peer;lastMessage=-1;note.textContent='';sheet.querySelector('h2').textContent='与 '+peer.name+' 的私信';
      const log=node('div'),form=node('form'),field=node('input'),send=node('button','发送');
      log.className='dmLog';log.setAttribute('aria-live','polite');form.className='dmCompose';field.placeholder='写私信';field.maxLength=500;send.type='submit';
      let draft=null;
      form.onsubmit=async e=>{e.preventDefault();const text=field.value.trim();if(!text||send.disabled)return;
        if(draft?.text!==text)draft={text,nonce:crypto.randomUUID()};
        send.disabled=true;if(await updateDM('dm-send',draft)){if(field.value.trim()===text)field.value='';draft=null;}send.disabled=false;
      };
      form.append(field,send);body.replaceChildren(button('← 好友列表',()=>open('friends')),node('small','仅保留双方最近 30 条私信'),log,form);updateDM();
    }
    function draw(){
      if(!data)return;
      if(view==='inspect'||view==='history'||view==='dm')return;
      const me=data.me;window.gwMastery=me.mastery||{};body.replaceChildren();
      if(view==='profile'){
        const name=node('input');name.value=me.name;name.maxLength=16;name.setAttribute('aria-label','玩家昵称');
        const avatar=node('select');avatar.add(new Option('昵称首字（默认）','-1'));marks.forEach((m,i)=>avatar.add(new Option(m,i)));avatar.value=me.avatar;
        let image,customBackground;
        const bgLabel=node('label','导入个人背景图'),bgInput=node('input');bgInput.type='file';bgInput.accept='image/*';bgLabel.append(bgInput);
        const removeBg=button('恢复预设背景',()=>{customBackground=null;note.textContent='保存后恢复预设背景';});
        const preview=portrait(me),file=node('input');file.type='file';file.accept='image/*';file.setAttribute('aria-label','上传头像');
        const sig=node('input');sig.value=me.signature||'';sig.maxLength=80;sig.placeholder='公开签名（最多 80 字）';sig.setAttribute('aria-label','个人签名');
        const theme=node('select');theme.setAttribute('aria-label','资料背景');
        for(const [id,label] of [['slate','石墨'],['forest','森林'],['ember','余烬'],['ocean','深海']])theme.add(new Option(label,id));
        theme.value=me.background||'slate';
        const slots=[0,1,2].map((_,i)=>{const field=node('select');field.setAttribute('aria-label','展示勋章 '+(i+1));field.add(new Option('勋章位 '+(i+1)+' · 不展示',''));
          for(const [id,label] of Object.entries(me.earned||{}))field.add(new Option(label,id));
          field.value=me.featured?.[i]||'';return field;});
        const save=button('保存',()=>change('profile',{name:name.value,avatar:+avatar.value,background:theme.value,signature:sig.value,medals:slots.map(s=>s.value).filter(Boolean),...(image?{image}:{}),...(customBackground!==undefined?{customBackground}:{})}),true);
        bgInput.onchange=async()=>{if(!bgInput.files[0])return;save.disabled=true;try{customBackground=await compress(bgInput.files[0],true);note.textContent='背景已裁切，点击保存应用';}catch(e){note.textContent=e.message;}finally{save.disabled=false;}};
        file.onchange=async()=>{save.disabled=true;image=undefined;note.textContent='正在压缩头像…';try{image=await compress(file.files[0]);const img=node('img');img.src=image;img.alt='头像预览';preview.replaceChildren(img);note.textContent='头像已压缩，点击保存上传';}catch(e){note.textContent=e.message;}finally{save.disabled=false;}};
        const identity=node('div');identity.className='identity';identity.append(preview,name,save);
        const training=node('details'),summary=node('summary','枪械熟练度');training.append(summary,node('p','开火 +1，命中僵尸 +5。每把枪达到 10000 可解锁专属精通勋章。'));
        for(const [gun,label] of Object.entries(me.gunNames||{}))training.append(node('p',label+'　'+(me.mastery?.[gun]||0)+' / 10000'));
        const edit=node('div');edit.className='profileEdit';
        for(const [label,field] of [['头像图片',file],['公开签名',sig],['背景主题',theme]]){const l=node('label',label);l.append(field);edit.append(l);}
        edit.append(bgLabel,removeBg,...slots);
        body.append(card(me),identity,edit,training,button('个人战绩',()=>history(),true),node('p','好友码 · '+me.code),node('h3','生涯战绩'),career(me));return;
      }
      if(view==='ranking'){const tabs=node('nav');for(const [key,label] of [['day','日榜'],['month','月榜'],['all','总榜']]){const b=button(label,()=>{period=key;rankPage=0;poll(true);},period===key);b.setAttribute('aria-pressed',period===key);tabs.append(b);}body.append(tabs,node('h3','全服击杀 '+(data.total||0)),node('p','玩家与僵尸击杀 · 北京时间 · 我的排名 '+(data.rank||'未上榜')));(data.ranking||[]).forEach((p,i)=>{const line=node('div');line.className='row';const face=button('',()=>inspect(p.code));face.setAttribute('aria-label','查看 '+p.name+' 的资料');face.append(portrait(p));const identity=node('span');identity.className='rankIdentity';identity.append(node('span',((data.page||0)*20+i+1)+'　'+p.name),node('small',p.online?'在线':'最后一次上线时间：'+(p.last?new Date(p.last).toLocaleString('zh-CN'):'暂无记录')));line.append(face,identity,node('strong',p.kills+' 击杀'));body.append(line);});if(!data.ranking?.length)body.append(node('p','还没有击杀记录'));const pages=node('nav'),prev=button('上一页',()=>{rankPage--;poll(true);}),next=button('下一页',()=>{rankPage++;poll(true);});prev.disabled=!data.page;next.disabled=(data.page||0)+1>=(data.pageCount||1);pages.append(prev,node('span',((data.page||0)+1)+' / '+(data.pageCount||1)),next);body.append(pages);return;}
      body.append(node('p','我的好友码 · '+me.code));
      const code=node('input');code.placeholder='输入对方好友码';code.maxLength=12;const lookup=node('footer');lookup.append(code,button('按好友码添加',()=>change('add',{target:code.value.trim()})));
      for(const m of data.inbox){
        const payload={target:m.from,type:m.type};
        row(m.name+(m.type==='add'?' 申请成为好友':' 邀请你加入 '+m.room),button('接受',()=>change('accept',payload),true),button('忽略',()=>change('dismiss',payload)));
      }
      for(const online of [true,false]){
        body.append(node('h3',online?'在线玩家':'离线玩家'));const group=data.friends.filter(p=>p.online===online);
        if(!group.length)body.append(node('p',online?'暂无在线好友':'暂无离线好友'));
        for(const p of group){
          const face=button('',()=>inspect(p.code));face.setAttribute('aria-label','查看 '+p.name+' 的资料和战绩');face.append(portrait(p));
          const line=node('div');line.className='row';
          line.classList.add('friendRow');
          line.dataset.theme=p.background||'slate';
          if(p.backgroundUrl&&/^\.\/backgrounds\/[A-F0-9]{12}\/[a-f0-9]{16}\.jpg$/.test(p.backgroundUrl)){line.style.backgroundImage='linear-gradient(90deg,#101920df,#10192088),url('+p.backgroundUrl+')';line.style.backgroundSize='cover';line.style.backgroundPosition='center';}
          const info=node('div'),act=p.activity;
          const status=!online?'最后上线 '+new Date(p.last).toLocaleString('zh-CN'):!act?'在线 · 主菜单':
            act.solo?'正在玩 '+modeNames[act.mode]+' · 单人':
            (act.phase==='waiting'?'房间准备中 · ':act.phase==='finished'?'对局已结束 · ':'正在玩 ')+(modeNames[act.mode]||act.mode)+' · '+act.roomName+' · '+(act.joinable?'可加入':'不可加入');
          info.append(node('strong',p.name),node('small',status));line.append(face,info);
          const buttons=node('div');buttons.className='friendActions';
          if(act?.joinable && session()?.room!==act.room){const go=button('加入',()=>change('friend-join',{target:p.code}),true);go.disabled=!!session();if(go.disabled)go.title='请先离开当前房间';buttons.append(go);}
          if(online&&session()?.token)buttons.append(button('邀请',()=>change('invite',{target:p.code}),true));
          buttons.append(button('私信'+(p.unread?' ('+p.unread+')':''),()=>openDM(p)));
          buttons.append(button('删除',()=>{if(confirm('从双方好友列表中移除 '+p.name+'？'))change('remove-friend',{target:p.code});}));
          line.append(buttons);
          body.append(line);
        }
      }
      body.append(lookup);
    }
    async function poll(force=false){
      if(!owner())return;
      if(view==='dm'){await updateDM();return;}
      if(view==='inspect'||view==='history'){await request('presence').catch(()=>{});return;}
      const ticket=++seq;
      try{
        const next=await request(view==='ranking'?'ranking':'presence',{period,page:rankPage});if(ticket!==seq)return;
        const changed=JSON.stringify([next.friends.map(p=>[p.code,p.name,p.avatar,p.online,p.online?0:p.last,p.activity,p.unread]),next.inbox])!==JSON.stringify([data?.friends.map(p=>[p.code,p.name,p.avatar,p.online,p.online?0:p.last,p.activity,p.unread]),data?.inbox]);
        data=next;
        const faceKey=next.me.avatarUrl||String(next.me.avatar)+next.me.name;if($('portrait').dataset.face!==faceKey){$('portrait').replaceChildren(portrait(next.me));$('portrait').dataset.face=faceKey;}
        if(!$('playerName').value || force && view==='profile')$('playerName').value=next.me.name;
        const notifications=next.inbox.length+next.friends.reduce((n,f)=>n+(f.unread||0),0);document.querySelectorAll('[data-social="friends"]').forEach(b=>b.textContent=notifications?'我的好友 ('+notifications+')':'我的好友');
        if(sheet.open && (force || view==='ranking' || changed && view==='friends' && !body.querySelector('input:focus')))draw();
      }catch(e){if(sheet.open)note.textContent=e.message;}
    }
    function open(v){if(!owner()){GWAccount.open();return;}view=v;note.textContent='';sheet.querySelector('h2').textContent={profile:'个人信息',friends:'我的好友',ranking:'排行榜'}[v];draw();if(!sheet.open)sheet.showModal();poll(true);}
    sheet.querySelector('header button').onclick=()=>sheet.close();sheet.onclose=()=>{view='';chatFriend=null;dmSeq++;};
    $('portrait').onclick=()=>open('profile');document.querySelectorAll('[data-social]').forEach(b=>b.onclick=()=>open(b.dataset.social));
    picker.querySelector('header button').onclick=()=>picker.close();
    const missions=[['经典生存','classic','startButton'],['线性生存','yard','soloYard'],['无尽模式','endless','soloEndless'],['排山倒海','horde','soloHorde']];
    function closeDeck(){$('undeadPage').hidden=true;}
    function openDeck(pvp=false){
      const deck=$('undeadCards');deck.replaceChildren();$('undeadPage').hidden=false;
      for(const [name,id,solo] of (pvp?[['1v1 五局三胜','duel'],['自由乱斗','free'],['冲锋团队竞技','tdm'],['爆破模式','bomb']]:missions)){
        const card=node('article'),actions=node('div');card.className='zMission';card.dataset.mission=id;actions.className='zActions';
        const openActions=()=>{
          deck.querySelectorAll('.zActions').forEach(el=>el.replaceChildren());
          if(pvp){actions.append(button('创建房间',()=>{closeDeck();mode(id);}),button('加入房间',()=>{closeDeck();browse(id);}));return;}
          actions.append(button('单人玩',()=>{closeDeck();$(solo).click();}),button('多人玩',()=>{
            actions.replaceChildren(button('创建房间',()=>{closeDeck();mode(id);}),button('加入房间',()=>{closeDeck();browse(id);}));
          }));
        };
        card.append(actions,button(name,openActions));card.onclick=e=>{if(e.target===card)openActions();};deck.append(card);
      }
    }
    $('deckBack').onclick=closeDeck;
    $('homeSettings').onclick=()=>{
      const section=picker.querySelector('section');picker.querySelector('h2').textContent='游戏设置';section.replaceChildren();
      const light=node('select');light.add(new Option('黑夜','night'));light.add(new Option('白天','day'));
      light.value=$('soloLight').value;light.onchange=()=>$('soloLight').value=light.value;
      const vol=node('input');vol.type='range';vol.min=0;vol.max=100;vol.value=localStorage.gwVolume??100;
      vol.oninput=()=>{localStorage.gwVolume=vol.value;window.dispatchEvent(new Event('gw-volume'));};
      for(const [text,field] of [['单人光照',light],['游戏音量',vol]]){const label=node('label',text+' ');label.append(field);section.append(label);}
      GWGraphics.panel(section);GWKeys.panel(section);ZombieActors.outlineSettings(section);GWSettings.textColors(section);GWSettings.arrange(section);
      section.append(button('制作者名单',()=>{
        picker.querySelector('h2').textContent='制作者名单';section.replaceChildren();
        for(const label of ['一代作者','二代作者'])section.append(node('p',label+'　greentailtohru'));
        for(const text of ['三代作者　GeorgeKy','游戏昵称　几何战争III','游戏版本　v1.0.0'])section.append(node('p',text));
        section.append(button('返回设置',()=>$('homeSettings').onclick()));
      }));
      section.append(button(GWAccount.user?'退出登录':'登录 / 注册',()=>{picker.close();GWAccount.user?GWAccount.logout():GWAccount.open();}));picker.showModal();
    };
    document.querySelectorAll('[data-modecard]').forEach(card=>card.onclick=()=>openDeck(card.dataset.modecard==='PVP'));
    refresh=()=>poll(true);window.addEventListener('gw-ready',()=>poll(true),{once:true});syncResults();window.addEventListener('online',syncResults);setInterval(()=>{if(!document.hidden)poll();},6500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
  }
  return {flushTraining,syncResults,train,connect,secret,clock,beginSolo,finishSolo,refresh:()=>refresh()};
})();
const GWVisual=(()=>{
  const defaults={style:'cross',size:10,gap:5,width:2,color:'#ffffff',opacity:100,dot:true,outline:true,dynamic:true,visible:true};
  function clean(x={}){const out={...defaults};if(!x||typeof x!=='object')return out;
    for(const k of ['size','gap','width','opacity']){const limits={size:[3,28],gap:[0,20],width:[1,6],opacity:[20,100]}[k];if(Number.isFinite(x[k]))out[k]=Math.max(limits[0],Math.min(limits[1],x[k]));}
    for(const k of ['dot','outline','dynamic','visible'])if(typeof x[k]==='boolean')out[k]=x[k];
    if(['cross','dot','circle','t'].includes(x.style))out.style=x.style;if(/^#[\da-f]{6}$/i.test(x.color))out.color=x.color;return out;}
  let own;try{own=clean(JSON.parse(localStorage.gwCrosshair||'{}'));}catch{own=clean();}
  let brightness=Math.max(.4,Math.min(1.6,Number(localStorage.gwBrightness)||1));
  function applyBrightness(){for(const canvas of document.querySelectorAll('canvas.gameStage,.gameStage canvas'))canvas.style.filter='brightness('+brightness+') contrast(var(--scene-contrast,1)) saturate(var(--scene-saturation,1))';}
  function draw(el,config=own,spread=0){if(!el)return;const c=clean(config||own),g=c.gap+(c.dynamic?Math.min(10,Math.max(0,spread))*.3:0),s=c.size,w=c.width;
    const key=JSON.stringify([c,Math.round(g*2)/2]);if(el.dataset.reticle===key)return;el.dataset.reticle=key;
    el.style.setProperty('background','transparent','important');el.style.setProperty('width','1px','important');el.style.setProperty('height','1px','important');
    el.style.setProperty('opacity',c.visible?String(c.opacity/100):'0','important');el.style.filter=c.outline?'drop-shadow(0 0 1px black) drop-shadow(0 0 1px black)':'none';
    let shapes='';const line=(x1,y1,x2,y2)=>`<path d="M${x1} ${y1}L${x2} ${y2}"/>`;
    if(c.style==='cross'||c.style==='t'){shapes+=line(-g-s,0,-g,0)+line(g,0,g+s,0)+line(0,g,0,g+s);if(c.style==='cross')shapes+=line(0,-g-s,0,-g);}
    if(c.style==='circle')shapes+=`<circle r="${g+s}" fill="none"/>`;
    if(c.dot||c.style==='dot')shapes+=`<circle r="${Math.max(1,w)}" fill="${c.color}" stroke="none"/>`;
    el.innerHTML=`<svg viewBox="-50 -50 100 100" width="100" height="100" style="position:absolute;left:-50px;top:-50px;overflow:visible" stroke="${c.color}" stroke-width="${w}" fill="none">${shapes}</svg>`;
  }
  function panel(parent){
    const section=document.createElement('details');section.innerHTML='<summary>准星设置</summary>';parent.append(section);
    const row=(name,input)=>{const l=document.createElement('label');l.append(name+' ',input);section.append(l);};
    const graphics=document.createElement('div');graphics.dataset.settingsTab='画面';parent.append(graphics);
    const bright=document.createElement('input');bright.type='range';bright.min=40;bright.max=160;bright.value=brightness*100;const value=document.createElement('output');value.textContent=bright.value+'%';
    bright.oninput=()=>{brightness=+bright.value/100;localStorage.gwBrightness=brightness;value.textContent=bright.value+'%';applyBrightness();};const brightLabel=document.createElement('label');brightLabel.append('场景亮度 ',bright,value);graphics.append(brightLabel);GWLight.panel(graphics);
    const preview=document.createElement('div');preview.style.cssText='position:relative;height:100px;background:#16212a;border-radius:6px';const reticle=document.createElement('i');reticle.style.cssText='position:absolute;left:50%;top:50%';preview.append(reticle);section.append(preview);
    const save=()=>{localStorage.gwCrosshair=JSON.stringify(own);draw(reticle,own);draw(document.getElementById('crosshair'));};
    for(const [key,name] of Object.entries({style:'样式',size:'线段长度 / 圆环大小',gap:'中心间距',width:'粗细',color:'颜色',opacity:'不透明度',visible:'显示准星',dot:'中心圆点',outline:'黑色描边',dynamic:'随移动扩散'})){
      const input=document.createElement(key==='style'?'select':'input');
      if(key==='style'){for(const [v,t] of [['cross','十字'],['dot','圆点'],['circle','圆环'],['t','T 形']])input.add(new Option(t,v));input.value=own[key];}
      else if(typeof own[key]==='boolean'){input.type='checkbox';input.checked=own[key];}
      else if(key==='color'){input.type='color';input.value=own[key];}
      else{input.type='range';const range={size:[3,28],gap:[0,20],width:[1,6],opacity:[20,100]}[key];input.min=range[0];input.max=range[1];input.value=own[key];}
      input.oninput=()=>{own[key]=input.type==='checkbox'?input.checked:input.type==='range'?+input.value:input.value;save();};row(name,input);
    }draw(reticle,own);
  }
  window.addEventListener('gw-ready',applyBrightness);
  return {get config(){return own;},clean,panel,draw,applyBrightness};
})();

const GWLight=(()=>{
  let cfg;try{cfg=JSON.parse(localStorage.gwLighting||'{}');}catch{cfg={};}cfg={sun:1,ambient:1,exposure:1,contrast:1,saturation:1,...cfg};
  function apply(scene,renderer){scene.traverse(o=>{if(o.isDirectionalLight||o.isAmbientLight||o.isHemisphereLight){if(o.userData.baseIntensity===undefined)o.userData.baseIntensity=o.intensity;o.intensity=o.userData.baseIntensity*(o.isDirectionalLight?cfg.sun:cfg.ambient);}});renderer.toneMappingExposure=.95*cfg.exposure;renderer.domElement.style.setProperty('--scene-contrast',cfg.contrast);renderer.domElement.style.setProperty('--scene-saturation',cfg.saturation);}
  function panel(parent){for(const [key,label,min,max] of [['sun','日光 / 月光',0,180],['ambient','环境光',0,180],['exposure','曝光',40,140],['contrast','对比度',60,140],['saturation','饱和度',0,160]]){const l=document.createElement('label'),input=document.createElement('input'),value=document.createElement('output');input.type='range';input.min=min;input.max=max;input.value=cfg[key]*100;value.textContent=input.value+'%';input.oninput=()=>{cfg[key]=+input.value/100;value.textContent=input.value+'%';localStorage.gwLighting=JSON.stringify(cfg);window.dispatchEvent(new Event('gw-light'));};l.append(label+' ',input,value);parent.append(l);}}
  return {apply,panel};
})();
