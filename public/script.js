// ==========================================
// 1. ГЛОБАЛНИ ПРОМЕНЛИВИ (СЪСТОЯНИЕ)
// ==========================================
let allChats = JSON.parse(localStorage.getItem('scriptsensei_chats')) || []; // Зареждаме историята
let currentChatId = null; // ID на текущия разговор

const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menu-btn');
const closeSidebarBtn = document.getElementById('close-sidebar');
const newChatBtn = document.getElementById('new-chat-btn');
const chatList = document.querySelector('.chat-list');

// Линкът към твоя сървър (Groq)
const API_URL = 'http://127.0.0.1:5001/scriptsensei-4e8fe/us-central1/chat';

// ==========================================
// 2. УПРАВЛЕНИЕ НА ИСТОРИЯТА (SIDEBAR)
// ==========================================

// Функция за създаване на нов чат
function startNewChat() {
    currentChatId = Date.now(); // Уникално ID (часа в милисекунди)
    chatHistory.innerHTML = ''; // Чистим екрана

    // Добавяме приветствие
    addMessageToUI("Здравей! Аз съм твоят ментор. Какво искаш да научим днес?", 'bot');

    // Махаме 'active' от всички в менюто
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
}

// Функция за запазване на съобщение в паметта
function saveMessage(text, sender) {
    // 1. Намираме текущия чат в масива
    let chat = allChats.find(c => c.id === currentChatId);

    // 2. Ако няма такъв (това е първо съобщение), го създаваме
    if (!chat) {
        chat = {
            id: currentChatId,
            title: text, // Първото съобщение става заглавие
            messages: []
        };
        allChats.unshift(chat); // Слагаме го най-отпред
        renderSidebar(); // Обновяваме менюто веднага
    }

    // 3. Добавяме съобщението
    chat.messages.push({ text, sender });

    // 4. Запазваме в браузъра (LocalStorage)
    localStorage.setItem('scriptsensei_chats', JSON.stringify(allChats));
}

// Функция за показване на менюто (Рендериране)
function renderSidebar() {
    chatList.innerHTML = ''; // Чистим списъка

    // Сортираме: Най-новите чатове най-отгоре
    // (Ако искаш хронологичен ред, ползвай .sort)
    const sortedChats = allChats.slice().reverse();

    sortedChats.forEach(chat => {
        const div = document.createElement('div');
        div.classList.add('chat-item');
        if (chat.id === currentChatId) div.classList.add('active');

        // При клик на реда -> зареждаме чата
        div.onclick = () => loadChat(chat.id);

        // 1. Заглавието
        const titleSpan = document.createElement('span');
        titleSpan.classList.add('chat-title');
        titleSpan.innerText = chat.title || "Нов разговор";

        // 2. Кошчето (SVG икона)
        const delBtn = document.createElement('button');
        delBtn.classList.add('delete-btn');
        delBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        `;

        // При клик на кошчето -> трием
        delBtn.onclick = (e) => deleteChat(chat.id, e);

        div.appendChild(titleSpan);
        div.appendChild(delBtn);

        chatList.appendChild(div);
    });
}

// Функция за зареждане на стар чат
function loadChat(id) {
    currentChatId = id;
    chatHistory.innerHTML = ''; // Чистим текущия екран

    const chat = allChats.find(c => c.id === id);
    if (chat) {
        // Показваме всички съобщения от паметта
        // Винаги слагаме приветствието първо (ако го няма в базата)
        addMessageToUI("Здравей! Аз съм твоят ментор. Какво искаш да научим днес?", 'bot');

        chat.messages.forEach(msg => {
            addMessageToUI(msg.text, msg.sender);
        });
    }

    renderSidebar(); // Обновяваме кое е 'active'
    // Затваряме менюто на мобилни (по желание)
    if (window.innerWidth < 800) sidebar.classList.remove('open');
}

// Функция за изтриване на чат
function deleteChat(id, event) {
    // ВАЖНО: Спираме клика да не "пробие" към бутона за отваряне
    event.stopPropagation();

    // Питаме потребителя за всеки случай
    if (!confirm("Сигурен ли си, че искаш да изтриеш този чат?")) return;

    // 1. Филтрираме масива (махаме този чат)
    allChats = allChats.filter(c => c.id !== id);

    // 2. Запазваме новия списък
    localStorage.setItem('scriptsensei_chats', JSON.stringify(allChats));

    // 3. Ако сме изтрили текущия отворен чат -> започваме нов
    if (id === currentChatId) {
        startNewChat();
    } else {
        // Ако сме изтрили друг, просто обновяваме менюто
        renderSidebar();
    }
}

// ==========================================
// 3. ВИЗУАЛИЗАЦИЯ (UI)
// ==========================================

// Тази функция САМО рисува по екрана (не запазва)
function addMessageToUI(text, sender) {
    const rowDiv = document.createElement('div');
    rowDiv.classList.add('message-row');

    if (sender === 'user') {
        rowDiv.classList.add('user-row');
        const bubble = document.createElement('div');
        bubble.classList.add('user-bubble');
        bubble.innerText = text;
        rowDiv.appendChild(bubble);
    } else {
        rowDiv.classList.add('bot-row');

        const avatarImg = document.createElement('img');
        avatarImg.src = 'https://robohash.org/scriptsensei?set=set1&bgset=bg1&size=100x100';
        avatarImg.classList.add('avatar');

        const textDiv = document.createElement('div');
        textDiv.classList.add('bot-text');

        // Markdown + Code Logic
        if (typeof marked !== 'undefined') {
            textDiv.innerHTML = marked.parse(text);
        } else {
            textDiv.innerText = text;
        }

        if (text.includes('```')) {
            const codeMatch = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
            if (codeMatch && codeMatch[1]) {
                const cleanCode = codeMatch[1].trim();
                const runCodeBtn = document.createElement('button');

                // НОВО: Слагаме SVG икона вътре в бутона
                runCodeBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="4 17 10 11 4 5"></polyline>
                        <line x1="12" y1="19" x2="20" y2="19"></line>
                    </svg>
                    Прехвърли в редактора
                `;

                runCodeBtn.className = "code-btn";

                runCodeBtn.onclick = function () {
                    document.getElementById('code-editor').value = cleanCode;

                    // Ефект за потвърждение (за 2 секунди)
                    const originalHTML = runCodeBtn.innerHTML;
                    runCodeBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Готово!
                    `;
                    runCodeBtn.style.border = "1px solid #28a745";

                    setTimeout(() => {
                        runCodeBtn.innerHTML = originalHTML;
                        runCodeBtn.style.border = "1px solid #3e4451";
                    }, 4500);
                };

                textDiv.appendChild(runCodeBtn);
            }
        }

        rowDiv.appendChild(avatarImg);
        rowDiv.appendChild(textDiv);
    }

    chatHistory.appendChild(rowDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function showLoading() {
    const rowDiv = document.createElement('div');
    rowDiv.classList.add('message-row', 'bot-row');
    rowDiv.id = 'loading-indicator'; // Слагаме ID, за да го намерим и изтрием после

    const avatarImg = document.createElement('img');
    avatarImg.src = 'https://robohash.org/scriptsensei?set=set1&bgset=bg1&size=100x100';
    avatarImg.classList.add('avatar');

    const bubble = document.createElement('div');
    // Няма стил 'bot-text', за да не се форматира, а слагаме точките
    bubble.innerHTML = `
        <div class="typing-indicator">
            <span></span><span></span><span></span>
        </div>
    `;

    rowDiv.appendChild(avatarImg);
    rowDiv.appendChild(bubble);
    chatHistory.appendChild(rowDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Скрива индикатора
function removeLoading() {
    const loader = document.getElementById('loading-indicator');
    if (loader) {
        loader.remove();
    }
}

function scrollToBottom() {
    setTimeout(() => {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }, 50);
}

// ==========================================
// 4. LISTENERS (БУТОНИТЕ)
// ==========================================

// Изпращане на съобщение
sendBtn.addEventListener('click', async function () {
    const text = userInput.value;
    if (text.trim() === "") return;

    // 1. Показваме твоето съобщение в чата (чисто)
    addMessageToUI(text, 'user');
    saveMessage(text, 'user');
    userInput.value = '';

    // --- ПОДГОТОВКА НА КОНТЕКСТА (MAGIC) ---
    const currentChat = allChats.find(c => c.id === currentChatId);
    let messagesPayload = [];

    // Взимаме историята до момента
    if (currentChat) {
        const recentMessages = currentChat.messages.slice(-10);
        messagesPayload = recentMessages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));
    }

    // Взимаме кода и конзолата
    const editorCode = document.getElementById('code-editor').value;
    const consoleOutput = document.getElementById('console-output').innerText;

    // Сглобяваме "Тайното съобщение" за AI
    let messageToSendToAI = text;

    // Ако има код в редактора, го прикачваме към въпроса ти
    if (editorCode.trim().length > 0) {
        messageToSendToAI += `\n\n--- [SYSTEM CONTEXT] ---\nПотребителят има следния код в редактора:\n\`\`\`javascript\n${editorCode}\n\`\`\`\n\nТова е резултатът от конзолата:\n${consoleOutput}\n------------------------`;
    }

    // Добавяме това обогатено съобщение към масива за сървъра
    messagesPayload.push({ role: 'user', content: messageToSendToAI });

    // 2. ПОКАЗВАМЕ ЧЕ МИСЛИМ
    showLoading();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: messagesPayload })
        });

        const data = await response.json();

        // 3. МАХАМЕ ТОЧКИТЕ
        removeLoading();

        if (data.reply) {
            addMessageToUI(data.reply, 'bot');
            saveMessage(data.reply, 'bot');
        } else if (data.error) {
            addMessageToUI("🚨 " + data.error, 'bot');
        }

    } catch (error) {
        removeLoading();
        addMessageToUI("Грешка: Сървърът не отговаря.", 'bot');
        console.error(error);
    }
});

// Бутон за отваряне на менюто
if (menuBtn) {
    menuBtn.addEventListener('click', function () {
        sidebar.classList.toggle('open');
    });
}

// Бутон за затваряне (Х)
if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', function () {
        sidebar.classList.remove('open');
    });
}

// Бутон "Нов чат"
if (newChatBtn) {
    newChatBtn.addEventListener('click', function () {
        startNewChat();
        sidebar.classList.remove('open'); // Затваряме менюто, за да почнем да пишем
    });
}

// Logic за десния панел (Code Runner)
const runBtn = document.getElementById('run-btn');
const outputBox = document.getElementById('console-output');
const codeEditor = document.getElementById('code-editor');

if (runBtn) {
    runBtn.addEventListener('click', function () {
        const userCode = codeEditor.value;
        outputBox.innerHTML = '<div class="console-label">Console Output:</div>';

        try {
            const originalConsoleLog = console.log;
            console.log = function (message) {
                outputBox.innerHTML += `<div>> ${message}</div>`;
                originalConsoleLog(message);
            };
            new Function(userCode)();
            console.log = originalConsoleLog;
        } catch (error) {
            outputBox.innerHTML += `<div style="color: #ff4444;">🚨 ${error.message}</div>`;
        }
    });
}

userInput.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        sendBtn.click();
    }
});


// ==========================================
// 5. НОВИ ФУНКЦИИ (ГЛАС И ФАЙЛОВЕ)
// ==========================================

const micBtn = document.getElementById('mic-btn');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'bg-BG';
    recognition.continuous = false;

    micBtn.addEventListener('click', () => {
        if (micBtn.classList.contains('recording')) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    recognition.onstart = () => {
        micBtn.classList.add('recording');
        userInput.placeholder = "Говорете сега...";
    };

    recognition.onend = () => {
        micBtn.classList.remove('recording');
        userInput.placeholder = "Питай ме нещо...";
        userInput.focus();
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value += (userInput.value ? ' ' : '') + transcript;
    };

} else {
    micBtn.style.display = 'none';
    console.warn("Този браузър не поддържа гласово разпознаване.");
}

const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');

attachBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        const content = e.target.result;

        userInput.value = `Ето съдържанието на файла "${file.name}":\n\n${content}\n\nМоля, обясни кода.`;

        userInput.focus();
    };

    reader.readAsText(file);

    fileInput.value = '';
});


// ==========================================
// 6. STARTUP (ПРИ ЗАРЕЖДАНЕ)
// ==========================================
renderSidebar(); // Рисуваме менюто
startNewChat();  // Започваме нов празен чат