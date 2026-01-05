import { state } from './state.js';
import { SVGs, showToast, copyMessageText, speakText } from './utils.js';
import { loadChat, startNewChat } from './chat.js'; // За Sidebar кликовете
import { deleteFromFirestore, saveToLocalStorage, updateChatData, sendFeedbackReport, saveFeedbackToHistory } from './db.js';
import { editor } from './editor.js'; // За бутона "Прехвърли в редактора"

// --- DOM Елементи ---
const chatHistory = document.getElementById('chat-history');
const chatList = document.querySelector('.chat-list');
const sidebar = document.getElementById('sidebar');

// ==========================================================
// 1. RENDER SIDEBAR (Списък с чатове)
// ==========================================================
export function renderSidebar() {
    chatList.innerHTML = '';

    // Сортиране: Pinned най-горе, после по дата
    state.allChats.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const dateA = a.createdAt || a.id;
        const dateB = b.createdAt || b.id;
        return dateB - dateA;
    });

    state.allChats.forEach(chat => {
        const div = document.createElement('div');
        div.classList.add('chat-item');
        if (chat.id === state.currentChatId) div.classList.add('active');

        // Десен клик -> отваря менюто
        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            optionsBtn.click();
        });

        // Ляв клик -> зарежда чата
        div.addEventListener('click', (e) => {
            if (e.target.closest('.chat-options-btn') || e.target.closest('.chat-menu-dropdown')) return;
            loadChat(chat.id);
        });

        // Заглавие
        const titleSpan = document.createElement('span');
        titleSpan.classList.add('chat-title');
        let pinIconHTML = chat.isPinned ? `<span class="pinned-icon">${SVGs.pin}</span>` : '';
        titleSpan.innerHTML = pinIconHTML + (chat.title || "Нов разговор");

        // Бутон за меню (...)
        const optionsBtn = document.createElement('button');
        optionsBtn.className = 'chat-options-btn';
        optionsBtn.innerHTML = SVGs.moreVertical;

        // Падащо меню
        const menuDropdown = document.createElement('div');
        menuDropdown.className = 'chat-menu-dropdown';

        // Опция: Преименувай
        const renameOpt = document.createElement('button');
        renameOpt.className = 'menu-option';
        renameOpt.innerHTML = `${SVGs.edit} Преименувай`;
        renameOpt.onclick = async () => {
            const newTitle = prompt("Ново име на чата:", chat.title);
            if (newTitle && newTitle.trim() !== "") {
                chat.title = newTitle.trim();
                await updateChatData(chat);
                renderSidebar();
            }
        };

        // Опция: Закачи/Откачи
        const pinOpt = document.createElement('button');
        pinOpt.className = 'menu-option';
        pinOpt.innerHTML = chat.isPinned ? `${SVGs.pin} Откачи` : `${SVGs.pin} Закачи`;
        if (chat.isPinned) pinOpt.style.color = '#1a73e8';
        pinOpt.onclick = async () => {
            chat.isPinned = !chat.isPinned;
            await updateChatData(chat);
            renderSidebar();
        };

        // Опция: Изтрий
        const deleteOpt = document.createElement('button');
        deleteOpt.className = 'menu-option delete-opt';
        deleteOpt.innerHTML = `${SVGs.trash} Изтрий`;
        deleteOpt.onclick = async () => {
            if (!confirm("Сигурен ли си, че искаш да изтриеш този чат?")) return;

            // Махаме го от локалния масив веднага (за бързина)
            state.allChats = state.allChats.filter(c => c.id !== chat.id);

            if (state.currentUser) await deleteFromFirestore(chat.id);
            else saveToLocalStorage();

            if (chat.id === state.currentChatId) startNewChat();
            else renderSidebar();
        };

        menuDropdown.appendChild(renameOpt);
        menuDropdown.appendChild(pinOpt);
        menuDropdown.appendChild(deleteOpt);

        // Логика за отваряне на менюто
        optionsBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.chat-menu-dropdown.show').forEach(el => {
                if (el !== menuDropdown) el.classList.remove('show');
            });
            menuDropdown.classList.toggle('show');
        };

        div.appendChild(titleSpan);
        div.appendChild(optionsBtn);
        div.appendChild(menuDropdown);
        chatList.appendChild(div);
    });
}

// Затваряне на менютата при клик навън
document.addEventListener('click', (e) => {
    if (!e.target.closest('.chat-options-btn')) {
        document.querySelectorAll('.chat-menu-dropdown.show').forEach(el => el.classList.remove('show'));
    }
});

// ==========================================================
// 2. RENDER MESSAGES (Основна функция)
// ==========================================================
export function addMessageToUI(text, sender, feedbackStatus = null, isWelcomeMessage = false) {
    const rowDiv = document.createElement('div');
    rowDiv.classList.add('message-row');

    if (sender === 'user') {
        rowDiv.classList.add('user-row');
        const bubble = document.createElement('div');
        bubble.classList.add('user-bubble');

        // Ако е HTML (файлове) или текст
        if (text.includes('<i>Изпратен файл') || text.includes('<i>Изпратени файлове')) {
            bubble.innerHTML = text;
        } else {
            bubble.innerText = text;
        }
        rowDiv.appendChild(bubble);

    } else {
        // --- BOT ---
        rowDiv.classList.add('bot-row');

        const avatarImg = document.createElement('img');
        avatarImg.src = 'images/bot-avatar.png';
        avatarImg.classList.add('avatar');

        const messageContainer = document.createElement('div');
        messageContainer.style.display = 'flex';
        messageContainer.style.flexDirection = 'column';
        messageContainer.style.maxWidth = '80%';
        messageContainer.style.width = '100%';

        const textDiv = document.createElement('div');
        textDiv.classList.add('bot-text');

        // Markdown Parsing
        if (typeof marked !== 'undefined') {
            textDiv.innerHTML = marked.parse(text);
            if (typeof hljs !== 'undefined') {
                textDiv.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
            }
        } else {
            textDiv.innerText = text;
        }

        // --- CODE BUTTONS LOGIC ---
        const codeBlocks = textDiv.querySelectorAll('pre');
        codeBlocks.forEach((preBlock) => {
            const codeElement = preBlock.querySelector('code');
            if (!codeElement) return;
            const codeText = codeElement.innerText;

            // Детекция на езика
            let language = 'txt';
            codeElement.classList.forEach(cls => {
                if (cls.startsWith('language-')) language = cls.replace('language-', '');
            });

            const toolbar = document.createElement('div');
            toolbar.style.display = 'flex';
            toolbar.style.gap = '10px';
            toolbar.style.marginTop = '5px';
            toolbar.style.marginBottom = '15px';
            toolbar.style.justifyContent = 'flex-end';

            // Бутон: Прехвърли (само за JS)
            if (language === 'javascript' || language === 'js') {
                const runBtn = document.createElement('button');
                runBtn.className = 'code-btn transfer-to-editor-btn';
                runBtn.innerHTML = `Прехвърли в редактора`;
                runBtn.onclick = () => {
                    editor.setValue(codeText);
                    runBtn.innerHTML = "✅ Готово!";
                    setTimeout(() => runBtn.innerHTML = "Прехвърли в редактора", 2500);
                };
                toolbar.appendChild(runBtn);
            }

            // Бутон: Изтегли
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'code-btn download-btn-style';
            downloadBtn.style.color = 'white';
            let ext = language === 'javascript' ? 'js' : (language || 'txt');
            downloadBtn.innerHTML = `Изтегли .${ext}`;
            downloadBtn.onclick = () => {
                const blob = new Blob([codeText], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `solution_${Date.now()}.${ext}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            };
            toolbar.appendChild(downloadBtn);

            preBlock.parentNode.insertBefore(toolbar, preBlock.nextSibling);
        });

        // --- ACTION BUTTONS (Copy, Speak, Feedback) ---
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        let likeBtn, dislikeBtn;
        const speakBtn = createActionButton(SVGs.speak, 'Прочети', () => speakText(text));
        const copyBtn = createActionButton(SVGs.copy, 'Копирай', (e) => copyMessageText(text, e.currentTarget));

        // Like/Dislike логика
        likeBtn = createActionButton(
            feedbackStatus === 'like' ? SVGs.likeFilled : SVGs.like,
            'Полезен отговор',
            () => handleFeedback('like', text, rowDiv, likeBtn, dislikeBtn)
        );

        dislikeBtn = createActionButton(
            feedbackStatus === 'dislike' ? SVGs.dislikeFilled : SVGs.dislike,
            'Неполезен отговор',
            () => handleFeedback('dislike', text, rowDiv, likeBtn, dislikeBtn)
        );

        // Възстановяване на статуса (оцветяване)
        if (feedbackStatus === 'like') {
            likeBtn.style.color = '#c9c9c9ff';
            likeBtn.disabled = true;
            likeBtn.style.cursor = 'default';
        } else if (feedbackStatus === 'dislike') {
            dislikeBtn.style.color = '#c9c9c9ff';
            dislikeBtn.disabled = true;
            dislikeBtn.style.cursor = 'default';
        }

        actionsDiv.appendChild(copyBtn);

        // Ако не е поздрав, показваме бутоните за оценка
        if (!isWelcomeMessage) {
            if (feedbackStatus !== 'dislike') actionsDiv.appendChild(likeBtn);
            if (feedbackStatus !== 'like') actionsDiv.appendChild(dislikeBtn);
        }
        actionsDiv.appendChild(speakBtn);

        messageContainer.appendChild(textDiv);
        messageContainer.appendChild(actionsDiv);
        rowDiv.appendChild(avatarImg);
        rowDiv.appendChild(messageContainer);
    }

    chatHistory.appendChild(rowDiv);
    rowDiv.scrollIntoView({ behavior: "smooth", block: "end" });
}

function createActionButton(svg, title, handler) {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.innerHTML = svg;
    btn.title = title;
    btn.onclick = handler;
    return btn;
}

export function showLoading() {
    const rowDiv = document.createElement('div');
    rowDiv.classList.add('message-row', 'bot-row');
    rowDiv.id = 'loading-indicator';

    const avatarImg = document.createElement('img');
    avatarImg.src = 'images/bot-avatar.png';
    avatarImg.classList.add('avatar');

    const bubble = document.createElement('div');
    bubble.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;

    rowDiv.appendChild(avatarImg);
    rowDiv.appendChild(bubble);
    chatHistory.appendChild(rowDiv);
    rowDiv.scrollIntoView({ behavior: "smooth", block: "end" });
}

export function removeLoading() {
    const loader = document.getElementById('loading-indicator');
    if (loader) loader.remove();
}

// ==========================================================
// 3. ATTACHMENTS & THEMES
// ==========================================================
export function renderAttachments() {
    const list = document.getElementById('attachment-preview-list');
    const files = state.currentAttachments; // Взимаме директно от state

    if (files.length === 0) {
        list.style.display = 'none';
        return;
    }

    list.style.display = 'flex';
    list.innerHTML = '';

    files.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'attachment-item';

        if (file.mimeType.startsWith('image/')) {
            item.innerHTML = `
                <img src="data:${file.mimeType};base64,${file.base64}">
                <button class="remove-file-btn" onclick="window.removeAttachment(${index})">✕</button>
            `;
        } else {
            item.innerHTML = `
                <div class="file-icon" title="${file.name}">📄</div>
                <button class="remove-file-btn" onclick="window.removeAttachment(${index})">✕</button>
            `;
        }
        list.appendChild(item);
    });
}

// Тъмна Тема Логика
export function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle');
    const isDark = body.classList.toggle('dark-mode');

    btn.innerText = isDark ? '☀️' : '🌙';
    localStorage.setItem('scriptsensei_theme', isDark ? 'dark' : 'light');

    // Обновяваме редактора
    editor.setOption("theme", isDark ? "dracula" : "eclipse");
}

export function initTheme() {
    const saved = localStorage.getItem('scriptsensei_theme');
    const isDark = saved === 'dark';
    if (isDark) {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-toggle').innerText = '☀️';
        editor.setOption("theme", "dracula");
    } else {
        editor.setOption("theme", "eclipse");
    }
}

// ==========================================================
// 4. FEEDBACK FORM LOGIC
// ==========================================================
const feedbackModal = document.getElementById('feedback-modal');
const feedbackForm = document.getElementById('feedback-form');
let activeFeedbackUI = null; // Тук пазим кой бутон е натиснат

async function handleFeedback(type, text, messageRow, likeBtn, dislikeBtn) {
    if (type === 'like') {
        if (likeBtn.disabled) return;

        likeBtn.innerHTML = SVGs.likeFilled;
        likeBtn.style.color = '#c9c9c9ff';
        likeBtn.disabled = true;
        likeBtn.style.cursor = 'default';
        if (dislikeBtn) dislikeBtn.remove();

        sendFeedbackReport('like', text);
        showToast('Благодарим за оценката!', '👍');
        await saveFeedbackToHistory(text, 'like');
    } else {
        // Dislike -> отваря модал
        openFeedbackModal(likeBtn, dislikeBtn, text);
    }
}

function openFeedbackModal(likeBtn, dislikeBtn, rawText) {
    activeFeedbackUI = { likeBtn, dislikeBtn, rawText };
    feedbackModal.style.display = 'flex';
    feedbackForm.reset();
    document.getElementById('feedback-details').disabled = true;
    document.getElementById('submit-feedback').disabled = true;
}

// Инициализация на listeners за feedback формата
export function initFeedbackSystem() {
    const closeBtn = document.getElementById('close-feedback');
    const detailsInput = document.getElementById('feedback-details');
    const otherCheckbox = document.getElementById('other-checkbox');
    const submitBtn = document.getElementById('submit-feedback');

    closeBtn.onclick = () => feedbackModal.style.display = 'none';

    // Валидация
    feedbackForm.addEventListener('change', validate);
    detailsInput.addEventListener('input', validate);

    function validate() {
        const isOther = otherCheckbox.checked;
        detailsInput.disabled = !isOther;

        let hasChecked = Array.from(feedbackForm.querySelectorAll('input[type="checkbox"]')).some(c => c.checked);
        let isValid = hasChecked;

        if (isOther && detailsInput.value.trim() === "") isValid = false;

        submitBtn.disabled = !isValid;
        submitBtn.style.cursor = isValid ? 'pointer' : 'default';
    }

    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeFeedbackUI) return;

        const { likeBtn, dislikeBtn, rawText } = activeFeedbackUI;

        // Взимаме причините
        const reasons = Array.from(feedbackForm.querySelectorAll('input:checked')).map(i => i.value);
        const details = detailsInput.value;

        // UI Update
        dislikeBtn.innerHTML = SVGs.dislikeFilled;
        dislikeBtn.style.color = '#c9c9c9ff';
        dislikeBtn.disabled = true;
        dislikeBtn.style.cursor = 'default';
        if (likeBtn) likeBtn.remove();

        // Send & Save
        sendFeedbackReport('dislike', rawText, reasons, details);
        await saveFeedbackToHistory(rawText, 'dislike');

        feedbackModal.style.display = 'none';
        activeFeedbackUI = null;
        showToast('Благодарим за мнението!', '🙏');
    });
}

export async function shareChat() {
    // Взимаме текущия чат от state
    const currentChat = state.allChats.find(c => c.id === state.currentChatId);

    if (!currentChat || !currentChat.messages || currentChat.messages.length === 0) {
        showToast('Няма какво да се сподели!', '⚠️');
        return;
    }

    // Форматираме текста за споделяне
    let shareText = `📜 *Чат със ScriptSensei: ${currentChat.title || 'Разговор'}*\n\n`;

    currentChat.messages.forEach(msg => {
        const role = msg.sender === 'user' ? '👤 Аз' : '🤖 Sensei';
        // Изчистваме малко markdown символите за по-чист вид при копиране
        let cleanText = msg.text.replace(/```/g, '');
        shareText += `${role}: ${cleanText}\n\n`;
    });

    shareText += `\n🚀 *Генерирано от ScriptSensei*`;

    // Копиране в клипборда
    try {
        await navigator.clipboard.writeText(shareText);
        showToast('Чатът е копиран в клипборда!', '📋');
    } catch (err) {
        console.error('Failed to copy: ', err);
        showToast('Грешка при споделяне.', '❌');
    }
}