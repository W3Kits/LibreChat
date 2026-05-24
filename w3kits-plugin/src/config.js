export const W3KITS_PLUGIN_ID = "librechat";
export const DESKTOP_ROOT = "/.w3kits/desktop/files/LibreChat";
export const EXPORT_DIR = `${DESKTOP_ROOT}/exports`;
export const STATE_PATH = "state/librechat.json";

export const MODEL_FALLBACKS = [
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { id: "gpt-5.5", label: "GPT-5.5" },
  { id: "gpt-5.4", label: "GPT-5.4" }
];

export const COPY = {
  en: {
    title: "LibreChat",
    subtitle: "Single-user W3Kits chat surface",
    statusReady: "Ready.",
    statusSending: "Waiting for model response...",
    statusSync: "Conversation state synced.",
    statusExported: "Export saved to",
    newChat: "New chat",
    openLogin: "Open login",
    exportMd: "Export",
    syncNow: "Sync",
    emptyTitle: "No messages yet",
    emptyBody: "Start a conversation with the shared W3Kits model runtime.",
    composerPlaceholder: "Message LibreChat...",
    send: "Send",
    sending: "Sending...",
    chats: "Chats",
    model: "Model",
    exportFolder: "Exports write into /home/agent/LibreChat/exports.",
    loginRequired: "Login required.",
    missingPrompt: "Message is required.",
    errorPrefix: "Request failed:"
  },
  "zh-CN": {
    title: "LibreChat",
    subtitle: "W3Kits 单用户聊天界面",
    statusReady: "已就绪。",
    statusSending: "正在等待模型返回...",
    statusSync: "会话状态已同步。",
    statusExported: "导出已保存到",
    newChat: "新建会话",
    openLogin: "打开登录",
    exportMd: "导出",
    syncNow: "同步",
    emptyTitle: "还没有消息",
    emptyBody: "现在可以通过共享的 W3Kits 模型运行时开始对话。",
    composerPlaceholder: "给 LibreChat 发消息...",
    send: "发送",
    sending: "发送中...",
    chats: "会话",
    model: "模型",
    exportFolder: "导出会写入 /home/agent/LibreChat/exports。",
    loginRequired: "需要登录。",
    missingPrompt: "请输入消息。",
    errorPrefix: "请求失败："
  }
};

export function localize(locale, key) {
  return COPY[locale]?.[key] || COPY.en[key] || key;
}

export const SYSTEM_PROMPT = [
  "You are LibreChat running inside W3Kits.",
  "Be concise, direct, and helpful.",
  "If the user asks about unavailable server-side LibreChat features, say this embedded plugin is a reduced single-user chat surface."
].join(" ");
