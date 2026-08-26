//#region dsh-exit 宿主侧
/**
 * dsh-exit：把「退出 dsh 宿主并释放端口」暴露给浏览器的一个宿主服务。
 *
 * 远程面：`remote.dshExit.exit()` / `remote.dshExit.restart()`（Typert Remote）。
 * 调用后：先应答，再延迟 400ms 请求 dsh 完成有界清理并结束宿主进程；
 * 重启时由独立辅助进程等待旧宿主退出，再在 Windows Terminal 新前台窗口中
 * 用原启动参数拉起新宿主。
 * 不操作宿主终端窗口或系统托盘。
 */
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

const exitedSchema = {
	parse(value) {
		if (value !== true) throw new TypeError(`exit must return true, got ${String(value)}`);
		return value;
	}
};

/** Host 严格描述符。网关优先读 typert.local，避免生产环境 SRC 扫描 404。 */
const EXIT_INVOCATIONS = [
	{
		id: "@kesike/dsh-exit#dshExit/exit",
		service: "dshExit",
		namespace: "dshExit",
		method: "exit",
		invocation: { kind: "direct" },
		parameters: [],
		result: {
			mode: "strict",
			typeSymbol: "@kesike/dsh-exit/types#Exited",
			schema: exitedSchema
		},
		sourceLocation: { file: "@kesike/dsh-exit/lib/index.js", line: 1, column: 1 }
	},
	{
		id: "@kesike/dsh-exit#dshExit/restart",
		service: "dshExit",
		namespace: "dshExit",
		method: "restart",
		invocation: { kind: "direct" },
		parameters: [],
		result: {
			mode: "strict",
			typeSymbol: "@kesike/dsh-exit/types#Restarted",
			schema: exitedSchema
		},
		sourceLocation: { file: "@kesike/dsh-exit/lib/index.js", line: 1, column: 1 }
	}
];

const EXIT_TYPERT = {
	package: "@kesike/dsh-exit",
	face: "host",
	schemas: [],
	model: { services: [], events: [], objects: [] },
	invocations: EXIT_INVOCATIONS
};

/**
 * 模拟 TS 装饰器管线 `@Remote(method)`：`Remote` 返回标准方法装饰器，
 * 这里构造一个 addInitializer 立即以 `this` = instance 执行的装饰器上下文。
 */
function markRemoteMethod(instance, method) {
	const context = {
		private: false,
		static: false,
		name: method,
		addInitializer(fn) {
			fn.call(instance);
		}
	};
	Remote(method)(void 0, context);
}

/** 拒绝在 supervisor/Node IPC 管道下自脱离重启，避免新宿主失去外部生命周期管理。 */
function hasSupervisorChannel() {
	return process.env.NODE_CHANNEL_FD !== undefined ||
		process.env.NODE_UNIQUE_ID !== undefined ||
		typeof process.send === "function";
}

/** 等待 detached 子进程确认已成功创建；异步 error 不能由 spawn() 的 try/catch 捕获。 */
function waitForSpawn(child, label) {
	return new Promise((resolve, reject) => {
		child.once("spawn", resolve);
		child.once("error", (error) => {
			const detail = error instanceof Error ? error.message : String(error);
			reject(new Error(`${label} failed to start: ${detail}`, { cause: error }));
		});
	});
}

/** 解析 PowerShell 7，避免新 Windows Terminal tab 落回 Windows PowerShell 5。 */
function resolvePowerShell7() {
	const candidates = [
		process.env.ProgramW6432 === undefined ? undefined : join(process.env.ProgramW6432, "PowerShell", "7", "pwsh.exe"),
		process.env.ProgramFiles === undefined ? undefined : join(process.env.ProgramFiles, "PowerShell", "7", "pwsh.exe"),
		process.env.LOCALAPPDATA === undefined ? undefined : join(process.env.LOCALAPPDATA, "Programs", "PowerShell", "7", "pwsh.exe")
	].filter((candidate) => candidate !== undefined && existsSync(candidate));
	if (candidates[0] !== undefined) return candidates[0];
	const result = spawnSync("where.exe", ["pwsh.exe"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
		windowsHide: true
	});
	const executable = String(result.stdout || "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
	if (result.status === 0 && executable !== undefined) return executable;
	throw new Error("dsh-exit: PowerShell 7 (pwsh.exe) is not available");
}

/** 通过 PowerShell 7 解析当前用户安装的 Windows Terminal 本体。 */
function resolveWindowsTerminal(shellPath) {
	const command = [
		"$package = Get-AppxPackage -Name 'Microsoft.WindowsTerminal' | Sort-Object Version -Descending | Select-Object -First 1",
		"if ($null -eq $package) { exit 1 }",
		"$terminal = Join-Path $package.InstallLocation 'WindowsTerminal.exe'",
		"if (-not (Test-Path -LiteralPath $terminal)) { exit 1 }",
		"Write-Output $terminal"
	].join("; ");
	const result = spawnSync(shellPath, [
		"-NoLogo",
		"-NoProfile",
		"-NonInteractive",
		"-ExecutionPolicy",
		"Bypass",
		"-Command",
		command
	], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		windowsHide: true
	});
	const terminal = String(result.stdout || "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.endsWith("WindowsTerminal.exe") && existsSync(line));
	if (result.status === 0 && terminal !== undefined) return terminal;
	const detail = String(result.stderr || "").trim();
	throw new Error("dsh-exit: Windows Terminal (WindowsTerminal.exe) is not available" +
		(detail === "" ? "" : ": " + detail));
}

/** 将 Node 重启参数编码成 PowerShell 7 的 -EncodedCommand，避免 WT 二次解析。 */
function encodePowerShellLaunch(payload) {
	const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
	const nodeCommand = [
		`$payloadJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payloadBase64}'))`,
		"$payload = $payloadJson | ConvertFrom-Json",
		"Set-Location -LiteralPath $payload.cwd",
		"$arguments = @($payload.args)",
		"& $payload.execPath @arguments",
		"exit $LASTEXITCODE"
	].join("; ");
	const nodeCommandBase64 = Buffer.from(nodeCommand, "utf16le").toString("base64");
	return nodeCommandBase64;
}

const RESTART_HELPER = String.raw`
const { spawn } = require("node:child_process");
const payload = JSON.parse(process.argv[1]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isAlive = (pid) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// ESRCH means the PID is gone. Treat every other failure as alive so
		// permissions or transient Windows errors fail closed instead of
		// starting a second host while the old one may still own the port.
		return error?.code !== "ESRCH";
	}
};
(async () => {
	const deadline = Date.now() + payload.waitTimeoutMs;
	while (isAlive(payload.parentPid) && Date.now() < deadline) await sleep(200);
	if (isAlive(payload.parentPid)) process.exit(1);
	await sleep(250);
	const terminalLaunch = payload.launcher === "windows-terminal";
	const launchArgs = terminalLaunch ? [
		"-w",
		"new",
		"new-tab",
		"--title",
		payload.title,
		"--startingDirectory",
		payload.cwd,
		"--inheritEnvironment",
		payload.shellPath,
		"-NoLogo",
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-EncodedCommand",
		payload.commandBase64
	] : payload.args;
	const child = spawn(terminalLaunch ? payload.terminalPath : payload.execPath, launchArgs, {
		cwd: payload.cwd,
		env: process.env,
		detached: true,
		stdio: "ignore",
		windowsHide: terminalLaunch ? false : true
	});
	child.once("error", () => {
		process.exitCode = 1;
	});
	child.once("spawn", () => child.unref());
})().catch(() => {
	process.exitCode = 1;
});
`;

/** 启动一个与旧宿主生命周期解耦的 helper；Windows 下直接打开新的可见 Windows Terminal 窗口。 */
function scheduleRestart() {
	if (hasSupervisorChannel()) {
		throw new Error("dsh-exit: refusing self-restart under supervisor or Node IPC");
	}
	const launcher = process.platform === "win32" ? "windows-terminal" : "direct";
	const env = { ...process.env };
	delete env.NODE_CHANNEL_FD;
	delete env.NODE_UNIQUE_ID;
	const restartPayload = {
		parentPid: process.pid,
		execPath: process.execPath,
		args: [...process.execArgv, ...process.argv.slice(1)],
		cwd: process.cwd(),
	};
	const shellPath = launcher === "windows-terminal" ? resolvePowerShell7() : undefined;
	const terminalPath = launcher === "windows-terminal" ? resolveWindowsTerminal(shellPath) : undefined;
	const payload = JSON.stringify({
		...restartPayload,
		launcher,
		shellPath,
		terminalPath,
		commandBase64: launcher === "windows-terminal" ? encodePowerShellLaunch(restartPayload) : undefined,
		title: "dsh-web",
		waitTimeoutMs: 15_000
	});
	const helper = spawn(process.execPath, ["-e", RESTART_HELPER, payload], {
		env,
		detached: true,
		stdio: "ignore",
		windowsHide: true
	});
	const started = waitForSpawn(helper, "restart helper");
	helper.unref();
	return started;
}

class DshExitService extends TypertRemoteService {
	static name = "dshExit";
	static inject = ["typert"];
	closing = null;

	constructor(ctx) {
		super(ctx, "dshExit");
		markRemoteMethod(this, "exit");
		markRemoteMethod(this, "restart");
		const existing = ctx.get("typert");
		if (existing !== undefined) {
			existing.register(EXIT_TYPERT);
		} else {
			ctx.inject(["typert"], (typertCtx) => {
				typertCtx.typert.register(EXIT_TYPERT);
			});
		}
	}

	scheduleRestart() {
		return scheduleRestart();
	}

	/** 让远程响应先写回浏览器，再通过 dsh 的 appExit 执行有界资源清理。 */
	requestShutdown() {
		const appExit = this.ctx.get("appExit");
		setTimeout(() => {
			if (typeof appExit === "function") appExit(0);
			else process.exit(0);
		}, 400);
	}

	/** 结束宿主并释放端口；不触碰宿主终端窗口。 */
	async exit() {
		if (this.closing !== null) return true;
		this.closing = "exit";
		this.ctx.logger?.info?.("dsh-exit: exit requested from the web UI");
		this.requestShutdown();
		return true;
	}

	/** 清理并结束当前宿主，待旧进程退出后使用相同 Node 参数重新启动。 */
	async restart() {
		if (this.closing !== null) return true;
		this.closing = "restart";
		try {
			await this.scheduleRestart();
		} catch (error) {
			this.closing = null;
			this.ctx.logger?.error?.("dsh-exit: failed to schedule restart", error);
			throw error;
		}
		this.ctx.logger?.info?.("dsh-exit: restart requested from the web UI");
		this.requestShutdown();
		return true;
	}
}

function apply(ctx) {
	ctx.plugin(DshExitService);
}

export { apply };
//#endregion
