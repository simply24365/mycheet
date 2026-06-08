# Battery Efficiency Analysis — mycheet

> 분석 기준일: 2026-05-31 (최종 갱신 2026-06-08)  
> 대상: `app*.go`, `main.go`, `frontend/src/**`

---

## 결론 요약

| 항목 | 평가 | 비고 |
|---|---|---|
| 전역 단축키 (hotkey) | ✅ 효율적 | OS `RegisterHotKey` — 인터럽트 기반, idle 시 CPU 0 |
| 파일 감시 (fsnotify) | ✅ 활성 | `Init()` 에서 `startWatcher()` 호출 — `app_watcher.go` |
| 프론트엔드 이벤트 루프 | ✅ 효율적 | setInterval/setTimeout 없음, RAF 1회성 사용 |
| 트레이 아이콘 | ✅ 효율적 | OS 메시지 루프 기반 |
| 숨김 WebView2 인스턴스 | ✅ Lazy | `openPostitWindow` 가 첫 `TogglePostitWindow` 호출 시 생성 — `app_window.go` |

---

## 세부 분석

### ✅ 전역 단축키

`golang.design/x/hotkey` 는 Windows `RegisterHotKey` Win32 API를 사용한다.  
핫키 goroutine은 `hk.Keydown()` 채널과 `stop` 채널에 블록되어 있어 **키 입력이 없으면 CPU를 전혀 소모하지 않는다.**  
커맨드 팔레트 1개 + 노트별 각 1개 goroutine이 있으나 모두 채널 대기 상태이므로 스케줄러에 의해 파킹된다.

```go
// app.go:696 — 올바른 패턴: 채널에 블록, 폴링 없음
case <-hk.Keydown():
    _ = a.TogglePostitWindow(id)
```

---

### ✅ 파일 감시 (fsnotify)

`app_watcher.go` 의 `startWatcher()` 가 `app.go` 의 `Init()` 마지막 줄에서 호출된다.  
fsnotify 는 OS 커널 이벤트(`ReadDirectoryChangesW`) 기반이므로 idle 시 CPU 0이다.

> 2026-06 기준: `startWatcher()` 가 Write 이벤트를 받지만 더 이상 `file-changed-externally` 를 발생시키지 않는다 — 프론트 리스너가 없어 dead emit 이었기 때문이다 (`app_watcher.go:43` 주석 참고).  
> PostitViewer 가 외부 편집을 구독해야 할 때 이 줄을 복구하면 된다.

---

### ✅ 프론트엔드 — 이벤트 기반, 폴링 없음

- `setInterval` / `setTimeout` 루프: **전혀 없음**
- `requestAnimationFrame`: `CommandPalette.tsx` 에서 팔레트 열릴 때 input 포커스용 1회성 호출만 존재 (반복 루프 아님)
- Wails Events (`Events.On`): 트레이/Go 레이어에서 emit 될 때만 콜백 — JS 측에서 폴링하지 않음
- 이벤트 리스너 cleanup: `useEffect` 반환값으로 `off()` 호출 → 메모리 누수 없음

```tsx
// CommandPalette.tsx:63 — 정상적 cleanup
return () => {
    offOpened?.();
    offUpdated?.();
};
```

---

### ✅ 숨김 WebView2 인스턴스 — Lazy 생성

`openPostitWindow` (`app_window.go`) 는 **첫 `TogglePostitWindow(id)` 호출 시점**에만 실행된다.  
이전 버전의 `InitWindowsAndTray` (앱 시작 시 모든 노트의 WebView2 창을 즉시 생성) 는 **삭제**되었으며, 바인딩에서도 제거되어 더 이상 호출되지 않는다.

**실질적 비용:**
- 노트 N개 → WebView2 렌더러 2개(설정+팔레트) 상시 실행 + 열려 있는 노트 N개
- 사용자가 토글한 적 없는 노트는 프로세스 자체가 생성되지 않음
- `TogglePostitWindow` 가 호출되어 `openPostitWindow` 가 진입하면 맵에 등록하고, `deletePostIt` 가 호출되면 즉시 `closePostitWindow` 로 정리한다.

---

## 트레이 대기 상태 (백그라운드) 정리

모든 창이 닫히고 트레이만 남은 상태에서의 리소스 사용:

| 컴포넌트 | 상태 | CPU |
|---|---|---|
| Go 메인 goroutine | OS 이벤트 루프 대기 (`app.Run()`) | ~0 |
| 핫키 goroutine(s) | 채널 블록 | ~0 |
| 트레이 | OS WM_TRAYICON 대기 | ~0 |
| WebView2 (설정/팔레트) | Hidden, renderer 살아있음 | 소폭 (수 MB/h) |
| WebView2 (노트 N개) | Hidden, renderer 살아있음 | N × 소폭 |

**결론**: 핫키·트레이·파일 감시 로직 자체는 완전히 이벤트 기반으로 잘 구현되어 있다.  
2026-06 리팩터링으로 시작 시 모든 WebView2 인스턴스를 미리 생성하는 구조가 lazy creation으로 전환되었고, fsnotify watcher 가 정상 동작한다.

---

## 2026-06-08 리팩터링 (참고)

대규모 파일이 도메인별로 분할되었다. AI 에이전트가 작업할 때 다음 매핑을 참조하라.

| 변경 영역 | 이전 | 이후 |
|---|---|---|
| 백엔드 | `app.go` (840 줄) | `app.go` (lifecycle) + `app_config.go` + `app_postit.go` + `app_window.go` + `app_hotkey.go` + `app_watcher.go` + `app_files.go` + `app_palette.go` + `app_theme.go` + `app_basedir.go` + `app_autostart.go` |
| 프론트 설정 | `Settings.tsx` (721 줄) | `Settings.tsx` (컨테이너) + `settings/{GeneralPage,KeymapPage,ThemePage,title-bar,surface-card}.tsx` + `settings/{use-window-state,use-hotkey-recorder,api}.ts` |
| 프론트 팔레트 | `CommandPalette.tsx` (검색 로직 포함) | `CommandPalette.tsx` (UI) + `palette/search.ts` (매칭 알고리즘) |
| 프론트 테마 | `lib/theme.js` (297 줄) | `lib/theme/{seeds,color,presets,apply,constants,index}.js` |
| 데드 코드 | – | `watchFile()`, `InitWindowsAndTray()`, `InfoTile`, `file-changed-externally` emit 모두 제거 |
| `getFileName` 중복 | 2곳 | `lib/path.ts` 단일 정의 |
| import 별칭 | `../../bindings/...` | `@bindings/...` (tsconfig paths 에 추가) |
