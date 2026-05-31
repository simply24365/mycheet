# Battery Efficiency Analysis — mycheet

> 분석 기준일: 2026-05-31  
> 대상: `app.go`, `main.go`, `frontend/src/**`

---

## 결론 요약

| 항목 | 평가 | 비고 |
|---|---|---|
| 전역 단축키 (hotkey) | ✅ 효율적 | OS `RegisterHotKey` — 인터럽트 기반, idle 시 CPU 0 |
| 파일 감시 (fsnotify) | ⚠️ 사실상 미동작 | `startWatcher()` 미호출 — 아래 참고 |
| 프론트엔드 이벤트 루프 | ✅ 효율적 | setInterval/setTimeout 없음, RAF 1회성 사용 |
| 트레이 아이콘 | ✅ 효율적 | OS 메시지 루프 기반 |
| 숨김 WebView2 인스턴스 | ⚠️ 개선 여지 | 노트 수만큼 상시 프로세스 유지 |

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

### ⚠️ 파일 감시 (fsnotify) — 미동작 버그

`startWatcher()` 함수가 정의되어 있지만 **`Init()`에서 호출되지 않는다.**  
결과적으로 `a.watcher == nil` 이므로 `watchFile()` 도 no-op, `file-changed-externally` 이벤트는 절대 발생하지 않는다.

```go
// app.go:135 — startWatcher() 호출 누락
func (a *App) Init() {
    ...
    a.rebuildHotkeys()
    a.registerCommandPaletteHotkey()
    // startWatcher() 없음!
}
```

**배터리 관점:** 오히려 watcher가 꺼져 있어 OS 핸들이 열리지 않으므로 의도치 않게 효율적이다.  
다만 외부 편집기로 노트를 수정해도 앱에 반영되지 않는 **기능 버그**이기도 하다.

> 필요하다면 `Init()` 마지막에 `a.startWatcher()` 를 추가하면 된다.  
> fsnotify는 OS 커널 이벤트(`ReadDirectoryChangesW`) 기반이므로 활성화해도 배터리 영향은 미미하다.

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

### ⚠️ 숨김 WebView2 인스턴스 — 가장 큰 개선 포인트

`InitWindowsAndTray()`는 **앱 시작 시 모든 노트의 WebView2 창을 즉시 생성**한다.  
창이 `Hidden: true`여도 Windows는 WebView2 렌더러 프로세스를 유지한다.

```go
// app.go:524 — 모든 노트를 즉시 초기화
func (a *App) InitWindowsAndTray() error {
    for _, p := range postits {
        if err := a.openPostitWindow(p.ID); err != nil { ... }
    }
}
```

**실질적 비용:**
- 노트 N개 → WebView2 렌더러 N+2개(설정+팔레트) 상시 실행
- 각 WebView2 프로세스는 기본 약 40–80 MB RAM 점유
- Windows는 숨겨진 WebView2에도 주기적으로 GC, 업데이트 체크 등 내부 타이머를 실행함

**개선 방안 (선택적):**
1. **Lazy window creation**: `TogglePostitWindow()` 첫 호출 시 창을 만들도록 변경. 이미 `openPostitWindow` 내부에 중복 방지 로직이 있으므로 `InitWindowsAndTray` 자체를 제거하거나 비워도 된다.
2. **WebView2 TrySuspendAsync**: Edge WebView2는 숨김 창을 일시 중단하는 API를 제공한다. Wails v3에서 직접 노출하지 않으나 future 버전에서 지원될 수 있다.

```go
// 개선안: InitWindowsAndTray에서 즉시 생성 제거
// openPostitWindow는 TogglePostitWindow 첫 호출 때 자동으로 실행됨
func (a *App) InitWindowsAndTray() error {
    return nil // lazy creation으로 전환
}
```

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
개선이 필요한 부분은 시작 시 모든 WebView2 인스턴스를 미리 생성하는 구조이며, lazy creation으로 전환하면 백그라운드 전력 소모를 노트 수에 비례해 줄일 수 있다.
