const headDay=()=>new Date(Date.now()+28800000).toISOString().slice(0,10);
function localHeads(){
  try{const data=JSON.parse(localStorage.getItem('gwHeads'));if(data?.day===headDay())return data;}catch{}
  return {day:headDay(),total:0};
}
async function refreshHeads(){
  const label=document.getElementById('dailyHeads'),data=localHeads();if(!label)return;
  if(location.protocol==='file:'){label.textContent='本机今日已有 '+data.total+' 只僵尸被斩下头颅';return;}
  try{
    if(data.total && GWAccount.user){
      let device=localStorage.getItem('gwDevice');
      if(!device){device='xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx'.replace(/x/g,()=>Math.floor(Math.random()*16).toString(16));localStorage.setItem('gwDevice',device);}
      await fetch('./solo-stat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,device}),keepalive:true});
    }
    const response=await fetch('./stats',{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!response.ok)throw Error();
    const stats=await response.json();const champion=document.getElementById('dailyChampion');if(champion)champion.textContent=stats.champion?'今日击杀王：'+stats.champion.name:'今日击杀王：暂无';label.textContent='今日已有 '+stats.count+' 只僵尸被斩下头颅';
  }catch{label.textContent='今日全服爆头数暂时不可用';}
}
function recordSoloHead(){GWRun.head();}
function commitSoloHead(amount=1){
  if(!GWAccount.user)return;
  const data=localHeads();if(!label)return;data.total+=amount;localStorage.setItem('gwHeads',JSON.stringify(data));refreshHeads();
}
window.addEventListener('gw-ready',refreshHeads,{once:true});
setInterval(()=>{if(document.body.dataset.screen==='home'&&!document.hidden)refreshHeads();},15000);

let activityBusy=false;
async function refreshActivity(){
  if(activityBusy || document.hidden || location.protocol==='file:')return;
  activityBusy=true;
  const label=document.getElementById('onlinePlayers');if(!label){activityBusy=false;return;}
  try{
    let device=localStorage.getItem('gw-online-device');
    if(!device){device=crypto.randomUUID();localStorage.setItem('gw-online-device',device);}
    const response=await fetch('./activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device,mode:document.body.dataset.screen==='game'?(window.gwActivity||'home'):(window.gwActivity==='matching'?'matching':'home')}),cache:'no-store',signal:AbortSignal.timeout(6000)});
    if(!response.ok)throw Error('activity');
    const data=await response.json();label.textContent='当前有 '+data.count+' 人正在玩这个游戏';
    const labels={'僵尸':data.zombies+' 人正在暴打僵尸或者被僵尸暴打',PVP:data.pvp+' 人正在战斗'};
    for(const card of document.querySelectorAll('[data-modecard]')){
      let count=card.querySelector('.modePopulation');if(!count){count=document.createElement('span');count.className='modePopulation';card.querySelector('strong').append(count);}
      count.textContent=labels[card.dataset.modecard]||'';
    }
    const match=document.querySelector('#matchDuel strong');if(!match)return;let count=match.querySelector('.modePopulation');
    if(!count){count=document.createElement('span');count.className='modePopulation';match.append(count);}
    count.textContent=data.matching+' 人正在匹配 · '+(Math.floor(Math.max(0,Number(data.duelPlaying)||0)/2)*2)+' 人正在开战';
  }catch{label.textContent='在线人数暂时不可用';}finally{activityBusy=false;}
}
window.addEventListener('gw-ready',refreshActivity,{once:true});
setInterval(refreshActivity,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshActivity();});
const GWNews=(()=>{
  const version='2026-11-studio-network-3',key='gw-news-dismissed';
  const sheet=document.createElement('dialog');sheet.id='updateNews';sheet.setAttribute('aria-labelledby','newsTitle');
  sheet.innerHTML=`<header><small>几何战争 III · 更新公告</small><h2 id="newsTitle">加载、画面与战斗体验更新</h2><p>从加载卡住修复至本次僵尸玩法更新</p></header><section>
<h3>本次军械与联机更新</h3><ul><li>1v1 使用新的有序快照缓冲与平滑位置纠正，减少延迟波动引起的来回跳动。</li><li>设置分为画面、准星、操作、声音等标签；亮度、日光/月光、环境光、曝光、对比度和饱和度独立调节。</li><li>改枪台支持旋转与缩放、配件连线、五款挂件、天空/大地/收藏品/特殊迷彩及本机自定义图片迷彩。</li><li>枪械增加 30 级等级与熟练度展示，满级解锁黄金迷彩；支持本机武器命名。</li><li>背包区分多人对战与僵尸初始装备。加入 USP、Tec-9 风格化 CC0 低模手枪；僵尸初始背包仅选择手枪与刀。</li><li>调整主菜单卡牌视觉，优化个人资料设置排布及手机切换武器的重复材质开销。</li></ul><h3>加载与性能</h3><ul><li>修复账号、社交请求超时导致进度条卡住；非关键模型加载失败可使用备用模型进入游戏。</li><li>模型资源支持浏览器缓存。新增低、中、高画质与场景亮度设置，默认日光调柔和，亮度可在设置中调整为 40%–160%，高画质调整光照。</li><li>优化第七波及后续波次卡顿，减少临时动态灯光和资源残留；低画质清理尸体，持续低帧率时自动减少尸体并降低画质。</li></ul>
<h3>菜单与手机操作</h3><ul><li>主菜单及子模式卡牌加入实际场景截图和在线状态；匹配卡牌显示匹配、对战人数。</li><li>手机虚拟按键、个人信息、小地图和武器栏等 HUD 支持移动、缩放、保存；可导入及分享布局码。</li><li>新增趴下键；奔跑时趴下可向前飞扑。优化手部、武器瞄准位置及武器箱、饮料机等设施细节。</li></ul>
<h3>准星、回放与联机</h3><ul><li>可设置准星样式、大小、间距、粗细、颜色、透明度、圆点、描边、动态扩散及显示开关。</li><li>观战与击杀回放展示对应玩家的准星；回放加入开火动作和左下角个人资料卡片，好友卡片展示资料背景。</li><li>优化玩家位置插值、短时网络中断恢复，以及团队竞技观战时的手、武器与昵称显示。</li><li>有可匹配的系统玩家时可快速安排对局，优先寻找真人；其余情况按随机等待规则安排人机，最长 45 秒。</li></ul>
<h3>僵尸武器与敌人</h3><ul><li>强化武器加入绿、蓝、紫三档流动迷彩。</li><li>经典模式第 6、16、26、36……波为狗波，提升猎犬移动速度。</li><li>加入需先碎甲的装甲火箭精英；强化 Boss，展示三段血条，加入冲撞、多点轰炸与旋转激光，攻击前有预警，激光可跳跃躲避。</li></ul>
<h3>限时撤离与直升机</h3><ul><li>经典模式每完成 5 波可前往通讯站申请撤离，100 秒内清理区域敌人；尸潮后段出现装甲精英和 Boss。清场成功撤离，超时失败后继续生存。</li><li>工作台可用 100 废料购买直升机射手：30 秒空中视角、无限机炮、3 发范围伤害火箭；生效期间操作者无敌。</li><li>联机僵尸击杀可获得废料，购买、弹量与无敌状态由共享规则判定。</li></ul>
</section><footer><button data-ok>我知道了</button><button data-never>不再提醒</button></footer>`;
  const style=document.createElement('style');style.textContent='#updateNews{box-sizing:border-box;width:min(740px,94vw);max-height:90dvh;padding:0;color:#edf1f4;background:#20262b;border:1px solid #748089;border-top:3px solid #edc572;border-radius:8px}#updateNews::backdrop{background:#080d13db}#updateNews header{padding:18px 22px 8px}#updateNews h2{margin:6px 0;font-size:24px}#updateNews header p{color:#bfc8ce;font-size:13px}#updateNews section{max-height:55dvh;overflow:auto;padding:0 22px 12px;overscroll-behavior:contain;line-height:1.7;font-size:14px}#updateNews h3{color:#efce87;font-size:16px;margin-bottom:5px}#updateNews ul{padding-left:21px;margin-top:4px}#updateNews footer{display:flex;justify-content:flex-end;gap:10px;padding:12px 22px;border-top:1px solid #4c565c}#updateNews button{font:700 14px sans-serif;padding:10px 18px;border:1px solid #7b858a;border-radius:4px;background:#303a42;color:#fff}#updateNews [data-ok]{background:#edc572;color:#15191d}@media(max-height:500px){#updateNews header{padding:8px 16px 0}#updateNews h2{font-size:18px}#updateNews header p{margin:4px 0}#updateNews section{max-height:49dvh;padding:0 16px;font-size:12px}#updateNews h3{font-size:14px}#updateNews footer{padding:7px 16px}}';
  document.head.append(style);document.body.append(sheet);
  sheet.querySelector('[data-ok]').onclick=()=>sheet.close();sheet.querySelector('[data-never]').onclick=()=>{try{localStorage.setItem(key,version);}catch{}sheet.close();};
  function open(){if(!sheet.open)sheet.showModal();}
  return {open};
})();
