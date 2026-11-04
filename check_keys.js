#!/usr/bin/env node
// 대사 key 맞춤 확인: scenes/*.json 과 app.js 가 쓰는 key 가 lang/*.json 에 모두 있는지,
// 언어 파일에 장면이 안 쓰는 key 가 남아 있는지 본다. 읽기만 한다.
// 쓰는 법: 이 폴더에서  node check_keys.js   (문제 없으면 끝 줄 "✓", 있으면 종료 코드 1)
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

// 장면 파일에서 key 모으기: 이름이 "key" 이거나 "Key" 로 끝나는 칸의 글자 값
const used = new Set();
function walk(v) {
  if (Array.isArray(v)) return v.forEach(walk);
  if (!v || typeof v !== "object") return;
  for (const [k, x] of Object.entries(v)) {
    if (typeof x === "string" && (k === "key" || k.endsWith("Key"))) used.add(x);
    else walk(x);
  }
}
for (const f of fs.readdirSync(path.join(ROOT, "scenes")).filter((f) => f.endsWith(".json"))) {
  walk(read(`scenes/${f}`));
}
// app.js 안에 바로 적힌 key (예: "ui.level")
const appKeys = fs.readFileSync(path.join(ROOT, "app.js"), "utf8").match(/["'](?:ui|narration|friend|me)\.[a-z0-9._]+["']/g) || [];
appKeys.forEach((s) => used.add(s.slice(1, -1)));

let bad = 0;
for (const f of fs.readdirSync(path.join(ROOT, "lang")).filter((f) => f.endsWith(".json")).sort()) {
  const keys = new Set(Object.keys(read(`lang/${f}`)).filter((k) => !k.startsWith("_")));
  const missing = [...used].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !used.has(k));
  if (missing.length) { bad++; console.log(`✗ ${f}: 없는 key ${missing.length}개 — ${missing.join(", ")}`); }
  if (extra.length) console.log(`  ${f}: 장면에서 안 쓰는 key ${extra.length}개 — ${extra.join(", ")}`);
  if (!missing.length && !extra.length) console.log(`  ${f}: key ${keys.size}개 모두 맞음`);
}
console.log(bad ? "✗ 빠진 key 가 있습니다" : `✓ 쓰는 key ${used.size}개가 모든 언어 파일에 있습니다`);
process.exit(bad ? 1 : 0);
