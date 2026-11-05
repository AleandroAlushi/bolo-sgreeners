"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { vapidKeyBytes } from "@/lib/push";
import { browserClient } from "@/lib/supabase/browser";
import { cx } from "./ui";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "busy";

const noop = () => () => {};

/** Cosa permette questo browser: le push su iPhone arrivano solo all'app aggiunta alla Home. */
function environment() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return { standalone, ios, supported };
}

/** Attiva o disattiva le notifiche delle partite su questo dispositivo. */
export function NotifyToggle({ className }: { className?: string }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!mounted) return;
    const env = environment();
    let cancelled = false;
    (async () => {
      let next: State;
      if (env.ios && !env.standalone) next = "ios-install";
      else if (!env.supported) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        next = sub ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const enable = async () => {
    setState("busy");
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes() }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = await browserClient().rpc("push_subscribe", { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent });
      if (error) throw new Error(error.message);
      setState("on");
      setMessage("Fatto! Ti avvisiamo il giorno della partita, un'ora prima e con il risultato.");
    } catch (e) {
      setState("off");
      setMessage(`Non è stato possibile attivarle: ${(e as Error).message}`);
    }
  };

  const disable = async () => {
    setState("busy");
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await browserClient().rpc("push_unsubscribe", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setState("off");
    setMessage("Notifiche disattivate su questo dispositivo.");
  };

  if (!mounted || state === "loading" || state === "unsupported") return null;
  return (
    <div className={cx("card flex flex-wrap items-center gap-3 p-4", className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-xl" aria-hidden>
        🔔
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Notifiche delle partite</p>
        <p className="text-xs text-muted">
          {state === "ios-install"
            ? "Su iPhone arrivano solo all'app: tocca Condividi → «Aggiungi alla schermata Home», apri il sito da lì e attivale."
            : state === "denied"
              ? "Le hai bloccate per questo sito: riattivale dalle impostazioni del browser (Notifiche)."
              : (message ?? "Il giorno della partita, un'ora prima e il risultato finale.")}
        </p>
      </div>
      {state === "off" && (
        <button type="button" onClick={enable} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-ink">
          Attiva
        </button>
      )}
      {state === "busy" && <span className="text-sm text-muted">…</span>}
      {state === "on" && (
        <button type="button" onClick={disable} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted">
          Disattiva
        </button>
      )}
    </div>
  );
}
