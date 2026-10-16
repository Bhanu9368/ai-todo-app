# AI-Powered To-Do List

A clean, minimalist to-do list web app that automatically categorizes each task as **High**, **Medium**, or **Low** priority using AI, with instant keyword-based fallback rules when no API key is present.

---

## ✨ Features

- **⚡ AI Priority Classification**: Automatically labels each added task as **High**, **Medium**, or **Low**.
- **🛡️ Instant Keyword Fallback**: If no AI API key is configured or the network is unavailable, tasks are classified using built-in priority heuristics (e.g., `urgent`, `deadline`, `tomorrow`, `someday`).
- **✅ Minimalist Workflow**:
  - Add tasks with the input field or Enter key.
  - Mark tasks complete with the circular toggle.
  - Delete tasks with the trash icon.
  - Click any priority badge to cycle / manually adjust its priority if needed.
- **🔒 Zero Database & Zero Login**: State persists in browser `localStorage`.
- **📦 Zero Dependencies**: Runs directly in the browser or via Python standard library.

---

## 🚀 How to Run

You have two simple ways to run this app:

### Option 1: Open Directly in Browser (No Server Needed)
Simply double-click or open `index.html` in any web browser:
```bash
open index.html
```
*(On Windows: `start index.html`, on Linux: `xdg-open index.html`)*

### Option 2: Run with Python Server (Standard Library)
To run a local web server (which can also detect API keys from your environment):
```bash
python3 server.py
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## 🔑 AI Configuration & Fallback Mode

1. **Default (No API Key Required)**:
   - The app starts in **Fallback Rules** mode.
   - It intelligently analyzes keywords and context:
     - **High**: Urgent deadlines, emergencies, critical bugs, ASAP, exams, taxes.
     - **Medium**: Scheduled meetings, tomorrow, follow-ups, reports, reviews.
     - **Low**: Casual reading, movies, chores, someday ideas, grocery shopping.

2. **Using Live AI (Google Gemini or OpenAI)**:
   - **Via UI**: Click the **Fallback Rules** pill in the top-right header, select **Google Gemini** or **OpenAI**, and paste your API key.
   - **Via Environment Variable** (when using `server.py`):
     ```bash
     export GEMINI_API_KEY="your-gemini-api-key"
     python3 server.py
     ```
     or
     ```bash
     export OPENAI_API_KEY="your-openai-api-key"
     python3 server.py
     ```

---

## 📁 File Structure

```
├── index.html   # Semantic, accessible HTML5 interface
├── style.css    # Clean, minimalist styling with dark mode support
├── app.js       # Client-side reactivity, priority routing & fallback rules
├── server.py    # Zero-dependency Python HTTP server & API endpoint
└── README.md    # Documentation
```
