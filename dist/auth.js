//#region src/auth.ts
async function e(e, t) {
	var n = {
		alg: "HS256",
		typ: "JWT"
	}, r = new TextEncoder(), i = await crypto.subtle.importKey("raw", r.encode(t), {
		name: "HMAC",
		hash: "SHA-256"
	}, !1, ["sign"]), a = btoa(JSON.stringify(n)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"), o = btoa(JSON.stringify(e)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"), s = a + "." + o, c = await crypto.subtle.sign("HMAC", i, r.encode(s)), l = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(c)))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
	return s + "." + l;
}
async function t(e, t) {
	try {
		var n = e.split(".");
		if (n.length !== 3) return null;
		var r = new TextEncoder(), i = await crypto.subtle.importKey("raw", r.encode(t), {
			name: "HMAC",
			hash: "SHA-256"
		}, !1, ["verify"]);
		function s(e) {
			return e + "===".slice((e.length + 3) % 4);
		}
		var a = Uint8Array.from(atob(s(n[2].replace(/-/g, "+").replace(/_/g, "/"))), function(e) {
			return e.charCodeAt(0);
		});
		if (!await crypto.subtle.verify("HMAC", i, a, r.encode(n[0] + "." + n[1]))) return null;
		var o = JSON.parse(atob(s(n[1].replace(/-/g, "+").replace(/_/g, "/"))));
		return typeof o.exp == "number" && o.exp < Math.floor(Date.now() / 1e3) ? null : o;
	} catch {
		return null;
	}
}
function n(e, t) {
	var n = e.headers.get("Cookie") || "", r = t || null;
	if (!r) try {
		var i = new URL(e.url).hostname;
		i.endsWith(".sprintmode.ai") && (r = i.split(".")[0]);
	} catch {}
	if (r && /^[a-z0-9-]+$/i.test(r)) {
		var a = n.match(RegExp("(?:^|;\\s*)sm_session_" + r + "=([^;]+)"));
		if (a) return a[1];
	}
	var o = n.match(/sm_client=([^;]+)/);
	return o ? o[1] : null;
}
async function r(e, r, i) {
	var a = n(e, i);
	return a ? await t(a, r.JWT_SECRET) : null;
}
function i() {
	for (var e = "abcdefghijklmnopqrstuvwxyz0123456789", t = "", n = crypto.getRandomValues(new Uint8Array(48)), r = 0; r < 48; r++) t += e[n[r] % e.length];
	return t;
}
function a(e) {
	var t = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(function(e) {
		return e.toString(16).padStart(2, "0");
	}).join("");
	return e + "_" + t;
}
var o = "0.1.0", s = "https://api.sprintmode.ai";
function c(e, t) {
	var n = t && t.baseUrl || e.SM_API_URL || s;
	async function r(t, r, i, a) {
		var s = {
			"Content-Type": "application/json",
			"X-SM-Platform": "sm-ui/" + o,
			"CF-Access-Client-Id": e.SM_API_CLIENT_ID || "",
			"CF-Access-Client-Secret": e.SM_API_CLIENT_SECRET || ""
		};
		a && Object.keys(a).forEach(function(e) {
			s[e] = a[e];
		});
		var c = {
			method: t,
			headers: s
		};
		i && t !== "GET" && (c.body = JSON.stringify(i));
		var l = await fetch(n + r, c);
		if (!l.ok) {
			var u = await l.text(), d;
			try {
				d = JSON.parse(u);
			} catch {
				d = {
					ok: !1,
					error: u
				};
			}
			return d._status = l.status, d;
		}
		return l.json();
	}
	return {
		get: function(e, t) {
			return r("GET", e, null, t);
		},
		post: function(e, t, n) {
			return r("POST", e, t, n);
		},
		patch: function(e, t, n) {
			return r("PATCH", e, t, n);
		},
		put: function(e, t, n) {
			return r("PUT", e, t, n);
		},
		del: function(e, t) {
			return r("DELETE", e, null, t);
		},
		withCookie: function(e) {
			return {
				get: function(t) {
					return r("GET", t, null, { Cookie: e });
				},
				post: function(t, n) {
					return r("POST", t, n, { Cookie: e });
				},
				patch: function(t, n) {
					return r("PATCH", t, n, { Cookie: e });
				},
				put: function(t, n) {
					return r("PUT", t, n, { Cookie: e });
				},
				del: function(t) {
					return r("DELETE", t, null, { Cookie: e });
				}
			};
		}
	};
}
//#endregion
export { c as createSmApiClient, a as generateId, i as generateToken, n as getSession, r as requireAuth, e as signJWT, t as verifyJWT };
