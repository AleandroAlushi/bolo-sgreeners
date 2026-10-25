"use client";

import { THEME_COLORS, THEME_KEY } from "@/lib/theme";
import { IconMoon, IconSun } from "./icons";

/** Pulsante sole/luna: alterna tema chiaro e scuro e ricorda la scelta. */
export function ThemeToggle() {
  return (
    <button
      type="button"
      title="Tema chiaro / scuro"
      aria-label="Cambia tema chiaro o scuro"
      onClick={() => {
        const light = document.documentElement.dataset.theme !== "light";
        if (light) document.documentElement.dataset.theme = "light";
        else delete document.documentElement.dataset.theme;
        try {
          localStorage.setItem(THEME_KEY, light ? "light" : "dark");
        } catch {
          // navigazione privata: il tema vale solo per questa visita
        }
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? THEME_COLORS.light : THEME_COLORS.dark);
      }}
      className="inline-flex items-center rounded-full px-3 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      <IconMoon size={16} className="theme-when-dark" />
      <IconSun size={16} className="theme-when-light" />
    </button>
  );
}
