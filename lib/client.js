//#region dsh-exit 浏览器客户端 bundle
/**
 * dsh-exit 客户端：
 * - 在 dsh 设置菜单中注册一个始终排在最后的“退出”栏目
 * - 提供对齐展示的退出与重新启动操作；确认后分别调用
 *   remote.dshExit.exit() / remote.dshExit.restart()
 * - 重启成功后等待后台服务恢复并自动刷新页面
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
		const RESTART_BLUE = "var(--dsw-alias-state-business-primary)";

		/** Lucide power 图标（ISC 许可，免费），16px 线性风格贴合现有按钮。 */
		const EXIT_ICON_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/></svg>';
		const RESTART_ICON_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 0-15.5-6.2L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.5 6.2L21 16"/><path d="M16 16h5v5"/></svg>';

		const CSS_TEXT = [
			".dshExitSettings{box-sizing:border-box;max-width:720px;padding:28px 32px 40px;color:var(--dsw-alias-label-primary)}",
			".dshExitSettingsHeader{display:flex;align-items:flex-start;gap:14px;padding-bottom:22px;border-bottom:1px solid var(--dsw-alias-border-l2)}",
			".dshExitSettingsIcon{box-sizing:border-box;width:38px;height:38px;display:grid;place-items:center;flex:none;border:1px solid " + ERROR_RED + ";border-radius:12px;color:" + ERROR_RED + ";background:var(--dsw-alias-button-elevated-fill)}",
			".dshExitSettingsIcon svg{width:20px;height:20px}",
			".dshExitSettingsTitle{margin:0;font-size:20px;line-height:28px;font-weight:650;color:var(--dsw-alias-label-primary)}",
			".dshExitSettingsDescription{margin:6px 0 0;max-width:560px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
			".dshExitSettingsActions{display:flex;flex-direction:column;gap:12px;margin-top:24px}",
			".dshExitSettingsCard{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:14px;padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-2)}",
			".dshExitActionIcon{box-sizing:border-box;width:34px;height:34px;display:grid;place-items:center;border:1px solid currentColor;border-radius:10px;background:var(--dsw-alias-button-elevated-fill)}",
			".dshExitActionIcon--exit{color:" + ERROR_RED + "}",
			".dshExitActionIcon--restart{color:" + RESTART_BLUE + "}",
			".dshExitActionIcon svg{width:18px;height:18px}",
			".dshExitSettingsCopy{min-width:0}",
			".dshExitSettingsActionTitle{margin:0 0 3px;font-size:14px;line-height:20px;font-weight:650;color:var(--dsw-alias-label-primary)}",
			".dshExitSettingsWarning{margin:0;max-width:430px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
			".dshExitSettingsButton{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:none;min-width:112px;height:36px;padding:0 16px;cursor:pointer;border:0;border-radius:10px;color:#fff;font-size:13px;font-weight:650;transition:filter .12s ease,opacity .12s ease}",
			".dshExitSettingsButton--exit{background:" + ERROR_RED + "}",
			".dshExitSettingsButton--restart{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}",
			".dshExitSettingsButton svg{width:16px;height:16px}",
			".dshExitSettingsButton:hover:not(:disabled){filter:brightness(1.08)}",
			".dshExitSettingsButton--restart:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}",
			".dshExitSettingsButton:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:2px}",
			".dshExitSettingsButton:disabled{cursor:default;opacity:.6}",
			".dshExitNavCell{color:" + ERROR_RED + " !important}",
			".dshExitNavCell .dshExitNavLabel{color:" + ERROR_RED + " !important;font-weight:650}",
			".dshExitNavIcon{box-sizing:border-box;width:16px;height:16px;display:grid;place-items:center;flex:none;color:" + ERROR_RED + "}",
			".dshExitNavIcon svg{width:16px;height:16px}",
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
			".dshExitConfirm--restart{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}",
			".dshExitConfirm:hover:not(:disabled){filter:brightness(1.08)}",
			".dshExitConfirm--restart:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}",
			".dshExitConfirm:disabled{cursor:default;opacity:.6}",
			"@media (max-width:620px){.dshExitSettings{padding:24px 20px 32px}.dshExitSettingsCard{grid-template-columns:34px minmax(0,1fr)}.dshExitSettingsButton{grid-column:1 / -1;justify-self:start}}"
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
						schema: exitedClientSchema
					}
				}
			]
		};

		const NS = "dsh-exit";
		const DICT = {
			zh: {
				nav: "退出",
				title: "退出与重新启动 dsh",
				description: "从这里安全结束或重新启动 dsh 宿主进程，并管理它占用的端口。",
				exitActionTitle: "结束 dsh",
				exitWarning: "确认后将结束所有运行中的会话并停止后台服务，当前 dsh Web 端口 {endpoint} 会随之释放。",
				exitButton: "确认退出",
				restartActionTitle: "重新启动 dsh",
				restartWarning: "重新启动会短暂中断所有运行中的会话；后台服务恢复后，页面将自动刷新。",
				restartButton: "重新启动",
				dialogTitle: "退出 DeepSeek Harness？",
				dialogBody: "退出后将结束所有运行中的会话并停止后台服务，当前 dsh Web 端口 {endpoint} 会随之释放。",
				restartDialogTitle: "重新启动 DeepSeek Harness？",
				restartDialogBody: "这会结束当前运行中的会话，后台服务将释放并重新监听 {endpoint}。服务恢复后页面将自动刷新。",
				cancel: "取消",
				confirm: "确认退出",
				restartConfirm: "确认重启",
				exiting: "正在退出…",
				restarting: "正在重新启动…",
				restartWaiting: "后台服务正在重新启动，恢复后页面将自动刷新。",
				restartTimeout: "后台服务尚未恢复，请稍后手动刷新页面。",
				exitErrorPrefix: "退出失败：",
				restartErrorPrefix: "重启失败："
			},
			en: {
				nav: "Exit",
				title: "Exit or restart dsh",
				description: "Safely terminate or restart the dsh host process and manage the ports it owns.",
				exitActionTitle: "Exit dsh",
				exitWarning: "Confirming ends all running sessions and stops the background service, releasing the current dsh Web port {endpoint}.",
				exitButton: "Confirm exit",
				restartActionTitle: "Restart dsh",
				restartWarning: "Restarting briefly interrupts all running sessions; this page refreshes automatically after the service recovers.",
				restartButton: "Restart",
				dialogTitle: "Exit DeepSeek Harness?",
				dialogBody: "This ends all running sessions and stops the background service, releasing the current dsh Web port {endpoint}.",
				restartDialogTitle: "Restart DeepSeek Harness?",
				restartDialogBody: "This ends the current sessions while the background service releases and reclaims {endpoint}. The page refreshes automatically after recovery.",
				cancel: "Cancel",
				confirm: "Confirm exit",
				restartConfirm: "Confirm restart",
				exiting: "Exiting…",
				restarting: "Restarting…",
				restartWaiting: "The background service is restarting. This page will refresh after it recovers.",
				restartTimeout: "The background service has not recovered yet. Please refresh this page later.",
				exitErrorPrefix: "Exit failed: ",
				restartErrorPrefix: "Restart failed: "
			}
		};

		let overlayEl = null;
		let escHandler = null;
		let restartPollTimer = null;

		function injectCss() {
			if (document.querySelector("style[data-plugin-css='dsh-exit']")) return;
			const tag = document.createElement("style");
			tag.dataset.pluginCss = "dsh-exit";
			tag.textContent = CSS_TEXT;
			document.head.appendChild(tag);
		}

		function textOf(t, key, values = {}) {
			const raw = typeof t === "function" ? t(key, values) : DICT.zh[key] ?? key;
			return String(raw).replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => values[name] === undefined ? match : String(values[name]));
		}

		function currentDshEndpoint() {
			const location = globalThis.location;
			return location?.host || "当前 Web 端口";
		}

		/** dsh 的设置壳层为未知 section 使用齿轮图标；给本插件的导航项换成 power 图标。 */
		function decorateExitNav(t) {
			const labels = new Set(["退出", "Exit", textOf(t, "nav")]);
			for (const cell of document.querySelectorAll("nav button")) {
				const label = [...cell.querySelectorAll("span")].find((candidate) => labels.has(candidate.textContent.trim()));
				if (label === undefined) continue;
				cell.dataset.dshExitNav = "true";
				cell.classList.add("dshExitNavCell");
				label.classList.add("dshExitNavLabel");
				if (cell.querySelector(".dshExitNavIcon") !== null) continue;
				const originalIcon = cell.firstElementChild;
				const icon = document.createElement("span");
				icon.className = "dshExitNavIcon";
				icon.innerHTML = EXIT_ICON_SVG;
				if (originalIcon !== null && originalIcon !== label) {
					originalIcon.dataset.dshExitOriginalIcon = "true";
					originalIcon.style.display = "none";
					cell.insertBefore(icon, originalIcon);
				} else {
					cell.insertBefore(icon, label);
				}
			}
		}

		function clearDecoratedExitNav() {
			for (const cell of document.querySelectorAll("[data-dsh-exit-nav='true']")) {
				cell.querySelector(".dshExitNavIcon")?.remove();
				cell.querySelector("[data-dsh-exit-original-icon='true']")?.style.removeProperty("display");
				cell.querySelector(".dshExitNavLabel")?.classList.remove("dshExitNavLabel");
				cell.classList.remove("dshExitNavCell");
				delete cell.dataset.dshExitNav;
			}
		}

		function ExitSettingsSection({ ctx, t }) {
			const endpoint = currentDshEndpoint();
			const actionCard = ({ action, icon, title, warning, button }) => h("div", {
				className: "dshExitSettingsCard",
				key: action
			}, [
				h("span", {
					className: "dshExitActionIcon dshExitActionIcon--" + action,
					dangerouslySetInnerHTML: { __html: icon },
					"aria-hidden": "true",
					key: "icon"
				}),
				h("div", { className: "dshExitSettingsCopy", key: "copy" }, [
					h("h3", { className: "dshExitSettingsActionTitle", key: "title" }, textOf(t, title)),
					h("p", { className: "dshExitSettingsWarning", key: "warning" }, textOf(t, warning, { endpoint }))
				]),
				h("button", {
					type: "button",
					className: "dshExitSettingsButton dshExitSettingsButton--" + action,
					"aria-label": textOf(t, button),
					onClick: (event) => openModal(ctx, event.currentTarget, t, action),
					key: "button"
				}, [
					h("span", { dangerouslySetInnerHTML: { __html: icon }, "aria-hidden": "true", key: "icon" }),
					textOf(t, button)
				])
			]);
			return h("section", {
				className: "dshExitSettings",
				"aria-labelledby": "dsh-exit-settings-title"
			}, [
				h("div", { className: "dshExitSettingsHeader", key: "header" }, [
					h("span", {
						className: "dshExitSettingsIcon",
						dangerouslySetInnerHTML: { __html: EXIT_ICON_SVG },
						key: "icon"
					}),
					h("div", { key: "copy" }, [
						h("h2", { className: "dshExitSettingsTitle", id: "dsh-exit-settings-title", key: "title" }, textOf(t, "title")),
						h("p", { className: "dshExitSettingsDescription", key: "description" }, textOf(t, "description"))
					])
				]),
				h("div", { className: "dshExitSettingsActions", key: "actions" }, [
					actionCard({
						action: "exit",
						icon: EXIT_ICON_SVG,
						title: "exitActionTitle",
						warning: "exitWarning",
						button: "exitButton"
					}),
					actionCard({
						action: "restart",
						icon: RESTART_ICON_SVG,
						title: "restartActionTitle",
						warning: "restartWarning",
						button: "restartButton"
					})
				])
			]);
		}

		function closeModal() {
			if (restartPollTimer !== null) {
				clearTimeout(restartPollTimer);
				restartPollTimer = null;
			}
			if (escHandler) {
				document.removeEventListener("keydown", escHandler);
				escHandler = null;
			}
			if (overlayEl) {
				overlayEl.remove();
				overlayEl = null;
			}
		}

		function waitForRestart({ title, body, errorEl, actions, cancel, confirm, t }) {
			const startedAt = Date.now();
			let sawUnavailable = false;
			title.textContent = textOf(t, "restarting");
			body.textContent = textOf(t, "restartWaiting");
			actions.style.display = "none";
			const check = async () => {
				try {
					const response = await fetch("/?dshRestartProbe=" + Date.now(), { cache: "no-store" });
					if (response.ok && (sawUnavailable || Date.now() - startedAt >= 5_000)) {
						globalThis.location.reload();
						return;
					}
				} catch {
					sawUnavailable = true;
				}
				if (Date.now() - startedAt >= 60_000) {
					restartPollTimer = null;
					errorEl.textContent = textOf(t, "restartTimeout");
					actions.style.removeProperty("display");
					confirm.style.display = "none";
					cancel.disabled = false;
					return;
				}
				restartPollTimer = setTimeout(check, 500);
			};
			restartPollTimer = setTimeout(check, 800);
		}

		function openModal(ctx, actionBtn, t, action) {
			const endpoint = currentDshEndpoint();
			const isRestart = action === "restart";
			const keys = isRestart ? {
				title: "restartDialogTitle",
				body: "restartDialogBody",
				confirm: "restartConfirm",
				pending: "restarting",
				button: "restartButton",
				error: "restartErrorPrefix"
			} : {
				title: "dialogTitle",
				body: "dialogBody",
				confirm: "confirm",
				pending: "exiting",
				button: "exitButton",
				error: "exitErrorPrefix"
			};
			const text = (key) => textOf(t, key, { endpoint });
			closeModal();
			overlayEl = document.createElement("div");
			overlayEl.className = "dshExitOverlay";
			const panel = document.createElement("div");
			panel.className = "dshExitModal";
			panel.setAttribute("role", "dialog");
			panel.setAttribute("aria-modal", "true");
			panel.setAttribute("aria-label", text(keys.title));
			const title = document.createElement("h3");
			title.className = "dshExitTitle";
			title.textContent = text(keys.title);
			const body = document.createElement("p");
			body.className = "dshExitBody";
			body.textContent = text(keys.body);
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
			confirm.className = "dshExitConfirm" + (isRestart ? " dshExitConfirm--restart" : "");
			confirm.textContent = text(keys.confirm);
			actions.append(cancel, confirm);
			panel.append(title, body, errorEl, actions);
			overlayEl.appendChild(panel);

			escHandler = (event) => {
				if (event.key === "Escape" && !cancel.disabled) closeModal();
			};
			document.addEventListener("keydown", escHandler);
			overlayEl.addEventListener("click", (event) => {
				if (event.target === overlayEl && !cancel.disabled) closeModal();
			});
			cancel.addEventListener("click", () => {
				if (!cancel.disabled) closeModal();
			});
			confirm.addEventListener("click", () => {
				confirm.disabled = true;
				cancel.disabled = true;
				errorEl.textContent = "";
				actionBtn.disabled = true;
				actionBtn.setAttribute("aria-label", text(keys.pending));
				Promise.resolve()
					.then(() => {
						const service = ctx.get("remote.dshExit");
						if (service === undefined) throw new Error("dsh-exit 服务不可用（宿主未注册？）");
						if (typeof service[action] !== "function") throw new Error("dsh-exit 不支持 " + action + " 操作");
						return service[action]();
						})
					.then((result) => {
						if (!result || result.ok !== true) {
							throw new Error((result && result.error && result.error.message) || action + " 调用失败");
						}
						if (isRestart) {
							waitForRestart({ title, body, errorEl, actions, cancel, confirm, t });
						} else {
							closeModal();
						}
					})
					.catch((reason) => {
						confirm.disabled = false;
						cancel.disabled = false;
						actionBtn.disabled = false;
						actionBtn.setAttribute("aria-label", text(keys.button));
						errorEl.textContent = text(keys.error) + (reason instanceof Error ? reason.message : String(reason));
					});
			});
			document.body.appendChild(overlayEl);
		}

		async function apply(ctx) {
			injectCss();
			ctx.effect(() => ctx.locale.register(NS, DICT), "dsh-exit: settings dictionaries");
			const t = ctx.locale.bind(NS);
			const decorate = () => decorateExitNav(t);
			decorate();
			const navObserver = document.body === null ? null : new MutationObserver(decorate);
			navObserver?.observe(document.body, { childList: true, subtree: true, characterData: true });
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
				navObserver?.disconnect();
				clearDecoratedExitNav();
				closeModal();
				disposeRemote();
			};
		}

		exports.inject = ["slots", "locale", "remote"];
		exports.apply = apply;
		return module.exports;
	}
});
//#endregion
