#!/usr/bin/env python3
"""
Tiny AI-Powered To-Do List Web App Server
Zero external dependencies - uses standard Python 3 libraries.
Serves static files and provides an optional AI classification endpoint.
"""

import http.server
import json
import os
import re
import socketserver
import urllib.error
import urllib.request

PORT = int(os.environ.get("PORT", 8000))
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()

HIGH_KEYWORDS = [
    r"\burgent\b", r"\basap\b", r"\bemergency\b", r"\bcritical\b", r"\bimmediat(e|ely)\b",
    r"\bdeadline\b", r"\bdue today\b", r"\btoday\b", r"\btonight\b", r"\bright now\b",
    r"\bcrucial\b", r"\bvital\b", r"\boutage\b", r"\bcrash\b", r"\bblocker\b",
    r"\bfix\b", r"\bbug\b", r"\bfire\b", r"\bhospital\b", r"\bdoctor\b", r"\btax(es)?\b",
    r"\binterview\b", r"\bexam\b", r"\beod\b", r"\bstat\b", r"\bsecurity\b", r"\bincident\b"
]

MEDIUM_KEYWORDS = [
    r"\btomorrow\b", r"\bthis week\b", r"\bschedule\b", r"\bmeeting\b", r"\bsync\b",
    r"\breview\b", r"\bdraft\b", r"\bprepare\b", r"\bfollow[- ]up\b", r"\bemail\b",
    r"\bsend\b", r"\bsubmit\b", r"\bplan\b", r"\borganize\b", r"\breport\b",
    r"\bupdate\b", r"\bappointment\b", r"\bcall\b", r"\bpay\b", r"\bbill\b",
    r"\binvoice\b", r"\bdiscuss\b", r"\bpresentation\b", r"\bstandup\b", r"\brenew\b"
]

LOW_KEYWORDS = [
    r"\bsomeday\b", r"\bmaybe\b", r"\blater\b", r"\bwhen free\b", r"\bread\b",
    r"\bbook\b", r"\bwatch\b", r"\bmovie\b", r"\bshow\b", r"\bpodcast\b",
    r"\bbrowse\b", r"\bclean\b", r"\bvacuum\b", r"\btidy\b", r"\bwater plants?\b",
    r"\bhobby\b", r"\bwalk\b", r"\bcasual\b", r"\brecipe\b", r"\bidea\b",
    r"\bgrocery\b", r"\bgroceries\b", r"\bbuy\b", r"\bshop\b", r"\blaundry\b"
]


def classify_with_keywords(text: str) -> str:
    """Classifies task priority using keyword matching rules."""
    text_lower = text.lower()

    for pattern in HIGH_KEYWORDS:
        if re.search(pattern, text_lower):
            return "High"

    for pattern in MEDIUM_KEYWORDS:
        if re.search(pattern, text_lower):
            return "Medium"

    for pattern in LOW_KEYWORDS:
        if re.search(pattern, text_lower):
            return "Low"

    # Default to Medium if length suggests an active task, otherwise Low
    words = text_lower.split()
    return "Medium" if len(words) > 3 else "Low"


def classify_with_gemini(task: str, api_key: str) -> str | None:
    """Classifies task priority using Google Gemini REST API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    prompt = (
        "Classify the priority of the following to-do task as exactly one word: High, Medium, or Low.\n"
        "- High: urgent, today, critical emergencies, severe consequences if missed.\n"
        "- Medium: important tasks, meetings, standard work deadlines, scheduled items.\n"
        "- Low: casual tasks, errands, reading, non-urgent hobbies, someday items.\n\n"
        f"Task: \"{task}\"\n\n"
        "Respond with ONLY one word: High, Medium, or Low."
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 10}
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            for p in ["High", "Medium", "Low"]:
                if p.lower() in text.lower():
                    return p
    except Exception as e:
        print(f"[Gemini Error]: {e}")
    return None


def classify_with_openai(task: str, api_key: str) -> str | None:
    """Classifies task priority using OpenAI REST API."""
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "system",
                "content": "You are a to-do prioritization assistant. Classify tasks as High, Medium, or Low. Respond with ONLY one word: High, Medium, or Low."
            },
            {"role": "user", "content": f"Task: \"{task}\""}
        ],
        "temperature": 0.1,
        "max_tokens": 10
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = data["choices"][0]["message"]["content"].strip()
            for p in ["High", "Medium", "Low"]:
                if p.lower() in text.lower():
                    return p
    except Exception as e:
        print(f"[OpenAI Error]: {e}")
    return None


class TodoRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom request handler with API endpoints and static file serving."""

    def do_GET(self):
        if self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            status = {
                "gemini_configured": bool(GEMINI_API_KEY),
                "openai_configured": bool(OPENAI_API_KEY),
                "active_mode": "gemini" if GEMINI_API_KEY else ("openai" if OPENAI_API_KEY else "fallback")
            }
            self.wfile.write(json.dumps(status).encode("utf-8"))
            return

        # Serve static files from current directory
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/classify":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                task = data.get("task", "").strip()
                custom_key = data.get("api_key", "").strip()
                provider = data.get("provider", "gemini").lower()
            except Exception:
                task = ""
                custom_key = ""
                provider = "gemini"

            if not task:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Task text is required"}).encode("utf-8"))
                return

            priority = None
            source = "fallback"

            # Check if user passed key in request or if server has env key
            active_gemini_key = custom_key if (custom_key and provider == "gemini") else GEMINI_API_KEY
            active_openai_key = custom_key if (custom_key and provider == "openai") else OPENAI_API_KEY

            if active_gemini_key:
                priority = classify_with_gemini(task, active_gemini_key)
                if priority:
                    source = "gemini"

            if not priority and active_openai_key:
                priority = classify_with_openai(task, active_openai_key)
                if priority:
                    source = "openai"

            # Fallback to keyword rules
            if not priority:
                priority = classify_with_keywords(task)
                source = "fallback"

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            response_data = {
                "priority": priority,
                "source": source
            }
            self.wfile.write(json.dumps(response_data).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()


def run():
    # Allow port reuse immediately
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), TodoRequestHandler) as httpd:
        print(f"Todo App running at http://localhost:{PORT}")
        print(f"AI Status: {'Gemini Key Detected' if GEMINI_API_KEY else ('OpenAI Key Detected' if OPENAI_API_KEY else 'No AI API Key (Using Keyword Fallback)')}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")


if __name__ == "__main__":
    run()
