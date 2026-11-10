# 几何战争 III · 本地服务器版

**[中文](README.md) | [English](README.en.md)**

本目录沿用“单机版”的文件夹名，实际为**完整游戏的本地服务器发行版**：保留多人版的玩法及账号、好友、房间、匹配等功能，只是服务运行在自己的电脑，不连接官方公网游戏服务器。独自游玩可选择单人生存或人机对战；多人需连接同一台本地服务器。

必须先启动本地服务器再打开网页，不能直接双击 HTML，也不是纯静态 GitHub Pages 游戏。原联网项目文件没有改动。

## 启动

安装 **Node.js 24 LTS 或更新版本**。下载或克隆仓库，在仓库根目录运行：

```bash
node start.mjs
```

也可使用 `npm start`，Windows 可双击 `Start-Windows.bat`。无需 npm install 或单独数据库服务，模型、贴图和运行库均随包提供。

打开 **http://127.0.0.1:3080/**，保持终端运行；Ctrl+C 关闭。初次启动会创建空白本地数据库，账号和战绩与公网版不互通。注册本地账号可记录奖励、皮肤和熟练度，也可使用原有游客模式。

端口占用时关闭旧进程，或在 PowerShell 中执行 `$env:PORT=3081; node start.mjs`。

## 功能范围

- 经典生存、线性生存、无尽模式、排山倒海，包含武器箱、强化、工作台、撤离、Boss、尸潮和直升机射手等现有玩法。
- 1v1、自由乱斗、团队竞技、爆破与选图；保留人机及其难度设置。
- 登录注册、个人资料、头像、背景、勋章、熟练度、等级、战绩和排行榜。
- 好友、邀请、私信、在线状态、房间及匹配，由当前本地服务管理。
- 改枪、迷彩、自定义贴图、挂件、背包、武器检视、画面设置、键位与触屏界面。
- 管理页面 `/admin` 保留，但**不预置管理员密码**，使用前需自行配置。
- 当前本地版明确的外观差异：激光器采用 Quaternius 手枪模型，保留激光攻击与强化效果；第一人称不显示手臂。

“功能保留”不代表自带公网玩家或原服务器数据。模拟人数与匹配人机沿用原版逻辑，不应把显示数当作真实在线用户统计。匹配、排行榜和好友只作用于连接本服务器的玩家。

## 多人连接与语音

默认只监听 `127.0.0.1`，可在同一电脑的不同浏览器会话中测试多人。局域网多人可在 PowerShell 中启动：

```powershell
$env:HOST='0.0.0.0'
node start.mjs
```

其他设备打开 `http://服务器电脑的局域网IP:3080/`，并按需允许系统防火墙访问该端口。连接同一服务才会看到彼此的账号与房间。此设置不会自动开通公网访问。

浏览器麦克风、全屏及方向锁定受浏览器权限限制，局域网普通 HTTP 可能无法使用麦克风；跨设备语音应配置受信任 HTTPS，复杂网络可能还需 ICE/TURN。源码保留语音功能不等于这些浏览器和网络条件已自动配置。

## 存档与配置

- `data/` 自动创建，存放本地账号、资料图片、战绩及进度数据库，不上传 GitHub。
- 背包、画面、键位、自定义迷彩等还使用浏览器站点存储；切换地址、端口或浏览器可能形成不同的站点存档。
- 备份前关闭服务器，复制 `data/`；完整迁移还需保留浏览器站点数据。
- 管理员配置：自行保存一个密码的 SHA-256 十六进制摘要文件，设置环境变量 `GW_ADMIN_HASH` 为该文件绝对路径，再启动服务。仓库不附管理员密码或摘要文件。
- 数据库仅用于本地发行，未包含生产服务器账号、存档、密码或部署钥匙。

## 操作

WASD 移动、鼠标转向、左键攻击、右键瞄准、R 换弹、F 检视、E 互动、Shift 冲刺、空格跳跃、C 蹲下/滑铲、Z 趴下、滚轮切武器、Esc 暂停。设置中可调整键位。手机通过服务器地址进入，使用触屏按钮。

## 游戏截图

以下 21 张图片由制作者提供，来自联网版及开发过程，展示共同玩法。本地版已保留登录、好友、房间与匹配功能；截图里的公网域名、玩家数据、手臂或部分武器外观可能与当前本地版不同。图片按原样保留。

### 界面与设置

**主菜单**

![主菜单](docs/screenshots/main-menu.png)

**启动加载界面**

![启动加载界面](docs/screenshots/loading.png)

**个人资料与生涯战绩**

![个人资料与生涯战绩](docs/screenshots/profile.png)

**画质与光照调整**

![画质与光照调整](docs/screenshots/lighting.png)

**暂停菜单与准星设置**

![暂停菜单与准星设置](docs/screenshots/crosshair.png)

### 角色与枪械改造

**角色模型展示**

![角色模型展示](docs/screenshots/operator.png)

**枪械配件与模型预览**

![枪械配件与模型预览](docs/screenshots/attachments.png)

**迷彩选择与武器等级**

![迷彩选择与武器等级](docs/screenshots/camo.png)

**自定义图片迷彩**

![自定义图片迷彩](docs/screenshots/custom-camo.png)

**练习修改器与动态迷彩**

![练习修改器与动态迷彩](docs/screenshots/practice.png)

### 僵尸战斗

**瞄准与爆头反馈**

![瞄准与爆头反馈](docs/screenshots/aiming.png)

**街区尸潮战斗**

![街区尸潮战斗](docs/screenshots/street-combat.png)

**火箭武器战斗**

![火箭武器战斗](docs/screenshots/rocket-combat.png)

**爆炸与击杀反馈**

![爆炸与击杀反馈](docs/screenshots/explosion.png)

**近战武器**

![近战武器](docs/screenshots/melee.png)

**区域清空与近战战斗**

![区域清空与近战战斗](docs/screenshots/zombie-clear.png)

**战斗后的街区**

![战斗后的街区](docs/screenshots/battlefield.png)

**尸体保留效果**

![尸体保留效果](docs/screenshots/corpses.png)

### 通讯站撤离与空中支援

**通讯站撤离提示**

![通讯站撤离提示](docs/screenshots/extraction-station.png)

**撤离限时尸潮**

![撤离限时尸潮](docs/screenshots/extraction-horde.png)

**直升机射手视角**

![直升机射手视角](docs/screenshots/chopper.png)

## 发布到 GitHub

将本目录里的文件作为仓库根目录上传，保留 `models/`、`docs/`、全部脚本、说明文件及 `.gitignore`。不要上传 `data/`、密码摘要、部署凭据或上一层原联网工程。此项目需要 Node 本地服务，不能直接用 GitHub Pages 运行。

本次仅准备文件，没有创建远程仓库或推送。发布前请核对 [完整素材出处](THIRD_PARTY_NOTICES.md) 与 [逐文件资源清单](ASSET_INVENTORY.csv)。部分用户提供的模型及图片再分发权限仍待确认，项目没有擅自声明统一 MIT 或 CC0 许可。

## 开发与检查

```bash
node --test network.test.cjs encounters.test.mjs survival.test.mjs
```

`start.mjs` 配置本机启动和存档；`server.mjs` 处理账号、房间和同步；`Geometric Warfare3.html` 为游戏主体；`arena.js`、`match-rules.mjs`、`yard.js` 处理玩法；`models/` 为资源；`docs/screenshots/` 为展示截图。`SOURCE-SNAPSHOT.json` 保存复制前原文件哈希。

## 制作名单

一代、二代：greentailtohru。三代：GeorgeKy。名称：几何战争 III。发行版本：v1.0.0。
