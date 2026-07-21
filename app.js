/**
 * 浅仪式之墓 — 单页
 */
(function () {
  if (!window.Asagi || !window.ASAGI_CONTENT) {
    console.error("[浅仪式] 依赖未加载");
    return;
  }

  const menu = document.getElementById("menu");
  const view = document.getElementById("view");
  const dialog = document.getElementById("dialog");
  const dialogMsg = document.getElementById("dialog-msg");
  const C = ASAGI_CONTENT;
  let route = "title";
  let onConfirm = null;

  let storyCtl = null;

  function go(name) {
    const next = name || "title";
    // 离开剧情时务必销毁，避免监听器残留
    if (storyCtl && storyCtl.destroy && next !== "game") {
      try {
        storyCtl.destroy();
      } catch (_) {}
      storyCtl = null;
    }
    route = next;
    Asagi.unlockAudio();
    if (route === "title") {
      view.hidden = true;
      view.innerHTML = "";
      menu.hidden = false;
      return;
    }
    menu.hidden = true;
    view.hidden = false;
    if (route === "game") renderGame();
    else if (route === "diary") renderDiary();
    else if (route === "recall") renderEcho();
    else if (route === "music") renderMusic();
  }

  function homeLink() {
    return '<button type="button" class="nav-home" data-action="home">返回</button>';
  }

  menu.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      Asagi.unlockAudio();
      go(btn.getAttribute("data-go"));
    });
  });

  document.getElementById("btn-quit").addEventListener("click", () => {
    openDialog("离开墓园？", () => {
      document.body.style.transition = "opacity .45s ease";
      document.body.style.opacity = "0";
      setTimeout(() => {
        document.body.innerHTML =
          '<div class="farewell">浅仪式之墓</div>';
        document.body.style.opacity = "1";
      }, 450);
    });
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    openDialog("清除全部进度？", () => {
      Asagi.clearSave();
      openDialog("已清除。", null);
    });
  });

  function openDialog(text, fn) {
    dialogMsg.textContent = text;
    onConfirm = fn || null;
    dialog.hidden = false;
    requestAnimationFrame(() => dialog.classList.add("is-open"));
  }
  function closeDialog() {
    dialog.classList.remove("is-open");
    setTimeout(() => {
      dialog.hidden = true;
      onConfirm = null;
    }, 160);
  }
  document.getElementById("dialog-yes").onclick = () => {
    const fn = onConfirm;
    closeDialog();
    if (fn) setTimeout(fn, 80);
  };
  document.getElementById("dialog-no").onclick = closeDialog;
  dialog.onclick = (e) => {
    if (e.target === dialog) closeDialog();
  };

  view.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const a = el.getAttribute("data-action");
    if (a === "home") go("title");
    if (a === "diary") go("diary");
    if (a === "recall") go("recall");
  });

  /* -------- 开始游戏：可靠状态机 -------- */
  function renderGame() {
    if (storyCtl && storyCtl.destroy) {
      try {
        storyCtl.destroy();
      } catch (_) {}
      storyCtl = null;
    }
    Asagi.patchSave({ started: true });
    storyCtl = createStory();
  }

  function createStory() {
    const story = C.story;
    if (!story || !story.lines) {
      view.innerHTML =
        '<div class="panel">' +
        homeLink() +
        "<p class=\"muted\">剧情数据缺失</p></div>";
      return { destroy: function () {} };
    }

    let q = story.lines.slice();
    let i = 0;
    let typing = false;
    let full = "";
    let timer = null;
    let mode = "text"; // text | choice | end
    let dead = false;

    view.innerHTML =
      '<div class="panel panel-story">' +
      homeLink() +
      '<div class="story" id="story-root">' +
      '<div class="story-sp" id="sp"></div>' +
      '<div class="story-tx" id="tx"></div>' +
      '<div class="story-hint" id="hint">点击继续</div>' +
      '<div class="stack story-choices" id="choices"></div>' +
      '<div class="stack story-ending" id="ending"></div>' +
      "</div></div>";

    const sp = document.getElementById("sp");
    const tx = document.getElementById("tx");
    const hint = document.getElementById("hint");
    const choicesEl = document.getElementById("choices");
    const endingEl = document.getElementById("ending");
    const root = document.getElementById("story-root");

    function clearTimer() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      typing = false;
    }

    function hideChoices() {
      choicesEl.innerHTML = "";
      choicesEl.style.display = "none";
    }

    function hideEnding() {
      endingEl.innerHTML = "";
      endingEl.style.display = "none";
    }

    function typeLine(text) {
      clearTimer();
      mode = "text";
      hideChoices();
      hideEnding();
      hint.style.display = "";
      sp.textContent = "";
      full = text || "";
      tx.textContent = "";
      if (!full) {
        typing = false;
        return;
      }
      typing = true;
      let n = 0;
      timer = setInterval(() => {
        if (dead) {
          clearTimer();
          return;
        }
        n++;
        tx.textContent = full.slice(0, n);
        if (n >= full.length) clearTimer();
      }, 16);
    }

    function showChoice(line) {
      clearTimer();
      mode = "choice";
      hideEnding();
      hint.style.display = "none";
      sp.textContent = "";
      tx.textContent = line.choicePrompt || "……";
      choicesEl.innerHTML = "";
      choicesEl.style.display = "flex";
      (line.choice || []).forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        b.textContent = c.label;
        b.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const branch = story.branches && story.branches[c.next];
          if (!branch || !branch.length) {
            tx.textContent = "（此路尚未写完）";
            return;
          }
          q = branch.slice();
          i = 0;
          playIndex();
        });
        choicesEl.appendChild(b);
      });
    }

    function finish(line) {
      clearTimer();
      mode = "end";
      hideChoices();
      hint.style.display = "none";
      sp.textContent = "";
      tx.textContent = line.ending || "……";

      try {
        const save = Asagi.loadSave();
        save.chapter = 1;
        save.started = true;
        if (line.flag) save.flags[line.flag] = true;
        if (line.unlockDiary && !save.diaryUnlocked.includes(line.unlockDiary)) {
          save.diaryUnlocked.push(line.unlockDiary);
        }
        (line.unlockEcho || []).forEach((id) => {
          if (!save.recallUnlocked.includes(id)) save.recallUnlocked.push(id);
        });
        if (line.unlockMusic && !save.musicUnlocked.includes(line.unlockMusic)) {
          save.musicUnlocked.push(line.unlockMusic);
        }
        Asagi.writeSave(save);
      } catch (err) {
        console.error(err);
      }

      endingEl.innerHTML = "";
      endingEl.style.display = "flex";
      const back = document.createElement("button");
      back.type = "button";
      back.className = "btn";
      back.textContent = "返回碑前";
      back.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        destroy();
        go("title");
      });
      endingEl.appendChild(back);
    }

    function playIndex() {
      if (dead) return;
      if (i < 0 || i >= q.length) {
        // 队列异常：不当成死机
        tx.textContent = "……";
        mode = "end";
        return;
      }
      const line = q[i];
      if (line.choice) {
        showChoice(line);
        return;
      }
      if (line.end) {
        finish(line);
        return;
      }
      mode = "text";
      hideChoices();
      hideEnding();
      hint.style.display = "";
      sp.textContent = line.sp || "";
      typeLine(line.t || "");
    }

    function advance() {
      if (dead || mode === "choice" || mode === "end") return;
      if (typing) {
        clearTimer();
        tx.textContent = full;
        return;
      }
      i += 1;
      if (i >= q.length) {
        // 没有 end 节点时的兜底
        finish({ ending: "雨还在下。", flag: "rite_fallback", unlockDiary: "d8" });
        return;
      }
      playIndex();
    }

    function onRootClick(e) {
      if (e.target.closest("button")) return;
      if (mode === "text") advance();
    }

    function onKey(e) {
      if (route !== "game" || dead) return;
      if (e.key !== " " && e.key !== "Enter") return;
      if (mode !== "text") return;
      e.preventDefault();
      advance();
    }

    root.addEventListener("click", onRootClick);
    document.addEventListener("keydown", onKey);

    function destroy() {
      dead = true;
      clearTimer();
      root.removeEventListener("click", onRootClick);
      document.removeEventListener("keydown", onKey);
      storyCtl = null;
    }

    playIndex();
    return { destroy: destroy };
  }

  /* -------- 手记：日期列表 → 展开 -------- */
  function diaryEntries() {
    const save = Asagi.loadSave();
    const u = new Set(save.diaryUnlocked || []);
    C.diary.forEach((d) => {
      if (d.id !== "d8") u.add(d.id);
    });
    return C.diary.map((d) => ({
      ...d,
      locked: !!(d.locked && !u.has(d.id)),
    }));
  }

  function renderDiary() {
    const all = diaryEntries();
    let open = null;

    function paint() {
      if (open) {
        const d = all.find((x) => x.id === open);
        view.innerHTML =
          '<div class="panel panel-read">' +
          '<button type="button" class="nav-home" id="back-list">目录</button>' +
          '<p class="read-date">' +
          d.date +
          "</p>" +
          "<h1>" +
          d.title +
          "</h1>" +
          '<div class="read-body">' +
          d.body.map((p) => "<p>" + p + "</p>").join("") +
          "</div></div>";
        document.getElementById("back-list").onclick = () => {
          open = null;
          paint();
        };
        return;
      }

      const rows = all
        .map((d) => {
          if (d.locked) {
            return (
              '<li class="entry is-lock"><span>' +
              d.date +
              '</span><span class="muted">未开</span></li>'
            );
          }
          return (
            '<li class="entry" data-id="' +
            d.id +
            '"><span>' +
            d.date +
            "</span><span>" +
            d.title +
            "</span></li>"
          );
        })
        .join("");

      view.innerHTML =
        '<div class="panel">' +
        homeLink() +
        '<header class="panel-head"><h1>手记</h1><p>短页。点开即读。</p></header>' +
        '<ul class="entry-list">' +
        rows +
        "</ul></div>";

      view.querySelectorAll(".entry[data-id]").forEach((li) => {
        li.onclick = () => {
          open = li.getAttribute("data-id");
          paint();
        };
      });
    }
    paint();
  }

  /* -------- 回响：横向症状，点一下亮一句 -------- */
  function echoEntries() {
    const save = Asagi.loadSave();
    const u = new Set(save.recallUnlocked || []);
    ["e1", "e2", "e3", "e4", "e5", "e6"].forEach((id) => u.add(id));
    return C.echoes.map((e) => ({
      ...e,
      locked: !!(e.locked && !u.has(e.id)),
    }));
  }

  function renderEcho() {
    const all = echoEntries();
    let sel = all.find((e) => !e.locked);

    function paint() {
      const e = sel && !sel.locked ? sel : all.find((x) => !x.locked);
      const tabs = all
        .map((x) => {
          if (x.locked) {
            return '<button type="button" class="tab is-lock" disabled>·</button>';
          }
          return (
            '<button type="button" class="tab' +
            (e && x.id === e.id ? " is-on" : "") +
            '" data-eid="' +
            x.id +
            '">' +
            x.title +
            "</button>"
          );
        })
        .join("");

      view.innerHTML =
        '<div class="panel panel-echo">' +
        homeLink() +
        '<header class="panel-head"><h1>回响</h1><p>病症。不是第二本日记。</p></header>' +
        '<div class="tabs">' +
        tabs +
        "</div>" +
        '<div class="echo-card">' +
        (e
          ? "<h2>" + e.title + "</h2><p>" + e.line + "</p>"
          : "<p class='muted'>……</p>") +
        "</div></div>";

      view.querySelectorAll(".tab[data-eid]").forEach((btn) => {
        btn.onclick = () => {
          sel = all.find((x) => x.id === btn.getAttribute("data-eid"));
          paint();
        };
      });
    }
    paint();
  }

  /* -------- 音 -------- */
  function renderMusic() {
    const save = Asagi.loadSave();
    const u = new Set(save.musicUnlocked || ["rain", "stone"]);
    u.add("rain");
    u.add("stone");
    if (save.chapter >= 1) u.add("echo");

    const rows = C.tracks
      .map((t) => {
        const open = u.has(t.id) && !t.locked;
        return (
          '<div class="track-row">' +
          '<button type="button" class="btn-icon" data-tid="' +
          t.id +
          '"' +
          (open ? "" : " disabled") +
          ">▶</button>" +
          "<div><b>" +
          (open ? t.title : "……") +
          "</b><i>" +
          (open ? t.meta : "") +
          "</i></div></div>"
        );
      })
      .join("");

    view.innerHTML =
      '<div class="panel">' +
      homeLink() +
      '<header class="panel-head"><h1>音</h1><p>雨默认在。这里只是抬高。</p></header>' +
      rows +
      '<p class="note" id="mst"></p></div>';

    function refresh() {
      const st = Asagi.getMusicState();
      const el = document.getElementById("mst");
      if (!el) return;
      if (st.playing && st.id) {
        const t = C.tracks.find((x) => x.id === st.id);
        el.textContent = "在响 · " + (t ? t.title : st.id);
      } else if (!Asagi.isRainMuted()) el.textContent = "雨在。";
      else el.textContent = "雨静。";
      view.querySelectorAll(".btn-icon[data-tid]").forEach((b) => {
        const on = st.playing && st.id === b.getAttribute("data-tid");
        b.textContent = on ? "■" : "▶";
      });
    }

    view.querySelectorAll(".btn-icon[data-tid]").forEach((b) => {
      if (b.disabled) return;
      b.onclick = () => {
        const id = b.getAttribute("data-tid");
        const st = Asagi.getMusicState();
        if (st.playing && st.id === id) Asagi.stopMusic();
        else Asagi.playMusic(id);
        refresh();
      };
    });
    refresh();
  }

  go("title");
})();
