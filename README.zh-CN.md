<div align="center">

# dsh-start&exit

**为 DeepSeek Harness Web 界面提供明确的启动、退出与重新启动控制。**

[![dsh Web 插件](https://img.shields.io/badge/dsh-Web%20%E6%8F%92%E4%BB%B6-4f46e5?style=for-the-badge)](https://npmjs.com/package/@deepseek-ai/dsh)
[![npm](https://img.shields.io/npm/v/%40kesike%2Fdsh-start-and-exit?style=for-the-badge&label=npm)](https://www.npmjs.com/package/@kesike/dsh-start-and-exit)
[![平台](https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Web%20%2B%20Windows-0ea5e9?style=for-the-badge)](https://github.com/KeS1Ke/dsh-start-and-exit)
[![版本](https://img.shields.io/badge/%E7%89%88%E6%9C%AC-0.2.7-64748b?style=for-the-badge)](package.json)
[![依赖](https://img.shields.io/badge/%E8%BF%90%E8%A1%8C%E6%97%B6%E4%BE%9D%E8%B5%96-%E6%97%A0-16a34a?style=for-the-badge)](package.json)

**简体中文** | [English](https://github.com/KeS1Ke/dsh-start-and-exit/blob/main/README.md)

</div>
> [!IMPORTANT]
> 退出和重新启动都必须显式确认。Windows 启动器只接受绑定到 `127.0.0.1` 的 dsh Web 服务，并保留可从任务栏恢复的终端进程。

## ✨ 功能概览

`dsh-start&exit` 在 dsh 设置面板中增加一个独立的**启动 / 退出 / 重新启动**栏目，并使用最高排序值，确保新安装的设置类插件仍排在它前面。

- 先弹出确认弹窗，确认前不会执行退出动作。
- **启动 / 退出 / 重新启动**栏目始终位于设置左侧导航的最底部。
- 启动操作通过可见的 Windows Terminal/PowerShell 启动 dsh Web profile。
- 独立 Windows 前台启动器会在本机 WebUI 就绪后最小化终端，而不是隐藏或转为后台。
- 确认后调用类型化的 `dshExit/exit` Remote 方法。
- 先返回调用应答，再等待短暂窗口结束宿主进程。
- 释放该进程占用的全部端口；设置页会显示当前 dsh Web 的真实主机和端口。
- 保留宿主终端窗口和浏览器标签页，方便后续操作。
- 使用 dsh 现有设计令牌与 Lucide `power` 电源图标。

## 🎬 GitHub 展示区

下面展示退出流程，以及插件在 dsh 设置面板中的实际效果。

<p align="center">
  <img src="https://raw.githubusercontent.com/KeS1Ke/dsh-start-and-exit/main/docs/dsh-exit-landscape.webp" alt="由 Archify 生成的横版 dsh-start&exit 动态流程图" width="720">
</p>

<p align="center">
  <video controls muted loop playsinline width="720" poster="https://raw.githubusercontent.com/KeS1Ke/dsh-start-and-exit/main/docs/dsh-exit-landscape.webp">
    <source src="https://raw.githubusercontent.com/KeS1Ke/dsh-start-and-exit/main/docs/dsh-exit-landscape.mp4" type="video/mp4">
    <source src="https://raw.githubusercontent.com/KeS1Ke/dsh-start-and-exit/main/docs/dsh-exit-landscape.webm" type="video/webm">
    <a href="https://github.com/KeS1Ke/dsh-start-and-exit/blob/main/docs/dsh-exit-landscape.mp4">下载 dsh-start&exit 流程视频</a>
  </video>
</p>

## 📸 真实 dsh 界面

下图是已经安装 `dsh-start&exit` 的真实 dsh 设置界面；红色的**退出**就是设置左侧列表底部的插件导航项。

<p align="center">
  <img src="https://raw.githubusercontent.com/KeS1Ke/dsh-start-and-exit/main/docs/dsh-exit-real.png" alt="运行中的 dsh Web 设置界面与底部的 dsh-start&exit 控制项" width="720">
</p>

## 🧱 仓库结构

| 层次 | 文件 | 职责 |
| --- | --- | --- |
| 宿主侧 | [`lib/index.js`](lib/index.js) | 注册 `dshStartExit` Cordis 服务和类型化的启动、退出、重新启动 Remote 方法。 |
| 客户端 | [`lib/client.js`](lib/client.js) | 自包含浏览器 bundle：设置栏目、启动/退出/重新启动控件、样式、弹窗、键盘交互和 Remote 挂载。 |
| Bundle 补丁 | [`cordis.patch.yml`](cordis.patch.yml) | 向 dsh profile 插入插件行。 |
| Windows 启动器 | [`scripts/launch-dsh-foreground.ps1`](scripts/launch-dsh-foreground.ps1) | 在可见的前台 PowerShell 终端启动 Web profile，并在本机 WebUI 就绪后最小化终端。 |
| 启动图标 | [`assets/dsh-launcher-hq.ico`](assets/dsh-launcher-hq.ico) | 用于 Windows 桌面快捷方式的 DeepSeek 多尺寸图标。 |
| 包元数据 | [`package.json`](package.json) | 声明宿主入口、Web 客户端和 Bundle 补丁。 |

npm 包聚焦于运行所需的源码和包元数据；Windows 启动器与图标属于仓库工具，下面同时提供截图和流程源文件：

| 展示素材 | 位置 |
| --- | --- |
| 动画 WebP | [`docs/dsh-exit-landscape.webp`](https://github.com/KeS1Ke/dsh-start-and-exit/blob/main/docs/dsh-exit-landscape.webp) |
| MP4 / WebM 视频 | [`docs/dsh-exit-landscape.mp4`](https://github.com/KeS1Ke/dsh-start-and-exit/blob/main/docs/dsh-exit-landscape.mp4) · [`docs/dsh-exit-landscape.webm`](https://github.com/KeS1Ke/dsh-start-and-exit/blob/main/docs/dsh-exit-landscape.webm) |
| Archify 源文件 | [`docs/exit-flow-landscape.html`](https://github.com/KeS1Ke/dsh-start-and-exit/blob/main/docs/exit-flow-landscape.html) · [`docs/exit-flow-landscape.workflow.json`](https://github.com/KeS1Ke/dsh-start-and-exit/blob/main/docs/exit-flow-landscape.workflow.json) |
| 真实界面截图 | [`docs/dsh-exit-real.png`](https://github.com/KeS1Ke/dsh-start-and-exit/blob/main/docs/dsh-exit-real.png) |


## 🚀 从 npm 安装

直接将 npm 包加入 dsh 的 Web profile：

```sh
dsh plugin --profile web add @kesike/dsh-start-and-exit
```

安装后重启 profile。裸导入由 dsh 宿主加载器解析，因此本包不声明运行时依赖。更新或移除：

```sh
dsh plugin --profile web update @kesike/dsh-start-and-exit
dsh plugin --profile web remove @kesike/dsh-start-and-exit
```

> 包已改名：已有的 `@kesike/dsh-exit` 或 `@kesike/dsh-start-exit` 安装应先移除，再安装 `@kesike/dsh-start-and-exit`。

## 🖥️ Windows 前台启动器

仓库提供可选的 Windows 桌面启动器：

```text
PowerShell 7 → scripts/launch-dsh-foreground.ps1 → dsh --profile web
```

启动时终端保持可见并承载 dsh 进程；当 `http://127.0.0.1:3080/` 返回成功响应后，脚本调用 Windows `SW_MINIMIZE` 最小化同一个终端。终端只是最小化，不会隐藏、脱离或转为后台，仍可从任务栏恢复。

如果端口存在非回环监听，脚本会拒绝启动或继续运行。不要提交个人 `.lnk`、profile 目录、日志、npm 缓存或生成的压缩包；快捷方式应在本机创建，并将图标指向 `assets/dsh-launcher-hq.ico`。

## 🖥️ 交互说明

| 操作 | 结果 |
| --- | --- |
| 点击**启动** | 通过宿主启动器启动 dsh Web profile。 |
| 点击设置左侧列表底部的红色**退出**栏目 | 打开退出栏目和确认操作。 |
| 点击**重新启动** | 当前宿主关闭后，拉起新的前台 dsh 终端。 |
| 点击**取消**、按 `Esc` 或点击弹窗外部 | 关闭弹窗，不改变宿主状态。 |
| 点击**确认退出** | 禁用重复操作并调用宿主 Remote 方法。 |
| Remote 调用失败 | 恢复控件并显示行内错误信息。 |
| Remote 调用成功 | 关闭弹窗，宿主随后退出。 |

## 🔌 Remote 接口

宿主侧公开一个严格校验、无参数的 Remote 方法：

```text
namespace: dshStartExit
methods:   start · exit · restart
result:    true
gateways:  /api/dshStartExit/start · /api/dshStartExit/exit · /api/dshStartExit/restart
```

dsh 客户端网关成功时返回标准 envelope：`{ ok: true, value: true }`。启动、退出和重新启动均有重复调用保护；退出前先返回响应，并保持 Web 服务只绑定本机回环地址。

## 🧪 开发检查

在项目根目录执行轻量语法检查：

```sh
node --check lib/index.js
node --check lib/client.js
npm test
```

## 🗺️ 快速信息

- **目标：** DeepSeek Harness Web profile
- **安装方式：** npm 包
- **界面位置：** 设置左侧导航的最后一栏，并提供可选 Windows 启动器
- **执行动作：** 启动 · 退出 · 重新启动
- **运行绑定：** 仅本机回环地址（`127.0.0.1`）
- **仓库主题：** `dsh` · `deepseek-harness` · `dsh-plugin` · `dsh-start-and-exit` · `plugin` · `javascript` · `web` · `windows` · `powershell`

电源图标来自 [Lucide](https://lucide.dev/icons/power)，遵循其 ISC 许可使用。

<div align="center">

<sub>一个小而明确的界面，安全地启动、退出和重新启动 dsh。</sub>

</div>
