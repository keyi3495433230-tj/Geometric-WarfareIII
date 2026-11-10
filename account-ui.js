const GWAccount=(()=>{
  let user=window.gwAccountBoot||null;
  const dialog=document.getElementById('accountGate'),form=dialog.querySelector('form'),note=dialog.querySelector('output');
  const guestText='目前是以游客模式游玩，无法获得任何奖励以及皮肤，数据随时可能丢失，建议登录后再进行游玩';
  let registering=false,pending=null;
  async function request(path,data={}){
    let r;
    for(let attempt=0;attempt<(path==='me'?2:1);attempt++){
      try{r=await fetch('./auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(6000)});break;}
      catch(error){if(path!=='me'||attempt===1)throw error;}
    }
    const j=await r.json();if(!r.ok)throw Error(j.error||'暂时无法连接');return j;
  }
  const ready=request('me',{deviceKey:localStorage.getItem('gw-device-recovery')}).then(r=>{localStorage.setItem('gw-device-recovery',r.deviceKey);user=r.account;refresh();}).catch(()=>{note.textContent='账号连接暂时不可用，可稍后重试登录';refresh();});GWBoot.track(ready,'账号信息');
  function refresh(){
    const btn=document.getElementById('homeAccount');btn.hidden=true;
    const hudName=document.querySelector('.player-name');if(hudName)hudName.textContent=user?.nick||'游客';
    const nick=document.getElementById('playerName');if(nick){nick.value=user?.nick||'游客';nick.readOnly=true;}
  }
  function paint(warn=false){
    dialog.querySelector('h2').textContent=warn?'游客试玩':registering?'注册账号':'登录账号';
    dialog.querySelector('[data-warning]').textContent=warn?guestText:'';
    form.hidden=warn;dialog.querySelector('[data-switch]').hidden=warn;
    dialog.querySelector('[data-login]').hidden=!warn;
    form.elements.nick.parentElement.hidden=!registering;form.elements.nick.required=registering;
    form.elements.password.autocomplete=registering?'new-password':'current-password';
    form.querySelector('[type=submit]').textContent=registering?'注册并登录':'登录';
    dialog.querySelector('[data-switch]').textContent=registering?'已有账号，去登录':'创建账号';
    dialog.querySelector('[data-guest]').textContent=warn?'仍以游客身份开始':'游客试玩';
    note.textContent='';if(!dialog.open)dialog.showModal();
  }
  form.onsubmit=async e=>{
    e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
    try{await ready;const r=await request(registering?'register':'login',{login:form.elements.login.value,password:form.elements.password.value,nickname:form.elements.nick.value,legacy:registering?localStorage.getItem('gw-profile-key'):undefined});if(r.account){sessionStorage.removeItem('gwGuest');location.reload();}}
    catch(err){note.textContent=err.message;}finally{button.disabled=false;}
  };
  dialog.querySelector('[data-switch]').onclick=()=>{registering=!registering;paint();};
  dialog.querySelector('[data-login]').onclick=()=>{pending=null;registering=false;paint();};
  dialog.querySelector('[data-guest]').onclick=()=>{sessionStorage.gwGuest='1';dialog.close();const fn=pending;pending=null;fn?.();};
  dialog.oncancel=e=>{if(!user&&!sessionStorage.gwGuest)e.preventDefault();else pending=null;};
  async function logout(){
    try{await request('logout');sessionStorage.removeItem('gwGuest');location.reload();}
    catch(err){paint();note.textContent=err.message;}
  }
  document.getElementById('homeAccount').onclick=()=>user?logout():paint();
  let pass=false;
  document.addEventListener('click',e=>{
    const target=e.target.closest?.('#startButton,#soloYard,#soloEndless,#soloHorde,#createArena,#joinArena,#matchDuel,#restartBtn');
    if(!target||pass||user)return;
    e.preventDefault();e.stopImmediatePropagation();
    pending=()=>{pass=true;try{target.click();}finally{pass=false;}};
    paint(true);
  },true);
  refresh();window.addEventListener('gw-ready',()=>{if(!user&&!sessionStorage.gwGuest)paint();},{once:true});
  return {logout,get user(){return user;},open:()=>paint()};
})();
