import React, { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";   // ✅ Monaco editor
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Inspector, ObjectLabel } from "react-inspector";
import "./App.css"; // ✅ import your CSS file

// Custom label with preview (for objects/arrays)
function CustomObjectLabel({ name, data, isNonenumerable }) {
  if (Array.isArray(data)) {
    const preview = data.slice(0, 5).map(v => JSON.stringify(v)).join(", ");
    const more = data.length > 5 ? ", ..." : "";
    return (
      <span>
        ({data.length}) [{preview}{more}]
      </span>
    );
  } else if (data && typeof data === "object") {
    const entries = Object.entries(data).slice(0, 3);
    const preview = entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ");
    const more = Object.keys(data).length > 3 ? ", ..." : "";
    return (
      <span>
        ({Object.keys(data).length}) {"{"}{preview}{more}{"}"}
      </span>
    );
  }
  return <ObjectLabel name={name} data={data} isNonenumerable={isNonenumerable} />;
}

export default function App() {
  const [code, setCode] = useState(`// Try JS here
console.log("hello worlds")
const test = { name: "sam", age: 33 }
console.log(test)
console.log([1,2,4])
cons
`);
  const [logs, setLogs] = useState([]);
  const iframeRef = useRef(null);

  // Run code when it changes
  useEffect(() => {
    if (iframeRef.current) {
      setLogs([]);
      iframeRef.current.contentWindow.postMessage({ code }, "*");
    }
  }, [code]);

  // Listen for messages from sandbox
  useEffect(() => {
    function onMessage(e) {
      const data = e.data || {};
      if (data.type === "console_log") {
        setLogs((prev) => [...prev, { type: "log", args: data.payload }]);
      } else if (data.type === "console_error") {
        setLogs((prev) => [...prev, { type: "error", args: [data.payload.message, data.payload.stack] }]);
      } else if (data.type === "console_clear") {
        setLogs([{ type: "clear" }]);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // sandboxed iframe doc
  const iframeSrcDoc = `
<!doctype html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      (function(){
        function send(type, payload){ parent.postMessage({ type, payload }, '*') }

        // patch console.log
        console.log = function(...args){
          try { parent.postMessage({ type: 'console_log', payload: args }, '*') } catch(e){}
        }

        // patch console.error
        console.error = function(err){
          try { parent.postMessage({ type: 'console_error', payload: { message: err.toString(), stack: err.stack } }, '*') } catch(e){}
        }

        // patch console.clear
        console.clear = function(){
          try { parent.postMessage({ type: 'console_clear' }, '*') } catch(e){}
        }

        window.addEventListener('message', function(e){
          const code = e.data && e.data.code;
          if (typeof code !== 'string') return;
          try {
            const runner = new Function(code + "\\n//# sourceURL=playcode.js");
            runner();
          } catch (err) {
            console.error(err);
          }
        })
      })()
    </script>
  </body>
</html>`;

  return (
    <div className="app-root">
      {/* Header */}
      <header className="header">⚡Javascript-Light</header>

      <PanelGroup direction="horizontal" className="panel-group">
        {/* Editor */}
        <Panel defaultSize={55} minSize={25}>
          <div className="editor-pane">
            <div className="title">Editor</div>
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? "")}
              beforeMount={(monaco) => {
                // Enable richer JS intellisense
                monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                  target: monaco.languages.typescript.ScriptTarget.ESNext,
                  allowNonTsExtensions: true,
                });

                // Add console snippets
                monaco.languages.registerCompletionItemProvider("javascript", {
                  provideCompletionItems: () => ({
                    suggestions: [
                      {
                        label: "clg",
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "console.log(${1:object})",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: "Log output to console",
                      },
                      {
                        label: "clog",
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "console.log(${1:object})",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: "Log output to console",
                      },
                    ],
                  }),
                });
              }}
            />
          </div>
        </Panel>

        {/* Resize handle */}
        <PanelResizeHandle className="resize-handle" />

        {/* Console */}
        <Panel minSize={25}>
          <div className="console-pane">
            {/* Console Header */}
            <div className="console-header">
              <span>Console</span>
              <button onClick={() => setLogs([])}>×</button>
            </div>

            {/* Console Body */}
            <div className="console-body">
              {logs.map((log, i) => (
                <div key={i}>
                  {log.type === "clear" ? (
                    <span className="log-clear">Console was cleared</span>
                  ) : log.type === "error" ? (
                    <div className="log-error">
                      {log.args[0]}
                      {log.args[1] && (
                        <div className="log-error-details">{log.args[1]}</div>
                      )}
                    </div>
                  ) : (
                    <div className="log-line">
                      {log.args.map((a, j) => {
                        if (typeof a === "string")
                          return <span key={j} className="log-string">{a}</span>;
                        if (typeof a === "number")
                          return <span key={j} className="log-number">{a}</span>;
                        if (typeof a === "boolean")
                          return <span key={j} className={a ? "log-boolean-true" : "log-boolean-false"}>
                            {String(a)}
                          </span>;
                        return (
                          <Inspector
                            key={j}
                            data={a}
                            expandLevel={0}
                            objectLabelRenderer={(props) => <CustomObjectLabel {...props} />}
                            theme={{
                              BASE_FONT_SIZE: "13px",
                              TREENODE_FONT_FAMILY: "monospace",
                              BASE_BACKGROUND_COLOR: "transparent",
                              TREENODE_BACKGROUND_COLOR: "transparent",
                              ARROW_COLOR: "#9ca3af",
                              BASE_COLOR: "#e5e7eb",
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </PanelGroup>

      {/* Hidden iframe sandbox */}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        srcDoc={iframeSrcDoc}
        style={{ display: "none" }}
      />
    </div>
  );
}
