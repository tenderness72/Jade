import { useState, useRef, useCallback } from "react";
import type { FileNode, ContextMenuState } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import { stem } from "../../store/useAppStore";

interface FileTreeProps {
  node: FileNode;
  depth?: number;
}

export function FileTree({ node, depth = 0 }: FileTreeProps) {
  const [expanded, setExpanded] = useState(depth === 0 ? true : false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState<"note" | "folder" | null>(null);
  const [createValue, setCreateValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const openNote = useAppStore((s) => s.openNote);
  const deleteItem = useAppStore((s) => s.deleteItem);
  const renameItem = useAppStore((s) => s.renameItem);
  const createNote = useAppStore((s) => s.createNote);
  const createFolder = useAppStore((s) => s.createFolder);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const tabs = useAppStore((s) => s.tabs);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isActive = !node.is_dir && activeTab?.path === node.path;

  // ─── コンテキストメニュー ──────────────────────────────────────

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        targetPath: node.path,
        targetName: node.name,
        isDir: node.is_dir,
      });
    },
    [node]
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // ─── リネーム ──────────────────────────────────────────────────

  const startRename = useCallback(() => {
    setRenameValue(node.is_dir ? node.name : stem(node.path));
    setRenaming(true);
    closeContextMenu();
    setTimeout(() => renameInputRef.current?.select(), 50);
  }, [node, closeContextMenu]);

  const commitRename = useCallback(async () => {
    if (!renameValue.trim() || renameValue === (node.is_dir ? node.name : stem(node.path))) {
      setRenaming(false);
      return;
    }
    const pathParts = node.path.replace(/\\/g, "/").split("/");
    pathParts.pop();
    const parent = pathParts.join("/");
    const sep = node.path.includes("/") ? "/" : "\\";
    const newName = node.is_dir
      ? renameValue
      : renameValue.endsWith(".md")
      ? renameValue
      : `${renameValue}.md`;
    const newPath = `${parent}${sep}${newName}`;
    setRenaming(false);
    await renameItem(node.path, newPath);
  }, [renameValue, node, renameItem]);

  // ─── 新規作成 ──────────────────────────────────────────────────

  const startCreate = useCallback(
    (type: "note" | "folder") => {
      setCreating(type);
      setCreateValue("");
      closeContextMenu();
      if (!expanded) setExpanded(true);
      setTimeout(() => createInputRef.current?.focus(), 50);
    },
    [closeContextMenu, expanded]
  );

  const commitCreate = useCallback(async () => {
    const val = createValue.trim();
    if (!val) { setCreating(null); return; }
    const targetDir = node.is_dir ? node.path : (() => {
      const parts = node.path.replace(/\\/g, "/").split("/");
      parts.pop();
      return parts.join("/");
    })();
    setCreating(null);
    if (creating === "note") {
      await createNote(targetDir, val);
    } else {
      const sep = node.path.includes("/") ? "/" : "\\";
      await createFolder(`${targetDir}${sep}${val}`);
    }
  }, [createValue, node, creating, createNote, createFolder]);

  // ─── ルートノードは特殊レンダリング ───────────────────────────

  if (depth === 0) {
    return (
      <div>
        {/* Vault直下にファイル作成ボタン */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 11,
              color: "var(--subtext0)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={node.path}
          >
            {node.name}
          </span>
          <IconBtn title="新規ノート" onClick={() => startCreate("note")}>＋</IconBtn>
          <IconBtn title="新規フォルダ" onClick={() => startCreate("folder")}>📁</IconBtn>
        </div>

        {/* 作成入力フィールド */}
        {creating && (
          <CreateInput
            type={creating}
            value={createValue}
            onChange={setCreateValue}
            onCommit={commitCreate}
            onCancel={() => setCreating(null)}
            ref={createInputRef}
            depth={1}
          />
        )}

        {/* 子ノード */}
        {node.children.map((child) => (
          <FileTree key={child.path} node={child} depth={1} />
        ))}
      </div>
    );
  }

  // ─── 通常ノード ────────────────────────────────────────────────

  const indent = depth * 14;

  return (
    <div>
      {/* コンテキストメニューオーバーレイ */}
      {contextMenu?.visible && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 999 }}
          onClick={closeContextMenu}
          onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
        />
      )}

      {/* ファイル/フォルダ行 */}
      {renaming ? (
        <div style={{ paddingLeft: indent + 8, paddingRight: 8, marginBottom: 1 }}>
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            style={inputStyle}
            autoFocus
          />
        </div>
      ) : (
        <div
          onClick={() => {
            if (node.is_dir) setExpanded((x) => !x);
            else openNote(node.path);
          }}
          onContextMenu={handleContextMenu}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            paddingLeft: indent + 4,
            paddingRight: 8,
            paddingTop: 3,
            paddingBottom: 3,
            cursor: "pointer",
            borderRadius: 4,
            margin: "1px 4px",
            background: isActive ? "var(--bg-surface0)" : "transparent",
            color: isActive ? "var(--text)" : "var(--subtext1)",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            if (!isActive)
              (e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface0)";
          }}
          onMouseLeave={(e) => {
            if (!isActive)
              (e.currentTarget as HTMLDivElement).style.background = "transparent";
          }}
        >
          {/* アイコン */}
          <span style={{ fontSize: 13, flexShrink: 0 }}>
            {node.is_dir ? (expanded ? "▾" : "▸") : ""}
          </span>
          <span style={{ fontSize: 12, flexShrink: 0 }}>
            {node.is_dir ? "📁" : "📄"}
          </span>
          {/* ファイル名 */}
          <span
            style={{
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {node.is_dir ? node.name : stem(node.path)}
          </span>
        </div>
      )}

      {/* コンテキストメニュー */}
      {contextMenu?.visible && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {node.is_dir && (
            <>
              <button onClick={() => startCreate("note")}>新規ノート</button>
              <button onClick={() => startCreate("folder")}>新規フォルダ</button>
              <div className="separator" />
            </>
          )}
          <button onClick={startRename}>名前を変更</button>
          <div className="separator" />
          <button
            className="danger"
            onClick={() => {
              closeContextMenu();
              const label = node.is_dir ? `フォルダ「${node.name}」` : `「${stem(node.path)}」`;
              if (window.confirm(`${label} を削除しますか？`)) {
                deleteItem(node.path);
              }
            }}
          >
            削除
          </button>
        </div>
      )}

      {/* フォルダの子ノード */}
      {node.is_dir && expanded && (
        <div>
          {creating && (
            <CreateInput
              type={creating}
              value={createValue}
              onChange={setCreateValue}
              onCommit={commitCreate}
              onCancel={() => setCreating(null)}
              ref={createInputRef}
              depth={depth + 1}
            />
          )}
          {node.children.map((child) => (
            <FileTree key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 小コンポーネント ──────────────────────────────────────────────

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        background: "none",
        border: "none",
        color: "var(--subtext0)",
        cursor: "pointer",
        fontSize: 14,
        padding: "2px 4px",
        borderRadius: 4,
        lineHeight: 1,
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.color = "var(--text)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.color = "var(--subtext0)")
      }
    >
      {children}
    </button>
  );
}

import { forwardRef } from "react";

const CreateInput = forwardRef<
  HTMLInputElement,
  {
    type: "note" | "folder";
    value: string;
    onChange: (v: string) => void;
    onCommit: () => void;
    onCancel: () => void;
    depth: number;
  }
>(({ type, value, onChange, onCommit, onCancel, depth }, ref) => (
  <div style={{ paddingLeft: depth * 14 + 8, paddingRight: 8, marginBottom: 2, marginTop: 1 }}>
    <input
      ref={ref}
      placeholder={type === "note" ? "ノート名..." : "フォルダ名..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit();
        if (e.key === "Escape") onCancel();
      }}
      style={inputStyle}
      autoFocus
    />
  </div>
));

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-surface0)",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  color: "var(--text)",
  fontSize: 13,
  padding: "3px 7px",
  outline: "none",
};
