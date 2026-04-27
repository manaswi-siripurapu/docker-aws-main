# Realtime Collaborative Code Analytics

A dockerized realtime JavaScript coding platform with Monaco, Yjs collaboration, Socket.IO presence, live cursor tracking, project/file navigation, inline comments, basic version history, execution logs, runtime metrics, data-output analysis, charts, exports, and collaboration analytics.

## What It Runs

- Code execution currently supports JavaScript.
- JavaScript runs on the backend inside a timed Node worker.
- The editor can collaborate across multiple files in a selected demo project.

## Demo Projects

- Retail Sales Insights: sales, orders, returns, and channel conversion data.
- IoT Energy Monitor: sensor readings, CSV-like logs, and anomaly-friendly spikes.
- Student Performance Lab: attendance, study-hours, scores, and a deliberate error example.

Open the Analytics button after running code to view execution metrics, output analysis, error logs, collaboration behavior, version changes, and performance trends.

## Run with Docker

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000
```

Use different browser tabs with different names and the same room name to test collaboration.

## Run locally for development

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

Open the Vite URL, usually:

```text
http://localhost:5173
```

## Notes

- Code execution is JavaScript-only and runs inside a timed Node worker.
- Room state, project files, comments, history, runs, and analytics are stored in memory for this project version.
- The production Docker image builds the frontend and serves it from the backend on port `3000`.
