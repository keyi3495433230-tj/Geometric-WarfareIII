// The outer shell keeps the existing multiplayer ray target. Only its child meshes render.
function createOperator(teamColor){
  const cloth=new THREE.MeshStandardMaterial({color:teamColor,roughness:.9});
  const armor=new THREE.MeshStandardMaterial({color:0x303d41,roughness:.7});
  const trim=new THREE.MeshStandardMaterial({color:0x57675f,roughness:.83});
  const lens=new THREE.MeshStandardMaterial({color:0x99c4c4,metalness:.45,roughness:.28});
  const shell=new THREE.Mesh(new THREE.CylinderGeometry(.55,.4,2,8),cloth.clone());
  shell.material.colorWrite=false;shell.material.depthWrite=false;
  function box(parent,x,y,z,w,h,d,mat){
    const part=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);part.position.set(x,y,z);parent.add(part);return part;
  }
  const head=new THREE.Mesh(new THREE.SphereGeometry(.32,10,8),armor);
  head.position.y=.89;shell.add(head);
  box(head,0,.04,-.264,.46,.12,.10,lens);
  box(head,0,-.12,-.23,.39,.13,.13,trim);
  for(const side of [-1,1])box(head,side*.29,-.01,0,.09,.19,.19,trim);
  box(shell,0,.20,0,.64,.80,.39,cloth);
  box(shell,0,.24,-.19,.54,.58,.15,armor);
  box(shell,0,.17,.26,.48,.57,.21,trim);
  box(shell,0,-.18,0,.60,.12,.43,armor);
  box(head,0,.17,-.16,.49,.07,.30,trim);
  box(head,-.30,.16,.04,.035,.23,.04,armor);
  box(shell,.21,.38,-.238,.115,.17,.08,trim);
  const legs=[];
  for(const side of [-1,1]){
    box(shell,side*.16,.06,-.29,.20,.21,.12,trim);
    box(shell,side*.38,.39,-.04,.21,.29,.24,cloth);
    const arm=box(shell,side*.36,.22,-.20,.17,.19,.43,trim);arm.rotation.x=-.24;
    box(shell,side*.32,.22,-.40,.15,.15,.17,armor);
    const hip=new THREE.Group();hip.position.set(side*.17,-.23,0);shell.add(hip);legs.push(hip);
    box(hip,0,-.33,0,.24,.65,.26,cloth);
    box(hip,0,-.47,-.115,.19,.19,.10,trim);
    box(hip,0,-.73,-.035,.25,.19,.32,armor);
  }
  // Rigid pieces on the same joint draw together; legs and head can still move.
  for(const joint of [shell,head,...legs]){
    const batches=new Map();
    for(const part of [...joint.children]){
      if(part.geometry?.type!=='BoxGeometry')continue;
      const list=batches.get(part.material)||[];list.push(part);batches.set(part.material,list);
    }
    for(const [mat,parts] of batches){
      if(parts.length<2)continue;
      const batch=new THREE.InstancedMesh(new THREE.BoxGeometry(),mat,parts.length);
      parts.forEach((part,i)=>{
        const {width,height,depth}=part.geometry.parameters;part.scale.set(width,height,depth);part.updateMatrix();
        batch.setMatrixAt(i,part.matrix);joint.remove(part);part.geometry.dispose();
      });joint.add(batch);
    }
  }
  const plates=new THREE.Group();plates.visible=false;shell.add(plates);
  box(plates,0,.20,-.30,.66,.63,.13,trim);
  for(const side of [-1,1])box(plates,side*.41,.46,-.02,.30,.28,.36,armor);
  shell.userData.heavyPlates=plates;
  shell.userData.uniform=cloth;shell.userData.legs=legs;PlayerActors.attach(shell);
  return shell;
}
function createArena({showRoundEnd,playHighlights,roundIntro,endIntro,equipPack,scene,camera,controls,obstacles,state,startGame,updateHud,spawnImpact,confirmImpact,resetRound,remoteSound,applySurvival,tickSurvival,initAudio,weaponSource}) {
  const field=document.querySelector('#roomCode'), status=document.querySelector('#netStatus');
  const button=document.querySelector('#joinArena'), peers=new Map();
    const create=document.querySelector('#createArena'), mode=document.querySelector('#roomMode'),leave=document.querySelector('#leaveArena');
  const addBot=document.getElementById('addBot');
  addBot.onclick=async()=>{addBot.disabled=true;try{await post('/bot',{token:session.token});}catch(e){lobbyStatus.textContent=e.message;}finally{addBot.disabled=false;}};
  let session=null, hit=null, deaths=0, round=0,phase='waiting',closing=false;
  const actions=[], orientation=new THREE.Euler(0,0,0,'YXZ');
  let rescueCandidate=null,autoRescue=null;
  const hits=[];let pressed=false,using=false,downed=false,hint='';
  let cursor,afterKill=0,lastRound=-1,localRoom,localPlayer,localTime=0,localElapsed=0,targetId='',ledgerKey='';
  function inSurvival(){return ['coop','yard','endless','classic','horde'].includes(session?.mode);}
  let hosted=null,rules=null,hostClock=0,hostElapsed=0,pulseTimer;
  const nickname=document.getElementById('roomNickname'),allowJoin=document.getElementById('allowJoin'),teamCollision=document.getElementById('teamCollision');
  const mapSelect=document.getElementById('bombMap');
  for(const [id,label] of Object.entries(Dust.names))mapSelect.add(new Option(label,id));
  const options=()=>({mapId:mapSelect.value,nickname:nickname.value,allowJoin:allowJoin.checked,teamCollision:teamCollision.checked});
  for(const field of [nickname,allowJoin,teamCollision])field.onchange=()=>{if(session)post('/options',{token:session.token,...options()}).catch(e=>lobbyStatus.textContent=e.message);};
  function showOptions(m){mapSelect.parentElement.hidden=m!=='bomb';mapSelect.disabled=!!session;if(session?.mapId)mapSelect.value=session.mapId;document.getElementById('collisionOption').hidden=!['coop','classic','yard','endless','horde'].includes(m);}
  mode.onchange=()=>{light.value=['free','duel','tdm','bomb'].includes(mode.value)?'day':'night';showOptions(mode.value);};
  let bombUse=false;
  document.getElementById('bombAction').onclick=()=>{bombUse=true;};
  document.addEventListener('keydown',e=>{if(GWKeys.code(e)==='KeyE' && controls.isLocked && latest?.bomb?.canUse)bombUse=true;});
  const names={bomb:'爆破',classic:'经典生存',horde:'排山倒海',tdm:'冲锋团队竞技',duel:'1v1',free:'自由对战',coop:'双人生存',yard:'多人守窗',endless:'无尽生存'};
  const light=document.querySelector('#roomLight');light.onchange=()=>{if(session)post('/lighting',{token:session.token,light:light.value}).catch(e=>lobbyStatus.textContent=e.message);};
  const lobbyStatus=document.querySelector('#lobbyStatus'),roster=document.querySelector('#roomRoster');
  let latest,readySent=false,rosterKey='';
  function showScreen(screen){
    document.body.dataset.screen=screen;
    document.querySelector('#startPanel').hidden=screen!=='home';
    document.querySelector('#lobbyPanel').hidden=screen!=='lobby';
  }
  const roomsView=document.querySelector('#publicRooms');
  let route='choice',catalogVersion=0,catalogKey='';
  let roomFilter=null;
  function lobbyRoute(next){
    if(next!=='browse')roomFilter=null;
    route=next;document.getElementById('roomOptions').hidden=!['host','room'].includes(next);showOptions(mode.value);addBot.hidden=true;catalogVersion++;catalogKey='';lobbyStatus.textContent='';
    document.querySelector('#lobbyTitle').textContent=({choice:'多人联机',host:'创建房间',browse:'公共大厅',room:'房间大厅'})[next];
    document.querySelector('#lobbyChoice').hidden=next!=='choice';
    document.querySelector('#lobbyFields').hidden=!['host','browse'].includes(next);
    document.querySelector('#codeRow').hidden=document.querySelector('#modeRow').hidden=next!=='host';
    document.querySelector('#lightRow').hidden=!['room','host'].includes(next);
    roomsView.hidden=next!=='browse';create.hidden=next!=='host';button.hidden=next!=='room';
    document.querySelector('#homeFromLobby').textContent=next==='choice'?'← 主界面':'← 多人联机';
    if(next==='browse'){roomsView.textContent='正在获取房间…';refreshRooms();}
    if(next==='host'&&!field.value)field.value='GW-'+Math.random().toString(36).slice(2,7).toUpperCase();
  }
  document.querySelector('#hostPath').onclick=()=>lobbyRoute('host');
  document.querySelector('#joinPath').onclick=()=>lobbyRoute('browse');
  document.querySelector('#openLobby').onclick=()=>{showScreen('lobby');lobbyRoute('choice');};
  document.querySelector('#homeFromLobby').onclick=()=>{if(!session && !create.disabled){if(route==='choice')showScreen('home');else lobbyRoute('choice');}};
  showScreen(location.hash==='#lobby'?'lobby':'home');
  const comms=roomComms(post,controls),aimTag=document.getElementById('aimPlayer'),aimRay=new THREE.Raycaster();
  const ledger=document.querySelector('#teamLedger'),boardButton=document.querySelector('#touchBoard');
  function updateLedger(world,players){
    ledger.hidden=world.area<2;
    if(ledger.hidden)return;
    const key=JSON.stringify(players.map(p=>[p.id,p.name,p.kills,p.cash]));
    if(key===ledgerKey)return;
    ledgerKey=key;
    const rows=players.map(p=>{
      const tr=document.createElement('tr');
      for(const value of [p.name+(p.id===session.id?'（我）':''),p.kills,p.cash]){
        const td=document.createElement('td');td.textContent=value;tr.append(td);
      }
      return tr;
    });
    ledger.querySelector('tbody').replaceChildren(...rows);
  }
  const correction=new THREE.Vector3();
  let latestSelfDeaths,nextAimCheck=0,sequence=0,rtt=80,clockOffset=null,jitter=0;
  const interpolationDelay=()=>Math.min(260,Math.max(100,rtt*.5+55+jitter));
  const aimTargets=[],aimHits=[];
  const correctionApplied=new THREE.Vector3();
  let creditedCash=500,creditedXp=0,buyArmor=false;
  function tick(dt){
    if(session && !localRoom && correction.lengthSq()>0){
      const fraction=Math.min(1-Math.exp(-dt*10),4*Math.min(dt,.05)/Math.max(.001,correction.length()));
      correctionApplied.addScaledVector(correction,fraction);
      controls.getObject().position.addScaledVector(correction,fraction);
      correction.multiplyScalar(1-fraction);
      if(correction.lengthSq()<.000001)correction.set(0,0,0);
    }
    if(hosted){
      hostElapsed+=dt;
      while(hostElapsed>=.05){rules.tick(hosted,.05,Date.now());hostElapsed-=.05;}
    }
    if(localRoom && phase==="playing" && controls.isLocked){
      localElapsed+=dt;if(localElapsed>=.05){stepOffline(localElapsed);localElapsed=0;}
    }
    if(inSurvival())tickSurvival(dt);
    if(peers.size && controls.isLocked){
      if(performance.now()>=nextAimCheck){
        nextAimCheck=performance.now()+100;aimRay.setFromCamera({x:0,y:0},camera);
        aimTargets.length=aimHits.length=0;
        for(const peer of peers.values())if(peer.visible)aimTargets.push(peer,peer.children[0]);
        const hit=aimRay.intersectObjects(aimTargets,false,aimHits)[0];
        let tag='';
        if(hit){
          aimRay.far=hit.distance;aimTargets.length=aimHits.length=0;
          for(const o of obstacles)aimTargets.push(o.mesh);
          if(!aimRay.intersectObjects(aimTargets,false,aimHits).length)tag=hit.object.userData.tag||hit.object.parent?.userData.tag||'';
          aimRay.far=Infinity;
        }
        if(aimTag.textContent!==tag)aimTag.textContent=tag;
      }
    }else if(aimTag.textContent)aimTag.textContent='';
    const blend=1-Math.exp(-dt*20);
    for(const mesh of peers.values()){
      const pose=mesh.userData;if(pose.playerModel)mesh.scale.y=1;else mesh.scale.y+=((pose.targetScale||1)-mesh.scale.y)*(1-Math.exp(-dt*12));
      const sampled=pose.network?.sample(performance.now(),dt,rtt);
      if(sampled){if(Number.isFinite(sampled.yaw))pose.yaw=sampled.yaw;if(Number.isFinite(sampled.pitch))pose.pitch=sampled.pitch;pose.sample??=mesh.position.clone();pose.sample.set(sampled.x,sampled.y,sampled.z);const maxStep=20*Math.min(.05,dt),distance=mesh.position.distanceTo(pose.sample);if(distance>maxStep)mesh.position.lerp(pose.sample,maxStep/Math.max(.0001,distance));else mesh.position.copy(pose.sample);}
      mesh.rotation.y+=Math.atan2(Math.sin(pose.yaw-mesh.rotation.y),Math.cos(pose.yaw-mesh.rotation.y))*blend;
      PlayerActors.tick(mesh,dt);const now=performance.now();
      if(pose.hitUntil){
        const remaining=Math.max(0,(pose.hitUntil-now)/200);
        pose.uniform.emissiveIntensity=mesh.children[0].material.emissiveIntensity=remaining;
        if(!remaining)pose.hitUntil=0;
      }
      if(!pose.playerModel)pose.weapon.rotation.set(pose.pitch+(pose.reloadUntil>now ? .55 : 0),0,pose.inspectUntil>now ? .85 : 0);
      pose.flash.visible=pose.flashUntil>now;
      const stride=Math.min(1,pose.speed.length()/4);
      pose.step=(pose.step||0)+dt*8*stride;
      pose.legs.forEach((leg,i)=>leg.rotation.x=(i?1:-1)*Math.sin(pose.step)*stride*.54);
    }
  }
  const rewards={uav:'无人侦察机',drone:'炸弹无人机',jammer:'反侦察无人机',missile:'空对地导弹',mortar:'迫击炮小队',juggernaut:'无赖战士',chopper:'直升机射手',gunship:'空中炮艇'};
  const supportPanel=document.getElementById('streakPanel'),supportButton=supportPanel.querySelector('button'),cycleButton=supportPanel.querySelector('[data-cycle]');
  let selectedReward='',supportKey='',nextSupportShot=0;
  function updateRewards(){
    const s=latest?.support;
    supportPanel.hidden=!s||phase!=='playing'||!state.started;
    if(supportPanel.hidden)return;
    if(!s.ready.includes(selectedReward))selectedReward=s.ready[0]||'';
    const text=s.air?rewards[s.air]+' · 开火':s.heavy?'重甲生效':s.jammed?'雷达受干扰':s.scan?'无人机侦察中':'连杀 '+s.chain;
    const key=[text,selectedReward,s.ready.length].join('|');if(key===supportKey)return;supportKey=key;
    supportPanel.querySelector('small').textContent=text;
    supportButton.textContent=selectedReward?rewards[selectedReward]+' [H]':'暂无奖励';
    supportButton.disabled=!selectedReward;cycleButton.hidden=s.ready.length<2;
  }
  function cycleReward(){
    const ready=latest?.support?.ready||[];if(ready.length){selectedReward=ready[(ready.indexOf(selectedReward)+1)%ready.length];updateRewards();}
  }
  const airView=new THREE.PerspectiveCamera(65,1,.1,220);
  function activeAirView(){
    if(!latest?.support?.air||phase!=='playing')return null;
    airView.position.copy(controls.getObject().position);airView.position.y+=latest.support.air==='gunship'?32:19;
    airView.rotation.copy(camera.rotation);airView.rotation.x=Math.max(-1.48,Math.min(-.20,camera.rotation.x-.85));
    airView.aspect=camera.aspect;airView.updateProjectionMatrix();airView.updateMatrixWorld(true);return airView;
  }
  function commandReward(id){
    if(!id||phase!=='playing'||downed||actions.length>=10)return;
    aimRay.setFromCamera({x:0,y:0},activeAirView()||camera);
    const targets=Array.from(peers.values()).filter(m=>m.visible).concat(obstacles.map(o=>o.mesh));
    const hit=aimRay.intersectObjects(targets,false)[0];
    const ground=aimRay.ray.direction.y<-.015?-aimRay.ray.origin.y/aimRay.ray.direction.y:35;
    const at=hit&&hit.distance<Math.min(110,ground)?hit.point.clone():aimRay.ray.at(Math.min(100,ground),new THREE.Vector3());at.y=Math.max(0,Math.min(8,at.y));
    actions.push({type:'streak:'+id,x:at.x,y:at.y,z:at.z});
  }
  supportButton.onclick=()=>commandReward(selectedReward);cycleButton.onclick=cycleReward;
  window.addEventListener('keydown',e=>{if(!controls.isLocked||e.repeat||e.target.matches?.('input,textarea,select'))return;
    if(GWKeys.code(e)==='KeyH')commandReward(selectedReward);if(GWKeys.code(e)==='KeyJ')cycleReward();
  });
  function hostedScore(){
    return hosted?{phase:hosted.phase,winner:hosted.winner,winTeam:hosted.winTeam,score:hosted.score,cleared:!!hosted.survival?.cleared,evacuated:!!hosted.survival?.evacuated,maxArea:hosted.survival?.maxArea,wave:hosted.survival?.wave,results:[...hosted.members.values()].map(q=>({id:q.id,kills:q.kills,deaths:q.deaths,dogKills:q.dogKills,playMs:q.playMs,team:q.team,hp:q.hp,cash:q.cash}))}:{};
  }
  function exitRoom() {
    if(state.started && (localRoom||!session))SquadUI.finishSolo(localPlayer?.kills??state.totalKills,(localPlayer?.hp??state.health)<=0,localRoom?.survival.wave??state.wave,false,localPlayer?.dogKills??state.dogKills);
    closing=true;clearTimeout(pulseTimer);comms.close();
    if(session && !localRoom)fetch('./leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:session.token,practice:GWRun.practice,...hostedScore()}),keepalive:true}).catch(()=>{});
  }
  leave.onclick=(home)=>{const lobby=home!==true && session && !localRoom;exitRoom();location.hash=lobby?'lobby':'';location.reload();};
  window.addEventListener('pagehide',exitRoom);
  function finish(text,clips) { endIntro(false);
    GWRun.finish();if(!GWRun.practice){SquadUI.flushTraining();if(GWAccount.user && creditedXp)localStorage.setItem('gwPvpXp.'+GWAccount.user.id,String((Number(localStorage.getItem('gwPvpXp.'+GWAccount.user.id))||0)+creditedXp));}
    if(localRoom && localRoom.phase==='finished')SquadUI.finishSolo(localPlayer.kills,!localPlayer.hp,localRoom.survival.wave,false,localPlayer.dogKills||0);
    if(hosted && hosted.phase==='finished')post('/match-end',{token:session.token,...hostedScore()}).then(()=>SquadUI.refresh()).catch(()=>{});
    else SquadUI.refresh();
    document.getElementById("packs").close();document.getElementById('bombAction').hidden=true;state.gameOver=true;document.body.dataset.screen='game';controls.unlock();
    const overlay=document.querySelector('#screenOverlay');
    const panel=document.createElement('div');panel.className='panel';
    const title=document.createElement('h2');title.textContent=text;
    const back=document.createElement('button');back.textContent=localRoom?'返回主界面':'返回大厅';back.onclick=leave.onclick;
    panel.append(title);
    if(latest?.duelReport?.length){
      panel.classList.add('duelReport');const stats=latest.duelReport,cols=document.createElement('div');cols.className='duelColumns';
      const maxDamage=Math.max(1,...stats.map(q=>q.damage)),maxShots=Math.max(1,...stats.map(q=>q.shots));
      for(const q of stats){
        const col=document.createElement('article'),face=document.createElement('span');face.className='avatar';
        if(q.avatarUrl){const img=new Image();img.src=q.avatarUrl;img.alt=q.name;face.append(img);}else face.textContent=['★','◆','⚡','☠','♜','✦'][q.avatar]||Array.from(q.name)[0];
        const name=document.createElement('strong');name.textContent=q.name;col.append(face,name);const sub=document.createElement('small');sub.textContent=(q.level?'LV.'+q.level+' · ':'')+q.kills+' 击杀';col.append(sub);
        const weapons=document.createElement('p');weapons.textContent=Object.keys(q.weapons).map(id=>YardSurvival.weapons.find(w=>w.id===id)?.name||({axe:'战斧',knife:'战斗刀',karambit:'爪刀',butterfly:'蝴蝶刀'}[id]||id)).join('、')||'未使用武器';col.append(weapons);
        for(const [label,value,max] of [['对敌伤害',q.damage,maxDamage],['开火',q.shots,maxShots],['命中',q.hits,Math.max(1,q.shots,q.hits)]]){
          const line=document.createElement('label'),bar=document.createElement('progress');line.textContent=label+'　'+value;bar.max=max;bar.value=value;line.append(bar);col.append(line);
        }
        if(q.id!==session.id){
          const add=document.createElement('button');add.textContent='加好友';add.disabled=!q.bot&&(!q.code||!GWAccount.user);
          add.onclick=async()=>{if(q.bot){add.textContent='对方已拒绝好友申请';return;}add.disabled=true;try{await post('/social',{action:'add',target:q.code});add.textContent='申请已发送';}catch(e){add.textContent=e.message;add.disabled=false;}};col.append(add);
        }cols.append(col);
      }panel.append(cols);
    }
    panel.append(back);const settle=()=>{overlay.replaceChildren(panel);overlay.classList.remove('hidden');};
    if(Array.isArray(clips)){overlay.classList.add('hidden');playHighlights(clips,settle);}else settle();
  }
  async function post(path,data) {
    if(session && GWRun.practice)data={...data,practice:true};
    if(path==='/sync' && hosted){
      
      return rules.sync(hosted,hosted.members.get(session.id),data);
    }
    const payload=JSON.stringify(data);
    let response;
    for(let attempt=0;attempt<3;attempt++){
      try{response=await fetch('.'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:AbortSignal.timeout(path==='/sync'?1800:5000)});break;}
      catch(e){if(path!=='/sync'||attempt===1||closing)throw e;}
    }
    const body=await response.json();
    if(!response.ok) throw Error(body.error || '服务不可用');
    return body;
  }
  function stepOffline(dt){
    localTime+=dt*1000;
    const pos=controls.getObject().position;
    YardSurvival.playerMotion(localRoom,localPlayer,pos.x,pos.z);
    pos.x=localPlayer.x;pos.z=localPlayer.z;
    orientation.setFromQuaternion(camera.quaternion);localPlayer.yaw=orientation.y;localPlayer.seen=localTime;
    localPlayer.weapon=state.activeWeapon===3?(state.meleeId||'axe'):state.slots[state.activeSlotIndex]?.def.id;
    const impact=YardSurvival.survivalInput(localRoom,localPlayer,{use:using,interact:pressed,target:targetId,hits:hits.splice(0),actions:actions.splice(0)},localTime);
    pressed=false;
    YardSurvival.stepSurvival(localRoom,dt,localTime);pos.x=localPlayer.x;pos.z=localPlayer.z;
    consume({survival:YardSurvival.survivalSnapshot(localRoom.survival,afterKill,localPlayer),players:[localPlayer],phase:localRoom.phase,round,impact});
  }
  let syncFailureAt=0,lastServerTime=0,lastAck=0,lastClock='',peerClock='';
  async function sync() {
    try {
      const sentAt=performance.now(),appliedAtSend=correctionApplied.clone();
      const {x,y,z}=controls.getObject().position;
      const pending=hit; hit=null;
      orientation.setFromQuaternion(camera.quaternion);
      const interact=pressed,orderArmor=buyArmor;pressed=false;buyArmor=false;
      const useSite=bombUse;bombUse=false;
      const sentSequence=++sequence;const result=await post('/sync',{positionEpoch:latest?.players.find(p=>p.id===session.id)?.positionEpoch||0,sequence:sentSequence,shotTime:clockOffset===null?undefined:performance.now()+clockOffset-Math.max(interpolationDelay(),...[...peers.values()].map(m=>m.userData.network?.delay(rtt)||0)),canHost:true,crosshair:GWVisual.config,look:state.activeWeapon===1?Smith.look(state.slots[state.activeSlotIndex]?.def.id):state.activeWeapon===3?Smith.look(state.meleeId):state.activeWeapon===4?Smith.look(state.activeSpecial):0,bombUse:useSite,token:session.token,x,y,z,yaw:orientation.y,pitch:orientation.x,aim:state.aiming,weapon:state.activeWeapon===3?(state.meleeId||'axe'):state.activeSpecial||state.slots[state.activeSlotIndex]?.def.id,stance:state.stance,actions:actions.splice(0),cursor,afterKill,hit:pending?.message,buyArmor:orderArmor,hits:hits.splice(0),interact,target:targetId,rescueOnly:autoRescue,use:(using || !!autoRescue) && controls.isLocked,round});
      if(closing)return;
      if(result.handoff){await activateHost(result);setTimeout(sync,0);return;}
      if(result.localPending){setTimeout(sync,50);return;}
      const clock=result.clockId||'server',clockChanged=clock!==lastClock;if(clockChanged){lastServerTime=0;clockOffset=null;lastClock=clock;}
      if((Number.isFinite(result.ackSequence)&&result.ackSequence<lastAck)||(Number.isFinite(result.serverTime)&&result.serverTime<lastServerTime)){setTimeout(sync,0);return;}lastAck=Math.max(lastAck,result.ackSequence||0);lastServerTime=Math.max(lastServerTime,result.serverTime||0);
      const receivedAt=performance.now();jitter+=(Math.abs(receivedAt-sentAt-rtt)-jitter)*.12;rtt+=(receivedAt-sentAt-rtt)*.15;
      if(Number.isFinite(result.serverTime)){const offset=result.serverTime-(receivedAt+sentAt)*.5;clockOffset=clockOffset===null?offset:clockOffset+(offset-clockOffset)*.08;}
      if(!result.survival && result.impact && pending)spawnImpact(pending.point);
      if(round===result.round && phase==='playing' && (result.ackSequence===undefined || result.ackSequence===sentSequence)){
        const ack=result.players.find(p=>p.id===session.id);
        if(['tdm','free'].includes(session.mode) && latest && ack.positionEpoch!==latest.players.find(p=>p.id===session.id)?.positionEpoch){
          controls.getObject().position.set(ack.x,ack.y,ack.z);camera.rotation.set(0,ack.yaw,0,'YXZ');
        }
        const dx=ack.x-x-(correctionApplied.x-appliedAtSend.x),dz=ack.z-z-(correctionApplied.z-appliedAtSend.z);
        const error=Math.hypot(dx,dz);
        if((ack.positionEpoch||0)!==(latest?.players.find(p=>p.id===session.id)?.positionEpoch||0) || ack.deaths!==latestSelfDeaths){controls.getObject().position.x=ack.x;controls.getObject().position.z=ack.z;correction.set(0,0,0);}
        else if(error>.025)correction.set(dx,0,dz);
        else correction.set(0,0,0);
      }
      syncFailureAt=0;consume(result);
      if(phase!=='finished' && phase!=='abandoned')setTimeout(sync,Math.max(0,55-(performance.now()-sentAt)));
    }catch{if(closing)return;
      syncFailureAt ||= performance.now();
      if(performance.now()-syncFailureAt<12000){status.textContent='正在恢复网络连接…';setTimeout(sync,250);return;}
      finish("连接中断");status.textContent='连接中断，刷新页面后可重新加入';}
  }
  function consume(result){
      if(result.practice && !GWRun.practice)GWRun.mark();
      latest=result;if(!localRoom)comms.update(session,result);
      phase=result.phase;showRoundEnd(result.roundEnd,result.serverTime);state.stunEnd=performance.now()+(result.stunMs||0);
      const me=result.players.find(p=>p.id===session.id);
      const rival=result.players.find(p=>p.id!==session.id);
      if(round!==result.round){
        round=result.round;correction.set(0,0,0);resetRound();if(!inSurvival() && round>0 && phase==='playing')equipPack();controls.getObject().position.set(me.x,me.y,me.z);camera.rotation.set(0,me.yaw,0,'YXZ');
      }
      if(!result.survival && phase==='countdown'){
        if(!state.started){initAudio();startGame(true);}
        roundIntro(result.introMs??result.countdown*1000,me,round,result.players);
      }else if(!result.survival)endIntro(phase==='playing');
      if(!result.survival && state.started && (me.hp<state.health || me.armor<state.armor || me.deaths>(latestSelfDeaths??me.deaths)))state.damageFlashTimer=.3;
      latestSelfDeaths=me.deaths;updateRewards();
      if(me && Number.isFinite(me.armor) && (state.armor!==me.armor || state.armorLevel!==me.armorLevel)){
        state.armor=me.armor;state.armorLevel=me.armorLevel||1;state.maxArmor=state.armorLevel*100;updateHud();
      }
      if(!result.survival && me){
        if(!GWRun.practice && GWAccount.user && me.xp>creditedXp){
          const earned=me.xp-creditedXp;
          const total=(Number(localStorage.getItem('gwPvpXp.'+(GWAccount.user?.id||'guest')))||0)+earned;
          creditedXp=me.xp;
        }
        downed=me.hp===0;
        if(me.cash!==creditedCash){state.money+=me.cash-creditedCash;creditedCash=me.cash;updateHud();}
        if(state.health!==me.hp){state.health=me.hp;updateHud();}
        if(result.impact)confirmImpact(result.impact.lethal,result.impact.head,result.impact);
      }
      if(phase==='finished'||phase==='abandoned'){
        const score=me.kills+' : '+(rival?.kills??0);
        status.textContent='';
        finish(inSurvival()?(phase==='abandoned'?'队友已离开':result.survival.evacuated?'传送门撤离 · 已保存第 '+result.survival.wave+' 波':result.survival.cleared?'排山倒海 · 50 波通关':'小队覆灭 · 第 '+result.survival.wave+' 波'):phase==='abandoned'?'对手已离开，本场结束':((result.bomb||result.teamMatch)?((result.bomb||result.teamMatch).team===(result.bomb||result.teamMatch).winTeam?'胜利　':'失败　')+(result.bomb||result.teamMatch).score.join(' : '):(result.winner===me.id?'胜利　':'失败　')+score),result.highlights);
        return;
      }
      if(!state.started && !localRoom && phase==='playing'){initAudio();startGame();}
      if(!state.started && !localRoom){
        const key=result.host+JSON.stringify(result.players.map(p=>[p.id,p.name,p.ready,p.difficulty,phase]));
        if(rosterKey!==key){
          rosterKey=key;roster.hidden=false;
          roster.replaceChildren(...result.players.map(p=>{
            const li=document.createElement('li'),badge=document.createElement('span');
            li.textContent=p.name+(p.id===me.id?'（我）':'');badge.textContent=p.id===result.host?'房主':p.ready?'已准备':'未准备';li.append(badge);
            if(p.bot){
              const level=document.createElement('select');level.setAttribute('aria-label',p.name+'难度');
              for(const [value,label] of [['easy','简单'],['normal','普通'],['veteran','精英']])level.add(new Option(label,value));
              level.value=p.difficulty||'normal';level.disabled=result.host!==me.id || phase!=='waiting';
              level.onchange=async()=>{try{await post('/bot-difficulty',{token:session.token,bot:p.id,difficulty:level.value});}catch(e){level.value=p.difficulty;lobbyStatus.textContent=e.message;}};
              li.append(level);
            }
            return li;
          }));
        }
        const host=result.host===me.id;for(const el of [nickname,allowJoin,teamCollision])el.disabled=!host||phase!=='waiting';
        if(document.activeElement!==nickname)nickname.value=result.nickname||session.room;
        if(document.activeElement!==allowJoin)allowJoin.checked=!!result.allowJoin;
        if(document.activeElement!==teamCollision)teamCollision.checked=result.teamCollision!==false;
        showOptions(session.mode);addBot.hidden=!host||phase!=='waiting'||result.players.length>=session.limit;document.querySelector('#lightRow').hidden=false;light.disabled=!host||phase!=='waiting';if(document.activeElement!==light||!host)light.value=result.light;
        const canEnter=phase==='playing';
        button.disabled=phase==='countdown' || !canEnter && (host?(result.players.length<2||result.players.some(p=>p!==me&&!p.ready)):readySent);
        button.textContent=phase==='countdown'?'即将开战':canEnter?'进入战场':host?'开始游戏':readySent?'已准备':'准备开始';
        lobbyStatus.textContent=names[session.mode]+' · '+session.room+' · '+result.players.length+'/'+session.limit+' 人 · '+
          (phase==='countdown'?result.countdown+' 秒后开战':canEnter?'可以进入战场':readySent?'等待其他队员':'等待全员准备');
        return;
      }
      if(result.survival){
        downed=me.hp<=0;
        applySurvival(result.survival,me);
        afterKill=result.survival.killCursor;
        const interaction=YardSurvival.interaction(result.survival,me);
        const rescuing=result.players.find(p=>p.id===me.rescueId && !p.hp)||result.players.filter(p=>p!==me && !p.hp && Math.hypot(me.x-p.x,me.z-p.z)<3).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z))[0];
        if(autoRescue && (downed || phase!=='playing' || !result.players.some(p=>p.id===autoRescue && p.hp===0) || (!me.rescueId && rescuing?.id!==autoRescue)))autoRescue=null;
        rescueCandidate=rescuing?.id||null;
        targetId=interaction?.id||'';
        boardButton.hidden=!interaction?.id.startsWith('window') || downed || !!rescuing || phase!=='playing';
        boardButton.disabled=!interaction?.repair;boardButton.textContent=interaction?.repair?'封窗':'已封窗';
        hint='';
        if(downed)hint='已倒地 · 等待队友救援';
        else if(rescuing)hint='按住互动 / E 救援 '+rescuing.name+' '+Math.floor(rescuing.progress/2.5*100)+'%';
        else if(interaction)hint=(interaction.id.startsWith('window') && !interaction.repair?'':'互动 / E · ')+interaction.text;
        updateLedger(result.survival,result.players);
      }
      if(!result.survival)updateLedger({area:2},result.players);
      if(localRoom&&result.impact?.lethal&&result.impact.head)recordSoloHead();
      if(result.survival && result.impact)confirmImpact(result.impact.lethal,result.impact.head,result.impact);
      const ids=new Set();
      for(const p of result.players){
        if(p.id===session.id){
          status.textContent='房间 '+session.room+' · '+result.players.length+'/8 人 · 生命 '+p.hp+' · 击杀 '+p.kills+' · 阵亡 '+p.deaths;
          if(result.bomb){
            const b=result.bomb;
            status.textContent=(b.team===b.attack?'进攻':'防守')+' · '+b.score.join(' : ')+' · '+(b.site?b.site+' 点已安放':'A / B 炸弹点')+' · '+b.seconds+' 秒';
            const act=document.getElementById('bombAction');act.hidden=!b.canUse || phase!=='playing';act.textContent=b.job?.id===me.id?'保持原地…':(b.site?'拆除':'安放')+' [E]';
          }
          if(result.teamMatch){const m=result.teamMatch;
            status.textContent=(me.team===0?'蓝队':'红队')+' · '+m.score.join(' : ')+' / 60'+(m.swapped?' · 已换边':'')+(!me.hp?' · 观战 · '+Math.ceil(m.respawnMs/1000)+' 秒复活':'');
          }
          if(session.mode==='duel'){
            const readiness='你'+(me.ready?'已准备':'未准备')+' · '+(rival?'对手'+(rival.ready?'已准备':'未准备'):'等待对手加入');
            status.textContent=session.room+' · '+(phase==='waiting'?readiness:'第 '+round+' 局　'+me.kills+' : '+rival.kills+'　'+(phase==='countdown'?result.countdown+' 秒后开战':'生命 '+me.hp));
          }
          if(inSurvival()){
            const world=result.survival;
            const team=result.players.filter(p=>p.id!==me.id);
            if(phase==='waiting'){
              const ready=result.players.filter(p=>p.ready).length;
              status.textContent=(session.mode==='yard'?'多人守窗':'双人生存')+' · '+result.players.length+'/'+session.limit+' 人 · '+ready+' 人已准备 · '+(me.ready?'你已准备':'点击开始游戏准备');
            }else if(phase==='countdown')status.textContent='合作生存 · '+result.countdown+' 秒后开始';
            else status.textContent='第 '+world.wave+' 波 · '+(world.marathon?'无尽生存'+(world.portal?' · 传送门已开启':''):world.classic?'经典生存':'已开放 '+world.area+' 区 · '+YardSurvival.zoneName(world.area))+(team.length?' · 队友存活 '+team.filter(p=>p.hp>0).length+'/'+team.length:'');
          }
          if(!inSurvival())status.textContent+=(downed?' · 已阵亡，等待复活':'')+' · 本场 '+creditedXp+' 战斗积分（累计 '+(Number(localStorage.getItem('gwPvpXp.'+(GWAccount.user?.id||'guest')))||0)+'）';
          if(session.mode==='free' && p.hp>0 && p.deaths!==deaths){deaths=p.deaths;equipPack();controls.getObject().position.set(p.x,p.y,p.z);camera.rotation.set(0,p.yaw,0,'YXZ');}
          continue;
        }
        ids.add(p.id);
        let mesh=peers.get(p.id);
        if(!mesh){
          mesh=createOperator(inSurvival()?0x58818a:0xa05248);
          const weapon=new THREE.Group();
          weapon.position.set(.3,.36,-.42);mesh.add(weapon);
          const flash=new THREE.Mesh(new THREE.OctahedronGeometry(.13),new THREE.MeshBasicMaterial({color:0xffcb68}));
          flash.position.z=-.45;flash.visible=false;weapon.add(flash);
          Object.assign(mesh.userData,{peer:p.id,weapon,flash,origin:new THREE.Vector3(),speed:new THREE.Vector3(),destination:new THREE.Vector3(),pitch:0,yaw:0});
          mesh.position.set(p.x,p.y-.89,p.z);scene.add(mesh);peers.set(p.id,mesh);
        }
        mesh.visible=inSurvival() || p.hp>0 || p.deaths>mesh.userData.deaths || mesh.userData.hitUntil>performance.now();
        const pose=mesh.userData;pose.heavyPlates.visible=!!p.heavy;pose.bodyPose={y:p.y,stance:p.stance};pose.alive=p.hp>0;const teams=result.teamMatch||result.bomb;pose.ally=!!teams && p.team===teams.team;if(teams)pose.uniform.color.setHex((result.teamMatch?p.team===0:pose.ally)?0x497fc7:0xc54d48);mesh.children[0].rotation.x=p.pitch||0;pose.tag=p.name+' · '+p.hp+' HP';
        if(!result.survival && (p.hp+p.armor<pose.vitality || p.deaths>pose.deaths)){
          pose.hitUntil=performance.now()+200;
          pose.uniform.emissiveIntensity=mesh.children[0].material.emissiveIntensity=1;
          pose.uniform.emissive.setHex(0xff1414);
          mesh.children[0].material.emissive.setHex(0xff1414);
        }
        pose.vitality=p.hp+p.armor;
        if(p.weapon && (p.weapon!==pose.weaponId || p.look!==pose.look)){
          const source=weaponSource(p.weapon);
          if(source){
            if(pose.gun)pose.weapon.remove(pose.gun);
            pose.gun=new THREE.Group();
            for(const part of source.children){
              if(part===source.userData.flash || part===source.userData.mounts || part===source.userData.charm || part.isLight)continue;
              const copy=part.clone();if(copy.isMesh)copy.material=Smith.base(part);pose.gun.add(copy);
            }
            if(YardSurvival.weapons.some(w=>w.id===p.weapon)||['axe','knife','butterfly','karambit'].includes(p.weapon)||p.weapon.startsWith('sp_'))Smith.apply(pose.gun,p.weapon,p.look||0,true);
            pose.gun.scale.setScalar(1.4);pose.weapon.add(pose.gun);pose.weaponId=p.weapon;pose.look=p.look;
          }
        }
        pose.crosshair=p.crosshair;const stamp=p.poseAt||0,now=performance.now();
        const clockChanged=(result.clockId||'server')!==peerClock;
        const warp=lastRound!==round || (pose.epoch??0)!==(p.positionEpoch??0) || pose.deaths!==p.deaths || !pose.received;
        const destination={x:p.x,y:p.y-(pose.playerModel?(p.stance==='prone'?.4:p.stance==='crouch'?1.1:2)-.9:.89*(p.stance==='prone'?.28:p.stance==='crouch'?.58:1)),z:p.z,yaw:p.yaw||0,pitch:p.pitch||0};
        pose.network??=new GWNet.Buffer();
        if(warp){pose.network.reset(stamp,destination,now);mesh.position.set(destination.x,destination.y,destination.z);}
        else if(clockChanged)pose.network.reset(stamp,destination,now);else pose.network.push(stamp,destination,now);
        pose.destination.set(destination.x,destination.y,destination.z);pose.received=now;pose.stamp=stamp;pose.deaths=p.deaths;pose.epoch=p.positionEpoch;
        pose.yaw=p.yaw;pose.pitch=p.pitch||0;
        pose.targetScale=p.stance==='prone'?.28:p.stance==='crouch'?.58:1;
        pose.aim=!!p.aim;if(!pose.playerModel)pose.weapon.position.x=p.aim?.18:.3;

      }
      for(const [id,mesh] of peers)if(!ids.has(id)){PlayerActors.detach(mesh);scene.remove(mesh);if(mesh.userData.gun)mesh.userData.weapon.remove(mesh.userData.gun);mesh.traverse(part=>{part.geometry?.dispose();part.material?.dispose();});peers.delete(id);}
      peerClock=result.clockId||'server';lastRound=round;cursor=result.cursor;
      for(const event of result.events||[]){
        if(!state.started || event.round!==round)continue;
        remoteSound(event);
        const peer=peers.get(event.by);
        if(peer && event.action==='shot')peer.userData.flashUntil=performance.now()+85;
        if(peer && event.action==='reload')peer.userData.reloadUntil=performance.now()+950;
        if(peer && event.action==='inspect')peer.userData.inspectUntil=performance.now()+2800;
      }
  }
  lobbyRoute('choice');
  let refreshTimer;
  async function refreshRooms(){
    clearTimeout(refreshTimer);const version=catalogVersion;if(route!=='browse')return;
    if(session || state.started || document.body.dataset.screen!=='lobby')return;
    if(location.protocol==='file:'){lobbyStatus.textContent='联机请从游戏服务器打开此页面。';return;}
    try {
      const response=await fetch('./rooms');
      const rooms=(await response.json()).filter(r=>!roomFilter||r.mode===roomFilter);
      if(version!==catalogVersion||route!=='browse')return;
      const key=JSON.stringify(rooms);if(key!==catalogKey){
        catalogKey=key;
        roomsView.replaceChildren(...rooms.map(room=>{
          const row=document.createElement('article'),info=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('small'),join=document.createElement('button');
          title.textContent=room.nickname||room.name;meta.textContent=names[room.mode]+(room.mode==='bomb'?' · '+Dust.get(room.mapId).name:'')+' · '+room.count+'/'+room.limit+' 人 · '+(room.light==='day'?'白天':'黑夜');
          join.disabled=(room.phase!=='waiting' && !(room.allowJoin && ['playing','countdown'].includes(room.phase)))||room.count>=room.limit;
          join.textContent=!join.disabled&&room.phase!=='waiting'?'中途加入':room.phase==='waiting'?(join.disabled?'已满':'加入'):(room.phase==='finished'||room.phase==='abandoned'?'已结束':'游戏中');
          join.onclick=()=>{if(!create.disabled){field.value=room.name;enter('/join');}};
          info.append(title,meta);row.append(info,join);return row;
        }));if(!rooms.length)roomsView.textContent='暂无公开房间';
      }
    } catch { lobbyStatus.textContent='无法获取房间列表'; }
    refreshTimer=setTimeout(refreshRooms,3500);
  }
  refreshRooms();
  SquadUI.connect({post,session:()=>session,browse:id=>{roomFilter=id;showScreen('lobby');lobbyRoute('browse');},mode:id=>{showScreen('lobby');lobbyRoute('host');mode.value=id;mode.onchange();},join:async name=>{showScreen('lobby');lobbyRoute('browse');field.value=name;await enter('/join');}});
  async function enter(path,extra={}){
    if(location.protocol==='file:'){lobbyStatus.textContent='请通过联机服务器打开游戏';return;}
    create.disabled=button.disabled=true;
    try{
      const room=field.value.trim();GWRun.start();
      session=await post(path,{...extra,room,...options(),secret:SquadUI.secret,light:light.value,mode:mode.value,name:document.querySelector('#playerName').value});session.room=room;
      controls.getObject().position.set(session.x,2,session.z);
      lobbyRoute('room');document.querySelector('#homeFromLobby').hidden=true;
      leave.hidden=false;button.classList.add('ready');sync();
    }catch(e){lobbyStatus.textContent=e.message;create.disabled=button.disabled=false;}
  }
  async function startHosted(){
    const canHost=latest.players.every(p=>p.id===session.id || p.bot);
    if(canHost)await loadRules();
    const config=await post('/start',{token:session.token,canHost});
    if(config.local)await activateHost(config);
  }
  let hostBoxes;
  async function loadRules(){
    if(rules)return;
    const [core,bomb,boxes]=await Promise.all([import('./match-rules.mjs?v=network-buffer-v2'),import('./demolition.mjs'),fetch('./classic-collision.json').then(r=>r.json())]);
    hostBoxes=boxes;rules=core.matchRules({yard:YardSurvival,Dust,demolition:bomb,classicBoxes:boxes});
  }
  async function activateHost(config){
    await loadRules();
    const members=new Map(config.players.map(p=>[p.id,p]));
    hosted={clockId:'host:'+session.id,host:session.id,mapId:session.mapId,mode:session.mode,round:0,eventId:0,events:[],members,light:config.light,teamCollision:config.teamCollision,allowJoin:config.allowJoin,nickname:config.nickname};
    if(inSurvival())hosted.survival=['classic','horde','endless'].includes(session.mode)?YardSurvival.createClassic(hostBoxes,session.mode==='horde'):YardSurvival.createSurvival(session.mode==='endless');
    if(session.mode==='endless'){const start=config.endlessStart||{wave:1,maxArea:1};Object.assign(hosted.survival,{marathon:true,wave:start.wave,maxArea:start.maxArea,remaining:YardSurvival.waveCount(start.wave)});}
    if(config.handoff){
      const {world,...match}=config.handoff;Object.assign(hosted,match);
      if(match.bomb)hosted.duelGrid=Dust.get(session.mapId).grid(YardSurvival);
      if(world){
        if(world.classic)YardSurvival.setClassicSector(hosted.survival,world.area);
        else hosted.survival.grid=YardSurvival.makeGrid(world.area);
        Object.assign(hosted.survival,world,{mobs:new Map(world.mobs),drops:new Map(world.drops)});
      }
      document.body.dataset.solo='true';
    }else rules.beginRound(hosted);
    hostClock=Date.now();pulse([]);
  }
  async function pulse(replies){
    if(closing || !hosted)return;
    let delay=1000;
    try{
      const result=await post('/local-pulse',{token:session.token,...hostedScore(),replies});
      hosted.chat=result.chat||[];hosted.members.get(session.id).signals=result.signals||[];
      const ids=new Set(result.members.map(q=>q.id));
      for(const id of hosted.members.keys())if(!ids.has(id))hosted.members.delete(id);
      for(const p of result.members)if(!hosted.members.has(p.id)){rules.admit(hosted,p);hosted.members.set(p.id,p);}
      replies=[];
      for(const job of result.jobs){const p=hosted.members.get(job.player);if(p)replies.push([job.id,rules.sync(hosted,p,job.input)]);}
      const hasGuest=result.members.some(q=>q.id!==session.id && !q.bot);
      if(hasGuest)delay=35;
      if(state.started)document.body.dataset.solo=String(!hasGuest);
    }catch{ /* Local gameplay continues during a network outage. */ }
    if(!closing)pulseTimer=setTimeout(()=>pulse(replies),delay);
  }
  function solo(endless){
    if(session||state.started || create.disabled)return;
    initAudio();
    SquadUI.beginSolo(endless?'endless':'yard');
    localPlayer={id:'solo',name:document.querySelector('#playerName').value.trim()||'队员 1',hp:100,armor:100,armorLevel:1,kills:0,deaths:0,cash:500,ammoPacks:0,x:0,y:2,z:40,lastShot:-1000};
    localRoom={phase:'playing',survival:YardSurvival.createSurvival(endless),members:new Map([['solo',localPlayer]])};
    session={id:'solo',mode:endless?'endless':'yard'};phase='playing';round=1;
    if(endless){localPlayer.x=90;localPlayer.z=35;}
    controls.getObject().position.set(localPlayer.x,2,localPlayer.z);
    applySurvival(YardSurvival.survivalSnapshot(localRoom.survival),localPlayer);
    startGame();
  }
  document.querySelector('#soloYard').onclick=()=>solo(false);
  document.querySelector('#soloEndless').onclick=()=>window.dispatchEvent(new Event('gw-endless-solo'));
  window.addEventListener('gw-practice',()=>{if(session)post('/practice',{token:session.token,practice:true}).catch(()=>{});});
  const matchButton=document.getElementById('matchDuel');
  const matchDialog=document.createElement('dialog');matchDialog.className='blockSheet';
  const matchText=document.createElement('p'),cancelMatch=document.createElement('button');
  cancelMatch.textContent='取消匹配';matchDialog.append(matchText,cancelMatch);document.body.append(matchDialog);
  let matchTicket=null,matchTimer;
  async function cancelMatching(){
    const ticket=matchTicket;matchTicket=null;clearTimeout(matchTimer);matchDialog.close();window.gwActivity='home';
    if(ticket)await post('/matchmake',{ticket,cancel:true}).catch(()=>{});
  }
  cancelMatch.onclick=cancelMatching;matchDialog.oncancel=e=>{e.preventDefault();cancelMatching();};
  matchButton.onclick=async()=>{
    if(session||matchTicket)return;
    initAudio();window.gwActivity='matching';matchTicket=crypto.randomUUID();matchText.textContent='正在寻找 1v1 对手 · 0 秒';matchDialog.showModal();
    const ticket=matchTicket;
    async function pollMatch(){
      try{
        const result=await post('/matchmake',{ticket});
        if(ticket!==matchTicket)return;
        if(result.room){
          matchText.textContent='匹配成功';
          matchTimer=setTimeout(async()=>{
            if(ticket!==matchTicket)return;
            matchTicket=null;matchDialog.close();window.gwActivity='pvp';showScreen('lobby');lobbyRoute('browse');field.value=result.room;
            await enter('/join',{matchTicket:ticket});
          },600);return;
        }
        matchText.textContent='正在寻找 1v1 对手 · '+result.elapsed+' 秒';
        matchTimer=setTimeout(pollMatch,1000);
      }catch(e){matchText.textContent=e.message;cancelMatch.textContent='返回主菜单';}
    }
    pollMatch();
  };
  create.onclick=()=>enter('/create');
  button.onclick=()=>{
    if(!session)return enter('/join');
    if(phase==='countdown')return;
    if(phase==='playing'){
      if(!readySent)post('/ready',{token:session.token}).catch(()=>finish('准备失败，请重新加入'));
      initAudio();startGame();if(latest)consume(latest);return;
    }
    if(latest?.host===session.id){initAudio();button.disabled=true;startHosted().catch(e=>{lobbyStatus.textContent=e.message;button.disabled=false;});return;}
    initAudio();if(readySent)return;
    button.disabled=true;readySent=true;
    post('/ready',{token:session.token}).catch(()=>{readySent=false;button.disabled=false;lobbyStatus.textContent='准备失败，请重试';});
  };
  const spectatorLabel=document.createElement('div');spectatorLabel.id='spectatorLabel';spectatorLabel.hidden=true;document.body.append(spectatorLabel);
  const observerCam=new THREE.PerspectiveCamera(75,1,.02,260);
  const observerHands=new THREE.Group();observerCam.add(observerHands);scene.add(observerCam);observerCam.visible=false;
  const gloveMat=new THREE.MeshStandardMaterial({color:0x424b3c,roughness:.85});
  for(const side of [-1,1]){const hand=new THREE.Mesh(new THREE.SphereGeometry(.065,8,6),gloveMat);hand.scale.set(.7,.8,1.6);hand.position.set(side*.17,-.25,-.43);observerHands.add(hand);}
  let observerWeapon=null,observerKey='';
  function spectatorView(){
    spectatorLabel.hidden=true;observerCam.visible=false;observerCam.userData.hiddenBody=null;
    if(!downed||!latest?.teamMatch||phase!=='playing')return null;
    observerCam.visible=true;const mate=[...peers.values()].find(m=>m.userData.ally&&m.userData.alive);
    if(mate){
      spectatorLabel.hidden=false;spectatorLabel.textContent='观战 '+mate.userData.tag+' · '+Math.ceil((latest.teamMatch.respawnMs||0)/1000)+' 秒后复活';
      observerCam.userData.hiddenBody=mate;GWVisual.draw(document.getElementById('crosshair'),mate.userData.crosshair);observerHands.rotation.x=Math.max(0,(mate.userData.flashUntil||0)-performance.now())/85*.06;
      const id=mate.userData.weaponId||'glock',key=id+':'+mate.userData.look;
      if(key!==observerKey){
        if(observerWeapon)observerHands.remove(observerWeapon);observerWeapon=null;observerKey=key;
        const source=weaponSource(id);
        if(source){observerWeapon=source.clone(true);observerWeapon.visible=true;observerWeapon.traverse(n=>{if(n.isLight)n.visible=false;});
          const bounds=new THREE.Box3().setFromObject(observerWeapon),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
          const scale=.65/Math.max(size.x,size.y,size.z,.01);observerWeapon.scale.multiplyScalar(scale);
          observerWeapon.position.copy(center).multiplyScalar(-scale).add(new THREE.Vector3(.18,-.24,-.5));observerHands.add(observerWeapon);
        }
      }
      observerHands.visible=true;
      observerCam.position.copy(mate.position);observerCam.position.y+=.93*mate.scale.y;observerCam.rotation.set(mate.userData.pitch,mate.rotation.y,0,'YXZ');
      observerCam.translateZ(-.64);}
    else{observerHands.visible=false;spectatorLabel.hidden=false;spectatorLabel.textContent='等待队友复活 · '+Math.ceil((latest.teamMatch.respawnMs||0)/1000)+' 秒';observerCam.position.set(0,25,32);observerCam.lookAt(0,0,0);}
    observerCam.aspect=camera.aspect;observerCam.updateProjectionMatrix();return observerCam;
  }
  return {tick,activeAirView,spectatorView,get teamColor(){return latest?.teamMatch?.team??null;},get radar(){return latest?.support;},supportFire(){
    if(!latest?.support?.air || phase!=='playing')return false;
    if(performance.now()>=nextSupportShot){commandReward('fire');nextSupportShot=performance.now()+(latest.support.air==='gunship'?880:350);}
    return true;
  },get map(){return Dust.get(session?.mapId);},get teamCollision(){return !inSurvival()||latest?.teamCollision!==false;},get peerMeshes(){return peers.values();},get bomb(){return session?.mode==='bomb';},get horde(){return session?.mode==='horde';},get classic(){return ['classic','horde','endless'].includes(session?.mode);},get lighting(){return latest?.light||document.querySelector('#soloLight').value;},leave:leave.onclick,get coop(){return inSurvival();},get downed(){return downed;},get hint(){return hint;},get rescueLabel(){return !downed && rescueCandidate?(autoRescue?'救援中 '+Math.min(100,Math.floor((latest.players.find(p=>p.id===autoRescue)?.progress||0)*40))+'%':'点击救援'):'';},
    tapRescue(){if(!rescueCandidate || downed)return false;autoRescue=rescueCandidate;return true;},
    cancelRescue(){autoRescue=null;},use(value){if(value && !using && phase==="playing")pressed=true;using=value;},airRocket(at){if(!downed&&phase==='playing'&&actions.length<10)actions.push({type:'chopper-rocket',x:at.x,y:at.y,z:at.z});},airHit(id,rocket=false){if(!downed&&phase==='playing'&&hits.length<16)hits.push({id,rocket,weapon:'sp_gatling'});},hitZombie(id,head,melee,gun,heavy=false){if(!downed && phase==="playing" && hits.length<16)hits.push({id,head,melee,heavy,weapon:gun});},action(type,point){if(session && phase==='playing' && actions.length<10)actions.push({type,x:point?.x,y:point?.y,z:point?.z});},buyArmor(){buyArmor=true;},get online(){return !!session && !localRoom && (!hosted || [...hosted.members.values()].some(p=>p.id!==session.id&&!p.bot));},get active(){return !!session;},get playable(){return !session || phase==='playing';},fire(melee=false,heavy=false){
    if(inSurvival() || phase!=='playing')return;
    aimRay.setFromCamera({x:0,y:0},camera);
    const first=aimRay.intersectObjects([...peers.values()].filter(m=>m.visible).flatMap(m=>m.userData.bodyPose?.stance==='prone'&&m.userData.playerModel?[m.userData.playerModel]:[m,m.children[0]]).concat(obstacles.map(o=>o.mesh)),true)[0];
    let owner=first?.object;while(owner&&!owner.userData.peer)owner=owner.parent;const id=owner?.userData.peer;
    if(id && (!melee || first.distance<=3))hit={message:melee?{id,kind:heavy?'heavy':'melee'}:first.object.parent?.userData.peer?{id,kind:'head'}:id,point:first.point.clone()};
  }};
}












