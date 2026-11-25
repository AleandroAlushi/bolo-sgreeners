"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { cx } from "../ui";

/**
 * Chat della diretta: chi guarda scrive con un nome scelto da lui, senza account.
 * Filtri, limiti e blocchi stanno nel database (live_chat_send). Admin e "Statistiche"
 * vedono i pulsanti per nascondere un messaggio, bloccare chi l'ha scritto o chiudere la chat.
 */

interface ChatMessage {
  id: string;
  name: string;
  body: string;
  hidden: boolean;
  created_at: string;
}

const POLL_MS = 4000;
const NAME_KEY = "sgreeners-chat-name";
const DEVICE_KEY = "sgreeners-chat-device";

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // finestra privata: il nome resta solo finché la pagina è aperta
  }
}
/** uuid v4 casuale. crypto.randomUUID esiste solo sui siti https: qui serve anche altrove. */
function newId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function deviceId() {
  let id = readStorage(DEVICE_KEY);
  if (!id) {
    id = newId();
    writeStorage(DEVICE_KEY, id);
  }
  return id;
}
const time = (iso: string) => new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

export function LiveChat({ gameId, live, open }: { gameId: string; live: boolean; open: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // la chat compare solo nel browser (dopo il primo caricamento della diretta): si può leggere subito il nome salvato
  const [name, setName] = useState<string | null>(() => (typeof window === "undefined" ? null : readStorage(NAME_KEY)));
  const [nameDraft, setNameDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  // aperta/chiusa: dal database; dopo il pulsante di chi modera, subito il nuovo stato
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const chatOpen = openOverride ?? open;
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // si resta in fondo finché chi legge non scorre in su

  useEffect(() => {
    void browserClient()
      .rpc("is_staff")
      .then(({ data }) => setIsStaff(Boolean(data)));
  }, []);

  const load = useCallback(async () => {
    const { data } = await browserClient()
      .from("live_chat_messages")
      .select("id, name, body, hidden, created_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (data) setMessages(data.reverse());
  }, [gameId]);

  // aggiornamento ogni 4 secondi durante la diretta, solo con la pagina in primo piano
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stop = false;
    const loop = async () => {
      if (!document.hidden) await load();
      if (!stop && live) timer = setTimeout(loop, POLL_MS);
    };
    void loop();
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, live]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const saveName = () => {
    const n = nameDraft.trim().replace(/\s+/g, " ");
    if (n.length < 2 || n.length > 24) {
      setError("Il nome deve avere da 2 a 24 caratteri.");
      return;
    }
    setError(null);
    setName(n);
    setEditingName(false);
    writeStorage(NAME_KEY, n);
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !name || sending) return;
    setSending(true);
    setError(null);
    let data: string | null = null;
    let err: unknown = null;
    try {
      ({ data, error: err } = await browserClient().rpc("live_chat_send", {
        p_game: gameId,
        p_name: name,
        p_body: body,
        p_device: deviceId(),
      }));
    } catch (e) {
      err = e;
    } finally {
      setSending(false);
    }
    if (err) {
      setError("Messaggio non inviato: controlla la connessione e riprova.");
      return;
    }
    if (data) {
      // il database spiega perché non l'ha accettato (parole, limiti, nome…)
      setError(data);
      if (data === "Scegli un altro nome.") setEditingName(true);
      return;
    }
    setDraft("");
    stick.current = true;
    void load();
  };

  const moderate = async (m: ChatMessage, block: boolean) => {
    const question = block
      ? `Bloccare "${m.name}"? Spariscono tutti i suoi messaggi e da quel telefono non potrà più scrivere.`
      : "Nascondere questo messaggio?";
    if (!window.confirm(question)) return;
    const { error: err } = await browserClient().rpc("live_chat_moderate", { p_message: m.id, p_block: block });
    if (err) window.alert("Non è stato possibile: riprova.");
    void load();
  };

  const toggleOpen = async () => {
    const next = !chatOpen;
    const { error: err } = await browserClient().rpc("live_chat_set_open", { p_game: gameId, p_open: next });
    if (!err) setOpenOverride(next);
  };

  const canWrite = live && chatOpen;
  const showNameForm = canWrite && (!name || editingName);

  return (
    <section className="card overflow-hidden" aria-label="Chat della diretta">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <p className="text-sm font-semibold">
          💬 Chat {live ? "della diretta" : ""}
          {!chatOpen && <span className="ml-2 text-xs font-normal text-muted">chiusa</span>}
        </p>
        {isStaff && live && (
          <button
            type="button"
            onClick={toggleOpen}
            className={cx(
              "rounded-full border px-2.5 py-1 text-xs font-semibold",
              chatOpen ? "border-loss/50 text-loss" : "border-primary/50 text-primary",
            )}
          >
            {chatOpen ? "Chiudi la chat" : "Riapri la chat"}
          </button>
        )}
      </div>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="mt-2 h-64 space-y-2 overflow-y-auto overscroll-contain px-4 pb-2"
      >
        {messages.length === 0 ? (
          <p className="pt-8 text-center text-sm text-muted">
            {canWrite ? "Ancora nessun messaggio: scrivi tu il primo!" : "Nessun messaggio."}
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cx("group text-sm leading-snug", m.hidden && "opacity-40")}>
              <span className={cx("font-semibold", m.name === name ? "text-primary" : "text-secondary")}>{m.name}</span>{" "}
              <span className="text-xs tabular-nums text-muted">{time(m.created_at)}</span>
              <p className={cx("break-words text-text/90", m.hidden && "line-through")}>{m.body}</p>
              {isStaff && !m.hidden && (
                <div className="mt-0.5 flex gap-3 text-xs">
                  <button type="button" onClick={() => moderate(m, false)} className="text-muted hover:text-text">
                    Nascondi
                  </button>
                  <button type="button" onClick={() => moderate(m, true)} className="text-loss/80 hover:text-loss">
                    Blocca
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border p-3">
        {!live ? (
          <p className="text-center text-xs text-muted">La chat è aperta solo durante la diretta.</p>
        ) : !chatOpen ? (
          <p className="text-center text-xs text-muted">La chat è stata chiusa.</p>
        ) : showNameForm ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveName();
            }}
            className="space-y-2"
          >
            <label htmlFor="chat-name" className="block text-sm font-semibold">
              Come ti chiami?
            </label>
            <div className="flex gap-2">
              <input
                id="chat-name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={24}
                autoComplete="given-name"
                placeholder="Il tuo nome"
                className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
              />
              <button type="submit" className="shrink-0 rounded-xl bg-primary px-4 py-2 font-bold text-primary-ink">
                Entra
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={200}
              enterKeyHint="send"
              aria-label="Messaggio"
              placeholder={`Scrivi come ${name}…`}
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="shrink-0 rounded-xl bg-primary px-4 py-2 font-bold text-primary-ink disabled:opacity-50"
            >
              Invia
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-xs text-loss">{error}</p>}
        {canWrite && (
          <p className="mt-2 text-[11px] leading-snug text-muted">
            Scrivi con rispetto: ci leggono anche genitori e ragazzi. I messaggi offensivi vengono tolti e chi esagera viene
            bloccato.
            {name && !showNameForm && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(name);
                    setEditingName(true);
                  }}
                  className="underline"
                >
                  Cambia nome
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
