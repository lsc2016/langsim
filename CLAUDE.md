# CLAUDE.md — langsim

## 이 프로젝트는
- 외국어로 말해야 살아갈 수 있는 작은 세계 — 언어학습 시뮬레이션(웹 화면).
- 지금은 첫 장면 "아침, 방 안" 하나뿐. 한국어 대사만 채워져 있고 영어·중국어는 빈 틀.
- 설치·빌드 없는 정적 웹앱(HTML/CSS/JS). 자세한 사용법은 `README.md`.

## 폴더 지도
| 이름 | 하는 일 |
|---|---|
| `index.html` | 화면 틀 (로고, 언어 메뉴, 무대, 수준 버튼) |
| `style.css` | 모양 |
| `app.js` | 흐름 제어. 대사 원문은 없음 |
| `scenes/scene1.json` | 상황 층: 장소·물건·인물·대화 순서 (대사는 key 만) |
| `lang/ko.json` `en.json` `zh.json` | 언어 층: key → { level, text } |
| `assets/` ⛔ | 그림(SVG). 열지 말 것 — 파일 이름만 `scenes/scene1.json` 의 `assets` 에서 확인 |

## 시작점
- 실행: 이 폴더에서 `python3 -m http.server` → `http://localhost:8000`. (index.html 을 더블클릭하면 json 읽기가 막혀 안 됨)
- 읽는 순서: `README.md` → `scenes/scene1.json` → `app.js` 의 `main()` (맨 아래) 부터 위로.
- key 맞춤 확인: `node check_keys.js` (장면·app.js 가 쓰는 key 가 세 언어 파일에 모두 있는지, 읽기만 함).

## 고치는 규칙
- 있는 것을 지우고 새로 만들지 말고, 더하고 보완하기.
- 사람이 승인하기 전에 데이터 파일·설정 파일을 지우거나 덮어쓰지 않기. (여기서는 `lang/*.json`, `scenes/*.json`)
- 삭제 명령(rm -rf 등)은 쓰지 않기.
- 어느 화면에서든 첫 화면으로 돌아갈 길(로고 누르면 첫 화면)을 없애지 않기. (`app.js` 의 `el.logo` → `reset()`)
- 대사 글은 `app.js` 에 넣지 말고 `lang/*.json` 에. 새 key 를 만들면 세 언어 파일 모두에 넣기.
- `lang/*.json` 의 왼쪽 key 는 `scenes/scene1.json` 과 같아야 함.

## 읽는 양 줄이기
| 이런 일이면 | 이 파일만 읽어라 |
|---|---|
| 대사 글 바꾸기·번역 | `lang/<언어>.json` |
| 대화 순서·선택지 늘리기 | `scenes/scene1.json` (+ 새 key 는 `lang/*.json`) |
| 물건 위치·그림 바꾸기 | `scenes/scene1.json` 의 `objects`, `assets` |
| 화면 모양 | `style.css`, `index.html` |
| AI 친구 붙이기 | `app.js` 의 `decideFriendReply()` |
| 직접 타이핑 입력 | `app.js` 의 `settings.inputMode`, `renderTyping()` |

열지 말 것: `assets/` (SVG 그림).

## 용어
| 우리말 | 코드 안 이름 |
|---|---|
| 장면 | `scene` (`scenes/scene1.json`) |
| 상황 층 / 언어 층 | `state.scene` / `state.lang` |
| 대화 마디 | `dialogue.nodes`, `state.nodeId` |
| 선택지 | `choices` (key 가 `me.` 로 시작) |
| 안내 글 | `narration.` key, `narrate()` |
| 수준 | `level` (1~5, `state.level`) |
| 첫 화면 | `reset()` (phase `dark`) |

## 다른 프로젝트와의 연결
없음 (다른 폴더·저장소를 읽거나 쓰지 않음).

## 저장소 밖
없음.

## 모르는 것 (확인 필요)
- 기본 브랜치가 `claude/happy-fermi-lbd14e` 임 — main 으로 옮길 계획인지 확인 필요.
- GitHub Pages 로 실제 공개 중인지 확인 필요.
