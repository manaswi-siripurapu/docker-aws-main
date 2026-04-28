import "./App.css"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useEffect, useMemo, useRef, useState } from "react"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"
import { io } from "socket.io-client"

const STARTER_LATEX = String.raw`\documentclass[9pt,twocolumn,twoside,lineno]{gsag3jnl}
\usepackage{epstopdf}
\articletype{inv} % article type
% {inv} Investigations
% {msr} Mutant Screen Reports
% {gs} Genomic Selection
% {goi} Genetics of Immunity
% {gos} Genetics of Sex
% {mp} Multiparental Populations

\runningtitle{G3 Journal Template on Overleaf} % For use in the footer

%% For the footnote.
%% Give the last name of the first author if only one author;
% \runningauthor{FirstAuthorLastname}
%% last names of both authors if there are two authors;
% \runningauthor{FirstAuthorLastname and SecondAuthorLastname}
%% last name of the first author followed by et al, if more than two authors.
\runningauthor{FirstAuthorLastname \textit{et al.}}

\title{Template for preparing your submission to G3: Genes|Genomes|Genetics using Overleaf}

\author[$\ast$,1]{Author One}
\author[2]{Author Two}
\author[3]{Author Three}
\author[4]{Author Four}
\author[5]{Author Five}

\affil[1]{Author one affiliation}
\affil[2]{Author two affiliation}
\affil[3]{Author three affiliation}
\affil[4]{Author four affiliation}
\affil[5]{Author five affiliation}

\correspondingauthoraffiliation[$\ast$]{Corresponding author: Please insert the email for the corresponding author. The corresponding author should be marked with the relevant number in the author list, as shown in the example.}

\begin{abstract}
The abstract should be written for people who may not read the entire paper, so it must stand on its own. The impression it makes usually determines whether the reader will go on to read the article, so the abstract must be engaging, clear, and concise. In addition, the abstract may be the only part of the article that is indexed in databases, so it must accurately reflect the content of the article. A well-written abstract is the  most effective way to reach intended readers, leading to more robust search, retrieval, and usage of the article.

Please see additional guidelines notes on preparing your abstract below.
\end{abstract}

\keywords{Keyword; Keyword2; Keyword3}

\dates{\rec{xx xx, xxxx} \acc{xx xx, xxxx}}

\begin{document}

\maketitle
\thispagestyle{firststyle}
%\slugnote
\firstpagefootnote
\vspace{-13pt}% Only used for adjusting extra space in the left column of the first page

\noindent This G3: Genes|Genomes|Genetics journal template is provided to help you write your work in the correct journal format. Instructions for use are provided below. Note that by default line numbers are present to aid reviewers and editors in reading and commenting on your manuscript. To remove line numbers, remove the \texttt{lineno} option from the \verb|\documentclass| declaration.

\section{Guide to using this template in Overleaf}

This template is provided to help you prepare your article for submission to G3: Genes|Genomes|Genetics.

\section{Author affiliations}

For the authors' names, indicate different affiliations with the symbols: $\ast$, $\dagger$, $\ddagger$, $\S$. After four authors, the symbols double, triple, quadruple, and so forth as required.

\section{Your abstract}

In addition to the guidelines provided in the example abstract above, your abstract should:

\begin{itemize}
\item provide a synopsis of the entire article;
\item begin with the broad context of the study, followed by specific background for the study;
\item describe the purpose, methods and procedures, core findings and results, and conclusions of the study;
\item emphasize new or important aspects of the research;
\item engage the broad readership of G3 and be understandable to a diverse audience (avoid using jargon);
\item be a single paragraph of less than 250 words;
\item contain the full name of the organism studied;
\item NOT contain citations or abbreviations.
\end{itemize}

\section{Introduction}

Authors should be mindful of the broad readership of the journal and set the stage for the importance of the work to a generalist reader. The scope and impact of the work should be clearly stated.

In individual organisms where a mutant is being studied, the rationale for the study of that mutant must be clear to a geneticist not studying that particular organism. Similarly, study of particular phenotypes should be justified broadly and not on the basis of interest for that organism alone. General background on the importance of the genetic pathway and/or phenotype should be provided in a single, well-reasoned paragraph near the beginning of the introduction.


\section{Materials and methods}
\label{sec:materials:methods}

Manuscripts submitted to G3 should contain a clear description of the experimental design in sufficient detail so that the experimental analysis could be repeated by another scientist. If the level of detail necessary to explain the protocol goes beyond two paragraphs, give a short description in the main body of the paper and prepare a detailed description for supporting information.  For example, details would include indicating how many individuals were used, and if applicable how individuals or groups were combined for analysis. If working with mutants indicate how many independent mutants were isolated. If working with populations\firstpagebreak indicate how samples were collected and whether they were random with respect to the target population.

\subsection{Statistical analysis}

Indicate what statistical analysis has been performed; not just the name of the software and options selected, but the method and model applied. In the case of many genes being examined simultaneously, or many phenotypes, a multiple comparison correction should be used to control the type I error rate, or a rationale for not applying a correction must be provided. The type of correction applied should be clearly stated. It should also be clear whether the p-values reported are raw, or after correction. Corrected~p-values are often appropriate, but raw p-values should be available in the supporting materials so that others may perform their own corrections. In large scale data exploration studies (e.g. genome wide expression studies) a clear and complete description of the replication structure must be provided.


\section{Results and discussion}

The results and discussion should not be repetitive and give a factual presentation of the data with all tables and figures referenced. The discussion should not summarize the results but provide an interpretation of the results, and should clearly delineate between the findings of the particular study and the possible impact of those findings in a larger context. Authors are encouraged to cite recent work relevant to their interpretations. Present and discuss results only once, not in both the Results and Discussion sections. It is acceptable to combine results and discussion in order to be succinct.

\section{Additional guidelines}

\subsection{Numbers} Use numerals rather than words to express whole and decimal numbers in scientific text, titles, headings, tables, and figure captions. Comma for numbers greater than 999.

\subsection{Units} Use abbreviations of the customary units of measurement only when they are preceded by a number: "3 min" but "several minutes". Write "percent" as one word, except when used with a number: "several percent" but "75\%." To indicate temperature in centigrade, use ° (for example, 37°); include a letter after the degree symbol only when some other scale is intended (for example, 45°K).

\subsection{Nomenclature and italicization} Italicize names of organisms even when  when the species is not indicated.  Italicize the first three letters of the names of restriction enzyme cleavage sites, as in HindIII. Write the names of strains in roman except when incorporating specific genotypic designations. Italicize genotype names and symbols, including all components of alleles, but not when the name of a gene is the same as the name of an enzyme. Do not use "+" to indicate wild type. Carefully distinguish between genotype (italicized) and phenotype (not italicized) in both the writing and the symbolism.

\subsection{Cross references}
Use the \verb|\nameref| command with the \verb|\label| command to insert cross-references to section headings. For example, a \verb|\label| has been defined in the section \nameref{sec:materials:methods}.

\section{In-text citations}

Add citations using the \verb|\citep{}| command, for example \citep{neher2013genealogies} or for multiple citations, \citep{neher2013genealogies, rodelsperger2014characterization}.

For examples of different references, please see the example bibliography file (accessible via the Project menu in the Overleaf editor). This contains examples of articles \citep{neher2013genealogies, rodelsperger2014characterization}, a book \citep{Sturtevent2001}, a book chapter \citep{Sturtevent2001chp7}, ahead-of-print work \citep{Starita2015}, a preprint \citep{Falush16} and software \citep{Kruijer2015}.

\section{Examples of article components}
\label{sec:examples}

The sections below show examples of different header levels, which you can use in the primary sections of the manuscript (Results, Discussion, etc.) to organize your content.

\section{First level section header}

Use this level to group two or more closely related headings in a long article.

\subsection{Second level section header}

Second level section text.

\subsubsection{Third level section header:}

Third level section text. These headings may be numbered, but only when the numbers must be cited in the text.

\section{Figures and tables}

Figures and Tables should be labelled and referenced in the standard way using the \verb|\label{}| and \verb|\ref{}| commands.

\subsection{Sample figure}

Figure \ref{fig:spectrum} shows an example figure.

\begin{figure}[t!]
\renewcommand{\familydefault}{\sfdefault}\normalfont
\centering
\includegraphics[width=\linewidth]{example-figure-g3}
\caption{Example figure from \url{http://dx.doi.org/10.1534/g3.115.017509}. Please include your figures in the manuscript for the review process. You can upload figures to Overleaf via the Project menu. Images of photographs or paintings can be provided as raster images. Common examples of raster images are .tif/.tiff, .raw, .gif, and .bmp file types. The resolution of raster files is measured by the number of dots or pixels in a given area, referred to as “dpi” or “ppi.”
\begin{itemize}
\item minimum resolution required for printed images or pictures: 350dpi
\item minimum resolution for printed line art: 600dpi (complex or finely drawn line art should be 1200dpi)
\item minimum resolution for electronic images (i.e., for on-screen viewing): 72dpi
\end{itemize}
Images of maps, charts, graphs, and diagrams are best rendered digitally as geometric forms called vector graphics. Common file types are .eps, .ai, and .pdf. Vector images use mathematical relationships between points and the lines connecting them to describe an image. These file types do not use pixels; therefore resolution does not apply to vector images.
Label multiple figure parts with A, B, etc. in bolded type, and use. Legends should start with a brief title and should be a self-contained description of the content of the figure that provides enough detail to fully understand the data presented. All conventional symbols used to indicate figure data points are available for typesetting; unconventional symbols should not be used. Italicize all mathematical variables (both in the figure legend and figure) , genotypes, and additional symbols that are normally italicized.
}%
\label{fig:spectrum}
\end{figure}


\subsection{Sample table}

Table \ref{tab:shape-functions} shows an example table. Avoid shading, color type, line drawings, graphics, or other illustrations within tables. Use tables for data only; present drawings, graphics, and illustrations as separate figures. Histograms should not be used to present data that can be captured easily in text or small tables, as they take up much more space.

\begin{table*}[p]
\centering
\caption{Students and their grades}
\begin{tableminipage}{\textwidth}
\begin{tabularx}{\textwidth}{@{}XXXX@{}}
\hline
{\bf Student} & {\bf Grade}\footnote{This is an example of a footnote in a table. Lowercase, superscript italic letters (a, b, c, etc.) are used by default. You can also use *, **, and *** to indicate conventional levels of statistical significance, explained below the table.} & {\bf Rank} & {\bf Notes}\\
\hline
Alice & 82\% & 1 & Performed very well.\\
Bob & 65\% & 3 & Not up to his usual standard.\\
Charlie & 73\% & 2 & A good attempt.\\
\hline
\end{tabularx}
  \label{tab:shape-functions}
\end{tableminipage}
\end{table*}

Tables numbers are given in Arabic numerals. Tables should not be numbered 1A, 1B, etc., but if necessary, interior parts of the table can be labeled A, B, etc. for easy reference in the text.

\section{Sample equation}

Let $X_1, X_2, \ldots, X_n$ be a sequence of independent and identically distributed random variables with $\text{E}[X_i] = \mu$ and $\text{Var}[X_i] = \sigma^2 < \infty$, and let
\begin{equation}
S_n = \frac{X_1 + X_2 + \cdots + X_n}{n}
      = \frac{1}{n}\sum_{i}^{n} X_i
\label{eq:refname1}
\end{equation}
denote their mean. Then as $n$ approaches infinity, the random variables $\sqrt{n}(S_n - \mu)$ converge in distribution to a normal $\mathcal{N}(0, \sigma^2)$.

\section{Data availability}

The inclusion of a Data Availability Statement is a requirement for articles published in \textit{G3}. Data Availability Statements provide a standardized format for readers to understand the availability of data underlying the research results described in the article. The statement may refer to original data generated in the course of the study or to third-party data analyzed in the article. The statement should describe and provide means of access, where possible, by linking to the data or providing the required unique identifier.

For example: Strains and plasmids are available upon request. File S1 contains detailed descriptions of all supplemental files. File S2 contains SNP ID numbers and locations. File S3 contains genotypes for each individual. Sequence data are available at GenBank and the accession numbers are listed in File S3. Gene expression data are available at GEO with the accession number: GDS1234. Code used to generate the simulated data can be found at \url{https://figshare.org/record/123456}.

\section{Acknowledgments}
Acknowledgments should be included here.

\section{Funding}
Funding, including Funder Names and Grant numbers should be included here.

\section{Conflicts of interest}
Please either state that you have no conflicts of interest, or list relevant information here.  This would cover any situations that might raise any questions of bias in your work and in your article’s conclusions, implications, or opinions. Please see \url{https://academic.oup.com/journals/pages/authors/authors_faqs/conflicts_of_interest}.

\bibliography{example-bibliography}

\end{document} `

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
          {/* <Panel title="Collaboration Activity">
            <ActivityHeatmap rows={tables.activity || []} />
          </Panel> */}
          <Panel title="Collaboration Activity">
            {(() => {
              const daysInMonth = 30;
              const startOffset = 3; // April 2026 starts on Wednesday (Sun=0)

              // hardcoded activity
              const activity = {
                5: 2,
                10: 4,
                15: 1,
                20: 3,
                25: 2,
                28: 5, // today
              };

              const getColor = (count) => {
                if (!count) return "bg-gray-200";
                if (count <= 2) return "bg-green-200";
                if (count <= 4) return "bg-green-400";
                return "bg-green-600";
              };

              const cells = [];

              // empty cells before month start
              for (let i = 0; i < startOffset; i++) {
                cells.push(<div key={"empty-" + i}></div>);
              }

              // actual days
              for (let d = 1; d <= daysInMonth; d++) {
                const count = activity[d] || 0;

                cells.push(
                  <div
                    key={d}
                    className={`h-16 p-2 rounded-lg text-xs flex flex-col justify-between
                      ${getColor(count)}
                      ${d === 28 ? "ring-2 ring-blue-500 scale-105" : ""}
                    `}
                  >
                    <span className="font-semibold">{d}</span>
                    <span>{count ? `${count} acts` : ""}</span>
                  </div>
                );
              }

              return (
                <div>
                  {/* Week labels */}
                  <div className="grid grid-cols-7 text-xs text-gray-500 mb-2 text-center">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>

                  {/* Calendar */}
                  <div className="grid grid-cols-7 gap-2">{cells}</div>
                </div>
              );
            })()}
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
      <p className="muted">{progress.completionPercent || 0}% of {progress.targetWords || 2500} target words</p>
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
