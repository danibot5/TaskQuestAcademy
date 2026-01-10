const REAL_CONSOLE_LOG = console.log;

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

            analyzeBtn.innerHTML = "Мисля...";
            analyzeBtn.disabled = true;

            try {
                const API_URL = 'https://us-central1-scriptsensei-4e8fe.cloudfunctions.net/analyzeCode';

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
                analyzeBtn.innerHTML = "Анализирай";
                analyzeBtn.disabled = false;
            }
        });
    }

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

    const fixBtn = document.getElementById('fix-btn');
    if (fixBtn) {
        fixBtn.addEventListener('click', async () => {
            const userCode = editor.getValue();
            if (!userCode.trim()) return alert("Няма код за поправяне!");

            const originalHTML = fixBtn.innerHTML;
            const originalWidth = fixBtn.offsetWidth; // Запазваме ширината, за да не "скача"

            // Слагаме временно съобщение
            fixBtn.innerHTML = "Поправям...";
            fixBtn.style.width = `${originalWidth}px`; // Фиксираме ширината
            fixBtn.disabled = true;

            try {
                const API_URL = 'https://us-central1-scriptsensei-4e8fe.cloudfunctions.net/fixCode';

                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: userCode })
                });

                const data = await response.json();
                if (data.error) throw new Error(data.error);

                editor.setValue(data.fixedCode);

                // Успех
                fixBtn.innerHTML = "✅ Готово!";
                fixBtn.style.background = "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)";

                setTimeout(() => {
                    fixBtn.innerHTML = originalHTML;
                    fixBtn.style.background = "";
                    fixBtn.style.width = "";
                    fixBtn.disabled = false;
                }, 2000);

            } catch (error) {
                alert("Грешка: " + error.message);
                fixBtn.innerHTML = originalHTML;
                fixBtn.style.width = "";
                fixBtn.disabled = false;
            }
        });
    }

    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const userCode = editor.getValue();

            if (!userCode.trim()) {
                alert("Няма код за изтегляне! Напиши нещо първо.");
                return;
            }

            const date = new Date();
            const dateString = date.toISOString().split('T')[0]; // 2023-10-25
            const fileName = `scriptsensei_${dateString}.js`;

            const blob = new Blob([userCode], { type: 'text/javascript' });
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;

            document.body.appendChild(a);
            a.click();

            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        });
    }
}

function showAnalysisResults(data) {
    const modal = document.getElementById('analysis-modal');

    const scoreEl = document.getElementById('analysis-score');
    scoreEl.innerText = data.score;
    scoreEl.className = 'score-circle';
    if (data.score >= 80) scoreEl.classList.add('score-high');
    else if (data.score >= 50) scoreEl.classList.add('score-mid');
    else scoreEl.classList.add('score-low');

    document.getElementById('analysis-quality').innerText = data.quality;
    document.getElementById('analysis-summary').innerText = data.summary;

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