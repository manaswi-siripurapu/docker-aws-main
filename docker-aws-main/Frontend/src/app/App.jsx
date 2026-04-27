import "./App.css"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"
import { io } from "socket.io-client"

const DEMO_PROJECTS = [
  {
    id: "sales-insights",
    name: "Retail Sales Insights",
    description: "Sales, channels, returns, and conversion metrics.",
    files: [
      {
        id: "sales-main",
        path: "src/sales-analysis.js",
        language: "javascript",
        content: `const sales = [
  { month: "Jan", revenue: 42000, orders: 310, returns: 14 },
  { month: "Feb", revenue: 48000, orders: 355, returns: 18 },
  { month: "Mar", revenue: 61000, orders: 420, returns: 20 },
  { month: "Apr", revenue: 77000, orders: 515, returns: 22 },
  { month: "May", revenue: 73000, orders: 498, returns: 27 },
  { month: "Jun", revenue: 91000, orders: 640, returns: 34 }
]

console.log(JSON.stringify(sales, null, 2))
return sales`
      },
      {
        id: "sales-utils",
        path: "src/channel-summary.js",
        language: "javascript",
        content: `const channels = [
  { channel: "Search", sessions: 1450, conversion: 5.8 },
  { channel: "Social", sessions: 980, conversion: 3.4 },
  { channel: "Email", sessions: 760, conversion: 8.1 },
  { channel: "Referral", sessions: 430, conversion: 4.9 }
]

console.log(JSON.stringify(channels, null, 2))
return channels`
      }
    ]
  },
  {
    id: "iot-energy",
    name: "IoT Energy Monitor",
    description: "Sensor streams with spikes for anomaly detection.",
    files: [
      {
        id: "iot-stream",
        path: "analytics/sensor-stream.js",
        language: "javascript",
        content: `const readings = [
  { minute: 0, temperature: 31.2, watts: 180, vibration: 0.04 },
  { minute: 5, temperature: 31.9, watts: 184, vibration: 0.05 },
  { minute: 10, temperature: 32.4, watts: 188, vibration: 0.05 },
  { minute: 15, temperature: 35.8, watts: 240, vibration: 0.12 },
  { minute: 20, temperature: 33.1, watts: 191, vibration: 0.06 },
  { minute: 25, temperature: 33.4, watts: 195, vibration: 0.05 }
]

console.log(JSON.stringify(readings, null, 2))
return readings`
      },
      {
        id: "iot-csv",
        path: "data/readings.csv.js",
        language: "javascript",
        content: `console.log(\`minute,humidity,pressure
0,42,1011
5,43,1010
10,44,1012
15,61,1004
20,45,1011\`)

return "CSV output emitted to logs"`
      }
    ]
  },
  {
    id: "student-performance",
    name: "Student Performance Lab",
    description: "Scores, attendance, study hours, and error demos.",
    files: [
      {
        id: "student-main",
        path: "notebooks/performance.js",
        language: "javascript",
        content: `const students = [
  { cohort: "A", attendance: 92, studyHours: 14, score: 86 },
  { cohort: "B", attendance: 81, studyHours: 9, score: 73 },
  { cohort: "C", attendance: 88, studyHours: 12, score: 80 },
  { cohort: "D", attendance: 64, studyHours: 4, score: 52 },
  { cohort: "E", attendance: 95, studyHours: 16, score: 91 }
]

console.log(JSON.stringify(students, null, 2))
return students`
      },
      {
        id: "student-errors",
        path: "experiments/error-case.js",
        language: "javascript",
        content: `const scores = [88, 92, 79, 84]
console.log("Preparing weighted score model")

throw new Error("Demo validation failure: weights do not add up to 100")

return scores`
      }
    ]
  }
]

const USER_COLORS = ["#22c55e", "#38bdf8", "#f59e0b", "#f43f5e", "#a78bfa", "#14b8a6"]

function readInitialQuery() {
  const query = new URLSearchParams(window.location.search)
  return {
    username: query.get("username") || "",
    roomId: query.get("room") || "sales-demo",
    projectId: query.get("project") || DEMO_PROJECTS[0].id
  }
}

function getServerUrl() {
  return import.meta.env.VITE_SERVER_URL || window.location.origin
}

function pickColor(name) {
  const total = Array.from(name || "Guest").reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return USER_COLORS[total % USER_COLORS.length]
}

function App() {
  const initialQuery = useMemo(readInitialQuery, [])
  const [username, setUsername] = useState(initialQuery.username)
  const [roomId, setRoomId] = useState(initialQuery.roomId)
  const [projectId, setProjectId] = useState(initialQuery.projectId)
  const [activeFileId, setActiveFileId] = useState(DEMO_PROJECTS[0].files[0].id)
  const [files, setFiles] = useState(DEMO_PROJECTS[0].files)
  const [users, setUsers] = useState([])
  const [comments, setComments] = useState([])
  const [history, setHistory] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [runResult, setRunResult] = useState(null)
  const [commentText, setCommentText] = useState("")
  const [commentLine, setCommentLine] = useState(1)
  const [connectionStatus, setConnectionStatus] = useState("idle")
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [dashboardTab, setDashboardTab] = useState("output")
  const [editorReady, setEditorReady] = useState(false)

  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const socketRef = useRef(null)
  const bindingRef = useRef(null)
  const modelDisposablesRef = useRef([])
  const decorationsRef = useRef([])
  const changeTimerRef = useRef(null)
  const seededFilesRef = useRef(new Set())
  const activeFileRef = useRef(null)
  const activeFileIdRef = useRef(activeFileId)
  const projectIdRef = useRef(projectId)

  const color = useMemo(() => pickColor(username), [username])
  const project = useMemo(() => DEMO_PROJECTS.find((item) => item.id === projectId) || DEMO_PROJECTS[0], [projectId])
  const activeFile = useMemo(
    () => files.find((file) => file.id === activeFileId) || files[0] || project.files[0],
    [activeFileId, files, project.files]
  )

  activeFileRef.current = activeFile
  activeFileIdRef.current = activeFileId
  projectIdRef.current = projectId

  const ydoc = useMemo(() => new Y.Doc(), [])
  const provider = useMemo(() => {
    if (!username) return null

    return new SocketIOProvider(
      getServerUrl(),
      `workspace-${roomId}`,
      ydoc,
      {
        autoConnect: true,
        disableBc: false
      },
      {
        transports: ["websocket"]
      }
    )
  }, [roomId, username, ydoc])

  useEffect(() => {
    const nextProject = DEMO_PROJECTS.find((item) => item.id === projectId) || DEMO_PROJECTS[0]
    setFiles(nextProject.files)
    setActiveFileId(nextProject.files[0].id)
    setRunResult(null)
  }, [projectId])

  useEffect(() => {
    if (!provider) return undefined

    provider.awareness.setLocalStateField("user", {
      name: username,
      username,
      color,
      colorLight: `${color}33`
    })

    provider.on("status", ({ status }) => setConnectionStatus(status))

    return () => {
      provider.destroy()
    }
  }, [color, provider, username])

  const hydrateState = useCallback((state) => {
    if (state.projectId && state.projectId !== projectIdRef.current) setProjectId(state.projectId)
    if (state.files?.length) {
      setFiles(state.files)
      if (!state.files.some((file) => file.id === activeFileIdRef.current)) setActiveFileId(state.files[0].id)
    }
    setUsers(state.users || [])
    setComments(state.comments || [])
    setHistory(state.history || [])
    setAnalytics(state.analytics || null)
  }, [])

  useEffect(() => {
    if (!provider || !editorReady || !editorRef.current || !monacoRef.current || !activeFile) return undefined

    bindingRef.current?.destroy?.()
    const editor = editorRef.current
    const monaco = monacoRef.current
    const text = ydoc.getText(`file:${activeFile.id}`)
    const uri = monaco.Uri.parse(`file:///${roomId}/${activeFile.path}`)
    let model = monaco.editor.getModel(uri)

    if (!model) {
      model = monaco.editor.createModel("", activeFile.language || "javascript", uri)
    }

    if (text.length === 0 && !seededFilesRef.current.has(activeFile.id)) {
      text.insert(0, activeFile.code || activeFile.content || "")
      seededFilesRef.current.add(activeFile.id)
    }

    editor.setModel(model)
    bindingRef.current = new MonacoBinding(text, model, new Set([editor]), provider.awareness)

    return () => {
      bindingRef.current?.destroy?.()
      bindingRef.current = null
    }
  }, [activeFile, editorReady, provider, roomId, ydoc])

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !activeFile) return

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      comments
        .filter((comment) => !comment.resolved && comment.fileId === activeFile.id)
        .map((comment) => ({
          range: new monacoRef.current.Range(comment.lineNumber, 1, comment.lineNumber, 1),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: "comment-line",
            glyphMarginClassName: "comment-glyph",
            hoverMessage: { value: `**${comment.author}**: ${comment.text}` }
          }
        }))
    )
  }, [activeFile, comments])

  useEffect(() => {
    if (!username) return undefined

    const socket = io(getServerUrl(), { transports: ["websocket"] })
    socketRef.current = socket

    socket.emit("session:join", { roomId, projectId, username, color })
    socket.on("session:state", hydrateState)
    socket.on("analytics:update", hydrateState)
    socket.on("presence:update", setUsers)
    socket.on("comments:update", setComments)
    socket.on("history:update", setHistory)
    socket.on("run:result", (result) => {
      setRunResult(result)
      setDashboardTab(result.status === "error" ? "execution" : "output")
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [color, hydrateState, projectId, roomId, username])

  function handleJoin(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextUsername = String(form.get("username") || "").trim()
    const nextRoom = String(form.get("room") || "demo-room").trim() || "demo-room"
    const nextProject = String(form.get("project") || DEMO_PROJECTS[0].id)
    if (!nextUsername) return

    setUsername(nextUsername)
    setRoomId(nextRoom)
    setProjectId(nextProject)
    window.history.pushState(
      {},
      "",
      `?username=${encodeURIComponent(nextUsername)}&room=${encodeURIComponent(nextRoom)}&project=${encodeURIComponent(nextProject)}`
    )
  }

  function handleEditorMount(editor, monaco) {
    editorRef.current = editor
    monacoRef.current = monaco
    setEditorReady(true)
    setCommentLine(editor.getPosition()?.lineNumber || 1)

    modelDisposablesRef.current.push(
      editor.onDidChangeCursorPosition((event) => {
        const cursor = {
          fileId: activeFileRef.current?.id,
          path: activeFileRef.current?.path,
          lineNumber: event.position.lineNumber,
          column: event.position.column
        }
        setCommentLine(cursor.lineNumber)
        provider?.awareness.setLocalStateField("cursor", cursor)
        socketRef.current?.emit("cursor:update", { roomId, username, cursor })
      }),
      editor.onDidChangeModelContent((event) => {
        const currentFile = activeFileRef.current
        if (!socketRef.current || !currentFile) return

        window.clearTimeout(changeTimerRef.current)
        changeTimerRef.current = window.setTimeout(() => {
          const charsChanged = event.changes.reduce((sum, change) => sum + change.text.length + change.rangeLength, 0)
          const linesTouched = event.changes.reduce(
            (sum, change) => sum + Math.max(1, change.range.endLineNumber - change.range.startLineNumber + 1),
            0
          )

          socketRef.current.emit("editor:change", {
            roomId,
            username,
            color,
            fileId: currentFile.id,
            code: editor.getValue(),
            change: { charsChanged, linesTouched }
          })
        }, 250)
      })
    )
  }

  function runCode() {
    const code = editorRef.current?.getValue() || ""
    setRunResult({ status: "running", logs: ["Running JavaScript..."], metrics: {} })
    socketRef.current?.emit("run:code", { roomId, username, fileId: activeFile?.id, code })
  }

  function saveVersion(label = "Manual save") {
    socketRef.current?.emit("history:snapshot", {
      roomId,
      username,
      fileId: activeFile?.id,
      label,
      code: editorRef.current?.getValue() || ""
    })
  }

  function addComment(event) {
    event.preventDefault()
    const text = commentText.trim()
    if (!text || !activeFile) return

    socketRef.current?.emit("comments:add", {
      roomId,
      username,
      fileId: activeFile.id,
      lineNumber: commentLine,
      text
    })
    setCommentText("")
  }

  function resolveComment(commentId) {
    socketRef.current?.emit("comments:resolve", { roomId, commentId })
  }

  function restoreVersion(version) {
    if (!version?.code) return
    setActiveFileId(version.fileId)
    window.setTimeout(() => {
      editorRef.current?.setValue(version.code)
      saveVersion(`Restored ${version.label}`)
    }, 80)
  }

  function exportAnalysis(kind) {
    const output = analytics?.data
    if (!output) return

    if (kind === "json") {
      downloadFile("analysis.json", JSON.stringify(output, null, 2), "application/json")
    }

    if (kind === "csv") {
      const csv = toCsv(output.table)
      downloadFile("analysis.csv", csv, "text/csv")
    }

    if (kind === "image") {
      const chart = output.charts?.[0]
      const svg = chartToSvg(chart)
      downloadFile("analysis-chart.svg", svg, "image/svg+xml")
    }
  }

  if (!username) {
    return (
      <main className="join-screen">
        <form className="join-panel" onSubmit={handleJoin}>
          <div>
            <p className="eyebrow">Coding platform demo</p>
            <h1>Collaborative Code Studio</h1>
            <p className="join-copy">Pick a project, join a room, code together, then open the analytics dashboard.</p>
          </div>
          <label>
            Name
            <input name="username" type="text" placeholder="Manas" autoFocus />
          </label>
          <label>
            Room
            <input name="room" type="text" defaultValue={roomId} />
          </label>
          <label>
            Demo project
            <select name="project" defaultValue={projectId}>
              {DEMO_PROJECTS.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <button type="submit">Open workspace</button>
        </form>
      </main>
    )
  }

  const overview = analytics?.overview || {}
  const data = analytics?.data || {}
  const execution = analytics?.execution || {}
  const activeComments = comments.filter((comment) => !comment.resolved && comment.fileId === activeFile?.id)

  return (
    <main className="platform">
      <header className="topbar">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>{activeFile?.path || "Workspace"}</h1>
        </div>
        <div className="toolbar">
          <span className={`status-dot ${connectionStatus}`}>{connectionStatus}</span>
          <button type="button" onClick={runCode}>Run</button>
          <button type="button" className="secondary" onClick={() => saveVersion()}>Save</button>
          <button type="button" className="dashboard-button" onClick={() => setDashboardOpen(true)}>Analytics</button>
        </div>
      </header>

      <section className="studio-grid">
        <aside className="project-rail">
          <Panel title="Project">
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {DEMO_PROJECTS.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <p className="muted">{project.description}</p>
          </Panel>
          <Panel title="Files">
            <div className="file-list">
              {files.map((file) => (
                <button
                  type="button"
                  className={file.id === activeFile?.id ? "file active" : "file"}
                  key={file.id}
                  onClick={() => setActiveFileId(file.id)}
                >
                  <span>{file.path}</span>
                  <small>{file.updatedBy ? `edited by ${file.updatedBy}` : file.language}</small>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Presence">
            <Presence users={users} activeFile={activeFile} />
          </Panel>
        </aside>

        <section className="editor-zone">
          <div className="editor-shell">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                glyphMargin: true,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16 }
              }}
            />
          </div>
          <Console result={runResult || execution.lastRun} />
        </section>

        <aside className="collab-rail">
          <Panel title="Inline Comments">
            <form className="comment-form" onSubmit={addComment}>
              <label>
                Line
                <input type="number" min="1" value={commentLine} onChange={(event) => setCommentLine(Number(event.target.value))} />
              </label>
              <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a note for this file" />
              <button type="submit">Comment</button>
            </form>
            <CommentList comments={activeComments} onResolve={resolveComment} />
          </Panel>
          <Panel title="Quick Stats">
            <MetricGrid
              items={[
                ["Files", overview.files || files.length],
                ["Users", overview.activeUsers || users.length],
                ["Runs", overview.totalRuns || 0],
                ["Notes", overview.openComments || 0]
              ]}
            />
            <p className="summary">{data.plainEnglish || "Run code to generate output analysis."}</p>
          </Panel>
        </aside>
      </section>

      {dashboardOpen && (
        <Dashboard
          analytics={analytics}
          history={history}
          runResult={runResult}
          tab={dashboardTab}
          setTab={setDashboardTab}
          onClose={() => setDashboardOpen(false)}
          onRestore={restoreVersion}
          onExport={exportAnalysis}
        />
      )}
    </main>
  )
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function Presence({ users, activeFile }) {
  if (!users.length) return <p className="muted">Only you are here.</p>

  return (
    <div className="presence-list">
      {users.map((user) => (
        <div className="presence-row" key={user.socketId || user.username}>
          <span className="avatar" style={{ background: user.color || pickColor(user.username) }}>{user.username?.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.username}</strong>
            <span>
              {user.cursor?.fileId === activeFile?.id ? `Line ${user.cursor.lineNumber}, Col ${user.cursor.column}` : user.cursor?.path || "Active"}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CommentList({ comments, onResolve }) {
  if (!comments.length) return <p className="muted">No open comments for this file.</p>

  return (
    <div className="comment-list">
      {comments.map((comment) => (
        <article className="comment-item" key={comment.id}>
          <div>
            <strong>Line {comment.lineNumber}</strong>
            <span>{comment.author}</span>
          </div>
          <p>{comment.text}</p>
          <button type="button" onClick={() => onResolve(comment.id)}>Resolve</button>
        </article>
      ))}
    </div>
  )
}

function MetricGrid({ items }) {
  return (
    <div className="metric-grid">
      {items.map(([label, value]) => (
        <div className="metric" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}

function Console({ result }) {
  if (!result) return <pre className="console">No run output yet.</pre>
  if (result.status === "running") return <pre className="console">Running JavaScript...</pre>

  return (
    <div className="console-wrap">
      <div className={`run-status ${result.status}`}>{result.status}</div>
      <pre className="console">{(result.logs || []).join("\n") || JSON.stringify(result.result, null, 2) || "No output"}</pre>
      {result.error && <pre className="console error">{result.error}</pre>}
    </div>
  )
}

function Dashboard({ analytics, history, runResult, tab, setTab, onClose, onRestore, onExport }) {
  const data = analytics?.data || {}
  const execution = analytics?.execution || {}
  const overview = analytics?.overview || {}
  const contributions = analytics?.contributions || []
  const versionChanges = analytics?.versionChanges || []
  const tabs = ["output", "execution", "collaboration", "versions"]

  return (
    <section className="dashboard-overlay">
      <div className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Analytics dashboard</p>
            <h2>Code, runtime, output, errors, collaboration, and versions</h2>
          </div>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </header>

        <nav className="dashboard-tabs">
          {tabs.map((item) => (
            <button type="button" className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>
              {item}
            </button>
          ))}
        </nav>

        {tab === "output" && (
          <div className="dashboard-grid">
            <Panel title="Auto Summary">
              <p className="summary">{data.plainEnglish || "Run code to analyze structured output."}</p>
              <MetricGrid
                items={[
                  ["Rows", data.table?.rows?.length || 0],
                  ["Columns", data.table?.columns?.length || 0],
                  ["Stats", data.stats?.length || 0],
                  ["Anomalies", data.anomalies?.length || 0]
                ]}
              />
              <div className="export-row">
                <button type="button" onClick={() => onExport("csv")}>CSV</button>
                <button type="button" onClick={() => onExport("json")}>JSON</button>
                <button type="button" onClick={() => onExport("image")}>Image</button>
              </div>
            </Panel>
            <Panel title="Suggested Charts">
              <ChartGallery charts={data.charts || []} />
            </Panel>
            <Panel title="Structured Preview">
              <DataTable table={data.table} anomalies={data.anomalies || []} />
            </Panel>
            <Panel title="Statistics & Trends">
              <StatsList stats={data.stats || []} trends={data.trends || []} />
            </Panel>
          </div>
        )}

        {tab === "execution" && (
          <div className="dashboard-grid">
            <Panel title="Runtime Metrics">
              <MetricGrid
                items={[
                  ["Runs", overview.totalRuns || 0],
                  ["Avg time", `${execution.avgDurationMs || 0} ms`],
                  ["Avg CPU", `${execution.avgCpuMs || 0} ms`],
                  ["Error rate", `${execution.errorRate || 0}%`]
                ]}
              />
              <TrendChart trend={execution.performanceTrend || []} />
            </Panel>
            <Panel title="Logs & Errors">
              <Console result={runResult || execution.lastRun} />
            </Panel>
            <Panel title="Bottlenecks">
              <ul className="suggestions">
                {(execution.bottlenecks || []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </Panel>
          </div>
        )}

        {tab === "collaboration" && (
          <div className="dashboard-grid">
            <Panel title="Contribution Split">
              <ContributionBars users={contributions} />
            </Panel>
            <Panel title="Collaboration Metrics">
              <MetricGrid
                items={[
                  ["Active users", overview.activeUsers || 0],
                  ["Total edits", overview.totalEdits || 0],
                  ["Changed chars", overview.totalChars || 0],
                  ["Open comments", overview.openComments || 0]
                ]}
              />
            </Panel>
          </div>
        )}

        {tab === "versions" && (
          <div className="dashboard-grid">
            <Panel title="Version Changes">
              <VersionChanges changes={versionChanges} />
            </Panel>
            <Panel title="History">
              <HistoryList history={history} onRestore={onRestore} />
            </Panel>
          </div>
        )}
      </div>
    </section>
  )
}

function ChartGallery({ charts }) {
  if (!charts.length) return <p className="muted">No chartable output yet.</p>
  return <div className="chart-gallery">{charts.slice(0, 5).map((chart) => <MiniChart chart={chart} key={`${chart.type}-${chart.title}`} />)}</div>
}

function MiniChart({ chart }) {
  if (chart.type === "scatter") return <ScatterChart chart={chart} />
  if (chart.type === "pie") return <PieChart chart={chart} />
  return <BarLineChart chart={chart} />
}

function BarLineChart({ chart }) {
  const values = chart.data.map((point) => Number(point.value)).filter(Number.isFinite)
  const max = Math.max(...values, 1)
  return (
    <article className="chart-card">
      <strong>{chart.title}</strong>
      <div className={`bars ${chart.type}`}>
        {chart.data.map((point, index) => (
          <span key={`${point.label}-${index}`} title={`${point.label}: ${point.value}`} style={{ height: `${Math.max(8, (Number(point.value) / max) * 100)}%` }} />
        ))}
      </div>
      <small>{chart.type}</small>
    </article>
  )
}

function ScatterChart({ chart }) {
  const xs = chart.data.map((point) => point.x).filter(Number.isFinite)
  const ys = chart.data.map((point) => point.y).filter(Number.isFinite)
  const maxX = Math.max(...xs, 1)
  const maxY = Math.max(...ys, 1)
  return (
    <article className="chart-card">
      <strong>{chart.title}</strong>
      <div className="scatter">
        {chart.data.map((point, index) => (
          <span key={index} style={{ left: `${(point.x / maxX) * 92}%`, bottom: `${(point.y / maxY) * 88}%` }} />
        ))}
      </div>
      <small>scatter</small>
    </article>
  )
}

function PieChart({ chart }) {
  const total = chart.data.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1
  const first = chart.data[0]?.value || 0
  const percent = Math.round((first / total) * 100)
  return (
    <article className="chart-card">
      <strong>{chart.title}</strong>
      <div className="pie" style={{ "--slice": `${percent}%` }} />
      <small>pie preview</small>
    </article>
  )
}

function DataTable({ table, anomalies }) {
  if (!table?.rows?.length) return <p className="muted">No structured table detected.</p>
  const anomalyKeys = new Set(anomalies.map((item) => `${item.row}-${item.field}`))
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>{table.columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.slice(0, 12).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {table.columns.map((column) => (
                <td className={anomalyKeys.has(`${rowIndex + 1}-${column}`) ? "anomaly" : ""} key={column}>{String(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatsList({ stats, trends }) {
  if (!stats.length) return <p className="muted">No numeric stats yet.</p>
  return (
    <div className="stats-list">
      {stats.map((stat) => {
        const trend = trends.find((item) => item.field === stat.field)
        return (
          <div className="stat-row" key={stat.field}>
            <strong>{stat.field}</strong>
            <span>mean {stat.mean} | median {stat.median} | min {stat.min} | max {stat.max}</span>
            {trend && <small>{trend.direction} ({trend.changePercent}%)</small>}
          </div>
        )
      })}
    </div>
  )
}

function TrendChart({ trend }) {
  if (!trend.length) return <p className="muted">Run code a few times to see performance trends.</p>
  return <MiniChart chart={{ type: "line", title: "Duration trend", data: trend.map((item) => ({ label: item.label, value: item.durationMs })) }} />
}

function ContributionBars({ users }) {
  if (!users.length) return <p className="muted">Start editing to build contribution analytics.</p>
  return (
    <div className="contribution-bars">
      {users.map((user) => (
        <div className="contribution" key={user.username}>
          <div className="contribution-label">
            <span>{user.username}</span>
            <strong>{user.contributionPercent}%</strong>
          </div>
          <div className="bar-track">
            <span style={{ width: `${Math.max(user.contributionPercent, 4)}%`, background: user.color }} />
          </div>
          <small>{user.edits} edits | {user.editFrequency}/min | {user.linesTouched} lines</small>
        </div>
      ))}
    </div>
  )
}

function VersionChanges({ changes }) {
  if (!changes.length) return <p className="muted">No version changes yet.</p>
  return (
    <div className="history-list">
      {changes.map((change) => (
        <article className="history-item" key={change.fileId}>
          <div>
            <strong>{change.path}</strong>
            <span>{change.versions} versions | last by {change.latestAuthor}</span>
          </div>
          <small>{change.changeSize} chars changed</small>
        </article>
      ))}
    </div>
  )
}

function HistoryList({ history, onRestore }) {
  if (!history.length) return <p className="muted">No saved versions yet.</p>
  return (
    <div className="history-list">
      {history.slice().reverse().map((version) => (
        <article className="history-item" key={version.id}>
          <div>
            <strong>{version.label}</strong>
            <span>{version.path} | {version.author} | {new Date(version.createdAt).toLocaleTimeString()}</span>
          </div>
          <button type="button" onClick={() => onRestore(version)}>Restore</button>
        </article>
      ))}
    </div>
  )
}

function toCsv(table) {
  if (!table?.rows?.length) return ""
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`
  return [table.columns.map(escape).join(","), ...table.rows.map((row) => table.columns.map((column) => escape(row[column])).join(","))].join("\n")
}

function chartToSvg(chart) {
  if (!chart?.data?.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><text x="24" y="40">No chart data</text></svg>`
  const values = chart.data.map((item) => Number(item.value)).filter(Number.isFinite)
  const max = Math.max(...values, 1)
  const bars = chart.data.slice(0, 12).map((item, index) => {
    const height = (Number(item.value) / max) * 240
    const x = 50 + index * 45
    const y = 300 - height
    return `<rect x="${x}" y="${y}" width="28" height="${height}" fill="#22c55e"/><text x="${x}" y="324" font-size="10" fill="#334155">${String(item.label).slice(0, 6)}</text>`
  }).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#f8fafc"/><text x="24" y="34" font-size="18" font-family="Arial" fill="#0f172a">${chart.title}</text>${bars}</svg>`
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export default App
