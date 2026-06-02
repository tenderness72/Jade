import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { FileNode, Tab, SearchResult } from "../types";

// ─── パスユーティリティ ────────────────────────────────────────────

/** OS非依存のファイル名抽出 */
export function basename(filePath: string): string {
  return filePath.replace(/\\/g, "/").split("/").pop() ?? filePath;
}

/** 拡張子なしのステム */
export function stem(filePath: string): string {
  const b = basename(filePath);
  const dot = b.lastIndexOf(".");
  return dot > 0 ? b.slice(0, dot) : b;
}

/** パスの親ディレクトリ */
export function dirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(0, idx) : ".";
}

// ─── ストア型定義 ──────────────────────────────────────────────────

interface AppState {
  // Vault
  vaultPath: string | null;
  fileTree: FileNode | null;

  // タブ
  tabs: Tab[];
  activeTabId: string | null;

  // 右パネル
  backlinks: string[];
  tags: string[];

  // 検索
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;

  // ステータス
  statusMessage: string;

  // 終了確認モーダル
  closeConfirmVisible: boolean;
  setCloseConfirmVisible: (v: boolean) => void;

  // ─── アクション ─────────────────────────────────────────────────

  /** Vaultを開く（ダイアログ表示） */
  openVault: () => Promise<void>;

  /** 既存パスでVaultを再読み込み */
  reloadVault: () => Promise<void>;

  /** ノートをタブで開く */
  openNote: (path: string) => Promise<void>;

  /** タブを閉じる */
  closeTab: (id: string) => void;

  /** アクティブタブを切り替え */
  setActiveTab: (id: string) => void;

  /** エディタ内容を更新（未保存フラグON） */
  updateContent: (tabId: string, content: string) => void;

  /** ノートを保存 */
  saveNote: (tabId: string) => Promise<void>;

  /** edit ⇔ split を切り替え */
  toggleSplit: (tabId: string) => void;

  /** バックリンクとタグを更新（ノート切り替え時） */
  refreshRightPanel: (notePath: string, content: string) => Promise<void>;

  /** 全文検索 */
  search: (query: string) => Promise<void>;

  /** 検索クエリをクリア */
  clearSearch: () => void;

  /** ステータスメッセージ（一時表示） */
  setStatus: (msg: string) => void;

  /** 新規ノートを作成して開く */
  createNote: (dirPath: string, name: string) => Promise<void>;

  /** ノートを削除（対応するタブも閉じる） */
  deleteItem: (path: string) => Promise<void>;

  /** リネーム */
  renameItem: (oldPath: string, newPath: string) => Promise<void>;

  /** フォルダ作成 */
  createFolder: (path: string) => Promise<void>;

  /** Wikiリンクで指定したノートを開く（なければ作成確認） */
  openWikiLink: (noteName: string) => Promise<void>;

  /** 起動時に前回のVaultを自動復元 */
  restoreLastVault: () => Promise<void>;

  /** 未保存タブが存在するか */
  hasDirtyTabs: () => boolean;

  /** 全ての未保存ノートを一括保存 */
  saveAll: () => Promise<void>;
}

// ─── Zustand ストア実装 ─────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  vaultPath: null,
  fileTree: null,
  tabs: [],
  activeTabId: null,
  backlinks: [],
  tags: [],
  searchQuery: "",
  closeConfirmVisible: false,
  setCloseConfirmVisible: (v) => set({ closeConfirmVisible: v }),
  searchResults: [],
  isSearching: false,
  statusMessage: "",

  // ── Vault ───────────────────────────────────────────────────────

  openVault: async () => {
    try {
      const path = await invoke<string | null>("open_vault_dialog");
      if (!path) return;
      const tree = await invoke<FileNode>("list_vault", { vaultPath: path });
      set({ vaultPath: path, fileTree: tree, tabs: [], activeTabId: null });
      // 次回起動時のために保存
      await invoke("save_config", { vaultPath: path }).catch(() => {});
      get().setStatus("Vault を開きました");
    } catch (e) {
      get().setStatus(`エラー: ${e}`);
    }
  },

  reloadVault: async () => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    try {
      const tree = await invoke<FileNode>("list_vault", { vaultPath });
      set({ fileTree: tree });
    } catch (e) {
      get().setStatus(`ツリー更新エラー: ${e}`);
    }
  },

  // ── タブ ─────────────────────────────────────────────────────────

  openNote: async (path: string) => {
    const { tabs } = get();
    // 既に開いているタブがあればアクティブにする
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      set({ activeTabId: existing.id });
      const content = existing.content;
      get().refreshRightPanel(path, content);
      return;
    }
    try {
      const content = await invoke<string>("read_note", { path });
      const noteName = stem(path);
      const newTab: Tab = {
        id: crypto.randomUUID(),
        path,
        name: noteName,
        content,
        isDirty: false,
        viewMode: 'split' as const,
      };
      set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTab.id }));
      get().refreshRightPanel(path, content);
    } catch (e) {
      get().setStatus(`読み込みエラー: ${e}`);
    }
  },

  closeTab: (id: string) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const newTabs = tabs.filter((t) => t.id !== id);
    let newActive = activeTabId;
    if (activeTabId === id) {
      // 隣のタブをアクティブに
      const nextTab = newTabs[idx] ?? newTabs[idx - 1] ?? null;
      newActive = nextTab?.id ?? null;
    }
    set({ tabs: newTabs, activeTabId: newActive });
    if (newActive) {
      const activeTab = newTabs.find((t) => t.id === newActive);
      if (activeTab) get().refreshRightPanel(activeTab.path, activeTab.content);
    } else {
      set({ backlinks: [], tags: [] });
    }
  },

  setActiveTab: (id: string) => {
    set({ activeTabId: id });
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === id);
    if (tab) get().refreshRightPanel(tab.path, tab.content);
  },

  updateContent: (tabId: string, content: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, content, isDirty: true } : t
      ),
    }));
    // タグだけリアルタイム更新（バックリンクは重いので省略）
    const tags = extractTags(content);
    set({ tags });
  },

  saveNote: async (tabId: string) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    try {
      await invoke("write_note", { path: tab.path, content: tab.content });
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, isDirty: false } : t
        ),
      }));
    } catch (e) {
      get().setStatus(`保存エラー: ${e}`);
    }
  },

  toggleSplit: (tabId: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? { ...t, viewMode: t.viewMode === 'split' ? 'edit' : 'split' }
          : t
      ),
    }));
  },

  // ── 右パネル ─────────────────────────────────────────────────────

  refreshRightPanel: async (notePath: string, content: string) => {
    const { vaultPath } = get();
    const noteName = stem(notePath);
    const tags = extractTags(content);
    set({ tags });
    if (vaultPath) {
      try {
        const backlinks = await invoke<string[]>("get_backlinks", {
          vaultPath,
          noteName,
        });
        set({ backlinks });
      } catch {
        set({ backlinks: [] });
      }
    }
  },

  // ── 検索 ─────────────────────────────────────────────────────────

  search: async (query: string) => {
    const { vaultPath } = get();
    if (!vaultPath || !query.trim()) {
      set({ searchResults: [], searchQuery: query });
      return;
    }
    set({ isSearching: true, searchQuery: query });
    try {
      const results = await invoke<SearchResult[]>("search_vault", {
        vaultPath,
        query,
      });
      set({ searchResults: results });
    } catch (e) {
      get().setStatus(`検索エラー: ${e}`);
    } finally {
      set({ isSearching: false });
    }
  },

  clearSearch: () => set({ searchQuery: "", searchResults: [] }),

  // ── ファイル操作 ──────────────────────────────────────────────────

  createNote: async (dirPath: string, name: string) => {
    const noteName = name.endsWith(".md") ? name : `${name}.md`;
    const sep = dirPath.includes("/") ? "/" : "\\";
    const path = `${dirPath}${sep}${noteName}`;
    try {
      await invoke("create_note", { path });
      await get().reloadVault();
      await get().openNote(path);
      get().setStatus(`"${name}" を作成しました`);
    } catch (e) {
      get().setStatus(`作成エラー: ${e}`);
    }
  },

  deleteItem: async (path: string) => {
    try {
      await invoke("delete_item", { path });
      // 対応タブを閉じる
      const { tabs } = get();
      const toClose = tabs.filter((t) => t.path.startsWith(path));
      for (const tab of toClose) get().closeTab(tab.id);
      await get().reloadVault();
      get().setStatus("削除しました");
    } catch (e) {
      get().setStatus(`削除エラー: ${e}`);
    }
  },

  renameItem: async (oldPath: string, newPath: string) => {
    try {
      await invoke("rename_item", { oldPath, newPath });
      // タブのパスを更新
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.path === oldPath
            ? { ...t, path: newPath, name: stem(newPath) }
            : t
        ),
      }));
      await get().reloadVault();
      get().setStatus("名前を変更しました");
    } catch (e) {
      get().setStatus(`リネームエラー: ${e}`);
    }
  },

  createFolder: async (path: string) => {
    try {
      await invoke("create_folder", { path });
      await get().reloadVault();
      get().setStatus("フォルダを作成しました");
    } catch (e) {
      get().setStatus(`フォルダ作成エラー: ${e}`);
    }
  },

  // ── Wikiリンク ─────────────────────────────────────────────────────

  openWikiLink: async (noteName: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    try {
      const path = await invoke<string | null>("resolve_note_path", {
        vaultPath,
        noteName,
      });
      if (path) {
        await get().openNote(path);
      } else {
        // 作成確認
        const ok = window.confirm(`"${noteName}" は存在しません。新規作成しますか？`);
        if (ok) {
          await get().createNote(vaultPath, noteName);
        }
      }
    } catch (e) {
      get().setStatus(`リンクエラー: ${e}`);
    }
  },

  // ── ステータス ───────────────────────────────────────────────────

  setStatus: (msg: string) => {
    set({ statusMessage: msg });
    setTimeout(() => set((s) => (s.statusMessage === msg ? { statusMessage: "" } : s)), 3000);
  },

  // ── 起動時に前回のVaultを自動復元 ──────────────────────────────────

  restoreLastVault: async () => {
    try {
      const lastPath = await invoke<string | null>("load_config");
      if (!lastPath) return;
      // フォルダが存在するか確認してから開く
      const tree = await invoke<FileNode>("list_vault", { vaultPath: lastPath });
      set({ vaultPath: lastPath, fileTree: tree });
      get().setStatus(`前回の Vault を復元しました`);
    } catch {
      // 前回のパスが無効（フォルダ削除・移動など）なら無視
    }
  },

  // ── 未保存チェック ─────────────────────────────────────────────────

  hasDirtyTabs: () => get().tabs.some((t) => t.isDirty),

  // ── 全ノートを一括保存 ─────────────────────────────────────────────

  saveAll: async () => {
    const { tabs } = get();
    const dirty = tabs.filter((t) => t.isDirty);
    await Promise.all(dirty.map((t) => get().saveNote(t.id)));
    if (dirty.length > 0) get().setStatus(`${dirty.length} 件を保存しました`);
  },
}));

// ─── タグ抽出ユーティリティ ────────────────────────────────────────

function extractTags(content: string): string[] {
  const regex = /#([\w぀-鿿゠-ヿ＀-￯]+)/g;
  const tags = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    tags.add(m[1]);
  }
  return Array.from(tags).sort();
}
