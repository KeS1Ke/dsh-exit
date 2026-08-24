//#region dsh-exit 浏览器客户端 bundle
/**
 * dsh-exit 客户端：
 * - 在整个界面右下角挂载紧凑的退出按钮
 * - 退出按钮首次点击弹确认弹窗；确认后调用 remote.dshExit.exit()，
 *   服务端结束宿主进程并释放端口，不操作终端窗口或浏览器标签页
 *
 * 无外部依赖：全部逻辑在本工厂内完成，不 require 任何模块。
 */
window.__ModuleLoader__.load({
	// The loader key follows the resolved npm package name, including its scope.
	id: "@kesike/dsh-exit",
	factory: () => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		/** 与 archive-manager「删除会话」相同的错误红（设计令牌）。 */
		const ERROR_RED = "var(--dsw-alias-state-error-primary)";

		/** Lucide power 图标（ISC 许可，免费），16px 线性风格贴合现有按钮。 */
		const ICON_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/></svg>';

		const CSS_TEXT = [
			".dshExitBtn{position:fixed;right:12px;bottom:12px;left:auto;z-index:2147482000;box-sizing:border-box;width:32px;height:32px;padding:0;display:grid;place-items:center;cursor:pointer;border:1px solid " + ERROR_RED + ";border-radius:50%;background:var(--dsw-alias-button-elevated-fill);color:" + ERROR_RED + ";box-shadow:0 2px 8px rgba(0,0,0,.24);transition:background .12s ease,transform .12s ease}",
			".dshExitBtn svg{width:16px;height:16px;flex:none}",
			".dshExitBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);transform:translateY(-1px)}",
			".dshExitBtn:focus-visible{outline:2px solid " + ERROR_RED + ";outline-offset:2px}",
			".dshExitBtn:disabled{cursor:default;opacity:.7}",
			".dshExitOverlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(15,20,25,.45);animation:dshExitFade .12s ease-out}",
			"@keyframes dshExitFade{from{opacity:0}}",
			".dshExitModal{box-sizing:border-box;width:min(380px,calc(100vw - 48px));border-radius:16px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-elevated-fill);box-shadow:0 24px 64px rgba(0,0,0,.35);padding:24px;display:flex;flex-direction:column;gap:12px;animation:dshExitPop .14s ease-out}",
			"@keyframes dshExitPop{from{opacity:0;transform:translateY(6px) scale(.98)}}",
			".dshExitTitle{margin:0;font-size:17px;font-weight:600;color:var(--dsw-alias-label-primary)}",
			".dshExitBody{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
			".dshExitError{margin:0;min-height:0;font-size:12px;line-height:18px;color:" + ERROR_RED + "}",
			".dshExitActions{display:flex;justify-content:flex-end;gap:10px;margin-top:4px}",
			".dshExitCancel{cursor:pointer;height:32px;padding:0 14px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}",
			".dshExitCancel:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshExitCancel:disabled{cursor:default;opacity:.6}",
			".dshExitConfirm{cursor:pointer;height:32px;padding:0 14px;border-radius:10px;border:none;background:" + ERROR_RED + ";color:#fff;font-size:13px;font-weight:600}",
			".dshExitConfirm:hover:not(:disabled){filter:brightness(1.08)}",
			".dshExitConfirm:disabled{cursor:default;opacity:.6}"
		].join("\n");

		/** 客户端严格编解码 shim：与服务端 exitedSchema 对应。 */
		const exitedClientSchema = {
			parse(value) {
				if (value !== true) throw new TypeError("exit must return true");
				return value;
			}
		};

		/** 客户端 Remote 描述符：挂载后 ctx.get("remote.dshExit") 可用。 */
		const EXIT_REMOTE = {
			package: "@kesike/dsh-exit",
			descriptors: [
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
						schema: exitedClientSchema
					}
				}
			]
		};

		let exiting = false;
		let exitBtnEl = null;
		let overlayEl = null;
		let escHandler = null;

		function injectCss() {
			if (document.querySelector("style[data-plugin-css='dsh-exit']")) return;
			const tag = document.createElement("style");
			tag.dataset.pluginCss = "dsh-exit";
			tag.textContent = CSS_TEXT;
			document.head.appendChild(tag);
		}

		function createExitButton() {
			const exitBtn = document.createElement("button");
			exitBtn.className = "dshExitBtn";
			exitBtn.type = "button";
			exitBtn.disabled = false;
			exitBtn.setAttribute("aria-label", "退出");
			exitBtn.title = "退出 DeepSeek Harness";
			exitBtn.dataset.dshExitButton = "true";
			exitBtn.innerHTML = ICON_SVG;
			return exitBtn;
		}

		function mount(ctx) {
			const existing = document.querySelector("[data-dsh-exit-button='true']");
			if (existing) {
				exitBtnEl = existing;
				return;
			}
			if (!document.body) return;
			const exitBtn = createExitButton();
			exitBtn.addEventListener("click", (event) => {
				event.stopPropagation();
				openModal(ctx, exitBtn);
			});
			document.body.appendChild(exitBtn);
			exitBtnEl = exitBtn;
		}

		function closeModal() {
			if (escHandler) {
				document.removeEventListener("keydown", escHandler);
				escHandler = null;
			}
			if (overlayEl) {
				overlayEl.remove();
				overlayEl = null;
			}
		}

		function openModal(ctx, exitBtn) {
			closeModal();
			overlayEl = document.createElement("div");
			overlayEl.className = "dshExitOverlay";
			const panel = document.createElement("div");
			panel.className = "dshExitModal";
			panel.setAttribute("role", "dialog");
			panel.setAttribute("aria-modal", "true");
			panel.setAttribute("aria-label", "退出 DeepSeek Harness");
			const title = document.createElement("h3");
			title.className = "dshExitTitle";
			title.textContent = "退出 DeepSeek Harness？";
			const body = document.createElement("p");
			body.className = "dshExitBody";
			body.textContent = "退出后将结束所有运行中的会话并停止后台服务，3080 端口会随之释放。";
			const errorEl = document.createElement("p");
			errorEl.className = "dshExitError";
			const actions = document.createElement("div");
			actions.className = "dshExitActions";
			const cancel = document.createElement("button");
			cancel.type = "button";
			cancel.className = "dshExitCancel";
			cancel.textContent = "取消";
			const confirm = document.createElement("button");
			confirm.type = "button";
			confirm.className = "dshExitConfirm";
			confirm.textContent = "确认退出";
			actions.append(cancel, confirm);
			panel.append(title, body, errorEl, actions);
			overlayEl.appendChild(panel);

			escHandler = (event) => {
				if (event.key === "Escape" && !confirm.disabled) closeModal();
			};
			document.addEventListener("keydown", escHandler);
			overlayEl.addEventListener("click", (event) => {
				if (event.target === overlayEl && !confirm.disabled) closeModal();
			});
			cancel.addEventListener("click", () => {
				if (!confirm.disabled) closeModal();
			});
			confirm.addEventListener("click", () => {
				exiting = true;
				confirm.disabled = true;
				cancel.disabled = true;
				errorEl.textContent = "";
				exitBtn.disabled = true;
				exitBtn.setAttribute("aria-label", "正在退出…");
				Promise.resolve()
					.then(() => {
						const service = ctx.get("remote.dshExit");
						if (service === undefined) throw new Error("dsh-exit 服务不可用（宿主未注册？）");
						return service.exit();
						})
					.then((result) => {
						if (!result || result.ok !== true) {
							throw new Error((result && result.error && result.error.message) || "退出调用失败");
						}
						closeModal();
					})
					.catch((reason) => {
						exiting = false;
						confirm.disabled = false;
						cancel.disabled = false;
						exitBtn.disabled = false;
						exitBtn.setAttribute("aria-label", "退出");
						errorEl.textContent = "退出失败：" + (reason instanceof Error ? reason.message : String(reason));
					});
			});
			document.body.appendChild(overlayEl);
		}

		async function apply(ctx) {
			injectCss();
			mount(ctx);
			const observer = new MutationObserver(() => {
				if (!exiting) mount(ctx);
			});
			observer.observe(document.documentElement, { childList: true, subtree: true });
			let disposeRemote = () => {};
			const remote = ctx.get("remote");
			if (remote !== undefined) disposeRemote = await remote.$mount(EXIT_REMOTE);
			return async () => {
				observer.disconnect();
				closeModal();
				if (exitBtnEl) {
					exitBtnEl.remove();
					exitBtnEl = null;
				}
				disposeRemote();
			};
		}

		exports.apply = apply;
		return module.exports;
	}
});
//#endregion
