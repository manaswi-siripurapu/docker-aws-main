import "./App.css"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useEffect, useMemo, useRef, useState } from "react"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"
import { io } from "socket.io-client"

const STARTER_LATEX = String.raw`\documentclass{article}
\title{Collaborative LaTeX Analytics}
\author{Research Team}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
This paper demonstrates a real-time collaborative LaTeX editor with document analytics, compile feedback, version history, and writing quality insights.
\end{abstract}

\section{Introduction}
Collaborative scientific writing needs fast feedback. Authors need to know whether the document is complete, readable, well-cited, and balanced across sections.

\section{Methodology}
The editor uses conflict-free collaboration for shared editing. The analytics engine tracks writing progress, structure, citations, figures, tables, and compile health.

\section{Results}
Table~\ref{tab:metrics} summarizes synthetic document health metrics.

\begin{table}[h]
\centering
\caption{Document health metrics}
\label{tab:metrics}
\begin{tabular}{lr}
Metric & Value \\
Word count & 1320 \\
Citation density & 0.08 \\
\end{tabular}
\end{table}

\section{Conclusion}
The system gives authors a compact view of quality, progress, collaboration, and LaTeX build health.

\bibliographystyle{plain}
\begin{thebibliography}{9}
\bibitem{lamport} Leslie Lamport. LaTeX: A Document Preparation System.
\end{thebibliography}

\end{document}`

const COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"]

function initialQuery() {
  const query = new URLSearchParams(window.location.search)
  return {
    username: query.get("username") || "",
    roomId: query.get("room") || "paper-demo"
  }
}

function userColor(name) {
  const total = Array.from(name || "Guest").reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return COLORS[total % COLORS.length]
}

function serverUrl() {
  return import.meta.env.VITE_SERVER_URL || window.location.origin
}

function App() {
  const query = useMemo(initialQuery, [])
  const [username, setUsername] = useState(query.username)
  const [roomId, setRoomId] = useState(query.roomId)
  const [users, setUsers] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [history, setHistory] = useState([])
  const [compileResult, setCompileResult] = useState(null)
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [status, setStatus] = useState("idle")
  const [latexValue, setLatexValue] = useState(STARTER_LATEX)

  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const socketRef = useRef(null)
  const bindingRef = useRef(null)
  const seededRef = useRef(false)
  const changeTimerRef = useRef(null)

  const color = useMemo(() => userColor(username), [username])
  const ydoc = useMemo(() => new Y.Doc(), [])
  const yText = useMemo(() => ydoc.getText("latex"), [ydoc])
  const provider = useMemo(() => {
    if (!username) return null
    return new SocketIOProvider(
      serverUrl(),
      `latex-${roomId}`,
      ydoc,
      { autoConnect: true, disableBc: false },
      { transports: ["websocket"] }
    )
  }, [roomId, username, ydoc])

  useEffect(() => {
    if (!provider) return undefined

    provider.awareness.setLocalStateField("user", {
      name: username,
      username,
      color,
      colorLight: `${color}33`
    })
    provider.on("status", ({ status: nextStatus }) => setStatus(nextStatus))

    return () => provider.destroy()
  }, [color, provider, username])

  useEffect(() => {
    if (!username) return undefined

    const socket = io(serverUrl(), { transports: ["websocket"] })
    socketRef.current = socket
    socket.emit("session:join", { roomId, username, color })
    socket.on("session:state", (state) => {
      setUsers(state.users || [])
      setAnalytics(state.analytics || null)
      setHistory(state.history || [])
      if (state.latex && !seededRef.current) setLatexValue(state.latex)
    })
    socket.on("presence:update", setUsers)
    socket.on("compile:result", setCompileResult)
    socket.on("history:rollback", ({ latex }) => {
      editorRef.current?.setValue(latex)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [color, roomId, username])

  function mountEditor(editor, monaco) {
    editorRef.current = editor
    monacoRef.current = monaco

    if (yText.length === 0 && !seededRef.current) {
      yText.insert(0, latexValue)
      seededRef.current = true
    }

    bindingRef.current = new MonacoBinding(yText, editor.getModel(), new Set([editor]), provider?.awareness)

    editor.onDidChangeCursorPosition((event) => {
      const cursor = {
        lineNumber: event.position.lineNumber,
        column: event.position.column
      }
      provider?.awareness.setLocalStateField("cursor", cursor)
      socketRef.current?.emit("cursor:update", { roomId, cursor })
    })

    editor.onDidChangeModelContent((event) => {
      const latex = editor.getValue()
      setLatexValue(latex)
      window.clearTimeout(changeTimerRef.current)
      changeTimerRef.current = window.setTimeout(() => {
        const charsChanged = event.changes.reduce((sum, change) => sum + change.text.length + change.rangeLength, 0)
        const offset = editor.getModel()?.getOffsetAt(editor.getPosition()) || 0
        socketRef.current?.emit("editor:change", {
          roomId,
          username,
          color,
          latex,
          change: { charsChanged, offset }
        })
      }, 250)
    })
  }

  function join(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextName = String(form.get("username") || "").trim()
    const nextRoom = String(form.get("room") || "paper-demo").trim() || "paper-demo"
    if (!nextName) return
    setUsername(nextName)
    setRoomId(nextRoom)
    window.history.pushState({}, "", `?username=${encodeURIComponent(nextName)}&room=${encodeURIComponent(nextRoom)}`)
  }

  function compile() {
    const latex = editorRef.current?.getValue() || latexValue
    setCompileResult({ status: "running", diagnostics: [], durationMs: 0 })
    socketRef.current?.emit("compile:latex", { roomId, username, latex })
  }

  function snapshot() {
    const latex = editorRef.current?.getValue() || latexValue
    socketRef.current?.emit("history:snapshot", { roomId, username, latex, label: "Manual snapshot" })
  }

  function rollback(versionId) {
    socketRef.current?.emit("history:rollback", { roomId, username, versionId })
  }

  function formatLatex() {
    const formatted = simpleFormat(editorRef.current?.getValue() || latexValue)
    editorRef.current?.setValue(formatted)
  }

  if (!username) {
    return (
      <main className="join-screen">
        <form className="join-card" onSubmit={join}>
          <div>
            <p className="eyebrow">Collaborative LaTeX</p>
            <h1>Write together. Analyze simply.</h1>
            <p>Minimal LaTeX editor with live preview, compile feedback, history, and document analytics.</p>
          </div>
          <label>
            Name
            <input name="username" placeholder="Manas" autoFocus />
          </label>
          <label>
            Room
            <input name="room" defaultValue={roomId} />
          </label>
          <button type="submit">Join document</button>
        </form>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Room {roomId}</p>
          <h1>Collaborative LaTeX Editor</h1>
        </div>
        <div className="actions">
          <span className={`status ${status}`}>{status}</span>
          <button type="button" onClick={compile}>Compile</button>
          <button type="button" className="secondary" onClick={formatLatex}>Format</button>
          <button type="button" className="secondary" onClick={snapshot}>Snapshot</button>
          <button type="button" className="secondary" onClick={() => setDashboardOpen(true)}>Analytics</button>
        </div>
      </header>

      <section className="layout">
        <aside className="sidebar">
          <Panel title="People">
            <Presence users={users} />
          </Panel>
          <Panel title="Structure">
            <Structure sections={analytics?.structure?.sections || []} />
          </Panel>
          <Panel title="Build">
            <BuildStatus result={compileResult || analytics?.build?.latest} diagnostics={analytics?.diagnostics || []} />
          </Panel>
        </aside>

        <section className="editor-pane">
          <Editor
            height="100%"
            defaultLanguage="latex"
            defaultValue={latexValue}
            theme="vs-dark"
            onMount={mountEditor}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 16 }
            }}
          />
        </section>

        <section className="preview-pane">
          <div className="paper">
            <LatexPreview latex={latexValue} />
          </div>
        </section>
      </section>

      {dashboardOpen && (
        <AnalyticsDashboard
          analytics={analytics}
          history={history}
          onClose={() => setDashboardOpen(false)}
          onRollback={rollback}
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

function Presence({ users }) {
  if (!users.length) return <p className="muted">Only you are here.</p>
  return (
    <div className="people">
      {users.map((user) => (
        <div className="person" key={user.socketId || user.username}>
          <span style={{ background: user.color }}>{user.username?.[0]?.toUpperCase()}</span>
          <div>
            <strong>{user.username}</strong>
            <small>{user.cursor ? `Line ${user.cursor.lineNumber}, Col ${user.cursor.column}` : "Active"}</small>
          </div>
        </div>
      ))}
    </div>
  )
}

function Structure({ sections }) {
  if (!sections.length) return <p className="muted">No sections found.</p>
  return (
    <div className="structure">
      {sections.map((section) => (
        <a key={`${section.title}-${section.start}`} href={`#${slug(section.title)}`}>
          <span>{section.title}</span>
          <small>{section.words} words</small>
        </a>
      ))}
    </div>
  )
}

function BuildStatus({ result, diagnostics }) {
  const current = result || { status: diagnostics.some((item) => item.type === "error") ? "error" : "success" }
  return (
    <div className="build">
      <strong className={current.status}>{current.status || "idle"}</strong>
      {current.durationMs ? <small>{current.durationMs} ms</small> : null}
      <div className="diagnostics">
        {(current.diagnostics || diagnostics).slice(0, 4).map((item, index) => (
          <p key={`${item.message}-${index}`} className={item.type}>{item.message}</p>
        ))}
      </div>
    </div>
  )
}

function LatexPreview({ latex }) {
  const document = extractDocument(latex)
  const title = matchOne(latex, /\\title\{([^}]+)\}/) || "Untitled Document"
  const author = matchOne(latex, /\\author\{([^}]+)\}/) || ""
  const abstract = matchOne(latex, /\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/)
  const sections = parsePreviewSections(document)

  return (
    <>
      <h1>{title}</h1>
      {author && <p className="author">{author}</p>}
      {abstract && (
        <section className="abstract">
          <h2>Abstract</h2>
          <p>{cleanInline(abstract)}</p>
        </section>
      )}
      {sections.map((section) => (
        <section key={section.title} id={slug(section.title)}>
          <h2>{section.title}</h2>
          {section.body.map((paragraph, index) => (
            <p key={index}>{cleanInline(paragraph)}</p>
          ))}
        </section>
      ))}
    </>
  )
}

function AnalyticsDashboard({ analytics, history, onClose, onRollback }) {
  if (!analytics) return null
  const overview = analytics.overview || {}
  const readability = analytics.readability || {}
  const build = analytics.build || {}
  const collaboration = analytics.collaboration || {}
  const data = analytics.dataAnalysis || {}
  const tables = data.tables || {}
  const distributions = data.distributions || {}

  function exportDashboard() {
    const blob = new Blob([JSON.stringify(analytics, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "latex-analytics.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="modal">
      <div className="dashboard">
        <header>
          <div>
            <p className="eyebrow">Unified Analytics</p>
            <h2>Document data analysis</h2>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={exportDashboard}>Export JSON</button>
            <button type="button" className="secondary" onClick={onClose}>Close</button>
          </div>
        </header>

        <div className="metric-grid">
          <Metric label="Health score" value={data.healthScore || 0} />
          <Metric label="Words" value={overview.words || 0} />
          <Metric label="Compile success" value={`${build.successRate ?? 100}%`} />
          <Metric label="Clarity score" value={readability.score || 0} />
        </div>

        <section className="analysis-summary">
          <strong>Auto summary</strong>
          <p>{data.summary || "Start writing or compiling to generate analytics."}</p>
        </section>

        <div className="dashboard-grid">
          <Panel title="Section Dataset">
            <DataTable
              columns={["section", "words", "citations", "citationDensity", "visuals", "status"]}
              rows={tables.sections || []}
            />
          </Panel>
          <Panel title="Section Word Distribution">
            <MiniBars data={distributions.sectionWords || []} />
          </Panel>
          <Panel title="Readability Distribution">
            <div className="split-charts">
              <MiniBars title="Sentence length" data={distributions.sentenceLengths || []} />
              <MiniBars title="Paragraph length" data={distributions.paragraphLengths || []} />
            </div>
          </Panel>
          <Panel title="Citation & Visual Density">
            <div className="split-charts">
              <MiniBars title="Citation density" data={distributions.citationDensity || []} />
              <MiniBars title="Visual density" data={distributions.visualDensity || []} />
            </div>
          </Panel>
          <Panel title="Anomalies">
            <AnomalyList anomalies={data.anomalies || []} />
          </Panel>
          <Panel title="Recommendations">
            <ul className="facts">
              {(data.recommendations || []).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </Panel>
          <Panel title="Build/Error Dataset">
            <DataTable columns={["build", "status", "durationMs", "errors", "warnings"]} rows={tables.builds || []} />
          </Panel>
          <Panel title="Collaboration Activity">
            <ActivityHeatmap rows={tables.activity || []} />
          </Panel>
          <Panel title="Progress">
            <Progress analytics={analytics} />
          </Panel>
          <Panel title="Readability">
            <ul className="facts">
              <li>Avg sentence: {readability.avgSentenceWords || 0} words</li>
              <li>Paragraph density: {readability.paragraphDensity || "balanced"}</li>
              <li>Long sentences: {readability.longSentences || 0}</li>
            </ul>
          </Panel>
          <Panel title="Citations & Visuals">
            <ul className="facts">
              <li>Citations: {analytics.citations?.total || 0}</li>
              <li>Bibliography completeness: {analytics.citations?.bibliographyCompleteness ?? 100}%</li>
              <li>Figures: {analytics.visuals?.figures || 0}</li>
              <li>Tables: {analytics.visuals?.tables || 0}</li>
            </ul>
          </Panel>
          <Panel title="Collaboration">
            <Contributors contributors={collaboration.contributors || []} />
          </Panel>
          <Panel title="Versions">
            <History history={history} onRollback={onRollback} />
          </Panel>
        </div>
      </div>
    </section>
  )
}

function DataTable({ columns, rows }) {
  if (!rows.length) return <p className="muted">No data rows yet.</p>
  return (
    <div className="table-wrap">
      <table className="analysis-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MiniBars({ data, title }) {
  if (!data.length) return <p className="muted">No chart data yet.</p>
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 1)
  return (
    <div className="mini-chart">
      {title && <strong>{title}</strong>}
      <div className="mini-bars">
        {data.slice(0, 10).map((item, index) => (
          <span
            key={`${item.label}-${index}`}
            title={`${item.label}: ${item.value}`}
            style={{ height: `${Math.max(8, (Number(item.value || 0) / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="chart-labels">
        {data.slice(0, 4).map((item) => <small key={item.label}>{item.label}</small>)}
      </div>
    </div>
  )
}

function AnomalyList({ anomalies }) {
  if (!anomalies.length) return <p className="muted">No anomalies detected.</p>
  return (
    <div className="anomalies">
      {anomalies.map((item, index) => (
        <article key={`${item.label}-${index}`}>
          <strong>{item.label}</strong>
          <span>{item.type}</span>
          <p>{item.message}</p>
        </article>
      ))}
    </div>
  )
}

function ActivityHeatmap({ rows }) {
  const counts = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: rows.filter((row) => row.hour === hour).length
  }))
  const max = Math.max(...counts.map((item) => item.count), 1)
  return (
    <div className="heatmap">
      {counts.map((item) => (
        <span
          key={item.hour}
          title={`${item.hour}:00 - ${item.count} events`}
          style={{ opacity: 0.2 + (item.count / max) * 0.8 }}
        >
          {item.hour}
        </span>
      ))}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Progress({ analytics }) {
  const progress = analytics.progress || {}
  return (
    <>
      <div className="progress-track">
        <span style={{ width: `${progress.completionPercent || 0}%` }} />
      </div>
      <p className="muted">{progress.completionPercent || 0}% of {progress.targetWords || 1500} target words</p>
      <div className="sections">
        {(progress.sectionCompletion || []).map((section) => (
          <div key={section.title}>
            <strong>{section.title}</strong>
            <small>{section.status} | {section.words} words</small>
          </div>
        ))}
      </div>
    </>
  )
}

function Contributors({ contributors }) {
  if (!contributors.length) return <p className="muted">No edits yet.</p>
  return (
    <div className="contributors">
      {contributors.map((user) => (
        <div key={user.username}>
          <div>
            <span>{user.username}</span>
            <strong>{user.contributionPercent}%</strong>
          </div>
          <div className="bar"><span style={{ width: `${Math.max(user.contributionPercent, 4)}%`, background: user.color }} /></div>
          <small>{user.edits} edits | {user.editFrequency}/min</small>
        </div>
      ))}
    </div>
  )
}

function History({ history, onRollback }) {
  if (!history.length) return <p className="muted">No snapshots yet.</p>
  return (
    <div className="history">
      {history.slice().reverse().slice(0, 8).map((version) => (
        <article key={version.id}>
          <div>
            <strong>{version.label}</strong>
            <small>{version.author} | {version.words} words</small>
          </div>
          <button type="button" onClick={() => onRollback(version.id)}>Rollback</button>
        </article>
      ))}
    </div>
  )
}

function simpleFormat(latex) {
  return latex
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
}

function extractDocument(latex) {
  return matchOne(latex, /\\begin\{document\}([\s\S]*?)\\end\{document\}/) || latex
}

function parsePreviewSections(document) {
  const withoutAbstract = document.replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/g, "")
  const parts = withoutAbstract.split(/\\section\*?\{([^}]+)\}/g)
  const sections = []
  for (let index = 1; index < parts.length; index += 2) {
    sections.push({
      title: parts[index],
      body: parts[index + 1]
        .split(/\n\s*\n/)
        .map((item) => item.trim())
        .filter((item) => item && !item.startsWith("\\"))
    })
  }
  return sections
}

function cleanInline(text) {
  return text
    .replace(/\\cite\{([^}]+)\}/g, "[$1]")
    .replace(/\\ref\{([^}]+)\}/g, "$1")
    .replace(/\\[a-zA-Z]+(\[[^\]]+\])?(\{([^}]*)\})?/g, "$3")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function matchOne(text, pattern) {
  return text.match(pattern)?.[1]?.trim()
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

export default App
