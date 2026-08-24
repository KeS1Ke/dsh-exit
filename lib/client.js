//#region dsh-exit 浏览器客户端 bundle
/**
 * dsh-exit 客户端：
 * - 在 dsh 设置菜单中注册一个始终排在最后的“退出”栏目
 * - 栏目中的退出按钮首次点击弹确认弹窗；确认后调用 remote.dshExit.exit()，
 *   服务端结束宿主进程并释放端口，不操作终端窗口或浏览器标签页
 *
 * 页面使用 dsh 已提供的 React、slots 和 locale 运行时，不引入新的运行时依赖。
 */
window.__ModuleLoader__.load({
	// The loader key follows the resolved npm package name, including its scope.
	id: "@kesike/dsh-exit",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const h = React.createElement;

		/** 与 archive-manager「删除会话」相同的错误红（设计令牌）。 */
		const ERROR_RED = "var(--dsw-alias-state-error-primary)";

		/** Lucide power 图标（ISC 许可，免费），16px 线性风格贴合现有按钮。 */
		const ICON_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/></svg>';

		const CSS_TEXT = [
			".dshExitSettings{box-sizing:border-box;max-width:720px;padding:28px 32px 40px;color:var(--dsw-alias-label-primary)}",
			".dshExitSettingsHeader{display:flex;align-items:flex-start;gap:14px;padding-bottom:22px;border-bottom:1px solid var(--dsw-alias-border-l2)}",
			".dshExitSettingsIcon{box-sizing:border-box;width:38px;height:38px;display:grid;place-items:center;flex:none;border:1px solid " + ERROR_RED + ";border-radius:12px;color:" + ERROR_RED + ";background:var(--dsw-alias-button-elevated-fill)}",
			".dshExitSettingsIcon svg{width:20px;height:20px}",
			".dshExitSettingsTitle{margin:0;font-size:20px;line-height:28px;font-weight:650;color:var(--dsw-alias-label-primary)}",
			".dshExitSettingsDescription{margin:6px 0 0;max-width:560px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
			".dshExitSettingsCard{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:24px;padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-2)}",
			".dshExitSettingsWarning{margin:0;max-width:430px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
			".dshExitSettingsButton{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:none;min-width:112px;height:36px;padding:0 16px;cursor:pointer;border:0;border-radius:10px;background:" + ERROR_RED + ";color:#fff;font-size:13px;font-weight:650;transition:filter .12s ease,opacity .12s ease}",
			".dshExitSettingsButton svg{width:16px;height:16px}",
			".dshExitSettingsButton:hover:not(:disabled){filter:brightness(1.08)}",
			".dshExitSettingsButton:focus-visible{outline:2px solid " + ERROR_RED + ";outline-offset:2px}",
			".dshExitSettingsButton:disabled{cursor:default;opacity:.6}",
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

		const NS = "dsh-exit";
		const DICT = {
			zh: {
				nav: "退出",
				title: "退出 dsh",
				description: "从这里安全结束 dsh 宿主进程，并释放它占用的端口。",
				warning: "确认后将结束所有运行中的会话并停止后台服务，3080 端口会随之释放。",
				button: "确认退出",
				dialogTitle: "退出 DeepSeek Harness？",
				dialogBody: "退出后将结束所有运行中的会话并停止后台服务，3080 端口会随之释放。",
				cancel: "取消",
				confirm: "确认退出",
				exiting: "正在退出…",
				errorPrefix: "退出失败："
			},
			en: {
				nav: "Exit",
				title: "Exit dsh",
				description: "Safely terminate the dsh host process and release the ports it owns.",
				warning: "Confirming ends all running sessions and stops the background service, releasing port 3080.",
				button: "Confirm exit",
				dialogTitle: "Exit DeepSeek Harness?",
				dialogBody: "This ends all running sessions and stops the background service, releasing port 3080.",
				cancel: "Cancel",
				confirm: "Confirm exit",
				exiting: "Exiting…",
				errorPrefix: "Exit failed: "
			}
		};

		let exiting = false;
		let overlayEl = null;
		let escHandler = null;

		function injectCss() {
			if (document.querySelector("style[data-plugin-css='dsh-exit']")) return;
			const tag = document.createElement("style");
			tag.dataset.pluginCss = "dsh-exit";
			tag.textContent = CSS_TEXT;
			document.head.appendChild(tag);
		}

		function textOf(t, key) {
			return typeof t === "function" ? t(key) : DICT.zh[key] ?? key;
		}

		function ExitSettingsSection({ ctx, t }) {
			return h("section", {
				className: "dshExitSettings",
				"aria-labelledby": "dsh-exit-settings-title"
			}, [
				h("div", { className: "dshExitSettingsHeader", key: "header" }, [
					h("span", {
						className: "dshExitSettingsIcon",
						dangerouslySetInnerHTML: { __html: ICON_SVG },
						key: "icon"
					}),
					h("div", { key: "copy" }, [
						h("h2", { className: "dshExitSettingsTitle", id: "dsh-exit-settings-title", key: "title" }, textOf(t, "title")),
						h("p", { className: "dshExitSettingsDescription", key: "description" }, textOf(t, "description"))
					])
				]),
				h("div", { className: "dshExitSettingsCard", key: "card" }, [
					h("p", { className: "dshExitSettingsWarning", key: "warning" }, textOf(t, "warning")),
					h("button", {
						type: "button",
						className: "dshExitSettingsButton",
						"aria-label": textOf(t, "button"),
						onClick: (event) => openModal(ctx, event.currentTarget, t),
						key: "button"
					}, [
						h("span", { dangerouslySetInnerHTML: { __html: ICON_SVG }, key: "icon" }),
						textOf(t, "button")
					])
				])
			]);
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

		function openModal(ctx, exitBtn, t) {
			const text = (key) => textOf(t, key);
			closeModal();
			overlayEl = document.createElement("div");
			overlayEl.className = "dshExitOverlay";
			const panel = document.createElement("div");
			panel.className = "dshExitModal";
			panel.setAttribute("role", "dialog");
			panel.setAttribute("aria-modal", "true");
			panel.setAttribute("aria-label", text("dialogTitle"));
			const title = document.createElement("h3");
			title.className = "dshExitTitle";
			title.textContent = text("dialogTitle");
			const body = document.createElement("p");
			body.className = "dshExitBody";
			body.textContent = text("dialogBody");
			const errorEl = document.createElement("p");
			errorEl.className = "dshExitError";
			const actions = document.createElement("div");
			actions.className = "dshExitActions";
			const cancel = document.createElement("button");
			cancel.type = "button";
			cancel.className = "dshExitCancel";
			cancel.textContent = text("cancel");
			const confirm = document.createElement("button");
			confirm.type = "button";
			confirm.className = "dshExitConfirm";
			confirm.textContent = text("confirm");
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
				exitBtn.setAttribute("aria-label", text("exiting"));
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
						errorEl.textContent = text("errorPrefix") + (reason instanceof Error ? reason.message : String(reason));
					});
			});
			document.body.appendChild(overlayEl);
		}

		async function apply(ctx) {
			injectCss();
			ctx.effect(() => ctx.locale.register(NS, DICT), "dsh-exit: settings dictionaries");
			const t = ctx.locale.bind(NS);
			const SettingsSection = (props) => h(ExitSettingsSection, { ...props, ctx });
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-exit",
				order: Number.MAX_SAFE_INTEGER,
				label: () => t("nav"),
				locale: NS
			}, SettingsSection));
			let disposeRemote = () => {};
			const remote = ctx.get("remote");
			if (remote !== undefined) disposeRemote = await remote.$mount(EXIT_REMOTE);
			return async () => {
				closeModal();
				disposeRemote();
			};
		}

		exports.inject = ["slots", "locale"];
		exports.apply = apply;
		return module.exports;
	}
});
//#endregion
