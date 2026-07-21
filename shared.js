/**
 * 浅仪式之墓 — 共用：存档 / 雨声 / 轻反馈
 * 原则：雨声尽量不因切页、点按钮而断；切页不要故意延迟
 */
(function (global) {
  const SAVE_KEY = "asagi-grave-save";
  const MUTE_KEY = "asagi-rain-muted";
  const UNLOCK_KEY = "asagi-audio-unlocked";
  // mp3 兼容更好；wav 兜底
  const RAIN_CANDIDATES = ["audio/rain_bg.mp3"];

  function defaultSave() {
    return {
      started: false,
      chapter: 0,
      flags: {},
      diaryUnlocked: ["d1", "d2", "d3", "d4", "d5", "d6", "d7"],
      recallUnlocked: ["e1", "e2", "e3", "e4", "e5", "e6"],
      musicUnlocked: ["rain", "stone"],
      lastVisit: null,
    };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      return Object.assign(defaultSave(), JSON.parse(raw));
    } catch {
      return defaultSave();
    }
  }

  function writeSave(data) {
    data.lastVisit = new Date().toISOString();
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return data;
  }

  function patchSave(partial) {
    return writeSave(Object.assign(loadSave(), partial));
  }

  function clearSave() {
    localStorage.removeItem(SAVE_KEY);
    return defaultSave();
  }

  let audioCtx = null;
  function getCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function clickSound() {
    /* 切页时不再播点击音，避免「卡一下」的听感；仅非导航可调 */
  }

  function playPress(el, opts) {
    const wait = (opts && opts.wait) || 0;
    return new Promise((resolve) => {
      if (el) {
        el.classList.remove("is-press", "is-flash", "is-selected");
        void el.offsetWidth;
        el.classList.add("is-press", "is-selected");
        if (wait > 0) el.classList.add("is-flash");
      }
      unlockAudio();
      if (wait <= 0) {
        if (el) {
          window.setTimeout(() => el.classList.remove("is-press", "is-flash"), 120);
        }
        resolve();
        return;
      }
      window.setTimeout(() => {
        if (el) el.classList.remove("is-press", "is-flash");
        resolve();
      }, wait);
    });
  }

  /** 导航：立刻跳，不卡 280ms */
  function bindPressNav(root) {
    const scope = root || document;
    scope.querySelectorAll("a.menu-btn, a.img-btn, a.press-nav").forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href");
        if (!href || href === "#" || a.target === "_blank") return;
        e.preventDefault();
        if (a.dataset.busy) return;
        a.dataset.busy = "1";
        unlockAudio();
        // 立刻走，动画不挡路
        a.classList.add("is-selected");
        window.location.href = href;
      });
    });
  }

  /* —— 雨声 —— */
  const rainEl = new Audio();
  rainEl.loop = true;
  rainEl.preload = "auto";
  let rainSrcIndex = 0;
  rainEl.src = RAIN_CANDIDATES[0];

  rainEl.addEventListener("error", () => {
    rainSrcIndex += 1;
    if (rainSrcIndex < RAIN_CANDIDATES.length) {
      rainEl.src = RAIN_CANDIDATES[rainSrcIndex];
      if (wasUnlocked() && !rainMuted) {
        rainEl.play().catch(() => {});
      }
    }
  });

  let rainMuted = false;
  try {
    rainMuted = localStorage.getItem(MUTE_KEY) === "1";
  } catch (_) {}

  // 若用户之前误静音导致「没声音」，首次加载不强行；但提供明确 UI

  function wasUnlocked() {
    try {
      return sessionStorage.getItem(UNLOCK_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markUnlocked() {
    try {
      sessionStorage.setItem(UNLOCK_KEY, "1");
    } catch (_) {}
  }

  const music = { nodes: null, id: null, playing: false };
  const AMBIENT_VOL = 0.32;
  const MUSIC_RAIN_VOL = 0.45;

  function isRainMuted() {
    return rainMuted;
  }

  function setRainMuted(m) {
    rainMuted = !!m;
    try {
      localStorage.setItem(MUTE_KEY, rainMuted ? "1" : "0");
    } catch (_) {}
    applyRainVolume();
    if (!rainMuted) startAmbientRain();
    updateMuteUi();
  }

  function applyRainVolume() {
    if (rainMuted) {
      rainEl.volume = 0;
      return;
    }
    if (music.playing && music.id === "rain") {
      rainEl.volume = MUSIC_RAIN_VOL;
    } else if (music.playing) {
      rainEl.volume = AMBIENT_VOL * 0.5;
    } else {
      rainEl.volume = AMBIENT_VOL;
    }
  }

  function startAmbientRain() {
    applyRainVolume();
    const p = rainEl.play();
    if (p && p.then) {
      return p
        .then(() => {
          markUnlocked();
          updateMuteUi();
          return true;
        })
        .catch((err) => {
          console.warn("[雨音] 播放被拦，点击页面任意处即可", err);
          return false;
        });
    }
    markUnlocked();
    return Promise.resolve(true);
  }

  function unlockAudio() {
    try {
      const ctx = getCtx();
      if (ctx.state === "suspended") ctx.resume();
    } catch (_) {}
    markUnlocked();
    return startAmbientRain();
  }

  function armAudioUnlock() {
    // session 已解锁：每页一进来就续
    if (wasUnlocked()) {
      startAmbientRain();
    }

    const kick = () => unlockAudio();
    document.addEventListener("pointerdown", kick, { capture: true });
    document.addEventListener("keydown", kick, { capture: true });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && wasUnlocked() && !rainMuted) startAmbientRain();
    });

    // 尝试自动播（部分浏览器允许有声手势后的跳转页）
    startAmbientRain();
  }

  function updateMuteUi() {
    const btn = document.getElementById("btn-rain-mute");
    if (!btn) return;
    const playing = !rainEl.paused && !rainMuted && rainEl.volume > 0;
    btn.setAttribute("aria-pressed", rainMuted ? "true" : "false");
    btn.textContent = rainMuted ? "雨 · 静" : playing ? "雨 · 声" : "雨 · 点此开";
    btn.title = rainMuted ? "开启雨声" : "静音雨声（不中断循环）";
  }

  function mountMuteButton() {
    if (document.getElementById("btn-rain-mute")) {
      updateMuteUi();
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btn-rain-mute";
    btn.className = "rain-mute-btn";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (rainMuted) {
        setRainMuted(false);
        unlockAudio();
      } else if (rainEl.paused) {
        unlockAudio();
      } else {
        setRainMuted(true);
      }
      updateMuteUi();
    });
    document.body.appendChild(btn);
    updateMuteUi();
    // 定时刷新状态字
    setInterval(updateMuteUi, 1000);
  }

  function stopSynth() {
    if (music.nodes) {
      try {
        music.nodes.forEach((n) => {
          try {
            n.stop?.();
            n.disconnect?.();
          } catch (_) {}
        });
      } catch (_) {}
    }
    music.nodes = null;
  }

  function stopMusic() {
    stopSynth();
    music.id = null;
    music.playing = false;
    applyRainVolume();
    if (wasUnlocked() && !rainMuted) startAmbientRain();
  }

  function playFileRain(id) {
    stopSynth();
    music.id = id;
    music.playing = true;
    applyRainVolume();
    return startAmbientRain();
  }

  function playSynth(id) {
    stopSynth();
    if (wasUnlocked()) startAmbientRain();

    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.07;
    master.connect(ctx.destination);
    const nodes = [master];

    const presets = {
      stone: { base: 78, intervals: [0, 5, 10], type: "triangle" },
      echo: { base: 98, intervals: [0, 3, 7, 12], type: "sine" },
    };
    const p = presets[id] || presets.stone;

    p.intervals.forEach((semi, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = p.type;
      o.frequency.value = p.base * Math.pow(2, semi / 12);
      g.gain.value = 0.18 / (i + 1);
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.06 + i * 0.02;
      lfoG.gain.value = 0.03;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      lfo.start(t0);
      nodes.push(o, g, lfo, lfoG);
    });

    music.nodes = nodes;
    music.id = id;
    music.playing = true;
    applyRainVolume();
    return true;
  }

  function playMusic(id) {
    unlockAudio();
    if (id === "rain" || id === "bamboo") return playFileRain("rain");
    return playSynth(id);
  }

  function getMusicState() {
    if (music.playing && music.id === "rain") {
      return {
        id: "rain",
        playing: !rainEl.paused && !rainMuted,
      };
    }
    return { id: music.id, playing: !!music.playing };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      mountMuteButton();
      armAudioUnlock();
    });
  } else {
    mountMuteButton();
    armAudioUnlock();
  }

  global.Asagi = {
    loadSave,
    writeSave,
    patchSave,
    clearSave,
    playPress,
    bindPressNav,
    clickSound,
    playMusic,
    stopMusic,
    getMusicState,
    startAmbientRain,
    unlockAudio,
    isRainMuted,
    setRainMuted,
    RAIN_SRC: RAIN_CANDIDATES[0],
  };
})(window);
