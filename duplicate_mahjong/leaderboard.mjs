var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// duplicate/engine/rules.mjs
var DEFAULT_RULES = Object.freeze({
  id: "duplicate-riichi-v1",
  variant: "D",
  dora: true,
  kanDora: true,
  uraDora: true,
  redDora: true,
  deadWall: true,
  exhaustLimit: 1,
  kuitan: true,
  multipleRon: "all",
  startingPoints: 25e3,
  maxKans: 4,
  roundWind: 27,
  abortFourKans: true
});

// duplicate/engine/duplicate-profile.mjs
var milRules = Object.freeze({
  dora: false,
  kanDora: false,
  uraDora: false,
  redDora: false,
  deadWall: false,
  exhaustLimit: 1,
  multipleRon: "all",
  abortFourKans: false
});

// duplicate/action-statistics.mjs
var STAT_KEYS = Object.freeze(["discard", "riichi", "call", "kan", "win", "dealIn"]);
var METRICS = Object.freeze([
  ["call", "\uD6C4\uB85C", "neutral"],
  ["riichi", "\uB9AC\uCE58", "neutral"],
  ["kan", "\uAE61", "neutral"],
  ["win", "\uD654\uB8CC", "higher"],
  ["dealIn", "\uBC29\uCD1D", "lower"]
]);
var integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
var plain = (value) => !!value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value));
var MAX_HANDS = Math.floor(Number.MAX_SAFE_INTEGER / 140);
function validateActionStats(stats, hands = 1) {
  if (!integer(hands, 1, MAX_HANDS) || !plain(stats) || Reflect.ownKeys(stats).length !== STAT_KEYS.length || !Reflect.ownKeys(stats).every((key) => STAT_KEYS.includes(key)) || !STAT_KEYS.every((key) => integer(stats[key], 0, hands * (key === "discard" ? 140 : ["call", "kan"].includes(key) ? 4 : 1))) || stats.riichi > stats.discard || stats.win + stats.dealIn > hands) throw Error("Invalid action statistics");
  return Object.fromEntries(STAT_KEYS.map((key) => [key, stats[key]]));
}

// duplicate/daily-challenge.mjs
var DAILY_VERSION = 1;
var DAILY_RULES = Object.freeze({
  id: "duplicate-riichi-v1",
  variant: "D",
  dora: true,
  kanDora: true,
  uraDora: true,
  redDora: true,
  deadWall: false,
  exhaustLimit: 1,
  kuitan: true,
  multipleRon: "all",
  startingPoints: 25e3,
  maxKans: 4,
  roundWind: 27,
  abortFourKans: false
});
function checkedDate(date) {
  if (typeof date !== "string" || !/^20\d\d-\d\d-\d\d$/.test(date)) throw Error("Invalid daily date");
  const value = /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== date) throw Error("Invalid daily date");
  return date;
}
function dailyDate(now = /* @__PURE__ */ new Date()) {
  const value = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(value)) throw Error("Invalid daily clock");
  return checkedDate(new Date(value + 9 * 36e5).toISOString().slice(0, 10));
}
function dailySeed(date = dailyDate()) {
  let hash = 2166136261;
  for (const character of `duplicate-daily-v${DAILY_VERSION}:${checkedDate(date)}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash || 1;
}

// duplicate/accounts/protocol.mjs
var protocol_exports = {};
__export(protocol_exports, {
  ACCOUNT_PROTOCOL: () => ACCOUNT_PROTOCOL,
  PRIVACY_VERSION: () => PRIVACY_VERSION,
  SESSION_TTL_MS: () => SESSION_TTL_MS,
  base64url: () => base64url,
  decryptAccountRequest: () => decryptAccountRequest,
  decryptAccountResult: () => decryptAccountResult,
  encryptAccountRequest: () => encryptAccountRequest,
  encryptAccountResult: () => encryptAccountResult,
  fromBase64url: () => fromBase64url,
  randomSecret: () => randomSecret,
  sha256: () => sha256,
  signAccountSession: () => signAccountSession,
  validateNickname: () => validateNickname,
  validatePassword: () => validatePassword,
  verifyAccountSession: () => verifyAccountSession
});
var ACCOUNT_PROTOCOL = "duplicate-accounts-v1";
var PRIVACY_VERSION = "2026-10-20-v1";
var SESSION_TTL_MS = 8 * 60 * 60 * 1e3;
var encoder = new TextEncoder();
var decoder = new TextDecoder("utf-8", { fatal: true });
var requestAAD = encoder.encode(`${ACCOUNT_PROTOCOL}:request`);
var resultAAD = encoder.encode(`${ACCOUNT_PROTOCOL}:result`);
var clock = (value) => typeof value === "function" ? value() : value;
var object = (value) => value && typeof value === "object" && !Array.isArray(value);
function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function fromBase64url(value, max = 16384) {
  if (typeof value !== "string" || !value.length || value.length > max || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error("Invalid encoded account data");
  const text = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}
function randomSecret() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
async function sha256(value) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))].map((n) => n.toString(16).padStart(2, "0")).join("");
}
function validateNickname(value) {
  if (typeof value !== "string") throw Error("\uB2C9\uB124\uC784\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
  const nickname = value.normalize("NFKC").trim();
  if ([...nickname].length < 1 || [...nickname].length > 20 || /[\u0000-\u001f\u007f-\u009f]/u.test(nickname)) throw Error("\uB2C9\uB124\uC784\uC740 \uC81C\uC5B4\uBB38\uC790 \uC5C6\uC774 1\u201320\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
  return { nickname, normalized: nickname.toLowerCase() };
}
function validatePassword(value) {
  if (typeof value !== "string" || [...value].length < 15 || [...value].length > 128 || encoder.encode(value).length > 512) throw Error("\uBE44\uBC00\uBC88\uD638\uB294 15\u2013128\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
  return value;
}
var encode = (value) => {
  if (!object(value)) throw Error("Invalid account payload");
  const bytes = encoder.encode(JSON.stringify(value));
  if (bytes.length > 8192) throw Error("Account payload is too large");
  return bytes;
};
var decode = (bytes) => {
  const result = JSON.parse(decoder.decode(bytes));
  if (!object(result)) throw Error("Invalid account payload");
  return result;
};
async function encryptAccountRequest(payload, publicJwk) {
  const publicKey = await crypto.subtle.importKey("jwk", publicJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const rawKey = crypto.getRandomValues(new Uint8Array(32)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
  const [wrappedKey, ciphertext] = await Promise.all([
    crypto.subtle.encrypt("RSA-OAEP", publicKey, rawKey),
    crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: requestAAD }, key, encode(payload))
  ]);
  rawKey.fill(0);
  return { envelope: { wrappedKey: base64url(wrappedKey), iv: base64url(iv), ciphertext: base64url(ciphertext) }, key };
}
async function decryptAccountRequest(envelope, privateJwk) {
  if (!object(envelope)) throw Error("Invalid account envelope");
  const iv = fromBase64url(envelope.iv, 32);
  if (iv.length !== 12) throw Error("Invalid account IV");
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  const rawKey = new Uint8Array(await crypto.subtle.decrypt("RSA-OAEP", privateKey, fromBase64url(envelope.wrappedKey, 1024)));
  if (rawKey.length !== 32) throw Error("Invalid account key");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
  rawKey.fill(0);
  const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: requestAAD }, key, fromBase64url(envelope.ciphertext));
  return { payload: decode(bytes), key };
}
async function encryptAccountResult(payload, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12)), ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: resultAAD }, key, encode(payload));
  return { iv: base64url(iv), ciphertext: base64url(ciphertext) };
}
async function decryptAccountResult(envelope, key) {
  if (!object(envelope)) throw Error("Invalid account result");
  const iv = fromBase64url(envelope.iv, 32);
  if (iv.length !== 12) throw Error("Invalid account IV");
  return decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: resultAAD }, key, fromBase64url(envelope.ciphertext)));
}
async function signAccountSession(user, privateJwk, { now = Date.now, jti = crypto.randomUUID() } = {}) {
  const time = clock(now), { nickname } = validateNickname(user.nickname);
  if (!/^[a-f0-9-]{36}$/.test(user.id ?? "") || !Number.isSafeInteger(user.version) || user.version < 0 || !Number.isSafeInteger(time) || !/^[-a-zA-Z0-9_]{8,128}$/.test(jti)) throw Error("Invalid account session");
  const claims = { iss: ACCOUNT_PROTOCOL, aud: "duplicate-tournament", sub: user.id, nickname, ver: user.version, jti, iat: Math.floor(time / 1e3), exp: Math.floor((time + SESSION_TTL_MS) / 1e3) };
  const body = [{ alg: "EdDSA", typ: "JWT" }, claims].map((value) => base64url(encoder.encode(JSON.stringify(value)))).join(".");
  const key = await crypto.subtle.importKey("jwk", privateJwk, "Ed25519", false, ["sign"]);
  const signature = await crypto.subtle.sign("Ed25519", key, encoder.encode(body));
  return { token: `${body}.${base64url(signature)}`, expiresAt: claims.exp * 1e3, sessionId: jti };
}
async function verifyAccountSession(token, publicJwk, { now = Date.now } = {}) {
  if (typeof token !== "string" || token.length > 4096) throw Error("\uACC4\uC815 \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
  const parts = token.split(".");
  if (parts.length !== 3) throw Error("\uACC4\uC815 \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
  const header = decode(fromBase64url(parts[0], 256)), claims = decode(fromBase64url(parts[1], 2048));
  if (header.alg !== "EdDSA" || header.typ !== "JWT" || Object.keys(header).some((name) => !["alg", "typ"].includes(name))) throw Error("\uACC4\uC815 \uC778\uC99D \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  const key = await crypto.subtle.importKey("jwk", publicJwk, "Ed25519", false, ["verify"]);
  if (!await crypto.subtle.verify("Ed25519", key, fromBase64url(parts[2], 128), encoder.encode(`${parts[0]}.${parts[1]}`))) throw Error("\uACC4\uC815 \uC778\uC99D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
  const time = clock(now), nickname = validateNickname(claims.nickname).nickname;
  if (claims.iss !== ACCOUNT_PROTOCOL || claims.aud !== "duplicate-tournament" || !/^[a-f0-9-]{36}$/.test(claims.sub ?? "") || !/^[-a-zA-Z0-9_]{8,128}$/.test(claims.jti ?? "") || !Number.isSafeInteger(claims.ver) || claims.ver < 0 || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.iat * 1e3 > time + 3e4 || claims.exp * 1e3 <= time || claims.exp <= claims.iat || (claims.exp - claims.iat) * 1e3 > SESSION_TTL_MS) throw Error("\uACC4\uC815 \uB85C\uADF8\uC778\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.");
  return { id: claims.sub, nickname, version: claims.ver, sessionId: claims.jti, expiresAt: claims.exp * 1e3 };
}

// duplicate/accounts/client.mjs
var SESSION_KEY = "duplicate.account.v1";
var abortError = () => Object.assign(new Error("\uACC4\uC815 \uC694\uCCAD\uC744 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4."), { name: "AbortError" });
function normalizeAccountServer(server) {
  const origin = new URL(server);
  if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || origin.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw Error("\uACC4\uC815 \uC11C\uBC84 \uC8FC\uC18C\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
  return origin.origin;
}
function createAccountClient({ server, storage = globalThis.sessionStorage, fetchImpl = globalThis.fetch, cryptoProtocol = protocol_exports, now = Date.now, sleep = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(done, ms);
  function done() {
    signal?.removeEventListener("abort", cancel);
    resolve();
  }
  function cancel() {
    clearTimeout(timer);
    reject(abortError());
  }
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
}), timeoutMs = 6e4 } = {}) {
  const origin = new URL(normalizeAccountServer(server));
  let session = null;
  const listeners = /* @__PURE__ */ new Set(), pending = /* @__PURE__ */ new Set();
  function valid(value) {
    return value && typeof value.token === "string" && value.token.length > 0 && Number.isFinite(value.expiresAt) && value.expiresAt > now() && typeof value.user?.id === "string" && typeof value.user?.nickname === "string";
  }
  function publish(value) {
    session = valid(value) ? { user: { id: value.user.id, nickname: value.user.nickname }, token: value.token, expiresAt: value.expiresAt } : null;
    try {
      if (session) storage?.setItem(SESSION_KEY, JSON.stringify({ ...session, server: origin.origin }));
      else {
        const saved = JSON.parse(storage?.getItem(SESSION_KEY) || "null");
        if (!saved?.server || saved.server === origin.origin) storage?.removeItem(SESSION_KEY);
      }
    } catch {
    }
    for (const listener of listeners) listener(getSession());
  }
  try {
    const saved = JSON.parse(storage?.getItem(SESSION_KEY) || "null");
    if (valid(saved) && saved.server === origin.origin) session = { user: { id: saved.user.id, nickname: saved.user.nickname }, token: saved.token, expiresAt: saved.expiresAt };
    else if (saved?.server === origin.origin || !saved?.server) storage?.removeItem(SESSION_KEY);
  } catch {
  }
  function getSession() {
    if (session && !valid(session)) publish(null);
    return session ? structuredClone(session) : null;
  }
  async function json(path, options, signal) {
    const response = await fetchImpl(`${origin.origin}/api/duplicate${path}`, { ...options, signal, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
    let data;
    try {
      data = await response.json();
    } catch {
      throw Error("\uACC4\uC815 \uC11C\uBC84 \uC751\uB2F5\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (!response.ok) throw Object.assign(Error(data?.error ?? "\uACC4\uC815 \uC11C\uBC84\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."), { status: response.status });
    return data;
  }
  async function capabilities({ signal } = {}) {
    return json("/accounts/capabilities", { method: "GET", headers: { Accept: "application/json" } }, signal);
  }
  async function operation(name, fields = {}, authenticated = false) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 6e4));
    pending.add(controller);
    try {
      const current = getSession();
      if (authenticated && !current) throw Error("\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      const cap = await capabilities({ signal: controller.signal });
      if (!cap.available || !cap.encryptionKey || cap.protocol !== cryptoProtocol.ACCOUNT_PROTOCOL) throw Error("\uACC4\uC815 \uC11C\uBE44\uC2A4\uAC00 \uC5F0\uACB0\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAC8C\uC784\uC740 \uC190\uB2D8\uC73C\uB85C \uC774\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      const clean = { ...fields };
      if ("nickname" in clean && cryptoProtocol.validateNickname) clean.nickname = cryptoProtocol.validateNickname(clean.nickname).nickname;
      for (const field of ["password", "newPassword"]) if (field in clean && cryptoProtocol.validatePassword) cryptoProtocol.validatePassword(clean[field]);
      const payload = { operation: name, ...clean, ...authenticated ? { token: current.token } : {} }, encrypted = await cryptoProtocol.encryptAccountRequest(payload, cap.encryptionKey), receiptSecret = cryptoProtocol.randomSecret(), started = now();
      const queued = await json("/accounts/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), operation: name, receiptSecret, envelope: encrypted.envelope }) }, controller.signal);
      if (typeof queued.id !== "string" || !queued.id) throw Error("\uACC4\uC815 \uC694\uCCAD \uC811\uC218 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      let result;
      while (!controller.signal.aborted && now() - started < Math.min(timeoutMs, 6e4)) {
        await sleep(Math.min(3e3, Math.max(100, queued.pollAfterMs ?? 500)), controller.signal);
        const job = await json(`/accounts/jobs/${encodeURIComponent(queued.id)}`, { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${receiptSecret}` } }, controller.signal);
        if (job.status === "complete") {
          result = await cryptoProtocol.decryptAccountResult(job.envelope, encrypted.key);
          break;
        }
        if (["failed", "expired"].includes(job.status)) throw Error("\uACC4\uC815 \uC694\uCCAD\uC774 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
      }
      if (controller.signal.aborted || !result) throw abortError();
      if (result.ok !== true) throw Object.assign(Error(result.error ?? "\uACC4\uC815 \uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."), { code: result.code, status: result.status });
      if (["login", "register", "recover"].includes(name)) publish(result);
      else if (name === "delete" || name === "logout") publish(null);
      else if (result.user) publish({ ...current, ...result, token: result.token ?? current?.token, expiresAt: result.expiresAt ?? current?.expiresAt });
      return result;
    } catch (error) {
      if (controller.signal.aborted) throw Error("\uACC4\uC815 \uC694\uCCAD \uC2DC\uAC04\uC774 \uCD08\uACFC\uB418\uC5C8\uAC70\uB098 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
      throw error;
    } finally {
      clearTimeout(timer);
      pending.delete(controller);
    }
  }
  return {
    capabilities,
    getSession,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    cancel() {
      for (const controller of pending) controller.abort();
    },
    register: (fields) => operation("register", fields),
    login: (fields) => operation("login", fields),
    profile: () => operation("profile", {}, true),
    rename: (fields) => operation("rename", fields, true),
    changePassword: (fields) => operation("password", fields, true),
    recover: (fields) => operation("recover", fields),
    delete: (fields) => operation("delete", fields, true),
    resetRecovery: (fields) => operation("recovery-reset", fields, true),
    async logout() {
      try {
        return await operation("logout", {}, true);
      } finally {
        publish(null);
      }
    }
  };
}

// duplicate/accounts/account-panel.mjs
function mountAccountPanel(container, { client, onSessionChange = () => {
}, privacyUrl = "./privacy.html", document: doc = container.ownerDocument, clipboard = globalThis.navigator?.clipboard, confirm = globalThis.confirm } = {}) {
  let mode = "login", busy = false, destroyed = false, recovery = null;
  const node3 = (tag, text, cls) => {
    const el = doc.createElement(tag);
    if (text !== void 0) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const status = node3("p", "", "hint"), cancel = node3("button", "\uC694\uCCAD \uCDE8\uC18C", "text-button"), content = node3("div"), recoveryBox = node3("section", void 0, "account-recovery");
  recoveryBox.hidden = true;
  cancel.type = "button";
  cancel.hidden = true;
  cancel.onclick = () => client.cancel();
  container.replaceChildren(content, recoveryBox, status, cancel);
  function field(form2, title, name, { password = false, fresh = false, required = true } = {}) {
    const label = node3("label", title, "field"), input = node3("input");
    input.name = name;
    input.required = required;
    input.type = password ? "password" : "text";
    input.autocomplete = password ? fresh ? "new-password" : "current-password" : "username";
    if (password) {
      input.minLength = 15;
      input.maxLength = 128;
    } else if (name === "nickname") {
      input.maxLength = 40;
    }
    if (name === "recoveryCode") {
      input.autocomplete = "off";
      input.minLength = 1;
      input.maxLength = 256;
    }
    label.append(input);
    form2.append(label);
    return input;
  }
  function showRecovery(code) {
    if (!code) return;
    recovery = code;
    recoveryBox.replaceChildren(node3("h3", "\uBCF5\uAD6C \uCF54\uB4DC \xB7 \uC9C0\uAE08 \uD55C \uBC88\uB9CC \uD45C\uC2DC"), node3("p", "\uBE44\uBC00\uBC88\uD638\uB97C \uC783\uC73C\uBA74 \uC774 \uCF54\uB4DC\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4. \uC548\uC804\uD55C \uACF3\uC5D0 \uBCF4\uAD00\uD558\uC138\uC694. \uB2EB\uC740 \uB4A4\uC5D0\uB294 \uB2E4\uC2DC \uC870\uD68C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "hint"));
    const value = node3("code", code), copy = node3("button", "\uBCF5\uAD6C \uCF54\uB4DC \uBCF5\uC0AC", "secondary"), close = node3("button", "\uBCF4\uAD00\uD588\uC2B5\uB2C8\uB2E4 \xB7 \uC228\uAE30\uAE30", "text-button");
    copy.type = close.type = "button";
    copy.onclick = async () => {
      try {
        await clipboard.writeText(recovery);
        status.textContent = "\uBCF5\uAD6C \uCF54\uB4DC\uB97C \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4.";
      } catch {
        status.textContent = "\uD45C\uC2DC\uB41C \uBCF5\uAD6C \uCF54\uB4DC\uB97C \uC9C1\uC811 \uBCF5\uC0AC\uD574 \uC8FC\uC138\uC694.";
      }
    };
    close.onclick = () => {
      recovery = null;
      recoveryBox.replaceChildren();
      recoveryBox.hidden = true;
    };
    recoveryBox.append(value, copy, close);
    recoveryBox.hidden = false;
  }
  function form(title, button, build, perform) {
    const section = node3("section"), heading = node3("h3", title), f = node3("form"), submit = node3("button", button, "primary");
    submit.type = "submit";
    const inputs = build(f);
    f.append(submit);
    f.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      if (!f.reportValidity()) return;
      busy = true;
      cancel.hidden = false;
      status.textContent = "\uC554\uD638\uD654\uB41C \uACC4\uC815 \uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4\u2026";
      submit.disabled = true;
      try {
        const data = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value]));
        const result = await perform(data);
        if (destroyed) return;
        for (const input of Object.values(inputs)) if (input.type === "password") input.value = "";
        status.textContent = "\uCC98\uB9AC\uD588\uC2B5\uB2C8\uB2E4.";
        render();
        showRecovery(result?.recoveryCode);
      } catch (error) {
        if (!destroyed) status.textContent = error.message;
      } finally {
        busy = false;
        cancel.hidden = true;
        submit.disabled = false;
      }
    });
    section.append(heading, f);
    content.append(section);
    return f;
  }
  function render() {
    if (destroyed) return;
    content.replaceChildren();
    const session = client.getSession();
    if (!session) {
      const tabs = node3("nav", void 0, "account-tabs");
      for (const [key, label] of [["login", "\uB85C\uADF8\uC778"], ["register", "\uACC4\uC815 \uB9CC\uB4E4\uAE30"], ["recover", "\uACC4\uC815 \uBCF5\uAD6C"]]) {
        const button = node3("button", label, key === mode ? "secondary active" : "text-button");
        button.type = "button";
        button.onclick = () => {
          if (!busy) {
            mode = key;
            status.textContent = "";
            render();
          }
        };
        tabs.append(button);
      }
      content.append(tabs);
      if (mode === "login") form("\uB2C9\uB124\uC784\uC73C\uB85C \uB85C\uADF8\uC778", "\uB85C\uADF8\uC778", (f) => ({ nickname: field(f, "\uB2C9\uB124\uC784", "nickname"), password: field(f, "\uBE44\uBC00\uBC88\uD638", "password", { password: true }) }), (data) => client.login(data));
      if (mode === "register") {
        const f = form("\uACC4\uC815 \uB9CC\uB4E4\uAE30", "\uACC4\uC815 \uB9CC\uB4E4\uAE30", (f2) => ({ nickname: field(f2, "\uB2C9\uB124\uC784 \xB7 1\u201320\uC790", "nickname"), password: field(f2, "\uBE44\uBC00\uBC88\uD638 \xB7 15\u2013128\uC790", "password", { password: true, fresh: true }) }), (data) => client.register({ ...data, privacyVersion: PRIVACY_VERSION }));
        const note = node3("p", void 0, "hint"), link = node3("a", "\uAC1C\uC778\uC815\uBCF4 \uCC98\uB9AC \uC548\uB0B4");
        link.href = privacyUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        note.append(link, node3("span", "\uB97C \uC77D\uC5B4 \uC8FC\uC138\uC694. \uC774\uBA54\uC77C\uC740 \uBC1B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2C9\uB124\uC784\uC740 \uC911\uBCF5\uB418\uC9C0 \uC54A\uC544\uC57C \uD558\uBA70 \uBE44\uBC00\uBC88\uD638\uB294 \uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0 \uC800\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
        f.prepend(note);
      }
      if (mode === "recover") form("\uBCF5\uAD6C \uCF54\uB4DC\uB85C \uBE44\uBC00\uBC88\uD638 \uC7AC\uC124\uC815", "\uACC4\uC815 \uBCF5\uAD6C", (f) => ({ nickname: field(f, "\uB2C9\uB124\uC784", "nickname"), recoveryCode: field(f, "\uBCF5\uAD6C \uCF54\uB4DC", "recoveryCode", { password: true }), newPassword: field(f, "\uC0C8 \uBE44\uBC00\uBC88\uD638 \xB7 15\u2013128\uC790", "newPassword", { password: true, fresh: true }) }), (data) => client.recover(data));
      content.append(node3("p", "\uACC4\uC815 \uC11C\uBE44\uC2A4\uAC00 \uAEBC\uC838 \uC788\uC5B4\uB3C4 \uC190\uB2D8 \uAC8C\uC784\uC740 \uACC4\uC18D \uC774\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uBE44\uBC00\uBC88\uD638 \uBD99\uC5EC\uB123\uAE30\uC640 \uBE44\uBC00\uBC88\uD638 \uAD00\uB9AC\uC790\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", "hint"));
      return;
    }
    content.append(node3("h2", session.user.nickname), node3("p", "\uB85C\uADF8\uC778\uD55C \uACC4\uC815\uC5D0 \uB300\uD68C \uC6B4\uC601 \uAE30\uB85D\uC744 \uC5F0\uACB0\uD569\uB2C8\uB2E4.", "hint"));
    const logout = node3("button", "\uB85C\uADF8\uC544\uC6C3", "secondary");
    logout.onclick = async () => {
      if (busy) return;
      busy = true;
      cancel.hidden = false;
      try {
        await client.logout();
        status.textContent = "\uC774 \uD0ED\uC5D0\uC11C \uB85C\uADF8\uC544\uC6C3\uD588\uC2B5\uB2C8\uB2E4.";
      } catch (error) {
        status.textContent = `\uC774 \uD0ED\uC758 \uB85C\uADF8\uC778\uC740 \uD574\uC81C\uD588\uC2B5\uB2C8\uB2E4. ${error.message}`;
      } finally {
        busy = false;
        cancel.hidden = true;
        render();
      }
    };
    content.append(logout);
    const details = node3("details"), summary = node3("summary", "\uACC4\uC815 \uAD00\uB9AC");
    details.append(summary);
    content.append(details);
    const group = node3("div");
    details.append(group);
    function settings(title, button, build, perform) {
      const f = form(title, button, build, perform);
      group.append(content.lastChild);
      return f;
    }
    settings("\uB2C9\uB124\uC784 \uBCC0\uACBD", "\uB2C9\uB124\uC784 \uBCC0\uACBD", (f) => ({ nickname: field(f, "\uC0C8 \uB2C9\uB124\uC784", "nickname"), password: field(f, "\uD604\uC7AC \uBE44\uBC00\uBC88\uD638", "password", { password: true }) }), (data) => client.rename(data));
    settings("\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD", "\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD", (f) => ({ password: field(f, "\uD604\uC7AC \uBE44\uBC00\uBC88\uD638", "password", { password: true }), newPassword: field(f, "\uC0C8 \uBE44\uBC00\uBC88\uD638", "newPassword", { password: true, fresh: true }) }), (data) => client.changePassword(data));
    settings("\uBCF5\uAD6C \uCF54\uB4DC \uC7AC\uBC1C\uAE09", "\uBCF5\uAD6C \uCF54\uB4DC \uC7AC\uBC1C\uAE09", (f) => ({ password: field(f, "\uD604\uC7AC \uBE44\uBC00\uBC88\uD638", "password", { password: true }) }), (data) => client.resetRecovery(data));
    settings("\uACC4\uC815 \uC0AD\uC81C", "\uACC4\uC815 \uC0AD\uC81C", (f) => ({ password: field(f, "\uD604\uC7AC \uBE44\uBC00\uBC88\uD638", "password", { password: true }) }), async (data) => {
      if (!confirm?.("\uACC4\uC815\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C? \uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.")) return;
      return client.delete(data);
    });
  }
  const unsubscribe = client.subscribe((session) => {
    if (!session) {
      recovery = null;
      recoveryBox.replaceChildren();
      recoveryBox.hidden = true;
    }
    render();
    onSessionChange(session);
  });
  render();
  return { refresh: render, destroy() {
    destroyed = true;
    recovery = null;
    unsubscribe();
    container.replaceChildren();
  } };
}

// duplicate/discard-statistics.mjs
var KEYS = Object.freeze(["tiles", "tsumogiri", "tedashi", "unknown", "claimed"]);
var MODES = Object.freeze(["tsumogiri", "tedashi", "unknown"]);
var integer2 = (value) => Number.isSafeInteger(value) && value >= 0;
var plain2 = (value) => !!value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function add(left, right) {
  const total = left + right;
  if (!integer2(total)) throw Error("Discard statistics overflow");
  return total;
}
var totalOf = (stats) => stats.tiles.reduce(add, 0);
var emptyDiscardStats = () => ({ tiles: Array(34).fill(0), tsumogiri: 0, tedashi: 0, unknown: 0, claimed: 0 });
function validateDiscardStats(stats, expectedTotal) {
  if (!plain2(stats) || Reflect.ownKeys(stats).length !== KEYS.length || !Reflect.ownKeys(stats).every((key) => KEYS.includes(key)) || !Array.isArray(stats.tiles) || stats.tiles.length !== 34 || !Array.from(stats.tiles).every(integer2) || ![...MODES, "claimed"].every((key) => integer2(stats[key]))) throw Error("Invalid discard statistics");
  const total = totalOf(stats), kinds = MODES.reduce((sum, key) => add(sum, stats[key]), 0);
  if (kinds !== total || stats.claimed > total || expectedTotal !== void 0 && (!integer2(expectedTotal) || expectedTotal !== total)) throw Error("Inconsistent discard statistics");
  return { tiles: [...stats.tiles], tsumogiri: stats.tsumogiri, tedashi: stats.tedashi, unknown: stats.unknown, claimed: stats.claimed };
}
function sumDiscardStats(records) {
  if (!Array.isArray(records)) throw Error("Missing discard-statistics records");
  const combined = emptyDiscardStats();
  for (const record of records) {
    const stats = validateDiscardStats(record);
    for (let type = 0; type < 34; type++) combined.tiles[type] = add(combined.tiles[type], stats.tiles[type]);
    for (const key of [...MODES, "claimed"]) combined[key] = add(combined[key], stats[key]);
  }
  return validateDiscardStats(combined);
}
function compareDiscardStats(own, peers) {
  const checked = validateDiscardStats(own), ownTotal = totalOf(checked);
  if (!Array.isArray(peers)) throw Error("Missing discard-statistics peers");
  const checkedPeers = peers.map((value) => {
    const stats = validateDiscardStats(value);
    return { stats, total: totalOf(stats) };
  });
  const positive = checkedPeers.filter((peer) => peer.total > 0), peerSamples = positive.length;
  const combined = sumDiscardStats(checkedPeers.map((peer) => peer.stats)), peerTotal = totalOf(combined);
  function compare(ownCount, peerCount, read) {
    const ownPercent = ownTotal ? ownCount / ownTotal * 100 : null;
    const peerPercent = peerSamples ? positive.reduce((sum, peer) => sum + read(peer.stats) / peer.total * 100 / peerSamples, 0) : null;
    let difference = ownPercent === null || peerPercent === null ? null : ownPercent - peerPercent;
    if (difference !== null && Math.abs(difference) <= Number.EPSILON * Math.max(1, ownPercent, peerPercent) * peerSamples * 8) difference = 0;
    return { ownCount, ownPercent, peerCount, peerPercent, difference };
  }
  const tiles = checked.tiles.map((count, type) => ({ type, ...compare(count, combined.tiles[type], (stats) => stats.tiles[type]) }));
  const modes = Object.fromEntries(MODES.map((key) => [key, compare(checked[key], combined[key], (stats) => stats[key])]));
  return { ownTotal, peerSamples, peerTotal, tiles, ...modes };
}

// duplicate/shared/tiles.mjs
var tileName = (t) => t < 27 ? `${t % 9 + 1}${["\uB9CC", "\uD1B5", "\uC0AD"][Math.floor(t / 9)]}` : ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81", "\uBC31", "\uBC1C", "\uC911"][t - 27];

// duplicate/tile-view.mjs
var SVG = "http://www.w3.org/2000/svg";
var dots = { 1: [[50, 50]], 2: [[50, 24], [50, 76]], 3: [[24, 22], [50, 50], [76, 78]], 4: [[24, 24], [76, 24], [24, 76], [76, 76]], 5: [[24, 24], [76, 24], [50, 50], [24, 76], [76, 76]], 6: [[24, 18], [76, 18], [24, 50], [76, 50], [24, 82], [76, 82]], 7: [[24, 16], [50, 31], [76, 16], [24, 57], [76, 57], [24, 84], [76, 84]], 8: [[24, 13], [76, 13], [24, 38], [76, 38], [24, 63], [76, 63], [24, 88], [76, 88]], 9: [[22, 16], [50, 16], [78, 16], [22, 50], [50, 50], [78, 50], [22, 84], [50, 84], [78, 84]] };
function element(tag, attributes) {
  const el = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value));
  return el;
}
function span(text, cls) {
  const el = document.createElement("span");
  el.className = cls;
  el.textContent = text;
  return el;
}
function bird(svg) {
  svg.setAttribute("data-design", "bamboo-bird");
  for (const d of ["M47 60 Q16 66 17 98 Q38 91 51 67", "M49 62 Q32 81 37 103 Q54 92 56 65", "M54 62 Q54 86 69 99 Q76 78 62 60"]) svg.append(element("path", { d, fill: "#1a7952", stroke: "#125c40", "stroke-width": 2 }));
  svg.append(element("path", { d: "M28 47 Q22 30 34 19 Q48 13 55 27 L65 43 Q77 55 63 68 Q48 78 34 65 Q25 58 28 47Z", fill: "#1a7952" }));
  svg.append(element("path", { d: "M34 46 Q45 35 63 48 Q61 63 41 66 Q49 55 34 46Z", fill: "#2d526f" }));
  svg.append(element("path", { d: "M53 24 L72 32 L55 35Z", fill: "#b12739" }));
  svg.append(element("circle", { cx: 45, cy: 25, r: 4, fill: "#fff7dc" }), element("circle", { cx: 46, cy: 25, r: 2, fill: "#173d32" }));
  svg.append(element("path", { d: "M32 17 L27 10 M38 15 L37 7 M49 68 L50 82 M50 82 L42 86 M50 82 L58 85", fill: "none", stroke: "#b12739", "stroke-width": 3, "stroke-linecap": "round" }));
}
function eightBamboo(svg) {
  svg.setAttribute("data-design", "bamboo-eight");
  for (const points of [[[5, 18], [24, 43], [43, 18]], [[57, 18], [76, 43], [95, 18]], [[5, 92], [24, 67], [43, 92]], [[57, 92], [76, 67], [95, 92]]]) {
    svg.append(element("path", { d: points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" "), fill: "none", stroke: "#166b46", "stroke-width": 8, "stroke-linecap": "butt", "stroke-linejoin": "miter", "stroke-miterlimit": 2 }));
    for (let i = 0; i < 2; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[i + 1], length = Math.hypot(x2 - x1, y2 - y1), dx = (y2 - y1) / length * 3.5, dy = -(x2 - x1) / length * 3.5, g = element("g", { "data-bamboo-stem": "true" });
      for (const t of [0.3, 0.7]) {
        const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
        g.append(element("path", { d: `M${x - dx} ${y - dy} L${x + dx} ${y + dy}`, fill: "none", stroke: "#0d4e33", "stroke-width": 1.7 }));
      }
      svg.append(g);
    }
  }
}
function tileFace(type, { button = false, small = false } = {}) {
  const tile = document.createElement(button ? "button" : "span");
  tile.className = `tile-face ${small ? "tile-small" : "tile"}`;
  tile.dataset.type = String(type);
  tile.dataset.suit = type < 27 ? ["m", "p", "s"][Math.floor(type / 9)] : "z";
  tile.title = tileName(type);
  tile.setAttribute("aria-label", tileName(type));
  if (button) tile.type = "button";
  if (type < 9) {
    tile.append(span(["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D"][type], "tile-number"), span("\u842C", "tile-man"));
  } else if (type < 27) {
    const n = type % 9 + 1, svg = element("svg", { viewBox: "0 0 100 110", class: "tile-symbol", "aria-hidden": "true", focusable: "false" });
    if (type === 18) bird(svg);
    else if (type === 25) eightBamboo(svg);
    else for (const [index, [x, y]] of dots[n].entries()) {
      if (type < 18) {
        const color = "#222222";
        svg.append(element("circle", { cx: x, cy: y + 5, r: n === 1 ? 25 : n < 6 ? 14 : 10, fill: "none", stroke: color, "stroke-width": n === 1 ? 8 : 6 }));
        svg.append(element("circle", { cx: x, cy: y + 5, r: n === 1 ? 11 : 3, fill: color }));
      } else {
        const color = n === 7 && index < 3 ? "#b12739" : "#1a7952", length = n === 1 ? 56 : n < 4 ? 30 : 20, thick = n === 1 ? 13 : 7;
        svg.append(element("path", { d: `M ${x} ${y + 5 - length / 2} v ${length} M ${x - thick / 2} ${y + 5 - length / 2 + 4} h ${thick} M ${x - thick / 2} ${y + 5 + length / 2 - 4} h ${thick}`, fill: "none", stroke: color, "stroke-width": thick, "stroke-linecap": "round" }));
      }
    }
    tile.append(svg);
  } else if (type === 31) {
    tile.append(span("", "tile-white"));
  } else tile.append(span({ 27: "\u6771", 28: "\u5357", 29: "\u897F", 30: "\u5317", 32: "\u767C", 33: "\u4E2D" }[type], "tile-honor"));
  for (const child of tile.children) child.setAttribute("aria-hidden", "true");
  return tile;
}

// duplicate/discard-statistics-view.mjs
var percentage = (value) => value === null ? "\u2014" : `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
var pointDifference = (value) => value === null ? "\u2014" : `${value > 0 ? "+" : value < 0 ? "\u2212" : ""}${Number(Math.abs(value)).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%p`;
var node = (doc, tag, text, className) => {
  const element2 = doc.createElement(tag);
  if (text !== void 0) element2.textContent = text;
  if (className) element2.className = className;
  return element2;
};
function renderDiscardStatistics(container, { own, peers = [], compare = false, title = "\uBC84\uB9BC\uD328 \uBD84\uD3EC", document: doc = container.ownerDocument, tileRenderer = tileFace } = {}) {
  container.replaceChildren();
  if (own === null || own === void 0) {
    container.append(node(doc, "p", "\uC774 \uAE30\uB85D\uC5D0\uB294 \uBC84\uB9BC\uD328 \uD1B5\uACC4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", "hint"));
    return null;
  }
  let stats, comparison;
  try {
    stats = validateDiscardStats(own);
    comparison = compareDiscardStats(stats, peers);
  } catch {
    container.append(node(doc, "p", "\uBC84\uB9BC\uD328 \uD1B5\uACC4\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "hint"));
    return null;
  }
  const section = node(doc, "section", void 0, `discard-distribution${compare ? " is-comparison" : ""}`);
  section.append(node(doc, "h3", title, "discard-distribution-title"));
  const total = `\uBC84\uB9BC ${comparison.ownTotal.toLocaleString("ko-KR")}\uD68C \xB7 \uD6C4\uB85C\uB41C \uBC84\uB9BC ${stats.claimed.toLocaleString("ko-KR")}\uD68C`;
  section.append(node(doc, "p", compare ? `${total} \xB7 \uBE44\uAD50 ${comparison.peerSamples}\uBA85 / \uBC84\uB9BC \uD569\uACC4 ${comparison.peerTotal.toLocaleString("ko-KR")}\uD68C` : total, "hint"));
  if (compare) section.append(node(doc, "p", "\uAC01 \uCE78\uC740 \uB0B4 \uBE44\uC728 / \uB2E4\uB978 \uC0AC\uB78C \uD3C9\uADE0 \uBE44\uC728 / \uCC28\uC774\uC785\uB2C8\uB2E4. \uB2E4\uB978 \uC0AC\uB78C \uD3C9\uADE0\uC740 \uC0AC\uB78C\uB9C8\uB2E4 \uAC19\uC740 \uBE44\uC911\uC73C\uB85C \uACC4\uC0B0\uD569\uB2C8\uB2E4.", "hint"));
  const modes = node(doc, "dl", void 0, "discard-mode-stats");
  for (const [key, label] of [["tsumogiri", "\uCBD4\uBAA8\uAE30\uB9AC"], ["tedashi", "\uD14C\uB2E4\uC2DC"], ["unknown", "\uAD6C\uBD84 \uBD88\uBA85"]]) {
    const metric = comparison[key], cell = node(doc, "div");
    cell.append(node(doc, "dt", label), node(doc, "dd", `${metric.ownCount}\uD68C \xB7 ${percentage(metric.ownPercent)}`));
    if (compare) cell.append(node(doc, "small", `\uD3C9\uADE0 ${percentage(metric.peerPercent)} \xB7 ${pointDifference(metric.difference)}`));
    modes.append(cell);
  }
  section.append(modes);
  for (const [label, start, end] of [["\uB9CC\uC218", 0, 9], ["\uD1B5\uC218", 9, 18], ["\uC0AD\uC218", 18, 27], ["\uC790\uD328", 27, 34]]) {
    const group = node(doc, "section", void 0, "discard-suit-group");
    group.append(node(doc, "h4", label));
    const tiles = node(doc, "div", void 0, "discard-tile-grid");
    for (const metric of comparison.tiles.slice(start, end)) {
      const card = node(doc, "div", void 0, `discard-tile-stat${metric.ownCount === 0 ? " is-zero" : ""}`), face = tileRenderer(metric.type, { small: true }), count = node(doc, "strong", `${metric.ownCount}\uD68C`), ownPercent = node(doc, "span", percentage(metric.ownPercent), "discard-own-percent");
      card.setAttribute("aria-label", `${tileName(metric.type)}: \uB0B4 \uBC84\uB9BC ${metric.ownCount}\uD68C ${percentage(metric.ownPercent)}${compare ? `, \uC0AC\uB78C \uD3C9\uADE0 ${percentage(metric.peerPercent)}, \uCC28\uC774 ${pointDifference(metric.difference)}` : ""}`);
      card.append(face, count, ownPercent);
      if (compare) {
        card.append(node(doc, "span", percentage(metric.peerPercent), "discard-peer-percent"), node(doc, "span", pointDifference(metric.difference), "discard-percent-difference"));
      }
      tiles.append(card);
    }
    group.append(tiles);
    section.append(group);
  }
  if (compare && !comparison.peerSamples) section.append(node(doc, "p", "\uD604\uC7AC \uD45C\uC2DC\uB41C \uAC19\uC740 \uC790\uB9AC\uC758 \uB2E4\uB978 \uC0AC\uB78C\uC5D0\uAC8C \uBE44\uAD50 \uAC00\uB2A5\uD55C \uBC84\uB9BC\uD328 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", "hint"));
  section.append(node(doc, "p", "\uC801\uB3C4\uB77C\uB294 \uAC19\uC740 \uD328 \uC885\uB958\uC5D0 \uD569\uCE69\uB2C8\uB2E4. \uAD6C\uBD84 \uBD88\uBA85\uC740 \uCBD4\uBAA8\uAE30\uB9AC\xB7\uD14C\uB2E4\uC2DC \uAE30\uB85D\uC774 \uC5C6\uB294 \uBC84\uB9BC\uC774\uBA70, \uC54C\uB824\uC9C4 \uAE30\uB85D\uACFC \uB530\uB85C \uC9D1\uACC4\uD569\uB2C8\uB2E4.", "hint"));
  container.append(section);
  return comparison;
}

// duplicate/daily-benchmark-catalog.mjs
var DAILY_BENCHMARK_POLICIES = Object.freeze([
  Object.freeze({ id: "attack-1", label: "\uACF5\uACA9 1", style: "attack", level: 1, description: "\uC704\uD5D8 \uAC10\uC810\uC744 \uB0AE\uCD94\uACE0, \uC720\uD6A8\uD328\uB97C \uC720\uC9C0\uD558\uB294 \uD6C4\uB85C\uB97C \uC870\uAE08 \uB354 \uD5C8\uC6A9\uD569\uB2C8\uB2E4." }),
  Object.freeze({ id: "basic-1", label: "\uACF5\uACA9 2", style: "attack", level: 2, description: "\uC704\uD5D8\uBCF4\uB2E4 \uC9C4\uD589\uC744 \uC6B0\uC120\uD558\uACE0, \uC720\uD6A8\uD328\uAC00 \uC870\uAE08 \uC904\uC5B4\uB3C4 \uD6C4\uB85C\uB97C \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }),
  Object.freeze({ id: "attack-3", label: "\uACF5\uACA9 3", style: "attack", level: 3, description: "\uB9AC\uCE58 \uC704\uD5D8\xB7\uB3C4\uB77C \uBCF4\uC874 \uAC10\uC810\uC744 \uBE7C\uACE0, \uD6C4\uB85C \uD5C8\uC6A9 \uD3ED\uC744 \uB113\uD614\uC2B5\uB2C8\uB2E4." }),
  Object.freeze({ id: "defense-1", label: "\uC218\uBE44 1", style: "defense", level: 1, description: "\uB9AC\uCE58 \uC704\uD5D8 \uAC10\uC810\uC744 \uB192\uC774\uACE0, \uC0C1\uB300\uC801\uC73C\uB85C \uC548\uC804\uD55C \uD328\uB85C\uB9CC \uB9AC\uCE58\uD569\uB2C8\uB2E4." }),
  Object.freeze({ id: "basic-3", label: "\uC218\uBE44 2", style: "defense", level: 2, description: "\uB9AC\uCE58 \uC0C1\uB300\uC758 \uC548\uC804\uD328\uB97C \uD06C\uAC8C \uC6B0\uC120\uD558\uACE0, \uC704\uD5D8\uD55C \uD6C4\uB85C\uB97C \uBA48\uCDA5\uB2C8\uB2E4." }),
  Object.freeze({ id: "defense-3", label: "\uC218\uBE44 3", style: "defense", level: 3, description: "\uB9AC\uCE58 \uC704\uD5D8\uACFC \uB3C4\uB77C \uBCF4\uC874 \uAC00\uC911\uCE58\uB97C \uAC00\uC7A5 \uB192\uAC8C \uB454 \uC218\uBE44 \uBCC0\uD615\uC785\uB2C8\uB2E4." }),
  Object.freeze({ id: "balance-1", label: "\uADE0\uD615 1", style: "balance", level: 1, description: "\uAE30\uBCF8\uBCF4\uB2E4 \uC704\uD5D8 \uAC10\uC810\uC744 \uB0AE\uCD94\uACE0, \uC720\uD6A8\uD328 \uC720\uC9C0 \uD6C4\uB85C\uB97C \uC870\uAE08 \uB354 \uD5C8\uC6A9\uD569\uB2C8\uB2E4." }),
  Object.freeze({ id: "basic-2", label: "\uADE0\uD615 2", style: "balance", level: 2, description: "\uAC8C\uC784\uC758 \uAE30\uC874 \uAE30\uBCF8 AI \uD310\uB2E8\uC744 \uADF8\uB300\uB85C \uC0AC\uC6A9\uD569\uB2C8\uB2E4." }),
  Object.freeze({ id: "balance-3", label: "\uADE0\uD615 3", style: "balance", level: 3, description: "\uAE30\uBCF8\uBCF4\uB2E4 \uC704\uD5D8 \uAC10\uC810\uC744 \uB192\uC774\uACE0, \uB9AC\uCE58 \uC120\uC5B8\uC744 \uB354 \uC2E0\uC911\uD558\uAC8C \uACE0\uB985\uB2C8\uB2E4." })
]);
var DAILY_BENCHMARK_POLICY_IDS = Object.freeze(["attack-1", "basic-1", "attack-3", "defense-1", "basic-3", "defense-3", "balance-1", "basic-2", "balance-3"]);
var DAILY_BENCHMARK_RECORD_LIMIT = 36;

// duplicate/leaderboard.mjs
var DEFAULT_SERVER = "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site";
var WINDS = ["\u6771", "\u5357", "\u897F", "\u5317"];
var number = (value) => Number(value).toLocaleString("ko-KR");
var signed = (value) => `${value > 0 ? "+" : ""}${number(value)}`;
var signedAverage = (value) => `${value > 0 ? "+" : ""}${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}`;
var node2 = (doc, tag, text, className) => {
  const element2 = doc.createElement(tag);
  if (text !== void 0) element2.textContent = text;
  if (className) element2.className = className;
  return element2;
};
var safeStorage = (window, key) => {
  try {
    return window[key];
  } catch {
    return void 0;
  }
};
function validLeaderboardDate(value) {
  if (typeof value !== "string" || !/^20\d\d-\d\d-\d\d$/.test(value)) return false;
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function leaderboardSeat(value) {
  return ["0", "1", "2", "3"].includes(String(value)) ? String(value) : "all";
}
function leaderboardServer(base, stored) {
  for (const candidate of [new URL(base).searchParams.get("server"), stored, DEFAULT_SERVER]) {
    try {
      if (candidate) return normalizeAccountServer(candidate);
    } catch {
    }
  }
  return DEFAULT_SERVER;
}
function leaderboardHref(target, base, server) {
  const current = new URL(base), url = new URL(target, current);
  let checked;
  try {
    checked = normalizeAccountServer(server ?? current.searchParams.get("server"));
  } catch {
  }
  if (url.origin === current.origin && checked && checked !== DEFAULT_SERVER) url.searchParams.set("server", checked);
  return url.href;
}
var entryIdentifier = (value) => typeof value === "string" && value.length > 0 && value.length <= 200 ? value : null;
function leaderboardComparison(value) {
  const result = {};
  for (const prefix of ["ai", "people"]) {
    const mean = value?.[`${prefix}Mean`], difference = value?.[`${prefix}Difference`], samples = value?.[`${prefix}Samples`];
    const present = Number.isSafeInteger(samples) && samples > 0 && Number.isFinite(mean) && Number.isFinite(difference);
    result[`${prefix}Mean`] = present ? mean : null;
    result[`${prefix}Difference`] = present ? difference : null;
    result[`${prefix}Samples`] = present ? samples : 0;
  }
  return result;
}
function publicEntry(entry) {
  if (!entry || typeof entry.nickname !== "string" || !entry.nickname.trim() || entry.nickname.length > 80 || !Number.isInteger(entry.seat) || entry.seat < 0 || entry.seat > 3 || !Number.isSafeInteger(entry.net) || !Number.isSafeInteger(entry.hands) || entry.hands < 1) throw Error("\uC21C\uC704 \uAE30\uB85D\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const stats = validateActionStats(entry.stats, entry.hands), discardStats = entry.discardStats == null ? null : validateDiscardStats(entry.discardStats, stats.discard);
  return { entryId: entryIdentifier(entry.entryId), nickname: entry.nickname, seat: entry.seat, net: entry.net, hands: entry.hands, stats, discardStats };
}
function leaderboardRows(value) {
  if (!Array.isArray(value)) throw Error("\uC21C\uC704 \uBAA9\uB85D\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  return value.slice(0, 2e3).map((entry) => {
    if (!Number.isSafeInteger(entry?.rank) || entry.rank < 1 || !Number.isSafeInteger(entry.seatRank) || entry.seatRank < 1) throw Error("\uC21C\uC704 \uAE30\uB85D\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    const completedAt = Number.isFinite(new Date(entry.completedAt).getTime()) ? new Date(entry.completedAt).toISOString() : null;
    return { ...publicEntry(entry), rank: entry.rank, seatRank: entry.seatRank, comparison: leaderboardComparison(entry.comparison), completedAt };
  });
}
function leaderboardBenchmarks(value = []) {
  if (!Array.isArray(value) || value.length > DAILY_BENCHMARK_RECORD_LIMIT) throw Error("AI \uAE30\uC900 \uAE30\uB85D\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const seen = /* @__PURE__ */ new Set();
  return value.map((entry) => {
    if (entry?.kind !== "ai" || !DAILY_BENCHMARK_POLICY_IDS.includes(entry.policy)) throw Error("AI \uAE30\uC900 \uAE30\uB85D\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    const key = `${entry.policy}:${entry.seat}`;
    if (seen.has(key)) throw Error("\uC911\uBCF5\uB41C AI \uAE30\uC900 \uAE30\uB85D\uC785\uB2C8\uB2E4.");
    seen.add(key);
    return { ...publicEntry(entry), kind: "ai", policy: entry.policy };
  });
}
function visibleDiscardPeers(own, entries) {
  if (!entryIdentifier(own?.entryId) || !Number.isInteger(own?.seat)) return [];
  return entries.filter((entry) => entry.entryId && entry.entryId !== own.entryId && entry.seat === own.seat && entry.discardStats != null).map((entry) => entry.discardStats);
}
function mountLeaderboard(document2, { location = document2.defaultView.location, window = document2.defaultView, fetchImpl = window.fetch.bind(window), now = () => /* @__PURE__ */ new Date(), accountClient, accountPanel = mountAccountPanel, discardTileRenderer } = {}) {
  const $ = (id) => document2.getElementById(id), base = location.href, params = new URL(base).searchParams;
  const storage = safeStorage(window, "localStorage");
  let storedServer;
  try {
    storedServer = JSON.parse(storage?.getItem("duplicate.server") || "null");
  } catch {
  }
  const server = leaderboardServer(base, storedServer), client = accountClient ?? createAccountClient({ server, storage: safeStorage(window, "sessionStorage"), fetchImpl });
  const dateInput = $("leaderboard-date"), seatInput = $("leaderboard-seat"), status = $("leaderboard-status"), list = $("leaderboard-list"), entryStatus = $("daily-entry-status"), entryActions = $("daily-entry-actions"), accountDetails = $("leaderboard-account-details");
  let selectedDate = validLeaderboardDate(params.get("date")) ? params.get("date") : dailyDate(now()), seatExplicit = params.has("seat"), selectedSeat = leaderboardSeat(params.get("seat")), session = client.getSession(), me = null, meError = null, requestId = 0, controller = null, destroyed = false, visibleEntries = [];
  dateInput.value = selectedDate;
  seatInput.value = selectedSeat;
  for (const anchor of document2.querySelectorAll("[data-board-link]")) anchor.href = leaderboardHref(anchor.dataset.boardLink, base, server);
  function href(target) {
    return leaderboardHref(target, base, server);
  }
  function accountState() {
    session = client.getSession();
    $("leaderboard-account-summary").textContent = session ? `${session.user.nickname} \xB7 \uACC4\uC815` : "\uB4F1\uB85D\uD558\uB824\uBA74 \uACC4\uC815 \uB85C\uADF8\uC778";
    if (session && location.hash !== "#account") accountDetails.open = false;
  }
  function addLink(label, target, className = "secondary") {
    const link = node2(document2, "a", label, className);
    link.href = href(target);
    entryActions.append(link);
    return link;
  }
  function openAccount() {
    accountDetails.open = true;
    accountDetails.scrollIntoView?.({ behavior: "smooth", block: "start" });
    accountDetails.querySelector("input")?.focus({ preventScroll: true });
  }
  function renderEntry() {
    entryActions.replaceChildren();
    const ownComparison = $("daily-entry-comparison");
    ownComparison.replaceChildren();
    ownComparison.hidden = true;
    const today = dailyDate(now()), isToday = selectedDate === today;
    if (!session) {
      entryStatus.textContent = "\uCCAB \uAE30\uB85D\uC744 \uB0A8\uAE30\uB824\uBA74 \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694. \uB9AC\uB354\uBCF4\uB4DC\uB294 \uB85C\uADF8\uC778 \uC5C6\uC774\uB3C4 \uBCFC \uC218 \uC788\uC5B4\uC694.";
      const login = node2(document2, "button", "\uACC4\uC815 \uB85C\uADF8\uC778", "primary");
      login.type = "button";
      login.onclick = openAccount;
      entryActions.append(login);
    } else if (meError) {
      entryStatus.textContent = meError;
      const retry = node2(document2, "button", "\uB0B4 \uAE30\uB85D \uB2E4\uC2DC \uD655\uC778", "secondary");
      retry.type = "button";
      retry.onclick = refresh;
      entryActions.append(retry);
    } else if (!me) {
      entryStatus.textContent = "\uB0B4 \uB3C4\uC804 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4\u2026";
    } else if (me.status === "playing") {
      entryStatus.textContent = `${selectedDate.replaceAll("-", ".")} \uCCAB \uB3C4\uC804\uC774 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4.${Number.isInteger(me.seat) ? ` \uC2DC\uC791 \uC790\uB9AC ${WINDS[me.seat]}.` : ""} \uC911\uB2E8\uD55C \uC9C0\uC810\uC5D0\uC11C \uACC4\uC18D\uD560 \uC218 \uC788\uC5B4\uC694.`;
      addLink("\uCCAB \uB3C4\uC804 \uC774\uC5B4\uD558\uAE30", `./?dailyRanked=${selectedDate}`, "primary");
    } else if (me.status === "completed") {
      const net = Number.isSafeInteger(me.result?.net) ? ` ${signed(me.result.net)}\uC810` : "", seat = Number.isInteger(me.seat) ? ` \xB7 \uC2DC\uC791 \uC790\uB9AC ${WINDS[me.seat]}` : "";
      entryStatus.textContent = `\uCCAB \uAE30\uB85D${net}${seat}\uC774 \uB4F1\uB85D\uB410\uC5B4\uC694. \uC774\uD6C4 \uB300\uAD6D\uC740 \uC5F0\uC2B5\uC73C\uB85C \uC990\uAE38 \uC218 \uC788\uACE0 \uCCAB \uAE30\uB85D\uC740 \uBC14\uB00C\uC9C0 \uC54A\uC544\uC694.`;
      const ownRow = visibleEntries.find((entry) => me.entryId && entry.entryId === me.entryId), comparison = me.comparison ?? ownRow?.comparison;
      if (comparison) {
        ownComparison.hidden = false;
        renderScoreComparison(ownComparison, leaderboardComparison(comparison));
      }
    } else if (me.status === "expired") {
      entryStatus.textContent = "\uC774 \uB0A0\uC9DC\uC758 \uCCAB \uB3C4\uC804\uC740 \uC885\uB8CC\uB410\uC2B5\uB2C8\uB2E4. \uC644\uB8CC\uD558\uC9C0 \uBABB\uD55C \uB3C4\uC804\uC740 \uC21C\uC704\uC5D0 \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC73C\uBA70, \uB2E4\uC2DC \uC5F0\uC2B5\uD560 \uC218 \uC788\uC5B4\uC694.";
    } else if (isToday) {
      entryStatus.textContent = "\uC624\uB298\uC758 \uCCAB \uB3C4\uC804\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2DC\uC791\uD55C \uCCAB \uB300\uAD6D\uC744 \uB05D\uB0B4\uBA74 \uB9AC\uB354\uBCF4\uB4DC\uC5D0 \uD55C \uBC88 \uB4F1\uB85D\uB429\uB2C8\uB2E4.";
      addLink("\uC624\uB298\uC758 \uCCAB \uAE30\uB85D \uB3C4\uC804", `./?dailyRanked=${selectedDate}`, "primary");
    } else {
      entryStatus.textContent = "\uC0C8 \uCCAB \uB3C4\uC804\uC740 \uD55C\uAD6D \uC2DC\uAC04\uC73C\uB85C \uC624\uB298 \uB0A0\uC9DC\uC5D0\uB9CC \uC2DC\uC791\uD560 \uC218 \uC788\uC5B4\uC694. \uC9C0\uB09C \uAE30\uB85D\uC740 \uACC4\uC18D \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
      const unavailable = node2(document2, "button", "\uC774 \uB0A0\uC9DC\uC758 \uC2E0\uADDC \uB4F1\uB85D \uC885\uB8CC", "secondary");
      unavailable.type = "button";
      unavailable.disabled = true;
      entryActions.append(unavailable);
    }
    addLink("\uACB0\uACFC\uB9CC \uBCF4\uB294 \uC5F0\uC2B5", "./#today", "secondary");
  }
  function renderScoreComparison(container, comparison) {
    container.replaceChildren();
    for (const [prefix, label] of [["ai", "\uAC19\uC740 \uC790\uB9AC AI \uD3C9\uADE0 \uB300\uBE44"], ["people", "\uAC19\uC740 \uC790\uB9AC \uB2E4\uB978 \uC0AC\uB78C \uB300\uBE44"]]) {
      const samples = comparison[`${prefix}Samples`], difference = comparison[`${prefix}Difference`], mean = comparison[`${prefix}Mean`], cell = node2(document2, "div", void 0, "score-comparison-cell");
      cell.append(node2(document2, "span", label), node2(document2, "strong", difference === null ? "\u2014" : `${signedAverage(difference)}\uC810`, difference === null ? "" : difference > 0 ? "is-positive" : difference < 0 ? "is-negative" : ""), node2(document2, "small", samples ? `${prefix === "ai" ? `${samples}\uAC1C \uAE30\uC900` : `\uB098 \uC81C\uC678 ${samples}\uBA85`} \xB7 \uD3C9\uADE0 ${signedAverage(mean)}\uC810` : "\uBE44\uAD50 \uB300\uC0C1 \uC5C6\uC74C"));
      container.append(cell);
    }
  }
  function actionDetails(container, entry) {
    const stats = node2(document2, "dl", void 0, "leaderboard-stats");
    for (const [key, label] of [["call", "\uD6C4\uB85C"], ["riichi", "\uB9AC\uCE58"], ["kan", "\uAE61"], ["win", "\uD654\uB8CC"], ["dealIn", "\uBC29\uCD1D"]]) {
      const cell = node2(document2, "div");
      cell.append(node2(document2, "dt", label), node2(document2, "dd", `${number(entry.stats[key])}\uD68C`));
      stats.append(cell);
    }
    container.append(stats, node2(document2, "p", `\uBC84\uB9BC ${number(entry.stats.discard)}\uD68C \xB7 \uCE5C \uC5F0\uC7A5\uC744 \uD3EC\uD568\uD55C ${entry.hands}\uAD6D\uC758 \uD69F\uC218\uC785\uB2C8\uB2E4.`, "hint"));
    const discards = node2(document2, "details", void 0, "entry-discard-details");
    discards.append(node2(document2, "summary", "34\uC885 \uBC84\uB9BC\uD328 \uBD84\uD3EC \xB7 \uCBD4\uBAA8\uAE30\uB9AC/\uD14C\uB2E4\uC2DC"));
    const body = node2(document2, "div");
    discards.append(body);
    let rendered = false;
    discards.addEventListener("toggle", () => {
      if (discards.open && !rendered) {
        renderDiscardStatistics(body, { own: entry.discardStats, document: document2, tileRenderer: discardTileRenderer });
        rendered = true;
      }
    });
    container.append(discards);
  }
  function renderRows(entries) {
    list.replaceChildren();
    for (const entry of entries) {
      const mine = me?.entryId ? me.entryId === entry.entryId : session?.user.nickname === entry.nickname;
      const item = node2(document2, "li", void 0, `leaderboard-row${mine ? " is-mine" : ""}`), summary = node2(document2, "div", void 0, "leaderboard-summary"), rank = node2(document2, "span", String(selectedSeat === "all" ? entry.rank : entry.seatRank), "leaderboard-rank"), identity = node2(document2, "div", void 0, "leaderboard-identity");
      rank.setAttribute("aria-label", `${rank.textContent}\uC704`);
      identity.append(node2(document2, "span", entry.nickname, "leaderboard-name"), node2(document2, "span", `\uC2DC\uC791 ${WINDS[entry.seat]} \xB7 ${entry.hands}\uAD6D${selectedSeat === "all" ? ` \xB7 \uAC19\uC740 \uC790\uB9AC ${entry.seatRank}\uC704` : ""}`, "leaderboard-sub"));
      const score = node2(document2, "span", signed(entry.net), `leaderboard-score${entry.net < 0 ? " is-negative" : ""}`);
      score.append(node2(document2, "small", "\uC810"));
      summary.append(rank, identity, score);
      item.append(summary);
      const comparisons = node2(document2, "div", void 0, "score-comparison");
      renderScoreComparison(comparisons, entry.comparison);
      item.append(comparisons);
      const details = node2(document2, "details", void 0, "leaderboard-details");
      details.append(node2(document2, "summary", "\uD589\uB3D9\xB7\uBC84\uB9BC\uD328 \uAE30\uB85D \uBCF4\uAE30"));
      actionDetails(details, entry);
      if (entry.completedAt) details.append(node2(document2, "p", `${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(entry.completedAt))} \uC644\uB8CC`, "hint"));
      item.append(details);
      list.append(item);
    }
  }
  function renderBenchmarks(entries) {
    const host = $("leaderboard-benchmark-list"), status2 = $("leaderboard-benchmark-status");
    host.replaceChildren();
    status2.textContent = entries.length ? "\uAC19\uC740 \uC2DC\uC791 \uC790\uB9AC\uC758 AI 9\uAC1C \uAE30\uC900\uACFC \uBE44\uAD50\uD569\uB2C8\uB2E4. AI\uB294 \uC0AC\uB78C \uC21C\uC704\xB7\uCC38\uAC00\uC790 \uC218\xB7\uB2E4\uB978 \uC0AC\uB78C \uD3C9\uADE0\uC5D0\uC11C \uC81C\uC678\uD569\uB2C8\uB2E4. \uC804\uCCB4 \uC790\uB9AC\uC5D0\uC11C\uB294 \uAE30\uC900\uB9C8\uB2E4 \uB3D9\xB7\uB0A8\xB7\uC11C\xB7\uBD81 \uAE30\uB85D\uC744 \uBCF4\uC5EC \uC90D\uB2C8\uB2E4." : "AI \uAE30\uC900 \uAE30\uB85D\uC744 \uC900\uBE44\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uACF5\uACA9\xB7\uC218\uBE44\xB7\uADE0\uD615 \uAC01 3\uAC1C \uAE30\uC900\uC740 \uC900\uBE44\uB418\uB294 \uB300\uB85C \uD45C\uC2DC\uB429\uB2C8\uB2E4.";
    for (const [style, label, description] of [
      ["attack", "\uACF5\uACA9\uD615", "\uD328 \uD6A8\uC728\xB7\uD6C4\uB85C\xB7\uCD94\uACA9 \uB9AC\uCE58\uB97C \uC6B0\uC120\uD558\uB294 3\uAC00\uC9C0 \uD310\uB2E8"],
      ["defense", "\uC218\uBE44\uD615", "\uC0C1\uB300 \uB9AC\uCE58\uC758 \uC704\uD5D8\uC744 \uD53C\uD558\uACE0 \uD6C4\uB85C\uB97C \uC5B5\uC81C\uD558\uB294 3\uAC00\uC9C0 \uD310\uB2E8"],
      ["balance", "\uADE0\uD615\uD615", "\uD328 \uD6A8\uC728\uACFC \uC548\uC804\uC744 \uD568\uAED8 \uACE0\uB824\uD558\uB294 3\uAC00\uC9C0 \uD310\uB2E8"]
    ]) {
      const group = node2(document2, "section", void 0, "benchmark-style-group");
      group.dataset.style = style;
      const groupHead = node2(document2, "div", void 0, "benchmark-style-heading");
      groupHead.append(node2(document2, "h3", label), node2(document2, "p", description));
      group.append(groupHead);
      const cards = node2(document2, "div", void 0, "benchmark-style-cards");
      for (const metadata of DAILY_BENCHMARK_POLICIES.filter((policy) => policy.style === style)) {
        const records = entries.filter((entry) => entry.policy === metadata.id).sort((a, b) => a.seat - b.seat), card = node2(document2, "article", void 0, "benchmark-card");
        card.dataset.policy = metadata.id;
        card.append(node2(document2, "h4", metadata.label), node2(document2, "p", metadata.description, "benchmark-policy-label"));
        if (!records.length) card.append(node2(document2, "p", "\uAE30\uB85D \uC900\uBE44 \uC911", "hint"));
        for (const entry of records) {
          const details = node2(document2, "details", void 0, "benchmark-record"), summary = node2(document2, "summary"), seatLabel = node2(document2, "span", `\uC2DC\uC791 ${WINDS[entry.seat]}`), score = node2(document2, "strong", `${signed(entry.net)}\uC810`, entry.net < 0 ? "is-negative" : "");
          summary.append(seatLabel, score);
          details.append(summary, node2(document2, "p", `${entry.hands}\uAD6D \uC644\uB8CC`, "hint"));
          actionDetails(details, entry);
          card.append(details);
        }
        cards.append(card);
      }
      group.append(cards);
      host.append(group);
    }
  }
  function renderOwnDiscards() {
    const panel2 = $("leaderboard-discard-panel"), host = $("leaderboard-discard-comparison");
    host.replaceChildren();
    panel2.hidden = me?.status !== "completed";
    if (panel2.hidden) return;
    let own = null;
    try {
      own = me.discardStats == null ? null : validateDiscardStats(me.discardStats, me.result?.stats?.discard);
    } catch {
    }
    const peers = visibleDiscardPeers(me, visibleEntries), comparison = renderDiscardStatistics(host, { own, peers, compare: true, title: "\uB0B4 \uBC84\uB9BC\uD328 \uBD84\uD3EC", document: document2, tileRenderer: discardTileRenderer });
    $("leaderboard-discard-title").textContent = `\uB0B4 \uBC84\uB9BC\uD328\uC640 \uD604\uC7AC \uD45C\uC2DC\uB41C \uAC19\uC740 \uC790\uB9AC ${comparison?.peerSamples ?? 0}\uBA85 \uBE44\uAD50`;
  }
  function syncFilterURL() {
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("date", selectedDate);
    url.searchParams.set("seat", selectedSeat);
    if (server !== DEFAULT_SERVER) url.searchParams.set("server", server);
    window.history.replaceState(null, "", url.href);
  }
  function syncMeta(total = 0, seed = dailySeed(selectedDate)) {
    $("leaderboard-title").textContent = `${selectedDate.replaceAll("-", ".")} \uAE30\uB85D`;
    $("leaderboard-count").textContent = `${number(total)}\uBA85`;
    $("leaderboard-meta").textContent = `\uD328\uC0B0 \uC2DC\uB4DC ${seed} \xB7 \uBC18\uC7A5\uC804 \xB7 ${selectedSeat === "all" ? "\uC804\uCCB4 \uC790\uB9AC" : `${WINDS[Number(selectedSeat)]} \uC2DC\uC791 \uC790\uB9AC`}`;
    $("leaderboard-fairness").textContent = selectedSeat === "all" ? "\uC804\uCCB4 \uC21C\uC704\uC5D0\uB294 \uC11C\uB85C \uB2E4\uB978 \uC2DC\uC791 \uC790\uB9AC\uAC00 \uC11E\uC5EC \uC788\uC2B5\uB2C8\uB2E4. \uC2DC\uC791 \uC790\uB9AC\uB97C \uACE8\uB77C \uAC19\uC740 \uC870\uAC74\uC758 \uAE30\uB85D\uC744 \uBE44\uAD50\uD558\uC138\uC694." : "\uAC19\uC740 \uBC30\uD328\xB7\uAC1C\uC778 \uD328\uC0B0\uC73C\uB85C \uC2DC\uC791\uD55C \uAC19\uC740 \uC790\uB9AC\uC758 \uCCAB \uAE30\uB85D\uC785\uB2C8\uB2E4. \uCE5C \uC5F0\uC7A5\uC5D0 \uB530\uB77C \uC644\uB8CC \uAD6D \uC218\uB294 \uB2EC\uB77C\uC9C8 \uC218 \uC788\uC5B4\uC694.";
  }
  async function json(path, { token, signal } = {}) {
    const response = await fetchImpl(`${server}/api/duplicate${path}`, { method: "GET", headers: { Accept: "application/json", ...token ? { "X-Duplicate-Account-Token": token } : {} }, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal });
    let data;
    try {
      data = await response.json();
    } catch {
      throw Error("\uC11C\uBC84 \uC751\uB2F5\uC744 \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uC0C8\uB85C\uACE0\uCE68\uD574 \uC8FC\uC138\uC694.");
    }
    if (!response.ok) throw Object.assign(Error(data?.error || "\uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."), { status: response.status });
    return data;
  }
  async function refresh() {
    const id = ++requestId;
    controller?.abort();
    controller = new AbortController();
    const activeController = controller, timer = window.setTimeout(() => activeController.abort(), 2e4);
    session = client.getSession();
    me = null;
    meError = null;
    visibleEntries = [];
    list.replaceChildren();
    $("leaderboard-benchmark-list").replaceChildren();
    $("leaderboard-benchmark-status").textContent = "AI \uAE30\uC900 \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uACE0 \uC788\uC2B5\uB2C8\uB2E4\u2026";
    $("leaderboard-discard-panel").hidden = true;
    status.textContent = "\uCCAB \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uACE0 \uC788\uC2B5\uB2C8\uB2E4\u2026";
    $("leaderboard-refresh").disabled = true;
    syncMeta();
    renderEntry();
    try {
      const query = `?date=${encodeURIComponent(selectedDate)}`;
      const results = await Promise.allSettled([json(`/daily/leaderboard${query}&seat=${selectedSeat}`, { signal: activeController.signal }), session ? json(`/daily/me${query}`, { token: session.token, signal: activeController.signal }) : Promise.resolve(null)]);
      if (destroyed || id !== requestId) return;
      const [boardResult, meResult] = results;
      if (meResult.status === "fulfilled") {
        me = meResult.value;
        if (session && (!me || me.date !== selectedDate || !["none", "playing", "completed", "expired"].includes(me.status))) {
          me = null;
          meError = "\uB0B4 \uCCAB \uB3C4\uC804 \uC0C1\uD0DC\uB97C \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.";
        }
        if (session && me && Number.isInteger(me.seat) && me.seat >= 0 && me.seat <= 3 && !seatExplicit && selectedSeat !== String(me.seat)) {
          selectedSeat = String(me.seat);
          seatInput.value = selectedSeat;
          syncFilterURL();
          await refresh();
          return;
        }
      } else {
        meError = meResult.reason?.status === 401 ? "\uB85C\uADF8\uC778\uC774 \uB9CC\uB8CC\uB410\uC2B5\uB2C8\uB2E4. \uACC4\uC815 \uC601\uC5ED\uC5D0\uC11C \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694." : meResult.reason?.name === "AbortError" ? "\uB0B4 \uAE30\uB85D \uD655\uC778 \uC2DC\uAC04\uC774 \uCD08\uACFC\uB410\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694." : meResult.reason?.message || "\uB0B4 \uCCAB \uB3C4\uC804 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.";
      }
      renderEntry();
      if (boardResult.status === "rejected") throw boardResult.reason;
      const data = boardResult.value;
      if (data?.date !== selectedDate || data?.seed !== dailySeed(selectedDate) || data?.format !== "hanchan" || data?.ranking !== "net") throw Error("\uC120\uD0DD\uD55C \uB0A0\uC9DC\uC758 \uAE30\uB85D\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      const entries = leaderboardRows(data.entries);
      visibleEntries = entries;
      renderRows(entries);
      renderEntry();
      renderOwnDiscards();
      try {
        renderBenchmarks(leaderboardBenchmarks(data.benchmarks));
      } catch (error) {
        $("leaderboard-benchmark-list").replaceChildren();
        $("leaderboard-benchmark-status").textContent = error.message;
      }
      syncMeta(Number.isSafeInteger(data.total) && data.total >= 0 ? data.total : entries.length, data.seed);
      status.textContent = entries.length ? "\uC810\uC218 \uC99D\uAC10\uC21C \xB7 \uB3D9\uC810\uC740 \uACF5\uB3D9 \uC21C\uC704\uC785\uB2C8\uB2E4." : "\uC544\uC9C1 \uC644\uB8CC\uB41C \uCCAB \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uCCAB \uB3C4\uC804\uC744 \uB05D\uB0B4\uACE0 \uC774 \uB0A0\uC9DC\uC758 \uAE30\uB85D\uC744 \uB0A8\uACA8 \uBCF4\uC138\uC694.";
    } catch (error) {
      if (destroyed || id !== requestId) return;
      status.textContent = error?.name === "AbortError" ? "\uAE30\uB85D \uD655\uC778 \uC2DC\uAC04\uC774 \uCD08\uACFC\uB410\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68\uD574 \uC8FC\uC138\uC694." : error?.message || "\uB9AC\uB354\uBCF4\uB4DC\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.";
    } finally {
      window.clearTimeout(timer);
      if (!destroyed && id === requestId) $("leaderboard-refresh").disabled = false;
    }
  }
  function changeFilter(explicit = seatExplicit) {
    if (!validLeaderboardDate(dateInput.value)) {
      dateInput.setCustomValidity("\uB0A0\uC9DC\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      dateInput.reportValidity();
      return;
    }
    dateInput.setCustomValidity("");
    selectedDate = dateInput.value;
    selectedSeat = leaderboardSeat(seatInput.value);
    seatExplicit = explicit;
    syncFilterURL();
    refresh();
  }
  const filter = $("leaderboard-filter"), submit = (event) => {
    event.preventDefault();
    changeFilter();
  }, dateChange = () => changeFilter(), seatChange = () => changeFilter(true);
  filter.addEventListener("submit", submit);
  dateInput.addEventListener("change", dateChange);
  seatInput.addEventListener("change", seatChange);
  const panel = accountPanel($("leaderboard-account"), { client, document: document2, privacyUrl: href("./tournament/privacy.html"), onSessionChange() {
    accountState();
    seatExplicit = params.has("seat");
    refresh();
  } });
  accountState();
  if (location.hash === "#account") openAccount();
  refresh();
  return { refresh, destroy() {
    destroyed = true;
    controller?.abort();
    panel.destroy();
    filter.removeEventListener("submit", submit);
    dateInput.removeEventListener("change", dateChange);
    seatInput.removeEventListener("change", seatChange);
  }, get state() {
    return { date: selectedDate, seat: selectedSeat, server };
  } };
}
if (typeof document !== "undefined" && document.getElementById("leaderboard-list")) mountLeaderboard(document);
export {
  leaderboardBenchmarks,
  leaderboardComparison,
  leaderboardHref,
  leaderboardRows,
  leaderboardSeat,
  leaderboardServer,
  mountLeaderboard,
  validLeaderboardDate,
  visibleDiscardPeers
};
