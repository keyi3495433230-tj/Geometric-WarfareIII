const Dust=(()=>{
  const names={dust:'沙漠双门',works:'工业厂区',lanes:'旧城街巷'};
  const models=new Map();
  function scenery(scene,file,x,y,z,w,h,d,solid){
    let asset=models.get(file);
    if(!asset){asset=new Promise((resolve,reject)=>new THREE.GLTFLoader().load('./models/maps/'+file+'.glb',v=>resolve(v.scene),undefined,reject));models.set(file,asset);}
    asset.then(template=>{
      const obj=template.clone(),bounds=new THREE.Box3().setFromObject(obj),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      obj.scale.set(w/Math.max(.001,size.x),h/Math.max(.001,size.y),d/Math.max(.001,size.z));
      obj.position.set(x-center.x*obj.scale.x,y-bounds.min.y*obj.scale.y,z-center.z*obj.scale.z);scene.add(obj);if(solid)solid.visible=false;
    }).catch(()=>models.delete(file));
  }
  function createMap(id){
  const sites=id==='works'?{A:{x:34,z:-22},B:{x:-31,z:-20}}:id==='lanes'?{A:{x:33,z:-13},B:{x:-35,z:-28}}:{A:{x:39,z:-25},B:{x:-37,z:-24}};
  // The east approach runs from long doors to A. The west tunnel branches into mid and B.
  let blocks=[
    [0,-43,108,2,9],[0,43,108,2,9],[-53,0,2,86,9],[53,0,2,86,9],
    [-17,19,22,13,9],[17,23,19,12,7],[41,20,15,10,8],
    [-46,6,10,22,8],[-24,1,16,9,7],[-15,-12,8,16,9],
    [15,5,17,16,9],[29,-5,7,20,7],[15,-18,13,6,5],
    [-34,-11,8,3,4],[-41,-30,6,5,3],[-30,-23,4,4,3],[36,-30,6,4,3],[44,-19,4,4,3],
    [-5,-10,5,1,4],[3,-11,4,1,4],[34,14,1,5,4],[29,17,5,1,4],
    [2,-32,16,6,7],[-48,25,6,5,4],[-7,34,6,3,2],[-38,-37,5,5,10],[-48,-15,5,5,10],[-18,-16,5,5,10]
  ];
  if(id==='works')blocks=blocks.slice(0,4).concat([
    [-31,14,19,12,7],[27,19,23,10,8],[-10,-3,12,22,7],[11,-8,10,14,10],[-37,-4,13,8,7],[39,-5,10,14,8],
    [2,14,5,6,3],[-19,-28,9,9,7],[23,-30,14,6,7],[38,-25,4,4,3],[-35,-23,4,4,2]]);
  if(id==='lanes')blocks=blocks.slice(0,4).concat([
    [-25,23,24,8,6],[21,26,12,10,7],[41,12,12,14,8],[-40,4,10,14,5],[-16,3,12,12,7],[8,7,12,8,5],
    [22,-6,7,14,7],[-26,-13,15,7,7],[0,-20,18,8,7],[36,-26,13,7,6],[-42,-33,5,5,2],[-4,20,4,4,2]]);
  const walk=(x,z)=>Math.abs(x)<51.5 && Math.abs(z)<41.5 && !blocks.some(([bx,bz,w,d])=>Math.abs(x-bx)<w/2+.62 && Math.abs(z-bz)<d/2+.62);
  function grid(yard){return yard.navigator(-52,-42,53,43,2,walk);}
  function elevation(x,z){
    // Short A climbs from mid, long A rises from the east approach.
    return id!=='dust'?0:2.25*Math.min(1,Math.max(0,(x-19)/10),Math.max(0,(-z-5)/13));
  }
  function build(scene,box){
    const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.93});
    const sand=mat(id==='works'?0x747e81:id==='lanes'?0x908d84:0xc5a77c),stone=mat(id==='works'?0x535e62:id==='lanes'?0xad9688:0xd4bd93),ochre=mat(id==='dust'?0xb29165:0x74736d),blue=mat(0x607e87),wood=mat(0x78563c);
    const cube=new THREE.BoxGeometry();const batch=new Map();
    function detail(x,y,z,w,h,d,m){
      if(!batch.has(m))batch.set(m,[]);
      const t=new THREE.Matrix4().makeScale(w,h,d);t.setPosition(x,y,z);batch.get(m).push(t);
    }
    const terrain=new THREE.PlaneGeometry(108,86,108,86);terrain.rotateX(-Math.PI/2);
    const verts=terrain.attributes.position;
    for(let i=0;i<verts.count;i++)verts.setY(i,elevation(verts.getX(i),verts.getZ(i)));
    terrain.computeVertexNormals();const ground=new THREE.Mesh(terrain,sand);ground.receiveShadow=true;scene.add(ground);
    blocks.forEach(([x,z,w,d,h],i)=>{
      const m=h<=4?wood:i%3===0?ochre:stone;
      const lift=elevation(x,z);const solid=box(x,(h+lift)/2,z,w,h+lift,d,m);
      if(i>=4 && id==='works' && h>=6){
        const file=['building-a','building-d','building-j'][i%3];
        scenery(scene,'works/'+file,x,lift,z,w+.08,h+.4,d+.08,solid?.mesh);
        // Keep the solid footprint for movement and shots while the building is drawn over it.
      }
      if(i>=4 && id!=='works' && h>=6 && w>6){
        scenery(scene,'lanes/'+(i%2?'wall-a-flat-window':'wall-a-flat-garage'),x,lift,z+d/2+.08,w-.15,h-.1,.18);
      }
      if(id==='lanes' && i>=4 && h<4)scenery(scene,'lanes/detail-dumpster-closed',x,lift,z,w+.1,h+.1,d+.1);
      if(id==='works' && i>=4 && h>=6)return;
      detail(x,h+lift+.12,z,w+.22,.24,d+.22,h<=4?wood:ochre);
      if(h>=6 && i>=4)for(let nx=x-w/2+2;nx<x+w/2-1;nx+=3.3){
        for(const side of [-1,1]){
          const face=z+side*(d/2+.04);detail(nx,lift+h*.67,face,1.15,1.55,.12,blue);
          detail(nx,lift+h*.67-.83,face,1.6,.16,.24,ochre);
        }
      }
    });
    // Broken roof slats give the B approach shade while keeping the mid exit legible.
    if(id==='dust'){
    for(let z=-6;z<14;z+=2.5)detail(-35,5,z,8.5,.28,1.85,wood);
    for(const [x,z] of [[-38,-37],[-48,-15],[-18,-16]]){
      for(let n=-2;n<=2;n+=2){detail(x+n,10.5,z-2,.9,1,1,stone);detail(x+n,10.5,z+2,.9,1,1,stone);}
    }
    // Landmark domes and a striped awning distinguish the two ends of the CT street.
    for(const [x,z,r,y] of [[-47,-45,5,10],[20,-47,3.7,11]]){
      detail(x,y/2,z,r*2,y,r*2,stone);
      const dome=new THREE.Mesh(new THREE.SphereGeometry(r,16,8,0,Math.PI*2,0,Math.PI/2),blue);
      dome.position.set(x,y,z);scene.add(dome);
    }
    for(let i=0;i<10;i++)detail(10.5+i,5.8,-20,1, .15,3,i%2?ochre:stone);
    }
    for(const [key,p] of Object.entries(sites)){
      const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
      ctx.strokeStyle=ctx.fillStyle='#ab412b';ctx.lineWidth=6;ctx.strokeRect(5,5,118,118);ctx.textAlign='center';ctx.font='bold 98px sans-serif';ctx.fillText(key,64,99);
      const mark=new THREE.Mesh(new THREE.PlaneGeometry(7,7),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));
      mark.rotation.x=-Math.PI/2;mark.position.set(p.x,elevation(p.x,p.z)+.025,p.z);scene.add(mark);
      const sign=mark.clone();sign.rotation.x=0;sign.position.set(p.x,4,-41.9);scene.add(sign);
    }
    for(const [m,transforms] of batch){
      const mesh=new THREE.InstancedMesh(cube,m,transforms.length);transforms.forEach((t,i)=>mesh.setMatrixAt(i,t));mesh.receiveShadow=true;scene.add(mesh);
    }
  }
  return {id,name:names[id],sites,blocks,walk,grid,build,elevation};
  }
  const maps=Object.fromEntries(Object.keys(names).map(id=>[id,createMap(id)]));
  return {...maps.dust,names,get:id=>Object.hasOwn(names,id)?maps[id]:maps.dust};
})();
if(typeof module!=='undefined')module.exports=Dust;
