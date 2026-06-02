import { useEffect, useRef, useCallback } from "react";
import { basicSetup } from "codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { useAppStore } from "../../store/useAppStore";
import { wikilinkHighlighter, wikilinkClickHandler } from "./wikilinkExtension";

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

// ─── Atom Dark 256 テーマ ──────────────────────────────────────────

const atomDarkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "#c5c8c6",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: "1px solid #373b41",
      color: "#707880",
    },
    ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,.04)" },
    ".cm-activeLine":        { backgroundColor: "rgba(255,255,255,.05)" },
    ".cm-cursor":            { borderLeftColor: "#81a2be" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(129,162,190,.25) !important",
    },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(129,162,190,.2)",
      outline: "1px solid #81a2be44",
    },
    ".cm-searchMatch": { backgroundColor: "rgba(129,162,190,.3)" },
    ".cm-tooltip": { backgroundColor: "#282a2e", border: "1px solid #373b41" },
    ".cm-completionLabel": { color: "#c5c8c6" },
  },
  { dark: true }
);

// Atom Dark 256 シンタックスカラー
const atomDarkHighlight = HighlightStyle.define([
  { tag: tags.keyword,             color: "#b294bb" },
  { tag: tags.operator,            color: "#b294bb" },
  { tag: tags.string,              color: "#b5bd68" },
  { tag: tags.regexp,              color: "#b5bd68" },
  { tag: tags.number,              color: "#de935f" },
  { tag: tags.bool,                color: "#de935f" },
  { tag: tags.null,                color: "#de935f" },
  { tag: tags.comment,             color: "#707880", fontStyle: "italic" },
  { tag: tags.lineComment,         color: "#707880", fontStyle: "italic" },
  { tag: tags.blockComment,        color: "#707880", fontStyle: "italic" },
  { tag: tags.variableName,        color: "#c5c8c6" },
  { tag: tags.function(tags.variableName), color: "#81a2be" },
  { tag: tags.typeName,            color: "#f0c674" },
  { tag: tags.className,           color: "#f0c674" },
  { tag: tags.propertyName,        color: "#81a2be" },
  { tag: tags.attributeName,       color: "#f0c674" },
  { tag: tags.attributeValue,      color: "#b5bd68" },
  { tag: tags.tagName,             color: "#cc6666" },
  { tag: tags.punctuation,         color: "#969896" },
  { tag: tags.angleBracket,        color: "#969896" },
  { tag: tags.meta,                color: "#8abeb7" },
  { tag: tags.link,                color: "#81a2be", textDecoration: "underline" },
  { tag: tags.url,                 color: "#8abeb7" },
  // Markdown 見出し
  { tag: tags.heading1,            color: "#cc6666", fontWeight: "700" },
  { tag: tags.heading2,            color: "#de935f", fontWeight: "700" },
  { tag: tags.heading3,            color: "#f0c674", fontWeight: "600" },
  { tag: tags.heading,             color: "#b5bd68", fontWeight: "600" },
  // Markdown 強調
  { tag: tags.strong,              color: "#c5c8c6", fontWeight: "700" },
  { tag: tags.emphasis,            color: "#c5c8c6", fontStyle: "italic" },
  { tag: tags.strikethrough,       color: "#707880", textDecoration: "line-through" },
  // コード
  { tag: tags.monospace,           color: "#8abeb7", fontFamily: "'JetBrains Mono','Fira Code',monospace" },
  { tag: tags.processingInstruction, color: "#b294bb" },
  { tag: tags.definition(tags.variableName), color: "#81a2be" },
  { tag: tags.special(tags.string), color: "#8abeb7" },
]);

// ─── Markdownレンダラー ─────────────────────────────────────────────

async function renderMarkdown(content: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(content);
  let html = String(result);
  html = html.replace(/\[\[([^\[\]]+)\]\]/g, (_, inner) => {
    const pipeIdx = inner.indexOf("|");
    const noteName    = pipeIdx >= 0 ? inner.slice(0, pipeIdx)   : inner;
    const displayName = pipeIdx >= 0 ? inner.slice(pipeIdx + 1)  : inner;
    return `<span class="wikilink" data-note="${noteName}">${displayName}</span>`;
  });
  return html;
}

// ─── コンポーネント ────────────────────────────────────────────────

const AUTO_SAVE_DELAY    = 1500;
const PREVIEW_DEBOUNCE   = 250;

export function MarkdownEditor() {
  const activeTabId   = useAppStore((s) => s.activeTabId);
  const tabs          = useAppStore((s) => s.tabs);
  const updateContent = useAppStore((s) => s.updateContent);
  const saveNote      = useAppStore((s) => s.saveNote);
  const toggleSplit   = useAppStore((s) => s.toggleSplit);
  const openWikiLink  = useAppStore((s) => s.openWikiLink);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const isSplit   = activeTab?.viewMode === 'split';

  const editorRef           = useRef<HTMLDivElement>(null);
  const viewRef             = useRef<EditorView | null>(null);
  const tabIdRef            = useRef<string | null>(null);
  const saveTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRef          = useRef<HTMLDivElement>(null);
  const previewTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  // プログラムによるコンテンツ書き込み中は true → updateListener が isDirty を立てないよう抑制
  const isLoadingContentRef = useRef(false);

  // ── CodeMirror 初期化（editorRef div は常時 DOM に存在）──────────

  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: "",
        extensions: [
          basicSetup,
          markdown(),
          atomDarkTheme,
          syntaxHighlighting(atomDarkHighlight),
          EditorView.lineWrapping,
          wikilinkHighlighter,
          wikilinkClickHandler((noteName) => openWikiLink(noteName)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            // プログラムによるコンテンツ読み込み時は isDirty を立てない
            if (isLoadingContentRef.current) {
              isLoadingContentRef.current = false;
              return;
            }
            const newContent = update.state.doc.toString();
            const tid = tabIdRef.current;
            if (!tid) return;
            updateContent(tid, newContent);
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => saveNote(tid), AUTO_SAVE_DELAY);
          }),
        ],
      }),
      parent: editorRef.current,
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
      if (saveTimerRef.current)  clearTimeout(saveTimerRef.current);
      if (previewTimer.current)  clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── タブ切り替え時にエディタ内容を更新 ──────────────────────────

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !activeTab) { tabIdRef.current = null; return; }

    if (tabIdRef.current !== activeTab.id) {
      tabIdRef.current = activeTab.id;
      const currentDoc = view.state.doc.toString();
      if (currentDoc !== activeTab.content) {
        // フラグを先に立てる（dispatch は同期でリスナーを呼ぶため）
        isLoadingContentRef.current = true;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: activeTab.content },
        });
      }
      view.focus();
    }
  }, [activeTab?.id, activeTab?.content]);

  // ── 分割プレビュー更新（デバウンス付き）──────────────────────────

  useEffect(() => {
    if (!isSplit || !previewRef.current) return;
    const content = activeTab?.content ?? "";

    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      const html = await renderMarkdown(content);
      if (previewRef.current) previewRef.current.innerHTML = html;
    }, PREVIEW_DEBOUNCE);
  }, [isSplit, activeTab?.content]);

  // ── プレビュー内 Wikiリンク ──────────────────────────────────────

  const handlePreviewClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const t = e.target as HTMLElement;
      if (t.classList.contains("wikilink") && t.dataset.note) {
        openWikiLink(t.dataset.note);
      }
    },
    [openWikiLink]
  );

  // ── キーボードショートカット ────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activeTabId) saveNote(activeTabId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        if (activeTabId) toggleSplit(activeTabId);
      }
    },
    [activeTabId, saveNote, toggleSplit]
  );

  // ── レンダリング ────────────────────────────────────────────────

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg-base)",
        position: "relative",
      }}
      onKeyDown={handleKeyDown}
    >
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── エディタペイン（常時存在）────────────────────────── */}
        <div
          ref={editorRef}
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            borderRight: isSplit ? "1px solid var(--border)" : "none",
          }}
        />

        {/* ── プレビューペイン（分割時のみ表示）──────────────── */}
        <div
          ref={previewRef}
          className="markdown-preview"
          style={{
            flex: isSplit ? 1 : 0,
            width: isSplit ? undefined : 0,
            overflow: isSplit ? "auto" : "hidden",
            padding: isSplit ? undefined : 0,
            display: isSplit ? "block" : "none",
            borderLeft: "none",
          }}
          onClick={handlePreviewClick}
        />
      </div>

      {/* ── ノート未選択のオーバーレイ ──────────────────────── */}
      {!activeTab && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--overlay1)",
            fontSize: 13,
            gap: 10,
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 36, opacity: 0.2 }}>◈</span>
          <span>ノートを選択するか、新規作成してください</span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>Ctrl+P で分割プレビュー</span>
        </div>
      )}
    </div>
  );
}
