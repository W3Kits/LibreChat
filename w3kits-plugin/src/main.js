import {
  COPY,
  DESKTOP_ROOT,
  EXPORT_DIR,
  MODEL_FALLBACKS,
  STATE_PATH,
  SYSTEM_PROMPT,
  localize
} from "./config.js";
import {
  bootstrapLocale,
  createChatCompletion,
  desktopMkdir,
  desktopWriteText,
  fetchAvailableModels,
  readPluginJson,
  requestLogin,
  setWindowTitle,
  syncPluginStorage,
  visibleDesktopPath,
  writePluginJson
} from "./runtime.js";

const locale = bootstrapLocale();
setWindowTitle("LibreChat");

const state = {
  locale,
  conversations: [],
  activeConversationId: "",
  draft: "",
  busy: false,
  status: localize(locale, "statusReady"),
  modelId: MODEL_FALLBACKS[0].id,
  models: MODEL_FALLBACKS.slice()
};

const app = document.querySelector("#app");

render();
void bootstrap();

async function bootstrap() {
  try {
    await Promise.all([desktopMkdir(DESKTOP_ROOT), desktopMkdir(EXPORT_DIR)]);
  } catch (error) {
    state.status = error instanceof Error ? error.message : String(error);
  }

  const stored = await readPluginJson(STATE_PATH, null);
  if (stored && typeof stored === "object") {
    state.conversations = Array.isArray(stored.conversations) ? stored.conversations.filter(isConversation).slice(0, 40) : [];
    state.activeConversationId = typeof stored.activeConversationId === "string" ? stored.activeConversationId : "";
    state.draft = typeof stored.draft === "string" ? stored.draft : "";
    state.modelId = typeof stored.modelId === "string" ? stored.modelId : state.modelId;
  }

  if (!state.conversations.length) {
    const conversation = createConversation();
    state.conversations = [conversation];
    state.activeConversationId = conversation.id;
    await persistState();
  } else if (!activeConversation()) {
    state.activeConversationId = state.conversations[0].id;
  }

  render();
  const models = await fetchAvailableModels(MODEL_FALLBACKS);
  if (Array.isArray(models) && models.length) {
    state.models = models;
    if (!state.models.some((item) => item.id === state.modelId)) {
      state.modelId = state.models[0].id;
    }
    render();
    await persistState();
  }
}

function createConversation() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

function activeConversation() {
  return state.conversations.find((item) => item.id === state.activeConversationId) || null;
}

function isConversation(value) {
  return value && typeof value === "object" && typeof value.id === "string" && Array.isArray(value.messages);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function summarizeTitle(text) {
  const singleLine = String(text || "").replace(/\s+/g, " ").trim();
  return singleLine.length > 42 ? `${singleLine.slice(0, 39)}...` : singleLine || "New chat";
}

function render() {
  const conversation = activeConversation();
  const copy = COPY[locale] || COPY.en;
  const messages = conversation?.messages || [];

  app.innerHTML = `
    <main class="shell">
      <aside class="sidebar">
        <div class="brand">
          <img src="./assets/logo.svg" alt="LibreChat" />
          <div>
            <strong>${escapeHtml(copy.title)}</strong>
            <span>${escapeHtml(copy.subtitle)}</span>
          </div>
        </div>
        <div class="sidebar-actions">
          <button id="new-chat">${escapeHtml(copy.newChat)}</button>
          <button id="open-login">${escapeHtml(copy.openLogin)}</button>
        </div>
        <div class="sidebar-meta">
          <span>${escapeHtml(copy.chats)}</span>
          <span>${state.conversations.length}</span>
        </div>
        <div class="conversation-list">
          ${state.conversations
            .map(
              (item) => `
                <button class="conversation-item${item.id === state.activeConversationId ? " active" : ""}" data-conversation-id="${escapeHtml(item.id)}">
                  <strong>${escapeHtml(item.title)}</strong>
                  <span>${escapeHtml(new Date(item.updatedAt).toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US"))}</span>
                </button>
              `
            )
            .join("")}
        </div>
      </aside>
      <section class="chat-shell">
        <header class="toolbar">
          <div class="toolbar-main">
            <h1>${escapeHtml(conversation?.title || copy.title)}</h1>
            <span>${escapeHtml(state.status)}</span>
          </div>
          <div class="toolbar-actions">
            <label class="model-select">
              <span>${escapeHtml(copy.model)}</span>
              <select id="model-select">
                ${state.models
                  .map(
                    (item) => `
                      <option value="${escapeHtml(item.id)}" ${item.id === state.modelId ? "selected" : ""}>${escapeHtml(item.label)}</option>
                    `
                  )
                  .join("")}
              </select>
            </label>
            <button id="sync-state">${escapeHtml(copy.syncNow)}</button>
            <button id="export-md">${escapeHtml(copy.exportMd)}</button>
          </div>
        </header>
        <section class="messages">
          ${
            messages.length
              ? messages
                  .map(
                    (item) => `
                      <article class="message ${escapeHtml(item.role)}">
                        <div class="message-role">${escapeHtml(item.role === "user" ? "You" : "LibreChat")}</div>
                        <div class="message-body">${renderMessage(item.content)}</div>
                      </article>
                    `
                  )
                  .join("")
              : `
                <div class="empty-state">
                  <strong>${escapeHtml(copy.emptyTitle)}</strong>
                  <span>${escapeHtml(copy.emptyBody)}</span>
                </div>
              `
          }
        </section>
        <footer class="composer-shell">
          <div class="composer-meta">${escapeHtml(copy.exportFolder)}</div>
          <textarea id="composer" rows="4" placeholder="${escapeHtml(copy.composerPlaceholder)}">${escapeHtml(state.draft)}</textarea>
          <div class="composer-actions">
            <span class="composer-tip">Ctrl/Cmd + Enter</span>
            <button id="send-message" class="primary" ${state.busy ? "disabled" : ""}>
              ${escapeHtml(state.busy ? copy.sending : copy.send)}
            </button>
          </div>
        </footer>
      </section>
    </main>
  `;

  app.querySelector("#composer")?.addEventListener("input", async (event) => {
    state.draft = event.target.value;
    await persistState();
  });

  app.querySelector("#composer")?.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSend();
    }
  });

  app.querySelector("#send-message")?.addEventListener("click", () => {
    void handleSend();
  });

  app.querySelector("#new-chat")?.addEventListener("click", async () => {
    const conversation = createConversation();
    state.conversations = [conversation, ...state.conversations].slice(0, 40);
    state.activeConversationId = conversation.id;
    state.draft = "";
    state.status = localize(locale, "statusReady");
    await persistState();
    render();
  });

  app.querySelector("#open-login")?.addEventListener("click", () => {
    requestLogin("plugin_runtime");
  });

  app.querySelector("#model-select")?.addEventListener("change", async (event) => {
    state.modelId = event.target.value;
    await persistState();
  });

  app.querySelector("#sync-state")?.addEventListener("click", async () => {
    await syncPluginStorage();
    state.status = localize(locale, "statusSync");
    render();
  });

  app.querySelector("#export-md")?.addEventListener("click", () => {
    void exportConversation();
  });

  app.querySelectorAll("[data-conversation-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      state.activeConversationId = element.getAttribute("data-conversation-id") || "";
      await persistState();
      render();
    });
  });
}

function renderMessage(content) {
  return escapeHtml(content).replaceAll("\n", "<br />");
}

async function handleSend() {
  const prompt = state.draft.trim();
  if (!prompt) {
    state.status = localize(locale, "missingPrompt");
    render();
    return;
  }

  const conversation = activeConversation();
  if (!conversation) return;

  const userMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: prompt,
    createdAt: new Date().toISOString()
  };

  conversation.messages.push(userMessage);
  conversation.updatedAt = userMessage.createdAt;
  conversation.title = conversation.messages.length === 1 ? summarizeTitle(prompt) : conversation.title;
  state.draft = "";
  state.busy = true;
  state.status = localize(locale, "statusSending");
  await persistState();
  render();

  try {
    const assistantText = await createChatCompletion({
      model: state.modelId,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversation.messages.map((item) => ({ role: item.role, content: item.content }))
      ]
    });
    conversation.messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: assistantText,
      createdAt: new Date().toISOString()
    });
    conversation.updatedAt = new Date().toISOString();
    state.status = localize(locale, "statusReady");
  } catch (error) {
    state.status = `${localize(locale, "errorPrefix")} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    state.busy = false;
    sortConversations();
    await persistState();
    render();
  }
}

function sortConversations() {
  state.conversations.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

async function exportConversation() {
  const conversation = activeConversation();
  if (!conversation) return;
  const fileName = `${Date.now()}-${slugify(conversation.title || "librechat")}.md`;
  const path = `${EXPORT_DIR}/${fileName}`;
  const lines = [
    `# ${conversation.title || "LibreChat"}`,
    "",
    ...conversation.messages.flatMap((item) => [`## ${item.role === "user" ? "You" : "LibreChat"}`, "", item.content, ""])
  ];
  await desktopWriteText(path, lines.join("\n"), "text/markdown; charset=utf-8");
  state.status = `${localize(locale, "statusExported")} ${visibleDesktopPath(path)}`;
  render();
}

async function persistState() {
  await writePluginJson(STATE_PATH, {
    conversations: state.conversations,
    activeConversationId: state.activeConversationId,
    draft: state.draft,
    modelId: state.modelId
  });
}

function slugify(value) {
  return String(value || "conversation")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "conversation";
}
