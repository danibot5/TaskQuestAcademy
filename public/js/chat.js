import { state, setCurrentChatId } from './state.js';
import { addMessageToUI, renderSidebar, scrollToBottom, showLoading, removeLoading, renderAttachments, updateLastBotMessage } from './ui.js';
import { showToast } from './utils.js';
import { saveToFirestore, saveToLocalStorage, saveMessage, updateChatData } from './db.js';
import { API_URL, TITLE_API_URL } from './config.js';
import { editor } from './editor.js';

export async function startNewChat() {
    // 1. 💾 Запазваме текущия код и КОНЗОЛАТА преди да изчистим
    if (state.currentChatId) {
        const currentChat = state.allChats.find(c => c.id === state.currentChatId);
        if (currentChat) {
            currentChat.editorCode = editor.getValue();
            // 👇 НОВО: Запазваме конзолата на текущия чат преди да избягаме
            const consoleEl = document.getElementById('console-output');
            if (consoleEl) currentChat.consoleOutput = consoleEl.innerHTML;

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

    // 👇 НОВО: Чистим и конзолата (да не стои старата)
    const consoleOutput = document.getElementById('console-output');
    if (consoleOutput) {
        consoleOutput.innerHTML = '<div class="console-label">Console Output:</div>';
    }

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
    const consoleOutput = document.getElementById('console-output');

    // 1. 💾 ЗАПАЗВАНЕ НАф СТАРИЯ ЧАТ (Преди да сменим)
    const oldChatId = state.currentChatId;
    if (oldChatId && oldChatId !== id) {
        const oldChat = state.allChats.find(c => c.id === oldChatId);
        if (oldChat) {
            // Взимаме кода от редактора
            oldChat.editorCode = editor.getValue();

            // 👇 НОВО: Запазваме и конзолата на стария чат
            if (consoleOutput) {
                oldChat.consoleOutput = consoleOutput.innerHTML;
            }

            // Запазваме в базата
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

        // 🔥 Връщаме кода в редактора!
        if (chat.editorCode) {
            editor.setValue(chat.editorCode);
        } else {
            editor.setValue("// Твоят код ще се запази тук автоматично...");
        }

        // 👇 НОВО: ВЪЗСТАНОВЯВАМЕ КОНЗОЛАТА 🔥
        if (consoleOutput) {
            if (chat.consoleOutput) {
                consoleOutput.innerHTML = chat.consoleOutput;
            } else {
                // Ако няма запазена конзола, я нулираме
                consoleOutput.innerHTML = '<div class="console-label">Console Output:</div>';
            }
        }
    }

    renderSidebar();
    if (window.innerWidth < 800 && sidebar) sidebar.classList.remove('open');

    scrollToBottom(false);

    setTimeout(() => {
        scrollToBottom(false);
    }, 75);
}

export async function sendMessage(retryCount = 0) {
    const userInput = document.getElementById('user-input');

    const now = Date.now();
    state.messageTimestamps = state.messageTimestamps.filter(t => now - t < 60000);
    const LIMIT = state.hasPremiumAccess ? 50 : 3;
    if (state.messageTimestamps.length >= LIMIT) {
        if (!state.hasPremiumAccess) {
            showToast("🔒 Free Limit: Само 3 съобщения на минута!", "⏳");
            setTimeout(() => document.getElementById('profile-modal').style.display = 'flex', 1500);
        } else {
            showToast("По-леко! 50 съобщения/мин е лимитът!", "🚀");
        }
        return;
    }
    const MAX_FILES = state.hasPremiumAccess ? 10 : 1;
    if (state.currentAttachments.length > MAX_FILES) {
        showToast("Твърде много файлове!", "📂");
        return;
    }
    if (retryCount === 0) state.messageTimestamps.push(now);

    let text = userInput.value;
    const isNewChat = (typeof state.currentChatId === 'number');

    if (retryCount === 0 && text.trim() === "" && state.currentAttachments.length === 0) return;

    if (retryCount === 0) {
        if (text.trim() !== "") {
            addMessageToUI(text, 'user');
            await saveMessage(text, 'user');
        }

        if (state.currentAttachments.length > 0) {
            const fileNames = state.currentAttachments.map(f => f.name).join(', ');
            addMessageToUI(`📎 <i>Изпратени файлове: ${fileNames}</i>`, 'user');
        }

        userInput.value = '';
        userInput.style.height = 'auto';

        userInput.blur();

        setTimeout(() => {
            scrollToBottom(true);
        }, 75);

        if (isNewChat && text.trim() !== "") setTimeout(() => generateSmartTitle(state.currentChatId, text), 500);
    }

    const currentChat = state.allChats.find(c => c.id === state.currentChatId);
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

    const requestBody = {
        messages: messagesPayload,
        userId: state.currentUser ? state.currentUser.uid : null,
        preferredModel: state.selectedModel,
        attachments: (retryCount === 0 && state.currentAttachments.length > 0) ? state.currentAttachments : undefined
    };

    if (retryCount === 0) {
        state.currentAttachments.length = 0;
        renderAttachments();
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        removeLoading();
        addMessageToUI("", 'bot');

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let displayedText = "";
        const queue = [];
        let isStreamDone = false;

        const typingInterval = setInterval(() => {
            if (queue.length > 0) {
                const speed = queue.length > 50 ? 2 : 1;
                const chunk = queue.splice(0, speed).join('');

                displayedText += chunk;
                updateLastBotMessage(displayedText);
            } else if (isStreamDone) {
                clearInterval(typingInterval);
                saveMessage(displayedText, 'bot');
            }
        }, 12);

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                isStreamDone = true;
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            queue.push(...chunk.split(''));
        }

    } catch (error) {
        console.error(error);
        removeLoading();
        addMessageToUI("🚨 Грешка: Нещо се обърка с връзката.", 'bot');
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