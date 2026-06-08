import * as App from "@bindings/mycheet/app";
import type { PostIt } from "@bindings/mycheet/models";

function titleFromPath(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop()?.replace(/\.(md|txt)$/i, "") || "";
}

export async function loadPostits(): Promise<PostIt[]> {
  return App.GetPostIts().catch(() => []) as Promise<PostIt[]>;
}

export async function loadBaseDirFiles(): Promise<string[]> {
  return App.ListBaseDirFiles().catch(() => []) as Promise<string[]>;
}

export async function attachExistingFile(filePath: string): Promise<PostIt | null> {
  const title = titleFromPath(filePath);
  try {
    return (await App.AddPostItWithPath(title, filePath)) ?? null;
  } catch (e) {
    alert("추가 실패: " + e);
    return null;
  }
}

export async function savePostitChanges(
  selected: PostIt,
  hotkey: string,
): Promise<PostIt | null> {
  const title = titleFromPath(selected.path);
  const updated: PostIt = { id: selected.id, title, path: selected.path, hotkey };
  try {
    await App.UpdatePostIt(updated);
    return { ...selected, hotkey };
  } catch (e) {
    alert("저장 실패: " + e);
    return null;
  }
}

export async function deletePostitAndFile(postit: PostIt): Promise<boolean> {
  const name = titleFromPath(postit.path) || postit.path;
  if (!confirm(`"${name}" 파일을 포스트잇 목록에서 제거하고 디스크에서도 삭제할까요?`)) {
    return false;
  }
  try {
    await App.DeletePostItAndFile(postit.id);
    return true;
  } catch (e) {
    alert("삭제 실패: " + e);
    return false;
  }
}

export async function applyBaseDir(dir: string): Promise<boolean> {
  try {
    await App.SetBaseDir(dir);
    return true;
  } catch (e) {
    alert("오류: " + e);
    return false;
  }
}

export async function browseBaseDir(current: string): Promise<string | null> {
  try {
    return (await App.BrowseBaseDir()) ?? null;
  } catch {
    return null;
  }
}

export async function openBaseDir(): Promise<boolean> {
  try {
    await App.OpenBaseDir();
    return true;
  } catch (e) {
    alert("폴더 열기 실패: " + e);
    return false;
  }
}

export async function setAutostart(enable: boolean, previous: boolean): Promise<boolean> {
  try {
    await App.SetAutostartEnabled(enable);
    return enable;
  } catch (e) {
    alert("설정 변경 실패: " + e);
    return previous;
  }
}

export async function setTheme(themeId: string, previousId: string): Promise<string> {
  try {
    await App.SetTheme(themeId);
    return themeId;
  } catch (e) {
    alert("테마 변경 실패: " + e);
    return previousId;
  }
}

export type InitialSettings = {
  baseDir: string;
  autostart: boolean;
  themeId: string;
};

export async function loadInitialSettings(): Promise<InitialSettings> {
  const [baseDir, autostart, themeId] = await Promise.all([
    App.GetBaseDir().catch(() => ""),
    App.GetAutostartEnabled().catch(() => false),
    App.GetTheme().catch(() => ""),
  ]);
  return { baseDir: baseDir || "", autostart: !!autostart, themeId: themeId || "" };
}
