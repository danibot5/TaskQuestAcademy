const REAL_CONSOLE_LOG = console.log;

export const editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "javascript",
    theme: "eclipse",
    lineNumbers: true,
    autoCloseBrackets: true,
    lineWrapping: true,
    matchBrackets: true,
    readOnly: false,
    lineWrapping: false,
    cursorBlinkRate: 530
});

export function initEditor() {
    document.getElementById('run-btn').addEventListener('click', () => {
        const userCode = editor.getValue();
        const outputBox = document.getElementById('console-output');

        outputBox.innerHTML = '<div class="console-label">Console Output:</div>';

        try {
            console.log = (msg) => {
                if (typeof msg === 'object') {
                    try {
                        msg = JSON.stringify(msg, null, 2);
                    } catch (e) {
                        msg = '[Circular Object or Error]';
                    }
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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
            e.preventDefault();
            const runBtn = document.getElementById('run-btn');
            if (runBtn) runBtn.click();
        }
    });
}