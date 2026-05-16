# Project Context: Nielsen Software Tracker (Hackathon MVP)

## 1. Project Overview

A software-based alternative to Nielsen's proprietary hardware trackers. The system monitors user behavior across both desktop applications and web browsers, monetizing the user's data (paying them directly) while providing advertisers (Nielsen) with aggregated, privacy-first behavioral analytics and demographic profiling.

## 2. High-Level Architecture

The project is divided into three main components:

### A. Desktop Application (Electron + React)

* **Frameworks:** Electron (Node.js for Main Process, Chromium for Renderer), React + Vite for the UI.
* **Core Logic:** Uses the `active-win` npm package in the Main process to poll active windows every few seconds.
* **Inter-Process Communication (IPC):** The Main process sends sanitized window data via an IPC bridge (`preload.js`) to the React frontend to update the user's real-time dashboard and earnings balance.
* **Privacy Fallback:** Since native OS APIs (Windows/macOS) often restrict reading full URLs from browsers for security, the desktop app primarily extracts domain names and application names from the window `title` (e.g., parsing `"Adidas Shoes - Google Chrome"` to deduce the domain).

### B. Browser Extension (Chrome Manifest V3)

* **Purpose:** To bypass desktop OS restrictions and capture deep, accurate web browsing data (full URLs, search intents) directly from the browser.
* **Communication:** Connects to the Electron Desktop App via a local WebSocket server.
* **Attention Metrics (Anti-Fraud):** Uses a "stopwatch" mechanism via `chrome.tabs.onActivated`, `chrome.tabs.onUpdated`, and `chrome.windows.onFocusChanged` to track *true active attention*. It filters out accidental clicks (sessions under 2 seconds) and pauses the timer if the user minimizes the browser to use another desktop app.

### C. Backend (Firebase + Cloud Functions / Custom Node.js API)

* **Database:** Document-oriented NoSQL database (e.g., Firebase Firestore or MongoDB) to handle flexible schemas for different event types.
* **AI Integration:** An Admin API/Cron Job aggregates raw events daily/hourly into text summaries and sends them to the **Gemini API** using structured JSON output prompts.
* **AI Output:** Gemini generates marketing profiles containing: `estimated_age_group`, `primary_interests`, `brand_affinity`, and `purchase_intent`.

---

## 3. Local Buffering & Offline Support (The Outbox Pattern)

To ensure zero data loss during network outages and to minimize backend API calls, the Electron Main Process uses a local **SQLite** database (`better-sqlite3`) as a persistent buffer.

* **SQLite JSON1 Feature:** Data is stored as JSON strings inside a `TEXT` column, allowing the system to leverage SQLite's native JSON querying capabilities if needed.
* **Buffer Schema:**
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  payload TEXT NOT NULL
);

```


* **Sync Logic:** A background interval fetches a batch of un-synced events (e.g., limit 50), sends them to the backend, and only executes `DELETE FROM events WHERE id IN (...)` upon receiving a `200 OK` response.

---

## 4. Data Models and Event Types

Because desktop and web events differ greatly, the system uses a hybrid schema with rigid base fields for querying and a flexible `payload` object for specific details.

### Event Type 1: Web Browsing (`browser_navigation`)

Sent by the Chrome Extension. URLs are locally sanitized (Edge Computing) to strip sensitive PII/session tokens before leaving the browser, keeping only safe parameters like `?q=` (search query) or `?v=` (video ID).

```json
{
  "event_id": "evt_8f73b",
  "user_id": "usr_123",
  "timestamp": "2026-05-16T19:30:00Z",
  "event_type": "browser_navigation",
  "duration_seconds": 145,
  "payload": {
    "domain": "amazon.com",
    "full_url": "https://www.amazon.com/s?k=macbook+pro",
    "title": "Amazon.com : macbook pro",
    "search_intent": "macbook pro",
    "browser": "Chrome"
  }
}

```

### Event Type 2: Desktop App Focus (`desktop_app_focus`)

Sent by the Electron Main Process via `active-win`.

```json
{
  "event_id": "evt_9a21c",
  "user_id": "usr_123",
  "timestamp": "2026-05-16T19:35:00Z",
  "event_type": "desktop_app_focus",
  "duration_seconds": 3600,
  "payload": {
    "app_name": "Adobe Photoshop",
    "window_title": "hackathon_banner_v3.psd",
    "is_fullscreen": true
  }
}

```

---

## 5. Key Pitch / Business Arguments

* **Reduced CAPEX:** Replaces physical tracking hardware with a lightweight software distribution model.
* **Privacy-by-Design:** Aggregation happens locally. The UI provides total transparency, allowing users to see exactly what is being tracked and delete their history.
* **High-Fidelity Targeting:** Utilizing Gemini LLM to transform noisy, cross-platform behavioral data into structured audience segments that advertisers can immediately action.

```

```