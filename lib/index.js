//#region dsh-start&exit 宿主侧
/**
 * dsh-start&exit：把 dsh 的启动、退出和重启操作暴露给浏览器的宿主服务。
 *
 * 远程面：`remote.dshStartExit.start()` / `remote.dshStartExit.exit()` /
 * `remote.dshStartExit.restart()`（Typert Remote）。
 * 调用后：先应答，再延迟 400ms 请求 dsh 完成有界清理并结束宿主进程；
 * 启动/重启时由独立辅助进程等待旧宿主退出，再在 Windows Terminal 新前台窗口中
 * 用 PowerShell 7 拉起 dsh。
 * 不操作宿主终端窗口或系统托盘。
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

const LOOPBACK_HOST = "127.0.0.1";

const exitedSchema = {
	parse(value) {
		if (value !== true) throw new TypeError(`exit must return true, got ${String(value)}`);
		return value;
	}
};

/** Host 严格描述符。网关优先读 typert.local，避免生产环境 SRC 扫描 404。 */
const START_EXIT_INVOCATIONS = [
	{
		id: "@kesike/dsh-start-and-exit#dshStartExit/start",
		service: "dshStartExit",
		namespace: "dshStartExit",
		method: "start",
		invocation: { kind: "direct" },
		parameters: [],
		result: {
			mode: "strict",
			typeSymbol: "@kesike/dsh-start-and-exit/types#Started",
			schema: exitedSchema
		},
		sourceLocation: { file: "@kesike/dsh-start-and-exit/lib/index.js", line: 1, column: 1 }
	},
	{
		id: "@kesike/dsh-start-and-exit#dshStartExit/exit",
		service: "dshStartExit",
		namespace: "dshStartExit",
		method: "exit",
		invocation: { kind: "direct" },
		parameters: [],
		result: {
			mode: "strict",
			typeSymbol: "@kesike/dsh-start-and-exit/types#Exited",
			schema: exitedSchema
		},
		sourceLocation: { file: "@kesike/dsh-start-and-exit/lib/index.js", line: 1, column: 1 }
	},
	{
		id: "@kesike/dsh-start-and-exit#dshStartExit/restart",
		service: "dshStartExit",
		namespace: "dshStartExit",
		method: "restart",
		invocation: { kind: "direct" },
		parameters: [],
		result: {
			mode: "strict",
			typeSymbol: "@kesike/dsh-start-and-exit/types#Restarted",
			schema: exitedSchema
		},
		sourceLocation: { file: "@kesike/dsh-start-and-exit/lib/index.js", line: 1, column: 1 }
	}
];

const START_EXIT_TYPERT = {
	package: "@kesike/dsh-start-and-exit",
	face: "host",
	schemas: [],
	model: { services: [], events: [], objects: [] },
	invocations: START_EXIT_INVOCATIONS
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

/** 等待 detached 子进程启动并接收完 helper Payload；异步 error 不能由 spawn() 的 try/catch 捕获。 */
function waitForSpawn(child, label, payload) {
	return new Promise((resolve, reject) => {
		let settled = false;
		const fail = (error) => {
			if (settled) return;
			settled = true;
			const detail = error instanceof Error ? error.message : String(error);
			reject(new Error(`${label} failed to start: ${detail}`, { cause: error }));
		};
		child.once("error", fail);
		child.once("spawn", () => {
			if (payload === undefined) {
				settled = true;
				resolve();
				return;
			}
			if (child.stdin === null) {
				fail(new Error(`${label} has no stdin for its Payload`));
				return;
			}
			child.stdin.once("error", fail);
			child.stdin.end(payload, "utf8", () => {
				if (settled) return;
				settled = true;
				resolve();
			});
		});
	});
}

function resolveSystemWhere() {
	const roots = [process.env.SystemRoot, process.env.WINDIR, "C:\\Windows"]
		.filter((root, index, all) => typeof root === "string" && root.trim() !== "" && all.indexOf(root) === index);
	const wherePath = roots
		.map((root) => join(root, "System32", "where.exe"))
		.find((candidate) => isAbsolute(candidate) && existsSync(candidate));
	if (wherePath !== undefined) return wherePath;
	throw new Error("dsh-start&exit: system where.exe is not available");
}

/** 解析 PowerShell 7，避免新 Windows Terminal tab 落回 Windows PowerShell 5。 */
function resolvePowerShell7() {
	const candidates = [
		process.env.ProgramW6432 === undefined ? undefined : join(process.env.ProgramW6432, "PowerShell", "7", "pwsh.exe"),
		process.env.ProgramFiles === undefined ? undefined : join(process.env.ProgramFiles, "PowerShell", "7", "pwsh.exe"),
		process.env.LOCALAPPDATA === undefined ? undefined : join(process.env.LOCALAPPDATA, "Programs", "PowerShell", "7", "pwsh.exe")
	].filter((candidate) => candidate !== undefined && existsSync(candidate));
	if (candidates[0] !== undefined) return candidates[0];
	const result = spawnSync(resolveSystemWhere(), ["pwsh.exe"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
		windowsHide: true
	});
	const executable = String(result.stdout || "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line !== "" && isAbsolute(line) && /(?:^|[\\/])pwsh\.exe$/iu.test(line) && existsSync(line));
	if (result.status === 0 && executable !== undefined) return executable;
	throw new Error("dsh-start&exit: PowerShell 7 (pwsh.exe) is not available");
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
	throw new Error("dsh-start&exit: Windows Terminal (WindowsTerminal.exe) is not available" +
		(detail === "" ? "" : ": " + detail));
}

/** 创建只在本次启动链路中使用的临时 Payload 文件。 */
function createLaunchPayloadFile(payload) {
	const directory = mkdtempSync(join(tmpdir(), "dsh-start-and-exit-"));
	const payloadPath = join(directory, "payload.json");
	try {
		const filePayload = {
			...payload,
			environment: Object.entries(payload.env ?? {}).map(([name, value]) => ({ name, value }))
		};
		delete filePayload.env;
		writeFileSync(payloadPath, JSON.stringify(filePayload), { encoding: "utf8", flag: "wx", mode: 0o600 });
		return payloadPath;
	} catch (error) {
		rmSync(directory, { recursive: true, force: true });
		throw error;
	}
}

function removeLaunchPayloadFile(payloadPath) {
	if (payloadPath === undefined) return;
	try {
		rmSync(dirname(payloadPath), { recursive: true, force: true });
	} catch {
		// Cleanup is best effort after a failed launch.
	}
}

/**
 * 将临时 Payload 路径编码成 PowerShell 7 的 -EncodedCommand，避免 WT 二次解析。
 * 完整启动参数和环境变量留在临时文件中，不进入 helper/PowerShell 命令行。
 */
function encodePowerShellLaunch(payloadPath) {
	if (!isAbsolute(payloadPath)) throw new TypeError("dsh-start&exit: launch Payload path must be absolute");
	const escapedPayloadPath = payloadPath.replaceAll("'", "''");
	const launchCommand = [
		`$payloadPath = '${escapedPayloadPath}'`,
		"try { $payload = Get-Content -LiteralPath $payloadPath -Raw | ConvertFrom-Json } finally { Remove-Item -LiteralPath $payloadPath -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath (Split-Path -Parent $payloadPath) -Force -ErrorAction SilentlyContinue }",
		"$payload.environment | ForEach-Object { [Environment]::SetEnvironmentVariable([string]$_.name, [string]$_.value, 'Process') }",
		"[Environment]::SetEnvironmentVariable('NODE_CHANNEL_FD', $null, 'Process')",
		"[Environment]::SetEnvironmentVariable('NODE_UNIQUE_ID', $null, 'Process')",
		"Set-Location -LiteralPath $payload.cwd",
		"$arguments = @($payload.args)",
		"if ($payload.kind -eq 'node') { & $payload.execPath @arguments } else { & $payload.commandPath @arguments }",
		"exit $LASTEXITCODE"
	].join("; ");
	return Buffer.from(launchCommand, "utf16le").toString("base64");
}

/** 在 PowerShell 7 中解析 dsh.ps1，允许用户通过 DSH_START_COMMAND 覆盖路径。 */
function resolveDshLauncher(shellPath) {
	const configured = process.env.DSH_START_COMMAND;
	if (configured !== undefined && configured.trim() !== "") {
		const value = configured.trim();
		if (value.includes("\\") || value.includes("/") || value.endsWith(".ps1") || value.endsWith(".cmd") || value.endsWith(".exe")) {
			if (!existsSync(value)) throw new Error(`dsh-start&exit: configured dsh launcher is not available: ${value}`);
		}
		return value;
	}
	if (process.platform !== "win32") {
		const result = spawnSync("which", ["dsh"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"]
		});
		const executable = String(result.stdout || "")
			.split(/\r?\n/)
			.map((line) => line.trim())
			.find(Boolean);
		if (result.status === 0 && executable !== undefined) return executable;
		throw new Error("dsh-start&exit: dsh command is not available");
	}
	const command = [
		"$command = Get-Command dsh -ErrorAction Stop | Select-Object -First 1",
		"$path = $command.Source",
		"if ([string]::IsNullOrWhiteSpace($path)) { $path = $command.Path }",
		"if ([string]::IsNullOrWhiteSpace($path)) { exit 1 }",
		"Write-Output $path"
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
	const executable = String(result.stdout || "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line !== "" && existsSync(line));
	if (result.status === 0 && executable !== undefined) return executable;
	const detail = String(result.stderr || "").trim();
	throw new Error("dsh-start&exit: dsh command (dsh.ps1) is not available" +
		(detail === "" ? "" : ": " + detail));
}

function cleanLaunchEnvironment() {
	const env = {};
	const names = new Map();
	for (const [name, value] of Object.entries(process.env)) {
		const key = process.platform === "win32" ? name.toLowerCase() : name;
		const previous = names.get(key);
		if (previous !== undefined) delete env[previous];
		names.set(key, name);
		env[name] = value;
	}
	delete env.NODE_CHANNEL_FD;
	delete env.NODE_UNIQUE_ID;
	return env;
}

function parseStartArgs() {
	const configured = process.env.DSH_START_ARGS;
	if (configured === undefined || configured.trim() === "") return ["--profile", "web"];
	let args;
	try {
		args = JSON.parse(configured);
	} catch (error) {
		throw new Error("dsh-start&exit: DSH_START_ARGS must be a JSON array of strings", { cause: error });
	}
	if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
		throw new TypeError("dsh-start&exit: DSH_START_ARGS must be a JSON array of strings");
	}
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--host") {
			if (args[index + 1] !== LOOPBACK_HOST) throw new Error("dsh-start&exit: public Web binding is not supported; --host must be 127.0.0.1");
			index += 1;
		} else if (arg.startsWith("--host=") && arg.slice("--host=".length) !== LOOPBACK_HOST) {
			throw new Error("dsh-start&exit: public Web binding is not supported; --host must be 127.0.0.1");
		}
	}
	return args;
}

const LAUNCH_HELPER = String.raw`
const { spawn } = require("node:child_process");
const { rmSync } = require("node:fs");
const { dirname } = require("node:path");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readPayload = () => new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.once("error", reject);
    process.stdin.once("end", () => {
        try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
            reject(error);
        }
    });
});
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
    const payload = await readPayload();
    const cleanupPayloadFile = () => {
        if (typeof payload.payloadFilePath !== "string") return;
        try {
            rmSync(dirname(payload.payloadFilePath), { recursive: true, force: true });
        } catch {}
    };
    const deadline = Date.now() + payload.waitTimeoutMs;
    while (isAlive(payload.parentPid) && Date.now() < deadline) await sleep(200);
    if (isAlive(payload.parentPid)) {
        cleanupPayloadFile();
        process.exit(1);
    }
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
	const directPath = payload.kind === "node" ? payload.execPath : payload.commandPath;
    let child;
    try {
        child = spawn(terminalLaunch ? payload.terminalPath : directPath, launchArgs, {
            cwd: payload.cwd,
            env: payload.env,
            detached: true,
            stdio: "ignore",
            windowsHide: terminalLaunch ? false : true
        });
    } catch (error) {
        cleanupPayloadFile();
        throw error;
    }
    child.once("error", () => {
        cleanupPayloadFile();
        process.exitCode = 1;
    });
    child.once("spawn", () => {
        child.unref();
        if (typeof payload.payloadFilePath === "string") {
            setTimeout(cleanupPayloadFile, 120_000);
        }
    });
})().catch(() => {
	process.exitCode = 1;
});
`;

/** 启动一个与旧宿主生命周期解耦的 helper；Windows 下打开新的可见 Windows Terminal 窗口。 */
function scheduleLaunch(launch) {
	if (hasSupervisorChannel()) {
		throw new Error("dsh-start&exit: refusing self-restart under supervisor or Node IPC (self-launch)");
	}
	const launcher = process.platform === "win32" ? "windows-terminal" : "direct";
	const env = cleanLaunchEnvironment();
	const launchPayload = {
		parentPid: process.pid,
		...launch,
		cwd: process.cwd(),
		env
	};
	const shellPath = launcher === "windows-terminal" ? resolvePowerShell7() : undefined;
	const terminalPath = launcher === "windows-terminal" ? resolveWindowsTerminal(shellPath) : undefined;
	let payloadFilePath;
	try {
		if (launcher === "windows-terminal") payloadFilePath = createLaunchPayloadFile(launchPayload);
		const payload = JSON.stringify({
			...launchPayload,
			launcher,
			shellPath,
			terminalPath,
			payloadFilePath,
			commandBase64: launcher === "windows-terminal" ? encodePowerShellLaunch(payloadFilePath) : undefined,
			title: launch.title ?? "dsh-web",
			waitTimeoutMs: 15_000
		});
		const helper = spawn(process.execPath, ["-e", LAUNCH_HELPER], {
			env,
			detached: true,
			stdio: ["pipe", "ignore", "ignore"],
			windowsHide: true
		});
		const started = waitForSpawn(helper, "launch helper", payload);
		return started.then(() => {
			helper.unref();
		}, (error) => {
			removeLaunchPayloadFile(payloadFilePath);
			throw error;
		});
	} catch (error) {
		removeLaunchPayloadFile(payloadFilePath);
		throw error;
	}
}

function scheduleRestart() {
	return scheduleLaunch({
		kind: "node",
		execPath: process.execPath,
		args: [...process.execArgv, ...process.argv.slice(1)],
		title: "dsh-web"
	});
}

function scheduleStart() {
	const launcher = process.platform === "win32" ? "windows-terminal" : "direct";
	const shellPath = launcher === "windows-terminal" ? resolvePowerShell7() : undefined;
	const commandPath = resolveDshLauncher(shellPath);
	return scheduleLaunch({
		kind: "command",
		commandPath,
		args: parseStartArgs(),
		title: "dsh-web"
	});
}

class DshStartExitService extends TypertRemoteService {
	static name = "dshStartExit";
	static inject = ["typert", "webServer"];
	closing = null;

	constructor(ctx) {
		const webServer = ctx.get("webServer");
		if (webServer?.host !== LOOPBACK_HOST) {
			throw new Error("dsh-start&exit: refusing to load unless the Web server is bound to 127.0.0.1; public exposure is not supported");
		}
		super(ctx, "dshStartExit");
		markRemoteMethod(this, "start");
		markRemoteMethod(this, "exit");
		markRemoteMethod(this, "restart");
		const existing = ctx.get("typert");
		if (existing !== undefined) {
			existing.register(START_EXIT_TYPERT);
		} else {
			ctx.inject(["typert"], (typertCtx) => {
				typertCtx.typert.register(START_EXIT_TYPERT);
			});
		}
	}

	scheduleRestart() {
		return scheduleRestart();
	}

	scheduleStart() {
		return scheduleStart();
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
		this.ctx.logger?.info?.("dsh-start&exit: exit requested from the web UI");
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
			this.ctx.logger?.error?.("dsh-start&exit: failed to schedule restart", error);
			throw error;
		}
		this.ctx.logger?.info?.("dsh-start&exit: restart requested from the web UI");
		this.requestShutdown();
		return true;
	}

	/** 通过 dsh.ps1 启动一个新的 web profile；旧宿主先有界退出以避免抢占端口。 */
	async start() {
		if (this.closing !== null) return true;
		this.closing = "start";
		try {
			await this.scheduleStart();
		} catch (error) {
			this.closing = null;
			this.ctx.logger?.error?.("dsh-start&exit: failed to schedule start", error);
			throw error;
		}
		this.ctx.logger?.info?.("dsh-start&exit: start requested from the web UI");
		this.requestShutdown();
		return true;
	}
}

function apply(ctx) {
	ctx.plugin(DshStartExitService);
}

export { apply };
//#endregion
