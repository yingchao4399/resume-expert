export const STUDIO_ENABLED_KEY = "resume-expert-studio-enabled";
export const STUDIO_SETTING_EVENT = "resume-expert-studio-setting";

export function isStudioEnabled(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(STUDIO_ENABLED_KEY) === "true";
}

export function setStudioEnabled(enabled: boolean): void {
  window.localStorage.setItem(STUDIO_ENABLED_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(STUDIO_SETTING_EVENT, { detail: enabled }));
}
