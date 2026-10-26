# dsh-gba

**在 DeepSeek Harness 里玩 Game Boy Advance。**

这是一个 Harness 插件包：在主栏里放一台 GBA 模拟器——245 款免费社区游戏的在线商城、自己的卡带、
电池存档与即时存档，画面则待在一个悬浮窗里，你继续干活时它也一直在屏幕上。

[English](README.md) · 简体中文

## 为什么做这个

模拟器通常独占一个标签页，想玩就得放下手上的事。这台住在 Harness **里面**：面板就是浏览器和设置
界面，画面本身待在所有栏上方的一个小窗口里。`Ctrl+Q` 一键收起，再按一次原样回来，游戏始终没停。

笨功夫也做了：存档存在 Host 上而不是 `localStorage`，按键可改且跨浏览器生效，换设备打开还是同一
份进度。

## 功能

- **245 款游戏的在线商城。** 商城页签读的是 [Homebrew Hub](https://github.com/gbadev-org/games)
  社区数据库：Game Jam 获奖作品、完整 RPG、解谜、技术演示——每款都有封面、作者、日期、类型和简介。
  点「下载并游玩」即取一次卡带、缓存到本地并启动。
- **自己的卡带。** 可以直接添加 `.gba` 文件，也可以填宿主机目录，再从扫描结果里挑着导入。
  卡带按 CRC32 对照 no-intro 全集识别，正版 dump 会自动显示正确标题和封面。
- **分组。** 自己建页签（「RPG」「双人」随便叫），把游戏打进去。
- **悬浮播放器。** 拖画面或拖标题栏都能移动，右下角可缩放，可调不透明度；鼠标移上去才显示界面。
- **可改键。** 默认 `WASD` 移动、`J`/`K` 动作；点键帽后按新键即可。每个按键支持两个键，配置跟着账号走。
- **存档丢不了。** 电池存档（`.sav`）、五个即时存档位、一份滚动自动快照，都存在 `$DSH_HOME` 下，
  刷新、重启、换会话都还在。
- **看着像 Harness。** 全部用主题 token 和 Dialog/Button 原语搭，没有硬编码颜色，没有另一套设计语言。

<!-- 截图待补；三张图的规格见 docs/README.md。 -->

## 安装

这是一个**持久化插件包**：装进某个 profile，重启后仍在，该 profile 的所有会话都能用。

### 从插件市场

如果某个市场索引收录了 `dsh-gba`，打开 **插件 → Discover**，添加索引地址，在列表里安装。

### 从文件夹

1. 把插件包解压到一个长期保留的位置。
2. **插件 → 添加**，选中那个目录——或者直接在会话里让助手装：

   > 用 plugin_manager 的 install_bundle 安装这个目录：`D:\path\to\dsh-gba`

3. 左侧边栏「插件」「自动化任务」下面会出现 **GBA 游戏**。没出现就刷新页面。

### 环境要求

| 项 | 值 |
| --- | --- |
| Harness | 0.2.x，带 Web GUI 的 profile |
| 磁盘 | ≈3 MB |
| 网络 | 仅商城与封面首次加载时需要 |
| 编译 | 不需要，无 `npm install`，无编译器 |

## 怎么用

1. 左侧点 **GBA 游戏**。
2. 切到 **在线商城**，挑一款，点 **下载并游玩**。
3. 游戏在右下角窗口里跑起来，鼠标移上去显示工具栏。

**全部**页签列出你已经拥有的一切。点一行进详情页：简介、大号开始按钮、键位表、所属分组。

### 快捷键

| 按键 | GBA 按键 |
| --- | --- |
| `W` `A` `S` `D` | 十字键 |
| `K` | A |
| `J` | B |
| `U` | L |
| `I` | R |
| `Enter` | Start |
| `Shift` | Select |
| `Ctrl+Alt+G` | 显示 / 隐藏悬浮窗 |
| `Ctrl+Q` | 老板键：收起，再按恢复 |

先点一下画面：模拟器只在画面有焦点时接收按键，这样输入框照常能用。除最后两条外都能改键，在详情页
或悬浮窗的齿轮面板里都行。

`Ctrl+Q` 没法走 Harness 的快捷键服务（那个组合被保留了），所以插件自己监听。`Ctrl+Alt+G` 是注册
进去的，可以在 Harness 快捷键设置里改。

## 数据在哪

所有需要留存的东西都在 `$DSH_HOME/storages/dsh-gba/`（默认 `~/.dsh`），不在包里：

```
$DSH_HOME/storages/dsh-gba/
├── settings.json            音量、快进、ROM 目录、按键映射、分组、窗口不透明度
├── covers/<slug>.png        从公共 libretro 镜像缓存的封面
├── store/                   商城封面与已下载卡带的缓存
├── games/                   未配置 ROM 目录时使用的内置投放目录
└── roms/<id>/
    ├── rom.gba              导入时的卡带本体
    ├── rom.json             名称、标题、CRC32、游戏码、来源
    ├── save.sav             电池存档（SRAM / Flash）
    └── states/
        ├── 0.ss … 4.ss      五个手动存档位
        └── 9.ss             滚动自动快照
```

停用插件不会动这个目录，重新启用后游戏库和存档都还在。想从零开始就手动删掉它。

## 实现

| 半 | 文件 | 职责 |
| --- | --- | --- |
| Host | `index.js` | 提供 mGBA 资源、商城索引与封面；按需下载商城卡带；扫描 ROM 目录；承载 `/dsh-gba/api` 下游戏库、ROM、存档、即时存档与设置的接口。 |
| Client | `client.js` | 注册 `gba-games` 主面板、侧边栏入口、`shell.overlay` 悬浮窗与快捷键；持有唯一的 mGBA 实例和它的 canvas。 |

一个浏览器标签页只跑一个模拟器，悬浮窗是它唯一的屏幕，所以缩放、刷新、老板键收起之后都不需要重新
同步：引擎只维护一个 `<canvas>`，按优先级在持有者之间搬移。

Host 的每条路由都过一遍与 Web GUI 其余部分相同的 Connection 信任校验和会话 Cookie，跨站页面读不到
游戏库（外部 `Origin` 返回 `403`，没有 Cookie 返回 `401`）。商城下载只会去 `store.json` 里列出的
路径，调用方无法指定任意 URL；导入也只接受配置目录内的文件。

### 为什么核心锁在 mGBA 1.1.1

WebAssembly 移植的 2.x 是多线程的，需要 `SharedArrayBuffer`，而浏览器只对跨源隔离的页面
（`COOP: same-origin` + `COEP: require-corp`）放行。Harness 的 Web 服务不发这些头，插件也没法往
index 响应里加。1.1.1（mGBA 0.11 核心）是最后一个单线程构建，能在普通源下运行——这也是嵌入窗口
能成立的前提。

## 关于 ROM

**本包不携带任何 ROM 数据。** `store.json` 只记录卡带在上游的位置；`catalog.json` 是 no-intro 元
数据表，只用来识别你手上已有的卡带。只有你主动安装时，`.gba` 才会落到磁盘上。

添加自己的文件是你自己的责任：dump 自己拥有的卡带在多数司法辖区是合法的，下载别人分享的 ROM 不是。

## 开发

```bash
node test-host.mjs     # 在 stub Cordis 上下文上挂载 Host 半，逐条断言路由
```

测试覆盖空库、资源、商城索引、ROM 导入与 CRC 识别、电池存档、即时存档、游玩时长、设置（窗口状态、
不透明度、按键映射、分组）、忽略非卡带的目录扫描、按扫描路径导入、路径守卫、体积守卫、删除，以及
鉴权栅栏。不联网，跑完不留残留。

面板另外在 React 18 探针里验证过：页签、列表行、详情页各区块、键位表、几个弹窗和悬浮窗都有 DOM 断言。

## 致谢

- [mGBA](https://mgba.io/)——endrift 与贡献者，MPL-2.0
- [Homebrew Hub](https://github.com/gbadev-org/games)——商城背后的社区游戏数据库
- [libretro-database](https://github.com/libretro/libretro-database)——catalog.json 源自其 no-intro DAT
- [thumbnails.libretro.com](https://thumbnails.libretro.com/)——封面

细节见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 许可

本插件自身代码使用 [MIT](LICENSE)。模拟器核心与第三方数据保留各自的许可。
