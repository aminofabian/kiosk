export const SUPPORT_CHAT_EVENT = "kiosk:open-support-chat";

export function openSupportChat() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SUPPORT_CHAT_EVENT));
}
