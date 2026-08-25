<div align="center">

# dsh-exit

**为 DeepSeek Harness Web 界面提供一个明确、可确认的退出控制。**

[![dsh Web 插件](https://img.shields.io/badge/dsh-Web%20%E6%8F%92%E4%BB%B6-4f46e5?style=for-the-badge)](https://npmjs.com/package/@deepseek-ai/dsh)
[![npm](https://img.shields.io/npm/v/%40kesike%2Fdsh-exit?style=for-the-badge&label=npm)](https://www.npmjs.com/package/@kesike/dsh-exit)
[![平台](https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Web-0ea5e9?style=for-the-badge)](https://github.com/KeS1Ke/dsh-exit)
[![版本](https://img.shields.io/badge/%E7%89%88%E6%9C%AC-0.2.4-64748b?style=for-the-badge)](package.json)
[![依赖](https://img.shields.io/badge/%E8%BF%90%E8%A1%8C%E6%97%B6%E4%BE%9D%E8%B5%96-%E6%97%A0-16a34a?style=for-the-badge)](package.json)

**简体中文** | [English](https://github.com/KeS1Ke/dsh-exit/blob/main/README.md)

</div>
> [!IMPORTANT]
> 确认退出后会结束 dsh 宿主进程并释放其占用的端口；宿主终端窗口和当前浏览器标签页会被刻意保留。

## ✨ 功能概览

`dsh-exit` 在 dsh 设置面板中增加一个独立的**退出**栏目，并使用最高排序值，确保新安装的设置类插件仍排在它前面。

- 先弹出确认弹窗，确认前不会执行退出动作。
- **退出**栏目始终位于设置左侧导航的最底部。
- 确认后调用类型化的 `dshExit/exit` Remote 方法。
- 先返回调用应答，再等待短暂窗口结束宿主进程。
- 释放该进程占用的全部端口；设置页会显示当前 dsh Web 的真实主机和端口。
- 保留宿主终端窗口和浏览器标签页，方便后续操作。
- 使用 dsh 现有设计令牌与 Lucide `power` 电源图标。

## 🎬 GitHub 展示区

下面展示退出流程，以及插件在 dsh 设置面板中的实际效果。

<p align="center">
  <img src="https://raw.githubusercontent.com/KeS1Ke/dsh-exit/main/docs/dsh-exit-landscape.webp" alt="由 Archify 生成的横版 dsh-exit 动态流程图" width="720">
</p>

<p align="center">
  <video controls muted loop playsinline width="720" poster="https://raw.githubusercontent.com/KeS1Ke/dsh-exit/main/docs/dsh-exit-landscape.webp">
    <source src="https://raw.githubusercontent.com/KeS1Ke/dsh-exit/main/docs/dsh-exit-landscape.mp4" type="video/mp4">
    <source src="https://raw.githubusercontent.com/KeS1Ke/dsh-exit/main/docs/dsh-exit-landscape.webm" type="video/webm">
    <a href="https://github.com/KeS1Ke/dsh-exit/blob/main/docs/dsh-exit-landscape.mp4">下载退出流程视频</a>
  </video>
</p>

## 📸 真实 dsh 界面

下图是已经安装 `dsh-exit` 的真实 dsh 设置界面；红色的**退出**就是设置左侧列表底部的插件导航项。

<p align="center">
  <img src="https://raw.githubusercontent.com/KeS1Ke/dsh-exit/main/docs/dsh-exit-real.png" alt="运行中的 dsh Web 设置界面与底部的 dsh-exit 退出栏目" width="720">
</p>

## 🧱 npm 包内容

| 层次 | 文件 | 职责 |
| --- | --- | --- |
| 宿主侧 | [`lib/index.js`](lib/index.js) | 注册 `dshExit` Cordis 服务和类型化 `exit()` Remote 方法。 |
| 客户端 | [`lib/client.js`](lib/client.js) | 自包含浏览器 bundle：设置栏目、退出按钮、样式、弹窗、键盘交互和 Remote 挂载。 |
| Bundle 补丁 | [`cordis.patch.yml`](cordis.patch.yml) | 向 dsh profile 插入插件行。 |
| 包元数据 | [`package.json`](package.json) | 声明宿主入口、Web 客户端和 Bundle 补丁。 |

npm 包聚焦于运行所需的源码和包元数据，下面同时提供截图和流程源文件：

| 展示素材 | 位置 |
| --- | --- |
| 动画 WebP | [`docs/dsh-exit-landscape.webp`](https://github.com/KeS1Ke/dsh-exit/blob/main/docs/dsh-exit-landscape.webp) |
| MP4 / WebM 视频 | [`docs/dsh-exit-landscape.mp4`](https://github.com/KeS1Ke/dsh-exit/blob/main/docs/dsh-exit-landscape.mp4) · [`docs/dsh-exit-landscape.webm`](https://github.com/KeS1Ke/dsh-exit/blob/main/docs/dsh-exit-landscape.webm) |
| Archify 源文件 | [`docs/exit-flow-landscape.html`](https://github.com/KeS1Ke/dsh-exit/blob/main/docs/exit-flow-landscape.html) · [`docs/exit-flow-landscape.workflow.json`](https://github.com/KeS1Ke/dsh-exit/blob/main/docs/exit-flow-landscape.workflow.json) |
| 真实界面截图 | [`docs/dsh-exit-real.png`](https://github.com/KeS1Ke/dsh-exit/blob/main/docs/dsh-exit-real.png) |


## 🚀 从 npm 安装

直接将 npm 包加入 dsh 的 Web profile：

```sh
dsh plugin --profile web add @kesike/dsh-exit
```

安装后重启 profile。裸导入由 dsh 宿主加载器解析，因此本包不声明运行时依赖。更新或移除：

```sh
dsh plugin --profile web update @kesike/dsh-exit
dsh plugin --profile web remove @kesike/dsh-exit
```

## 🖥️ 交互说明

| 操作 | 结果 |
| --- | --- |
| 点击设置左侧列表底部的红色**退出**栏目 | 打开退出栏目和确认操作。 |
| 点击**取消**、按 `Esc` 或点击弹窗外部 | 关闭弹窗，不改变宿主状态。 |
| 点击**确认退出** | 禁用重复操作并调用宿主 Remote 方法。 |
| Remote 调用失败 | 恢复控件并显示行内错误信息。 |
| Remote 调用成功 | 关闭弹窗，宿主随后退出。 |

## 🔌 Remote 接口

宿主侧公开一个严格校验、无参数的 Remote 方法：

```text
namespace: dshExit
method:    exit
result:    true
gateway:   /api/dshExit/exit
```

dsh 客户端网关成功时返回标准 envelope：`{ ok: true, value: true }`。服务端通过 `exiting` 标志防止重复调用，并在应答有机会完成后延迟执行 `process.exit(0)`。

## 🧪 开发检查

在项目根目录执行轻量语法检查：

```sh
node --check lib/index.js
node --check lib/client.js
```

## 🗺️ 快速信息

- **目标：** DeepSeek Harness Web profile
- **安装方式：** npm 包
- **界面位置：** 设置左侧导航的最后一栏
- **执行动作：** 结束 dsh 宿主进程
- **运行端口：** 从设置页当前 dsh Web 地址动态读取
- **仓库主题：** `dsh` · `deepseek-harness` · `dsh-plugin` · `plugin` · `javascript` · `web`

电源图标来自 [Lucide](https://lucide.dev/icons/power)，遵循其 ISC 许可使用。

<div align="center">

<sub>界面小而专注，退出动作明确且可预期。</sub>

</div>

