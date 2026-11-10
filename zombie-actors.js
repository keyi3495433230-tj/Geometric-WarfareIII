// One shared mesh and texture. Each visible actor has independent bone transforms.
const ZombieActors=(()=>{
  let template,loading;
  const skipped=new Set();
  const bodies=new Map(),step=1/30,settleSteps=60;
  let wave=null;
  const staticMaterials=new WeakMap();
  function freezeCorpse(c){
    const skin=c.rig?.mesh;if(!skin)return;
    c.root.updateMatrixWorld(true);skin.skeleton.update();
    const geometry=skin.geometry.clone(),position=geometry.attributes.position,point=new THREE.Vector3();
    for(let i=0;i<position.count;i++){
      point.fromBufferAttribute(position,i);skin.boneTransform(i,point);position.setXYZ(i,point.x,point.y,point.z);
    }
    geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    function material(source){
      if(!staticMaterials.has(source)){const copy=source.clone();copy.skinning=false;staticMaterials.set(source,copy);}
      return staticMaterials.get(source);
    }
    const mesh=new THREE.Mesh(geometry,Array.isArray(skin.material)?skin.material.map(material):material(skin.material));
    mesh.position.copy(skin.position);mesh.quaternion.copy(skin.quaternion);mesh.scale.copy(skin.scale);
    mesh.castShadow=true;c.root.remove(skin);c.root.add(mesh);skin.skeleton.dispose();
    c.staticMesh=mesh;c.rig=null;c.points=c.previous=c.rest=c.links=c.q=null;
    c.root.updateMatrixWorld(true);c.root.traverse(n=>{n.matrixAutoUpdate=false;});
  }
  const asset=new URL('models/zombie.glb',document.currentScript.src).href;
  const eyeGeo=new THREE.SphereGeometry(.0055,8,6),eyeMat=new THREE.MeshBasicMaterial({color:0xff2414});
  const outline={enabled:localStorage.gwOutline==='on',width:Math.max(1,Math.min(6,Number(localStorage.gwOutlineWidth)||2)),
    color:/^#[0-9a-f]{6}$/i.test(localStorage.gwOutlineColor)?localStorage.gwOutlineColor:'#f09645'};
  const outlineMat=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,transparent:true,skinning:true,
    uniforms:{ink:{value:new THREE.Color(outline.color)},pixel:{value:new THREE.Vector2()}},
    vertexShader:`
      #include <common>
      #include <skinning_pars_vertex>
      uniform vec2 pixel;
      void main(){
        #include <skinbase_vertex>
        #include <beginnormal_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vec2 n=(normalMatrix*objectNormal).xy;
        gl_Position.xy+=n/max(length(n),0.001)*pixel*gl_Position.w;
      }`,
    fragmentShader:'uniform vec3 ink;void main(){gl_FragColor=vec4(ink,1.);}'
  });
  function outlineActor(e){
    if(!outline.enabled){if(e.outline)e.outline.visible=false;return;}
    const skin=e.hound?.skin||e.rig?.mesh;if(!skin)return;
    if(!e.outline){
      const shell=new THREE.SkinnedMesh(skin.geometry,outlineMat);
      shell.bind(skin.skeleton,skin.bindMatrix);shell.frustumCulled=false;
      shell.raycast=()=>{};skin.add(shell);e.outline=shell;
    }
    e.outline.visible=true;
    outlineMat.uniforms.pixel.value.set(2*outline.width/Math.max(1,innerWidth),2*outline.width/Math.max(1,innerHeight));
  }
  function outlineSettings(panel){
    const group=document.createElement('div');group.className='outlineSettings';panel.append(group);
    function field(text,type){
      const label=document.createElement('label'),input=document.createElement('input');
      label.append(text+' ',input);input.type=type;group.append(label);return input;
    }
    const enable=field('僵尸描边','checkbox'),width=field('描边粗细','range'),color=field('描边颜色','color');
    enable.checked=outline.enabled;width.min=1;width.max=6;width.step=1;width.value=outline.width;color.value=outline.color;
    function show(){width.parentElement.hidden=color.parentElement.hidden=!enable.checked;}
    enable.onchange=()=>{outline.enabled=enable.checked;localStorage.gwOutline=enable.checked?'on':'off';show();};
    width.oninput=()=>{outline.width=Number(width.value);localStorage.gwOutlineWidth=width.value;};
    color.oninput=()=>{outline.color=color.value;localStorage.gwOutlineColor=color.value;outlineMat.uniforms.ink.value.set(color.value);};show();
  }
  function load(){
    if(!loading)loading=new Promise((resolve,reject)=>new THREE.GLTFLoader().load(asset,g=>{
      g.scene.traverse(node=>{if(node.isSkinnedMesh)template=node;});resolve(template);
    },undefined,reject)).catch(error=>{console.warn("Zombie model load",asset,error);loading=null;});
    return loading;
  }
  load();
  function actor(){
    const source=template.skeleton.bones,bones=source.map(b=>{const n=new THREE.Bone();n.name=b.name;n.position.copy(b.position);return n;});
    const mesh=new THREE.SkinnedMesh(template.geometry,template.material);
    const parent=source.map(b=>source.indexOf(b.parent));
    bones.forEach((b,i)=>(parent[i]<0?mesh:bones[parent[i]]).add(b));
    mesh.bind(new THREE.Skeleton(bones,template.skeleton.boneInverses),new THREE.Matrix4());
    mesh.castShadow=true;mesh.frustumCulled=false;mesh.rotation.y=0;mesh.scale.setScalar(3.18);
    const byName=Object.fromEntries(bones.map(b=>[b.name,b]));
    for(const socket of [[-0.02093, 0.0297, 0.04834], [0.01707, 0.0297, 0.04902]]){const eye=new THREE.Mesh(eyeGeo,eyeMat);eye.scale.set(1,.75,.65);eye.position.fromArray(socket);byName.Head.add(eye);}
    return {mesh,bones,byName,parent};
  }
  let houndLoad;
  const houndUrl=new URL('models/attachments/hound.glb',document.currentScript.src).href;
  async function hound(){
    houndLoad??=new Promise((ok,fail)=>new THREE.GLTFLoader().load(houndUrl,g=>ok(g.scene),undefined,fail)).catch(e=>{houndLoad=null;throw e;});
    const source=await houndLoad,root=source.clone(true),original=[],copies=[];
    source.traverse(n=>original.push(n));root.traverse(n=>copies.push(n));
    const legs=[];let skin;
    for(let i=0;i<copies.length;i++){
      const node=copies[i],orig=original[i];
      if(node.isSkinnedMesh){
        node.bind(new THREE.Skeleton(orig.skeleton.bones.map(b=>copies[original.indexOf(b)]),orig.skeleton.boneInverses),orig.bindMatrix);
        node.castShadow=true;node.frustumCulled=false;skin=node;
      }
      const match=node.name.match(/([01])_(Left|Right)_Limb_([01])$/);
      if(match)legs.push({bone:node,rest:node.quaternion.clone(),sign:(match[1]==='0'?1:-1)*(match[2]==='Left'?1:-1),knee:match[3]==='1'});
    }
    root.updateMatrixWorld(true);
    const head=copies.find(n=>n.isBone && n.name.includes('Head_0'));
    if(head){const at=head.getWorldPosition(new THREE.Vector3());root.rotation.y=-Math.atan2(at.x,at.z);}
    root.scale.setScalar(1.45);return {root,legs,skin};
  }
  function dogStep(e,dt){
    const p=e.group.position;
    const speed=e.dogPrev && dt>0?Math.min(8,p.distanceTo(e.dogPrev)/dt):0;
    e.dogPrev??=p.clone();e.dogPrev.copy(p);
    e.gait=(e.gait||0)+dt*(4+speed*2.5);
    e.gaitMix=(e.gaitMix||0)+(Math.min(1,speed)-(e.gaitMix||0))*(1-Math.exp(-12*dt));
    for(const leg of e.hound.legs){
      leg.bone.quaternion.copy(leg.rest);const swing=leg.sign*Math.sin(e.gait);
      leg.bone.rotateX(e.gaitMix*(leg.knee?.36*Math.max(0,-swing):.55*swing));
    }
  }
  function attach(e){
    if(e.type==='dog'){
      hound().then(d=>{if(!e.group.parent){d.skin.skeleton.dispose();return;}e.hound=d;
        for(const part of [e.headMesh,e.bodyMesh,...e.limbs])part.visible=false;
        e.group.add(d.root);
      }).catch(console.warn);return;
    }
    load().then(()=>{if(!e.group.parent)return; if(!template){setTimeout(()=>{if(e.group.parent)attach(e);},2000);return;}
      const rig=actor();e.rig=rig;
      for(const part of [e.headMesh,e.bodyMesh,...e.limbs])part.visible=false;
      e.group.add(rig.mesh);animate(e,0);
    });
  }
  function animate(e,dt){
    outlineActor(e);
    if(e.hound){dogStep(e,dt);return;}if(!e.rig)return;
    const p=e.group.position,net=e.netPose,b=e.rig.byName;
    const speed=e.lastPos && dt>0?Math.min(9,Math.hypot(p.x-e.lastPos.x,p.z-e.lastPos.z)/dt):0;
    e.lastPos??=new THREE.Vector3();e.lastPos.copy(p);
    e.stride=(e.stride||0)+(Math.min(1,speed/1.5)-(e.stride||0))*(1-Math.exp(-12*dt));
    const sprint=net?net.action==='sprint':performance.now()<e.sprintUntil;
    e.posePhase=(e.posePhase??e.bobPhase)+dt*(sprint?15:9);
    const s=Math.sin(e.posePhase),reach=net?Math.max(0,1-((net.attackAge??1)/.45)):Math.max(0,(e.atkCd-.55)/.45);
    const bash=net?.action==='breach'?(.5+.5*s):0;
    e.flinch=Math.max(0,(e.flinch||0)-dt);
    const recoil=Math.sin(Math.PI*Math.min(1,e.flinch/.34));
    b.Spine.rotation.x=-.12-.12*e.stride-.52*recoil+.34*reach;b.Spine2.rotation.y=.13*s*e.stride;
    b.Head.rotation.y=.09*Math.sin(e.posePhase*.5);
    for(const [side,k] of [['Left',1],['Right',-1]]){
      const stride=k*s*e.stride;
      b[side+'UpLeg'].rotation.x=stride*(sprint?.72:.45);
      b[side+'Leg'].rotation.x=.1+.44*Math.max(0,-stride);
      b[side+'Arm'].rotation.order='YXZ';
      b[side+'Arm'].rotation.set(.10, -k*(.92+.23*stride+.82*Math.max(reach,bash)), -k*(.68-.40*Math.max(reach,bash)),'YXZ');
      b[side+'ForeArm'].rotation.y=-k*(.35+.12*stride);
    }
  }
  function cleanupActor(e){e.hound?.skin.skeleton.dispose();e.rig?.mesh.skeleton.dispose?.();}
  function clear(){
    for(const c of bodies.values()){c.dog?.skin.skeleton.dispose();c.root.parent?.remove(c.root);c.rig?.mesh.skeleton?.dispose?.();c.staticMesh?.geometry.dispose();}
    bodies.clear();skipped.clear();wave=null;
  }
  function trim(limit){
    while(bodies.size>limit){
      const [id,c]=bodies.entries().next().value;
      c.root.parent?.remove(c.root);c.dog?.skin.skeleton.dispose();c.rig?.mesh.skeleton.dispose();c.staticMesh?.geometry.dispose();
      bodies.delete(id);skipped.add(id);
    }
  }
  window.addEventListener('gw-quality',()=>{if(GWGraphics.level==='low')trim(0);});
  function setWave(n,interval=5){if(wave!==n){if(wave==null||n<wave||Math.floor((wave-1)/interval)!==Math.floor((n-1)/interval))clear();wave=n;}}
  function bodyScale(type){return type==='dog'?1:type==='boss'?1.05:type==='elite'?.78:.66;}
  function corpse(scene,event,scale=bodyScale(event.type),dog=null){
    if(bodies.has(event.mob)||skipped.has(event.mob))return;
    if(GWGraphics.level==='low'){skipped.add(event.mob);return;}
    trim(GWGraphics.level==='high'?(matchMedia('(pointer:coarse)').matches?20:40):(matchMedia('(pointer:coarse)').matches?8:16));
    const root=new THREE.Group();root.position.set(event.x,event.y||0,event.z);root.rotation.y=event.yaw||0;root.scale.setScalar(scale);
    // Allocate support in death order, including on a late-join snapshot.
    const floor=root.position.y;
    for(const other of bodies.values()){
      if(other.area!==event.area || Math.abs(other.floor-floor)>.6)continue;
      const gap=Math.hypot(root.position.x-other.root.position.x,root.position.z-other.root.position.z);
      if(gap<1.35)root.position.y=Math.max(root.position.y,other.root.position.y+.34*(1-gap/1.35));
    }
    scene.add(root);
    const c={root,floor,stack:root.position.y-floor,area:event.area,clock:(event.age||0)/1000,steps:0,seed:event.mob,head:event.head};bodies.set(event.mob,c);
    if(dog || event.type==='dog'){
      hound().then(d=>{if(!root.parent){d.skin.skeleton.dispose();return;}c.dog=d;root.add(d.root);poseDeadDog(c);}).catch(console.warn);return;
    }
    load().then(()=>{if(!template||!root.parent)return;
      const rig=actor();root.add(rig.mesh);startFall(c,rig,event,false);
    });
  }
  function startFall(c,rig,event,dog){
      c.rig=rig;
      const rest=[],previous=[],links=[];
      rig.bones.forEach((b,i)=>{const p=b.position.clone(),parent=rig.parent[i];if(parent>=0)p.add(rest[parent]);rest.push(p);});
      c.rest=rest;c.points=rest.map(p=>p.clone());c.previous=previous;
      let seed=(event.mob*2654435761)>>>0;
      const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const side=(rand()-.5)*.085,kick=(rand()>.5?1:-1)*(event.head?.093:.068);
      for(let i=0;i<rest.length;i++){
        previous.push(rest[i].clone().sub(new THREE.Vector3(side*rest[i].y,(rand()-.5)*.016,kick*rest[i].y+(rand()-.5)*.035)));
        if(rig.parent[i]>=0)links.push([rig.parent[i],i]);
      }
      for(const [a,b] of dog?[[2,3],[4,5],[2,4],[3,5]]:[[6,13],[10,17],[6,17],[13,10],[0,3],[3,5],[7,14],[8,6],[15,13]])links.push([a,b]);
      c.links=links.map(([a,b])=>[a,b,rest[a].distanceTo(rest[b])]);
      c.q=rest.map(()=>new THREE.Quaternion());c.v=new THREE.Vector3();c.dir=new THREE.Vector3();c.inv=new THREE.Quaternion();
      // Start from the same bent-arm pose for every client.
      for(const [side,k] of dog?[]:[[7,1],[14,-1]])for(const i of [side+1,side+2]){
        const offset=c.points[i].clone().sub(rest[side]).applyAxisAngle(new THREE.Vector3(0,1,0),k*.95);
        const newPoint=rest[side].clone().add(offset);previous[i].add(newPoint).sub(c.points[i]);c.points[i].copy(newPoint);
      }
      advance(c);
  }
  function advance(c){
    const target=Math.min(settleSteps,Math.floor(c.clock/step));
    if(!c.rig||target<=c.steps)return;
    const p=c.points,v=c.v;
    while(c.steps<target){
      c.steps++;
      for(let i=0;i<p.length;i++){
        const grounded=p[i].y<.065;
        v.copy(p[i]).sub(c.previous[i]).multiplyScalar(grounded?.70:.98);
        c.previous[i].copy(p[i]);p[i].add(v);p[i].y-=3.6*step*step;
      }
      for(let n=0;n<5;n++){
        for(const [a,b,len] of c.links){
          v.subVectors(p[b],p[a]);const d=Math.max(.000001,v.length());v.multiplyScalar((d-len)/d*.5);p[a].add(v);p[b].sub(v);
        }
        for(let i=0;i<p.length;i++)p[i].y=Math.max(i===5?.095:.050,p[i].y);
      }
    }
    const {bones,parent}=c.rig;
    for(let i=0;i<bones.length;i++){
      const j=parent[i],child=parent.indexOf(i),q=c.q[i];
      if(child>=0)q.setFromUnitVectors(v.subVectors(c.rest[child],c.rest[i]).normalize(),c.dir.subVectors(p[child],p[i]).normalize());
      else q.copy(c.q[j]);
      const b=bones[i];b.position.copy(p[i]);b.quaternion.copy(q);
      if(j>=0){c.inv.copy(c.q[j]).invert();b.position.sub(p[j]).applyQuaternion(c.inv);b.quaternion.premultiply(c.inv);}
    }
  }
  function poseDeadDog(c){
    const t=Math.min(1,c.clock/.78),fall=t*t*(3-2*t),side=c.seed%2?1:-1;
    c.root.rotation.z=side*1.48*fall;c.root.position.y=c.floor+c.stack+.39*fall;
    for(const leg of c.dog.legs){
      leg.bone.quaternion.copy(leg.rest);leg.bone.rotateX(leg.sign*(leg.knee?.64:.38)*fall);
    }
    if(t===1)c.steps=settleSteps;
  }
  function tick(dt,area){
    let frozen=0;
    for(const c of bodies.values()){
      c.root.visible=c.area==null||c.area===area;
      if(c.steps>=settleSteps){
        if(c.rig && frozen<1){freezeCorpse(c);frozen++;}
        continue;
      }c.clock+=dt;
      if(c.dog)poseDeadDog(c);else advance(c);
    }
  }
  async function preload(){await load();if(!template)throw Error('僵尸模型载入失败');const d=await hound();d.skin.skeleton.dispose();}
  return {trim,preload,outlineSettings,bodyScale,attach,animate,cleanupActor,corpse,setWave,tick,clear};
})();