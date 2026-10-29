var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

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
  if (typeof value !== "string" || [...value].length < 8 || [...value].length > 128 || encoder.encode(value).length > 512) throw Error("\uBE44\uBC00\uBC88\uD638\uB294 8\u2013128\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
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
  const node = (tag, text, cls) => {
    const el = doc.createElement(tag);
    if (text !== void 0) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const status = node("p", "", "hint"), cancel = node("button", "\uC694\uCCAD \uCDE8\uC18C", "text-button"), content = node("div"), recoveryBox = node("section", void 0, "account-recovery");
  recoveryBox.hidden = true;
  cancel.type = "button";
  cancel.hidden = true;
  cancel.onclick = () => client.cancel();
  container.replaceChildren(content, recoveryBox, status, cancel);
  function field(form2, title, name, { password = false, fresh = false, required = true } = {}) {
    const label = node("label", title, "field"), input = node("input");
    input.name = name;
    input.required = required;
    input.type = password ? "password" : "text";
    input.autocomplete = password ? fresh ? "new-password" : "current-password" : "username";
    if (password) {
      input.minLength = 8;
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
    recoveryBox.replaceChildren(node("h3", "\uBCF5\uAD6C \uCF54\uB4DC \xB7 \uC9C0\uAE08 \uD55C \uBC88\uB9CC \uD45C\uC2DC"), node("p", "\uBE44\uBC00\uBC88\uD638\uB97C \uC783\uC73C\uBA74 \uC774 \uCF54\uB4DC\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4. \uC548\uC804\uD55C \uACF3\uC5D0 \uBCF4\uAD00\uD558\uC138\uC694. \uB2EB\uC740 \uB4A4\uC5D0\uB294 \uB2E4\uC2DC \uC870\uD68C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "hint"));
    const value = node("code", code), copy = node("button", "\uBCF5\uAD6C \uCF54\uB4DC \uBCF5\uC0AC", "secondary"), close = node("button", "\uBCF4\uAD00\uD588\uC2B5\uB2C8\uB2E4 \xB7 \uC228\uAE30\uAE30", "text-button");
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
    const section = node("section"), heading = node("h3", title), f = node("form"), submit = node("button", button, "primary");
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
      const tabs = node("nav", void 0, "account-tabs");
      for (const [key, label] of [["login", "\uB85C\uADF8\uC778"], ["register", "\uACC4\uC815 \uB9CC\uB4E4\uAE30"], ["recover", "\uACC4\uC815 \uBCF5\uAD6C"]]) {
        const button = node("button", label, key === mode ? "secondary active" : "text-button");
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
        const f = form("\uACC4\uC815 \uB9CC\uB4E4\uAE30", "\uACC4\uC815 \uB9CC\uB4E4\uAE30", (f2) => ({ nickname: field(f2, "\uB2C9\uB124\uC784 \xB7 1\u201320\uC790", "nickname"), password: field(f2, "\uBE44\uBC00\uBC88\uD638 \xB7 8\u2013128\uC790", "password", { password: true, fresh: true }) }), (data) => client.register({ ...data, privacyVersion: PRIVACY_VERSION }));
        const note = node("p", void 0, "hint"), link = node("a", "\uAC1C\uC778\uC815\uBCF4 \uCC98\uB9AC \uC548\uB0B4");
        link.href = privacyUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        note.append(link, node("span", "\uB97C \uC77D\uC5B4 \uC8FC\uC138\uC694. \uC774\uBA54\uC77C\uC740 \uBC1B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2C9\uB124\uC784\uC740 \uC911\uBCF5\uB418\uC9C0 \uC54A\uC544\uC57C \uD558\uBA70 \uBE44\uBC00\uBC88\uD638\uB294 \uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0 \uC800\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
        f.prepend(note);
      }
      if (mode === "recover") form("\uBCF5\uAD6C \uCF54\uB4DC\uB85C \uBE44\uBC00\uBC88\uD638 \uC7AC\uC124\uC815", "\uACC4\uC815 \uBCF5\uAD6C", (f) => ({ nickname: field(f, "\uB2C9\uB124\uC784", "nickname"), recoveryCode: field(f, "\uBCF5\uAD6C \uCF54\uB4DC", "recoveryCode", { password: true }), newPassword: field(f, "\uC0C8 \uBE44\uBC00\uBC88\uD638 \xB7 8\u2013128\uC790", "newPassword", { password: true, fresh: true }) }), (data) => client.recover(data));
      content.append(node("p", "\uACC4\uC815 \uC11C\uBE44\uC2A4\uAC00 \uAEBC\uC838 \uC788\uC5B4\uB3C4 \uC190\uB2D8 \uAC8C\uC784\uC740 \uACC4\uC18D \uC774\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uBE44\uBC00\uBC88\uD638 \uBD99\uC5EC\uB123\uAE30\uC640 \uBE44\uBC00\uBC88\uD638 \uAD00\uB9AC\uC790\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", "hint"));
      return;
    }
    content.append(node("h2", session.user.nickname), node("p", "\uB85C\uADF8\uC778\uD55C \uACC4\uC815\uC5D0 \uB300\uD68C \uC6B4\uC601 \uAE30\uB85D\uC744 \uC5F0\uACB0\uD569\uB2C8\uB2E4.", "hint"));
    const logout = node("button", "\uB85C\uADF8\uC544\uC6C3", "secondary");
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
    const details = node("details"), summary = node("summary", "\uACC4\uC815 \uAD00\uB9AC");
    details.append(summary);
    content.append(details);
    const group = node("div");
    details.append(group);
    function settings(title, button, build, perform) {
      const f = form(title, button, build, perform);
      group.append(content.lastChild);
      return f;
    }
    settings("\uB2C9\uB124\uC784 \uBCC0\uACBD", "\uB2C9\uB124\uC784 \uBCC0\uACBD", (f) => ({ nickname: field(f, "\uC0C8 \uB2C9\uB124\uC784", "nickname"), password: field(f, "\uD604\uC7AC \uBE44\uBC00\uBC88\uD638", "password", { password: true }) }), (data) => client.rename(data));
    settings("\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD", "\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD", (f) => ({ password: field(f, "\uD604\uC7AC \uBE44\uBC00\uBC88\uD638", "password", { password: true }), newPassword: field(f, "\uC0C8 \uBE44\uBC00\uBC88\uD638 \xB7 8\u2013128\uC790", "newPassword", { password: true, fresh: true }) }), (data) => client.changePassword(data));
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

// duplicate/observer-delay.mjs
var DEFAULT_OBSERVER_DELAY_SECONDS = 300;
var factor = (unit) => {
  if (!["seconds", "minutes"].includes(unit)) throw Error("\uC9C0\uC5F0 \uB2E8\uC704\uB97C \uD655\uC778\uD558\uC138\uC694.");
  return unit === "minutes" ? 60 : 1;
};
function observerDelaySeconds(value, unit = "seconds", { minimumSeconds = 5 } = {}) {
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") throw Error("\uC911\uACC4 \uC9C0\uC5F0 \uC2DC\uAC04\uC744 \uC785\uB825\uD558\uC138\uC694.");
  const seconds = Number(value) * factor(unit), rounded = Math.round(seconds);
  if (!Number.isFinite(seconds) || Math.abs(seconds - rounded) > 1e-7 || !Number.isSafeInteger(rounded)) throw Error("\uC911\uACC4 \uC9C0\uC5F0\uC740 1\uCD08 \uB2E8\uC704\uB85C \uC785\uB825\uD558\uC138\uC694. \uBD84 \uB2E8\uC704 \uC18C\uC218\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  if (!Number.isInteger(minimumSeconds) || minimumSeconds < 5 || minimumSeconds > 21600) throw Error("\uCD5C\uC18C \uC911\uACC4 \uC9C0\uC5F0\uC744 \uD655\uC778\uD558\uC138\uC694.");
  if (rounded < minimumSeconds || rounded > 21600) throw Error(`\uC911\uACC4 \uC9C0\uC5F0\uC740 ${minimumSeconds}\u201321600\uCD08 \uBC94\uC704\uB85C \uC785\uB825\uD558\uC138\uC694.`);
  return rounded;
}
function observerDelayValue(seconds, unit = "seconds") {
  return String(observerDelaySeconds(seconds) / factor(unit));
}
function bindObserverDelayInput(input, select, { seconds = 300, minimumSeconds = 5, onError = () => {
} } = {}) {
  let unit = select.value || "minutes", minimum = minimumSeconds;
  function constraints() {
    const scale = factor(unit);
    input.min = String(minimum / scale);
    input.max = String(21600 / scale);
    input.step = unit === "minutes" ? "any" : "1";
    input.inputMode = unit === "minutes" ? "decimal" : "numeric";
    input.setAttribute("aria-label", `\uC911\uACC4 \uC9C0\uC5F0 ${unit === "minutes" ? "\uBD84" : "\uCD08"}`);
  }
  function setSeconds(value) {
    const canonical = observerDelaySeconds(value);
    input.value = observerDelayValue(canonical, unit);
    constraints();
  }
  const change = () => {
    try {
      const value = observerDelaySeconds(input.value, unit);
      const next = select.value;
      factor(next);
      unit = next;
      setSeconds(value);
    } catch (error) {
      select.value = unit;
      onError(error.message);
    }
  };
  select.addEventListener("change", change);
  setSeconds(seconds);
  return {
    getSeconds: () => observerDelaySeconds(input.value, unit, { minimumSeconds: minimum }),
    setSeconds,
    setMinimum(value) {
      observerDelaySeconds(value);
      minimum = value;
      constraints();
    },
    destroy() {
      select.removeEventListener("change", change);
    }
  };
}

// duplicate/observer-links.mjs
var CODE = /^[A-Z2-9]{8}$/;
var KEY = /^[a-f0-9]{64}$/;
function tournamentNavigationLinks({ baseUrl, server, defaultServer = "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site" }) {
  const api = new URL(server);
  if (api.username || api.password || api.pathname !== "/" || api.search || api.hash || !["https:", "http:"].includes(api.protocol) || api.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)) throw new Error("\uC11C\uBC84 \uC8FC\uC18C\uB97C \uD655\uC778\uD558\uC138\uC694.");
  return Object.fromEntries([["game", "./"], ["manager", "./tournament/"], ["observer", "./tournament/observer.html"], ["wiki", "./wiki.html"]].map(([name, path]) => {
    const url = new URL(path, baseUrl);
    url.search = "";
    url.hash = "";
    if (api.origin !== new URL(defaultServer).origin) url.searchParams.set("server", api.origin);
    return [name, url.href];
  }));
}
function observerLink({ baseUrl, code, key, server, delaySeconds = DEFAULT_OBSERVER_DELAY_SECONDS }) {
  if (!CODE.test(code ?? "") || !KEY.test(key ?? "") || !Number.isSafeInteger(delaySeconds) || delaySeconds < 5 || delaySeconds > 21600) throw new Error("\uAD00\uC804 \uB9C1\uD06C \uC815\uBCF4\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  const api = new URL(server);
  if (!["https:", "http:"].includes(api.protocol) || api.username || api.password || api.pathname !== "/" || api.search || api.hash) throw new Error("\uC11C\uBC84 \uC8FC\uC18C\uB97C \uD655\uC778\uD558\uC138\uC694.");
  if (api.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)) throw new Error("\uACF5\uAC1C \uC11C\uBC84\uB294 HTTPS \uC8FC\uC18C\uB97C \uC0AC\uC6A9\uD558\uC138\uC694.");
  const url = new URL("./tournament/observer.html", baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("code", code);
  url.searchParams.set("server", api.origin);
  url.searchParams.set("delay", String(delaySeconds));
  url.hash = new URLSearchParams({ key }).toString();
  return url.href;
}

// duplicate/tournament/manager.mjs
var DEFAULT_SERVER = "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site";
var CODE2 = /^[A-Z2-9]{8}$/;
var winds = ["\u6771", "\u5357", "\u897F", "\u5317"];
var csvCell = (value) => {
  let text = value === null || value === void 0 ? "" : String(value);
  if (typeof value !== "number" && /^[\s\u0000-\u001f]*[=+\-@]/u.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
};
function publicFinalResults(room) {
  const final = room.finalResults ?? room.tournament?.finalResults;
  if (!final) return null;
  const scoring = room.scoring ?? final.scoring;
  return { code: String(room.code ?? ""), scoring: { method: scoring?.method, impUnit: scoring?.impUnit }, boardCount: room.boardCount, finalizedAt: room.tournament?.finalizedAt ?? final.finalizedAt, standings: (final.standings ?? []).map((p) => ({ name: p.name, tableId: p.tableId, seat: p.seat, ai: !!p.ai, rank: p.rank ?? null, score: p.score, points: p.points, mean: p.mean, difference: p.difference, imp: p.imp, samples: p.samples })) };
}
function finalResultsCSV(room) {
  const data = publicFinalResults(room);
  if (!data) return "";
  return "\uFEFF" + [["\uC774\uB984", "\uD0C1", "\uCD5C\uCD08 \uC790\uB9AC", "\uAD6C\uBD84", "\uC21C\uC704", "\uC810\uC218 \uC99D\uAC10", "\uD3C9\uADE0 \uB300\uBE44", "IMP", "\uD45C\uBCF8"], ...data.standings.map((p) => [p.name, p.tableId, winds[p.seat], p.ai ? "AI" : "\uC0AC\uB78C", p.rank, p.score, p.difference, p.imp, p.samples])].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
function mountManager(doc = globalThis.document, win = globalThis.window, { fetchImpl = globalThis.fetch, accountClient = null, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const $ = (id) => doc.getElementById(id), params = new URL(win.location.href).searchParams, server = normalizeAccountServer(params.get("server") ?? DEFAULT_SERVER), client = accountClient ?? createAccountClient({ server, fetchImpl }), siteRoot = new URL("../", win.location.href);
  let selected = CODE2.test(params.get("code") ?? "") ? params.get("code") : null, timer = null, controller = null, generation = 0, stopped = false, busy = false, room = null, destroyed = false, issued = null, pendingStart = null;
  const node = (tag, text, cls) => {
    const el = doc.createElement(tag);
    if (text !== void 0) el.textContent = String(text);
    if (cls) el.className = cls;
    return el;
  }, error = (text) => {
    $("manager-error").hidden = !text;
    $("manager-error").textContent = text ?? "";
  }, metric = (value) => Number.isFinite(value) ? value.toLocaleString("ko-KR") : "\u2014";
  const createURL = new URL("../", win.location.href);
  createURL.searchParams.set("create", "1");
  if (server !== DEFAULT_SERVER) createURL.searchParams.set("server", server);
  $("manager-create").href = createURL.href;
  if ($("manager-profile-link")) {
    const profileURL = new URL("../profile.html", win.location.href);
    if (server !== DEFAULT_SERVER) profileURL.searchParams.set("server", server);
    $("manager-profile-link").href = profileURL.href;
  }
  const navigation = tournamentNavigationLinks({ baseUrl: siteRoot.href, server });
  for (const [id, target] of [["manager-brand", "game"], ["manager-game-link", "game"], ["manager-observer-link", "observer"], ["manager-wiki-link", "wiki"]]) if ($(id)) $(id).href = navigation[target];
  function stop() {
    clearTimer(timer);
    timer = null;
    controller?.abort();
    controller = null;
    generation++;
  }
  async function api(path, { body, signal } = {}) {
    const session = client.getSession();
    if (!session) throw Error("\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
    const owned = signal ? null : new AbortController(), timeout = owned ? setTimer(() => owned.abort(), 15e3) : null;
    try {
      const response = await fetchImpl(`${server}/api/duplicate${path}`, { method: body === void 0 ? "GET" : "POST", headers: { Accept: "application/json", "X-Duplicate-Account-Token": session.token, ...body === void 0 ? {} : { "Content-Type": "application/json" } }, body: body === void 0 ? void 0 : JSON.stringify(body), cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: signal ?? owned.signal });
      let data;
      try {
        data = await response.json();
      } catch {
        throw Error("\uB300\uD68C \uC6B4\uC601 \uC751\uB2F5\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      }
      if (!response.ok) throw Object.assign(Error(data.error ?? "\uB300\uD68C \uC6B4\uC601 \uC11C\uBC84\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C \uD655\uC778\uC744 \uB20C\uB7EC \uB2E4\uC2DC \uC5F0\uACB0\uD558\uC138\uC694."), { status: response.status });
      return data;
    } finally {
      if (timeout !== null) clearTimer(timeout);
    }
  }
  function choose(code) {
    if (selected !== code) {
      issued = null;
      pendingStart = null;
    }
    selected = code;
    const url = new URL(win.location.href);
    url.searchParams.set("code", code);
    win.history.replaceState(null, "", url.href);
    void refresh(true);
  }
  async function copy(text) {
    try {
      await win.navigator.clipboard.writeText(text);
      $("manager-status").textContent = "\uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4.";
    } catch {
      error("\uBCF5\uC0AC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD45C\uC2DC\uB41C \uB9C1\uD06C\uB97C \uC9C1\uC811 \uC120\uD0DD\uD574 \uBCF5\uC0AC\uD574 \uC8FC\uC138\uC694.");
    }
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type })), a = node("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimer(() => URL.revokeObjectURL(url), 1e3);
  }
  async function action(name, extra = {}) {
    if (busy || !room) return;
    busy = true;
    pendingStart = null;
    stop();
    const current = room;
    renderDetail(room, true);
    error("");
    try {
      const result = await api(`/competitions/${current.code}/manage/${name}`, { body: { actionId: crypto.randomUUID(), revision: current.revision, ...extra } });
      if (name === "observer-access" && room?.code === current.code) showLinks(result);
      await refresh(true);
    } catch (e) {
      error(e.message);
      if (e.status === 503) {
        stopped = true;
        $("manager-status").textContent = "\uC790\uB3D9 \uD655\uC778 \uC911\uB2E8 \xB7 \uC0C8\uB85C \uD655\uC778\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uC791";
      } else if (!doc.hidden) timer = setTimer(() => void refresh(), 3e3);
    } finally {
      busy = false;
      renderDetail(room, true);
    }
  }
  function showLinks(result) {
    issued = { code: room.code, result };
    const box = $("manager-issued-links");
    if (!box) return;
    box.replaceChildren();
    for (const role of ["viewer", "caster"]) {
      const url = observerLink({ baseUrl: siteRoot.href, code: room.code, key: result[`${role}Key`], server, delaySeconds: result.delaySeconds ?? result.minimumDelaySeconds }), label = node("label", role === "viewer" ? "\uAD00\uC804\uC790 \xB7 \uC190\uD328 \uBE44\uACF5\uAC1C" : "\uC911\uACC4\uC790 \uC804\uC6A9 \xB7 \uACF5\uAC1C \uAE30\uB85D \uC190\uD328", "field"), input = node("input"), buttons = node("div", void 0, "button-row"), button = node("button", "\uBCF5\uC0AC", "secondary"), open = node("a", "\uC0C8 \uCC3D \u2197", "text-button");
      input.value = url;
      input.readOnly = true;
      button.type = "button";
      button.onclick = () => copy(url);
      open.href = url;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      buttons.append(button, open);
      label.append(input);
      box.append(label, buttons);
    }
    box.append(node("p", "\uC774\uC804 \uB9C1\uD06C\uB294 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC911\uACC4\uC790 \uB9C1\uD06C\uB97C \uCC38\uAC00\uC790\uC5D0\uAC8C \uACF5\uC720\uD558\uC9C0 \uB9C8\uC138\uC694. \uAD6D\xB7\uBCF8\uC7A5\uBCC4 \uC804\uD0C1 \uC644\uB8CC\xB7\uD1B5\uACFC\uC640 \uC9C0\uC5F0 \uC870\uAC74\uC744 \uCDA9\uC871\uD55C \uAE30\uB85D\uB9CC \uACF5\uAC1C\uD569\uB2C8\uB2E4.", "hint"));
  }
  function renderDetail(value, force = false) {
    if (pendingStart && (!value || pendingStart.code !== value.code || pendingStart.revision !== value.revision || value.tournament?.status !== "registration" || !value.tournament?.canStart)) pendingStart = null;
    if (!force && value && room?.code === value.code && room.revision === value.revision) {
      room = value;
      return;
    }
    room = value;
    const root = $("manager-detail");
    root.replaceChildren();
    if (!value) {
      root.append(node("p", "\uC6B4\uC601\uD560 \uB300\uD68C\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.", "hint"));
      return;
    }
    const t = value.tournament ?? {}, head = node("div", void 0, "manager-detail-head"), title = node("div");
    title.append(node("h2", value.code), node("p", `${t.status === "registration" ? "\uCC38\uAC00 \uB4F1\uB85D \uC911" : t.status === "final" ? "\uCD5C\uC885 \uC131\uC801 \uD655\uC815" : "\uB300\uD68C \uC9C4\uD589 \uC911"} \xB7 ${value.boardCount}\uAD6D \xB7 ${value.scoring?.method === "imp" ? "IMP" : "\uC6D0\uC810\uC218"} \uC9D1\uACC4`, "hint"));
    const codeCopy = node("button", "\uB300\uD68C \uCF54\uB4DC \uBCF5\uC0AC", "secondary");
    codeCopy.onclick = () => copy(value.code);
    head.append(title, codeCopy);
    root.append(head);
    const invite = new URL("../", win.location.href);
    invite.searchParams.set("code", value.code);
    if (server !== DEFAULT_SERVER) invite.searchParams.set("server", server);
    const actions = node("div", void 0, "manager-actions"), inviteCopy = node("button", "\uCC38\uAC00 \uB9C1\uD06C \uBCF5\uC0AC", "secondary");
    inviteCopy.onclick = () => copy(invite.href);
    actions.append(inviteCopy);
    if (t.status === "registration") {
      const start = node("button", "\uBA85\uB2E8 \uD655\uC815 \xB7 \uC804\uD0C1 \uC2DC\uC791", "primary");
      start.disabled = !t.canStart || busy || !!pendingStart;
      start.onclick = () => {
        if (busy || !room?.tournament?.canStart) return;
        pendingStart = { code: room.code, revision: room.revision };
        renderDetail(room, true);
      };
      actions.append(start);
    }
    root.append(actions, node("p", t.status === "registration" ? t.blockedReason ?? "\uBAA8\uB4E0 \uD0C1\uC758 \uC900\uBE44\uAC00 \uB05D\uB0AC\uC2B5\uB2C8\uB2E4. \uBA85\uB2E8\uC744 \uD655\uC815\uD558\uBA74 \uCD94\uAC00 \uCC38\uAC00\uAC00 \uB9C8\uAC10\uB429\uB2C8\uB2E4." : t.status === "final" ? "\uBAA8\uB4E0 \uD0C1\uC758 \uC131\uC801\uC774 \uD655\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4." : "\uC804\uD0C1 \uC885\uB8CC \uD6C4 \uCD5C\uC885 \uC131\uC801\uC744 \uC790\uB3D9 \uD655\uC815\uD569\uB2C8\uB2E4. \uAD00\uC804 \uAE30\uB85D\uC740 \uAD6D\xB7\uBCF8\uC7A5\uBCC4\uB85C \uBCF4\uD638\uD569\uB2C8\uB2E4.", "hint"));
    if (pendingStart) {
      const confirmation = node("section", void 0, "manager-start-confirm");
      confirmation.setAttribute("role", "group");
      confirmation.setAttribute("aria-label", "\uB300\uD68C \uC2DC\uC791 \uD655\uC778");
      confirmation.append(node("strong", "\uCC38\uAC00 \uBA85\uB2E8\uC744 \uD655\uC815\uD558\uACE0 \uBAA8\uB4E0 \uD0C1\uC744 \uC2DC\uC791\uD560\uAE4C\uC694?"), node("p", "\uC2DC\uC791 \uD6C4\uC5D0\uB294 \uCD94\uAC00 \uCC38\uAC00\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC544\uB798 \uBA85\uB2E8\uC744 \uD655\uC778\uD55C \uB4A4 \uD655\uC815\uD574 \uC8FC\uC138\uC694.", "hint"));
      const buttons = node("div", void 0, "manager-actions"), confirm = node("button", "\uBA85\uB2E8 \uD655\uC815\uD558\uACE0 \uC804\uD0C1 \uC2DC\uC791", "primary"), cancel = node("button", "\uCDE8\uC18C", "secondary");
      confirm.type = cancel.type = "button";
      confirm.onclick = () => {
        if (!busy && pendingStart?.code === room?.code && pendingStart?.revision === room?.revision) void action("start");
      };
      cancel.onclick = () => {
        pendingStart = null;
        renderDetail(room, true);
      };
      buttons.append(confirm, cancel);
      confirmation.append(buttons);
      root.append(confirmation);
    }
    const grid = node("div", void 0, "manager-tables");
    for (const table of value.tables ?? []) {
      const card = node("section", void 0, "manager-table");
      card.append(node("h3", table.id), node("p", `${table.board ?? "\u2014"}\uAD6D ${table.honba ?? 0}\uBCF8\uC7A5 \xB7 ${table.seriesComplete ? "\uC804\uCCB4 \uC885\uB8CC" : table.phase === "lobby" ? "\uC2DC\uC791 \uB300\uAE30" : table.phase === "ended" ? "\uAD6D \uC885\uB8CC" : "\uC9C4\uD589 \uC911"}`));
      const list = node("ul");
      for (let seat = 0; seat < 4; seat++) {
        const member = table.members?.find((m) => m.seat === seat), li = node("li");
        li.append(node("span", `${winds[seat]} \xB7 ${member?.name ?? "\uBE48\uC790\uB9AC"}`), node("span", member?.ai ? "AI" : member ? "\uCC38\uAC00\uC790" : "\uB300\uAE30"));
        list.append(li);
      }
      card.append(list);
      if (t.status === "registration" && (table.members?.length ?? 0) < 4) {
        const fill = node("button", "\uBE48\uC790\uB9AC\uB97C AI\uB85C \uCC44\uC6B0\uAE30", "secondary");
        fill.onclick = () => void action("fill-table", { tableId: table.id });
        card.append(fill);
      }
      grid.append(card);
    }
    root.append(grid);
    const observer = node("section", void 0, "manager-section manager-links");
    observer.append(node("h3", "\uAD00\uC804\xB7\uC911\uACC4 \uB9C1\uD06C"), node("p", "\uD544\uC694\uD560 \uB54C\uB9CC \uBC1C\uAE09\uD574 \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uB9C1\uD06C\uB97C \uB2E4\uC2DC \uB9CC\uB4E4\uBA74 \uC774\uC804 \uB9C1\uD06C\uB294 \uB9CC\uB8CC\uB429\uB2C8\uB2E4.", "hint"));
    const fields = node("div", void 0, "two-fields"), label = node("label", "\uCD5C\uC18C \uC911\uACC4 \uC9C0\uC5F0", "field"), delay = node("input"), unitLabel = node("label", "\uB2E8\uC704", "field"), unit = node("select");
    delay.type = "number";
    unit.setAttribute("aria-label", "\uC9C0\uC5F0 \uC2DC\uAC04 \uB2E8\uC704");
    for (const [value2, text] of [["seconds", "\uCD08"], ["minutes", "\uBD84"]]) {
      const option = node("option", text);
      option.value = value2;
      unit.append(option);
    }
    unit.value = "minutes";
    const delayInput = bindObserverDelayInput(delay, unit, { seconds: value.observer?.minimumDelaySeconds ?? DEFAULT_OBSERVER_DELAY_SECONDS, onError: error });
    label.append(delay);
    unitLabel.append(unit);
    fields.append(label, unitLabel);
    const issue = node("button", "\uB9C1\uD06C \uB9CC\uB4E4\uAE30 \xB7 \uC7AC\uBC1C\uAE09", "secondary");
    issue.onclick = () => {
      try {
        void action("observer-access", { delaySeconds: delayInput.getSeconds() });
      } catch (e) {
        error(e.message);
      }
    };
    const links = node("div");
    links.id = "manager-issued-links";
    observer.append(fields, node("p", "\uAE30\uBCF8 5\uBD84(300\uCD08) \xB7 \uCD5C\uC18C 5\uCD08 \xB7 \uCD5C\uB300 360\uBD84. \uBD84 \uB2E8\uC704 \uC18C\uC218\uB3C4 \uC785\uB825\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", "hint"), issue, links);
    root.append(observer);
    if (issued?.code === value.code) showLinks(issued.result);
    const final = publicFinalResults(value);
    if (final) {
      const section = node("section", void 0, "manager-section");
      section.append(node("h3", "\uCD5C\uC885 \uC131\uC801"), node("p", "\uAC19\uC740 \uCD5C\uCD08 \uC790\uB9AC\uC758 \uBCF8\uC7A5\uC744 \uD3EC\uD568\uD55C \uAD6D\uBCC4 \uBE44\uAD50\uC785\uB2C8\uB2E4. \uC0AC\uB78C\uACFC AI\uB294 \uBCC4\uB3C4 \uC9D1\uB2E8\uC774\uBA70 \uD45C\uBCF8 2\uBA85 \uBBF8\uB9CC\uC740 \uD3C9\uADE0 \uB300\uBE44\xB7IMP\xB7\uC21C\uC704\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", "hint"));
      const buttons = node("div", void 0, "manager-actions");
      for (const [name, title2, type, text] of [["csv", "CSV \uB0B4\uB824\uBC1B\uAE30", "text/csv;charset=utf-8", finalResultsCSV(value)], ["json", "JSON \uB0B4\uB824\uBC1B\uAE30", "application/json", JSON.stringify(final, null, 2)]]) {
        const b = node("button", title2, "secondary");
        b.onclick = () => download(`${value.code}-results.${name}`, text, type);
        buttons.append(b);
      }
      section.append(buttons);
      const wrap = node("div", void 0, "manager-results"), table = node("table", void 0, "standings"), head2 = node("tr");
      for (const text of ["\uC21C\uC704", "\uC774\uB984", "\uD0C1/\uC790\uB9AC", "\uAD6C\uBD84", "\uC810\uC218 \uC99D\uAC10", "\uD3C9\uADE0 \uB300\uBE44", "IMP"]) head2.append(node("th", text));
      table.append(head2);
      for (const p of final.standings) {
        const row = node("tr");
        for (const text of [p.rank ?? "\u2014", p.name, `${p.tableId}/${winds[p.seat]}`, p.ai ? "AI" : "\uC0AC\uB78C", metric(p.score), metric(p.difference), metric(p.imp)]) row.append(node("td", text));
        table.append(row);
      }
      wrap.append(table);
      section.append(wrap);
      root.append(section);
    }
    const source = node("p", void 0, "manager-source"), link = node("a", "MIL Duplicate \uBC29\uC2DD \uCC38\uACE0 \u2197");
    link.href = "https://mahjong-mil.org/rules_dup/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    source.append(link, node("span", " \xB7 \uB9AC\uCE58 \uD310\xB7\uBD80\uC640 \uCE5C \uC5F0\uC7A5 \uBC0F \uB9AC\uCE58\uC6A9 IMP \uD658\uC0B0\uC740 \uC774 \uC571\uC758 \uBCC4\uB3C4 \uC801\uC6A9 \uADDC\uCE59\uC785\uB2C8\uB2E4."));
    root.append(source);
  }
  async function refresh(manual = false) {
    if (destroyed) return;
    if (manual) stopped = false;
    stop();
    const session = client.getSession();
    if (!session) {
      $("manager-list").replaceChildren();
      renderDetail(null);
      $("manager-status").textContent = "\uB85C\uADF8\uC778\uD558\uBA74 \uC6B4\uC601\uD560 \uC218 \uC788\uB294 \uB300\uD68C\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.";
      return;
    }
    if (stopped || doc.hidden) return;
    const epoch = generation, abort = new AbortController();
    controller = abort;
    const timeout = setTimer(() => abort.abort(), 15e3);
    try {
      const list = await api("/manage", { signal: abort.signal });
      if (epoch !== generation) return;
      const values = list.competitions ?? [], box = $("manager-list");
      box.replaceChildren();
      for (const item of values) {
        const button = node("button", void 0, `manager-room-button${item.code === selected ? " active" : ""}`);
        button.append(node("strong", item.code), node("small", `${item.tournament?.status === "registration" ? "\uB4F1\uB85D \uC911" : item.tournament?.status === "final" ? "\uC131\uC801 \uD655\uC815" : "\uC9C4\uD589 \uC911"} \xB7 ${item.boardCount ?? "\u2014"}\uAD6D`));
        button.onclick = () => choose(item.code);
        box.append(button);
      }
      if (!values.length) box.append(node("p", "\uC6B4\uC601 \uC911\uC778 \uB300\uD68C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC0C8 \uB300\uD68C\uB97C \uB9CC\uB4E4\uC5B4 \uC8FC\uC138\uC694.", "hint"));
      if (!selected && values.length) selected = values[0].code;
      if (selected) {
        const value = await api(`/competitions/${selected}/manage`, { signal: abort.signal });
        if (epoch !== generation) return;
        renderDetail(value);
      } else renderDetail(null);
      error("");
      $("manager-status").textContent = "3\uCD08\uB9C8\uB2E4 \uBA85\uB2E8\uACFC \uC9C4\uD589 \uC0C1\uD0DC\uB9CC \uD655\uC778\uD569\uB2C8\uB2E4. \uC774 \uD654\uBA74\uC740 \uB300\uAD6D\uACFC AI\uB97C \uC9C4\uD589\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
    } catch (e) {
      if (epoch !== generation) return;
      stopped = true;
      error(e.name === "AbortError" ? "\uC6B4\uC601 \uC11C\uBC84 \uC751\uB2F5\uC774 \uB2A6\uC5B4 \uC790\uB3D9 \uD655\uC778\uC744 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C \uD655\uC778\uC744 \uB20C\uB7EC \uB2E4\uC2DC \uC5F0\uACB0\uD558\uC138\uC694." : e.message);
      $("manager-status").textContent = "\uC790\uB3D9 \uD655\uC778 \uC911\uB2E8 \xB7 \uC0C8\uB85C \uD655\uC778\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uC791";
    } finally {
      clearTimer(timeout);
      if (epoch === generation) {
        controller = null;
        if (!stopped && !doc.hidden && !destroyed) timer = setTimer(() => void refresh(), 3e3);
      }
    }
  }
  mountAccountPanel($("manager-account"), { client, privacyUrl: "./privacy.html", onSessionChange: () => {
    issued = null;
    selected = null;
    renderDetail(null);
    void refresh(true);
  } });
  $("manager-refresh").onclick = () => void refresh(true);
  const visibility = () => {
    if (doc.hidden) stop();
    else if (!stopped) void refresh();
  };
  doc.addEventListener("visibilitychange", visibility);
  const destroy = () => {
    destroyed = true;
    issued = null;
    stop();
    client.cancel();
    doc.removeEventListener("visibilitychange", visibility);
  };
  win.addEventListener("pagehide", destroy, { once: true });
  void refresh();
  return { client, refresh, destroy };
}
if (typeof document !== "undefined" && document.getElementById("manager-root")) mountManager();
export {
  csvCell,
  finalResultsCSV,
  mountManager,
  publicFinalResults
};
