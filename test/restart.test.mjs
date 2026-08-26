import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("client registers aligned exit and restart actions", async () => {
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
	assert.equal(bundle.id, "@kesike/dsh-exit");
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

	assert.equal(cards.length, 2);
	assert.deepEqual(remoteDescriptor.descriptors.map(({ method }) => method), ["exit", "restart"]);
	assert.equal(buttons.length, 2);
	assert.match(buttons[1].props.className, /dshExitSettingsButton--restart/);
	assert.equal(typeof buttons[1].props.onClick, "function");
	assert.match(JSON.stringify(tree), /重新启动 dsh/);
	assert.match(JSON.stringify(tree), /M21 12/);
	await dispose();
});

test("host plugin exposes the restart remote method", async () => {
	const { apply } = await import("../lib/index.js");
	let service;
	apply({
		plugin(value) {
			service = value;
		}
	});
	assert.equal(service.name, "dshExit");
	assert.equal(typeof service.prototype.exit, "function");
	assert.equal(typeof service.prototype.restart, "function");
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
	assert.match(source, /function resolveWindowsTerminal\(shellPath\)/);
	assert.match(source, /encodePowerShellLaunch\(restartPayload\)/);
	assert.match(source, /"-NoLogo",\s*"-NoProfile",\s*"-ExecutionPolicy",\s*"Bypass",\s*"-EncodedCommand"/);
	assert.match(source, /Get-AppxPackage -Name ['"]Microsoft[.]WindowsTerminal['"]/);
	assert.match(source, /WindowsTerminal\.exe/);
	assert.match(source, /Buffer\.from\(nodeCommand, "utf16le"\)/);
	assert.match(source, /payload\.shellPath/);
	assert.match(source, /payload\.terminalPath/);
	assert.match(source, /payload\.commandBase64/);
	assert.match(source, /stdio: "ignore"/);
	assert.match(source, /spawn\(terminalLaunch \? payload\.terminalPath : payload\.execPath, launchArgs/);
	assert.match(source, /detached: true/);
	assert.match(source, /windowsHide: terminalLaunch \? false : true/);
	assert.doesNotMatch(source, /Start-Process -FilePath/);
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
});
