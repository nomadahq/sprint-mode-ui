import { useEffect as e, useState as t } from "react";
import { jsx as n, jsxs as r } from "react/jsx-runtime";
//#region src/SiteHeader.tsx
function i() {
	try {
		var e = localStorage.getItem("sm-theme");
		if (e === "light" || e === "dark") return e;
	} catch {}
	return "auto";
}
function a(e) {
	try {
		e === "auto" ? localStorage.removeItem("sm-theme") : localStorage.setItem("sm-theme", e);
	} catch {}
}
function o(e) {
	return e === "dark" ? !0 : e === "light" ? !1 : typeof window < "u" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : !1;
}
function s(e) {
	if (!(typeof document > "u")) {
		var t = e === "auto" ? o("auto") ? "dark" : "light" : e;
		document.documentElement.setAttribute("data-theme", t);
	}
}
function c() {
	var n = t(i), r = n[0], c = n[1], l = t(function() {
		return o(r);
	}), u = l[0], d = l[1];
	return e(function() {
		s(r), a(r), d(o(r));
	}, [r]), e(function() {
		if (r === "auto" && !(typeof window > "u" || !window.matchMedia)) {
			var e = window.matchMedia("(prefers-color-scheme: dark)"), t = function(e) {
				d(e.matches), s("auto");
			};
			return e.addEventListener ? e.addEventListener("change", t) : e.addListener && e.addListener(t), function() {
				e.removeEventListener ? e.removeEventListener("change", t) : e.removeListener && e.removeListener(t);
			};
		}
	}, [r]), {
		mode: r,
		isDark: u,
		toggle: function() {
			c(function(e) {
				return e === "auto" ? "dark" : e === "dark" ? "light" : "auto";
			});
		}
	};
}
function l(e, t, n) {
	return e + "/portals/" + encodeURIComponent(t) + "/" + n;
}
var u = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 16,
	height: 16,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
};
function d(e) {
	return /* @__PURE__ */ r("svg", {
		...u,
		...e,
		children: [
			/* @__PURE__ */ n("circle", {
				cx: "12",
				cy: "12",
				r: "5"
			}),
			/* @__PURE__ */ n("line", {
				x1: "12",
				y1: "1",
				x2: "12",
				y2: "3"
			}),
			/* @__PURE__ */ n("line", {
				x1: "12",
				y1: "21",
				x2: "12",
				y2: "23"
			}),
			/* @__PURE__ */ n("line", {
				x1: "4.22",
				y1: "4.22",
				x2: "5.64",
				y2: "5.64"
			}),
			/* @__PURE__ */ n("line", {
				x1: "18.36",
				y1: "18.36",
				x2: "19.78",
				y2: "19.78"
			}),
			/* @__PURE__ */ n("line", {
				x1: "1",
				y1: "12",
				x2: "3",
				y2: "12"
			}),
			/* @__PURE__ */ n("line", {
				x1: "21",
				y1: "12",
				x2: "23",
				y2: "12"
			}),
			/* @__PURE__ */ n("line", {
				x1: "4.22",
				y1: "19.78",
				x2: "5.64",
				y2: "18.36"
			}),
			/* @__PURE__ */ n("line", {
				x1: "18.36",
				y1: "5.64",
				x2: "19.78",
				y2: "4.22"
			})
		]
	});
}
function f(e) {
	return /* @__PURE__ */ n("svg", {
		...u,
		...e,
		children: /* @__PURE__ */ n("path", { d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" })
	});
}
function p(e) {
	return /* @__PURE__ */ r("svg", {
		...u,
		...e,
		children: [
			/* @__PURE__ */ n("rect", {
				x: "3",
				y: "4",
				width: "18",
				height: "12",
				rx: "1"
			}),
			/* @__PURE__ */ n("line", {
				x1: "7",
				y1: "20",
				x2: "17",
				y2: "20"
			}),
			/* @__PURE__ */ n("line", {
				x1: "9",
				y1: "16",
				x2: "9",
				y2: "20"
			}),
			/* @__PURE__ */ n("line", {
				x1: "15",
				y1: "16",
				x2: "15",
				y2: "20"
			})
		]
	});
}
var m = ".smsh{background:var(--bg-card,var(--bg));border-bottom:1px solid var(--border);position:sticky;top:0;z-index:9000;flex-shrink:0}.smsh__inner{display:flex;align-items:center;justify-content:space-between;height:56px;padding:0 20px;gap:16px;max-width:var(--max-w,80rem);margin:0 auto}.smsh__brand{display:flex;align-items:baseline;gap:8px;text-decoration:none;color:var(--foreground);flex-shrink:0;min-width:0}.smsh__logo{height:26px;width:auto;display:block}.smsh__name{font-size:17px;font-weight:500;letter-spacing:-0.3px}.smsh__byline{font-size:13px;font-weight:400;color:var(--muted);white-space:nowrap}.smsh__right{display:flex;align-items:center;gap:10px}.smsh__nav{display:flex;align-items:center;gap:20px;margin-right:6px}.smsh__nav a{font-size:14px;text-decoration:none;font-family:var(--font);color:var(--muted);white-space:nowrap}.smsh__nav a[data-active=\"true\"]{color:var(--foreground);font-weight:600}.smsh__pill{height:34px;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:0 10px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);font-family:var(--font);flex-shrink:0;transition:border-color .2s;box-sizing:border-box}.smsh__pill:hover{border-color:var(--accent)}.smsh__pill-label{font-size:11px;font-weight:500;letter-spacing:.3px}.smsh__signin{display:flex;align-items:center;height:34px;padding:0 14px;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;text-decoration:none;font-family:var(--font);flex-shrink:0;box-sizing:border-box;white-space:nowrap}.smsh__signin:hover{opacity:.9}@media (max-width:680px){.smsh__inner{padding:0 14px;gap:10px}.smsh__byline{display:none}.smsh__nav{display:none}.smsh__pill-label{display:none}.smsh__pill{padding:0 9px}}";
function h(i) {
	var a = c(), o = i.navLinks || [], s = i.byline === void 0 ? "by Sprint Mode" : i.byline, u = i.homeHref || "/", h = i.signInLabel || "Sign in", g = t(i.config || null), _ = g[0], v = g[1];
	e(function() {
		if (i.config) {
			v(i.config);
			return;
		}
		if (i.subdomain && !(typeof fetch > "u")) {
			var e = i.apiBase || "https://api.sprintmode.ai", t = !1;
			return fetch(e + "/api/portal/config?subdomain=" + encodeURIComponent(i.subdomain)).then(function(e) {
				return e.json();
			}).then(function(e) {
				!t && e && e.ok && e.config && v(e.config);
			}).catch(function() {}), function() {
				t = !0;
			};
		}
	}, [
		i.subdomain,
		i.apiBase,
		i.config
	]), e(function() {
		!_ || typeof document > "u" || (_.brand_color && document.documentElement.style.setProperty("--accent", String(_.brand_color)), _.brand_tint && document.documentElement.style.setProperty("--accent-10", String(_.brand_tint)));
	}, [_]);
	var y = i.apiBase || "https://api.sprintmode.ai", b = i.subdomain, x = _ && _.name || "Sprint Mode", S = _ && _.logo_horizontal_url || (b ? l(y, b, "logo_horizontal.png") : null), C = _ && _.logo_dark_url || (b ? l(y, b, "logo_horizontal_dark.png") : null), w = a.isDark && C || S, T = t(!0), E = T[0], D = T[1];
	e(function() {
		D(!0);
	}, [w]);
	var O = a.mode === "auto" ? "Auto" : a.mode === "dark" ? "Dark" : "Light", k = a.mode === "auto" ? "Theme: System" : a.mode === "dark" ? "Theme: Dark" : "Theme: Light", A = typeof window < "u" ? window.location.pathname : "", j = a.mode === "light" ? d : a.mode === "dark" ? f : p;
	return /* @__PURE__ */ r("header", {
		className: "smsh",
		children: [/* @__PURE__ */ n("style", { dangerouslySetInnerHTML: { __html: m } }), /* @__PURE__ */ r("div", {
			className: "smsh__inner",
			children: [/* @__PURE__ */ r("a", {
				href: u,
				className: "smsh__brand",
				children: [w && E ? /* @__PURE__ */ r("picture", {
					style: {
						display: "flex",
						alignItems: "center"
					},
					children: [C ? /* @__PURE__ */ n("source", {
						srcSet: C,
						media: "(prefers-color-scheme: dark)"
					}) : null, /* @__PURE__ */ n("img", {
						className: "smsh__logo",
						src: w,
						alt: x,
						onError: function() {
							D(!1);
						}
					})]
				}) : /* @__PURE__ */ n("span", {
					className: "smsh__name",
					children: x
				}), s ? /* @__PURE__ */ n("span", {
					className: "smsh__byline",
					children: s
				}) : null]
			}), /* @__PURE__ */ r("div", {
				className: "smsh__right",
				children: [
					o.length > 0 ? /* @__PURE__ */ n("nav", {
						className: "smsh__nav",
						children: o.map(function(e) {
							var t = !e.external && A === e.href;
							return /* @__PURE__ */ n("a", {
								href: e.href,
								"data-active": t ? "true" : "false",
								...e.external ? {
									target: "_blank",
									rel: "noopener noreferrer"
								} : {},
								children: e.label
							}, e.href);
						})
					}) : null,
					/* @__PURE__ */ r("button", {
						className: "smsh__pill",
						onClick: a.toggle,
						"aria-label": k,
						title: k,
						children: [/* @__PURE__ */ n(j, {}), /* @__PURE__ */ n("span", {
							className: "smsh__pill-label",
							children: O
						})]
					}),
					i.signInHref ? /* @__PURE__ */ n("a", {
						className: "smsh__signin",
						href: i.signInHref,
						children: h
					}) : null,
					i.rightSlot
				]
			})]
		})]
	});
}
//#endregion
//#region src/site-helpers.ts
var g = "(function(){try{var t=localStorage.getItem('sm-theme');var d=(t==='dark'||t==='light')?t:((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');document.documentElement.setAttribute('data-theme',d);}catch(e){}})();";
function _() {
	if (!(typeof document > "u")) {
		var e = null;
		try {
			e = localStorage.getItem("sm-theme");
		} catch {}
		var t = e === "dark" || e === "light" ? e : typeof window < "u" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
		document.documentElement.setAttribute("data-theme", t);
	}
}
function v(e, t) {
	return e ? e + " — " + t : t;
}
function y(e, t) {
	typeof document < "u" && (document.title = v(e, t));
}
function b(t, n) {
	e(function() {
		y(t, n);
	}, [t, n]);
}
//#endregion
export { b as a, g as i, v as n, h as o, y as r, _ as t };
