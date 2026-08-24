//#region dsh-exit 宿主侧
/**
 * dsh-exit：把「退出 dsh 宿主并释放端口」暴露给浏览器的一个宿主服务。
 *
 * 远程面：`remote.dshExit.exit()`（Typert Remote，经 /api/dshExit/exit 网关）。
 * 调用后：先应答，再延迟 400ms 结束宿主进程——端口随进程退出释放；
 * 不操作宿主终端窗口或系统托盘。
 */
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
		id: "dsh-exit#dshExit/exit",
		service: "dshExit",
		namespace: "dshExit",
		method: "exit",
		invocation: { kind: "direct" },
		parameters: [],
		result: {
			mode: "strict",
			typeSymbol: "dsh-exit/types#Exited",
			schema: exitedSchema
		},
		sourceLocation: { file: "dsh-exit/lib/index.js", line: 1, column: 1 }
	}
];

const EXIT_TYPERT = {
	package: "dsh-exit",
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

class DshExitService extends TypertRemoteService {
	static name = "dshExit";
	static inject = ["typert"];
	exiting = false;

	constructor(ctx) {
		super(ctx, "dshExit");
		markRemoteMethod(this, "exit");
		const existing = ctx.get("typert");
		if (existing !== undefined) {
			existing.register(EXIT_TYPERT);
		} else {
			ctx.inject(["typert"], (typertCtx) => {
				typertCtx.typert.register(EXIT_TYPERT);
			});
		}
	}

	/** 结束宿主并释放端口；不触碰宿主终端窗口。 */
	async exit() {
		if (this.exiting) return true;
		this.exiting = true;
		this.ctx.logger?.info?.("dsh-exit: exit requested from the web UI");
		setTimeout(() => process.exit(0), 400);
		return true;
	}
}

function apply(ctx) {
	ctx.plugin(DshExitService);
}

export { apply };
//#endregion
