# dsh-exit

**English** | [简体中文](README.zh-CN.md)

A [DeepSeek Harness](https://npmjs.com/package/@deepseek-ai/dsh) (dsh) web plugin that adds a floating **Exit** button at the lower-right of the entire interface. It only exits dsh and releases the occupied port.

## What it does

- Adds a compact circular **Exit** button at the lower-right of the entire interface (error-red power icon — the same red the archive-manager uses for "delete session", icon: [Lucide `power`](https://lucide.dev/icons/power), ISC license).
- First click opens a confirmation dialog; confirming then:
  1. terminates the dsh host process — every port it holds (default `127.0.0.1:3080`) is released;
  2. leaves the host terminal window and browser tab open.

## Install (local, unpublished)

```sh
dsh plugin --profile web add "D:\Vibe-coding Projects\dsh\dsh-exit"
```

Then restart the profile. No dependencies — bare imports resolve through the dsh host loader.

## Structure

- `lib/index.js` — host side: registers the `dshExit` cordis service and its Typert Remote method `exit()` (served at `/api/dshExit/exit`).
- `lib/client.js` — browser bundle (self-contained, no imports): floating-position CSS, exit button, confirmation modal.
- `cordis.patch.yml` — profile patch layer inserting the plugin row.
