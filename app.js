/**
 * Tiny AI-Powered To-Do List Web App
 * Supports live Gemini / OpenAI classification and intelligent keyword fallback rules.
 */

// Keyword rule dictionaries for fallback classification
const HIGH_KEYWORDS = [
  /\burgent\b/i, /\basap\b/i, /\bemergency\b/i, /\bcritical\b/i, /\bimmediat(e|ely)\b/i,
  /\bdeadline\b/i, /\bdue today\b/i, /\btoday\b/i, /\btonight\b/i, /\bright now\b/i,
  /\bcrucial\b/i, /\bvital\b/i, /\boutage\b/i, /\bcrash\b/i, /\bblocker\b/i,
  /\bfix\b/i, /\bbug\b/i, /\bfire\b/i, /\bhospital\b/i, /\bdoctor\b/i, /\btax(es)?\b/i,
  /\binterview\b/i, /\bexam\b/i, /\beod\b/i, /\bstat\b/i, /\bsecurity\b/i, /\bincident\b/i
];

const MEDIUM_KEYWORDS = [
  /\btomorrow\b/i, /\bthis week\b/i, /\bschedule\b/i, /\bmeeting\b/i, /\bsync\b/i,
  /\breview\b/i, /\bdraft\b/i, /\bprepare\b/i, /\bfollow[- ]up\b/i, /\bemail\b/i,
  /\bsend\b/i, /\bsubmit\b/i, /\bplan\b/i, /\borganize\b/i, /\breport\b/i,
  /\bupdate\b/i, /\bappointment\b/i, /\bcall\b/i, /\bpay\b/i, /\bbill\b/i,
  /\binvoice\b/i, /\bdiscuss\b/i, /\bpresentation\b/i, /\bstandup\b/i, /\brenew\b/i
];

const LOW_KEYWORDS = [
  /\bsomeday\b/i, /\bmaybe\b/i, /\blater\b/i, /\bwhen free\b/i, /\bread\b/i,
  /\bbook\b/i, /\bwatch\b/i, /\bmovie\b/i, /\bshow\b/i, /\bpodcast\b/i,
  /\bbrowse\b/i, /\bclean\b/i, /\bvacuum\b/i, /\btidy\b/i, /\bwater plants?\b/i,
  /\bhobby\b/i, /\bwalk\b/i, /\bcasual\b/i, /\brecipe\b/i, /\bidea\b/i,
  /\bgrocery\b/i, /\bgroceries\b/i, /\bbuy\b/i, /\bshop\b/i, /\blaundry\b/i
];

// App State
let tasks = [];
let serverStatus = { gemini_configured: false, openai_configured: false };
let settings = {
  provider: "fallback", // "fallback", "gemini", "openai"
  apiKey: ""
};

// DOM Elements
const taskInput = document.getElementById("taskInput");
const todoForm = document.getElementById("todoForm");
const addBtn = document.getElementById("addBtn");
const btnText = document.getElementById("btnText");
const btnSpinner = document.getElementById("btnSpinner");
const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");
const listFooter = document.getElementById("listFooter");
const itemsLeft = document.getElementById("itemsLeft");
const clearCompletedBtn = document.getElementById("clearCompletedBtn");

const statusPill = document.getElementById("statusPill");
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");

const settingsModal = document.getElementById("settingsModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const providerSelect = document.getElementById("providerSelect");
const apiKeySection = document.getElementById("apiKeySection");
const apiKeyInput = document.getElementById("apiKeyInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

// LocalStorage Keys
const STORAGE_TASKS_KEY = "ai_todo_tasks";
const STORAGE_SETTINGS_KEY = "ai_todo_settings";

/**
 * Keyword-based Fallback Priority Classifier
 */
function classifyPriorityFallback(text) {
  for (const regex of HIGH_KEYWORDS) {
    if (regex.test(text)) return "High";
  }
  for (const regex of MEDIUM_KEYWORDS) {
    if (regex.test(text)) return "Medium";
  }
  for (const regex of LOW_KEYWORDS) {
    if (regex.test(text)) return "Low";
  }
  // Default heuristic
  const words = text.trim().split(/\s+/);
  return words.length > 3 ? "Medium" : "Low";
}

/**
 * Call Google Gemini REST API directly
 */
async function classifyWithGemini(task, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  const prompt = `Classify the priority of the following to-do task as exactly one word: High, Medium, or Low.
- High: urgent, today, critical emergencies, severe consequences if missed.
- Medium: important tasks, meetings, standard work deadlines, scheduled items.
- Low: casual tasks, errands, reading, non-urgent hobbies, someday items.

Task: "${task}"

Respond with ONLY one word: High, Medium, or Low.`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 10 }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const result = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  for (const p of ["High", "Medium", "Low"]) {
    if (result.toLowerCase().includes(p.toLowerCase())) return p;
  }
  return null;
}

/**
 * Call OpenAI REST API directly
 */
async function classifyWithOpenAI(task, key) {
  const url = "https://api.openai.com/v1/chat/completions";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a to-do prioritization assistant. Classify tasks as High, Medium, or Low. Respond with ONLY one word: High, Medium, or Low."
        },
        { role: "user", content: `Task: "${task}"` }
      ],
      temperature: 0.1,
      max_tokens: 10
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const result = data?.choices?.[0]?.message?.content?.trim() || "";
  for (const p of ["High", "Medium", "Low"]) {
    if (result.toLowerCase().includes(p.toLowerCase())) return p;
  }
  return null;
}

/**
 * Main AI / Fallback Priority Classifier Router
 */
async function getTaskPriority(taskText) {
  // 1. Try local server endpoint if running via server.py
  try {
    const serverResp = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: taskText,
        api_key: settings.apiKey,
        provider: settings.provider
      })
    });
    if (serverResp.ok) {
      const data = await serverResp.json();
      if (data.priority) return data.priority;
    }
  } catch (err) {
    // Server not running or direct file protocol, continue to client-side logic
  }

  // 2. Client-side live AI if key is configured
  if (settings.provider === "gemini" && settings.apiKey) {
    try {
      const priority = await classifyWithGemini(taskText, settings.apiKey);
      if (priority) return priority;
    } catch (e) {
      console.warn("Client Gemini call failed, falling back to keywords:", e);
    }
  } else if (settings.provider === "openai" && settings.apiKey) {
    try {
      const priority = await classifyWithOpenAI(taskText, settings.apiKey);
      if (priority) return priority;
    } catch (e) {
      console.warn("Client OpenAI call failed, falling back to keywords:", e);
    }
  }

  // 3. Fallback to Keyword Rules
  return classifyPriorityFallback(taskText);
}

/**
 * Render the Task List
 */
function renderTasks() {
  taskList.innerHTML = "";

  if (tasks.length === 0) {
    emptyState.style.display = "block";
    listFooter.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  listFooter.style.display = "flex";

  const remaining = tasks.filter((t) => !t.completed).length;
  itemsLeft.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;

  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""}`;
    li.dataset.id = task.id;

    // Checkbox
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Mark "${task.text}" as done`);
    checkbox.addEventListener("change", () => toggleTask(task.id));

    // Text Content
    const span = document.createElement("span");
    span.className = "task-content";
    span.textContent = task.text;

    // Priority Badge
    const badge = document.createElement("span");
    const priorityClass = `priority-${task.priority.toLowerCase()}`;
    badge.className = `priority-badge ${priorityClass}`;
    badge.title = "Click to cycle priority (High -> Medium -> Low)";
    badge.innerHTML = `<span class="dot"></span>${task.priority}`;
    badge.style.cursor = "pointer";
    badge.addEventListener("click", () => cyclePriority(task.id));

    // Delete Button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.title = "Delete task";
    deleteBtn.setAttribute("aria-label", `Delete "${task.text}"`);
    deleteBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(badge);
    li.appendChild(deleteBtn);

    taskList.appendChild(li);
  });
}

/**
 * Task Actions
 */
async function addTask(text) {
  const cleanText = text.trim();
  if (!cleanText) return;

  // Set loading state
  addBtn.disabled = true;
  btnText.style.display = "none";
  btnSpinner.style.display = "block";

  try {
    const priority = await getTaskPriority(cleanText);
    const newTask = {
      id: Date.now().toString(),
      text: cleanText,
      priority: priority,
      completed: false,
      createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    saveTasks();
    renderTasks();
    taskInput.value = "";
    taskInput.focus();
  } catch (err) {
    console.error("Failed to add task:", err);
  } finally {
    addBtn.disabled = false;
    btnText.style.display = "inline";
    btnSpinner.style.display = "none";
  }
}

function toggleTask(id) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  renderTasks();
}

function cyclePriority(id) {
  const order = ["High", "Medium", "Low"];
  tasks = tasks.map((t) => {
    if (t.id === id) {
      const nextIdx = (order.indexOf(t.priority) + 1) % order.length;
      return { ...t, priority: order[nextIdx] };
    }
    return t;
  });
  saveTasks();
  renderTasks();
}

function clearCompleted() {
  tasks = tasks.filter((t) => !t.completed);
  saveTasks();
  renderTasks();
}

function saveTasks() {
  localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_TASKS_KEY);
    if (saved) {
      tasks = JSON.parse(saved);
    } else {
      // Default sample tasks to demonstrate
      tasks = [
        {
          id: "1",
          text: "Fix urgent database connection timeout",
          priority: "High",
          completed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: "2",
          text: "Schedule product roadmap review for tomorrow",
          priority: "Medium",
          completed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: "3",
          text: "Read chapter 2 of Design Systems book",
          priority: "Low",
          completed: true,
          createdAt: new Date().toISOString()
        }
      ];
      saveTasks();
    }
  } catch (e) {
    tasks = [];
  }
}

/**
 * Settings & Status Management
 */
function updateStatusUI() {
  const hasClientKey = !!(settings.apiKey && settings.apiKey.trim());
  const hasServerKey = serverStatus.gemini_configured || serverStatus.openai_configured;

  if (settings.provider === "gemini" && (hasClientKey || serverStatus.gemini_configured)) {
    statusIndicator.className = "status-indicator";
    statusText.textContent = "AI: Gemini";
  } else if (settings.provider === "openai" && (hasClientKey || serverStatus.openai_configured)) {
    statusIndicator.className = "status-indicator";
    statusText.textContent = "AI: OpenAI";
  } else if (hasServerKey) {
    statusIndicator.className = "status-indicator";
    statusText.textContent = `AI: ${serverStatus.gemini_configured ? "Gemini" : "OpenAI"}`;
  } else {
    statusIndicator.className = "status-indicator fallback";
    statusText.textContent = "Fallback Rules";
  }
}

async function checkServerStatus() {
  try {
    const res = await fetch("/api/status");
    if (res.ok) {
      serverStatus = await res.json();
      if (serverStatus.gemini_configured && settings.provider === "fallback") {
        settings.provider = "gemini";
      } else if (serverStatus.openai_configured && settings.provider === "fallback") {
        settings.provider = "openai";
      }
    }
  } catch (e) {
    // Standalone mode without server.py
  }
  updateStatusUI();
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (saved) {
      settings = { ...settings, ...JSON.parse(saved) };
    }
  } catch (e) {}

  providerSelect.value = settings.provider;
  apiKeyInput.value = settings.apiKey || "";
  apiKeySection.style.display = settings.provider === "fallback" ? "none" : "block";
}

function saveSettings() {
  settings.provider = providerSelect.value;
  settings.apiKey = apiKeyInput.value.trim();
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  updateStatusUI();
  settingsModal.classList.remove("open");
}

/**
 * Event Listeners
 */
todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addTask(taskInput.value);
});

clearCompletedBtn.addEventListener("click", clearCompleted);

// Quick try chips
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    taskInput.value = chip.dataset.task;
    addTask(chip.dataset.task);
  });
});

// Modal Controls
statusPill.addEventListener("click", () => {
  providerSelect.value = settings.provider;
  apiKeyInput.value = settings.apiKey || "";
  apiKeySection.style.display = settings.provider === "fallback" ? "none" : "block";
  settingsModal.classList.add("open");
});

closeModalBtn.addEventListener("click", () => {
  settingsModal.classList.remove("open");
});

settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove("open");
  }
});

providerSelect.addEventListener("change", () => {
  apiKeySection.style.display = providerSelect.value === "fallback" ? "none" : "block";
});

saveSettingsBtn.addEventListener("click", saveSettings);

// Initialization
loadSettings();
loadTasks();
renderTasks();
checkServerStatus();
