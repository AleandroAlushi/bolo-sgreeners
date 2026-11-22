/**
 * Video in loop della figurina preparato nel browser (telefono o computer), come
 * scripts/video-loop/carica.ts ma senza ffmpeg: ritaglio 4:5 a 720×900, senza audio, al massimo
 * MAX_SECONDS, registrato con MediaRecorder in MP4 (H.264) e con la copertina JPG del primo
 * fotogramma. Safari (iPhone) e Chrome recenti registrano in MP4; se il browser non sa farlo,
 * si spiega cosa usare.
 */
export const LOOP_W = 720;
export const LOOP_H = 900;
const MAX_SECONDS = 6;

const MP4_TYPES = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4"];

export function canRecordMp4(): boolean {
  return typeof MediaRecorder !== "undefined" && MP4_TYPES.some((t) => MediaRecorder.isTypeSupported(t));
}

function once(el: HTMLMediaElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    el.addEventListener(event, () => resolve(), { once: true });
    el.addEventListener("error", () => reject(new Error("Video non leggibile")), { once: true });
  });
}

/**
 * @param top dove tagliare in verticale per il 4:5: 0 in alto, 1 in basso (0,6 di solito va bene)
 */
export async function prepareLoopVideo(file: File, top = 0.6): Promise<{ video: Blob; poster: Blob; seconds: number }> {
  const mimeType = MP4_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) throw new Error("Questo browser non sa registrare video MP4: usa Safari sull'iPhone o un Chrome aggiornato.");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  // fuori dallo schermo ma nel documento: alcuni browser non riproducono i video staccati
  video.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0";
  document.body.appendChild(video);
  try {
    await once(video, "loadeddata");
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = Math.min(vw, (vh * 4) / 5);
    const ch = Math.min(vh, (vw * 5) / 4);
    const sx = (vw - cw) / 2;
    const sy = (vh - ch) * Math.min(1, Math.max(0, top));
    const canvas = document.createElement("canvas");
    canvas.width = LOOP_W;
    canvas.height = LOOP_H;
    const ctx = canvas.getContext("2d")!;
    const draw = () => ctx.drawImage(video, sx, sy, cw, ch, 0, 0, LOOP_W, LOOP_H);

    // copertina: il primo fotogramma
    video.currentTime = 0;
    await once(video, "seeked");
    draw();
    const poster = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Copertina non creata"))), "image/jpeg", 0.85));

    // registrazione in tempo reale mentre il video scorre (senza audio)
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    const seconds = Math.min(video.duration || MAX_SECONDS, MAX_SECONDS);
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      if (video.currentTime >= seconds || video.ended) {
        running = false;
        recorder.stop();
        video.pause();
        return;
      }
      requestAnimationFrame(loop);
    };
    recorder.start(250);
    await video.play();
    requestAnimationFrame(loop);
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    return { video: new Blob(chunks, { type: "video/mp4" }), poster, seconds };
  } finally {
    video.remove();
    URL.revokeObjectURL(url);
  }
}
