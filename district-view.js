// Each loaded block owns its scenery and colliders. Window health stays in the simulation.
function createDistrictView(scene, obstacles, materials, createBoxBatch, facadeMaterial, facadeGeometry) {
  const loaded=new Map(), cube=new THREE.BoxGeometry();
  const brick=facadeMaterial(materials.wall,true);
  const metal=materials.truck, dark=materials.eliteBody;
  const paint=new THREE.MeshBasicMaterial({color:0xd8aa55});
  const light=new THREE.MeshBasicMaterial({color:0xdce6cd});
  const pavement=new THREE.MeshStandardMaterial({color:0x595955,roughness:1});
  const facade=[materials.houseOrange,materials.truck,materials.houseGreen,materials.crate];
  const base={area:4,left:-11,right:48,gates:[...YardSurvival.gates,YardSurvival.gateFor(5)],windows:YardSurvival.windows,walls:YardSurvival.walls,cover:YardSurvival.cover};

  function build(block,endless){
    const group=new THREE.Group(),details=createBoxBatch();
    const colliders=[],doors=[],boards=[],owned=[];
    function solid(x,y,z,w,h,d,mat,overhead=false){
      const textured=mat===materials.wall;
      const geo=textured?facadeGeometry(x,y,z,w,h,d,brick):cube;
      const mesh=new THREE.Mesh(geo,textured?brick:mat);mesh.position.set(x,y,z);
      if(textured)owned.push(geo);else mesh.scale.set(w,h,d);
      mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
      const part={mesh,overhead,bottom:y-h/2,top:y+h/2,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2};
      colliders.push(part);obstacles.push(part);return part;
    }
    function sign(text,x,y,z,angle,width){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
      const ink=canvas.getContext('2d');ink.fillStyle='#233039';ink.fillRect(0,0,512,96);
      ink.fillStyle='#ecbe66';ink.fillRect(0,0,10,96);ink.textAlign='center';ink.textBaseline='middle';
      ink.font='bold 37px sans-serif';ink.fillText(text,256,50,470);
      const map=new THREE.CanvasTexture(canvas),mat=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide});
      const geo=new THREE.PlaneGeometry(width,.82),mesh=new THREE.Mesh(geo,mat);
      mesh.position.set(x,y,z);mesh.rotation.y=angle;group.add(mesh);owned.push(geo,mat,map);
    }
    const mid=(block.left+block.right)/2,width=block.right-block.left;
    details.add(mid,-.12,36,width,.22,32,materials.floor);
    for(const w of block.walls){
      solid(w.x,2,w.z,w.w,4,w.d,materials.wall);
      details.add(w.x,4.02,w.z,w.w+.08,.16,w.d+.08,metal);
    }
    for(const [index,w] of block.windows.entries()){
      if(endless){solid(w.x,2,w.z,w.axis==='x'?w.width:.6,4,w.axis==='x'?.6:w.width,materials.wall);continue;}
      const horizontal=w.axis==='x';
      const bar=(y,h,d,mat,overhead=false)=>solid(w.x,y,w.z,horizontal?w.width:d,h,horizontal?d:w.width,mat,overhead);
      bar(.4,.8,.6,materials.wall);bar(3.65,.7,.6,materials.wall,true);
      for(const side of [-1,1]){
        const offset=side*(w.width/2+.07);
        details.add(w.x+(horizontal?offset:0),2,w.z+(horizontal?0:offset),horizontal?.17:.76,2.8,horizontal?.76:.17,metal);
      }
      boards.push({index:w.index??index,parts:[1.13,1.95,2.77].map(y=>bar(y,.52,.18,materials.gunWood))});
    }
    for(const g of block.gates){
      const horizontal=g.axis==='x',w=horizontal?g.width:.5,d=horizontal?.5:g.width;
      const door=solid(g.x,2.45,g.z,w,4.9,d,metal);
      doors.push({area:g.area,door});
      details.add(g.x,5.12,g.z,w+.36,.45,d+.36,dark);
      sign(YardSurvival.zoneName(g.area)+'  ·  '+g.price,g.x+(horizontal?0:-.35),5.22,g.z+(horizontal?.35:0),horizontal?0:-Math.PI/2,5.15);
    }
    for(const o of block.cover){
      const mat=({boost:metal,drink:materials.ammoBox,bench:materials.crate,ammo:materials.ammoBox,box:materials.mysteryBox,partition:facade[block.theme??2],generator:metal,crate:materials.crate})[o.kind];
      solid(o.x,o.h/2,o.z,o.w,o.h,o.d,mat);
      if(o.label){sign(o.label,o.x,o.h+.55,o.z,0,3);details.add(o.x,o.h*.72,o.z+.5,.68,.35,.08,light);}
      if(o.kind==='partition'){details.add(o.x,o.h-.18,o.z,o.w+.08,.12,o.d+.08,light);continue;}
      for(const side of [-1,1])details.add(o.x+side*o.w*.34,o.h/2,o.z,.13,o.h+.06,o.d+.06,dark);
      if(o.kind==='box' || o.kind==='ammo'){
        details.add(o.x,o.h+.07,o.z,o.w+.12,.14,o.d+.12,mat);
        details.add(o.x,o.h+.16,o.z,o.w*.55,.035,.14,o.kind==='box'?paint:light);
        if(o.kind==='box')sign('武器箱  ·  750',o.x,o.h+.62,o.z,0,2.5);
      }
    }
    if(block.area===4){
      details.add(0,4.54,27,10,.38,6.7,metal);
      details.add(0,4.24,29.8,3,.12,.3,light);
    }else{
      // Pavements, lamp arms and road paint follow the playable street.
      for(const z of [26,46])details.add(mid,.035,z,width,.06,3.6,pavement);
      for(let x=block.left+3;x<block.right;x+=6)details.add(x,.015,36,2.8,.02,.12,paint);
      for(const x of [block.left+2,block.right-3]){
        details.add(x,2.75,46.9,.13,5.5,.13,metal);details.add(x,5.45,46.1,.13,.16,1.7,metal);
        details.add(x,5.32,45.42,.54,.1,.43,light);
      }
      if(block.indoor){
        const south=block.front>36,roofZ=south?43.7:27.8;
        solid(mid,4.7,roofZ,width,.4,9.1,facade[block.theme],true);
        for(const offset of [6.5,20]){
          details.add(block.left+offset,4.15,block.front,6,1,.5,facade[block.theme]);
          details.add(block.left+offset,4.42,roofZ,2.3,.1,.35,light);
        }
        sign(YardSurvival.zoneName(block.area),mid,3.5,block.front+(south?-.32:.32),south?Math.PI:0,5.4);
      }else{
        // Low shopfronts frame a plaza with clear sightlines through the centre.
        for(let i=0;i<3;i++){
          const x=block.left+5+i*9,height=4.8+((block.area+i)%3)*.62;
          details.add(x,height/2,22.1,8.6,height,2.8,facade[(block.theme+i)%4]);
          details.add(x,3.8,23.6,8.8,.22,.8,metal);
          for(const off of [-2.4,0,2.4])details.add(x+off,height-.87,23.55,1.1,.54,.06,light);
        }
        details.add(mid,.08,35,8,.14,7,pavement);
        sign(YardSurvival.zoneName(block.area),mid,4.85,24.4,0,5.4);
      }
    }
    details.finish(group);scene.add(group);
    return {group,colliders,doors,boards,owned};
  }
  function removeCollider(part){
    const i=obstacles.indexOf(part);if(i>=0)obstacles.splice(i,1);
  }
  function unload(view){
    scene.remove(view.group);view.colliders.forEach(removeCollider);
    const geometries=new Set();
    view.group.traverse(o=>{if(o.isInstancedMesh){geometries.add(o.geometry);o.dispose?.();}});
    geometries.forEach(g=>g.dispose());view.owned.forEach(o=>o.dispose());
  }
  return {update(world,player){
    const here=YardSurvival.blockAt(player.x),min=Math.max(4,here-2),max=Math.min(Math.max(world.area,4),here+2);
    for(const [n,view] of loaded)if(n<min || n>max){unload(view);loaded.delete(n);}
    for(let n=min;n<=max;n++){
      if(!loaded.has(n))loaded.set(n,build(n===4?base:YardSurvival.street(n),world.endless));
      const view=loaded.get(n);
      for(const {area,door} of view.doors)if(area<=world.area && door.mesh.visible){
        door.mesh.visible=false;removeCollider(door);
      }
      for(const {index,parts} of view.boards){
        const hp=YardSurvival.durability(world,index);
        parts.forEach((part,i)=>{
          const visible=i<hp;if(visible===part.mesh.visible)return;
          part.mesh.visible=visible;if(visible)obstacles.push(part);else removeCollider(part);
        });
      }
    }
  }};
}
