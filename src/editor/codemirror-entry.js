import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentSelection } from "@codemirror/commands";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { lintGutter, linter } from "@codemirror/lint";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const editableTheme = EditorView.theme({
  "&": {
    height: "100%",
    minHeight: "260px",
    border: "1px solid rgba(103, 232, 249, .24)",
    borderRadius: "3px",
    overflow: "hidden",
    backgroundColor: "#071018",
    color: "#e8fbff",
    fontSize: "12px"
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
  },
  ".cm-content": {
    padding: "10px 0"
  },
  ".cm-gutters": {
    backgroundColor: "#0b1420",
    color: "#6f8491",
    borderRight: "1px solid rgba(103, 232, 249, .22)"
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(103, 232, 249, .08)"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(103, 232, 249, .10)",
    color: "#e8fbff"
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(103, 232, 249, .25) !important"
  },
  ".cm-cursor": {
    borderLeftColor: "#bef264"
  },
  ".cm-tooltip": {
    backgroundColor: "#0b1420",
    border: "1px solid rgba(103, 232, 249, .32)",
    color: "#e8fbff"
  }
});

const syntaxTheme = HighlightStyle.define([
  { tag: tags.string, color: "#bef264" },
  { tag: tags.number, color: "#facc15" },
  { tag: tags.bool, color: "#facc15" },
  { tag: tags.null, color: "#facc15" },
  { tag: tags.propertyName, color: "#67e8f9" },
  { tag: tags.punctuation, color: "#9ab0bd" },
  { tag: tags.invalid, color: "#fb7185" },
  { tag: tags.keyword, color: "#f472b6" },
  { tag: tags.controlKeyword, color: "#f472b6" },
  { tag: tags.operatorKeyword, color: "#f472b6" },
  { tag: tags.comment, color: "#6f8491", fontStyle: "italic" },
  { tag: tags.lineComment, color: "#6f8491", fontStyle: "italic" },
  { tag: tags.blockComment, color: "#6f8491", fontStyle: "italic" },
  { tag: tags.variableName, color: "#e8fbff" },
  { tag: tags.definition(tags.variableName), color: "#e8fbff" },
  { tag: tags.function(tags.variableName), color: "#67e8f9" },
  { tag: tags.function(tags.propertyName), color: "#67e8f9" },
  { tag: tags.operator, color: "#9ab0bd" },
  { tag: tags.typeName, color: "#facc15" },
  { tag: tags.className, color: "#facc15" },
  { tag: tags.regexp, color: "#bef264" }
]);

function languageExtension(language) {
  if (language === "javascript") return [javascript()];
  return [json(), linter(jsonParseLinter())];
}

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
  syntaxHighlighting(syntaxTheme),
  editableTheme
];

window.RequestMockLiteEditor = {
  create(options) {
    const languageConf = new Compartment();
    const extensions = [
      ...baseExtensions,
      languageConf.of(languageExtension(options.language || "json")),
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
      setLanguage(language) {
        view.dispatch({
          effects: languageConf.reconfigure(languageExtension(language))
        });
      },
      format() {
        const end = view.state.doc.length;
        view.dispatch({ selection: { anchor: 0, head: end } });
        indentSelection(view);
        const caret = view.state.selection.main.head;
        view.dispatch({ selection: { anchor: caret, head: caret } });
        view.focus();
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
