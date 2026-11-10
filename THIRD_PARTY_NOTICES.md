# 素材出处与许可证清单

本清单对应单机发行目录，核对日期：2026-11-10。它区分第三方 CC0 模型、程序生成内容、用户提供但未附授权的资源；不能将整个项目或全部模型统一标记为 CC0。

## 枪械模型

作者：**Quaternius**。本地许可：[Quaternius-License.txt](models/Quaternius-License.txt)，CC0 1.0。来源参考：[Ultimate Guns Pack](https://quaternius.com/packs/ultimategun.html)；[作者网站](https://quaternius.com/)。官网确认该套装为 CC0；现有项目保留模型文件与作者许可，但未保留逐文件下载记录。

运行时将 OBJ 网格转换后内嵌在 `models.js` 的 `gunModels` 中；原 OBJ/MTL 文件也随包保留。下表是 `installArmory` 中的实际映射，游戏名称是玩法标签，不代表模型精确复刻对应真实枪型。

| 游戏武器 | 原素材网格 |
|---|---|
| Glock 19 | Pistol_1 |
| USP | Pistol_2 |
| Tec-9 | Pistol_5 |
| MP5 | Bullpup_2 |
| M4A1 | AssaultRifle2_1 |
| AK-47 | AssaultRifle_2 |
| Remington 870 | Shotgun_1 |
| M82 | AssaultRifle2_2 |
| M249 | Bullpup_1 |
| MK14 | AssaultRifle_3 |
| AA-12 | Bullpup_3 |
| 激光器（单机版手枪外观） | Pistol_1 |
| 智能手枪 | Pistol_3 |

USP、Tec-9 的改型说明见 [pistol-variants-source.txt](models/pistol-variants-source.txt)。`AssaultRifle_1`、`Pistol_4` 等随包保留文件不一定在当前运行映射中使用。

## 特殊武器、配件与场景模型

| 用途 / 文件 | 作者及来源 | 许可及本地凭据 |
|---|---|---|
| `blaster-n.glb` 加特林；`blaster-a.glb` 火箭筒；`blaster-r.glb` 空中支援武器；`blaster-kit.png` | Kenney · [Blaster Kit](https://kenney.nl/assets/blaster-kit) | CC0；[许可](models/Kenney-blaster-kit-License.txt) |
| `attachments/scope-large-a.glb`、`scope-small.glb`、`silencer-larger.glb`、`silencer-small.glb`、配套 `Textures/colormap.png` | Kenney · Blaster Kit，缩放改作瞄具、激光器、手电及下挂外壳 | CC0；[许可](models/attachments/License.txt)、[来源记录](models/attachments/sources.txt) |
| `tool-axe.glb` 战术手斧；`workbench.glb` 工作台；`box-large.glb` 箱体；`survival-kit.png` | Kenney · [Survival Kit](https://kenney.nl/assets/survival-kit) | CC0；[许可](models/Kenney-survival-kit-License.txt) |
| `attachments/knife-base.glb` | Quaternius · [Knife / Poly Pizza](https://poly.pizza/m/0g8M6yYtE4) | CC0；[来源记录](models/attachments/knife-source.txt)；用于战斗刀及变形后的爪刀、蝴蝶刀，刀柄和部分结构由代码补建 |
| `maps/works/building-a.glb`、`building-d.glb`、`building-j.glb` 及配套贴图 | Kenney · [City Kit Industrial](https://kenney.nl/assets/city-kit-industrial) | CC0；[许可](models/maps/works/License.txt)、[来源记录](models/maps/sources.txt) |
| `maps/lanes/` 内垃圾箱、车库墙、窗墙模型及配套贴图 | Kenney · [Retro Urban Kit](https://kenney.nl/assets/retro-urban-kit) | CC0；[许可](models/maps/lanes/License.txt)、[来源记录](models/maps/sources.txt) |

Kenney 的归属依据随包原始许可和下载来源记录；本次在线抓取其页面未成功，不把无法读取的网页写作新增授权证据。原许可文件保持不变。上述包的官方来源链接供读者核对。

## 人物、僵尸等用户提供模型

以下为用户提供文件的转换或处理结果。文件名中的 `tripo_convert` 只能说明文件命名，不能据此认定作者、生成平台授权或 CC0 状态。

| 发行文件 | 已知交付出处 / 处理 | 当前授权状态 |
|---|---|---|
| `models/operator-character.glb` | 用户提供 `tripo_convert_27560907-511c-4484-86b3-d0d21332236c.zip`；FBX 转换为 GLB，项目代码驱动骨骼动作 | 原作者、素材网页与公开再分发许可待确认 |
| `models/first-person-arms.glb` | 用户提供 `tripo_convert_c72de99a-a560-4bba-a427-1b1f7b40b509.glb`；当前第一人称手臂已关闭，该文件仍随包保留 | 公开再分发许可待确认；未使用不等于可以任意分发 |
| `models/zombie.glb` | 用户提供 `low-poly zombie 3d model.zip`；项目接入动作、红眼与死亡表现 | 原作者及公开再分发许可待确认 |
| `models/attachments/hound.glb` | 用户提供 `tripo_convert_ed66a17e-feb4-4658-9b3a-f6492da70bb8.glb`；增加腿部动作 | 公开再分发许可待确认 |
| `models/attachments/raygun.glb` | 用户提供 `tripo_convert_f2cd71a1-4e13-4e06-ad90-be23937419c2.glb`；单机激光器已替换为 Quaternius 手枪，该旧文件仍保留 | 公开再分发许可待确认 |

`models/attachments/License.txt` **只覆盖来源于 Kenney 的配件**，不覆盖同目录中的上述用户提供模型或 Quaternius 刀模型。发布者需要补充这些模型的原作者及许可，或在公开发行前移除/替换不具备分发权限的文件。

## 程序生成与改造内容

- 主场景中的房屋墙体、屋顶、楼梯、道路、车辆、围栏和大量装饰通过 Three.js 几何体在代码中搭建；部分地图另行使用上文的 Kenney 模块。
- 地图布局、碰撞、互动机器、补给物、投掷物、挂件及其绳子等包含程序生成几何体；不是每个物体都来自独立下载的模型文件。
- 天空、墙面纹理、指示牌、武器迷彩、动态强化效果与部分图标由 Canvas、SVG、材质或 Shader 生成；不应虚构外部贴图库出处。
- 用户导入的自定义迷彩、头像和背景属于用户图片，不因进入游戏而变为 CC0。
- 地图/玩法参考其他游戏不构成官方资产授权；包内 CC0 建筑模块也不代表参考地图整体获得官方授权。
- 上述项目自身程序内容的源码授权需由权利人另行确认，本次没有擅自给全部项目代码添加许可证。

## 图片、截图与运行库

- `models/boot-logo.png`、`game-logo.png`：来自用户提供的游戏 Logo，原作者及使用授权由发布者确认。
- `models/menu-reference.png`：随旧项目保留的参考图片，未找到可核实的来源许可；不要将其当作 CC0。
- `models/menu-*.jpg`：旧版本场景截图资源，当前主菜单不使用截图背景；截图中模型仍分别遵循其来源许可。
- `docs/screenshots/*.png`：本次由用户提供的 21 张展示图；原样复制，保留文件哈希及原始文件名于 [截图清单](docs/screenshots/manifest.json)。截图含个人自定义图片及联网版元素，不推定其全部为 CC0。
- Three.js r128、GLTFLoader、PointerLockControls：Three.js contributors；[源码仓库](https://github.com/mrdoob/three.js/tree/r128)，MIT；[随包许可](models/Three-License.txt)。
- 音效由游戏内 Web Audio 代码合成；没有为不存在的独立音效文件声明素材来源。Emoji 由系统字体绘制，并非单独下载的图标包。

## 逐文件审计

[ASSET_INVENTORY.csv](ASSET_INVENTORY.csv) 列出 `models/` 中每一个模型、贴图、来源记录和库文件的归类、许可状态与 SHA-256；它同时包含保留但未必使用的资源。来源记录不完整的条目明确标为待确认，不以所在目录的许可证自动覆盖。
