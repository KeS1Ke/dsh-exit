# dsh-exit

[English](README.md) | **简体中文**

一个 [DeepSeek Harness](https://npmjs.com/package/@deepseek-ai/dsh)（dsh）web 插件：在整个界面右下角增加一个悬浮**退出**按钮，只负责退出 dsh 并释放端口。

## 功能

- 在整个界面右下角放置紧凑的圆形**退出**按钮（红色电源图标——与 archive-manager"删除会话"同一个红，图标用 [Lucide `power`](https://lucide.dev/icons/power)，ISC 免费许可）。
- 首次点击弹出确认弹窗；再次确认后：
  1. 结束 dsh 宿主进程——其占用的所有端口（默认 `127.0.0.1:3080`）随之释放；
  2. 保留宿主终端窗口和当前浏览器标签页，不执行额外关闭操作。

## 本地安装（未发布）

```sh
dsh plugin --profile web add "D:\Vibe-coding Projects\dsh\dsh-exit"
```

安装后手动重启 profile。无依赖声明——裸导入经 dsh 宿主加载器解析。

## 结构

- `lib/index.js` —— 宿主侧：注册 `dshExit` cordis 服务与 Typert Remote 方法 `exit()`（网关路径 `/api/dshExit/exit`）。
- `lib/client.js` —— 浏览器 bundle（自包含、零导入）：悬浮定位 CSS、退出按钮、确认弹窗。
- `cordis.patch.yml` —— profile 补丁层，插入插件行。
