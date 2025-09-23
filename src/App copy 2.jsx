import React, { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Inspector, ObjectLabel } from "react-inspector";


// Custom label with preview
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
    <div className="h-screen w-screen bg-[#071022] text-slate-200 font-sans">
      <header className="flex items-center gap-3 p-3 border-b border-slate-800 bg-[#0c1428] shadow-md">
        <div className="font-semibold text-lg">⚡ PlayCode Console Clone</div>
      </header>

      <PanelGroup direction="horizontal" className="h-[calc(100%-48px)]">
        {/* Editor */}
        <Panel defaultSize={55} minSize={25}>
          <div className="h-full flex flex-col border-r border-slate-800">
            <div className="p-2 text-xs text-slate-400 bg-[#0c1428]">Editor</div>
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? "")}
              options={{
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 15,
                wordWrap: "on",
              }}
            />
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-slate-700/30 hover:bg-slate-500 cursor-col-resize" />

        {/* Console */}
        <Panel minSize={25}>
          <div className="h-full flex flex-col">
            {/* Console Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-[#0c1428] text-xs">
              <span className="uppercase tracking-wider text-slate-400">Console</span>
              <button
                className="text-slate-500 hover:text-slate-300"
                onClick={() => setLogs([])}
              >
                ×
              </button>
            </div>

            {/* Console Body */}
            <div className="flex-1 overflow-auto bg-[#0d1117] text-sm font-mono px-3 py-2 space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="leading-relaxed">
                  {log.type === "clear" ? (
                    <span className="text-slate-500 italic">Console was cleared</span>
                  ) : log.type === "error" ? (
                    <div className="text-red-400 whitespace-pre-wrap">
                      {log.args[0]}
                      {log.args[1] && (
                        <div className="text-xs text-red-500 mt-1">{log.args[1]}</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {log.args.map((a, j) => {
                        if (typeof a === "string") {
                          return (
                            <span key={j} className="text-green-400 whitespace-pre-wrap">
                              {a}
                            </span>
                          );
                        }
                        if (typeof a === "number") {
                          return <span key={j} className="text-blue-400">{a}</span>;
                        }
                        if (typeof a === "boolean") {
                          return (
                            <span key={j} className={a ? "text-cyan-400" : "text-red-400"}>
                              {String(a)}
                            </span>
                          );
                        }
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
