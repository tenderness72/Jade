import { useAppStore } from "../store/useAppStore";

export function WelcomeScreen() {
  const openVault = useAppStore((s) => s.openVault);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
        gap: 24,
        userSelect: "none",
      }}
    >
      {/* ロゴ */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 64,
            marginBottom: 8,
            filter: "drop-shadow(0 0 24px rgba(166,227,161,.4))",
          }}
        >
          💎
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.02em",
          }}
        >
          Jade
        </h1>
        <p style={{ color: "var(--subtext0)", fontSize: 14, marginTop: 4 }}>
          軽量知識管理アプリ
        </p>
      </div>

      {/* Vault選択ボタン */}
      <button
        onClick={openVault}
        style={{
          padding: "12px 28px",
          background: "var(--accent)",
          color: "#1e1e2e",
          border: "none",
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          transition: "opacity .15s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.opacity = "1")
        }
      >
        📂 Vaultを開く
      </button>

      {/* ヒント */}
      <div
        style={{
          color: "var(--overlay1)",
          fontSize: 12,
          textAlign: "center",
          lineHeight: 1.8,
          maxWidth: 340,
        }}
      >
        <p>Markdownフォルダをそのまま知識ベースとして使えます。</p>
        <p>Nextcloudの同期フォルダも直接Vaultとして開けます。</p>
      </div>

      {/* ショートカット案内 */}
      <div
        style={{
          background: "var(--bg-mantle)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "12px 20px",
          fontSize: 12,
          color: "var(--subtext0)",
          lineHeight: 2,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0 20px" }}>
          <Shortcut keys="Ctrl+S" desc="保存" />
          <Shortcut keys="Ctrl+P" desc="プレビュー切り替え" />
          <Shortcut keys="[[ノート名]]" desc="Wikiリンク" />
          <Shortcut keys="#タグ名" desc="タグ" />
        </div>
      </div>
    </div>
  );
}

function Shortcut({ keys, desc }: { keys: string; desc: string }) {
  return (
    <>
      <kbd
        style={{
          background: "var(--bg-surface0)",
          color: "var(--accent)",
          padding: "1px 6px",
          borderRadius: 4,
          fontFamily: "monospace",
          fontSize: 11,
          whiteSpace: "nowrap",
        }}
      >
        {keys}
      </kbd>
      <span>{desc}</span>
    </>
  );
}
