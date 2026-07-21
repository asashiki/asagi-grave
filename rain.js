/**
 * 全屏下雨 — 贴近 原始图.jpg 的竖向雨丝
 * 细长半透明白线 + 轻微风偏 + 底部淡溅
 */
(function () {
  const canvas = document.getElementById("rain");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;
  let drops = [];
  let raf = 0;
  let dpr = 1;

  // 原作感：偏密、偏直、略有风
  const CONFIG = {
    density: 0.00055, // 每像素雨滴密度
    minLen: 18,
    maxLen: 42,
    minSpeed: 14,
    maxSpeed: 28,
    wind: 1.2,
    lineWidth: 1.1,
    alphaMin: 0.18,
    alphaMax: 0.55,
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.floor(w * h * CONFIG.density);
    drops = [];
    for (let i = 0; i < count; i++) {
      drops.push(spawn(true));
    }
  }

  function spawn(randomY) {
    const len = CONFIG.minLen + Math.random() * (CONFIG.maxLen - CONFIG.minLen);
    const speed = CONFIG.minSpeed + Math.random() * (CONFIG.maxSpeed - CONFIG.minSpeed);
    return {
      x: Math.random() * (w + 40) - 20,
      y: randomY ? Math.random() * h : -len - Math.random() * 80,
      len,
      speed,
      // 竖向为主，轻微倾斜（原图雨丝几乎垂直）
      tilt: CONFIG.wind * (0.6 + Math.random() * 0.8),
      alpha: CONFIG.alphaMin + Math.random() * (CONFIG.alphaMax - CONFIG.alphaMin),
    };
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // 轻微整体雨幕（原图那种灰蒙）
    ctx.fillStyle = "rgba(180, 190, 200, 0.02)";
    ctx.fillRect(0, 0, w, h);

    ctx.lineCap = "round";
    ctx.lineWidth = CONFIG.lineWidth;

    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y += d.speed;
      d.x += d.tilt * 0.15;

      if (d.y - d.len > h || d.x > w + 30 || d.x < -30) {
        drops[i] = spawn(false);
        continue;
      }

      // 雨丝：上淡下稍亮
      const x1 = d.x;
      const y1 = d.y - d.len;
      const x2 = d.x + d.tilt * 0.08;
      const y2 = d.y;

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, "rgba(210, 220, 230, 0)");
      grad.addColorStop(0.4, "rgba(220, 228, 235, " + d.alpha * 0.55 + ")");
      grad.addColorStop(1, "rgba(235, 240, 245, " + d.alpha + ")");

      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    raf = requestAnimationFrame(draw);
  }

  // 降低动画偏好时：静态细雨线
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  function start() {
    cancelAnimationFrame(raf);
    resize();
    if (prefersReduced.matches) {
      // 静态竖线，模拟原图雨幕
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 6) {
        const a = 0.08 + Math.random() * 0.12;
        ctx.strokeStyle = "rgba(210, 220, 230, " + a + ")";
        ctx.beginPath();
        ctx.moveTo(x + Math.random() * 2, 0);
        ctx.lineTo(x + Math.random() * 2, h);
        ctx.stroke();
      }
      return;
    }
    draw();
  }

  window.addEventListener("resize", () => {
    resize();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
