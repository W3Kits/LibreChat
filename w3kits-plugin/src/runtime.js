import { W3KITS_PLUGIN_ID } from "./config.js";

const W3KITS_BRIDGE_VERSION = 1;
const W3KITS_RESPONSE = "W3KITS_RESPONSE";
const W3KITS_AUTH_REQUIRED = "W3KITS_AUTH_REQUIRED";
const W3KITS_RUNTIME_SESSION_REQUEST = "W3KITS_RUNTIME_SESSION_REQUEST";
const W3KITS_STORAGE_READ = "W3KITS_STORAGE_READ";
const W3KITS_STORAGE_WRITE = "W3KITS_STORAGE_WRITE";
const W3KITS_STORAGE_SYNC = "W3KITS_STORAGE_SYNC";
const W3KITS_DESKTOP_FS_WRITE = "W3KITS_DESKTOP_FS_WRITE";
const W3KITS_DESKTOP_FS_MKDIR = "W3KITS_DESKTOP_FS_MKDIR";
const W3KITS_WINDOW_TITLE = "W3KITS_WINDOW_TITLE";
const LOCALE_STORAGE_KEY = "librechat.w3kits.locale";

let cachedRuntimeSession = null;

function queryParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function normalizeLocale(value) {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.startsWith("zh")) return "zh-CN";
  if (normalized.startsWith("en")) return "en";
  return null;
}

function getParentOrigin() {
  const explicit = queryParam("w3kitsParentOrigin");
  if (explicit) return explicit;
  const fallback = queryParam("openaiBaseUrl") || queryParam("w3kitsOpenAiBaseUrl");
  if (fallback) {
    try {
      return new URL(fallback).origin;
    } catch {
      return "https://w3kits.com";
    }
  }
  return "https://w3kits.com";
}

function bridgeRequest(message, timeoutMs = 20000) {
  if (window.parent === window) {
    return Promise.reject(new Error("W3Kits runtime bridge is unavailable."));
  }

  const requestId = `librechat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const parentOrigin = getParentOrigin();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("W3Kits runtime bridge timed out."));
    }, timeoutMs);

    const onMessage = (event) => {
      if (event.source !== window.parent) return;
      if (event.origin !== parentOrigin) return;
      const data = event.data;
      if (!data || data.type !== W3KITS_RESPONSE || data.requestId !== requestId) return;

      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);

      if (data.ok) {
        resolve(data.data);
        return;
      }

      const code = data?.error?.code || "bridge_failed";
      const message = data?.error?.message || code || "W3Kits runtime bridge failed.";
      const error = new Error(message);
      error.code = code;
      reject(error);
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ ...message, version: W3KITS_BRIDGE_VERSION, requestId }, parentOrigin);
  });
}

function shouldPromptLoginForResponse(response, payload) {
  if (response.status === 401) return true;
  const code = payload?.error?.code || payload?.error || payload?.code;
  return code === "login_required" || code === "plugin_runtime_session_required" || code === "invalid_plugin_runtime_session";
}

async function maybePromptLogin(response) {
  if (response.ok || response.__librechatLoginPromptChecked) return response;
  response.__librechatLoginPromptChecked = true;
  let payload = null;
  try {
    payload = await response.clone().json();
  } catch {
    payload = null;
  }
  if (shouldPromptLoginForResponse(response, payload)) requestLogin("ai_request");
  return response;
}

function installAuthFetchInterceptor() {
  if (window.__librechatAuthFetchInterceptorInstalled) return;
  window.__librechatAuthFetchInterceptorInstalled = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => maybePromptLogin(await nativeFetch(input, init));
}

export function bootstrapLocale() {
  installAuthFetchInterceptor();
  const queryLocale = normalizeLocale(queryParam("w3kitsLocale"));
  const storedLocale = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  const browserLocale = normalizeLocale(window.navigator.language) || normalizeLocale(window.navigator.languages?.[0]);
  const locale = queryLocale || storedLocale || browserLocale || "en";

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.documentElement.lang = locale;
  return locale;
}

export function setWindowTitle(title) {
  if (window.parent === window) return;
  window.parent.postMessage(
    {
      type: W3KITS_WINDOW_TITLE,
      version: W3KITS_BRIDGE_VERSION,
      pluginId: W3KITS_PLUGIN_ID,
      title
    },
    getParentOrigin()
  );
}

export function requestLogin(reason = "plugin_runtime") {
  if (window.parent === window) return;
  window.parent.postMessage(
    {
      type: W3KITS_AUTH_REQUIRED,
      version: W3KITS_BRIDGE_VERSION,
      pluginId: W3KITS_PLUGIN_ID,
      reason
    },
    getParentOrigin()
  );
}

export async function getRuntimeSession() {
  const now = Date.now();
  if (cachedRuntimeSession && cachedRuntimeSession.expiresAt - now > 30000) {
    return cachedRuntimeSession.value;
  }

  const session = await bridgeRequest({
    type: W3KITS_RUNTIME_SESSION_REQUEST,
    pluginId: W3KITS_PLUGIN_ID,
    origin: window.location.origin
  });

  cachedRuntimeSession = {
    value: session,
    expiresAt: now + Math.max(30, (session.expiresIn || 60) - 30) * 1000
  };
  return session;
}

function runtimeHeaders(session, includeJsonContentType = true) {
  const headers = {};
  if (includeJsonContentType) headers["Content-Type"] = "application/json";
  headers["x-w3kits-runtime-session"] = session.token;
  headers["x-w3kits-plugin-id"] = session.pluginId || W3KITS_PLUGIN_ID;
  headers["x-w3kits-plugin-version"] = session.pluginVersion;

  for (const [key, value] of Object.entries(session.identityHeaders || {})) {
    if (typeof value === "string" && value) headers[key] = value;
  }

  if (session.packageName) headers["x-w3kits-plugin-package"] = session.packageName;
  if (session.packageIntegrity) headers["x-w3kits-plugin-integrity"] = session.packageIntegrity;
  return headers;
}

export async function readPluginJson(path, fallback) {
  try {
    const result = await bridgeRequest({
      type: W3KITS_STORAGE_READ,
      pluginId: W3KITS_PLUGIN_ID,
      path
    });
    if (!result?.body) return fallback;
    return JSON.parse(result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (error?.code === "not_found" || message.includes("not_found")) return fallback;
    throw error;
  }
}

export async function writePluginJson(path, value) {
  return bridgeRequest({
    type: W3KITS_STORAGE_WRITE,
    pluginId: W3KITS_PLUGIN_ID,
    path,
    body: JSON.stringify(value, null, 2),
    contentType: "application/json"
  });
}

export async function syncPluginStorage() {
  return bridgeRequest({
    type: W3KITS_STORAGE_SYNC,
    pluginId: W3KITS_PLUGIN_ID
  });
}

export async function desktopMkdir(path) {
  return bridgeRequest({
    type: W3KITS_DESKTOP_FS_MKDIR,
    pluginId: W3KITS_PLUGIN_ID,
    path
  });
}

export async function desktopWriteText(path, text, contentType = "text/plain; charset=utf-8") {
  const bodyBase64 = encodeBase64(text);
  return bridgeRequest({
    type: W3KITS_DESKTOP_FS_WRITE,
    pluginId: W3KITS_PLUGIN_ID,
    path,
    bodyBase64,
    contentType
  });
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function fetchAvailableModels(fallbackModels) {
  try {
    const session = await getRuntimeSession();
    const baseUrl = String(session.openaiBaseUrl || queryParam("openaiBaseUrl") || "/api/ai/openai/v1").replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: runtimeHeaders(session, false)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return fallbackModels;
    }
    const ids = Array.isArray(payload?.data) ? payload.data.map((item) => item?.id).filter((id) => typeof id === "string") : [];
    if (!ids.length) return fallbackModels;
    return ids.map((id) => ({ id, label: id }));
  } catch {
    return fallbackModels;
  }
}

export async function createChatCompletion({ model, messages, temperature = 0.6, maxTokens = 1200 }) {
  const session = await getRuntimeSession();
  const baseUrl = String(session.openaiBaseUrl || queryParam("openaiBaseUrl") || "/api/ai/openai/v1").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: runtimeHeaders(session, true),
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `Chat completion failed (${response.status}).`);
  }
  return extractAssistantText(payload);
}

function extractAssistantText(payload) {
  const choice = payload?.choices?.[0]?.message;
  if (typeof choice?.content === "string" && choice.content.trim()) return choice.content;
  if (Array.isArray(choice?.content)) {
    const parts = choice.content
      .map((item) => {
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.content === "string") return item.content;
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("\n\n");
  }
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  throw new Error("Model response did not include assistant text.");
}

export function visibleDesktopPath(path) {
  return String(path || "").replace(/^\/\.w3kits\/desktop\/files/, "/home/agent");
}
