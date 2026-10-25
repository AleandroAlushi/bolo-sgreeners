/** Tema chiaro/scuro: chiave salvata nel browser e colore della barra del telefono per ciascun tema. */
export const THEME_KEY = "sg-theme";
export const THEME_COLORS = { dark: "#070907", light: "#f4f7fb" } as const;

/**
 * Applica il tema salvato prima che la pagina si disegni (niente lampo scuro → chiaro).
 * Va inserito nel <head>; di default il tema è quello scuro delle grafiche.
 */
export const themeBootScript = `try{if(localStorage.getItem("${THEME_KEY}")==="light"){document.documentElement.dataset.theme="light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.content="${THEME_COLORS.light}"}}catch(e){}`;
