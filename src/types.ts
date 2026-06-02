// ─── ファイルシステム ──────────────────────────────────────────────

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

// ─── タブ ─────────────────────────────────────────────────────────

export interface Tab {
  id: string;
  path: string;
  /** 拡張子なしのノート名 */
  name: string;
  content: string;
  /** 未保存変更あり */
  isDirty: boolean;
  /** 表示モード: edit=エディタのみ / split=分割表示 */
  viewMode: 'edit' | 'split';
}

// ─── 検索 ─────────────────────────────────────────────────────────

export interface SearchResult {
  path: string;
  name: string;
  snippet: string;
  line: number;
}

// ─── コンテキストメニュー ──────────────────────────────────────────

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetPath: string;
  targetName: string;
  isDir: boolean;
}
