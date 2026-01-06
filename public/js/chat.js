import { state, setCurrentChatId } from './state.js';
import { addMessageToUI, renderSidebar, showLoading, removeLoading, renderAttachments } from './ui.js';
import { saveToFirestore, saveToLocalStorage, saveMessage } from './db.js';
import { API_URL, TITLE_API_URL } from './config.js';
import { editor } from './editor.js';

// --- START NEW CHAT ---
export function startNewChat() {
    setCurrentChatId(Date.now()); // Временно ID
    const chatHistory = document.getElementById('chat-history');
    chatHistory.innerHTML = '';

    // 1. Показваме поздрава
    addMessageToUI("Здравей! Аз съм твоят ментор. Какво искаш да научим днес?", 'bot', null, true);

    // 2. Добавяме SUGGESTION CHIPS
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
    // Скролваме леко
    chipsContainer.scrollIntoView({ behavior: "smooth", block: "end" });

    // Махаме активния клас от менюто
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
}

// --- LOAD CHAT ---
export function loadChat(id) {
    setCurrentChatId(id);
    const chatHistory = document.getElementById('chat-history');
    chatHistory.innerHTML = '';
    const sidebar = document.getElementById('sidebar');

    const chat = state.allChats.find(c => c.id === id);
    if (chat) {
        // Винаги показваме поздрава
        addMessageToUI("Здравей! Аз съм твоят ментор. Какво искаш да научим днес?", 'bot', null, true);
        chat.messages.forEach(msg => addMessageToUI(msg.text, msg.sender, msg.feedback));
    }

    renderSidebar();
    if (window.innerWidth < 800) sidebar.classList.remove('open');
}

// --- SEND MESSAGE ---
export async function sendMessage() {
    const userInput = document.getElementById('user-input');
    const text = userInput.value;

    // Проверка: Има ли текст ИЛИ файлове?
    if (text.trim() === "" && state.currentAttachments.length === 0) return;

    const isNewChat = !state.allChats.find(c => c.id === state.currentChatId) || (typeof state.currentChatId === 'number');

    // UI: Текст
    if (text.trim() !== "") {
        addMessageToUI(text, 'user');
        await saveMessage(text, 'user');
    }

    // UI: Файлове
    if (state.currentAttachments.length > 0) {
        const fileNames = state.currentAttachments.map(f => f.name).join(', ');
        addMessageToUI(`📎 <i>Изпратени файлове (${state.currentAttachments.length}): ${fileNames}</i>`, 'user');
    }

    userInput.value = '';
    userInput.style.height = 'auto';

    // Smart Title Logic
    if (isNewChat && text.trim() !== "") {
        setTimeout(() => generateSmartTitle(state.currentChatId, text), 500);
    }

    // Context Logic
    const currentChat = state.allChats.find(c => c.id === state.currentChatId);
    let messagesPayload = [];
    if (currentChat && currentChat.messages) {
        messagesPayload = currentChat.messages.slice(-10).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));
    }

    // Подготовка на Payload (взимаме код от Едитора)
    const editorCode = editor.getValue();
    const consoleOutput = document.getElementById('console-output').innerText;
    let messageToSendToAI = text;

    if (messageToSendToAI.trim() === "" && state.currentAttachments.length > 0) {
        messageToSendToAI = "Разгледай прикачените файлове.";
    }

    if (editorCode.trim().length > 0) {
        messageToSendToAI += `\n\n--- [SYSTEM CONTEXT] ---\nCODE:\n\`\`\`javascript\n${editorCode}\n\`\`\`\nCONSOLE:\n${consoleOutput}\n------------------------`;
    }

    messagesPayload.push({ role: 'user', content: messageToSendToAI });

    showLoading();

    const requestBody = { messages: messagesPayload };

    // 🔥 ПРИКАЧВАМЕ ФАЙЛОВЕТЕ ОТ STATE
    if (state.currentAttachments.length > 0) {
        requestBody.attachments = state.currentAttachments;

        // Чистим UI
        state.currentAttachments.length = 0; // Изчистване на масива
        renderAttachments();
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        removeLoading();

        if (data.reply) {
            addMessageToUI(data.reply, 'bot');
            await saveMessage(data.reply, 'bot');
        } else if (data.error) {
            addMessageToUI("🚨 " + data.error, 'bot');
        }

    } catch (error) {
        removeLoading();
        addMessageToUI("Грешка: Сървърът не отговаря.", 'bot');
        console.error(error);
    }
}

// --- GENERATE TITLE ---
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