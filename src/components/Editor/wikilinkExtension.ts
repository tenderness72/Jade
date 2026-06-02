import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const wikilinkMark = Decoration.mark({ class: "cm-wikilink" });

/** `[[...]]` パターンを検出してハイライトするCodeMirror拡張 */
export const wikilinkHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    const regex = /\[\[([^\[\]\n]+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      builder.add(start, end, wikilinkMark);
    }
  }
  return builder.finish();
}

/**
 * Wikiリンクのクリックを処理する拡張
 * クリックされたリンクの内部テキスト（`[[〇〇]]` の 〇〇）をコールバックに渡す
 */
export function wikilinkClickHandler(
  onLinkClick: (noteName: string) => void
): ReturnType<typeof EditorView.domEventHandlers> {
  return EditorView.domEventHandlers({
    click(event, view) {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;
      const line = view.state.doc.lineAt(pos);
      const lineText = line.text;
      const posInLine = pos - line.from;

      // クリック位置周辺のwikiリンクを探す
      const regex = /\[\[([^\[\]\n]+)\]\]/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (posInLine >= start && posInLine <= end) {
          // `[[alias|name]]` 形式のエイリアス対応
          const inner = match[1];
          const pipeIdx = inner.indexOf("|");
          const noteName = pipeIdx >= 0 ? inner.slice(0, pipeIdx) : inner;
          onLinkClick(noteName.trim());
          return true; // イベント消費
        }
      }
      return false;
    },
  });
}
