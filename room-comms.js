function roomComms(post,controls){
  const get=id=>document.getElementById(id),links=new Map(),pending=new Map();
  const panel=get('chatPanel'),open=get('chatOpen'),log=get('chatLog'),mode=get('micMode'),talk=get('talkKey');
  let session,stream,listKey='',active=[],closed=false;
  document.addEventListener('pointerdown',()=>{for(const l of links.values())if(l.audio.paused && l.audio.srcObject)l.audio.play().catch(()=>{});});
  const send=(to,signal)=>post('/signal',{token:session.token,to,signal});
  let held=false,request=0;
  function transmit(on){
    held=on;
    const enabled=!!stream && (mode.value==='free'||(mode.value==='press'&&on));
    if(stream)stream.getAudioTracks()[0].enabled=enabled;
    talk.setAttribute('aria-pressed',String(enabled));
    talk.title=mode.value==='press'?'按住说话':enabled?'关闭麦克风':'开启麦克风';
    talk.setAttribute('aria-label',talk.title);
  }
  function connection(id){
    if(links.has(id))return links.get(id);
    const pc=new RTCPeerConnection({iceServers:session.iceServers||[{urls:'stun:stun.l.google.com:19302'}]});
    const tx=session.id<id?pc.addTransceiver('audio',{direction:'sendrecv'}):null,audio=document.createElement('audio');
    audio.autoplay=true;document.body.append(audio);
    if(stream&&tx)tx.sender.replaceTrack(stream.getAudioTracks()[0]);
    pc.ontrack=e=>{audio.srcObject=new MediaStream([e.track]);audio.play().catch(()=>{});};
    pc.onicecandidate=e=>{if(e.candidate)send(id,{type:'candidate',candidate:e.candidate.toJSON()}).catch(()=>{});};
    const link={pc,tx,audio};links.set(id,link);return link;
  }
  async function receive(s){
    const {pc}=connection(s.from);
    if(s.type==='candidate'){
      if(pc.remoteDescription)await pc.addIceCandidate(s.candidate);
      else {if(!pending.has(s.from))pending.set(s.from,[]);pending.get(s.from).push(s.candidate);}
      return;
    }
    await pc.setRemoteDescription({type:s.type,sdp:s.sdp});
    for(const c of pending.get(s.from)||[])await pc.addIceCandidate(c);
    pending.delete(s.from);
    if(s.type==='offer'){const tx=pc.getTransceivers()[0];links.get(s.from).tx=tx;tx.direction='sendrecv';if(stream)await tx.sender.replaceTrack(stream.getAudioTracks()[0]);await pc.setLocalDescription(await pc.createAnswer());await send(s.from,{type:'answer',sdp:pc.localDescription.sdp});}
  }
  function drop(id){const l=links.get(id);l.pc.close();l.audio.remove();links.delete(id);pending.delete(id);}
  let sequence=Promise.resolve();
  mode.onchange=async()=>{
    const version=++request;
    try{
      if(mode.value==='off'){stream?.getTracks().forEach(t=>t.stop());stream=null;}
      else if(!stream){const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
        if(closed||version!==request||mode.value==='off'){mic.getTracks().forEach(t=>t.stop());return;}stream=mic;}
      transmit(held);await Promise.all([...links.values()].map(l=>l.tx?.sender.replaceTrack(stream?.getAudioTracks()[0]||null)));
      get('micStatus').textContent=mode.value==='press'?'按住 V 或屏幕上的通话键':'';
    }catch{if(version!==request)return;mode.value='off';stream?.getTracks().forEach(t=>t.stop());stream=null;get('micStatus').textContent='请使用 HTTPS 或 localhost，并允许使用麦克风';}
    transmit(held);
  };
  talk.onclick=()=>{if(mode.value==='press')return;mode.value=mode.value==='off'?'free':'off';mode.onchange();};
  talk.onpointerdown=e=>{if(mode.value==='press'){talk.setPointerCapture(e.pointerId);transmit(true);}};
  talk.onpointerup=talk.onpointercancel=talk.onlostpointercapture=()=>transmit(false);
  let pressTimer=null,longPress=false;
  document.addEventListener('keydown',e=>{
    if(GWKeys.code(e)!=='KeyV'||e.repeat||!session||!controls.isLocked)return;
    clearTimeout(pressTimer);longPress=false;pressTimer=setTimeout(()=>{
      longPress=true;mode.value='press';transmit(true);mode.onchange();
    },220);
  });
  document.addEventListener('keyup',e=>{
    if(GWKeys.code(e)!=='KeyV'||pressTimer===null)return;
    clearTimeout(pressTimer);pressTimer=null;
    if(longPress)transmit(false);else{mode.value=mode.value==='free'?'off':'free';mode.onchange();}
  });
  window.addEventListener('blur',()=>{clearTimeout(pressTimer);pressTimer=null;transmit(false);});
  function show(){if(!session)return;controls.unlock();panel.hidden=false;get('chatText').focus();for(const l of links.values())l.audio.play().catch(()=>{});}
  open.onclick=show;document.addEventListener('keydown',e=>{if(GWKeys.code(e)==='Enter'&&controls.isLocked){e.preventDefault();show();}});
  get('chatClose').onclick=()=>{panel.hidden=true;if(document.body.dataset.screen==='game')controls.lock();};
  get('chatForm').onsubmit=async e=>{e.preventDefault();const input=get('chatText');if(!input.value.trim())return;
    try{await post('/chat',{token:session.token,text:input.value});input.value='';}catch{get('micStatus').textContent='消息发送失败';}};
  return {update(room,result){
    session=room;open.hidden=false;talk.hidden=false;
    const key=JSON.stringify(result.chat);if(key!==listKey){listKey=key;log.replaceChildren(...(result.chat||[]).map(m=>{const p=document.createElement('div');p.textContent=m.name+'　'+m.text;return p;}));log.scrollTop=log.scrollHeight;}
    if(typeof RTCPeerConnection==='undefined')return;
    active=result.players.filter(p=>!p.bot).map(p=>p.id).filter(id=>id!==room.id);
    for(const id of links.keys())if(!active.includes(id))drop(id);
    sequence=sequence.then(async()=>{
      if(closed)return;
      for(const id of active)if(room.id<id&&!links.has(id)){const {pc}=connection(id);await pc.setLocalDescription(await pc.createOffer());await send(id,{type:'offer',sdp:pc.localDescription.sdp});}
      for(const s of result.signals||[])if(active.includes(s.from))await receive(s);
    }).catch(()=>{get('micStatus').textContent='语音连接失败，文字聊天仍可使用';});
  },close(){closed=true;stream?.getTracks().forEach(t=>t.stop());for(const id of links.keys())drop(id);}};
}
