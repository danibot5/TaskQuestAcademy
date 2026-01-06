# 🤖 ScriptSensei
### The AI-Powered JavaScript Mentor & Live Coding Environment

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-live-success.svg)
![Stack](https://img.shields.io/badge/tech-Firebase%20%7C%20VanillaJS%20%7C%20OpenAI-orange.svg)

**ScriptSensei** is an interactive educational platform designed to bridge the gap between static coding tutorials and real-time mentorship. Unlike traditional learning apps, ScriptSensei utilizes **Large Language Models (LLM)** to provide context-aware feedback, debug code in real-time, and explain complex JavaScript concepts instantly.

It features a **dual-pane interface**: a conversational AI on the left and a fully functional live code editor on the right, allowing users to learn, write, and execute code in a single seamless environment.

---

## 🚀 Live Demo
**Try it online:** [https://scriptsensei-4e8fe.web.app](https://scriptsensei-4e8fe.web.app)

---

## ✨ Key Features

* **🧠 Context-Aware AI Chat:** The AI doesn't just chat; it "sees" the code you write in the editor and the errors in the console, providing highly specific debugging advice.
* **💻 Integrated Code Editor:** Built on **CodeMirror**, featuring syntax highlighting, auto-bracketing, and line numbering.
* **▶️ Live Code Execution:** Safe, sandboxed execution of JavaScript code directly in the browser with a custom console output.
* **🎙️ Voice Interaction:** Full Speech-to-Text and Text-to-Speech (TTS) support for a hands-free learning experience.
* **☁️ Cloud & Local Sync:** * **Guest Mode:** Saves chat history and settings to LocalStorage.
    * **User Mode:** Syncs chats, history, and preferences across devices using **Firebase Firestore**.
* **📎 Multimodal Support:** Upload images or text files for the AI to analyze (e.g., "Explain this code screenshot").
* **🎨 Theming:** Toggle between Light and Dark (Dracula) modes for comfortable coding at any time.
* **📱 Fully Responsive:** Optimized mobile layout for learning on the go.

---

## 🛠️ Tech Stack & Architecture

The project has recently undergone a major refactor from a monolithic script to a scalable, **ES6 Modular Architecture**.

### **Frontend**
* **Core:** HTML5, CSS3 (Custom Variables, Flexbox/Grid), Vanilla JavaScript (ES Modules).
* **Editor:** CodeMirror 5.
* **Markdown & Highlighting:** Marked.js, Highlight.js.
* **Structure:**
    * `js/auth.js` - Firebase Authentication logic.
    * `js/chat.js` - Chat interface and message handling.
    * `js/editor.js` - Code editor configuration and execution logic.
    * `js/db.js` - Firestore & LocalStorage interaction layer.
    * `js/state.js` - Centralized state management.
    * `js/ui.js` - DOM manipulation and UI rendering.

### **Backend (Serverless)**
* **Platform:** Firebase Cloud Functions (Node.js).
* **Database:** Cloud Firestore (NoSQL).
* **AI Integration:** OpenAI API / Groq (Server-side handling for security).

---

## 📂 Project Structure

```text
/
├── functions/              # Backend (Node.js + Firebase Cloud Functions)
│   ├── index.js            # Main server entry point (AI logic)
│   └── .env                # Server secrets (API Keys)
│
├── public/                 # Frontend (Hosting root)
│   ├── css/                # Modular CSS (base, chat, editor, themes, mobile)
│   ├── js/                 # ES6 Modules
│   │   ├── config.js       # Client-side config
│   │   ├── main.js         # App entry point
│   │   └── ...
│   ├── images/             # Assets
│   └── index.html          # Single Page Application entry
│
├── firebase.json           # Firebase hosting configuration
└── firestore.rules         # Database security rules

🔧 Installation & Setup
To run ScriptSensei locally for development:

1. Prerequisites
Node.js (v18 or higher)

Firebase CLI (npm install -g firebase-tools)

2. Clone the Repository
Bash

git clone [https://github.com/yourusername/ScriptSensei.git](https://github.com/yourusername/ScriptSensei.git)
cd ScriptSensei
3. Setup Backend (Functions)
Navigate to the functions folder and install dependencies:

Bash

cd functions
npm install
Create a .env file in the functions/ folder and add your LLM API Key:

Фрагмент от код

OPENAI_API_KEY=sk-your-secret-key-here
4. Setup Frontend
Navigate to public/js/config.js and ensure the API URLs point to your local emulator or production server.

5. Run Locally (Emulators)
Start the full stack (Hosting + Functions + Firestore) locally:

Bash

firebase emulators:start
Access the app at http://localhost:5000.

🤝 Contributing
Contributions are welcome! Whether it's a bug fix, a new feature, or a UI improvement:

Fork the repository.

Create a feature branch (git checkout -b feature/AmazingFeature).

Commit your changes.

Open a Pull Request.

📄 License
Distributed under the MIT License. See LICENSE for more information.

Built with ❤️ by Dani.