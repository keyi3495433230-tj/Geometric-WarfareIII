// A peer uses one ordered, buffered timeline. Normal packet jitter never resets its position.
const GWNet=(()=>{
  class Buffer{
    constructor(){this.frames=[];this.interval=55;this.jitter=0;this.cursor=null;this.arrival=null;}
    reset(t,p,now){this.frames=[{t,p:{...p}}];this.cursor=t;this.arrival=now;this.interval=55;this.jitter=0;}
    push(t,p,now){const last=this.frames.at(-1);if(!Number.isFinite(t)||!Object.values(p).every(Number.isFinite)||last&&t<=last.t)return false;
      if(last&&last.t<=0&&t>0){this.reset(t,p,now);return true;}
      if(last){const gap=t-last.t;this.jitter+=(Math.abs(gap-this.interval)-this.jitter)*.12;this.interval+=(Math.min(1500,gap)-this.interval)*.15;}
      this.frames.push({t,p:{...p}});if(this.frames.length>64)this.frames.shift();this.arrival=now;if(this.cursor===null)this.cursor=t;return true;}
    delay(rtt){return Math.min(900,Math.max(100,this.interval*1.5+this.jitter*2+rtt*.35));}
    sample(now,dt,rtt){const frames=this.frames,last=frames.at(-1);if(!last)return null;
      const delay=this.delay(rtt),target=Math.min(last.t,last.t-delay+Math.min(delay,Math.max(0,now-this.arrival)));
      this.cursor=Math.min(last.t,this.cursor+Math.min(Math.max(0,target-this.cursor),Math.max(0,dt)*(target-this.cursor>delay+250?3000:1250)));
      while(frames.length>2&&frames[1].t<=this.cursor)frames.shift();const a=frames[0],b=frames[1]||a,f=Math.max(0,Math.min(1,(this.cursor-a.t)/Math.max(1,b.t-a.t)));
      const result={x:a.p.x+(b.p.x-a.p.x)*f,y:a.p.y+(b.p.y-a.p.y)*f,z:a.p.z+(b.p.z-a.p.z)*f};if(Number.isFinite(a.p.yaw)&&Number.isFinite(b.p.yaw))result.yaw=a.p.yaw+Math.atan2(Math.sin(b.p.yaw-a.p.yaw),Math.cos(b.p.yaw-a.p.yaw))*f;if(Number.isFinite(a.p.pitch)&&Number.isFinite(b.p.pitch))result.pitch=a.p.pitch+(b.p.pitch-a.p.pitch)*f;return result;}
  }
  return {Buffer};
})();
if(typeof module!=='undefined')module.exports=GWNet;
