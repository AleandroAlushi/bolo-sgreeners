"use client";

import { useEffect } from "react";

/**
 * Il ciaff della retina e la schiacciata all'apertura dell'app installata (come lo splash: solo in
 * display-mode standalone), una volta per sessione. Se il browser blocca l'audio senza un tocco
 * (iPhone, quasi sempre) parte al primo tocco durante l'apertura, altrimenti si rinuncia.
 */
const KEY = "sg-apertura";
const WINDOW_MS = 2500;

export function OpeningSound() {
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      // senza sessionStorage suona e basta
    }
    const audio = new Audio("/audio/apertura.m4a");
    audio.volume = 0.7;
    const opened = performance.now();
    let done = false;
    const onTouch = () => {
      cleanup();
      audio.play().catch(() => {});
    };
    const cleanup = () => {
      done = true;
      window.removeEventListener("pointerdown", onTouch);
    };
    audio.play().catch(() => {
      if (!done && performance.now() - opened < WINDOW_MS) window.addEventListener("pointerdown", onTouch, { once: true });
    });
    const timer = window.setTimeout(cleanup, WINDOW_MS);
    return () => {
      cleanup();
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}
