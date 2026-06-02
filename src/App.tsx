import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "./store/useAppStore";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TabBar } from "./components/Editor/TabBar";
import { MarkdownEditor } from "./components/Editor/MarkdownEditor";
import { RightPanel } from "./components/RightPanel/RightPanel";
import { WelcomeScreen } from "./components/WelcomeScreen";

export default function App() {
  const vaultPath            = useAppStore((s) => s.vaultPath);
  const statusMessage        = useAppStore((s) => s.statusMessage);
  const openVault            = useAppStore((s) => s.openVault);
  const restoreLastVault     = useAppStore((s) => s.restoreLastVault);
  const closeConfirmVisible  = useAppStore((s) => s.closeConfirmVisible);

  // ── 起動時: 前回のVaultを自動復元 ──────────────────────────────────
  useEffect(() => {
    restoreLastVault();
  }, []);

  // ── ウィンドウ閉じる処理 ─────────────────────────────────────────
  // Rust の on_window_event で CloseRequested を常に prevent し、
  // "jade://close-requested" カスタムイベントをここで受け取る。
  // JS の onCloseRequested は不安定なので使わない。
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cleaned = false;

    listen<null>("jade://close-requested", () => {
      const dirty = useAppStore.getState().tabs.filter((t) => t.isDirty);
      if (dirty.length === 0) {
        invoke("force_close"); // 未保存なし → Rust 経由で app.exit(0)
      } else {
        useAppStore.getState().setCloseConfirmVisible(true); // モーダル表示
      }
    }).then((fn) => {
      if (cleaned) fn();
      else unlisten = fn;
    });

    return () => {
      cleaned = true;
      unlisten?.();
    };
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "36px 1fr 24px",
        gridTemplateColumns: "240px 1fr 220px",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* ── タイトルバー ─────────────────────────────────────── */}
      <div
        data-tauri-drag-region
        style={{
          gridColumn: "1 / -1",
          gridRow: 1,
          background: "var(--bg-crust)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 10,
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--green)", letterSpacing: "0.05em" }}>
          💎 Jade
        </span>
        {vaultPath && (
          <>
            <span style={{ color: "var(--border)" }}>│</span>
            <span
              style={{
                fontSize: 12,
                color: "var(--subtext0)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
              title={vaultPath}
            >
              {vaultPath.replace(/\\/g, "/").split("/").pop()}
            </span>
          </>
        )}
        <button
          onClick={openVault}
          title="別のVaultを開く"
          style={{
            marginLeft: "auto",
            background: "none",
            border: "1px solid var(--border)",
            color: "var(--subtext0)",
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 4,
            cursor: "pointer",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)")
          }
        >
          📂 Vault
        </button>
      </div>

      {/* ── 左サイドバー ─────────────────────────────────────── */}
      <div style={{ gridColumn: 1, gridRow: 2, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Sidebar />
      </div>

      {/* ── 中央エディタ ─────────────────────────────────────── */}
      <div
        style={{
          gridColumn: 2,
          gridRow: 2,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid var(--border)",
        }}
      >
        {vaultPath ? (
          <>
            <TabBar />
            <MarkdownEditor />
          </>
        ) : (
          <WelcomeScreen />
        )}
      </div>

      {/* ── 右パネル ─────────────────────────────────────────── */}
      <div style={{ gridColumn: 3, gridRow: 2, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <RightPanel />
      </div>

      {/* ── ステータスバー ────────────────────────────────────── */}
      <div
        style={{
          gridColumn: "1 / -1",
          gridRow: 3,
          background: "var(--bg-crust)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          fontSize: 11,
          color: "var(--subtext0)",
        }}
      >
        {statusMessage ? (
          <span style={{ color: "var(--accent)" }}>{statusMessage}</span>
        ) : (
          <span>{vaultPath ? `Vault: ${vaultPath}` : "Vault が開かれていません"}</span>
        )}
      </div>

      {/* ── 終了確認モーダル ──────────────────────────────────── */}
      {closeConfirmVisible && <CloseConfirmDialog />}
    </div>
  );
}

// ─── 終了確認モーダル ──────────────────────────────────────────────

function CloseConfirmDialog() {
  const tabs                 = useAppStore((s) => s.tabs);
  const setVisible           = useAppStore((s) => s.setCloseConfirmVisible);
  const saveAll              = useAppStore((s) => s.saveAll);

  const dirtyTabs = tabs.filter((t) => t.isDirty);

  const handleSaveAndClose = async () => {
    setVisible(false);
    await saveAll();
    await invoke("force_close"); // Rust 経由で app.exit(0)
  };

  const handleCancel = () => setVisible(false);

  return (
    // オーバーレイ
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      {/* ダイアログ本体 */}
      <div
        style={{
          background: "var(--bg-surface0)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "24px 28px",
          minWidth: 320,
          maxWidth: 420,
          boxShadow: "0 16px 48px rgba(0,0,0,.6)",
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
          未保存の変更があります
        </h3>

        <ul style={{ marginBottom: 18, paddingLeft: 18 }}>
          {dirtyTabs.map((t) => (
            <li key={t.id} style={{ fontSize: 13, color: "var(--yellow)", marginBottom: 3 }}>
              {t.name}
            </li>
          ))}
        </ul>

        <p style={{ fontSize: 12, color: "var(--subtext0)", marginBottom: 20 }}>
          保存して終了しますか？
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {/* キャンセル */}
          <button
            onClick={handleCancel}
            style={{
              padding: "7px 18px",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 5,
              color: "var(--subtext0)",
              cursor: "pointer",
              fontSize: 13,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            キャンセル
          </button>

          {/* 保存して終了 */}
          <button
            onClick={handleSaveAndClose}
            style={{
              padding: "7px 18px",
              background: "var(--accent)",
              border: "none",
              borderRadius: 5,
              color: "#1d1f21",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            保存して終了
          </button>
        </div>
      </div>
    </div>
  );
}
