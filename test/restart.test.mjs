import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import test from "node:test";

function element(type, props, ...children) {
	return { type, props: props ?? {}, children: children.flat(Infinity) };
}

function resolve(node) {
	if (node === null || node === undefined || typeof node !== "object") return node;
	if (typeof node.type === "function") {
		return resolve(node.type({ ...node.props, children: node.children }));
	}
	return { ...node, children: node.children.map(resolve) };
}

function walk(node, visit) {
	if (node === null || node === undefined || typeof node !== "object") return;
	visit(node);
	for (const child of node.children ?? []) walk(child, visit);
}

function fakeDom() {
	const headChildren = [];
	const bodyChildren = [];
	const createElement = (tagName) => ({
		tagName,
		dataset: {},
		style: {
			removeProperty() {}
		},
		children: [],
		setAttribute() {},
		addEventListener() {},
		append(...children) {
			this.children.push(...children);
		},
		appendChild(child) {
			this.children.push(child);
			return child;
		},
		querySelector() {
			return null;
		},
		remove() {}
	});
	return {
		document: {
			head: { appendChild: (child) => headChildren.push(child) },
			body: { appendChild: (child) => bodyChildren.push(child) },
			documentElement: {},
			querySelector: () => null,
			querySelectorAll: () => [],
			createElement,
			addEventListener() {},
			removeEventListener() {}
		},
		headChildren,
		bodyChildren
	};
}

test("client registers aligned start, exit, and restart actions", async () => {
	const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
	let bundle;
	const dom = fakeDom();
	globalThis.document = dom.document;
	globalThis.location = { host: "127.0.0.1:3080", reload() {} };
	globalThis.MutationObserver = class {
		observe() {}
		disconnect() {}
	};
	globalThis.window = {
		__ModuleLoader__: {
			load(value) {
				bundle = value;
			}
		}
	};

	Function(source)();
	assert.equal(bundle.id, "@kesike/dsh-start-and-exit");
	const plugin = bundle.factory((name) => {
		assert.equal(name, "react");
		return { createElement: element };
	});
	assert.deepEqual(plugin.inject, ["slots", "locale", "remote"]);

	let section;
	let remoteDescriptor;
	let dictionary;
	const ctx = {
		effect(run) {
			run();
		},
		locale: {
			register(_namespace, value) {
				dictionary = value;
				return () => {};
			},
			bind() {
				return (key, values = {}) => String(dictionary.zh[key] ?? key).replace(
					/\{([A-Za-z0-9_]+)\}/g,
					(match, name) => values[name] === undefined ? match : String(values[name])
				);
			}
		},
		slots: {
			inject(_name, register) {
				register();
			},
			register(_config, component) {
				section = component;
				return () => {};
			}
		},
		get(name) {
			if (name !== "remote") return undefined;
			return {
				async $mount(value) {
					remoteDescriptor = value;
					return () => {};
				}
			};
		}
	};
	const dispose = await plugin.apply(ctx);
	const tree = resolve(section({}));
	const cards = [];
	const buttons = [];
	walk(tree, (node) => {
		if (node.props?.className === "dshExitSettingsCard") cards.push(node);
		if (node.type === "button") buttons.push(node);
	});

	assert.equal(cards.length, 3);
	assert.deepEqual(remoteDescriptor.descriptors.map(({ method }) => method), ["start", "exit", "restart"]);
	assert.equal(buttons.length, 3);
	assert.match(buttons[0].props.className, /dshExitSettingsButton--start/);
	assert.match(buttons[1].props.className, /dshExitSettingsButton--exit/);
	assert.match(buttons[2].props.className, /dshExitSettingsButton--restart/);
	assert.equal(typeof buttons[0].props.onClick, "function");
	assert.match(JSON.stringify(tree), /启动 dsh/);
	assert.match(JSON.stringify(tree), /重新启动 dsh/);
	assert.match(JSON.stringify(tree), /M12 3v12/);
	assert.match(JSON.stringify(tree), /M21 12/);
	await dispose();
});

test("host plugin exposes the start, exit, and restart remote methods", async () => {
	const { apply } = await import("../lib/index.js");
	let service;
	apply({
		plugin(value) {
			service = value;
		}
	});
	assert.equal(service.name, "dshStartExit");
	assert.deepEqual(service.inject, ["typert", "webServer"]);
	assert.equal(typeof service.prototype.start, "function");
	assert.equal(typeof service.prototype.exit, "function");
	assert.equal(typeof service.prototype.restart, "function");
});

test("host plugin refuses non-loopback Web server bindings", async () => {
	const { apply } = await import("../lib/index.js");
	let Service;
	apply({
		plugin(value) {
			Service = value;
		}
	});
	const context = (host) => ({
		get(name) {
			return name === "webServer" ? { host } : undefined;
		},
		reflect: { provide() {} },
		inject() {}
	});
	assert.throws(
		() => new Service(context("0.0.0.0")),
		/refusing to load unless the Web server is bound to 127\.0\.0\.1/
	);
	assert.doesNotThrow(() => new Service(context("127.0.0.1")));
});

test("host restart waits for helper startup before requesting shutdown", async () => {
	const { apply } = await import("../lib/index.js");
	let Service;
	apply({
		plugin(value) {
			Service = value;
		}
	});
	const instance = Object.create(Service.prototype);
	instance.closing = null;
	instance.ctx = { logger: {} };
	let resolveHelper;
	let shutdownRequests = 0;
	instance.scheduleRestart = () => new Promise((resolve) => {
		resolveHelper = resolve;
	});
	instance.requestShutdown = () => {
		shutdownRequests++;
	};
	const restart = instance.restart();
	await Promise.resolve();
	assert.equal(shutdownRequests, 0);
	resolveHelper();
	assert.equal(await restart, true);
	assert.equal(shutdownRequests, 1);
	assert.equal(instance.closing, "restart");
});

test("host start waits for helper startup before requesting shutdown", async () => {
	const { apply } = await import("../lib/index.js");
	let Service;
	apply({
		plugin(value) {
			Service = value;
		}
	});
	const instance = Object.create(Service.prototype);
	instance.closing = null;
	instance.ctx = { logger: {} };
	let resolveHelper;
	let shutdownRequests = 0;
	instance.scheduleStart = () => new Promise((resolve) => {
		resolveHelper = resolve;
	});
	instance.requestShutdown = () => {
		shutdownRequests++;
	};
	const start = instance.start();
	await Promise.resolve();
	assert.equal(shutdownRequests, 0);
	resolveHelper();
	assert.equal(await start, true);
	assert.equal(shutdownRequests, 1);
	assert.equal(instance.closing, "start");
});

test("host restart keeps the service alive when helper startup fails", async () => {
	const { apply } = await import("../lib/index.js");
	let Service;
	apply({
		plugin(value) {
			Service = value;
		}
	});
	const instance = Object.create(Service.prototype);
	instance.closing = null;
	instance.ctx = { logger: { error() {} } };
	let shutdownRequests = 0;
	instance.scheduleRestart = async () => {
		throw new Error("helper unavailable");
	};
	instance.requestShutdown = () => {
		shutdownRequests++;
	};
	await assert.rejects(instance.restart(), /helper unavailable/);
	assert.equal(shutdownRequests, 0);
	assert.equal(instance.closing, null);
});

test("host start keeps the service alive when helper startup fails", async () => {
	const { apply } = await import("../lib/index.js");
	let Service;
	apply({
		plugin(value) {
			Service = value;
		}
	});
	const instance = Object.create(Service.prototype);
	instance.closing = null;
	instance.ctx = { logger: { error() {} } };
	instance.scheduleStart = async () => {
		throw new Error("launcher unavailable");
	};
	let shutdownRequests = 0;
	instance.requestShutdown = () => {
		shutdownRequests++;
	};
	await assert.rejects(instance.start(), /launcher unavailable/);
	assert.equal(shutdownRequests, 0);
	assert.equal(instance.closing, null);
});

test("host refuses self-restart when Node IPC is present", async () => {
	const { apply } = await import("../lib/index.js");
	let Service;
	apply({
		plugin(value) {
			Service = value;
		}
	});
	const instance = Object.create(Service.prototype);
	const previousChannel = process.env.NODE_CHANNEL_FD;
	process.env.NODE_CHANNEL_FD = "1";
	try {
		assert.throws(
			() => instance.scheduleRestart(),
			/refusing self-restart under supervisor or Node IPC/
		);
	} finally {
		if (previousChannel === undefined) delete process.env.NODE_CHANNEL_FD;
		else process.env.NODE_CHANNEL_FD = previousChannel;
	}
});

test("restart helper opens a visible Windows Terminal window", async () => {
	const source = await readFile(new URL("../lib/index.js", import.meta.url), "utf8");
	assert.match(source, /launcher === "windows-terminal"/);
	assert.match(source, /['"]-w['"],\s*['"]new['"],\s*['"]new-tab['"]/);
	assert.match(source, /['"]--inheritEnvironment['"]/);
	assert.match(source, /title: "dsh-web"/);
	assert.match(source, /resolvePowerShell7\(\)/);
	assert.match(source, /function resolveSystemWhere\(\)/);
	assert.match(source, /spawnSync\(resolveSystemWhere\(\), \["pwsh\.exe"\]/);
	assert.match(source, /isAbsolute\(line\).*existsSync\(line\)/);
	assert.match(source, /function resolveWindowsTerminal\(shellPath\)/);
	assert.match(source, /encodePowerShellLaunch\(payloadFilePath\)/);
	assert.match(source, /function createLaunchPayloadFile\(payload\)/);
	assert.match(source, /function removeLaunchPayloadFile\(payloadPath\)/);
	assert.match(source, /environment: Object\.entries\(payload\.env \?\? \{\}\)/);
	assert.match(source, /\$payload\.environment \| ForEach-Object/);
	assert.match(source, /public Web binding is not supported; --host must be 127\.0\.0\.1/);
	assert.match(source, /arg\.startsWith\("--host="\)/);
	assert.match(source, /"-NoLogo",\s*"-NoProfile",\s*"-ExecutionPolicy",\s*"Bypass",\s*"-EncodedCommand"/);
	assert.match(source, /Get-AppxPackage -Name ['"]Microsoft[.]WindowsTerminal['"]/);
	assert.match(source, /WindowsTerminal\.exe/);
	assert.match(source, /Buffer\.from\(launchCommand, "utf16le"\)/);
	assert.match(source, /process\.stdin\.on\("data"/);
	assert.match(source, /stdio: \["pipe", "ignore", "ignore"\]/);
	assert.doesNotMatch(source, /JSON\.parse\(process\.argv\[1\]\)/);
	assert.doesNotMatch(source, /FromBase64String/);
	assert.match(source, /payload\.shellPath/);
	assert.match(source, /payload\.terminalPath/);
	assert.match(source, /payload\.commandBase64/);
	assert.match(source, /stdio: "ignore"/);
	assert.match(source, /spawn\(terminalLaunch \? payload\.terminalPath : directPath, launchArgs/);
	assert.match(source, /detached: true/);
	assert.match(source, /windowsHide: terminalLaunch \? false : true/);
	assert.doesNotMatch(source, /Start-Process -FilePath/);
	assert.doesNotMatch(source, /\$pid\b/);
	assert.doesNotMatch(source, /\$host\b/);
});

test("launch helper receives its payload over stdin instead of argv", async () => {
	const source = await readFile(new URL("../lib/index.js", import.meta.url), "utf8");
	const helperSource = source.match(/const LAUNCH_HELPER = String\.raw`([\s\S]*?)\n`;/u)?.[1];
	assert.ok(helperSource);
	const anchor = spawn(process.execPath, ["-e", "setTimeout(() => {}, 10_000)"], { stdio: "ignore" });
	anchor.kill();
	await once(anchor, "exit");
	const helper = spawn(process.execPath, ["-e", helperSource], {
		stdio: ["pipe", "ignore", "ignore"]
	});
	const payload = {
		parentPid: anchor.pid,
		launcher: "direct",
		kind: "node",
		execPath: process.execPath,
		args: ["-e", "process.exit(0)", "dsh-start-and-exit-canary"],
		cwd: process.cwd(),
		env: { ...process.env },
		waitTimeoutMs: 0
	};
	helper.stdin.end(JSON.stringify(payload));
	assert.doesNotMatch(helper.spawnargs.join(" "), /dsh-start-and-exit-canary/);
	const [code] = await once(helper, "exit");
	assert.equal(code, 0);
});

test("client injects the settings slot contract instead of a missing package", async () => {
	const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
	assert.deepEqual(packageJson.dsh.client.inject, [
		"@deepseek-ai/dsh-api-remotes",
		"@deepseek-ai/dsh-client-runtime",
		"@deepseek-ai/dsh-client-ui-settings",
		"@deepseek-ai/dsh-client-locale"
	]);
	assert.equal(packageJson.peerDependencies["@deepseek-ai/dsh-typert-protocol"], "^0.1.1-rc.2");
	assert.equal(packageJson.name, "@kesike/dsh-start-and-exit");
	assert.equal(packageJson.displayName, "dsh-start&exit");
});
