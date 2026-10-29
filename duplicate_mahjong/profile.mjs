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
        const f = form("\uACC4\uC815 \uB9CC\uB4E4\uAE30", "\uACC4\uC815 \uB9CC\uB4E4\uAE30", (f2) => ({ nickname: field(f2, "\uB2C9\uB124\uC784 \xB7 1\u201320\uC790", "nickname"), password: field(f2, "\uBE44\uBC00\uBC88\uD638 \xB7 8\u2013128\uC790", "password", { password: true, fresh: true }) }), (data) => client.register({ ...data, privacyVersion: PRIVACY_VERSION }));
        const note = node3("p", void 0, "hint"), link = node3("a", "\uAC1C\uC778\uC815\uBCF4 \uCC98\uB9AC \uC548\uB0B4");
        link.href = privacyUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        note.append(link, node3("span", "\uB97C \uC77D\uC5B4 \uC8FC\uC138\uC694. \uC774\uBA54\uC77C\uC740 \uBC1B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2C9\uB124\uC784\uC740 \uC911\uBCF5\uB418\uC9C0 \uC54A\uC544\uC57C \uD558\uBA70 \uBE44\uBC00\uBC88\uD638\uB294 \uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0 \uC800\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
        f.prepend(note);
      }
      if (mode === "recover") form("\uBCF5\uAD6C \uCF54\uB4DC\uB85C \uBE44\uBC00\uBC88\uD638 \uC7AC\uC124\uC815", "\uACC4\uC815 \uBCF5\uAD6C", (f) => ({ nickname: field(f, "\uB2C9\uB124\uC784", "nickname"), recoveryCode: field(f, "\uBCF5\uAD6C \uCF54\uB4DC", "recoveryCode", { password: true }), newPassword: field(f, "\uC0C8 \uBE44\uBC00\uBC88\uD638 \xB7 8\u2013128\uC790", "newPassword", { password: true, fresh: true }) }), (data) => client.recover(data));
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
function validateDiscardStats(stats, expectedTotal) {
  if (!plain2(stats) || Reflect.ownKeys(stats).length !== KEYS.length || !Reflect.ownKeys(stats).every((key) => KEYS.includes(key)) || !Array.isArray(stats.tiles) || stats.tiles.length !== 34 || !Array.from(stats.tiles).every(integer2) || ![...MODES, "claimed"].every((key) => integer2(stats[key]))) throw Error("Invalid discard statistics");
  const total = totalOf(stats), kinds = MODES.reduce((sum, key) => add(sum, stats[key]), 0);
  if (kinds !== total || stats.claimed > total || expectedTotal !== void 0 && (!integer2(expectedTotal) || expectedTotal !== total)) throw Error("Inconsistent discard statistics");
  return { tiles: [...stats.tiles], tsumogiri: stats.tsumogiri, tedashi: stats.tedashi, unknown: stats.unknown, claimed: stats.claimed };
}

// duplicate/discard-statistics-view.mjs
var percentage = (value) => value === null ? "\u2014" : `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
var pointDifference = (value) => value === null ? "\u2014" : `${value > 0 ? "+" : value < 0 ? "\u2212" : ""}${Number(Math.abs(value)).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%p`;
var node = (doc, tag, text, className) => {
  const element = doc.createElement(tag);
  if (text !== void 0) element.textContent = text;
  if (className) element.className = className;
  return element;
};
var knownTotal = (stats) => stats.tsumogiri + stats.tedashi;
var add2 = (left, right) => {
  const value = left + right;
  if (!Number.isSafeInteger(value)) throw Error("\uBC84\uB9BC \uAD6C\uBD84 \uD569\uACC4\uAC00 \uB108\uBB34 \uD07D\uB2C8\uB2E4.");
  return value;
};
function compareRecordedDiscards(own, peers = []) {
  const stats = validateDiscardStats(own);
  if (!Array.isArray(peers)) throw Error("\uBE44\uAD50 \uAE30\uB85D\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const checked = peers.map((value) => validateDiscardStats(value)), positive = checked.filter((value) => knownTotal(value) > 0), ownTotal = knownTotal(stats), peerSamples = positive.length, peerTotal = positive.reduce((sum, value) => add2(sum, knownTotal(value)), 0);
  const result = { ownTotal, peerSamples, peerTotal };
  for (const key of ["tsumogiri", "tedashi"]) {
    const ownCount = stats[key], peerCount = positive.reduce((sum, value) => add2(sum, value[key]), 0), ownPercent = ownTotal ? ownCount / ownTotal * 100 : null, peerPercent = peerSamples ? positive.reduce((sum, value) => sum + value[key] / knownTotal(value) * 100 / peerSamples, 0) : null;
    let difference = ownPercent === null || peerPercent === null ? null : ownPercent - peerPercent;
    if (difference !== null && Math.abs(difference) <= Number.EPSILON * Math.max(1, ownPercent, peerPercent) * peerSamples * 8) difference = 0;
    result[key] = { ownCount, ownPercent, peerCount, peerPercent, difference };
  }
  return result;
}
function renderDiscardStatistics(container, { own, peers = [], compare = false, title = "\uCBD4\uBAA8\uAE30\uB9AC\xB7\uD14C\uB2E4\uC2DC", document: doc = container.ownerDocument } = {}) {
  container.replaceChildren();
  if (own === null || own === void 0) {
    container.append(node(doc, "p", "\uC774 \uAE30\uB85D\uC5D0\uB294 \uBC84\uB9BC \uAD6C\uBD84 \uD1B5\uACC4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", "hint"));
    return null;
  }
  let comparison;
  try {
    comparison = compareRecordedDiscards(own, peers);
  } catch {
    container.append(node(doc, "p", "\uBC84\uB9BC \uAD6C\uBD84 \uD1B5\uACC4\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "hint"));
    return null;
  }
  const section = node(doc, "section", void 0, `discard-distribution${compare ? " is-comparison" : ""}`);
  section.append(node(doc, "h3", title, "discard-distribution-title"));
  const total = `\uBD84\uB958\uAC00 \uAE30\uB85D\uB41C \uBC84\uB9BC ${comparison.ownTotal.toLocaleString("ko-KR")}\uD68C`;
  section.append(node(doc, "p", compare ? `${total} \xB7 \uBE44\uAD50 ${comparison.peerSamples}\uBA85` : total, "hint"));
  const modes = node(doc, "dl", void 0, "discard-mode-stats");
  for (const [key, label] of [["tsumogiri", "\uCBD4\uBAA8\uAE30\uB9AC"], ["tedashi", "\uD14C\uB2E4\uC2DC"]]) {
    const metric = comparison[key], cell = node(doc, "div");
    cell.append(node(doc, "dt", label), node(doc, "dd", `${metric.ownCount}\uD68C \xB7 ${percentage(metric.ownPercent)}`));
    if (compare) cell.append(node(doc, "small", `\uD3C9\uADE0 ${percentage(metric.peerPercent)} \xB7 ${pointDifference(metric.difference)}`));
    modes.append(cell);
  }
  section.append(modes, node(doc, "p", "\uCBD4\uBAA8\uAE30\uB9AC\xB7\uD14C\uB2E4\uC2DC\uAC00 \uAE30\uB85D\uB41C \uBC84\uB9BC\uB9CC \uACC4\uC0B0\uD569\uB2C8\uB2E4.", "hint"));
  if (compare) section.append(node(doc, "p", comparison.peerSamples ? "\uB2E4\uB978 \uC0AC\uB78C \uD3C9\uADE0\uC740 \uC0AC\uB78C\uB9C8\uB2E4 \uAC19\uC740 \uBE44\uC911\uC73C\uB85C \uACC4\uC0B0\uD569\uB2C8\uB2E4." : "\uD604\uC7AC \uD45C\uC2DC\uB41C \uAC19\uC740 \uC790\uB9AC\uC758 \uB2E4\uB978 \uC0AC\uB78C\uC5D0\uAC8C \uBE44\uAD50 \uAC00\uB2A5\uD55C \uBC84\uB9BC \uAD6C\uBD84 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", "hint"));
  container.append(section);
  return comparison;
}

// duplicate/profile.mjs
var DEFAULT_SERVER = "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site";
var SVG = "http://www.w3.org/2000/svg";
var number = (value) => Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
var signed = (value) => `${value > 0 ? "+" : ""}${number(value)}`;
var node2 = (document2, tag, text, className) => {
  const element = document2.createElement(tag);
  if (text !== void 0) element.textContent = text;
  if (className) element.className = className;
  return element;
};
var svgNode = (document2, tag, attributes = {}, text) => {
  const element = document2.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== void 0) element.textContent = text;
  return element;
};
var safeStorage = (window, key) => {
  try {
    return window[key];
  } catch {
    return void 0;
  }
};
var formatLabel = (format) => format === "east" ? "\uB3D9\uD48D\uC804" : "\uBC18\uC7A5\uC804";
var percent = (value) => value === null ? "\u2014" : `${number(value * 100)}%`;
var optionalCount = (value) => value === null ? "\u2014" : number(value);
var seedLabel = (point) => point.seed === null ? "\uC2DC\uB4DC \uBE44\uACF5\uAC1C" : `\uC2DC\uB4DC ${point.seed}`;
var profileFormat = (value) => value === "east" ? "east" : "hanchan";
var profileLimit = (value) => [10, 50, 100].includes(Number(value)) ? Number(value) : 10;
function profileServer(base, stored) {
  for (const candidate of [new URL(base).searchParams.get("server"), stored, DEFAULT_SERVER]) {
    try {
      if (candidate) return normalizeAccountServer(candidate);
    } catch {
    }
  }
  return DEFAULT_SERVER;
}
function profileHref(target, base, server) {
  const current = new URL(base), url = new URL(target, current);
  let checked;
  try {
    checked = normalizeAccountServer(server ?? current.searchParams.get("server"));
  } catch {
  }
  if (url.origin === current.origin && checked && checked !== DEFAULT_SERVER) url.searchParams.set("server", checked);
  return url.href;
}
function rankChartGeometry(records, { width = 960, height = 270 } = {}) {
  if (!Array.isArray(records) || records.length > 100 || !records.every((record) => Number.isInteger(record.rank) && record.rank >= 1 && record.rank <= 4)) throw Error("\uC21C\uC704 \uAE30\uB85D\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const left = 50, right = 24, top = 28, bottom = 42, plotWidth = width - left - right, plotHeight = height - top - bottom;
  const points = records.map((record, index) => ({ ...record, index, x: records.length === 1 ? left + plotWidth / 2 : left + plotWidth * index / (records.length - 1), y: top + plotHeight * (record.rank - 1) / 3 }));
  return { width, height, left, right, top, bottom, points, path: points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ") };
}
function pointDate(value) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function pointLabel(point, index, total) {
  return `${index + 1}/${total}\uBC88\uC9F8 \uACBD\uAE30 \xB7 ${pointDate(point.completedAt)} \xB7 ${point.rank}\uC704 \xB7 ${seedLabel(point)} \xB7 \uCD5C\uC885 ${number(point.points)}\uC810`;
}
function renderRankChart(container, records, { document: document2 = container.ownerDocument, tooltip, prevButton, nextButton, position } = {}) {
  container.replaceChildren();
  tooltip?.replaceChildren();
  if (prevButton) {
    prevButton.disabled = true;
    prevButton.onclick = null;
  }
  if (nextButton) {
    nextButton.disabled = true;
    nextButton.onclick = null;
  }
  if (position) position.textContent = "0\uACBD\uAE30";
  let measuredWidth = Number(container.clientWidth);
  if (!(measuredWidth > 0) && typeof container.getBoundingClientRect === "function") measuredWidth = Number(container.getBoundingClientRect().width);
  const chartWidth = Number.isFinite(measuredWidth) && measuredWidth > 0 && measuredWidth < 600 ? Math.max(220, Math.round(measuredWidth)) : 960;
  const geometry = rankChartGeometry(records, { width: chartWidth, height: 270 });
  if (!records.length) {
    container.append(node2(document2, "p", "\uC774 \uD615\uC2DD\uC73C\uB85C \uC644\uB8CC\uD55C \uACBD\uAE30 \uAE30\uB85D\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.", "profile-chart-empty"));
    return { select() {
    }, get selected() {
      return null;
    } };
  }
  const svg = svgNode(document2, "svg", { viewBox: `0 0 ${geometry.width} ${geometry.height}`, role: "group", "aria-labelledby": "profile-rank-chart-title profile-rank-chart-description" });
  svg.append(svgNode(document2, "title", { id: "profile-rank-chart-title" }, "\uCD5C\uADFC \uACBD\uAE30\uC758 \uD0C1\uB0B4 \uCD5C\uC885 \uC21C\uC704"), svgNode(document2, "desc", { id: "profile-rank-chart-description" }, `\uC644\uB8CC\uB41C ${records.length}\uACBD\uAE30. \uC67C\uCABD\uC740 \uC624\uB798\uB41C \uACBD\uAE30, \uC624\uB978\uCABD\uC740 \uCD5C\uADFC \uACBD\uAE30\uC785\uB2C8\uB2E4. 1\uC704\uB294 \uC704\uCABD, 4\uC704\uB294 \uC544\uB798\uCABD\uC785\uB2C8\uB2E4.`));
  for (let rank = 1; rank <= 4; rank++) {
    const y = geometry.top + (geometry.height - geometry.top - geometry.bottom) * (rank - 1) / 3;
    svg.append(svgNode(document2, "line", { x1: geometry.left, y1: y, x2: geometry.width - geometry.right, y2: y, class: "profile-chart-grid", "aria-hidden": "true" }), svgNode(document2, "text", { x: 3, y: y + 5, class: "profile-chart-axis", "aria-hidden": "true" }, `${rank}\uC704`));
  }
  svg.append(svgNode(document2, "path", { d: geometry.path, class: "profile-chart-line", "aria-hidden": "true" }));
  const circles = [];
  let active = -1;
  function select(index, { focus = false } = {}) {
    const checked = Math.max(0, Math.min(records.length - 1, Number.isInteger(index) ? index : records.length - 1));
    if (active !== checked) {
      active = checked;
      for (const [i, circle] of circles.entries()) {
        circle.setAttribute("tabindex", i === active ? "0" : "-1");
        circle.setAttribute("aria-pressed", String(i === active));
      }
      const point = geometry.points[active];
      if (tooltip) {
        tooltip.replaceChildren(node2(document2, "strong", `${pointDate(point.completedAt)} \xB7 ${point.rank}\uC704`), node2(document2, "p", `${seedLabel(point)} \xB7 \uCD5C\uC885 ${number(point.points)}\uC810 \xB7 \uC810\uC218 \uBCC0\uD654 ${signed(point.net)}\uC810`));
        tooltip.dataset.index = String(active);
      }
      if (position) position.textContent = `${active + 1} / ${records.length}\uACBD\uAE30`;
      if (prevButton) prevButton.disabled = active === 0;
      if (nextButton) nextButton.disabled = active === records.length - 1;
    }
    if (focus) circles[active].focus();
  }
  for (const point of geometry.points) {
    const hit = svgNode(document2, "circle", { cx: point.x, cy: point.y, r: 12, class: "profile-chart-hit", "aria-hidden": "true" }), circle = svgNode(document2, "circle", { cx: point.x, cy: point.y, r: 4.5, class: "profile-chart-dot", role: "button", tabindex: "-1", "aria-pressed": "false", "aria-label": pointLabel(point, point.index, records.length) });
    circle.append(svgNode(document2, "title", {}, pointLabel(point, point.index, records.length)));
    for (const target of [hit, circle]) {
      target.addEventListener("click", () => select(point.index));
      target.addEventListener("pointerenter", () => select(point.index));
    }
    circle.addEventListener("focus", () => select(point.index));
    circle.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowLeft") next = point.index - 1;
      else if (event.key === "ArrowRight") next = point.index + 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = records.length - 1;
      else if (event.key === "Enter" || event.key === " ") next = point.index;
      if (next !== void 0) {
        event.preventDefault();
        select(next, { focus: true });
      }
    });
    circles.push(circle);
    svg.append(hit, circle);
  }
  for (const [point, anchor] of [[geometry.points[0], "start"], [geometry.points.at(-1), "end"]]) if (records.length > 1 || anchor === "start") svg.append(svgNode(document2, "text", { x: point.x, y: geometry.height - 8, "text-anchor": anchor, class: "profile-chart-axis", "aria-hidden": "true" }, new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }).format(new Date(point.completedAt))));
  container.append(svg);
  if (prevButton) prevButton.onclick = () => select(active - 1);
  if (nextButton) nextButton.onclick = () => select(active + 1);
  select(records.length - 1);
  return { select, get selected() {
    return active;
  } };
}
var integer3 = (value) => Number.isSafeInteger(value) && value >= 0;
var nullable = (value, test) => value === null || test(value);
var coverageCounts = ["actionGames", "actionHands", "discardGames", "discardHands", "openHandsGames", "openHandsHands", "winPointsGames", "winPointsHands", "dealInPointsGames", "dealInPointsHands"];
function normalizeSummary(value) {
  if (!value || !integer3(value.games) || !integer3(value.hands) || !Array.isArray(value.rankCounts) || value.rankCounts.length !== 4 || !value.rankCounts.every(integer3) || value.rankCounts.reduce((sum, count) => sum + count, 0) !== value.games || !Number.isSafeInteger(value.net) || !nullable(value.avgNet, Number.isFinite) || !nullable(value.avgRank, (number2) => Number.isFinite(number2) && number2 >= 1 && number2 <= 4)) throw Error("\uB204\uC801 \uD1B5\uACC4\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  for (const key of ["topRate", "lastAvoidRate", "winRate", "dealInRate", "riichiRate", "callRate"]) if (!nullable(value[key], (number2) => Number.isFinite(number2) && number2 >= 0 && number2 <= 1)) throw Error("\uD1B5\uACC4 \uBE44\uC728\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  if (!nullable(value.kanRate, (number2) => Number.isFinite(number2) && number2 >= 0 && number2 <= 4)) throw Error("\uAE61 \uD1B5\uACC4\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  for (const key of ["openHands", "winPoints", "dealInPoints"]) if (!nullable(value[key], integer3)) throw Error("\uD589\uB3D9 \uD1B5\uACC4\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  for (const key of ["avgWinPoints", "avgDealInPoints"]) if (!nullable(value[key], (number2) => Number.isFinite(number2) && number2 >= 0)) throw Error("\uD3C9\uADE0 \uC810\uC218\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const coverage = {};
  for (const key of coverageCounts) {
    if (!integer3(value.coverage?.[key]) || value.coverage[key] > (key.endsWith("Games") ? value.games : value.hands)) throw Error("\uD1B5\uACC4 \uD45C\uBCF8 \uC218\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    coverage[key] = value.coverage[key];
  }
  for (const key of ["winPointsWins", "dealInPointsDealIns"]) {
    if (!nullable(value.coverage?.[key], integer3)) throw Error("\uC810\uC218 \uD45C\uBCF8 \uC218\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    coverage[key] = value.coverage[key];
  }
  const stats = value.stats === null ? null : validateActionStats(value.stats, coverage.actionHands), discardStats = value.discardStats === null ? null : validateDiscardStats(value.discardStats);
  return { games: value.games, hands: value.hands, rankCounts: [...value.rankCounts], avgRank: value.avgRank, topRate: value.topRate, lastAvoidRate: value.lastAvoidRate, net: value.net, avgNet: value.avgNet, stats, winRate: value.winRate, dealInRate: value.dealInRate, riichiRate: value.riichiRate, callRate: value.callRate, kanRate: value.kanRate, discardStats, openHands: value.openHands, winPoints: value.winPoints, dealInPoints: value.dealInPoints, avgWinPoints: value.avgWinPoints, avgDealInPoints: value.avgDealInPoints, coverage };
}
function normalizeProfileResponse(value, { format, limit } = {}) {
  if (!value || !["hanchan", "east"].includes(value.format) || ![10, 50, 100].includes(value.window) || format && value.format !== format || limit && value.window !== limit || !Array.isArray(value.history) || value.history.length > value.window) throw Error("\uC120\uD0DD\uD55C \uD615\uC2DD\uC758 \uB300\uAD6D \uAE30\uB85D\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const ids = /* @__PURE__ */ new Set(), history = value.history.map((record) => {
    if (!record || typeof record.id !== "string" || !record.id || record.id.length > 256 || ids.has(record.id) || !integer3(record.completedAt) || !Number.isFinite(new Date(record.completedAt).getTime()) || !Number.isInteger(record.rank) || record.rank < 1 || record.rank > 4 || !Number.isSafeInteger(record.net) || !Number.isSafeInteger(record.points) || !nullable(record.seed, (seed) => integer3(seed) && seed <= 4294967295) || !["daily", "online", "server-practice"].includes(record.source) || !Number.isInteger(record.seat) || record.seat < 0 || record.seat > 3 || !integer3(record.hands) || record.hands < 1) throw Error("\uC644\uB8CC \uACBD\uAE30 \uAE30\uB85D\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    ids.add(record.id);
    return { id: record.id, completedAt: record.completedAt, rank: record.rank, net: record.net, points: record.points, seed: record.source === "online" ? null : record.seed, source: record.source, seat: record.seat, hands: record.hands };
  }).sort((left, right) => left.completedAt - right.completedAt);
  const total = normalizeSummary(value.total), recent = normalizeSummary(value.recent);
  if (recent.games !== history.length || recent.games > total.games) throw Error("\uCD5C\uADFC \uACBD\uAE30 \uC9D1\uACC4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  let backfill = null;
  if (value.backfill !== void 0) {
    const source = value.backfill;
    if (!source || !integer3(source.replayRetentionDays) || !integer3(source.processedMatches) || typeof source.remaining !== "boolean" || typeof source.excludedIncomplete !== "boolean") throw Error("\uACFC\uAC70 \uAE30\uB85D \uBCF5\uAD6C \uC0C1\uD0DC\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    backfill = { replayRetentionDays: source.replayRetentionDays, processedMatches: source.processedMatches, remaining: source.remaining, excludedIncomplete: source.excludedIncomplete };
  }
  return { format: value.format, window: value.window, total, recent, history, backfill };
}
function mountProfile(document2, { location = document2.defaultView.location, window = document2.defaultView, fetchImpl = window.fetch.bind(window), accountClient, accountPanel = mountAccountPanel, discardTileRenderer } = {}) {
  const $ = (id) => document2.getElementById(id), base = location.href, parameters = new URL(base).searchParams, storage = safeStorage(window, "localStorage");
  let storedServer;
  try {
    storedServer = JSON.parse(storage?.getItem("duplicate.server") || "null");
  } catch {
  }
  const server = profileServer(base, storedServer), client = accountClient ?? createAccountClient({ server, storage: safeStorage(window, "sessionStorage"), fetchImpl }), formatButtons = [...document2.querySelectorAll("[data-profile-format]")], limitButtons = [...document2.querySelectorAll("[data-profile-limit]")];
  let selectedFormat = profileFormat(parameters.get("format")), selectedLimit = profileLimit(parameters.get("limit")), model = null, session = client.getSession(), requestId = 0, controller = null, destroyed = false, chartView = null, resizeTimer = null;
  for (const anchor of document2.querySelectorAll("[data-profile-link]")) anchor.href = profileHref(anchor.dataset.profileLink, base, server);
  function syncControls() {
    for (const button of formatButtons) button.setAttribute("aria-pressed", String(button.dataset.profileFormat === selectedFormat));
    for (const button of limitButtons) button.setAttribute("aria-pressed", String(Number(button.dataset.profileLimit) === selectedLimit));
  }
  function syncURL() {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("format", selectedFormat);
    url.searchParams.set("limit", String(selectedLimit));
    if (server !== DEFAULT_SERVER) url.searchParams.set("server", server);
    window.history.replaceState(null, "", url.href);
  }
  function accountState() {
    session = client.getSession();
    $("profile-account-name").textContent = session ? `${session.user.nickname}\uB2D8\uC758 \uC644\uB8CC \uB300\uAD6D` : "\uB85C\uADF8\uC778\uD55C \uB0B4 \uACC4\uC815\uC758 \uC644\uB8CC\uB41C \uB300\uAD6D\uC744 \uC0B4\uD3B4\uBD05\uB2C8\uB2E4.";
    $("profile-account-summary").textContent = session ? `${session.user.nickname} \xB7 \uACC4\uC815 \uAD00\uB9AC` : "\uB0B4 \uAE30\uB85D\uC744 \uBCF4\uB824\uBA74 \uACC4\uC815 \uB85C\uADF8\uC778";
    $("profile-account-details").open = !session || location.hash === "#account";
  }
  function cell(container, label, value, detail, className = "profile-metric") {
    const item = node2(document2, "div", void 0, className);
    item.append(node2(document2, "dt", label), node2(document2, "dd", value));
    if (detail) {
      const hint = node2(document2, "small");
      for (const part of String(detail).split(/([\d,]+(?:\.\d+)?(?:회|국|경기))/g)) if (part) hint.append(node2(document2, "span", part, /^[\d,]+(?:\.\d+)?(?:회|국|경기)$/.test(part) ? "profile-count" : ""));
      item.append(hint);
    }
    container.append(item);
  }
  function clearData() {
    model = null;
    chartView = null;
    $("profile-data").hidden = true;
    for (const id of ["profile-summary", "profile-rank-counts", "profile-recent-summary", "profile-actions", "profile-discards", "profile-chart", "profile-point-tooltip"]) $(id).replaceChildren();
    $("profile-point-prev").disabled = $("profile-point-next").disabled = true;
    $("profile-point-prev").onclick = $("profile-point-next").onclick = null;
    for (const id of ["profile-point-position", "profile-summary-count", "profile-summary-note", "profile-chart-caption", "profile-actions-count", "profile-actions-note", "profile-discard-note"]) $(id).textContent = "";
    $("profile-discard-details").open = false;
  }
  function drawChart({ preserve = false } = {}) {
    const selected = preserve ? chartView?.selected : null, container = $("profile-chart"), hadFocus = preserve && container.contains?.(document2.activeElement);
    chartView = renderRankChart(container, model.history, { document: document2, tooltip: $("profile-point-tooltip"), prevButton: $("profile-point-prev"), nextButton: $("profile-point-next"), position: $("profile-point-position") });
    if (selected !== null && selected !== void 0) chartView.select(selected, { focus: hadFocus });
  }
  function render() {
    const { total, recent, history } = model, summary = $("profile-summary"), ranks = $("profile-rank-counts"), actions = $("profile-actions"), c = total.coverage;
    summary.replaceChildren();
    ranks.replaceChildren();
    actions.replaceChildren();
    $("profile-data").hidden = false;
    $("profile-summary-title").textContent = `${formatLabel(selectedFormat)} \uB204\uC801 \uD1B5\uACC4${model.backfill?.remaining ? " \xB7 \uACFC\uAC70 \uC815\uB9AC \uC911" : ""}`;
    $("profile-summary-count").textContent = `${model.backfill?.remaining ? "\uD604\uC7AC \uD655\uC778\uB41C " : ""}\uC644\uB8CC ${number(total.games)}\uACBD\uAE30 \xB7 ${number(total.hands)}\uAD6D`;
    cell(summary, "\uC644\uB8CC \uACBD\uAE30", `${number(total.games)}\uD68C`, `${number(total.hands)}\uAD6D`);
    cell(summary, "\uD3C9\uADE0 \uC21C\uC704", total.avgRank === null ? "\u2014" : `${Number(total.avgRank).toFixed(2)}\uC704`, total.games ? "\uD0C1\uB0B4 \uCD5C\uC885 \uC21C\uC704" : "\uC644\uB8CC \uACBD\uAE30 \uC5C6\uC74C");
    cell(summary, "1\uC704\uC728", percent(total.topRate), `${number(total.rankCounts[0])}\uD68C / ${number(total.games)}\uACBD\uAE30`);
    cell(summary, "4\uC704 \uD68C\uD53C\uC728", percent(total.lastAvoidRate), total.games ? `${number(total.games - total.rankCounts[3])}\uD68C / ${number(total.games)}\uACBD\uAE30` : "\uBE44\uC728\uC744 \uACC4\uC0B0\uD560 \uACBD\uAE30 \uC5C6\uC74C");
    cell(summary, "\uB204\uC801 \uC810\uC218 \uBCC0\uD654", `${signed(total.net)}\uC810`, "\uACBD\uAE30\uBCC4 \uC810\uC218 \uC99D\uAC10\uC758 \uD569");
    cell(summary, "\uACBD\uAE30\uB2F9 \uC810\uC218 \uBCC0\uD654", total.avgNet === null ? "\u2014" : `${signed(total.avgNet)}\uC810`, `${number(total.games)}\uACBD\uAE30 \uAE30\uC900`);
    cell(summary, "\uD3C9\uADE0 \uD654\uB8CC \uC218\uB839", total.avgWinPoints === null ? "\u2014" : `${number(total.avgWinPoints)}\uC810`, `\uC790\uB8CC ${number(c.winPointsGames)}\uACBD\uAE30 ${number(c.winPointsHands)}\uAD6D \xB7 \uD654\uB8CC ${optionalCount(c.winPointsWins)}\uD68C`);
    cell(summary, "\uD3C9\uADE0 \uB860 \uC9C0\uBD88", total.avgDealInPoints === null ? "\u2014" : `${number(total.avgDealInPoints)}\uC810`, `\uC790\uB8CC ${number(c.dealInPointsGames)}\uACBD\uAE30 ${number(c.dealInPointsHands)}\uAD6D \xB7 \uBC29\uCD1D ${optionalCount(c.dealInPointsDealIns)}\uD68C`);
    for (let rank = 1; rank <= 4; rank++) {
      const row = node2(document2, "div", `${rank}\uC704`, "profile-rank-count");
      row.append(node2(document2, "strong", `${number(total.rankCounts[rank - 1])}\uD68C`));
      ranks.append(row);
    }
    $("profile-summary-note").textContent = "\uB85C\uADF8\uC778 \uC0C1\uD0DC\uB85C \uC11C\uBC84\uC5D0\uC11C \uC644\uB8CC\uD55C \uB300\uAD6D\uB9CC \uC9D1\uACC4\uD569\uB2C8\uB2E4. \uC190\uB2D8 \uB300\uAD6D\uACFC \uBE0C\uB77C\uC6B0\uC800 \uB85C\uCEEC \uC5F0\uC2B5\uC740 \uD3EC\uD568\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD615\uC2DD\uBCC4 \uC9D1\uACC4\uB294 \uC11C\uB85C \uC11E\uC774\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." + (model.backfill ? " \uACFC\uAC70 \uAE30\uB85D\uC740 \uB0A8\uC544 \uC788\uB294 \uACC4\uC815 \uC5F0\uACB0 \uC790\uB8CC\uC5D0\uC11C \uBCF5\uAD6C\uD558\uBA70, \uC790\uB8CC\uAC00 \uC5C6\uB294 \uACBD\uAE30\uB294 0\uD68C\uB85C \uCC44\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "");
    const recentSummary = $("profile-recent-summary");
    recentSummary.replaceChildren();
    for (const [label, value] of [["\uC644\uB8CC \uACBD\uAE30", `${number(recent.games)}\uD68C`], ["\uD3C9\uADE0 \uC21C\uC704", recent.avgRank === null ? "\u2014" : `${Number(recent.avgRank).toFixed(2)}\uC704`], ["\uC810\uC218 \uBCC0\uD654", `${signed(recent.net)}\uC810`], ["1\uC704\uC728", percent(recent.topRate)]]) cell(recentSummary, label, value);
    $("profile-chart-caption").textContent = `${formatLabel(selectedFormat)} \uCD5C\uADFC \uCD5C\uB300 ${selectedLimit}\uACBD\uAE30 \uC911 \uC644\uB8CC\uB41C ${history.length}\uACBD\uAE30 \xB7 \uC624\uB798\uB41C \uC21C\uC11C\uBD80\uD130 \uD45C\uC2DC\uD569\uB2C8\uB2E4.`;
    drawChart();
    const raw = total.stats;
    $("profile-actions-count").textContent = `\uD589\uB3D9 \uAE30\uB85D ${number(c.actionGames)}\uACBD\uAE30 \xB7 ${number(c.actionHands)}\uAD6D`;
    for (const [label, value, detail] of [
      ["\uD654\uB8CC\uC728", percent(total.winRate), `${raw ? number(raw.win) : "\u2014"}\uD68C / ${number(c.actionHands)}\uAD6D`],
      ["\uBC29\uCD1D\uB960", percent(total.dealInRate), `${raw ? number(raw.dealIn) : "\u2014"}\uD68C / ${number(c.actionHands)}\uAD6D`],
      ["\uB9AC\uCE58\uC728", percent(total.riichiRate), `${raw ? number(raw.riichi) : "\u2014"}\uD68C / ${number(c.actionHands)}\uAD6D`],
      ["\uD6C4\uB85C\uC728", percent(total.callRate), `${optionalCount(total.openHands)}\uAD6D \uD6C4\uB85C / \uC790\uB8CC ${number(c.openHandsHands)}\uAD6D`],
      ["100\uAD6D\uB2F9 \uAE61", total.kanRate === null ? "\u2014" : `${number(total.kanRate * 100)}\uD68C`, `${raw ? number(raw.kan) : "\u2014"}\uD68C / \uC790\uB8CC ${number(c.actionHands)}\uAD6D`],
      ["\uBC84\uB9BC \uD69F\uC218", raw ? `${number(raw.discard)}\uD68C` : "\u2014", c.actionHands && raw ? `100\uAD6D\uB2F9 ${number(raw.discard / c.actionHands * 100)}\uD68C` : "\uD589\uB3D9 \uAE30\uB85D \uC5C6\uC74C"]
    ]) cell(actions, label, value, detail, "profile-action");
    $("profile-actions-note").textContent = `\uD6C4\uB85C\uC728\uC740 \uD55C \uBC88 \uC774\uC0C1 \uD6C4\uB85C\uD55C \uAD6D\uC758 \uBE44\uC728\uC785\uB2C8\uB2E4. \uD6C4\uB85C \uD69F\uC218\uB294 ${raw ? `${number(raw.call)}\uD68C` : "\uC790\uB8CC \uC5C6\uC74C"}${raw && c.actionHands ? ` \xB7 100\uAD6D\uB2F9 ${number(raw.call / c.actionHands * 100)}\uD68C` : ""}\uB85C \uBCC4\uB3C4 \uC9D1\uACC4\uD569\uB2C8\uB2E4. \uC790\uB8CC\uAC00 \uC5C6\uB294 \uC9C0\uD45C\uB294 \u2014\uB85C \uD45C\uC2DC\uD558\uBA70 0\uD68C\xB70%\uC640 \uAD6C\uBD84\uD569\uB2C8\uB2E4.`;
    $("profile-discard-note").textContent = `\uBC84\uB9BC\uD328 \uAE30\uB85D ${number(c.discardGames)}\uACBD\uAE30 \xB7 ${number(c.discardHands)}\uAD6D\uC758 \uCBD4\uBAA8\uAE30\uB9AC\xB7\uD14C\uB2E4\uC2DC \uAE30\uB85D\uC785\uB2C8\uB2E4. \uC815\uBCF4\uAC00 \uC5C6\uB294 \uACFC\uAC70 \uB300\uAD6D\uC740 0\uD68C\uB85C \uCC44\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`;
    $("profile-discard-details").open = false;
    $("profile-discards").replaceChildren();
  }
  async function refresh() {
    const id = ++requestId;
    controller?.abort();
    controller = null;
    accountState();
    syncControls();
    clearData();
    const activeSession = client.getSession();
    if (!activeSession) {
      $("profile-status").textContent = "\uACC4\uC815\uC5D0 \uB85C\uADF8\uC778\uD558\uBA74 \uBCF8\uC778\uC758 \uB204\uC801 \uD1B5\uACC4\uC640 \uCD5C\uADFC \uC21C\uC704 \uBCC0\uD654\uB97C \uBCFC \uC218 \uC788\uC5B4\uC694.";
      $("profile-refresh").disabled = false;
      return;
    }
    const activeController = new AbortController();
    controller = activeController;
    const timer = window.setTimeout(() => activeController.abort(), 2e4);
    $("profile-refresh").disabled = true;
    $("profile-status").textContent = `${formatLabel(selectedFormat)} \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uACE0 \uC788\uC2B5\uB2C8\uB2E4\u2026`;
    try {
      const response = await fetchImpl(`${server}/api/duplicate/accounts/stats?format=${selectedFormat}&limit=${selectedLimit}`, { method: "GET", headers: { Accept: "application/json", "X-Duplicate-Account-Token": activeSession.token }, cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal: activeController.signal });
      let data;
      try {
        data = await response.json();
      } catch {
        throw Error("\uACC4\uC815 \uD1B5\uACC4 \uC751\uB2F5\uC744 \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
      }
      if (destroyed || id !== requestId || client.getSession()?.token !== activeSession.token) return;
      if (!response.ok) throw Object.assign(Error(response.status === 401 ? "\uB85C\uADF8\uC778\uC774 \uB9CC\uB8CC\uB410\uAC70\uB098 \uD574\uC81C\uB410\uC2B5\uB2C8\uB2E4. \uACC4\uC815 \uC601\uC5ED\uC5D0\uC11C \uB85C\uADF8\uC544\uC6C3 \uD6C4 \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694." : data?.error || "\uB0B4 \uB300\uAD6D \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."), { status: response.status });
      model = normalizeProfileResponse(data, { format: selectedFormat, limit: selectedLimit });
      render();
      $("profile-status").textContent = model.backfill?.remaining ? "\uACFC\uAC70 \uAE30\uB85D\uC744 \uC815\uB9AC\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68\uD558\uBA74 \uC774\uC5B4\uC11C \uD655\uC778\uD569\uB2C8\uB2E4." : model.total.games ? "\uB0B4 \uACC4\uC815\uC758 \uC644\uB8CC \uB300\uAD6D\uB9CC \uD45C\uC2DC\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4." : "\uC544\uC9C1 \uC774 \uD615\uC2DD\uC73C\uB85C \uC9D1\uACC4\uB41C \uC644\uB8CC \uB300\uAD6D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
    } catch (error) {
      if (destroyed || id !== requestId) return;
      $("profile-status").textContent = error?.name === "AbortError" ? "\uD1B5\uACC4 \uD655\uC778 \uC2DC\uAC04\uC774 \uCD08\uACFC\uB410\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68\uD574 \uC8FC\uC138\uC694." : error?.message || "\uB0B4 \uB300\uAD6D \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.";
      if (error?.status === 401) $("profile-account-details").open = true;
    } finally {
      window.clearTimeout(timer);
      if (!destroyed && id === requestId) $("profile-refresh").disabled = false;
    }
  }
  const onFormat = (event) => {
    selectedFormat = profileFormat(event.currentTarget.dataset.profileFormat);
    syncURL();
    refresh();
  }, onLimit = (event) => {
    selectedLimit = profileLimit(event.currentTarget.dataset.profileLimit);
    syncURL();
    refresh();
  };
  for (const button of formatButtons) button.addEventListener("click", onFormat);
  for (const button of limitButtons) button.addEventListener("click", onLimit);
  $("profile-refresh").addEventListener("click", refresh);
  const onDiscards = () => {
    if ($("profile-discard-details").open && model) renderDiscardStatistics($("profile-discards"), { own: model.total.discardStats, document: document2, tileRenderer: discardTileRenderer });
  };
  $("profile-discard-details").addEventListener("toggle", onDiscards);
  const onResize = () => {
    if (!model || destroyed) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeTimer = null;
      if (model && !destroyed) drawChart({ preserve: true });
    }, 100);
  };
  window.addEventListener?.("resize", onResize);
  const panel = accountPanel($("profile-account"), { client, document: document2, privacyUrl: profileHref("./tournament/privacy.html", base, server), onSessionChange: () => {
    refresh();
  } });
  syncControls();
  refresh();
  return { refresh, destroy() {
    destroyed = true;
    controller?.abort();
    window.clearTimeout(resizeTimer);
    window.removeEventListener?.("resize", onResize);
    panel.destroy();
    for (const button of formatButtons) button.removeEventListener("click", onFormat);
    for (const button of limitButtons) button.removeEventListener("click", onLimit);
    $("profile-refresh").removeEventListener("click", refresh);
    $("profile-discard-details").removeEventListener("toggle", onDiscards);
  }, get state() {
    return { format: selectedFormat, limit: selectedLimit, server };
  } };
}
if (typeof document !== "undefined" && document.getElementById("profile-summary")) mountProfile(document);
export {
  mountProfile,
  normalizeProfileResponse,
  profileFormat,
  profileHref,
  profileLimit,
  profileServer,
  rankChartGeometry,
  renderRankChart
};
