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

      const master = ctx.createGain();
      master.gain.value = 1.6;
      master.connect(ctx.destination);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.14);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(1, now + 0.006);
      gain.gain.setValueAtTime(1, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(gain);
      gain.connect(master);

      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.type = "sine";
      thump.frequency.setValueAtTime(140, now);
      thump.frequency.exponentialRampToValueAtTime(70, now + 0.12);
      thumpGain.gain.setValueAtTime(0.0001, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.85, now + 0.004);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      thump.connect(thumpGain);
      thumpGain.connect(master);

      osc.start(now);
      osc.stop(now + 0.3);
      thump.start(now);
      thump.stop(now + 0.18);
    } catch {
      /* audio unavailable or blocked */
    }
  })();
}
