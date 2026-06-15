let audioCtx: AudioContext | null = null;
let unlockBound = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioCtx =
    window.AudioContext ||
    (
      window as unknown as {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioCtx) return null;

  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioCtx();
  }

  return audioCtx;
}

function bindAudioUnlock() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx?.state === "suspended") {
      void ctx.resume();
    }
  };

  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
}

/** Short pop notification for incoming department orders. */
export function playDepartmentOrderPop(): void {
  bindAudioUnlock();

  const ctx = getAudioContext();
  if (!ctx) return;

  void (async () => {
    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      if (ctx.state !== "running") return;

      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.12);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      /* audio unavailable or blocked */
    }
  })();
}
