import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { YSocketIO } from "y-socket.io/dist/server"
import os from "os"
import { existsSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { randomUUID } from "crypto"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3000)

const DEFAULT_LATEX = String.raw`\documentclass{article}
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

const app = express()
app.use(express.json({ limit: "1mb" }))

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
})

const ySocketIO = new YSocketIO(io)
ySocketIO.initialize()

const sessions = new Map()

function nowIso() {
  return new Date().toISOString()
}

function getSession(roomId = "paper-demo") {
  if (!sessions.has(roomId)) {
    sessions.set(roomId, {
      roomId,
      createdAt: nowIso(),
      latex: DEFAULT_LATEX,
      users: new Map(),
      contributions: new Map(),
      history: [],
      builds: [],
      activity: []
    })
  }

  return sessions.get(roomId)
}

function contributor(session, username, color = "#2563eb") {
  if (!session.contributions.has(username)) {
    session.contributions.set(username, {
      username,
      color,
      edits: 0,
      charsChanged: 0,
      firstActive: nowIso(),
      lastActive: nowIso()
    })
  }

  return session.contributions.get(username)
}

function recordActivity(session, event) {
  session.activity.push({ id: randomUUID(), at: nowIso(), ...event })
  session.activity = session.activity.slice(-250)
}

function serializeSession(session) {
  return {
    roomId: session.roomId,
    createdAt: session.createdAt,
    latex: session.latex,
    users: Array.from(session.users.values()),
    history: session.history.map(({ latex, ...entry }) => ({
      ...entry,
      latex,
      words: countWords(stripLatex(latex)),
      chars: latex.length
    })),
    analytics: buildAnalytics(session)
  }
}

function buildAnalytics(session) {
  const latex = session.latex
  const sections = parseSections(latex)
  const plain = stripLatex(latex)
  const words = countWords(plain)
  const sentences = splitSentences(plain)
  const paragraphs = plain.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean)
  const citations = extractMatches(latex, /\\cite\w*\{([^}]+)\}/g)
  const bibItems = extractMatches(latex, /\\bibitem(?:\[[^\]]+\])?\{([^}]+)\}/g)
  const figures = extractEnvironments(latex, "figure")
  const tables = extractEnvironments(latex, "table")
  const diagnostics = validateLatex(latex)
  const builds = session.builds
  const contributors = Array.from(session.contributions.values())
  const totalChars = contributors.reduce((sum, user) => sum + user.charsChanged, 0)
  const latestHistory = session.history.at(-1)
  const previousHistory = session.history.at(-2)
  const dataAnalysis = analyzeDocumentData({
    session,
    sections,
    sentences,
    paragraphs,
    citations,
    bibItems,
    figures,
    tables,
    diagnostics,
    builds,
    words
  })

  return {
    generatedAt: nowIso(),
    overview: {
      activeUsers: session.users.size,
      words,
      sections: sections.length,
      citations: citations.length,
      references: bibItems.length,
      figures: figures.length,
      tables: tables.length,
      versions: session.history.length,
      compileRuns: builds.length
    },
    structure: analyzeStructure(sections, latex),
    progress: analyzeProgress(session, sections, words),
    readability: analyzeReadability(sentences, paragraphs, words),
    citations: analyzeCitations(sections, citations, bibItems),
    visuals: analyzeVisuals(figures, tables, words),
    build: analyzeBuilds(builds, diagnostics),
    revisions: analyzeRevisions(latestHistory, previousHistory, sections),
    collaboration: analyzeCollaboration(session, contributors, totalChars, sections),
    dataAnalysis,
    diagnostics
  }
}

function parseSections(latex) {
  const pattern = /\\(section|subsection|subsubsection)\*?\{([^}]+)\}/g
  const matches = []
  let match

  while ((match = pattern.exec(latex))) {
    matches.push({
      level: match[1],
      title: match[2],
      start: match.index,
      end: latex.length
    })
  }

  return matches.map((section, index) => {
    const end = matches[index + 1]?.start ?? latex.length
    const raw = latex.slice(section.start, end)
    return {
      ...section,
      end,
      raw,
      words: countWords(stripLatex(raw)),
      citations: extractMatches(raw, /\\cite\w*\{([^}]+)\}/g).length,
      figures: extractEnvironments(raw, "figure").length,
      tables: extractEnvironments(raw, "table").length
    }
  })
}

function stripLatex(latex) {
  return latex
    .replace(/%.*$/gm, "")
    .replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}/g, " ")
    .replace(/\\(section|subsection|subsubsection|title|author|caption|label|ref|cite\w*)\*?\{([^}]*)\}/g, " $2 ")
    .replace(/\\[a-zA-Z]+(\[[^\]]+\])?(\{[^}]*\})?/g, " ")
    .replace(/[{}$&_#^~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function countWords(text) {
  if (!text.trim()) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

function splitSentences(text) {
  return text.split(/[.!?]+/).map((item) => item.trim()).filter((item) => item.split(/\s+/).length > 2)
}

function extractMatches(text, pattern) {
  return Array.from(text.matchAll(pattern)).flatMap((match) => String(match[1] || "").split(",").map((item) => item.trim()).filter(Boolean))
}

function extractEnvironments(latex, name) {
  const pattern = new RegExp(`\\\\begin\\{${name}\\}([\\s\\S]*?)\\\\end\\{${name}\\}`, "g")
  return Array.from(latex.matchAll(pattern)).map((match) => ({
    raw: match[0],
    hasCaption: /\\caption\{[^}]+\}/.test(match[0]),
    hasLabel: /\\label\{[^}]+\}/.test(match[0])
  }))
}

function validateLatex(latex) {
  const diagnostics = []
  const beginStack = []
  const envPattern = /\\(begin|end)\{([^}]+)\}/g
  let match

  while ((match = envPattern.exec(latex))) {
    const [, type, env] = match
    if (type === "begin") {
      beginStack.push({ env, index: match.index })
    } else {
      const last = beginStack.pop()
      if (!last || last.env !== env) {
        diagnostics.push({
          type: "error",
          category: "environment",
          message: `Mismatched \\end{${env}}`,
          section: sectionAt(latex, match.index)
        })
      }
    }
  }

  for (const item of beginStack) {
    diagnostics.push({
      type: "error",
      category: "environment",
      message: `Missing \\end{${item.env}}`,
      section: sectionAt(latex, item.index)
    })
  }

  const opens = (latex.match(/\{/g) || []).length
  const closes = (latex.match(/\}/g) || []).length
  if (opens !== closes) {
    diagnostics.push({
      type: "error",
      category: "braces",
      message: `Unbalanced braces: ${opens} opening and ${closes} closing`,
      section: "Document"
    })
  }

  if (!/\\begin\{document\}/.test(latex)) {
    diagnostics.push({ type: "error", category: "structure", message: "Missing \\begin{document}", section: "Preamble" })
  }
  if (!/\\end\{document\}/.test(latex)) {
    diagnostics.push({ type: "error", category: "structure", message: "Missing \\end{document}", section: "Document" })
  }
  if (/\\cite\{[^}]+\}/.test(latex) && !/\\bibitem|\\bibliography\{/.test(latex)) {
    diagnostics.push({ type: "warning", category: "citation", message: "Citations exist but bibliography is missing", section: "References" })
  }

  return diagnostics
}

function sectionAt(latex, index) {
  const sections = parseSections(latex).filter((section) => section.start <= index)
  return sections.at(-1)?.title || "Document"
}

function analyzeStructure(sections, latex) {
  const required = ["Introduction", "Methodology", "Results", "Conclusion"]
  const titles = sections.map((section) => section.title.toLowerCase())
  const missing = required.filter((name) => !titles.some((title) => title.includes(name.toLowerCase())))
  const avgWords = sections.length ? sections.reduce((sum, section) => sum + section.words, 0) / sections.length : 0
  const imbalanced = sections.filter((section) => avgWords && (section.words > avgWords * 1.8 || section.words < avgWords * 0.35))

  return {
    sections,
    missing,
    imbalanced: imbalanced.map((section) => section.title),
    hasTitle: /\\title\{[^}]+\}/.test(latex),
    hasAbstract: /\\begin\{abstract\}/.test(latex),
    hierarchyIssues: sections.some((section) => section.level === "subsection") && !sections.some((section) => section.level === "section")
      ? ["Subsections exist without top-level sections."]
      : []
  }
}

function analyzeProgress(session, sections, words) {
  const targetWords = 1500
  const historyTrend = session.history.slice(-12).map((entry) => ({
    label: new Date(entry.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    words: countWords(stripLatex(entry.latex))
  }))

  return {
    targetWords,
    completionPercent: Math.min(100, Math.round((words / targetWords) * 100)),
    sectionCompletion: sections.map((section) => ({
      title: section.title,
      words: section.words,
      status: section.words >= 120 ? "complete" : section.words >= 50 ? "draft" : "thin"
    })),
    growthTrend: historyTrend
  }
}

function analyzeReadability(sentences, paragraphs, words) {
  const avgSentenceWords = sentences.length ? words / sentences.length : 0
  const avgParagraphWords = paragraphs.length ? words / paragraphs.length : 0
  const longSentences = sentences.filter((sentence) => sentence.split(/\s+/).length > 28).length
  const score = Math.max(0, Math.min(100, Math.round(100 - avgSentenceWords * 1.4 - longSentences * 4)))

  return {
    score,
    avgSentenceWords: Number(avgSentenceWords.toFixed(1)),
    avgParagraphWords: Number(avgParagraphWords.toFixed(1)),
    longSentences,
    paragraphDensity: avgParagraphWords > 120 ? "dense" : avgParagraphWords < 35 ? "light" : "balanced"
  }
}

function analyzeCitations(sections, citations, bibItems) {
  const bibliographyCompleteness = citations.length ? Math.round((new Set(citations.filter((item) => bibItems.includes(item))).size / new Set(citations).size) * 100) : 100
  return {
    total: citations.length,
    unique: new Set(citations).size,
    bibliographyCompleteness,
    referenceDensity: sections.map((section) => ({
      title: section.title,
      citations: section.citations,
      density: section.words ? Number((section.citations / section.words).toFixed(3)) : 0
    })),
    uncitedBibItems: bibItems.filter((item) => !citations.includes(item))
  }
}

function analyzeVisuals(figures, tables, words) {
  const visuals = figures.length + tables.length
  const missingCaptions = [...figures, ...tables].filter((item) => !item.hasCaption).length
  const missingLabels = [...figures, ...tables].filter((item) => !item.hasLabel).length

  return {
    figures: figures.length,
    tables: tables.length,
    missingCaptions,
    missingLabels,
    balance: visuals ? Number((words / visuals).toFixed(1)) : null,
    recommendation: visuals === 0 ? "Add at least one table or figure if the paper contains empirical results." : "Visual balance looks usable for a short paper."
  }
}

function analyzeBuilds(builds, diagnostics) {
  const successes = builds.filter((build) => build.status === "success").length
  const errorBuilds = builds.length - successes
  const latest = builds.at(-1)
  return {
    latest,
    successRate: builds.length ? Math.round((successes / builds.length) * 100) : diagnostics.some((item) => item.type === "error") ? 0 : 100,
    compileRuns: builds.length,
    errorFrequency: errorBuilds,
    warningTrend: builds.slice(-8).map((build, index) => ({ label: `Build ${index + 1}`, warnings: build.warnings, errors: build.errors })),
    currentErrors: diagnostics.filter((item) => item.type === "error").length,
    currentWarnings: diagnostics.filter((item) => item.type === "warning").length
  }
}

function analyzeRevisions(latest, previous, sections) {
  if (!latest) {
    return {
      addedWords: 0,
      removedWords: 0,
      churn: 0,
      stability: sections.map((section) => ({ title: section.title, stability: "new" }))
    }
  }

  const latestWords = countWords(stripLatex(latest.latex))
  const previousWords = previous ? countWords(stripLatex(previous.latex)) : 0
  const delta = latestWords - previousWords

  return {
    addedWords: Math.max(delta, 0),
    removedWords: Math.max(-delta, 0),
    churn: Math.abs(delta),
    stability: sections.map((section) => ({
      title: section.title,
      stability: section.words > 180 ? "stable" : section.words > 70 ? "evolving" : "needs work"
    }))
  }
}

function analyzeCollaboration(session, contributors, totalChars, sections) {
  const activeHours = new Map()
  for (const item of session.activity) {
    const hour = new Date(item.at).getHours()
    activeHours.set(hour, (activeHours.get(hour) || 0) + 1)
  }

  const balance = contributors.length <= 1
    ? "solo"
    : contributors.every((user) => totalChars && user.charsChanged / totalChars > 0.18)
      ? "balanced"
      : "uneven"

  return {
    balance,
    contributors: contributors.map((user) => {
      const minutesActive = Math.max(1 / 60, (Date.now() - new Date(user.firstActive).getTime()) / 60000)
      return {
        ...user,
        contributionPercent: totalChars ? Math.round((user.charsChanged / totalChars) * 100) : 0,
        editFrequency: Number((user.edits / minutesActive).toFixed(2))
      }
    }),
    sectionOwnership: sections.map((section, index) => ({
      title: section.title,
      owner: contributors[index % Math.max(contributors.length, 1)]?.username || "Unassigned",
      words: section.words
    })),
    activeHours: Array.from(activeHours.entries()).map(([hour, count]) => ({ hour, count })),
    conflictZones: session.activity
      .filter((item) => item.type === "edit")
      .slice(-20)
      .reduce((zones, item) => {
        const section = item.section || "Document"
        zones[section] = (zones[section] || 0) + 1
        return zones
      }, {})
  }
}

function analyzeDocumentData({ session, sections, sentences, paragraphs, citations, bibItems, figures, tables, diagnostics, builds, words }) {
  const sectionRows = sections.map((section) => ({
    section: section.title,
    level: section.level,
    words: section.words,
    citations: section.citations,
    citationDensity: section.words ? Number((section.citations / section.words).toFixed(3)) : 0,
    visuals: section.figures + section.tables,
    visualDensity: section.words ? Number(((section.figures + section.tables) / section.words).toFixed(3)) : 0,
    status: section.words >= 120 ? "complete" : section.words >= 50 ? "draft" : "thin"
  }))
  const sentenceLengths = sentences.map((sentence) => sentence.split(/\s+/).length)
  const paragraphLengths = paragraphs.map((paragraph) => countWords(paragraph))
  const issueRows = diagnostics.map((item) => ({
    severity: item.type,
    category: item.category,
    section: item.section,
    message: item.message
  }))
  const buildRows = builds.slice(-12).map((build, index) => ({
    build: index + 1,
    status: build.status,
    durationMs: build.durationMs,
    errors: build.errors,
    warnings: build.warnings
  }))
  const activityRows = session.activity.slice(-100).map((item) => ({
    time: item.at,
    hour: new Date(item.at).getHours(),
    type: item.type,
    user: item.username || "Unknown",
    section: item.section || "Document",
    charsChanged: item.charsChanged || 0
  }))
  const sectionWordStats = numericSummary(sectionRows.map((row) => row.words))
  const sentenceStats = numericSummary(sentenceLengths)
  const paragraphStats = numericSummary(paragraphLengths)
  const scoreParts = [
    Math.min(100, Math.round((words / 1500) * 100)),
    Math.max(0, 100 - issueRows.filter((row) => row.severity === "error").length * 20 - issueRows.filter((row) => row.severity === "warning").length * 8),
    Math.max(0, 100 - Math.abs((sectionWordStats.max || 0) - (sectionWordStats.min || 0)) / Math.max(sectionWordStats.mean || 1, 1) * 30),
    citations.length ? Math.round((new Set(citations.filter((item) => bibItems.includes(item))).size / new Set(citations).size) * 100) : 85,
    Math.max(0, 100 - Math.max(0, sentenceStats.mean - 22) * 3)
  ]
  const healthScore = Math.round(scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length)

  return {
    healthScore,
    summary: summarizeDocumentData(healthScore, sectionRows, issueRows, sentenceStats, citations, figures.length + tables.length),
    tables: {
      sections: sectionRows,
      issues: issueRows,
      builds: buildRows,
      activity: activityRows
    },
    distributions: {
      sentenceLengths: histogram(sentenceLengths, 6),
      paragraphLengths: histogram(paragraphLengths, 6),
      sectionWords: sectionRows.map((row) => ({ label: row.section, value: row.words })),
      citationDensity: sectionRows.map((row) => ({ label: row.section, value: row.citationDensity })),
      visualDensity: sectionRows.map((row) => ({ label: row.section, value: row.visualDensity }))
    },
    stats: {
      sectionWords: sectionWordStats,
      sentenceLengths: sentenceStats,
      paragraphLengths: paragraphStats
    },
    anomalies: detectDocumentAnomalies(sectionRows, sentenceStats, paragraphStats, issueRows),
    recommendations: buildRecommendations(sectionRows, issueRows, sentenceStats, citations, bibItems, figures, tables)
  }
}

function numericSummary(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) return { count: 0, min: 0, max: 0, mean: 0, median: 0 }
  const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length
  const middle = Math.floor(clean.length / 2)
  const median = clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2
  return {
    count: clean.length,
    min: clean[0],
    max: clean.at(-1),
    mean: Number(mean.toFixed(1)),
    median: Number(median.toFixed(1))
  }
}

function histogram(values, bucketCount = 6) {
  const clean = values.filter(Number.isFinite)
  if (!clean.length) return []
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const size = (max - min || 1) / bucketCount
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: `${Math.round(min + index * size)}-${Math.round(min + (index + 1) * size)}`,
    value: 0
  }))
  for (const value of clean) {
    buckets[Math.min(bucketCount - 1, Math.floor((value - min) / size))].value += 1
  }
  return buckets
}

function detectDocumentAnomalies(sectionRows, sentenceStats, paragraphStats, issueRows) {
  const anomalies = []
  const meanWords = sectionRows.reduce((sum, row) => sum + row.words, 0) / Math.max(sectionRows.length, 1)
  for (const row of sectionRows) {
    if (meanWords && row.words > meanWords * 1.8) anomalies.push({ type: "section", label: row.section, message: "Section is much longer than average." })
    if (meanWords && row.words < meanWords * 0.35) anomalies.push({ type: "section", label: row.section, message: "Section is much shorter than average." })
    if (row.citationDensity === 0 && row.words > 80) anomalies.push({ type: "citation", label: row.section, message: "Long section has no citations." })
  }
  if (sentenceStats.mean > 24) anomalies.push({ type: "readability", label: "Sentences", message: "Average sentence length is high." })
  if (paragraphStats.mean > 120) anomalies.push({ type: "readability", label: "Paragraphs", message: "Paragraphs are dense." })
  for (const issue of issueRows.filter((row) => row.severity === "error")) {
    anomalies.push({ type: "latex", label: issue.section, message: issue.message })
  }
  return anomalies.slice(0, 12)
}

function buildRecommendations(sectionRows, issueRows, sentenceStats, citations, bibItems, figures, tables) {
  const recommendations = []
  if (issueRows.some((row) => row.severity === "error")) recommendations.push("Resolve LaTeX errors before final export.")
  if (sectionRows.some((row) => row.status === "thin")) recommendations.push("Expand thin sections so every major heading has enough content.")
  if (sentenceStats.mean > 24) recommendations.push("Shorten long sentences to improve clarity.")
  if (citations.length && new Set(citations.filter((item) => bibItems.includes(item))).size < new Set(citations).size) recommendations.push("Add missing bibliography entries for cited keys.")
  if (!figures.length && !tables.length) recommendations.push("Add at least one table or figure if the paper presents results.")
  if ([...figures, ...tables].some((item) => !item.hasCaption || !item.hasLabel)) recommendations.push("Add captions and labels to all figures and tables.")
  return recommendations.length ? recommendations : ["Document metrics look balanced for a short draft."]
}

function summarizeDocumentData(healthScore, sectionRows, issueRows, sentenceStats, citations, visuals) {
  const errorCount = issueRows.filter((row) => row.severity === "error").length
  const thinSections = sectionRows.filter((row) => row.status === "thin").length
  return `Health score ${healthScore}/100. ${sectionRows.length} section(s), ${thinSections} thin section(s), ${citations.length} citation(s), ${visuals} visual(s), ${errorCount} blocking LaTeX error(s), and average sentence length ${sentenceStats.mean || 0} words.`
}

function createSnapshot(session, author, label = "Snapshot") {
  const snapshot = {
    id: randomUUID(),
    author,
    label,
    createdAt: nowIso(),
    latex: session.latex
  }
  session.history.push(snapshot)
  session.history = session.history.slice(-30)
  return snapshot
}

function broadcastState(roomId) {
  io.to(roomId).emit("session:state", serializeSession(getSession(roomId)))
}

app.get("/health", (req, res) => {
  res.json({
    message: "ok",
    success: true,
    uptimeSeconds: Math.round(process.uptime()),
    cpuCores: os.cpus().length
  })
})

app.get("/api/rooms/:roomId", (req, res) => {
  res.json(serializeSession(getSession(req.params.roomId)))
})

app.post("/api/analyze", (req, res) => {
  const latex = String(req.body?.latex || "")
  const temp = {
    roomId: "preview",
    createdAt: nowIso(),
    latex,
    users: new Map(),
    contributions: new Map(),
    history: [],
    builds: [],
    activity: []
  }
  res.json(buildAnalytics(temp))
})

io.on("connection", (socket) => {
  socket.on("session:join", ({ roomId = "paper-demo", username = "Guest", color = "#2563eb" }) => {
    const session = getSession(roomId)
    socket.join(roomId)
    socket.data.roomId = roomId
    socket.data.username = username
    socket.data.color = color

    session.users.set(socket.id, {
      socketId: socket.id,
      username,
      color,
      joinedAt: nowIso(),
      cursor: null
    })
    contributor(session, username, color)
    recordActivity(session, { type: "join", username })
    socket.emit("session:state", serializeSession(session))
    broadcastState(roomId)
  })

  socket.on("editor:change", ({ roomId = socket.data.roomId, username = socket.data.username, color = socket.data.color, latex = "", change = {} }) => {
    const session = getSession(roomId)
    const user = contributor(session, username, color)
    const charsChanged = Math.max(1, Number(change.charsChanged || 0))

    session.latex = String(latex)
    user.edits += 1
    user.charsChanged += charsChanged
    user.lastActive = nowIso()
    recordActivity(session, {
      type: "edit",
      username,
      charsChanged,
      section: sectionAt(session.latex, Number(change.offset || 0))
    })
    broadcastState(roomId)
  })

  socket.on("cursor:update", ({ roomId = socket.data.roomId, cursor }) => {
    const session = getSession(roomId)
    const user = session.users.get(socket.id)
    if (!user) return
    user.cursor = cursor
    user.lastSeenAt = nowIso()
    io.to(roomId).emit("presence:update", Array.from(session.users.values()))
  })

  socket.on("compile:latex", ({ roomId = socket.data.roomId, username = socket.data.username, latex = "" }) => {
    const session = getSession(roomId)
    const started = Date.now()
    session.latex = String(latex)
    const diagnostics = validateLatex(session.latex)
    const errors = diagnostics.filter((item) => item.type === "error").length
    const warnings = diagnostics.filter((item) => item.type === "warning").length
    const build = {
      id: randomUUID(),
      username,
      createdAt: nowIso(),
      status: errors ? "error" : "success",
      durationMs: Date.now() - started + Math.round(session.latex.length / 120),
      errors,
      warnings,
      diagnostics
    }

    session.builds.push(build)
    session.builds = session.builds.slice(-50)
    createSnapshot(session, username, build.status === "success" ? "Compiled successfully" : "Compile failed")
    recordActivity(session, { type: "compile", username, status: build.status })
    io.to(roomId).emit("compile:result", build)
    broadcastState(roomId)
  })

  socket.on("history:snapshot", ({ roomId = socket.data.roomId, username = socket.data.username, latex = "", label = "Manual snapshot" }) => {
    const session = getSession(roomId)
    session.latex = String(latex)
    createSnapshot(session, username, String(label).slice(0, 120))
    recordActivity(session, { type: "snapshot", username })
    broadcastState(roomId)
  })

  socket.on("history:rollback", ({ roomId = socket.data.roomId, username = socket.data.username, versionId }) => {
    const session = getSession(roomId)
    const version = session.history.find((item) => item.id === versionId)
    if (!version) return
    session.latex = version.latex
    createSnapshot(session, username, `Rollback to ${version.label}`)
    recordActivity(session, { type: "rollback", username })
    io.to(roomId).emit("history:rollback", { latex: session.latex })
    broadcastState(roomId)
  })

  socket.on("disconnect", () => {
    const { roomId, username } = socket.data
    if (!roomId) return
    const session = getSession(roomId)
    session.users.delete(socket.id)
    recordActivity(session, { type: "leave", username })
    broadcastState(roomId)
  })
})

const publicDir = join(__dirname, "public")
app.use(express.static(publicDir))
app.use((req, res, next) => {
  const indexFile = join(publicDir, "index.html")
  if (req.method === "GET" && req.accepts("html") && !req.path.startsWith("/api") && existsSync(indexFile)) {
    res.sendFile(indexFile)
    return
  }
  next()
})

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Collaborative LaTeX analytics server is running on port ${PORT}`)
})
