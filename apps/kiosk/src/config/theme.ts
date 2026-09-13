export function applyTheme(isDark: boolean): void {
  if (isDark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function isDarkModeEnabled(): boolean {
  return localStorage.getItem("arteq_dark_mode") === "true";
}

export function initTheme(): void {
  applyTheme(isDarkModeEnabled());
}

export const SHOW_TRANSCRIPTION_KEY = "arteq_show_transcription";

export function isTranscriptionVisible(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(SHOW_TRANSCRIPTION_KEY) === "true";
}

export function setTranscriptionVisible(visible: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SHOW_TRANSCRIPTION_KEY, visible ? "true" : "false");
  window.dispatchEvent(new Event("arteq_show_transcription_changed"));
}
