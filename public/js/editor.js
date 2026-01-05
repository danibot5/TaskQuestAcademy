// js/editor.js
export const editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "javascript",
    theme: "eclipse",
    lineNumbers: true,
    autoCloseBrackets: true,
    lineWrapping: true,
    readOnly: false,
    cursorBlinkRate: 530,
});

export function initEditor() {
    const REAL_CONSOLE_LOG = console.log;
    document.getElementById('run-btn').addEventListener('click', () => {
        const userCode = editor.getValue();
        const outputBox = document.getElementById('console-output');

        // Ресет на конзолата
        outputBox.innerHTML = '<div class="console-label">Console Output:</div>';

        try {
            // Пренасочваме console.log към нашето прозорче
            console.log = (msg) => {
                // Форматираме обектите красиво
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

            // Изпълняваме кода
            new Function(userCode)();

        } catch (e) {
            outputBox.innerHTML += `<div style="color:#ff4444;">🚨 ${e.message}</div>`;
        } finally {
            console.log = REAL_CONSOLE_LOG;
        }
    });
}