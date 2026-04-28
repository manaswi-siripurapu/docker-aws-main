# Collaborative LaTeX Editor with Analytics

A dockerized real-time collaborative LaTeX editor using React, Monaco, Yjs, Socket.IO, and an Express backend.

## Features

- Real-time multi-user LaTeX editing with CRDT sync.
- Presence tracking with live cursor line/column updates.
- LaTeX syntax highlighting in Monaco.
- Minimal paper-style live preview.
- Compile feedback with LaTeX diagnostics for common structure, brace, environment, and citation issues.
- Snapshot history and rollback.
- Unified analytics dashboard for document health, progress, readability, citations, figures/tables, build trends, revisions, and collaboration.

## Scope

This project does not run a full TeX engine. The preview is an in-app paper preview, and compile feedback is produced by a lightweight LaTeX validator. A full PDF compiler can be added later by installing TeX Live in the Docker image and calling `pdflatex` or `latexmk`.

## Run with Docker

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000
```

Use two browser tabs with different names and the same room to demo collaboration.

## Run Locally

Terminal 1:

```bash
cd Backend
npm install
npm run dev
```

Terminal 2:

```bash
cd Frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```
