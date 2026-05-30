import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { lintGutter, linter } from "@codemirror/lint";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const editableTheme = EditorView.theme({
  "&": {
    height: "100%",
    minHeight: "260px",
    border: "1px solid #303640",
    borderRadius: "8px",
    overflow: "hidden",
    backgroundColor: "#111418",
    color: "#f4f0e8",
    fontSize: "12px"
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  },
  ".cm-content": {
    padding: "10px 0"
  },
  ".cm-gutters": {
    backgroundColor: "#15191e",
    color: "#65707c",
    borderRight: "1px solid #303640"
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(88, 196, 182, .08)"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(88, 196, 182, .10)",
    color: "#f4f0e8"
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(88, 196, 182, .25) !important"
  },
  ".cm-cursor": {
    borderLeftColor: "#58c4b6"
  },
  ".cm-tooltip": {
    backgroundColor: "#181b1f",
    border: "1px solid #303640",
    color: "#f4f0e8"
  }
});

const syntaxTheme = HighlightStyle.define([
  { tag: tags.string, color: "#8bd46f" },
  { tag: tags.number, color: "#f6be5f" },
  { tag: tags.bool, color: "#f6be5f" },
  { tag: tags.null, color: "#f6be5f" },
  { tag: tags.propertyName, color: "#58c4b6" },
  { tag: tags.punctuation, color: "#9da5af" },
  { tag: tags.invalid, color: "#ff6b6b" }
]);

const baseExtensions = [
  lineNumbers(),
  drawSelection(),
  highlightActiveLine(),
  EditorView.lineWrapping,
  history(),
  keymap.of([
    ...defaultKeymap,
    ...historyKeymap
  ]),
  lintGutter(),
  json(),
  linter(jsonParseLinter()),
  syntaxHighlighting(syntaxTheme),
  editableTheme
];

window.RequestMockLiteEditor = {
  create(options) {
    const extensions = [
      ...baseExtensions,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange?.(update.state.doc.toString());
      })
    ];
    const view = new EditorView({
      state: EditorState.create({
        doc: options.doc || "",
        extensions
      }),
      parent: options.parent
    });
    return {
      view,
      getValue() {
        return view.state.doc.toString();
      },
      setValue(value) {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: value || ""
          }
        });
      },
      focus() {
        view.focus();
      },
      destroy() {
        view.destroy();
      }
    };
  }
};
