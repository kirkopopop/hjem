// Shared by the server layout and the client preferences store.
export const PREFS_KEY = "hjem-prefs";

// Browser chrome colour per theme; keep in step with --ground in globals.css.
export const THEME_COLORS = { light: "#F6F4EF", dark: "#0E1413" } as const;

/** Runs before first paint (inlined in <head>) so the page never flashes the wrong theme. */
export const NO_FLASH_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("${PREFS_KEY}")||"{}");var t=p.theme||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";if(p.reduceMotion)r.dataset.motion="reduced";}catch(e){}`;
