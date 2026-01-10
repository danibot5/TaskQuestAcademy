const REAL_CONSOLE_LOG = console.log;

// Импортирай CodeMirror както преди (ако ползваш modules) или го остави глобален
// Тук приемаме, че editor е глобален или се експортва
export const editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "javascript",
    theme: "eclipse",
    lineNumbers: true,
    autoCloseBrackets: true,
    lineWrapping: true,
    matchBrackets: true,
    readOnly: false,
    cursorBlinkRate: 530
});

export function initEditor() {
    // --- 1. RUN BUTTON LOGIC (Старата) ---
    document.getElementById('run-btn').addEventListener('click', () => {
        const userCode = editor.getValue();
        const outputBox = document.getElementById('console-output');
        outputBox.innerHTML = '<div class="console-label">Console Output:</div>';

        try {
            console.log = (msg) => {
                if (typeof msg === 'object') {
                    try { msg = JSON.stringify(msg, null, 2); } catch (e) { msg = '[Circular]'; }
                }
                outputBox.innerHTML += `<div>> ${msg}</div>`;
                REAL_CONSOLE_LOG(msg);
            };
            new Function(userCode)();
        } catch (e) {
            outputBox.innerHTML += `<div style="color:#ff4444;">🚨 ${e.message}</div>`;
        } finally {
            console.log = REAL_CONSOLE_LOG;
        }
    });

    // --- 2. 🔥 NEW: ANALYZE BUTTON LOGIC ---
    const analyzeBtn = document.getElementById('analyze-btn');
    const modal = document.getElementById('analysis-modal');
    const closeBtn = document.getElementById('close-analysis');

    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            const userCode = editor.getValue();
            if (!userCode.trim()) {
                alert("Първо напиши някакъв код!");
                return;
            }

            // UI: Показваме, че мисли
            analyzeBtn.innerHTML = "⏳ Мисля...";
            analyzeBtn.disabled = true;

            try {
                // ... (API URL частта си остава същата) ...
                // За локален тест: http://127.0.0.1:5001/scriptsensei-4e8fe/us-central1/analyzeCode
                // За продукция: https://analyzeCode-tvoya-proekt.cloudfunctions.net/analyzeCode
                const API_URL = 'https://analyzeCode-tvoya-proekt.cloudfunctions.net/analyzeCode'; 
                
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: userCode })
                });

                const data = await response.json();

                // 🔥 ПРОВЕРКА ЗА ГРЕШКИ 🔥
                if (data.error) {
                    throw new Error(data.error); // Хвърляме грешката, за да отиде в catch блока
                }

                // Ако всичко е наред, показваме резултата
                showAnalysisResults(data);

            } catch (error) {
                console.error("ANALYSIS FAILED:", error);
                alert("🚨 Опа! Нещо се обърка с анализа:\n" + error.message);
            } finally {
                analyzeBtn.innerHTML = "🔍 Анализирай";
                analyzeBtn.disabled = false;
            }
        });
    }

    // Затваряне на модала
    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };

    // Клавишни комбинации
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
            e.preventDefault();
            const runBtn = document.getElementById('run-btn');
            if (runBtn) runBtn.click();
        }
    });
}

// Помощна функция за попълване на модала
function showAnalysisResults(data) {
    const modal = document.getElementById('analysis-modal');
    
    // 1. Score
    const scoreEl = document.getElementById('analysis-score');
    scoreEl.innerText = data.score;
    scoreEl.className = 'score-circle'; // Reset
    if (data.score >= 80) scoreEl.classList.add('score-high');
    else if (data.score >= 50) scoreEl.classList.add('score-mid');
    else scoreEl.classList.add('score-low');

    // 2. Quality & Summary
    document.getElementById('analysis-quality').innerText = data.quality;
    document.getElementById('analysis-summary').innerText = data.summary;

    // 3. Issues List
    const list = document.getElementById('analysis-issues-list');
    list.innerHTML = '';
    if (data.issues && data.issues.length > 0) {
        data.issues.forEach(issue => {
            const li = document.createElement('li');
            li.innerText = issue;
            list.appendChild(li);
        });
    } else {
        list.innerHTML = '<li style="color:green">Няма открити проблеми! 🎉</li>';
    }

    // 4. Security
    const secEl = document.getElementById('analysis-security');
    if (data.securityRisk) {
        secEl.innerHTML = `⚠️ РИСК ОТКРИТ! <br> ${data.securityMessage || ''}`;
        secEl.className = 'security-risk';
    } else {
        secEl.innerText = "✅ Безопасен код";
        secEl.className = 'security-safe';
    }

    // Показваме
    modal.style.display = 'flex';
}