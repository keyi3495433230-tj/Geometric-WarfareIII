/* Shared map and simulation for offline and hosted window defence. */
const YardSurvival = (() => {
  const weapons = [
        { id: 'glock', name: 'Glock 19', caliber: '9x19mm Parabellum', magSize: 15, maxReserve: 60, dmgBody: 35, dmgHead: 85, cooldown: 0.16, reloadTime: 1.6, auto: false, color: '#facc15' },
    {id:'usp',name:'USP',caliber:'.45 ACP',isPistol:true,magSize:12,maxReserve:72,dmgBody:42,dmgHead:100,cooldown:.2,reloadTime:1.75,auto:false,color:'#e0bc78'},
    {id:'tec9',name:'Tec-9',caliber:'9x19mm',isPistol:true,magSize:24,maxReserve:120,dmgBody:25,dmgHead:55,cooldown:.09,reloadTime:2.05,auto:true,color:'#d5d9df'},

        { id: 'mp5', name: 'MP5K', caliber: '9x19mm Parabellum', magSize: 30, maxReserve: 120, dmgBody: 22, dmgHead: 45, cooldown: 0.08, reloadTime: 2.0, auto: true, color: '#60a5fa' },
        { id: 'm4a1', name: 'M4A1', caliber: '5.56x45mm NATO', magSize: 30, maxReserve: 90, dmgBody: 40, dmgHead: 100, cooldown: 0.1, reloadTime: 2.2, auto: true, color: '#f87171' },
        { id: 'ak47', name: 'AK-47', caliber: '7.62x39mm', magSize: 30, maxReserve: 120, dmgBody: 48, dmgHead: 120, cooldown: 0.1, reloadTime: 2.5, auto: true, color: '#f59e0b' },
        { id: 'rem870', name: 'Remington 870', caliber: '12 Gauge', magSize: 8, maxReserve: 32, dmgBody: 20, dmgHead: 40, cooldown: 0.8, reloadTime: 2.8, auto: false, pellets: 8, color: '#fb923c' },
        { id: 'm82', name: 'Barrett M82', caliber: '.50 BMG', magSize: 5, maxReserve: 20, dmgBody: 150, dmgHead: 450, cooldown: 1.2, reloadTime: 3.5, auto: false, color: '#c084fc' },
        { id: 'm249', name: 'M249 SAW', caliber: '5.56x45mm NATO', magSize: 100, maxReserve: 200, dmgBody: 35, dmgHead: 80, cooldown: 0.07, reloadTime: 4.5, auto: true, color: '#ef4444' }, 
        { id: 'mk14', name: 'MK14 EBR', caliber: '7.62x51mm NATO', magSize: 20, maxReserve: 80, dmgBody: 65, dmgHead: 160, cooldown: 0.25, reloadTime: 2.5, auto: false, color: '#34d399' }, 
        { id: 'aa12', name: 'AA-12', caliber: '12 Gauge', magSize: 20, maxReserve: 60, dmgBody: 18, dmgHead: 35, cooldown: 0.25, reloadTime: 3.0, auto: true, pellets: 6, color: '#f472b6' },
        { id: 'laser', name: 'RayGun 激光器', caliber: 'Plasma Energy', magSize: 30, maxReserve: 150, dmgBody: 80, dmgHead: 200, cooldown: 0.15, reloadTime: 2.2, auto: true, color: '#0ea5e9', isLaser: true }
  ];
  const zones = ['出生院','补给院','装卸场','发电站'];
  const gates = [
    {id:'gate1',area:2,x:0,z:34,axis:'x',width:5.6,price:750},
    {id:'gate2',area:3,x:11,z:29,axis:'z',width:5.2,price:1250},
    {id:'gate3',area:4,x:29,z:40,axis:'z',width:5.6,price:2000}
  ];
  // nx/nz point from outside the compound into the room.
  const windows = [
    [-11,41,1,0,1],[-5,48,0,-1,1],[5,48,0,-1,1],
    [-11,29,1,0,2],[-8,24,0,1,2],
    [19,24,0,1,3],[22,48,0,-1,3],
    [38,48,0,-1,4],[44,24,0,1,4],[38,24,0,1,4]
  ].map(([x,z,nx,nz,area],i)=>({id:'window'+(i+1),x,z,nx,nz,area,axis:nx?'z':'x',width:2.9}));
  const cover = [
    {x:-7,z:31,w:1.5,d:1,h:2,kind:'boost',label:'强化机 · 1200'},
    {x:15,z:43,w:1.1,d:1,h:2,kind:'drink',label:'回复饮料 · 150'},
    {x:33,z:45,w:2,d:1,h:1.3,kind:'bench',label:'工作台 · 900'},
    {x:0,z:26,w:1.5,d:1.1,h:1.1,kind:'ammo'},
    {x:-5,z:41,w:2.8,d:2.4,h:1.6,kind:'crate'},
    {x:19,z:34,w:3.4,d:5,h:2.1,kind:'crate'},
    {x:36,z:34,w:3,d:6,h:2.8,kind:'generator'},
    {x:43,z:39,w:2.5,d:2.5,h:1.7,kind:'generator'},
    {x:7,z:38,w:2.2,d:1,h:1.15,kind:'box'},
    {x:-4.6,z:27,w:.44,d:6,h:4.3,kind:'partition'},
    {x:4.6,z:27,w:.44,d:6,h:4.3,kind:'partition'},
    {x:-3.2,z:30,w:3.2,d:.45,h:4.3,kind:'partition'},
    {x:3.2,z:30,w:3.2,d:.45,h:4.3,kind:'partition'}
  ];
  const lines=[['x',24,-11,48],['x',48,-11,48],['z',-11,24,48],['z',48,24,48],['x',34,-11,11],['z',11,24,48],['z',29,24,48]];
  function wallBox(axis,fixed,a,b){
    const mid=(a+b)/2,length=b-a;
    return axis==='x'?{x:mid,z:fixed,w:length,d:.6}:{x:fixed,z:mid,w:.6,d:length};
  }
  const blockWidth=28;
  const districts=['钟楼街','电车总站','旧书市','码头仓街','广播巷','铁桥市场','机修大街','玻璃厂','公寓里','水塔路','消防站','影院街','铁路货场','灯具市场','邮政广场','天文台路'];
  function zoneName(area){
    if(area<=4)return zones[area-1];
    const cycle=Math.floor((area-5)/districts.length);
    return districts[(area-5)%districts.length]+(cycle?' · '+(cycle+1)+'街段':'');
  }
  function gateFor(area){
    if(area<=4)return gates[area-2];
    return {id:'gate'+(area-1),area,x:48+(area-5)*blockWidth,z:area%2?42:29,axis:'z',width:6,price:2000+(area-4)*350};
  }
  function blockAt(x){return x<48?4:5+Math.floor((x-48)/blockWidth);}
  function solidWalls(lines,openings){
    const walls=[];
    for(const [axis,fixed,start,end] of lines){
    const other=axis==='x'?'z':'x';
    const cuts=openings.filter(o=>o.axis===axis && o[other]===fixed && o[axis]>start && o[axis]<end).sort((a,b)=>a[axis]-b[axis]);
    let cursor=start;
    for(const o of cuts){
      walls.push(wallBox(axis,fixed,cursor,o[axis]-o.width/2));
      cursor=o[axis]+o.width/2;
    }
    walls.push(wallBox(axis,fixed,cursor,end));
    }
    return walls;
  }
  const walls=solidWalls(lines,[...windows,...gates,gateFor(5)]);
  const blocks=new Map();
  function street(area){
    if(blocks.has(area))return blocks.get(area);
    const left=gateFor(area).x,right=left+blockWidth,theme=(area-5)%4;
    const entries=[0,1].map((side)=>{
      const index=10+(area-5)*2+side;
      return {index,id:'window'+(index+1),area,x:left+(side?20:7),z:side?48:24,nx:0,nz:side?-1:1,axis:'x',width:3.1};
    });
    const exit=gateFor(area+1);
    const obstacles=[
      {x:left+14,z:theme%2?39:32,w:theme%2?5:3,d:3,h:theme===1?2.3:1.7,kind:theme%2?'generator':'crate'},
      {x:left+4,z:36,w:1.5,d:1.1,h:1.1,kind:'ammo'}
    ];
    const walls=solidWalls([['x',24,left,right],['x',48,left,right],['z',right,24,48]],[...entries,exit]);
    const indoor=theme===0 || theme===2;
    const front=theme===2?39:32;
    if(indoor){
      // Two wide doorways in the street-facing wall connect the shop floor to the road.
      for(const [start,end] of [[0,4],[9,17],[23,28]])obstacles.push({
        x:left+(start+end)/2,z:front,w:end-start,d:.5,h:4.5,kind:'partition'
      });
      obstacles[0].z=theme===2?28:39;
    }
    if(indoor || theme===3)obstacles.push({x:left+14,z:theme===2?44:27,w:2.2,d:1,h:1.15,kind:'box'});
    const block={area,left,right,theme,indoor,front,windows:entries,cover:obstacles,gates:[exit],walls};
    if(blocks.size>=48)blocks.delete(blocks.keys().next().value);
    blocks.set(area,block);return block;
  }
  function windowAt(i){return i<10?windows[i]:street(5+Math.floor((i-10)/2)).windows[(i-10)%2];}
  function durability(g,i){return i<10?g.boards[i]:g.streetBoards[i]??(g.endless?0:3);}
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  // Each closed divider is solid. When purchased only its doorway becomes passable.
  const blockers=zones.map((_,index)=>{
    const boxes=[...cover];
    for(const [axis,fixed,start,end] of lines.slice(4)){
      const g=gates.find(g=>g.axis===axis && (axis==='x'?g.z:g.x)===fixed);
      if(index+1<g.area)boxes.push(wallBox(axis,fixed,start,end));
      else boxes.push(wallBox(axis,fixed,start,g[axis]-g.width/2),wallBox(axis,fixed,g[axis]+g.width/2,end));
    }
    return boxes;
  });
  function insideArea(x,z,area,r){
    return x>=-10.7+r && z>=24.3+r && x<=47.7+Math.max(0,area-4)*blockWidth-r && z<=47.7-r &&
      (area>=2 || z>=34) && (area>=3 || x<=11) && (area>=4 || x<=29);
  }
  function passable(x,z,area,r=.52){
    return clearPath(x,z,x,z,area,r);
  }
  function crossesBox(x,z,tx,tz,box,r){
    const dx=tx-x,dz=tz-z,left=box.x-box.w/2-r,right=box.x+box.w/2+r;
    const near=box.z-box.d/2-r,far=box.z+box.d/2+r;
    let enter=0,exit=1;
    if(dx===0){if(x<=left || x>=right)return false;}
    else {
      const a=(left-x)/dx,b=(right-x)/dx;
      enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    }
    if(dz===0){if(z<=near || z>=far)return false;}
    else {
      const a=(near-z)/dz,b=(far-z)/dz;
      enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    }
    return enter<exit;
  }
  function clearPath(x,z,tx,tz,area,r=.52){
    if(!insideArea(tx,tz,area,r) || Math.abs(tx-x)>90)return false;
    const lo=Math.min(x,tx)-r-.3,hi=Math.max(x,tx)+r+.3;
    const hit=b=>crossesBox(x,z,tx,tz,b,r);
    if(lo<48 && blockers[Math.min(area,4)-1].some(hit))return false;
    for(let n=Math.max(5,blockAt(lo));n<=Math.min(area,blockAt(hi)+1);n++){
      const block=street(n),gate=gateFor(n);
      if(gate.x<=hi && gate.x>=lo &&
        (hit(wallBox('z',gate.x,24,gate.z-gate.width/2)) || hit(wallBox('z',gate.x,gate.z+gate.width/2,48))))return false;
      if(block.left<=hi && block.right>=lo && block.cover.some(hit))return false;
    }
    return true;
  }
  function createClassic(boxes,horde=false){
    const g=createSurvival();g.horde=horde;g.remaining=waveCount(1,horde);g.baseBoxes=boxes;g.maxArea=1;setClassicSector(g,1);return g;
  }
  function rotateTown(x,z,turn){
    switch((turn%4+4)%4){
      case 1:return {x:z,z:-x};
      case 2:return {x:-x,z:-z};
      case 3:return {x:-z,z:x};
      default:return {x,z};
    }
  }
  // Feet heights, rather than camera heights, identify the floor a pursuer is on.
  function stairGoal(pos,feet,target,targetFeet,sector){
    const turn=sector-1,a=rotateTown(pos.x,pos.z,-turn),b=rotateTown(target.x,target.z,-turn);
    const house=q=>Math.abs(Math.abs(q.x)-26)<7.6 && Math.abs(q.z)<7.6?Math.sign(q.x):0;
    const from=house(a),to=house(b),upper=feet>=4.115,wantsUpper=to && targetFeet>2.3;
    const down=feet>.001 && (!wantsUpper || from!==to);
    if(upper && from===to && wantsUpper && Math.abs(a.x-from*29)<2.1 && a.z>=3.98 && b.z<4)
      return rotateTown(from*26,4.65,turn);
    if((!wantsUpper || (upper && from===to)) && !down)return target;
    const side=down?from:to;
    if(!side)return target;
    const x=side*29,aligned=Math.abs(a.x-x)<1.35;
    let z;
    if(down)z=aligned && (feet<3.95 || a.z>3.4)?-5.45:4.65;
    else z=aligned && (feet>.05 || a.z<-4.65)?4.65:-5.55;
    return rotateTown(x,z,turn);
  }
  function stairFeet(x,z,feet,sector){
    const q=rotateTown(x,z,1-sector);
    if(Math.abs(Math.abs(q.x)-26)>7.55 || Math.abs(q.z)>7.55)return 0;
    if(Math.abs(Math.abs(q.x)-29)<1.91 && q.z>=-5 && q.z<=4){
      const h=(q.z+5)*4.12/9;
      if(Math.abs(h-feet)<.62)return h;
    }
    return feet>3.6?4.12:0;
  }
  function setClassicSector(g,sector){
    const angle=(sector-1)%4*Math.PI/2,c=Math.round(Math.cos(angle)),s=Math.round(Math.sin(angle));
    const rot=([x,z])=>[x*c+z*s,z*c-x*s];
    const stations=[[0,0],[15,10],[-18,-20],[18,20],[-8,22]];
    const spots=stations.map((_,i)=>rot(stations[(i+sector-1)%5]));
    const boxes=g.baseBoxes.map(([l,r,t,b,bottom=0,top=Infinity],i)=>{const a=rot([l,t]),d=rot([r,b]);const j=i-g.baseBoxes.length+5;
      const dx=j>=0?spots[j][0]-(a[0]+d[0])/2:0,dz=j>=0?spots[j][1]-(a[1]+d[1])/2:0;
      return [Math.min(a[0],d[0])+dx,Math.max(a[0],d[0])+dx,Math.min(a[1],d[1])+dz,Math.max(a[1],d[1])+dz,bottom,top];});
    g.area=sector;g.stations=spots;
    g.playerPath=(p,x,z)=>{
      const height={stand:2.05,crouch:1.1,prone:.4}[p.stance]||2.05;
      const feet=(p.y||2.05)-height,solids=boxes.filter(b=>!(feet+.09>=b[5] || (p.y||2.05)+.15<=b[4]));
      const clearance=(b,x,z)=>Math.max(b[0]-x,0,x-b[1])**2+Math.max(b[2]-z,0,z-b[3])**2;
      const steps=Math.max(1,Math.ceil(Math.hypot(x-p.x,z-p.z)/.2));
      for(let i=1;i<=steps;i++){
        const nx=p.x+(x-p.x)*i/steps,nz=p.z+(z-p.z)*i/steps;
        if(Math.abs(nx)>(sector%2?59:47)||Math.abs(nz)>(sector%2?47:59))return false;
        for(const b of solids){
          const gap=clearance(b,nx,nz);
          if(gap<playerRadius**2 && gap<clearance(b,p.x,p.z)-.000001)return false;
          if(gap<playerRadius**2 && clearance(b,p.x,p.z)>=playerRadius**2)return false;
        }
      }
      return true;
    };
    const ground=boxes.filter(b=>b[4]<2.05 && b[5]>.1);
    const walk=(x,z)=>Math.abs(x)<(sector%2?59:47)&&Math.abs(z)<(sector%2?47:59)&&!ground.some(([l,r,t,b])=>x>l-.65&&x<r+.65&&z>t-.65&&z<b+.65);
    g.classic=true;g.walk=walk;const visible=(x,z,tx,tz)=>walk(tx,tz) && !ground.some(([l,r,t,b])=>{
      let enter=0,leave=1;
      for(const [start,delta,min,max] of [[x,tx-x,l-.65,r+.65],[z,tz-z,t-.65,b+.65]]){
        if(!delta){if(start<=min || start>=max)return false;continue;}
        const a=(min-start)/delta,c=(max-start)/delta;
        enter=Math.max(enter,Math.min(a,c));leave=Math.min(leave,Math.max(a,c));
        if(enter>=leave)return false;
      }
      return true;
    });
    g.grid=navigator(-60,-60,61,61,2,walk,visible);return g;
  }
  // A body already touching another can move out, but cannot move through it.
  function crossesBody(fromX,fromZ,x,z,bodyX,bodyZ,radius){
    const vx=x-fromX,vz=z-fromZ,length=vx*vx+vz*vz;
    if(!length)return false;
    const dx=bodyX-fromX,dz=bodyZ-fromZ,along=dx*vx+dz*vz;
    if(along<=0)return false;
    const t=Math.min(1,along/length);
    const startDistance=dx*dx+dz*dz,endDistance=(bodyX-x)**2+(bodyZ-z)**2;
    if(startDistance<radius*radius && endDistance>=startDistance-.000001)return false;
    return (dx-t*vx)**2+(dz-t*vz)**2<radius*radius;
  }
  const playerRadius=.55;
  function bodyOverlap(a,b){
    const eyes={stand:2.05,crouch:1.1,prone:.4};
    const ay=a.y??2.05,by=b.y??2.05;
    return ay+.18>by-(eyes[b.stance]||2.05)+.05 && by+.18>ay-(eyes[a.stance]||2.05)+.05;
  }
  function playerMotion(room,p,x,z){
    const blocked=(nx,nz)=>{
      if(!room.survival || room.teamCollision!==false)for(const other of room.members.values())if(other!==p && other.hp>0 && bodyOverlap(p,other) && crossesBody(p.x,p.z,nx,nz,other.x,other.z,playerRadius*2))return true;
      for(const mob of room.survival?.mobs.values()||[])if(Math.abs((p.y||2)-1.5-(mob.y||0))<2.4 && crossesBody(p.x,p.z,nx,nz,mob.x,mob.z,playerRadius+.7))return true;
      return false;
    };
    const move=(nx,nz)=>{
      if(blocked(nx,nz))return;
      if(room.survival)acceptPosition(room.survival,p,nx,nz);
      else {p.x=nx;p.z=nz;}
    };
    move(x,p.z);move(p.x,z);
  }
  function acceptPosition(g,p,x,z){if(p.chopperAnchor&&(p.chopperUntil||0)>(p.combatTime||g.simTime||0)){p.x=p.chopperAnchor.x;p.z=p.chopperAnchor.z;return;}
    if(g.classic){if(g.playerPath(p,x,z)){p.x=x;p.z=z;}return;}
    // Permit sliding along a solid, but never skipping through a closed gate or cover.
    if(clearPath(p.x,p.z,x,z,g.area,playerRadius)){p.x=x;p.z=z;return;}
    if(clearPath(p.x,p.z,x,p.z,g.area,playerRadius))p.x=x;
    if(clearPath(p.x,p.z,p.x,z,g.area,playerRadius))p.z=z;
  }
  // Cache a distance field per destination cell; all enemies with the same clearance reuse it.
  function navigator(minX,minZ,width,height,spacing,walkable,segmentCheck){
    const cells=new Uint8Array(width*height),fields=new Map();
    const wx=i=>minX+(i%width)*spacing,wz=i=>minZ+Math.floor(i/width)*spacing;
    const key=(x,z)=>x<0||z<0||x>=width||z>=height?-1:z*width+x;
    for(let i=0;i<cells.length;i++)cells[i]=Number(walkable(wx(i),wz(i)));
    function visible(x,z,tx,tz){
      if(segmentCheck)return segmentCheck(x,z,tx,tz);
      const steps=Math.ceil(Math.hypot(tx-x,tz-z)/.5);
      for(let i=1;i<=steps;i++)if(!walkable(x+(tx-x)*i/steps,z+(tz-z)*i/steps))return false;
      return true;
    }
    // Cache passable grid edges as well as fields: moving the target should not repeat wall tests.
    const links=new Uint8Array(cells.length),offsets=[-1,1,-width,width];
    for(let i=0;i<cells.length;i++)if(cells[i]){
      for(const dir of [1,3]){
        const n=i+offsets[dir];
        if(cells[n] && visible(wx(i),wz(i),wx(n),wz(n))){
          links[i]|=1<<dir;links[n]|=1<<(dir-1);
        }
      }
    }
    function next(m,p){
      if(visible(m.x,m.z,p.x,p.z))return p;
      const px=Math.round((p.x-minX)/spacing),pz=Math.round((p.z-minZ)/spacing);
      let goal=-1,best=Infinity;
      for(let z=pz-2;z<=pz+2;z++)for(let x=px-2;x<=px+2;x++){
        const i=key(x,z),d=(p.x-wx(i))**2+(p.z-wz(i))**2;
        if(cells[i] && d<best){goal=i;best=d;}
      }
      if(goal<0)return m;
      let field=fields.get(goal);
      if(!field){
        field=new Int16Array(cells.length).fill(-1);
        const queue=new Int16Array(cells.length);let first=0,last=1;queue[0]=goal;field[goal]=0;
        while(first<last){
          const i=queue[first++];
          for(let dir=0;dir<4;dir++){
            const n=i+offsets[dir];
            if(!(links[i] & (1<<dir)) || field[n]!==-1)continue;
            field[n]=field[i]+1;queue[last++]=n;
          }
        }
        if(fields.size>=8)fields.clear();
        fields.set(goal,field);
      }
      const mx=Math.round((m.x-minX)/spacing),mz=Math.round((m.z-minZ)/spacing);
      let nearest=m,score=Infinity;
      for(let z=mz-1;z<=mz+1;z++)for(let x=mx-1;x<=mx+1;x++){
        const n=key(x,z);if(!(field[n]>=0))continue;
        const tx=wx(n),tz=wz(n),cost=field[n]+Math.hypot(tx-m.x,tz-m.z)*.7/spacing;
        if(cost<score && visible(m.x,m.z,tx,tz)){nearest={x:tx,z:tz};score=cost;}
      }
      return nearest;
    }
    return {next,visible};
  }
  function makeGrid(area){
    const grids=new Map();
    return {visible:(x,z,tx,tz)=>clearPath(x,z,tx,tz,area,.05),next(m,p){
      const from=blockAt(m.x),to=blockAt(p.x);
      let target=p;
      if(from!==to){
        const east=from<to,gate=gateFor(east?from+1:from);
        target={x:gate.x+(east?2:-2),z:gate.z};
      }
      if(clearPath(m.x,m.z,target.x,target.z,area))return target;
      if(!grids.has(from)){
        const left=from===4?-11:gateFor(from).x-3,width=from===4?63:blockWidth+7;
        if(grids.size>=10)grids.delete(grids.keys().next().value);
        grids.set(from,navigator(left,24,width,25,1,(x,z)=>passable(x,z,area),(x,z,tx,tz)=>clearPath(x,z,tx,tz,area)));
      }
      return grids.get(from).next(m,target);
    }};
  }
  function createSurvival(endless=false){
    const area=endless?6:1;
    return {area,endless,streetBoards:{},boards:windows.map(()=>endless?0:3),wave:1,remaining:waveCount(1),mobs:new Map(),drops:new Map(),nextId:1,nextSpawn:0,nextWave:0,grid:makeGrid(area),corpses:[],kills:[],killCursor:0};
  }
  const spinTime=3600,claimTime=30000;
  function boxHint(g,p,id,x,z){
    const offer=g.boxes?.[id],now=g.simTime||0;
    let text='抽取武器 · 750 金币';
    if(offer && now<offer.until){
      if(now<offer.ready)text='武器箱抽取中…';
      else if(offer.owner!==p.id)text='等待 '+offer.name+' 领取';
      else text='领取 '+(weapons.find(w=>w.id===offer.weapon)?.name||'武器')+' · '+Math.ceil((offer.until-now)/1000)+' 秒';
    }
    return {id,x,z,text};
  }
  function interaction(g,p){
    if(g.classic){
      if(g.evacAvailable&&Math.hypot(p.x-8,p.z-25)<3.5)return {id:'radio',text:'通讯站 · 申请限时清场撤离'};
      if(g.portal && distance(g.portal,p)<3)return {id:'extract',text:'通过传送门 · 全队存档撤离'};
      const next=g.area+(p.z<0?1:-1);
      if(Math.abs(p.x)<3&&Math.abs(Math.abs(p.z)-43)<3&&next>=1)return {id:'sector'+next,next,text:'第 '+next+' 街区 · '+(next>g.maxArea?(750+(g.area-1)*350)+' 金币':'已开放')};
      const near=i=>Math.hypot(p.x-g.stations[i][0],p.z-g.stations[i][1])<3.5;
      if(Math.hypot(p.x+48.8,p.z)<3 && (p.armorLevel||1)<3)return {id:'armor',text:'升级护甲 · '+((p.armorLevel||1)===1?1500:2000)+' 金币'};
      if(near(4))return {id:'workbench',text:'工作台 · 制造直升机射手'};
      if(near(1))return boxHint(g,p,'boxClassic'+g.area,...g.stations[1]);if(near(0))return {id:'ammo',text:'购买弹药 · 100 金币'};return null;
    }
    const gate=gateFor(g.area+1);
    if(gate && distance(p,gate)<3.3){
      const shortfall=gate.price-p.cash;
      return {id:gate.id,text:'开启'+zoneName(g.area+1)+' · '+gate.price+' 金币'+(shortfall>0?'（还差 '+shortfall+'）':'')};
    }
    const here=blockAt(p.x),entries=here===4?windows:street(here).windows;
    if(!g.endless)for(const w of entries){
      const i=w.index??windows.indexOf(w),hp=durability(g,i);
      if(w.area<=g.area && distance(p,w)<2.95)return {id:w.id,index:i,text:(hp<3?'修窗 · 3 秒':'窗口完好')+' · '+hp+'/3',repair:hp<3};
    }
    const props=here===4?cover:street(here).cover;
    const machine=props.find(o=>o.label && distance(p,o)<2.8);
    if(machine)return {id:machine.kind,text:machine.label};
    const box=props.find(o=>o.kind==='box');
    if(box && distance(p,box)<3)return boxHint(g,p,'box'+here,box.x,box.z);
    if(g.area>=2 && distance(p,props.find(o=>o.kind==='ammo')||props[1])<2.8)return {id:'ammo',text:'购买三份弹药 · 100 金币'};
    return null;
  }
  function reactToShot(g,p,now){
    const forwardX=-Math.sin(p.yaw),forwardZ=-Math.cos(p.yaw);
    for(const m of g.mobs.values()){
      if(m.entry!==null || now<m.nextDodge)continue;
      const dx=m.x-p.x,dz=m.z-p.z,along=dx*forwardX+dz*forwardZ;
      if(along<2 || along>22 || Math.abs(dx*forwardZ-dz*forwardX)>1.9 || !clearPath(m.x,m.z,p.x,p.z,g.area,.05))continue;
      m.nextDodge=now+1800+Math.random()*1700;
      if(Math.random()<.48){
        m.strafe=Math.random()<.5?-1:1;m.dodgeUntil=now+360;
      }
    }
  }
  function applyDamage(player,amount){
    if((player.chopperUntil||0)>(player.combatTime||Date.now()))return;
    const absorbed=Math.min(player.armor||0,amount);
    player.armor=(player.armor||0)-absorbed;
    player.hp=Math.max(0,player.hp-amount+absorbed);
  }
  function upgradeArmor(p){
    const level=p.armorLevel||1,cost=level===1?1500:2000;
    if(level>=3 || p.cash<cost)return;
    p.cash-=cost;p.armorLevel=level+1;p.armor=p.armorLevel*100;
  }
  function survivalInput(room,p,msg,now){
    const blastHits=[];p.combatTime=now;const g=room.survival;p.holding=msg.use===true;
    if(!p.hp || !p.holding)p.rescueId=null;
    if(!p.hp)return null;
    if(Array.isArray(msg.actions))for(const a of msg.actions){
      if(a?.type==='chopper-rocket'&&now<(p.chopperUntil||0)&&p.chopperRockets>0&&now-(p.lastRocket||0)>=750&&Number.isFinite(a.x)&&Number.isFinite(a.z)&&distance(p,a)<110){
        p.chopperRockets--;p.lastRocket=now;for(const m of g.mobs.values())if(distance(m,a)<6)blastHits.push({id:m.id,serverBlast:true});
      }
      if(a?.type==='chopper-buy'&&g.classic&&distance(p,{x:g.stations[4][0],z:g.stations[4][1]})<4&&(p.scrap||0)>=100&&now>=(p.chopperUntil||0)){p.scrap-=100;p.chopperUntil=now+30000;p.chopperRockets=3;p.chopperAnchor={x:p.x,y:p.y||2.05,z:p.z};}
    }
    let rescuing=p.rescueId && room.members.get(p.rescueId);
    if(!rescuing || rescuing.hp>0){
      rescuing=[...room.members.values()].filter(q=>q!==p && !q.hp && (!msg.rescueOnly || q.id===msg.rescueOnly) && distance(q,p)<3 &&
        (g.classic?g.grid.visible(q.x,q.z,p.x,p.z):clearPath(q.x,q.z,p.x,p.z,g.area,.05))).sort((a,b)=>distance(p,a)-distance(p,b))[0];
      p.rescueId=p.holding?rescuing?.id:null;
    }
    if(msg.interact && !rescuing){
      const use=interaction(g,p);
      if(use && use.id===msg.target){
        const gate=gateFor(g.area+1);
        if(use.id==='radio'){requestEvac(g,now);return null;}
        if(use.id==='extract' && g.marathon && g.portal){g.evacuated=true;room.phase='finished';return null;}
        if(g.classic && use.next){
          const fee=use.next>g.maxArea?750+(g.area-1)*350:0;
          if(p.cash>=fee){p.cash-=fee;const z=use.next>g.area?38:-38;g.maxArea=Math.max(g.maxArea,use.next);setClassicSector(g,use.next);
            let i=0;for(const member of room.members.values()){member.x=-3+2*i++;member.z=z;member.positionEpoch=(member.positionEpoch||0)+1;}
            for(const m of g.mobs.values())if(!g.walk(m.x,m.z)){m.x=0;m.z=-z;}
          }
        }else if(use.id===gate?.id && p.cash>=gate.price){p.cash-=gate.price;g.area++;g.grid=makeGrid(g.area);}
        else if(use.repair && !p.windowJob)p.windowJob={id:use.id,end:now+3000};
        else if(use.id==='boost' && p.cash>=1200 && (p.boost||0)<3){p.cash-=1200;p.boost=(p.boost||0)+1;}
        else if(use.id==='drink' && p.cash>=150 && p.hp<100){p.cash-=150;p.hp=100;}
        else if(use.id==='bench' && p.cash>=900 && now>=(p.nextDraw||0)){p.cash-=900;p.draws=(p.draws||0)+1;p.boxWeapon='laser';p.nextDraw=now+750;}
        else if(use.id==='armor')upgradeArmor(p);
        else if(use.id==='ammo' && p.cash>=100){p.cash-=100;p.ammoPacks+=3;}
        else if(use.id.startsWith('box')){
          g.boxes??={};const offer=g.boxes[use.id];
          if(offer && now<offer.until){
            if(offer.owner===p.id && now>=offer.ready){
              p.boxWeapon=offer.weapon;p.draws=(p.draws||0)+1;delete g.boxes[use.id];
            }
          }else if(p.cash>=750){
            const choices=weapons.filter(w=>w.id!=='glock' && w.id!==p.boxWeapon);
            const weapon=choices[Math.floor(Math.random()*choices.length)].id;
            p.cash-=750;
            g.boxes[use.id]={owner:p.id,name:p.name||'队员',weapon,x:use.x,z:use.z,area:g.classic?g.area:null,
              start:now,ready:now+spinTime,until:now+spinTime+claimTime};
          }
        }
      }
    }
    let impact=null;
    for(const hit of [...blastHits,...(Array.isArray(msg.hits)?msg.hits:[]).slice(0,16)]){
      const blast=blastHits.includes(hit);
      const m=g.mobs.get(hit?.id);
      const gun=weapons.find(w=>w.id===p.weapon&&(p.weapon===p.boxWeapon||['glock','usp','tec9'].includes(w.id)));
      if(hit.rocket&&(!m||now>=(p.chopperUntil||0)||!(p.chopperRockets>0)||now-(p.lastRocket||0)<700))continue;
      if(!m || !blast&&now-p.lastShot<(hit.melee?(hit.heavy?800:400):gun?gun.cooldown*850:120) || (hit.melee && distance(p,m)>4))continue;
      if(hit.rocket){p.chopperRockets--;p.lastRocket=now;}
      const air=now<(p.chopperUntil||0);
      const damage=air?(blast||hit.rocket?800:130):gun?(hit.head?gun.dmgHead:gun.dmgBody)*(gun.pellets?3:1):hit.head?70:35;
      p.lastShot=now;m.hp-=armouredDamage(m,hit.melee?(hit.heavy?100:50):damage*(1+.25*(p.boost||0)));
      const reward=m.hp<=0?100+Math.min(200,(g.wave-1)*10):hit.head?20:10;
      p.cash+=reward;
      impact={gun:hit.melee?null:hit.weapon,lethal:m.hp<=0,head:hit.head===true,reward,x:m.x,y:m.action==='climb'?1:(m.y||0),z:m.z};
      if(impact.lethal){
        g.mobs.delete(m.id);p.kills++;p.scrap=(p.scrap||0)+3;if(m.type==='dog')p.dogKills=(p.dogKills||0)+1;
        const creditedWeapon=weapons.some(w=>w.id===hit.weapon)?hit.weapon:p.weapon;
        g.kills.push({seq:++g.killCursor,mob:m.id,by:p.id,...(creditedWeapon?{weapon:creditedWeapon}:{}),name:p.name,x:m.x,y:m.action==='climb'?1:(m.y||0),z:m.z,yaw:m.yaw,head:impact.head});
        const death=g.kills[g.kills.length-1];
        g.corpses??=[];g.corpses.push({mob:death.mob,type:m.type,x:death.x,y:m.y||0,z:death.z,yaw:death.yaw,head:death.head,area:g.classic?g.area:null,seq:death.seq,time:now});
        if(g.kills.length>48)g.kills.shift();
        const med=Math.random()<.18;
        if(med || m.id%3===0){
          const w=m.entry===null?null:windowAt(m.entry);const x=w?w.x+w.nx*1.8:m.x,z=w?w.z+w.nz*1.8:m.z;
          g.drops.set(m.id,{id:m.id,x,z,med,expires:now+20000});
        }
      }
    }
    if(Array.isArray(msg.actions) && msg.actions.some(a=>a?.type==='shot'))reactToShot(g,p,now);
    return impact;
  }
  function spawn(g,now,alive){
    const id=g.nextId++,focus=blockAt(alive[(id-1)%alive.length].x);
    const choices=focus<=5?windows.map((w,i)=>i).filter(i=>windows[i].area<=g.area):[];
    for(let n=Math.max(5,focus-1);n<=Math.min(g.area,focus+1);n++)for(const w of street(n).windows)choices.push(w.index);
    const entry=choices[Math.floor((id-1)/alive.length)%choices.length],w=windowAt(entry),maxHp=70+Math.min(250,10*(g.wave-1));
    g.mobs.set(id,{id,type:!g.horde && g.wave>1 && id%5===0?'dog':'normal',entry,x:w.x-w.nx*1.35,z:w.z-w.nz*1.35,hp:maxHp,maxHp,yaw:Math.atan2(w.nx,w.nz),action:'breach',nextAttack:now+850,nextSprint:now+2300+Math.random()*4200,nextDodge:0});
    if(g.classic){const m=g.mobs.get(id);const edge=(id%2?1:-1)*44;m.x=id%4<2?edge:0;m.z=id%4<2?0:edge;m.entry=null;m.action='walk';}
    if(g.endless){
      const m=g.mobs.get(id);
      for(let j=0;j<48;j++){
        const a=j*2.4+id,r=8+(j%7),p=alive[(id-1)%alive.length],x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;
        if(passable(x,z,g.area,.75)){m.x=x;m.z=z;m.entry=null;m.action='walk';break;}
      }
      if(m.entry!==null){m.x=w.x+w.nx*1.65;m.z=w.z+w.nz*1.65;m.entry=null;m.action='walk';}
    }
    const spawned=g.mobs.get(id);
    if(g.classic&&!g.horde){
      spawned.type=dogWave(g.wave)&&!g.extraction?.active?'dog':g.extraction?.active&&g.remaining===1?'boss':g.extraction?.active&&g.remaining===3?'elite':g.wave%5===0&&!g.bossWave?'boss':g.wave>=8&&id%13===0?'elite':'normal';
      if(spawned.type==='boss'){spawned.maxHp=spawned.hp=2400+g.wave*180;}
      if(spawned.type==='elite'){spawned.maxHp=spawned.hp=400+g.wave*24;spawned.armor=300+g.wave*15;}
    }

    for(const other of g.mobs.values()){
      if(other!==spawned && Math.hypot(other.x-spawned.x,other.z-spawned.z)<1){
        g.mobs.delete(id);g.nextSpawn=now+250;return;
      }
    }
    if(spawned.type==='boss')g.bossWave=true;g.remaining--;g.nextSpawn=now+(g.extraction?.active?180:1000);
  }
  function enterWindow(g,m,dt,now){
    const w=windowAt(m.entry),depth=(m.x-w.x)*w.nx+(m.z-w.z)*w.nz,hp=durability(g,m.entry);
    if(hp>0 && depth<.15){
      m.action='breach';
      if(now>=m.nextAttack){(m.entry<10?g.boards:g.streetBoards)[m.entry]=hp-1;m.nextAttack=now+2300;}
      return;
    }
    const nx=m.x+w.nx*dt*2.8,nz=m.z+w.nz*dt*2.8;
    for(const other of g.mobs.values())if(other!==m && crossesBody(m.x,m.z,nx,nz,other.x,other.z,.95))return;
    m.action='climb';m.x=nx;m.z=nz;
    if(depth>=1.2){m.entry=null;m.action='walk';}
  }
  function dogWave(wave){return wave>=6&&(wave-6)%10===0;}
  function armouredDamage(m,amount){const absorbed=Math.min(m.armor||0,amount);m.armor=Math.max(0,(m.armor||0)-absorbed);return amount-absorbed;}
  function specialAttack(g,m,players,dt,now,hurt,walk){
    g.hazards??=[];if(!['boss','elite'].includes(m.type)||!players.length)return;
    const target=players.reduce((a,b)=>distance(a,m)<distance(b,m)?a:b),phase=m.type==='boss'?Math.min(2,Math.floor(3*(1-m.hp/m.maxHp))):0;
    if(now<(m.nextSpecial||0))return;
    const cycle=m.attackCycle||0;m.attackCycle=cycle+1;m.nextSpecial=now+(m.type==='elite'?5500:7000-phase*800);
    const hazard=(kind,x,z,r,delay,duration=150)=>{if(g.hazards.length<24)g.hazards.push({id:++g.hazardId|| (g.hazardId=1),owner:m.id,kind,x,z,y:m.y||0,r,start:now,fire:now+delay,end:now+delay+duration,angle:Math.atan2(target.z-m.z,target.x-m.x),nextHit:0});};
    if(m.type==='elite'){hazard('rocket',target.x,target.z,3.5,1400);return;}
    m.phase=phase+1;
    if(cycle%3===0){m.chargeUntil=now+2600;m.chargeStart=now+1100;const d=Math.max(.1,distance(m,target));m.chargeX=(target.x-m.x)/d;m.chargeZ=(target.z-m.z)/d;hazard('charge',m.x,m.z,3,1100,1500);}
    else if(cycle%3===1){for(let i=0;i<4+phase*2;i++){const a=i*2.4;hazard('bomb',target.x+Math.cos(a)*(i?5:0),target.z+Math.sin(a)*(i?5:0),4,1500+i*200);}}
    else hazard('laser',m.x,m.z,21,1600,4000);
  }
  function stepHazards(g,players,now,hurt,visible=()=>true){
    g.hazards??=[];
    for(const h of g.hazards){
      if(now<h.fire||now>h.end||now<h.nextHit||h.kind==='charge')continue;
      h.nextHit=now+(h.kind==='laser'?450:10000);
      const angle=h.angle+Math.min(1,(now-h.fire)/4000)*Math.PI*2;
      for(const p of players){if(p.hp<=0)continue;const dx=p.x-h.x,dz=p.z-h.z,d=Math.hypot(dx,dz),feet=(p.y||2)-(p.height||(p.stance==='prone'?.4:p.stance==='crouch'?1.1:2.05));
        const hit=h.kind==='laser'?d<h.r&&feet<(h.y||0)+.85&&Math.abs(dx*Math.sin(angle)-dz*Math.cos(angle))<.75&&dx*Math.cos(angle)+dz*Math.sin(angle)>0:d<h.r&&Math.abs(feet-(h.y||0))<3;
        if(hit&&visible(h,p))hurt(p,h.kind==='laser'?28:h.kind==='rocket'?45:50);
      }
    }
    g.hazards=g.hazards.filter(h=>now<h.end);
  }
  function requestEvac(g,now){
    if(!g.classic||g.marathon||g.horde||!g.evacAvailable||g.extraction?.active)return false;
    g.evacAvailable=false;g.extraction={active:true,until:now+100000,total:Math.min(160,55+g.wave*3),failed:false};
    g.remaining+=g.extraction.total;g.nextWave=0;g.nextSpawn=now;return true;
  }
  function waveCount(wave,horde=false){
    return (horde?6:1)*(4+2*(wave-1)+Math.max(0,wave-5));
  }
  function zombieSpeed(wave){
    return 1.25+Math.min(1.45,Math.max(0,wave-1)*.1);
  }
  function sprintChance(dist){return .05+.45*Math.min(1,Math.max(0,(dist-2)/18));}
  function chase(g,m,target,dt,now,players){
    const goal=g.classic?stairGoal(m,m.y||0,target,(target.y||2)-(target.stance==='prone'?.4:target.stance==='crouch'?1.1:2.05),g.area):target;
    let point=g.grid.next(m,goal),dx=point.x-m.x,dz=point.z-m.z;
    const length=Math.hypot(dx,dz);
    if(length>.001){dx/=length;dz/=length;}
    let speed=zombieSpeed(g.wave)*(m.type==='dog'?1.6:m.type==='boss'?.9:1);
    const dist=distance(m,target);
    if(now>=m.nextSprint){
      m.nextSprint=now+4300+Math.random()*3500;if(Math.random()<sprintChance(dist))m.sprintUntil=now+750+Math.random()*300;
    }
    m.action='walk';
    if(now>=m.chargeStart&&now<m.chargeUntil){dx=m.chargeX;dz=m.chargeZ;speed=10;m.action='charge';}
    if(now<m.dodgeUntil){
      const sx=-dz*m.strafe,sz=dx*m.strafe;
      if(clearPath(m.x,m.z,m.x+sx*.75,m.z+sz*.75,g.area)){
        dx=sx;dz=sz;speed*=1.25;m.action='dodge';
      }
    }else if(now<m.sprintUntil){m.action='sprint';speed*=1.4;}
    if(goal!==target || dist>1.15 || m.action==='dodge'){
      const step=Math.min(speed*dt,m.action==='dodge'?1:length);
      const tryStep=(vx,vz)=>{
        const x=m.x+vx*step,z=m.z+vz*step;
        const blocked=players.some(p=>p.hp>0 && Math.abs((p.y||2)-1.5-(m.y||0))<2.5 && crossesBody(m.x,m.z,x,z,p.x,p.z,playerRadius+.7)) ||
        [...g.mobs.values()].some(other=>other!==m && Math.abs((other.y||0)-(m.y||0))<1.5 && crossesBody(m.x,m.z,x,z,other.x,other.z,.95));
      if(blocked || !(g.classic?g.walk(x,z):passable(x,z,g.area)))return false;
        m.x=x;m.z=z;return true;
      };
      if(!tryStep(dx,dz)){
        const side=m.id%2?1:-1;
        if(!tryStep(dx*.5-dz*.86*side,dz*.5+dx*.86*side))tryStep(dx*.5+dz*.86*side,dz*.5-dx*.86*side);
      }
    }
    if(g.classic && ((m.y||0)>0 || (target.y||2)>4))m.y=stairFeet(m.x,m.z,m.y||0,g.area);
    m.yaw=Math.atan2(dx,dz);
    if(Math.abs((target.y||2)-1.5-(m.y||0))<2.4 && dist<1.8 && target.hp && now>=m.nextAttack && (g.classic?g.grid.visible(m.x,m.z,target.x,target.z):clearPath(m.x,m.z,target.x,target.z,g.area,.05))){
      const away=Math.max(.01,dist);
      const beforeX=target.x,beforeZ=target.z;
      acceptPosition(g,target,target.x+(target.x-m.x)/away*.85,target.z+(target.z-m.z)/away*.85);
      if(!target.bot && target.room){target.pendingPush??={x:0,z:0};target.pendingPush.x+=target.x-beforeX;target.pendingPush.z+=target.z-beforeZ;}
      m.lastStrike=now;applyDamage(target,now<m.chargeUntil?55:m.type==='boss'?40:20);m.nextAttack=now+1150;
      if(!target.hp){target.deaths++;target.holding=false;}
    }
  }
  function stepSurvival(room,dt,now){
    room.survival.simTime=now;
    const g=room.survival,players=[...room.members.values()];
    for(const [key,offer] of Object.entries(g.boxes||{}))if(now>=offer.until)delete g.boxes[key];
    for(const p of players)p.combatTime=now;
    const alive=players.filter(p=>p.hp>0);
    if(alive.length && g.remaining && now>=g.nextSpawn && g.mobs.size<(g.extraction?.active?32:g.horde?32:18))spawn(g,now,alive);
    for(const m of g.mobs.values()){
      if(!alive.length)break;
      if(m.entry!==null){enterWindow(g,m,dt,now);continue;}
      const target=alive.reduce((a,b)=>distance(a,m)<distance(b,m)?a:b);
      specialAttack(g,m,alive,dt,now,applyDamage,g.walk);chase(g,m,target,dt,now,players);
      if(!target.hp)alive.splice(alive.indexOf(target),1);
    }
    stepHazards(g,alive,now,(p,n)=>{const hp=p.hp;applyDamage(p,n);if(hp>0&&!p.hp)p.deaths++;},(h,p)=>g.classic?g.grid.visible(h.x,h.z,p.x,p.z):clearPath(h.x,h.z,p.x,p.z,g.area,.05));
    if(g.extraction?.active){
      if(!g.remaining&&!g.mobs.size){g.extraction.active=false;g.evacuated=true;room.phase='finished';return;}
      if(now>=g.extraction.until){g.extraction.active=false;g.extraction.failed=true;g.remaining=0;}
    }
    if(!alive.some(p=>p.hp>0)){room.phase='finished';return;}
    for(const p of players){
      if(p.windowJob){
        const use=p.hp && interaction(g,p);
        if(!use?.repair || use.id!==p.windowJob.id)p.windowJob=null;
        else if(now>=p.windowJob.end){if(use.index<10)g.boards[use.index]=3;else delete g.streetBoards[use.index];p.windowJob=null;}
      }
      const rescuer=alive.find(q=>q!==p && q.holding && now-q.seen<3000 && q.rescueId===p.id);
      p.progress=!p.hp && rescuer?(p.progress||0)+dt:0;
      if(p.progress>=2.5){p.hp=80;p.progress=0;}
    }
    for(const d of g.drops.values()){
      const collector=alive.find(p=>distance(p,d)<1.6 && (!d.med || p.hp<100));
      if(collector){if(d.med)collector.hp=Math.min(100,collector.hp+30);else collector.ammoPacks++;g.drops.delete(d.id);}
      else if(now>d.expires)g.drops.delete(d.id);
    }
    if(!g.remaining && !g.mobs.size){
      if(g.horde && g.wave>=50){g.cleared=true;room.phase='finished';return;}
      if(!g.nextWave){
        if(g.classic&&!g.horde&&!g.marathon&&g.wave%5===0&&!g.extraction?.failed)g.evacAvailable=true;
        if(g.marathon && g.wave%10===0){
          const p=alive.find(q=>!q.bot)||alive[0];g.portal={x:p.x,z:p.z,y:Math.max(0,(p.y||2)-2)};
        }
        g.nextWave=now+(g.portal||g.evacAvailable?30000:5000);
      }
      if(now>=g.nextWave){g.portal=null;g.evacAvailable=false;g.extraction=null;g.bossWave=false;g.wave++;if((g.wave-1)%(g.horde?3:5)===0)g.corpses=[];g.remaining=waveCount(g.wave,g.horde);g.nextWave=0;}
    }
  }
  function survivalSnapshot(g,afterKill=0,viewer={x:0}){
    const here=blockAt(viewer.x),streetBoards={};
    for(let n=Math.max(5,here-2);n<=Math.min(g.area,here+2);n++)for(const w of street(n).windows){
      if(g.streetBoards[w.index]!==undefined)streetBoards[w.index]=g.streetBoards[w.index];
    }
    return {hazards:g.hazards||[],extraction:g.extraction||null,evacAvailable:!!g.evacAvailable,chopperAnchor:viewer.chopperAnchor||null,scrap:viewer.scrap||0,chopperLeft:Math.max(0,(viewer.chopperUntil||0)-(g.simTime||0)),chopperRockets:viewer.chopperRockets||0,portal:g.portal||null,evacuated:!!g.evacuated,marathon:!!g.marathon,horde:!!g.horde,cleared:!!g.cleared,simTime:g.simTime||0,boxes:g.boxes||{},repairLeft:viewer.windowJob?Math.max(0,viewer.windowJob.end-g.simTime):0,classic:!!g.classic,stations:g.stations,maxArea:g.maxArea,wave:g.wave,remaining:g.remaining,area:g.area,endless:g.endless,boards:g.boards,streetBoards,
      corpses:(g.corpses||[]).filter(c=>c.seq>afterKill).map(c=>({...c,age:Math.max(0,(g.simTime||c.time)-c.time)})),
      kills:g.kills.filter(k=>k.seq>afterKill),killCursor:g.killCursor,
      mobs:[...g.mobs.values()].map(({id,type,x,y,z,hp,maxHp,armor,phase,yaw,action,lastStrike})=>({id,type,x,y,z,hp,maxHp,armor,phase,yaw,action,attackAge:lastStrike?Math.max(0,((g.simTime||lastStrike)-lastStrike)/1000):1})),drops:[...g.drops.values()]};
  }
  function stagingArea(mode,x,z){
    const s=Math.sign(x),near=-s*13;
    if(mode==='bomb')return {minX:-52,maxX:52,minZ:z>0?30:-42,maxZ:z>0?42:-34};
    return {minX:s>0?18:-34,maxX:s>0?34:-18,minZ:Math.min(-7.7,near-5),maxZ:Math.max(7.7,near+5)};
  }
  function stagingPanes(mode,x,z){
    if(mode==='bomb')return [[0,z>0?30:-34,104,.15]];
    const panes=[];
    for(const side of [-1,1])panes.push([side*18,0,.15,6],[side*34,0,.15,4],
      [side*19.5,-side*13,.15,8.5],[side*31.5,-side*13,.15,4.4],
      [side*45.6,side*12,.15,9],[side*58.4,side*12,.15,4.6]);
    return panes;
  }
  function canStage(mode,p,x,z){
    const a=stagingArea(mode,p.spawnX,p.spawnZ);
    if(x<a.minX+playerRadius || x>a.maxX-playerRadius || z<a.minZ+playerRadius || z>a.maxZ-playerRadius)return false;
    for(const [cx,cz,w,d] of stagingPanes(mode,p.spawnX,p.spawnZ)){
      const horizontal=w>d;
      const from=horizontal?p.z:p.x,to=horizontal?z:x,center=horizontal?cz:cx;
      const half=playerRadius+(horizontal?d:w)/2;
      if(Math.min(from,to)>center+half || Math.max(from,to)<center-half)continue;
      const t=to===from?1:Math.max(0,Math.min(1,(center-from)/(to-from)));
      const along=horizontal?p.x+(x-p.x)*t:p.z+(z-p.z)*t;
      if(Math.abs(along-(horizontal?cx:cz))<(horizontal?w:d)/2+playerRadius)return false;
    }
    return true;
  }
  return {dogWave,armouredDamage,specialAttack,stepHazards,requestEvac,setClassicSector,makeGrid,stagingArea,stagingPanes,canStage,playerRadius,bodyOverlap,stairGoal,stairFeet,crossesBody,playerMotion,waveCount,zombieSpeed,applyDamage,upgradeArmor,createClassic,sprintChance,weapons,zones,gates,windows,cover,walls,zoneName,gateFor,street,blockAt,durability,navigator,createSurvival,acceptPosition,interaction,survivalInput,stepSurvival,survivalSnapshot};
})();
if(typeof module!=='undefined')module.exports=YardSurvival;



