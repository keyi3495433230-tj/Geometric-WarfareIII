const Smith=(()=>{
  const key='gw.armory.v1.'+(GWAccount.user?.id||'guest'),catalog=[
    ['beam','激光转换',90],['sight','2.5 倍镜',60],['lamp','战术手电',40],['tube','下挂榴弹',120],['olive','橄榄迷彩',75]
  ];
  let save;try{save=JSON.parse(localStorage.getItem(key));}catch{}
  if(!save || typeof save!=='object')save={};
  let credits=Number.isSafeInteger(save.credits)&&save.credits>=0?save.credits:150;
  const guns=save.guns && typeof save.guns==='object'?save.guns:{};
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify({credits,guns}));}catch{}};
  function config(id){
    if(!guns[id] || typeof guns[id]!=='object')guns[id]={};
    const g=guns[id];if(!Array.isArray(g.owned))g.owned=[];if(!Array.isArray(g.on))g.on=[];
    if(!Number.isInteger(g.heads))g.heads=0;return g;
  }
  function credit(id,head){
    if(!GWAccount.user)return;
    if(!YardSurvival.weapons.some(w=>w.id===id))return;
    const g=config(id);credits+=5;if(head)g.heads=Math.min(200,g.heads+1);persist();
  }
  const has=(id,k)=>!!GWAccount.user&&config(id).on.includes(k);
  const knives={knife:'战斗刀',karambit:'爪刀',butterfly:'蝴蝶刀',axe:'战术手斧'};
  const skinKeys=['olive','gold','red','purple','blue','cloud','aurora','sand','moss','copper','carbon','custom'];
  const extraSkins=[['cloud','云海',40],['aurora','极光',60],['sand','流沙',40],['moss','苔原',40],['copper','赤铜',65],['carbon','碳纤',65]];
  const series={天空:['cloud','aurora','blue'],大地:['olive','sand','moss'],收藏品:['gold','copper','carbon'],特殊:['red','purple'],自定义迷彩:['custom']};
  const charms=['星星','方糖','水晶','弹壳','六面骰'];
  const level=id=>Math.min(30,1+Math.floor(29*Math.min(1,(Math.max(window.gwMastery?.[id]||0,rewards.mastery?.[id]||0)/10000))**.7));
  const named=(id,fallback)=>config(id).nickname||fallback||id;
  const customMaterials=new Map();
  function customSkin(id){const image=config(id).image;if(!image)return null;const cached=customMaterials.get(id);if(cached?.image===image)return cached.material;
    const texture=new THREE.TextureLoader().load(image,()=>document.dispatchEvent(new Event('gw-custom-ready')));texture.encoding=THREE.sRGBEncoding;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    const material=new THREE.MeshStandardMaterial({map:texture,roughness:.65});cached?.material.map?.dispose();cached?.material.dispose();customMaterials.set(id,{image,material});return material;}
  function uv(mesh){if(mesh.geometry.attributes.uv)return;const pos=mesh.geometry.attributes.position;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox,size=box.getSize(new THREE.Vector3()),values=[];for(let i=0;i<pos.count;i++)values.push((pos.getZ(i)-box.min.z)/(size.z||1),(pos.getY(i)-box.min.y)/(size.y||1));mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(values,2));}

  let rewards={zombies:0,dogs:0,tickets:0,red:[]},busy=false;
  async function rewardRequest(action,gun){
    const res=await fetch('./social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:SquadUI.secret,action,gun})});
    const data=await res.json();if(!res.ok)throw Error(data.error||'战绩服务暂不可用');rewards=data;
  }
  const bakedPreview=new WeakMap();
  function previewModel(source){
      source.updateWorldMatrix(true,true);
      const inv=new THREE.Matrix4().copy(source.matrixWorld).invert(),group=new THREE.Group();
      function visit(parent){for(const part of parent.children){
        if(!part.visible||part===source.userData.charm)continue;
        if(part.isSkinnedMesh){let geo=bakedPreview.get(part);if(!geo){part.skeleton.update();geo=part.geometry.clone();const v=new THREE.Vector3(),pos=geo.attributes.position;for(let i=0;i<pos.count;i++){v.fromBufferAttribute(part.geometry.attributes.position,i);part.boneTransform(i,v);pos.setXYZ(i,v.x,v.y,v.z);}geo.computeVertexNormals();bakedPreview.set(part,geo);}const copy=new THREE.Mesh(geo,part.material);copy.matrix.multiplyMatrices(inv,part.matrixWorld);copy.matrixAutoUpdate=false;group.add(copy);}else if(part.isInstancedMesh){for(let i=0;i<part.count;i++){const copy=new THREE.Mesh(part.geometry,part.material),instance=new THREE.Matrix4();part.getMatrixAt(i,instance);copy.matrix.multiplyMatrices(inv,part.matrixWorld).multiply(instance);copy.matrixAutoUpdate=false;group.add(copy);}}else if(part.isMesh){const copy=new THREE.Mesh(part.geometry,part.material);copy.matrix.multiplyMatrices(inv,part.matrixWorld);copy.matrixAutoUpdate=false;group.add(copy);}
        visit(part);
      }}
      visit(source);if(!group.children.length)return null;
      const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());
      group.position.copy(bounds.getCenter(new THREE.Vector3())).multiplyScalar(-1);
      const display=new THREE.Group();if(source.userData.charm){const charm=source.userData.charm.clone(true);charm.userData={};group.add(charm);display.userData.charm=charm;}display.add(group);display.scale.setScalar(Math.min(4.6/Math.max(.01,size.z,size.x),1.55/Math.max(.01,size.y)));
      return display;
  }
  function framePreview(cam,model,aspect){
    cam.updateMatrixWorld(true);model.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model),v=new THREE.Vector3();
    let w=.001,h=.001;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      v.set(x,y,z).applyMatrix4(cam.matrixWorldInverse);w=Math.max(w,Math.abs(v.x));h=Math.max(h,Math.abs(v.y));
    }
    const half=1.13*Math.max(h,w/aspect);
    cam.left=-half*aspect;cam.right=half*aspect;cam.top=half;cam.bottom=-half;cam.updateProjectionMatrix();
  }
  let packRenderer;
  function packPreview(canvas,source,options={}){
    if(!source||!canvas.isConnected)return;
    const model=previewModel(source);if(!model)return;
    if(!packRenderer)try{packRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{return;}
    const width=Math.max(32,Math.round(canvas.clientWidth)),height=Math.max(28,Math.round(canvas.clientHeight)),ratio=Math.min(devicePixelRatio,1.5);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    const stage=new THREE.Scene(),cam=new THREE.OrthographicCamera(-width/height,width/height,1,-1,.01,50);
    if(options.front)cam.position.set(0,.2,-4);else cam.position.set(4,1,.7);cam.lookAt(0,0,0);
    const light=new THREE.DirectionalLight(0xffffff,1.7);light.position.set(3,6,2);
    stage.add(model,new THREE.HemisphereLight(0xfff6df,0x8996a1,1.6),light);
    function draw(){
      framePreview(cam,model,width/height);packRenderer.setSize(canvas.width,canvas.height,false);packRenderer.render(stage,cam);
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(packRenderer.domElement,0,0);
    }
    let last=null;canvas.onpointerdown=e=>{last=e.clientX;canvas.setPointerCapture(e.pointerId);};
    canvas.onpointermove=e=>{if(last!==null){model.rotation.y+=(e.clientX-last)*.015;last=e.clientX;draw();}};
    canvas.onpointerup=canvas.onpointercancel=()=>{last=null;};draw();
  }
  function closePackPreview(){if(packRenderer){packRenderer.dispose();packRenderer.forceContextLoss();packRenderer=null;}}
  function setup(refresh,icon,weapon,specials=[]){
    const d=document.getElementById('smith'),sel=d.querySelector('select');
    YardSurvival.weapons.forEach(w=>sel.add(new Option(w.name,w.id)));
    for(const w of specials)sel.add(new Option(w.name,w.id));
    for(const [id,name] of Object.entries(knives))sel.add(new Option(name,id));
    const preview=d.querySelector('.smithPreview');
    let renderer,display,angle=0,drag=null,previewSource,tilt=0,roll=0,dragY=0,pinchAngle=0,displayKey='',assetRevision=0,paintQueued=false,charmRAF=0,charmUntil=0,lastCharmFrame=0;
    const previewScene=new THREE.Scene(),previewCam=new THREE.OrthographicCamera(-1,1,1,-1,.01,50);
    previewCam.position.set(4,1,.7);previewCam.lookAt(0,0,0);previewScene.add(new THREE.HemisphereLight(0xfff6df,0x8996a1,1.6));
    const previewLight=new THREE.DirectionalLight(0xffffff,1.7);previewLight.position.set(3,6,2);previewScene.add(previewLight);
    function kickPreviewCharm(){if(!display?.userData.charm)return;charmUntil=performance.now()+1800;if(charmRAF)return;lastCharmFrame=performance.now();
      const loop=now=>{if(!d.open||!display?.userData.charm||now>charmUntil){charmRAF=0;return;}if(now-lastCharmFrame>=30){tickCharm(display,(now-lastCharmFrame)/1000);lastCharmFrame=now;paint();}charmRAF=requestAnimationFrame(loop);};charmRAF=requestAnimationFrame(loop);}
    function schedulePaint(){if(paintQueued)return;paintQueued=true;requestAnimationFrame(()=>{paintQueued=false;paint();});}
    const links=document.createElementNS('http://www.w3.org/2000/svg','svg');links.classList.add('attachmentLinks');d.querySelector('.gunStage').append(links);
    function updateAnchors(){if(!display||!previewCamera||tab!=='parts')return;links.replaceChildren();const area=d.querySelector('.gunStage').getBoundingClientRect(),pr=preview.getBoundingClientRect();links.setAttribute('viewBox','0 0 '+area.width+' '+area.height);
      const sourceInverse=new THREE.Matrix4().copy(previewSource.matrixWorld).invert();
      for(const btn of d.querySelectorAll('section [data-part]')){if(!has(sel.value,btn.dataset.part))continue;const mount=previewSource.userData.mounts?.children.find(p=>p.name===btn.dataset.part);if(!mount||!display.children[0])continue;const point=new THREE.Vector3();mount.getWorldPosition(point);point.applyMatrix4(sourceInverse);point.applyMatrix4(display.children[0].matrixWorld);point.project(previewCamera);const x=pr.left-area.left+(point.x+1)*pr.width/2,y=pr.top-area.top+(1-point.y)*pr.height/2,r=btn.getBoundingClientRect(),line=document.createElementNS(links.namespaceURI,'path');line.setAttribute('d','M'+(r.left+r.width/2-area.left)+' '+(r.top+r.height/2-area.top)+' L'+x+' '+y);links.append(line);}}

    function paint(){
      if(!renderer||!display||!d.open)return;
      const width=Math.max(1,preview.clientWidth),height=Math.max(1,preview.clientHeight);
      renderer.setSize(width,height,false);
      const camera=previewCam;display.rotation.set(tilt,angle,roll);
      if(display.parent!==previewScene)previewScene.add(display);
      framePreview(camera,display,width/height);camera.zoom=zoom;camera.updateProjectionMatrix();previewCamera=camera;
      renderer.render(previewScene,camera);updateAnchors();
    }
    function showWeapon(id){
      const source=weapon(id);if(!source)return;Smith.apply(source,id);previewSource=source;
      if(!renderer){try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));}catch{return;}}
      const key=id+':'+tab+':'+selectedSkin+':'+look(id)+':'+(config(id).charm||0)+':'+assetRevision+':'+(selectedSkin==='custom'?config(id).image:'');
      if(key!==displayKey||!display){if(display?.parent)display.parent.remove(display);display=previewModel(source);displayKey=key;}
      if(!display)return;
      if(tab==='skins'&&selectedSkin){const mat=selectedSkin==='custom'?customSkin(id):coating(selectedSkin);if(mat)display.traverse(n=>{if(n.isMesh&&n.parent!==display.userData.charm){uv(n);n.material=mat;}});}
      if(renderer.domElement.parentNode!==preview)preview.replaceChildren(renderer.domElement);schedulePaint();kickPreviewCharm();
    }
    preview.onpointerdown=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag=e.clientX;dragY=e.clientY;preview.setPointerCapture(e.pointerId);if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);pinchAngle=Math.atan2(b.y-a.y,b.x-a.x);}};
    preview.onpointermove=e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],gap=Math.hypot(a.x-b.x,a.y-b.y);zoom=Math.max(.6,Math.min(2.5,zoom*gap/Math.max(1,pinch)));const turn=Math.atan2(b.y-a.y,b.x-a.x);roll+=Math.atan2(Math.sin(turn-pinchAngle),Math.cos(turn-pinchAngle));pinchAngle=turn;pinch=gap;}else if(e.shiftKey||(e.buttons&2))roll+=(e.clientX-drag)*.012;else{angle-=(e.clientX-drag)*.012;tilt-=(e.clientY-dragY)*.012;}drag=e.clientX;dragY=e.clientY;schedulePaint();kickPreviewCharm();};preview.onwheel=e=>{e.preventDefault();zoom=Math.max(.6,Math.min(2.5,zoom*Math.exp(-e.deltaY*.001)));schedulePaint();};
    preview.onpointerup=preview.onpointercancel=e=>{pointers.delete(e.pointerId);drag=pointers.size?[...pointers.values()][0].x:null;dragY=pointers.size?[...pointers.values()][0].y:0;};
    preview.oncontextmenu=e=>e.preventDefault();window.addEventListener('resize',schedulePaint);document.addEventListener('gw-attachment-ready',()=>{assetRevision++;if(d.open)showWeapon(sel.value);});document.addEventListener('gw-custom-ready',schedulePaint);
    d.addEventListener('close',()=>{cancelAnimationFrame(charmRAF);charmRAF=0;renderer?.dispose();renderer?.forceContextLoss();renderer=null;if(display?.parent)display.parent.remove(display);display=null;displayKey='';drag=null;pointers.clear();});
    let tab="parts",selectedSkin='',skinSeries='天空',zoom=1,pointers=new Map(),pinch=0;let renderSerial=0,previewCamera;
    const rename=document.createElement('input');rename.maxLength=24;rename.placeholder='本机武器名称';rename.setAttribute('aria-label','武器自定义名称');d.querySelector('footer').append(rename);rename.onchange=()=>{config(sel.value).nickname=rename.value.trim();persist();};
    const stats=document.createElement('aside');stats.className='smithStats';d.append(stats);
    const skinTypes=document.createElement('aside');skinTypes.className='skinTypes';d.append(skinTypes);
    const equip=document.createElement('button');equip.className='smithEquip';equip.textContent='装备';d.querySelector('footer').append(equip);
    const hint=document.createElement('small');hint.className='smithDragHint';hint.textContent='拖动翻转 · 滚轮缩放 · Shift 拖动滚转';d.querySelector('.gunStage').append(hint);const resetView=document.createElement('button');resetView.className='resetGunView';resetView.textContent='重置视角';resetView.onclick=()=>{angle=tilt=roll=0;zoom=1;schedulePaint();kickPreviewCharm();};d.querySelector('.gunStage').append(resetView);
    for(const btn of d.querySelectorAll("[data-tab]"))btn.onclick=()=>{tab=btn.dataset.tab;render();};
    function render(){
      const id=sel.value,g=config(id),serial=++renderSerial,list=d.querySelector('section');rename.value=g.nickname||'';list.replaceChildren();skinTypes.replaceChildren();stats.replaceChildren();equip.hidden=true;
      const skinsOnly=knives[id]||id.startsWith('sp_');if(skinsOnly)tab='skins';
      d.dataset.tab=tab;preview.innerHTML=knives[id]?'':icon(id);showWeapon(id);
      
      const def=YardSurvival.weapons.find(w=>w.id===id)||specials.find(w=>w.id===id);stats.hidden=tab==='skins';
      if(def){const title=document.createElement('h3');title.textContent=sel.selectedOptions[0].textContent;stats.append(title);
        for(const [label,value,max] of [['身体伤害',def.dmgBody,200],['爆头伤害',def.dmgHead,500],['弹匣容量',def.magSize||def.mag,150],['每秒射击',def.cooldown?Math.round(1/def.cooldown*10)/10:null,20]])if(Number.isFinite(value)){const row=document.createElement('label'),bar=document.createElement('progress');bar.max=max;bar.value=value;row.textContent=label+'　'+value;row.append(bar);stats.append(row);}}

      d.querySelector('.gunStage>strong').textContent=named(id,sel.selectedOptions[0].textContent)+' · LV.'+level(id)+' / 30';
      d.querySelector('.gunStage output').textContent='熟练度 '+Math.max(window.gwMastery?.[id]||0,rewards.mastery?.[id]||0)+' · 军械币 '+credits+'　·　已装配 '+g.on.filter(k=>!skinKeys.includes(k)).length+'/4';
      d.querySelector('p').textContent='武器等级 '+level(id)+' / 30 · 达到 30 级解锁黄金迷彩（原爆头奖励仍有效）';
      d.querySelector('progress').max=30;d.querySelector('progress').value=level(id);
      for(const btn of d.querySelectorAll('[data-tab]'))btn.setAttribute('aria-pressed',btn.dataset.tab===tab);
      if(knives[id])d.querySelector('.gunStage output').textContent='军械币 '+credits;
      d.querySelector('[data-tab="parts"]').disabled=!!skinsOnly;
      d.querySelector('progress').hidden=!!knives[id]||tab==='skins';
      if(tab==='skins')d.querySelector('p').textContent='通关自选涂装：'+rewards.tickets+' 次　·　紫色 '+Math.min(500,rewards.zombies)+'/500 僵尸　·　蓝色 '+Math.min(300,rewards.dogs)+'/300 僵尸狗';
      for(const [k,name,price] of [...catalog,...extraSkins,['gold','黄金迷彩',0],['red','猩红涂装',0],['purple','紫晶迷彩',0],['blue','冰蓝迷彩',0]]){
        if(tab==='skins'&&!series[skinSeries].includes(k))continue;
        if((tab==='skins')!==skinKeys.includes(k) || (knives[id]&&(k==='red'||k==='gold')))continue;
        const earned=k==='red'?rewards.red.includes(id):k==='purple'?rewards.zombies>=500:k==='blue'?rewards.dogs>=300:k==='gold'?(g.heads>=200||level(id)>=30):g.owned.includes(k);
        const canClaim=k==='red'&&!earned&&rewards.tickets>0;
        const on=g.on.includes(k),btn=document.createElement('button');btn.textContent=name;
        const status=document.createElement('small');status.textContent=on?'已装备':earned?'装备':canClaim?'用 1 次通关奖励兑换':k==='red'?'僵尸模式通关':k==='purple'?'累计击杀 500 只僵尸':k==='blue'?'累计击杀 300 只僵尸狗':k==='gold'?'武器 30 级':price+' 币';
        btn.dataset.part=k;btn.title=name+' · '+status.textContent;btn.append(status);btn.setAttribute('aria-pressed',on);btn.disabled=!GWAccount.user||busy||!earned&&!canClaim&&(!price||credits<price);
        btn.onclick=async()=>{
          if(canClaim){
            busy=true;render();
            try{await rewardRequest('redeem-red',id);}catch(e){busy=false;render();d.querySelector('p').textContent=e.message;return;}
            busy=false;
          }else if(!earned){if(!price||credits<price)return;credits-=price;g.owned.push(k);}
          g.on=g.on.filter(x=>x!==k && !(skinKeys.includes(k)&&skinKeys.includes(x)));
          if(!on)g.on.push(k);persist();refresh(id);render();
        };
        if(tab==='skins'){
          const activate=btn.onclick,locked=btn.disabled;btn.disabled=false;
          btn.dataset.skin=k;btn.setAttribute('aria-pressed',selectedSkin===k);btn.onclick=()=>{selectedSkin=k;render();};
          
          if(selectedSkin===k){equip.hidden=false;equip.disabled=locked;equip.textContent=status.textContent==='装备'?'装备':status.textContent;equip.onclick=activate;}
        }list.append(btn);
      }
      if(tab==='skins'){
        for(const name of Object.keys(series)){const b=document.createElement('button');b.textContent=name;b.setAttribute('aria-pressed',skinSeries===name);b.onclick=()=>{skinSeries=name;selectedSkin='';render();};skinTypes.append(b);}
        if(skinSeries==='自定义迷彩'){
          const label=document.createElement('label'),file=document.createElement('input'),desc=document.createElement('p');file.type='file';file.accept='image/png,image/jpeg,image/webp';label.textContent='导入本地图片';label.append(file);desc.textContent='图片仅保存在此设备，不会上传服务器。多人模式其他玩家看到默认皮肤。';list.append(label,desc);
          file.onchange=async()=>{const f=file.files[0];if(!f||f.size>12*1024*1024){desc.textContent='请选择小于 12 MB 的图片';return;}
            try{const img=await createImageBitmap(f),canvas=document.createElement('canvas');canvas.width=canvas.height=512;canvas.getContext('2d').drawImage(img,0,0,512,512);img.close();const image=canvas.toDataURL('image/jpeg',.8);const old=g.image;g.image=image;try{localStorage.setItem(key,JSON.stringify({credits,guns}));}catch{g.image=old;throw Error('本地空间不足');}if(serial!==renderSerial)return;selectedSkin='custom';render();}catch(e){desc.textContent=e.message||'图片无法读取';}};
          if(g.image){const remove=document.createElement('button');remove.textContent='删除本地图案';remove.onclick=()=>{delete g.image;g.on=g.on.filter(k=>k!=='custom');selectedSkin='';const cached=customMaterials.get(id);cached?.material.map?.dispose();cached?.material.dispose();customMaterials.delete(id);delete weapon(id).userData.smithSignature;persist();refresh(id);render();};list.append(remove);selectedSkin='custom';equip.hidden=false;equip.disabled=!GWAccount.user;equip.textContent=g.on.includes('custom')?'卸下自定义迷彩':'装备自定义迷彩';equip.onclick=()=>{g.on=g.on.includes('custom')?g.on.filter(k=>k!=='custom'):[...g.on.filter(k=>!skinKeys.includes(k)),'custom'];delete weapon(id).userData.smithSignature;persist();refresh(id);render();};}
        }
      }else{
        const l=document.createElement('label'),pick=document.createElement('select');l.className='charmPicker';l.textContent='武器挂件 ';pick.add(new Option('无挂件',''));charms.forEach((n,i)=>pick.add(new Option(n,String(i+1))));pick.value=String(g.charm||'');pick.onchange=()=>{g.charm=Number(pick.value)||0;persist();delete weapon(id).userData.smithSignature;refresh(id);render();};const removeCharm=document.createElement('button');removeCharm.type='button';removeCharm.textContent='卸下挂件';removeCharm.disabled=!g.charm;removeCharm.onclick=()=>{g.charm=0;persist();delete weapon(id).userData.smithSignature;refresh(id);render();};l.append(pick,removeCharm);stats.append(l);
      }
      requestAnimationFrame(updateAnchors);
    }
    sel.onchange=()=>{selectedSkin='';render();};document.getElementById('openSmith').onclick=()=>{angle=tilt=roll=0;zoom=1;d.showModal();render();if(GWAccount.user)rewardRequest('skins').then(()=>{if(d.open)render();}).catch(()=>{if(d.open)d.querySelector('p').textContent='暂时无法读取挑战进度';});};
    d.querySelector('header button').onclick=()=>d.close();
  }
  const materials=new Map(),original=new WeakMap();
  function coating(k){
    if(materials.has(k))return materials.get(k);
    const gold=k==='gold',c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
    const themes={cloud:['#b6d9eb','#738fbd','#eef6ff'],aurora:['#42b8ab','#272451','#a9e9b4'],sand:['#bca57b','#766342','#e0cda1'],moss:['#557658','#243c30','#93a57a'],copper:['#a66c40','#503728','#dbb270'],carbon:['#343a40','#14191e','#6a7580'],red:['#9d2028','#641219','#db4543'],purple:['#7342ad','#452565','#b58be7'],blue:['#2376b1','#164568','#73c3eb']};
    const colors=themes[k]||(gold?['#e4ae37','#b57d23','#ffe194']:['#47583a','#374331','#65724e']);
    ctx.fillStyle=colors[0];ctx.fillRect(0,0,128,128);
    for(let n=-128;n<256;n+=19){ctx.fillStyle=colors[Math.abs(n)%2+1];ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n+9,0);ctx.lineTo(n+95,128);ctx.lineTo(n+74,128);ctx.fill();}
    const tex=new THREE.CanvasTexture(c);const m=new THREE.MeshStandardMaterial({map:tex,metalness:gold?.55:.1,roughness:gold?.34:.82});materials.set(k,m);return m;
  }
  const flags=['beam','sight','lamp','tube','olive','gold','red','purple','blue','cloud','aurora','sand','moss','copper','carbon'];
  function look(id){return GWAccount.user&&id?flags.reduce((bits,k,i)=>has(id,k) && (k!=='gold'||config(id).heads>=200||level(id)>=30)?bits|(1<<i):bits,0):0;}
  const attachmentFiles={sight:['scope-large-a',.14],tube:['silencer-larger',.22],lamp:['silencer-small',.11],beam:['scope-small',.09]};
  const attachmentCache=new Map();
  function loadAttachment(part){
    if(part.userData.loading)return;
    part.userData.loading=true;
    const [file,length]=attachmentFiles[part.name];
    if(!attachmentCache.has(file))attachmentCache.set(file,new Promise((resolve,reject)=>new THREE.GLTFLoader().load('./models/attachments/'+file+'.glb',g=>resolve(g.scene),undefined,reject)));
    attachmentCache.get(file).then(template=>{
      const model=template.clone(),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
      if(size.x>size.z)model.rotation.y=Math.PI/2;
      const aligned=new THREE.Box3().setFromObject(model),extent=aligned.getSize(new THREE.Vector3()),scale=length/Math.max(.001,extent.x,extent.y,extent.z);
      model.scale.setScalar(scale);model.position.copy(aligned.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
      part.rotation.set(0,0,0);part.material.visible=false;part.add(model);
      document.dispatchEvent(new Event('gw-attachment-ready'));
    }).catch(()=>{part.userData.loading=false;attachmentCache.delete(file);});
  }
  function apply(group,id,mask=look(id),remote=false){
    const signature=id+':'+mask+':'+group.children.length+':'+(!remote?config(id).charm+':'+(has(id,'custom')?config(id).image:''):'');if(group.userData.smithSignature===signature)return;group.userData.smithSignature=signature;delete group.userData.camoTier;
    const enabled=k=>(mask & (1<<flags.indexOf(k)))!==0;
    const skin=!remote&&has(id,'custom')&&config(id).image?'custom':skinKeys.find(k=>enabled(k));
    const meshes=[];
    for(const part of group.children)if(part!==group.userData.flash && part!==group.userData.mounts && part!==group.userData.charm && !part.isLight)part.traverse(n=>{if(n.isMesh)meshes.push(n);});
    for(const mesh of meshes){
      if(!original.has(mesh))original.set(mesh,mesh.material);
      if(skin && !mesh.geometry.attributes.uv){
        const pos=mesh.geometry.attributes.position;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox,size=box.getSize(new THREE.Vector3()),uv=[];
        for(let i=0;i<pos.count;i++)uv.push((pos.getZ(i)-box.min.z)/(size.z||1),(pos.getY(i)-box.min.y)/(size.y||1));
        mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      }
      mesh.material=skin?(skin==='custom'?customSkin(id):coating(skin)):original.get(mesh);
    }
    if(!remote){const charm=config(id).charm||0;if(group.userData.charmId!==charm){
      if(group.userData.charm){group.remove(group.userData.charm);group.userData.charm.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});delete group.userData.charm;}group.userData.charmId=charm;
      if(charm){const rig=new THREE.Group();rig.name='weaponCharm';const bounds=new THREE.Box3(),inverse=new THREE.Matrix4();group.updateWorldMatrix(true,true);inverse.copy(group.matrixWorld).invert();for(const part of group.children)if(part!==group.userData.flash&&part!==group.userData.mounts&&!part.isLight)part.traverse(m=>{if(m.isMesh){m.geometry.computeBoundingBox();bounds.union(m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,m.matrixWorld)));}});rig.position.set(Number.isFinite(bounds.min.x)?bounds.min.x+.001:-.075,Math.max(bounds.min.y+.015,Math.min(bounds.max.y-.015,.005)),Math.max(bounds.min.z+.02,Math.min(bounds.max.z-.02,.04)));
        const geo=[null,new THREE.OctahedronGeometry(.026),new THREE.BoxGeometry(.038,.038,.038),new THREE.ConeGeometry(.024,.065,5),new THREE.CylinderGeometry(.012,.012,.055,8),new THREE.IcosahedronGeometry(.026,0)][charm];
        const bob=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:[0,0xf5c65b,0xf3b8cc,0x78cde3,0xb49b65,0xc6d0da][charm],metalness:.35,roughness:.45}));bob.position.y=-.105;
        const cord=new THREE.Mesh(new THREE.CylinderGeometry(.002,.002,.08,5),new THREE.MeshStandardMaterial({color:0x575149,roughness:.9}));cord.position.y=-.04;cord.name='charmCord';rig.add(cord,bob);group.add(rig);group.userData.charm=rig;
      }
    }}
    if(knives[id]||id.startsWith('sp_'))return;
    let rig=group.userData.mounts;
    if(!rig){
      rig=new THREE.Group();group.userData.mounts=rig;group.add(rig);
      const barrel=(name,x,y,z,r,length,color)=>{
        const part=new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,10),new THREE.MeshStandardMaterial({color}));part.name=name;part.rotation.x=Math.PI/2;part.position.set(x,y,z);rig.add(part);
      };
      barrel('sight',0,.077,-.13,.033,.13,0x343d41);barrel('tube',0,-.055,-.22,.037,.21,0x48513f);
      barrel('lamp',.052,.008,-.21,.022,.09,0x45474a);barrel('beam',-.044,.009,-.2,.018,.08,0x8b4547);
      const light=new THREE.SpotLight(0xffe6bc,2.6,34,.36,.52,1);light.name='lamp';light.position.set(.052,.008,-.24);
      light.target.position.set(0,.03,-14);rig.add(light,light.target);
    }
    for(const part of rig.children)if(part.name){part.visible=enabled(part.name) && !(remote && part.isLight);if(part.visible && part.isMesh && attachmentFiles[part.name])loadAttachment(part);}
  }
  function tickCharm(group,dt){const rig=group?.userData.charm;if(!rig||dt<=0)return;dt=Math.min(.04,dt);
    const data=rig.userData.physics??={position:new THREE.Vector3(),velocity:new THREE.Vector3(),quaternion:new THREE.Quaternion(),gravity:new THREE.Vector3(),next:new THREE.Vector3(),euler:new THREE.Euler(0,0,0,'YXZ'),x:0,z:0,vx:0,vz:0,yaw:0,ready:false};
    group.getWorldPosition(data.next);group.getWorldQuaternion(data.quaternion);data.euler.setFromQuaternion(data.quaternion,'YXZ');
    const yaw=data.euler.y,turn=data.ready?Math.atan2(Math.sin(yaw-data.yaw),Math.cos(yaw-data.yaw))/dt:0;
    data.gravity.set(0,-1,0).applyQuaternion(data.quaternion.invert());
    const ax=data.ready?Math.max(-25,Math.min(25,((data.next.x-data.position.x)/dt-data.velocity.x)/dt)):0;
    const az=data.ready?Math.max(-25,Math.min(25,((data.next.z-data.position.z)/dt-data.velocity.z)/dt)):0;
    data.velocity.copy(data.next).sub(data.position).divideScalar(dt);data.position.copy(data.next);data.yaw=yaw;data.ready=true;
    const tx=Math.max(-1.2,Math.min(1.2,Math.atan2(-data.gravity.z,-data.gravity.y)+az*.012)),tz=Math.max(-1.2,Math.min(1.2,Math.atan2(data.gravity.x,-data.gravity.y)+ax*.012-turn*.04));
    for(let i=0;i<2;i++){const h=dt/2;data.vx+=((tx-data.x)*35-data.vx*6.5)*h;data.vz+=((tz-data.z)*35-data.vz*6.5)*h;data.x+=data.vx*h;data.z+=data.vz*h;}rig.rotation.set(data.x,0,data.z);
  }
  return {tickCharm,level,named,previewModel,packPreview,closePackPreview,credit,has,setup,apply,look,base:mesh=>original.get(mesh)||mesh.material};
})();
