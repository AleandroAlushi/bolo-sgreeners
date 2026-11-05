"use client";

import { useEffect } from "react";

/** Si spegne con localStorage "sg-suono" = "off". */
const MUTE_KEY = "sg-suono";
const PLAYED_KEY = "sg-swish";

/**
 * "Swish" della retina, sintetizzato (nessun file audio, nessun diritto): rumore bianco con un
 * filtro che scende veloce di tono, attacco brevissimo e una coda che sfrigola come la rete.
 */
function playSwish(ctx: AudioContext) {
  const t = ctx.currentTime + 0.02;
  const dur = 0.55;
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.ceil(rate * dur), rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // fruscio con un tremolio veloce: le maglie della retina
    const flutter = 0.65 + 0.35 * Math.sin((i / rate) * 2 * Math.PI * 38);
    data[i] = (Math.random() * 2 - 1) * flutter;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(5200, t);
  band.frequency.exponentialRampToValueAtTime(900, t + dur * 0.8);

  const high = ctx.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 350;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.9, t + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.16);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  noise.connect(band).connect(high).connect(gain).connect(ctx.destination);
  noise.start(t);
  noise.stop(t + dur);
  noise.onended = () => void ctx.close();
}

/**
 * All'apertura dell'app installata (schermata Home): lo swish insieme al logo. I telefoni non fanno
 * partire suoni senza un tocco, quindi se il browser lo blocca suona al primo tocco. Una volta per
 * apertura; mai nel sito aperto dal browser.
 */
export function Swish() {
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    try {
      if (localStorage.getItem(MUTE_KEY) === "off" || sessionStorage.getItem(PLAYED_KEY)) return;
    } catch {
      /* archiviazione non disponibile: si suona comunque una volta */
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    let done = false;
    const play = (ctx: AudioContext) => {
      if (done) return;
      done = true;
      try {
        sessionStorage.setItem(PLAYED_KEY, "1");
      } catch {
        /* ok */
      }
      playSwish(ctx);
      remove();
    };
    const ctx = new AC();
    const onGesture = () => {
      void ctx.resume().then(() => play(ctx));
    };
    const remove = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    if (ctx.state === "running") play(ctx);
    else {
      window.addEventListener("pointerdown", onGesture, { once: true });
      window.addEventListener("keydown", onGesture, { once: true });
    }
    return () => {
      remove();
      if (!done) void ctx.close();
    };
  }, []);
  return null;
}
