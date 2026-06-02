import { useState, useEffect, useRef } from "react";
import { FileTree } from "./FileTree";
import { useAppStore } from "../../store/useAppStore";
import type { SearchResult } from "../../types";

type SidebarTab = "files" | "search";

export function Sidebar() {
  const fileTree = useAppStore((s) => s.fileTree);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const search = useAppStore((s) => s.search);
  const clearSearch = useAppStore((s) => s.clearSearch);
  const searchResults = useAppStore((s) => s.searchResults);
  const isSearching = useAppStore((s) => s.isSearching);
  const openNote = useAppStore((s) => s.openNote);

  const [tab, setTab] = useState<SidebarTab>("files");
  const [localQuery, setLocalQuery] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // インクリメンタル検索
  const handleSearchChange = (q: string) => {
    setLocalQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim()) {
      clearSearch();
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      search(q);
    }, 300);
  };

  useEffect(() => {
    if (tab === "search") {
      setTimeout(() => document.getElementById("jade-search")?.focus(), 50);
    }
  }, [tab]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-mantle)",
        borderRight: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      {/* タブ切り替え */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <SideTabBtn active={tab === "files"} onClick={() => setTab("files")}>
          📁 ファイル
        </SideTabBtn>
        <SideTabBtn active={tab === "search"} onClick={() => setTab("search")}>
          🔍 検索
        </SideTabBtn>
      </div>

      {/* ファイルツリー */}
      {tab === "files" && (
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {fileTree ? (
            <FileTree node={fileTree} depth={0} />
          ) : (
            <div
              style={{
                padding: 16,
                color: "var(--overlay1)",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              Vault を開いてください
            </div>
          )}
        </div>
      )}

      {/* 検索 */}
      {tab === "search" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* 検索ボックス */}
          <div style={{ padding: "8px", flexShrink: 0 }}>
            <input
              id="jade-search"
              placeholder="ノートを検索..."
              value={localQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: "100%",
                background: "var(--bg-surface0)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
                fontSize: 13,
                padding: "6px 10px",
                outline: "none",
              }}
              onFocus={(e) =>
                ((e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)")
              }
              onBlur={(e) =>
                ((e.currentTarget as HTMLInputElement).style.borderColor = "var(--border)")
              }
              disabled={!vaultPath}
            />
          </div>

          {/* 検索結果 */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 4px" }}>
            {isSearching && (
              <div style={{ padding: 12, color: "var(--subtext0)", fontSize: 12, textAlign: "center" }}>
                検索中...
              </div>
            )}
            {!isSearching && localQuery && searchResults.length === 0 && (
              <div style={{ padding: 12, color: "var(--overlay1)", fontSize: 12, textAlign: "center" }}>
                「{localQuery}」に一致するノートはありません
              </div>
            )}
            {searchResults.map((r) => (
              <SearchResultItem
                key={r.path}
                result={r}
                query={localQuery}
                onClick={() => openNote(r.path)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 検索結果アイテム ──────────────────────────────────────────────

function SearchResultItem({
  result,
  query,
  onClick,
}: {
  result: SearchResult;
  query: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "8px 8px",
        borderRadius: 5,
        cursor: "pointer",
        margin: "2px 0",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface0)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "transparent")
      }
    >
      <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
        <HighlightText text={result.name} query={query} />
      </div>
      {result.snippet && (
        <div
          style={{
            fontSize: 11,
            color: "var(--subtext0)",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <HighlightText text={result.snippet} query={query} />
        </div>
      )}
    </div>
  );
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            style={{
              background: "rgba(137,180,250,.3)",
              color: "var(--accent)",
              borderRadius: 2,
              padding: "0 1px",
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── サイドバータブボタン ──────────────────────────────────────────

function SideTabBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 4px",
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        color: active ? "var(--text)" : "var(--subtext0)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}
