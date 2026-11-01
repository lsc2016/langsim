/*
 * langsim — 흐름 제어
 *
 * 두 층:
 *   상황 층  scenes/scene1.json  장소·물건·인물·순서. 대사는 key 만.
 *   언어 층  lang/<code>.json    key → { level, text }. 기획자가 직접 편집.
 *
 * 이 파일은 두 층을 읽어 화면을 움직일 뿐, 대사 원문을 갖고 있지 않다.
 */
"use strict";

const SCENE_URL = "scenes/scene1.json";
const LEVEL_MIN = 1;
const LEVEL_MAX = 5;

// 대답 방식. 지금은 "choice"(보기 고르기)만 만든다.
// "typing"(직접 입력)은 나중 단계 — renderTyping() 자리만 있다.
const settings = {
  inputMode: "choice", // "choice" | "typing"
};

const state = {
  scene: null,       // 상황 층
  lang: null,        // 지금 쓰는 언어 층
  langCode: "ko",
  level: 1,          // 플레이어 수준 (테스트용으로 화면 구석에서 조절)
  phase: "dark",     // dark | room | talk | ended
  nodeId: null,      // 지금 대화 마디
  history: [],       // 오간 말 { speaker, key }
  windowOpen: false,
  run: 0,            // 로고를 누를 때마다 1 증가 → 그 전에 걸어 둔 타이머는 무시됨
};

const $ = (id) => document.getElementById(id);
const el = {
  logo: $("logo"), langButton: $("lang-button"), langList: $("lang-list"),
  stage: $("stage"), room: $("room"), objects: $("objects"),
  talk: $("talk"), bubble: $("bubble"), choices: $("choices"), typing: $("typing"),
  narration: $("narration"), hint: $("hint"), ending: $("ending"),
  dark: $("dark"), wake: $("wake"),
  levelLabel: $("level-label"), levelValue: $("level-value"),
  levelDown: $("level-down"), levelUp: $("level-up"),
  toast: $("toast"), error: $("error"),
};

/* ───────── 불러오기 ───────── */

async function loadJSON(url) {
  // no-cache: 언어 파일을 고친 뒤 새로고침하면 바로 반영되도록
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url} 을(를) 불러오지 못했습니다 (${res.status})`);
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`${url} 의 형식이 잘못되었습니다. 따옴표나 쉼표가 빠졌는지 확인하세요.\n(${e.message})`);
  }
}

const langCache = {};
async function loadLang(code) {
  if (!langCache[code]) langCache[code] = await loadJSON(`lang/${code}.json`);
  return langCache[code];
}

function langReady(lang) {
  return Object.keys(lang).some((k) => !k.startsWith("_") && lang[k] && lang[k].text);
}

/* ───────── 언어 층 읽기 ───────── */

function entry(key) {
  const e = state.lang && state.lang[key];
  if (!e || typeof e.text !== "string" || e.text === "") {
    console.warn(`[langsim] 언어 파일(${state.langCode}.json)에 "${key}" 가 없습니다.`);
    return { level: 1, text: `[${key}]` };
  }
  return { level: Number(e.level) || 1, text: e.text };
}
const t = (key) => entry(key).text;

/* ───────── 친구의 다음 말 ─────────
 * 친구가 무엇을 말할지 정하는 곳은 이 함수 하나뿐이다.
 * 지금은 상황 층에 적힌 대로(선택지의 next) 다음 마디를 고른다.
 * 나중에 AI(LLM)가 친구 역할을 할 때는 이 함수만 바꾸면 된다
 * (history 와 플레이어의 말을 보내고, 다음 마디 또는 새 대사를 받아 돌려줌).
 * 그래서 처음부터 async 로 둔다.
 */
async function decideFriendReply({ scene, nodeId, choice, history, langCode }) {
  void history; void langCode; // AI 용 자리
  const node = scene.dialogue.nodes[nodeId];
  const picked = node.choices && node.choices.find((c) => c.key === choice.key);
  return { nodeId: picked ? picked.next : null };
}

/* ───────── 그리기 ───────── */

function asset(name) {
  return state.scene.assets[name];
}

function placeBox(node, box) {
  node.style.left = box.x + "%";
  node.style.top = box.y + "%";
  node.style.width = box.w + "%";
  node.style.height = box.h + "%";
}

function buildRoom() {
  const scene = state.scene;
  el.stage.style.aspectRatio = scene.stage && scene.stage.aspect ? scene.stage.aspect : "3 / 4";
  el.room.src = asset("room");
  el.objects.innerHTML = "";
  for (const obj of scene.objects) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "object";
    btn.dataset.id = obj.id;
    btn.setAttribute("aria-label", obj.id);
    placeBox(btn, obj.box);
    const img = document.createElement("img");
    img.alt = "";
    img.src = asset(obj.image);
    btn.appendChild(img);
    if (scene.friend && scene.friend.showIn === obj.id) {
      const inner = document.createElement("div");
      inner.className = "window-inner";
      const friend = document.createElement("img");
      friend.className = "friend";
      friend.alt = "";
      friend.src = asset(scene.friend.image);
      placeBox(friend, scene.friend.box);
      friend.hidden = true;
      inner.appendChild(friend);
      btn.appendChild(inner);
    }
    btn.addEventListener("click", () => onObjectTap(obj, btn));
    el.objects.appendChild(btn);
  }
}

function applyUIText() {
  el.wake.textContent = t(state.scene.intro.buttonKey);
  el.levelLabel.textContent = t("ui.level");
  el.levelValue.textContent = state.level;
  el.langButton.textContent = state.langCode + " ▾";
  document.documentElement.lang = state.langCode;
}

/* ───────── 타이머 (로고를 누르면 모두 무효) ───────── */

function later(ms, fn) {
  const run = state.run;
  return new Promise((resolve) => {
    setTimeout(() => {
      if (run === state.run) fn && fn();
      resolve(run === state.run);
    }, ms);
  });
}

let narrationTimer = null;
function narrate(key) {
  clearTimeout(narrationTimer);
  el.narration.textContent = t(key);
  el.narration.hidden = false;
  // 같은 글이어도 다시 튀어나오게
  el.narration.style.animation = "none";
  void el.narration.offsetWidth;
  el.narration.style.animation = "";
  narrationTimer = setTimeout(() => (el.narration.hidden = true), 2400);
}

function flash(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

/* ───────── 흐름 ───────── */

// 첫 화면: 어둡고 "눈을 뜬다" 하나. 로고는 어디서든 여기로.
function reset() {
  state.run += 1;
  state.phase = "dark";
  state.nodeId = null;
  state.history = [];
  state.windowOpen = false;
  clearTimeout(narrationTimer);
  el.talk.hidden = true;
  el.bubble.textContent = "";
  el.choices.innerHTML = "";
  el.typing.hidden = true;
  el.narration.hidden = true;
  el.hint.hidden = true;
  el.ending.hidden = true;
  el.langList.hidden = true;
  el.langButton.setAttribute("aria-expanded", "false");
  buildRoom();
  el.objects.style.pointerEvents = "";
  el.dark.hidden = false;
  el.dark.classList.remove("open");
  el.wake.disabled = false;
  el.wake.focus({ preventScroll: true });
}

function wakeUp() {
  if (state.phase !== "dark") return;
  state.phase = "room";
  el.wake.disabled = true;
  el.dark.classList.add("open");
  later(1400, () => {
    el.dark.hidden = true;
    el.hint.textContent = t(state.scene.hintKey);
    el.hint.hidden = false;
  });
}

function onObjectTap(obj, btn) {
  if (state.phase !== "room") return;
  el.hint.hidden = true;
  const tap = obj.onTap || {};
  switch (tap.action) {
    case "joke": // 침대: 아무 일도 안 일어남
      flash(btn, "tapped");
      narrate(tap.lineKey);
      break;
    case "locked": // 문: 잠김을 그림(자물쇠)으로
      flash(btn, "shake");
      if (tap.badge && !btn.querySelector(".badge")) {
        const badge = document.createElement("img");
        badge.className = "badge";
        badge.alt = "";
        badge.src = asset(tap.badge);
        btn.appendChild(badge);
      }
      narrate(tap.lineKey);
      break;
    case "openWindow":
      openWindow(obj, btn, tap);
      break;
    default:
      flash(btn, "tapped");
  }
}

async function openWindow(obj, btn, tap) {
  if (state.windowOpen) return;
  state.windowOpen = true;
  btn.querySelector("img").src = asset(obj.imageOpen);
  el.narration.hidden = true;
  const friend = btn.querySelector(".friend");
  if (friend) {
    friend.hidden = false;
    await later(30);
    friend.classList.add("show");
  }
  if (tap.startDialogue) {
    const ok = await later(800);
    if (ok) startDialogue();
  }
}

function startDialogue() {
  state.phase = "talk";
  el.objects.style.pointerEvents = "none"; // 말하는 중에는 물건이 반응하지 않음
  el.talk.hidden = false;
  showNode(state.scene.dialogue.start);
}

function showBubble(speaker, text) {
  el.bubble.className = "bubble" + (speaker === "me" ? " me" : "");
  el.bubble.textContent = text;
  // 새 말풍선마다 튀어나오는 효과
  el.bubble.style.animation = "none";
  void el.bubble.offsetWidth;
  el.bubble.style.animation = "";
}

async function showNode(nodeId) {
  const node = state.scene.dialogue.nodes[nodeId];
  if (!node) {
    console.warn(`[langsim] 대화 마디 "${nodeId}" 가 scene1.json 에 없습니다.`);
    return endScene();
  }
  state.nodeId = nodeId;
  state.history.push({ speaker: node.speaker, key: node.lineKey });
  showBubble(node.speaker, t(node.lineKey));
  el.choices.innerHTML = "";
  if (node.end) {
    const ok = await later(2000);
    if (ok) endScene();
    return;
  }
  renderInput();
}

// 대답 입력 자리. inputMode 에 따라 바뀐다.
function renderInput() {
  if (settings.inputMode === "typing") return renderTyping();
  renderChoices();
}

// 수준 이하의 선택지만 보여준다.
function visibleChoices(node) {
  const all = (node.choices || []).map((c) => ({ ...c, ...entry(c.key) }));
  const shown = all.filter((c) => c.level <= state.level);
  if (shown.length === 0 && all.length) {
    // 기획자가 level 1 선택지를 빠뜨려도 막히지 않게: 가장 쉬운 것을 보여준다
    const min = Math.min(...all.map((c) => c.level));
    console.warn(`[langsim] "${state.nodeId}" 에 수준 ${state.level} 이하 선택지가 없습니다.`);
    return all.filter((c) => c.level === min);
  }
  return shown;
}

function renderChoices() {
  const node = state.scene.dialogue.nodes[state.nodeId];
  el.choices.innerHTML = "";
  el.typing.hidden = true;
  for (const c of visibleChoices(node)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice";
    b.textContent = c.text;
    const lv = document.createElement("span");
    lv.className = "lv";
    lv.textContent = "Lv" + c.level;
    b.appendChild(lv);
    b.addEventListener("click", () => onChoice(c));
    el.choices.appendChild(b);
  }
}

// 나중 단계: 수준이 높아지면 직접 타이핑. 지금은 만들지 않고 보기로 대신한다.
function renderTyping() {
  console.info("[langsim] inputMode 'typing' 은 아직 준비 중입니다. 보기 고르기로 대신합니다.");
  renderChoices();
}

async function onChoice(choice) {
  if (state.phase !== "talk") return;
  const run = state.run;
  el.choices.innerHTML = "";
  state.history.push({ speaker: "me", key: choice.key });
  showBubble("me", choice.text);
  const fromNode = state.nodeId;
  const [reply] = await Promise.all([
    decideFriendReply({
      scene: state.scene,
      nodeId: fromNode,
      choice,
      history: state.history.slice(),
      langCode: state.langCode,
    }),
    later(900),
  ]);
  if (run !== state.run) return; // 그 사이 로고를 눌렀음
  if (reply && reply.nodeId) showNode(reply.nodeId);
  else endScene();
}

function endScene() {
  state.phase = "ended";
  el.talk.hidden = true;
  el.ending.textContent = t(state.scene.endKey);
  el.ending.hidden = false;
}

/* ───────── 수준 · 언어 ───────── */

function setLevel(n) {
  state.level = Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, n));
  el.levelValue.textContent = state.level;
  // 선택지가 떠 있으면 바로 다시 그림
  if (state.phase === "talk" && el.choices.children.length) renderInput();
}

let toastTimer = null;
function toast(text) {
  clearTimeout(toastTimer);
  el.toast.textContent = text;
  el.toast.hidden = false;
  toastTimer = setTimeout(() => (el.toast.hidden = true), 1800);
}

async function buildLangList() {
  for (const btn of el.langList.querySelectorAll("button[data-lang]")) {
    const code = btn.dataset.lang;
    let ready = false;
    try { ready = langReady(await loadLang(code)); } catch { ready = false; }
    btn.classList.toggle("disabled", !ready);
    btn.innerHTML = "";
    btn.append(code);
    if (!ready) {
      const s = document.createElement("small");
      s.textContent = t("ui.coming_soon");
      btn.appendChild(s);
    }
    btn.dataset.ready = ready ? "1" : "";
  }
}

async function chooseLang(code) {
  el.langList.hidden = true;
  el.langButton.setAttribute("aria-expanded", "false");
  if (code === state.langCode) return;
  let lang;
  try { lang = await loadLang(code); } catch { lang = null; }
  if (!lang || !langReady(lang)) {
    toast(`${code}: ${t("ui.coming_soon")}`);
    return;
  }
  state.lang = lang;
  state.langCode = code;
  applyUIText();
  await buildLangList();
  reset();
}

/* ───────── 시작 ───────── */

function bindEvents() {
  el.logo.addEventListener("click", reset);
  el.wake.addEventListener("click", wakeUp);
  el.levelDown.addEventListener("click", () => setLevel(state.level - 1));
  el.levelUp.addEventListener("click", () => setLevel(state.level + 1));
  el.langButton.addEventListener("click", (e) => {
    e.stopPropagation();
    el.langList.hidden = !el.langList.hidden;
    el.langButton.setAttribute("aria-expanded", String(!el.langList.hidden));
  });
  el.langList.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-lang]");
    if (b) chooseLang(b.dataset.lang);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".lang-menu")) el.langList.hidden = true;
  });
}

async function main() {
  bindEvents();
  try {
    state.scene = await loadJSON(SCENE_URL);
    state.lang = await loadLang(state.langCode);
  } catch (e) {
    el.error.hidden = false;
    el.error.textContent =
      e.message +
      (location.protocol === "file:"
        ? "\n\n파일을 직접 열면 브라우저가 json 을 막습니다. README 의 '실행하기'를 보세요."
        : "");
    return;
  }
  applyUIText();
  reset();
  buildLangList();
}

main();
