import { state, setCurrentChatId } from './state.js';
import { addMessageToUI, renderSidebar, showLoading, removeLoading, renderAttachments } from './ui.js';
import { saveToFirestore, saveToLocalStorage, saveMessage, updateChatData } from './db.js';
import { API_URL, TITLE_API_URL } from './config.js';
import { editor } from './editor.js';

export async function startNewChat() {
    // 1. 💾 Запазваме текущия код преди да изчистим
    if (state.currentChatId) {
        const currentChat = state.allChats.find(c => c.id === state.currentChatId);
        if (currentChat) {
            currentChat.editorCode = editor.getValue();
            if (state.currentUser) updateChatData(currentChat);
            else saveToLocalStorage();
        }
    }

    // 2. Създаваме нов чат
    setCurrentChatId(Date.now());
    const chatHistory = document.getElementById('chat-history');
    chatHistory.innerHTML = '';

    // 3. 🧹 Чистим редактора за новото начало
    editor.setValue("// Нов чат, ново начало! 🚀");

    addMessageToUI("Здравей! Аз съм твоят ментор. Какво искаш да научим днес?", 'bot', null, true);

    // ... (кодът за suggestions си остава същият надолу) ...
    const suggestions = [
        { text: "Напиши код за Snake игра!" },
        { text: "Обясни ми какво е Closure!" },
        { text: "Дебъгни кода в редактора!" },
        { text: "Как работи async/await?" }
    ];

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'suggestions-container';
    chipsContainer.style.marginLeft = "50px";
    chipsContainer.style.marginBottom = "20px";

    // ... (останалото си е същото) ...
    const userInput = document.getElementById('user-input');
    suggestions.forEach(item => {
        const card = document.createElement('button');
        card.className = 'suggestion-card';
        card.innerHTML = `<span class="suggestion-text">${item.text}</span>`;
        card.onclick = () => {
            userInput.value = `${item.text}`;
            chipsContainer.remove();
            sendMessage();
        };
        chipsContainer.appendChild(card);
    });

    chatHistory.appendChild(chipsContainer);
    chipsContainer.scrollIntoView({ behavior: "smooth", block: "end" });

    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
}

export async function loadChat(id) {
    // 1. 💾 ЗАПАЗВАНЕ НА СТАРИЯ ЧАТ (Преди да сменим)
    const oldChatId = state.currentChatId;
    if (oldChatId && oldChatId !== id) {
        const oldChat = state.allChats.find(c => c.id === oldChatId);
        if (oldChat) {
            // Взимаме кода от редактора и го лепим към стария чат обект
            oldChat.editorCode = editor.getValue();

            // Запазваме в базата (без да чакаме, fire-and-forget)
            if (state.currentUser) updateChatData(oldChat);
            else saveToLocalStorage();
        }
    }

    // 2. 🔄 ЗАРЕЖДАНЕ НА НОВИЯ ЧАТ
    setCurrentChatId(id);
    const chatHistory = document.getElementById('chat-history');
    chatHistory.innerHTML = '';
    const sidebar = document.getElementById('sidebar');

    const chat = state.allChats.find(c => c.id === id);
    if (chat) {
        // Зареждане на съобщенията
        addMessageToUI("Здравей! Аз съм твоят ментор. Какво искаш да научим днес?", 'bot', null, true);
        if (chat.messages) {
            chat.messages.forEach(msg => addMessageToUI(msg.text, msg.sender, msg.feedback));
        }

        // 🔥 МАГИЯТА: Връщаме кода в редактора!
        if (chat.editorCode) {
            editor.setValue(chat.editorCode);
        } else {
            // Ако няма запазен код, чистим редактора
            editor.setValue("// Твоят код ще се запази тук автоматично...");
        }
    }

    renderSidebar();
    if (window.innerWidth < 800 && sidebar) sidebar.classList.remove('open');

    setTimeout(() => {
        if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
    }, 50);
}

export async function sendMessage(retryCount = 0) {
    const userInput = document.getElementById('user-input');
    let text = userInput.value;

    // --- ФИКС: Запомняме дали е нов чат ТУК, преди да сме го запазили ---
    // (Защото след saveMessage ID-то се сменя и вече не е число)
    const isNewChat = (typeof state.currentChatId === 'number');
    // ------------------------------------------------------------------

    if (retryCount === 0 && text.trim() === "" && state.currentAttachments.length === 0) return;

    if (retryCount === 0) {
        if (text.trim() !== "") {
            addMessageToUI(text, 'user');
            await saveMessage(text, 'user'); // Тук ID-то се обновява
        }
        if (state.currentAttachments.length > 0) {
            const fileNames = state.currentAttachments.map(f => f.name).join(', ');
            addMessageToUI(`📎 <i>Изпратени файлове (${state.currentAttachments.length}): ${fileNames}</i>`, 'user');
        }

        userInput.value = '';
        userInput.style.height = 'auto';

        // Използваме запомнената променлива от началото
        if (isNewChat && text.trim() !== "") {
            // Важно: Подаваме state.currentChatId, което вече е обновеното (истинско) ID
            setTimeout(() => generateSmartTitle(state.currentChatId, text), 500);
        }
    }

    const currentChat = state.allChats.find(c => c.id === state.currentChatId);
    if (currentChat) {
        currentChat.editorCode = editor.getValue();
    }
    
    let messagesPayload = [];

    if (currentChat && currentChat.messages) {
        messagesPayload = currentChat.messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));
    }

    const editorCode = editor.getValue();
    const consoleOutput = document.getElementById('console-output').innerText;

    if (messagesPayload.length > 0) {
        const lastMsg = messagesPayload[messagesPayload.length - 1];
        if (lastMsg.role === 'user' && editorCode.trim().length > 0 && !lastMsg.content.includes('[SYSTEM CONTEXT]')) {
            lastMsg.content += `\n\n--- [SYSTEM CONTEXT] ---\nCODE:\n\`\`\`javascript\n${editorCode}\n\`\`\`\nCONSOLE:\n${consoleOutput}\n------------------------`;
        }
    }

    if (retryCount === 0) showLoading();

    const requestBody = { messages: messagesPayload };

    if (retryCount === 0 && state.currentAttachments.length > 0) {
        requestBody.attachments = state.currentAttachments;
        state.currentAttachments.length = 0;
        renderAttachments();
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        // Логика за повторен опит при натоварване (Retry Logic)
        if (data.reply && (data.reply.includes("Много заявки") || data.reply.includes("429"))) {
            if (retryCount < 3) {
                console.warn(`Server busy. Retrying in 4s... (Attempt ${retryCount + 1})`);

                const loadingBubble = document.querySelector('#loading-indicator .typing-indicator');
                if (loadingBubble) loadingBubble.style.opacity = '0.5';

                setTimeout(() => {
                    sendMessage(retryCount + 1);
                }, 4000);
                return;
            }
        }

        removeLoading();

        if (data.reply) {
            addMessageToUI(data.reply, 'bot');
            await saveMessage(data.reply, 'bot');
        } else if (data.error) {
            if (data.error.includes('429') || data.error.includes('Too Many Requests')) {
                addMessageToUI("😅 Сървърите са много натоварени в момента. Моля, опитай пак след 1 минута.", 'bot');
            } else {
                addMessageToUI("🚨 " + data.error, 'bot');
            }
        }

    } catch (error) {
        console.error(error);
        if (retryCount < 3) {
            setTimeout(() => sendMessage(retryCount + 1), 4000);
        } else {
            removeLoading();
            addMessageToUI("Грешка: Сървърът не отговаря.", 'bot');
        }
    }
}

async function generateSmartTitle(chatId, firstMessage) {
    try {
        const response = await fetch(TITLE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: firstMessage })
        });

        const data = await response.json();

        if (data.reply) {
            const chat = state.allChats.find(c => c.id === chatId);
            if (chat) {
                chat.title = data.reply;
                if (state.currentUser) {
                    await saveToFirestore(chat);
                } else {
                    saveToLocalStorage();
                }
                renderSidebar();
            }
        }
    } catch (error) {
        console.error("Failed to generate title:", error);
    }
}