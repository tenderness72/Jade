import { useAppStore } from "../../store/useAppStore";

export function TabBar() {
  const tabs        = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab    = useAppStore((s) => s.closeTab);
  const toggleSplit = useAppStore((s) => s.toggleSplit);
  const saveNote    = useAppStore((s) => s.saveNote);

  if (tabs.length === 0) return null;

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isSplit   = activeTab?.viewMode === 'split';

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "var(--bg-mantle)",
        borderBottom: "1px solid var(--border)",
        minHeight: 34,
        overflowX: "auto",
        overflowY: "hidden",
        flexShrink: 0,
      }}
    >
      {/* タブ一覧 */}
      <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "0 10px",
                height: 34,
                cursor: "pointer",
                fontSize: 13,
                whiteSpace: "nowrap",
                borderRight: "1px solid var(--border)",
                background: isActive ? "var(--bg-base)" : "transparent",
                color: isActive ? "var(--text)" : "var(--subtext0)",
                borderBottom: isActive
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                userSelect: "none",
              }}
            >
              {/* 未保存インジケータ */}
              {tab.isDirty && (
                <span style={{ color: "var(--yellow)", fontSize: 7, lineHeight: 1 }}>●</span>
              )}
              <span>{tab.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    tab.isDirty &&
                    !window.confirm(`"${tab.name}" に未保存の変更があります。閉じますか？`)
                  ) return;
                  closeTab(tab.id);
                }}
                style={{
                  marginLeft: 2,
                  background: "none",
                  border: "none",
                  color: "var(--overlay1)",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: "0 2px",
                  borderRadius: 2,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--overlay1)")}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* 右側ツールボタン */}
      {activeTab && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 6px", flexShrink: 0 }}>
          {/* 分割プレビュー切り替え */}
          <ToolBtn
            title={isSplit ? "エディタのみ (Ctrl+P)" : "分割プレビュー (Ctrl+P)"}
            active={isSplit}
            onClick={() => toggleSplit(activeTab.id)}
          >
            {/* 縦分割アイコン */}
            <SplitIcon active={isSplit} />
          </ToolBtn>

          {/* 保存 */}
          <ToolBtn
            title="保存 (Ctrl+S)"
            active={false}
            disabled={!activeTab.isDirty}
            onClick={() => saveNote(activeTab.id)}
          >
            <SaveIcon />
          </ToolBtn>
        </div>
      )}
    </div>
  );
}

// ─── アイコンコンポーネント ────────────────────────────────────────

function SplitIcon({ active }: { active: boolean }) {
  const c = active ? "var(--accent)" : "currentColor";
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="2" width="5.5" height="11" rx="1" stroke={c} strokeWidth="1.2" />
      <rect x="8.5" y="2" width="5.5" height="11" rx="1" stroke={c} strokeWidth="1.2" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 2h7.5L12 4.5V12H2V2z" stroke="currentColor" strokeWidth="1.2" />
      <rect x="4" y="8.5" width="6" height="3" rx=".5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="4" y="2" width="4" height="2.5" rx=".5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function ToolBtn({
  children, onClick, title, active, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        background: active ? "rgba(129,162,190,.18)" : "none",
        border: "none",
        color: disabled ? "var(--bg-surface2)" : active ? "var(--accent)" : "var(--subtext0)",
        cursor: disabled ? "default" : "pointer",
        padding: "4px 6px",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "rgba(255,255,255,.07)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? "rgba(129,162,190,.18)" : "none"; }}
    >
      {children}
    </button>
  );
}
