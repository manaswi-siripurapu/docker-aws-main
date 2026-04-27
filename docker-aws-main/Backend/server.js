import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { YSocketIO } from "y-socket.io/dist/server"
import { Worker } from "worker_threads"
import os from "os"
import { existsSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { randomUUID } from "crypto"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3000)
const EXECUTION_TIMEOUT_MS = Number(process.env.EXECUTION_TIMEOUT_MS || 2500)
const MAX_CODE_LENGTH = Number(process.env.MAX_CODE_LENGTH || 120000)

const DEFAULT_CODE = `const data = [
  { month: "Jan", users: 120, latency: 92 },
  { month: "Feb", users: 180, latency: 88 },
  { month: "Mar", users: 260, latency: 80 },
  { month: "Apr", users: 310, latency: 74 }
]

console.log(JSON.stringify(data, null, 2))
return data`

const DEMO_PROJECTS = [
  {
    id: "sales-insights",
    name: "Retail Sales Insights",
    description: "Monthly sales, region mix, and conversion data.",
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
        path: "src/summary.js",
        language: "javascript",
        content: `const channels = [
  { channel: "Search", sessions: 1450, conversion: 5.8 },
  { channel: "Social", sessions: 980, conversion: 3.4 },
  { channel: "Email", sessions: 760, conversion: 8.1 },
  { channel: "Referral", sessions: 430, conversion: 4.9 }
]

console.table(channels)
return channels`
      }
    ]
  },
  {
    id: "iot-energy",
    name: "IoT Energy Monitor",
    description: "Sensor readings with anomaly-friendly spikes.",
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
    description: "Assessment scores, attendance, and study hours.",
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

function getProject(projectId = "sales-insights") {
  return DEMO_PROJECTS.find((project) => project.id === projectId) || DEMO_PROJECTS[0]
}

function getSession(roomId = "main", projectId = "sales-insights") {
  if (!sessions.has(roomId)) {
    const project = getProject(projectId)
    const files = new Map(
      project.files.map((file) => [
        file.id,
        {
          ...file,
          code: file.content,
          updatedAt: nowIso(),
          updatedBy: "System"
        }
      ])
    )

    sessions.set(roomId, {
      roomId,
      projectId: project.id,
      createdAt: nowIso(),
      latestCode: project.files[0]?.content || DEFAULT_CODE,
      activeFileId: project.files[0]?.id || "main",
      files,
      users: new Map(),
      contributions: new Map(),
      comments: [],
      history: [],
      runs: [],
      outputs: [],
      activity: []
    })
  }

  return sessions.get(roomId)
}

function getContributor(session, username, color = "#38bdf8") {
  if (!session.contributions.has(username)) {
    session.contributions.set(username, {
      username,
      color,
      edits: 0,
      charsChanged: 0,
      linesTouched: 0,
      firstActive: nowIso(),
      lastActive: nowIso()
    })
  }

  return session.contributions.get(username)
}

function serializeSession(session) {
  return {
    roomId: session.roomId,
    projectId: session.projectId,
    activeFileId: session.activeFileId,
    createdAt: session.createdAt,
    latestCode: session.latestCode,
    demoProjects: DEMO_PROJECTS.map(({ files, ...project }) => ({
      ...project,
      fileCount: files.length
    })),
    files: Array.from(session.files.values()).map(({ content, ...file }) => file),
    users: Array.from(session.users.values()),
    comments: session.comments,
    history: session.history.map(({ code, ...entry }) => ({
      ...entry,
      code,
      lines: code.split("\n").length,
      chars: code.length
    })),
    analytics: buildAnalytics(session)
  }
}

function buildAnalytics(session) {
  const contributors = Array.from(session.contributions.values())
  const totalChars = contributors.reduce((sum, user) => sum + user.charsChanged, 0)
  const totalEdits = contributors.reduce((sum, user) => sum + user.edits, 0)
  const activeUsers = Array.from(session.users.values())
  const runs = session.runs
  const lastRun = runs.at(-1) || null
  const successfulRuns = runs.filter((run) => run.status === "success")
  const avgDurationMs = average(runs.map((run) => run.metrics.durationMs))
  const avgCpuMs = average(runs.map((run) => run.metrics.cpuMs))
  const avgMemoryMb = average(runs.map((run) => run.metrics.memoryDeltaMb))
  const errorRate = runs.length ? (runs.length - successfulRuns.length) / runs.length : 0

  return {
    generatedAt: nowIso(),
    overview: {
      activeUsers: activeUsers.length,
      totalEdits,
      totalChars,
      openComments: session.comments.filter((comment) => !comment.resolved).length,
      versions: session.history.length,
      totalRuns: runs.length,
      files: session.files.size
    },
    contributions: contributors
      .map((user) => {
        const minutesActive = Math.max(
          1 / 60,
          (Date.now() - new Date(user.firstActive).getTime()) / 60000
        )

        return {
          ...user,
          contributionPercent: totalChars ? Math.round((user.charsChanged / totalChars) * 100) : 0,
          editFrequency: Number((user.edits / minutesActive).toFixed(2))
        }
      })
      .sort((a, b) => b.charsChanged - a.charsChanged),
    execution: {
      lastRun,
      avgDurationMs,
      avgCpuMs,
      avgMemoryMb,
      errorRate: Number((errorRate * 100).toFixed(1)),
      performanceTrend: buildPerformanceTrend(runs),
      bottlenecks: detectBottlenecks(runs)
    },
    data: analyzeDataOutput(session.outputs.at(-1)),
    versionChanges: analyzeVersionChanges(session)
  }
}

function buildPerformanceTrend(runs) {
  return runs.slice(-10).map((run, index) => ({
    label: `Run ${Math.max(1, runs.length - runs.slice(-10).length + index + 1)}`,
    durationMs: run.metrics.durationMs,
    cpuMs: run.metrics.cpuMs,
    memoryDeltaMb: run.metrics.memoryDeltaMb,
    status: run.status
  }))
}

function analyzeVersionChanges(session) {
  const byFile = new Map()
  for (const version of session.history) {
    const key = version.fileId || "main"
    if (!byFile.has(key)) byFile.set(key, [])
    byFile.get(key).push(version)
  }

  return Array.from(byFile.entries()).map(([fileId, versions]) => {
    const currentFile = session.files.get(fileId)
    const latest = versions.at(-1)
    const previous = versions.at(-2)
    const changeSize = previous ? Math.abs((latest?.code.length || 0) - previous.code.length) : latest?.code.length || 0

    return {
      fileId,
      path: currentFile?.path || latest?.path || fileId,
      versions: versions.length,
      latestAuthor: latest?.author || "Unknown",
      latestLabel: latest?.label || "No version",
      changeSize
    }
  })
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value))
  if (!clean.length) return 0
  return Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(2))
}

function detectBottlenecks(runs) {
  const lastRun = runs.at(-1)
  if (!lastRun) return ["Run code to collect execution metrics and bottleneck hints."]

  const hints = []
  if (lastRun.status === "error") {
    hints.push("Last execution failed. Check the error trace before optimizing performance.")
  }
  if (lastRun.metrics.durationMs > 1000) {
    hints.push("Execution time is high. Look for nested loops, repeated parsing, or expensive synchronous work.")
  }
  if (lastRun.metrics.memoryDeltaMb > 32) {
    hints.push("Memory growth is noticeable. Stream large datasets or avoid copying arrays repeatedly.")
  }
  if (lastRun.metrics.cpuMs > lastRun.metrics.durationMs * 0.8) {
    hints.push("CPU usage dominates runtime. Consider caching repeated computations.")
  }

  return hints.length ? hints : ["No obvious bottleneck in the latest run."]
}

function analyzeDataOutput(output) {
  const empty = {
    summary: "No structured data captured yet.",
    plainEnglish: "Run code that returns JSON, arrays, CSV-like text, or tables to unlock automatic analysis.",
    stats: [],
    trends: [],
    anomalies: [],
    table: { columns: [], rows: [] },
    charts: [],
    visualizations: ["Run code that returns JSON, arrays, CSV-like text, or tables to unlock dashboard suggestions."]
  }

  if (!output) {
    return empty
  }

  const data = coerceStructuredData(output.result) ?? coerceStructuredData(output.logs.join("\n")) ?? parseCsvLike(output.logs.join("\n"))
  const table = normalizeTable(data)
  if (!table.rows.length) {
    return {
      summary: "Output was textual. No tabular or numeric data could be detected.",
      plainEnglish: "The latest run produced logs, but they do not look like JSON, arrays, CSV, or a numeric table.",
      stats: [],
      trends: [],
      anomalies: [],
      table: { columns: [], rows: [] },
      charts: [],
      visualizations: ["Show logs as a timeline or searchable console."]
    }
  }

  const numericFields = table.columns.filter((field) => table.rows.some((row) => Number.isFinite(Number(row[field]))))
  const labelFields = table.columns.filter((field) => !numericFields.includes(field))
  const stats = numericFields.map((field) => numericStats(field, table.rows.map((row) => Number(row[field])).filter(Number.isFinite)))
  const trends = numericFields.map((field) => trendForSeries(field, table.rows.map((row) => Number(row[field])).filter(Number.isFinite)))
  const anomalies = detectAnomalies(table.rows, numericFields)
  const charts = buildChartSuggestions(table, numericFields, labelFields)
  const visualizations = charts.map((chart) => `${chart.type} chart: ${chart.title}`)

  return {
    summary: `Detected ${table.rows.length} row(s), ${table.columns.length} column(s), and ${numericFields.length} numeric field(s).`,
    plainEnglish: summarizeAnalyzedOutput(table, numericFields, trends, anomalies),
    stats,
    trends,
    anomalies,
    table,
    charts,
    visualizations: visualizations.length ? visualizations : ["Structured table preview"]
  }
}

function coerceStructuredData(value) {
  if (value && typeof value === "object") return value
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
    if (!match) return null
    try {
      return JSON.parse(match[1])
    } catch {
      return null
    }
  }
}

function parseCsvLike(value) {
  if (typeof value !== "string") return null
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("WARN:") && !line.startsWith("ERROR:"))

  const delimiter = [",", "\t", "|"].find((candidate) => lines.filter((line) => line.includes(candidate)).length >= 2)
  if (!delimiter) return null

  const rows = lines
    .filter((line) => line.includes(delimiter))
    .map((line) => line.split(delimiter).map((part) => part.trim()))
  if (rows.length < 2) return null

  const firstRow = rows[0]
  const firstRowHasText = firstRow.some((cell) => !Number.isFinite(Number(cell)))
  const headers = firstRowHasText ? firstRow : firstRow.map((_, index) => `column${index + 1}`)
  const dataRows = firstRowHasText ? rows.slice(1) : rows

  return dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header || `column${index + 1}`, coerceCell(row[index])]))
  )
}

function coerceCell(value = "") {
  const numeric = Number(value)
  return Number.isFinite(numeric) && value.trim() !== "" ? numeric : value
}

function normalizeTable(data) {
  if (Array.isArray(data) && data.every((value) => typeof value === "number")) {
    return {
      columns: ["index", "value"],
      rows: data.map((value, index) => ({ index: index + 1, value }))
    }
  }

  if (Array.isArray(data) && data.every((value) => value && typeof value === "object" && !Array.isArray(value))) {
    const columns = Array.from(new Set(data.flatMap((row) => Object.keys(row))))
    return {
      columns,
      rows: data.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? ""])))
    }
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return {
      columns: ["key", "value"],
      rows: Object.entries(data).map(([key, value]) => ({ key, value }))
    }
  }

  return { columns: [], rows: [] }
}

function detectAnomalies(rows, numericFields) {
  const anomalies = []
  for (const field of numericFields) {
    const values = rows.map((row) => Number(row[field])).filter(Number.isFinite)
    if (values.length < 4) continue
    const stats = numericStats(field, values)
    const threshold = Math.max(stats.standardDeviation * 1.5, 0.0001)
    rows.forEach((row, index) => {
      const value = Number(row[field])
      if (Number.isFinite(value) && Math.abs(value - stats.mean) > threshold) {
        anomalies.push({
          row: index + 1,
          field,
          value,
          reason: value > stats.mean ? "Above typical range" : "Below typical range"
        })
      }
    })
  }
  return anomalies.slice(0, 20)
}

function buildChartSuggestions(table, numericFields, labelFields) {
  const firstLabel = labelFields[0] || "index"
  const firstNumeric = numericFields[0]
  const secondNumeric = numericFields[1]
  const charts = []

  if (!firstNumeric) return charts

  charts.push({
    type: "bar",
    title: `${firstNumeric} by ${firstLabel}`,
    xKey: firstLabel,
    yKey: firstNumeric,
    data: table.rows.slice(0, 12).map((row, index) => ({
      label: String(row[firstLabel] ?? index + 1),
      value: Number(row[firstNumeric])
    }))
  })

  charts.push({
    type: "line",
    title: `${firstNumeric} trend`,
    xKey: firstLabel,
    yKey: firstNumeric,
    data: table.rows.slice(0, 20).map((row, index) => ({
      label: String(row[firstLabel] ?? index + 1),
      value: Number(row[firstNumeric])
    }))
  })

  charts.push({
    type: "histogram",
    title: `${firstNumeric} distribution`,
    xKey: firstNumeric,
    yKey: "count",
    data: buildHistogram(table.rows.map((row) => Number(row[firstNumeric])).filter(Number.isFinite))
  })

  if (secondNumeric) {
    charts.push({
      type: "scatter",
      title: `${firstNumeric} vs ${secondNumeric}`,
      xKey: firstNumeric,
      yKey: secondNumeric,
      data: table.rows.slice(0, 25).map((row) => ({
        x: Number(row[firstNumeric]),
        y: Number(row[secondNumeric])
      }))
    })
  }

  if (labelFields.length && table.rows.length <= 12) {
    const total = table.rows.reduce((sum, row) => sum + Number(row[firstNumeric] || 0), 0)
    if (total > 0) {
      charts.push({
        type: "pie",
        title: `${firstNumeric} share`,
        xKey: firstLabel,
        yKey: firstNumeric,
        data: table.rows.map((row, index) => ({
          label: String(row[firstLabel] ?? index + 1),
          value: Number(row[firstNumeric])
        }))
      })
    }
  }

  return charts
}

function buildHistogram(values) {
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const bucketCount = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(values.length))))
  const size = (max - min || 1) / bucketCount
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: `${Number((min + index * size).toFixed(1))}-${Number((min + (index + 1) * size).toFixed(1))}`,
    value: 0
  }))
  for (const value of values) {
    const index = Math.min(bucketCount - 1, Math.floor((value - min) / size))
    buckets[index].value += 1
  }
  return buckets
}

function summarizeAnalyzedOutput(table, numericFields, trends, anomalies) {
  if (!numericFields.length) {
    return `The output is structured as ${table.rows.length} row(s), but no numeric field was found for statistical analysis.`
  }

  const trendText = trends
    .slice(0, 2)
    .map((trend) => `${trend.field} is ${trend.direction}`)
    .join(", ")
  const anomalyText = anomalies.length ? `${anomalies.length} possible anomaly value(s) were highlighted.` : "No strong anomalies were found."
  return `The output contains ${numericFields.join(", ")}. ${trendText || "Trends are mostly flat"}. ${anomalyText}`
}

function numericStats(field, values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) {
    return { field, count: 0, min: 0, max: 0, mean: 0, median: 0, standardDeviation: 0 }
  }

  const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length
  const variance = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / clean.length
  const middle = Math.floor(clean.length / 2)
  const median = clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2

  return {
    field,
    count: clean.length,
    min: clean[0],
    max: clean.at(-1),
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    standardDeviation: Number(Math.sqrt(variance).toFixed(2))
  }
}

function trendForSeries(field, values) {
  if (values.length < 2) return { field, direction: "flat", changePercent: 0 }
  const first = values[0]
  const last = values.at(-1)
  const changePercent = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100
  const direction = changePercent > 5 ? "up" : changePercent < -5 ? "down" : "flat"
  return { field, direction, changePercent: Number(changePercent.toFixed(1)) }
}

function addSnapshot(session, author, code, label = "Manual save", fileId = session.activeFileId) {
  const file = session.files.get(fileId)
  const snapshot = {
    id: randomUUID(),
    fileId,
    path: file?.path || fileId,
    author,
    label,
    createdAt: nowIso(),
    code
  }

  session.history.push(snapshot)
  session.history = session.history.slice(-25)
  session.latestCode = code
  return snapshot
}

function recordActivity(session, event) {
  session.activity.push({ id: randomUUID(), at: nowIso(), ...event })
  session.activity = session.activity.slice(-100)
}

async function executeJavaScript(code) {
  if (code.length > MAX_CODE_LENGTH) {
    return {
      status: "error",
      error: `Code is too large. Limit is ${MAX_CODE_LENGTH} characters.`,
      logs: [],
      result: null,
      metrics: emptyMetrics()
    }
  }

  return new Promise((resolve) => {
    const worker = new Worker(
      `
        import { parentPort, workerData } from "worker_threads"
        import { performance } from "perf_hooks"
        import vm from "vm"

        const logs = []
        const format = (value) => {
          if (typeof value === "string") return value
          try {
            return JSON.stringify(value)
          } catch {
            return String(value)
          }
        }
        const serialize = (value) => {
          if (value === undefined) return null
          if (typeof value === "function") return "[Function]"
          try {
            return JSON.parse(JSON.stringify(value))
          } catch {
            return String(value)
          }
        }

        const consoleProxy = {
          log: (...args) => logs.push(args.map(format).join(" ")),
          info: (...args) => logs.push(args.map(format).join(" ")),
          warn: (...args) => logs.push("WARN: " + args.map(format).join(" ")),
          error: (...args) => logs.push("ERROR: " + args.map(format).join(" "))
        }

        const context = vm.createContext({
          console: consoleProxy,
          Math,
          JSON,
          Number,
          String,
          Boolean,
          Array,
          Object,
          Date,
          RegExp,
          Set,
          Map,
          Intl,
          URL,
          URLSearchParams,
          structuredClone
        })

        const run = async () => {
          const startedAt = performance.now()
          const cpuStart = process.cpuUsage()
          const memoryStart = process.memoryUsage().heapUsed
          let status = "success"
          let result = null
          let error = null

          try {
            const script = new vm.Script("(async () => {\\n" + workerData.code + "\\n})()", { filename: "workspace.js" })
            result = await script.runInContext(context, { timeout: workerData.timeoutMs })
          } catch (runError) {
            status = "error"
            error = runError && runError.stack ? runError.stack : String(runError)
          }

          const cpu = process.cpuUsage(cpuStart)
          const memoryEnd = process.memoryUsage().heapUsed
          parentPort.postMessage({
            status,
            error,
            logs,
            result: serialize(result),
            metrics: {
              durationMs: Number((performance.now() - startedAt).toFixed(2)),
              cpuMs: Number(((cpu.user + cpu.system) / 1000).toFixed(2)),
              memoryDeltaMb: Number(((memoryEnd - memoryStart) / 1024 / 1024).toFixed(2))
            }
          })
        }

        run()
      `,
      {
        eval: true,
        workerData: {
          code,
          timeoutMs: EXECUTION_TIMEOUT_MS
        }
      }
    )

    const timeout = setTimeout(async () => {
      await worker.terminate()
      resolve({
        status: "error",
        error: `Execution timed out after ${EXECUTION_TIMEOUT_MS}ms.`,
        logs: [],
        result: null,
        metrics: emptyMetrics()
      })
    }, EXECUTION_TIMEOUT_MS + 250)

    worker.once("message", (message) => {
      clearTimeout(timeout)
      resolve(message)
    })

    worker.once("error", (error) => {
      clearTimeout(timeout)
      resolve({
        status: "error",
        error: error.stack || error.message,
        logs: [],
        result: null,
        metrics: emptyMetrics()
      })
    })
  })
}

function emptyMetrics() {
  return { durationMs: 0, cpuMs: 0, memoryDeltaMb: 0 }
}

function broadcastState(roomId) {
  const session = getSession(roomId)
  io.to(roomId).emit("analytics:update", serializeSession(session))
}

app.get("/health", (req, res) => {
  res.status(200).json({
    message: "ok",
    success: true,
    uptimeSeconds: Math.round(process.uptime()),
    cpuCores: os.cpus().length
  })
})

app.get("/api/rooms/:roomId", (req, res) => {
  res.json(serializeSession(getSession(req.params.roomId)))
})

app.post("/api/execute", async (req, res) => {
  const result = await executeJavaScript(String(req.body?.code || ""))
  res.json({
    ...result,
    analysis: analyzeDataOutput(result)
  })
})

io.on("connection", (socket) => {
  socket.on("session:join", ({ roomId = "main", projectId = "sales-insights", username = "Guest", color = "#38bdf8" }) => {
    const session = getSession(roomId, projectId)
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
    getContributor(session, username, color).lastActive = nowIso()
    recordActivity(session, { type: "join", username })

    socket.emit("session:state", serializeSession(session))
    broadcastState(roomId)
  })

  socket.on("editor:change", ({ roomId = socket.data.roomId, username = socket.data.username, color = socket.data.color, fileId, code = "", change = {} }) => {
    const session = getSession(roomId)
    const activeFileId = fileId || session.activeFileId
    const file = session.files.get(activeFileId)
    const contributor = getContributor(session, username, color)
    const charsChanged = Math.max(1, Number(change.charsChanged || 0))
    const linesTouched = Math.max(1, Number(change.linesTouched || 1))

    contributor.edits += 1
    contributor.charsChanged += charsChanged
    contributor.linesTouched += linesTouched
    contributor.lastActive = nowIso()
    session.latestCode = String(code)
    session.activeFileId = activeFileId
    if (file) {
      file.code = String(code)
      file.updatedAt = nowIso()
      file.updatedBy = username
    }
    recordActivity(session, { type: "edit", username, fileId: activeFileId, path: file?.path, charsChanged, linesTouched })
    broadcastState(roomId)
  })

  socket.on("cursor:update", ({ roomId = socket.data.roomId, username = socket.data.username, cursor }) => {
    const session = getSession(roomId)
    const user = session.users.get(socket.id)
    if (user) {
      user.cursor = cursor
      user.lastSeenAt = nowIso()
      io.to(roomId).emit("presence:update", Array.from(session.users.values()))
    }
  })

  socket.on("comments:add", ({ roomId = socket.data.roomId, username = socket.data.username, fileId, lineNumber = 1, text = "" }) => {
    const session = getSession(roomId)
    const activeFileId = fileId || session.activeFileId
    const file = session.files.get(activeFileId)
    const comment = {
      id: randomUUID(),
      fileId: activeFileId,
      path: file?.path || activeFileId,
      author: username,
      lineNumber: Math.max(1, Number(lineNumber || 1)),
      text: String(text).slice(0, 500),
      resolved: false,
      createdAt: nowIso()
    }
    session.comments.push(comment)
    recordActivity(session, { type: "comment", username, fileId: activeFileId, lineNumber: comment.lineNumber })
    io.to(roomId).emit("comments:update", session.comments)
    broadcastState(roomId)
  })

  socket.on("comments:resolve", ({ roomId = socket.data.roomId, commentId }) => {
    const session = getSession(roomId)
    const comment = session.comments.find((item) => item.id === commentId)
    if (comment) {
      comment.resolved = true
      comment.resolvedAt = nowIso()
      comment.resolvedBy = socket.data.username
      io.to(roomId).emit("comments:update", session.comments)
      broadcastState(roomId)
    }
  })

  socket.on("history:snapshot", ({ roomId = socket.data.roomId, username = socket.data.username, fileId, code = "", label = "Manual save" }) => {
    const session = getSession(roomId)
    const activeFileId = fileId || session.activeFileId
    addSnapshot(session, username, String(code), String(label).slice(0, 120), activeFileId)
    recordActivity(session, { type: "snapshot", username, fileId: activeFileId })
    io.to(roomId).emit("history:update", serializeSession(session).history)
    broadcastState(roomId)
  })

  socket.on("run:code", async ({ roomId = socket.data.roomId, username = socket.data.username, fileId, code = "" }) => {
    const session = getSession(roomId)
    const activeFileId = fileId || session.activeFileId
    const file = session.files.get(activeFileId)
    const result = await executeJavaScript(String(code))
    const run = {
      id: randomUUID(),
      fileId: activeFileId,
      path: file?.path || activeFileId,
      username,
      createdAt: nowIso(),
      status: result.status,
      error: result.error,
      logs: result.logs,
      result: result.result,
      metrics: result.metrics
    }

    session.latestCode = String(code)
    session.activeFileId = activeFileId
    if (file) {
      file.code = String(code)
      file.updatedAt = nowIso()
      file.updatedBy = username
    }
    session.runs.push(run)
    session.runs = session.runs.slice(-50)
    session.outputs.push(run)
    session.outputs = session.outputs.slice(-25)
    addSnapshot(session, username, String(code), result.status === "success" ? "Run succeeded" : "Run failed", activeFileId)
    recordActivity(session, { type: "run", username, fileId: activeFileId, status: result.status })

    io.to(roomId).emit("run:result", {
      ...run,
      analysis: analyzeDataOutput(run)
    })
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

httpServer.listen(PORT, () => {
  console.log(`Collaborative code analytics server is running on port ${PORT}`)
})
