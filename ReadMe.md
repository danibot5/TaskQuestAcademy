# 🤖 ScriptSensei
### The AI‑Powered JavaScript Mentor & Live Coding Environment

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-live-success.svg)
![Stack](https://img.shields.io/badge/tech-Firebase%20%7C%20VanillaJS%20%7C%20LLMs-orange.svg)

**ScriptSensei** is an interactive educational platform that bridges the gap between static tutorials and real‑time mentorship. Instead of passively watching videos or reading docs, users learn JavaScript by **writing code, running it instantly, and receiving contextual AI guidance**—all in one place.

The app features a **dual‑pane interface**:
- **Left:** a conversational AI mentor that understands your intent
- **Right:** a fully functional live JavaScript editor with execution and console output

Together, they create a focused, hands‑on learning environment designed to feel like pair‑programming with a senior developer.

---

## 🚀 Live Demo
👉 **Try it here:** https://scriptsensei-4e8fe.web.app

---

## ✨ Key Features

- **🧠 Context‑Aware AI Mentor**  
  The AI has access to the current editor state and console output, allowing it to give precise debugging help, explanations, and improvement suggestions.

- **💻 Integrated Code Editor**  
  Powered by **CodeMirror**, with syntax highlighting, auto‑bracketing, indentation, and line numbers.

- **▶️ Live JavaScript Execution**  
  Run JavaScript safely in the browser with a sandboxed environment and custom console output.

- **🎙️ Voice Interaction**  
  Speech‑to‑Text and Text‑to‑Speech (TTS) support for a hands‑free learning experience.

- **☁️ Cloud & Local Sync**  
  - **Guest Mode:** Chat history and preferences saved to LocalStorage  
  - **User Mode:** Full cross‑device sync via **Firebase Authentication + Firestore**

- **📎 Multimodal Input**  
  Upload images or text files for the AI to analyze (e.g. screenshots of code or error messages).

- **🎨 Theming**  
  Light and Dark (Dracula) themes for comfortable coding day or night.

- **📱 Fully Responsive**  
  Optimized for mobile and tablet usage.

---

## 🛠️ Tech Stack & Architecture

ScriptSensei was refactored from a monolithic script into a scalable **ES6 modular architecture**, making the codebase maintainable and extensible.

### Frontend
- **Core:** HTML5, CSS3 (Custom Properties, Flexbox, Grid)
- **Language:** Vanilla JavaScript (ES Modules)
- **Editor:** CodeMirror 5
- **Markdown & Highlighting:** Marked.js, Highlight.js

**Key Modules:**
- `js/auth.js` – Firebase Authentication
- `js/chat.js` – Chat UI and message handling
- `js/editor.js` – Code editor setup & execution logic
- `js/db.js` – Firestore & LocalStorage abstraction layer
- `js/state.js` – Centralized app state management
- `js/ui.js` – DOM updates and UI rendering

### Backend (Serverless)
- **Platform:** Firebase Cloud Functions (Node.js)
- **Database:** Cloud Firestore (NoSQL)
- **AI Layer:** OpenAI / Groq APIs (handled server‑side for security)

---

## 📂 Project Structure

```
/
├── functions/              # Backend (Firebase Cloud Functions)
│   ├── index.js            # Main server entry (AI logic)
│   └── .env                # Server secrets (API keys)
│
├── public/                 # Frontend (Hosting root)
│   ├── css/                # Modular CSS (base, chat, editor, themes, mobile)
│   ├── js/                 # ES6 Modules
│   │   ├── config.js       # Client‑side configuration
│   │   ├── main.js         # App entry point
│   │   └── ...
│   ├── images/             # Static assets
│   └── index.html          # SPA entry point
│
├── firebase.json           # Firebase hosting configuration
└── firestore.rules         # Firestore security rules
```

---

## 🔧 Installation & Setup

Follow these steps to run ScriptSensei locally for development.

### 1. Prerequisites
- **Node.js** v18 or higher
- **Firebase CLI**
  ```bash
  npm install -g firebase-tools
  ```

### 2. Clone the Repository
```bash
git clone https://github.com/yourusername/ScriptSensei.git
cd ScriptSensei
```

### 3. Backend Setup (Functions)
```bash
cd functions
npm install
```

Create a `.env` file inside the `functions/` directory:
```env
OPENAI_API_KEY=sk-your-secret-key-here
```

### 4. Frontend Configuration
Edit `public/js/config.js` and make sure the API endpoints point to:
- Firebase emulators (local development), or
- Deployed Cloud Functions (production)

### 5. Run Locally (Firebase Emulators)
```bash
firebase emulators:start
```

Open the app at:
```
http://localhost:5000
```

---

## 🤝 Contributing

Contributions are very welcome ❤️

1. Fork the repository
2. Create a new branch:
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. Commit your changes
4. Open a Pull Request

Whether it’s a bug fix, new feature, or UI improvement—every contribution helps.

---

## 📄 License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.

---

Built with ❤️ by **Dani**

