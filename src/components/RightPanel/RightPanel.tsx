import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../store/useAppStore";

export function RightPanel() {
  const backlinks = useAppStore((s) => s.backlinks);
  const tags = useAppStore((s) => s.tags);
  const openNote = useAppStore((s) => s.openNote);
  const search = useAppStore((s) => s.search);
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const vaultPath = useAppStore((s) => s.vaultPath);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-mantle)",
        borderLeft: "1px solid var(--border)",
        overflow: "hidden",
        fontSize: 13,
      }}
    >
      {/* ── バックリンク ─────────────────────────────────────────── */}
      <Section title={`バックリンク (${backlinks.length})`}>
        {backlinks.length === 0 ? (
          <EmptyMsg>このノートへのリンクはありません</EmptyMsg>
        ) : (
          <div>
            {backlinks.map((name) => (
              <LinkItem
                key={name}
                label={name}
                onClick={async () => {
                  if (!vaultPath) return;
                  const path = await invoke<string | null>("resolve_note_path", {
                    vaultPath,
                    noteName: name,
                  });
                  if (path) openNote(path);
                }}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ── タグ ──────────────────────────────────────────────────── */}
      <Section title={`タグ (${tags.length})`}>
        {tags.length === 0 ? (
          <EmptyMsg>タグがありません</EmptyMsg>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 2px" }}>
            {tags.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                onClick={() => search(`#${tag}`)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ── ノート情報 ────────────────────────────────────────────── */}
      {activeTab && (
        <Section title="ノート情報">
          <InfoRow label="文字数">
            {activeTab.content.length.toLocaleString()}
          </InfoRow>
          <InfoRow label="行数">
            {activeTab.content.split("\n").length.toLocaleString()}
          </InfoRow>
          <InfoRow label="状態">
            {activeTab.isDirty ? (
              <span style={{ color: "var(--yellow)" }}>未保存</span>
            ) : (
              <span style={{ color: "var(--green)" }}>保存済み</span>
            )}
          </InfoRow>
        </Section>
      )}
    </div>
  );
}

// ─── 小コンポーネント ──────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
      <div
        style={{
          padding: "8px 12px 4px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--subtext0)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </div>
      <div style={{ padding: "4px 8px 10px" }}>{children}</div>
    </div>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "var(--overlay1)", fontSize: 12, padding: "2px 4px" }}>
      {children}
    </div>
  );
}

function LinkItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "4px 8px",
        borderRadius: 4,
        cursor: "pointer",
        color: "var(--accent)",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface0)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "transparent")
      }
    >
      <span style={{ fontSize: 11 }}>←</span>
      <span>{label}</span>
    </div>
  );
}

function TagChip({ tag, onClick }: { tag: string; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      title={`#${tag} で検索`}
      style={{
        display: "inline-block",
        background: "var(--bg-surface0)",
        color: "var(--green)",
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 10,
        cursor: "pointer",
        userSelect: "none",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLSpanElement).style.background = "var(--bg-surface1)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLSpanElement).style.background = "var(--bg-surface0)")
      }
    >
      #{tag}
    </span>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "3px 4px",
        fontSize: 12,
      }}
    >
      <span style={{ color: "var(--subtext0)" }}>{label}</span>
      <span style={{ color: "var(--text)" }}>{children}</span>
    </div>
  );
}
