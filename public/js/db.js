import { db } from './config.js';
import { state, setAllChats, setCurrentChatId } from './state.js';
import { renderSidebar } from './ui.js';
import { startNewChat } from './chat.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. LOCAL STORAGE ---
export function loadChatsFromLocalStorage() {
    const localData = localStorage.getItem('scriptsensei_chats');
    const chats = localData ? JSON.parse(localData) : [];
    setAllChats(chats);
    renderSidebar();
    startNewChat();
}

export function saveToLocalStorage() {
    if (!state.currentUser) {
        localStorage.setItem('scriptsensei_chats', JSON.stringify(state.allChats));
    }
}

// --- 2. FIRESTORE LOAD ---
export async function loadChatsFromFirestore() {
    const chatListEl = document.querySelector('.chat-list');
    chatListEl.innerHTML = '<div style="padding:10px; color:#888;">Зареждане...</div>';
    setAllChats([]);

    try {
        const q = query(
            collection(db, "chats"),
            where("userId", "==", state.currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
        const loadedChats = [];

        querySnapshot.forEach((doc) => {
            // Тук взимаме ВСИЧКИ данни от документа (вкл. editorCode и consoleOutput)
            loadedChats.push({ id: doc.id, ...doc.data() });
        });

        loadedChats.sort((a, b) => b.createdAt - a.createdAt);
        setAllChats(loadedChats);

        renderSidebar();
        startNewChat();

    } catch (error) {
        console.error("Грешка при зареждане на чатовете:", error);
        chatListEl.innerHTML = '<div style="padding:10px; color:red;">Грешка. Виж конзолата.</div>';
    }
}

// --- 3. FIRESTORE SAVE ---
export async function saveToFirestore(chat) {
    if (state.currentUser) {
        const isNewChat = typeof chat.id === 'number';

        // Подготвяме данните (включително кода и конзолата)
        const chatData = {
            userId: state.currentUser.uid,
            title: chat.title,
            messages: chat.messages,
            editorCode: chat.editorCode || "",      // 👈 НОВО
            consoleOutput: chat.consoleOutput || "" // 👈 НОВО
        };

        if (isNewChat) {
            const tempId = chat.id;
            chatData.createdAt = Date.now(); // Дата само при създаване

            const docRef = await addDoc(collection(db, "chats"), chatData);

            chat.id = docRef.id;

            if (state.currentChatId === tempId) {
                setCurrentChatId(docRef.id);
            }
        } else {
            const chatRef = doc(db, "chats", chat.id);
            // При update обновяваме всичко важно
            await updateDoc(chatRef, {
                messages: chat.messages,
                title: chat.title,
                editorCode: chat.editorCode || "",      // 👈 НОВО
                consoleOutput: chat.consoleOutput || "" // 👈 НОВО
            });
        }
    }
}

export async function deleteFromFirestore(chatId) {
    if (state.currentUser) {
        await deleteDoc(doc(db, "chats", chatId));
    }
}

export async function saveMessage(text, sender) {
    let chat = state.allChats.find(c => c.id === state.currentChatId);

    if (!chat) {
        chat = {
            id: state.currentChatId,
            title: text.substring(0, 30) + "...",
            messages: [],
            userId: state.currentUser ? state.currentUser.uid : 'guest',
            editorCode: "",     // Инициализираме
            consoleOutput: ""
        };
        state.allChats.unshift(chat);
    }

    chat.messages.push({ text, sender });

    if (state.currentUser) {
        await saveToFirestore(chat);
    } else {
        saveToLocalStorage();
    }

    renderSidebar();
}

export async function saveFeedbackToHistory(messageText, feedbackType) {
    const chat = state.allChats.find(c => c.id === state.currentChatId);
    if (!chat) return;

    const msgIndex = chat.messages.findIndex(m => m.text === messageText && m.sender === 'bot');

    if (msgIndex !== -1) {
        chat.messages[msgIndex].feedback = feedbackType;

        if (state.currentUser) {
            await saveToFirestore(chat);
        } else {
            saveToLocalStorage();
        }
    }
}

// 🔥 ТУК Е ГЛАВНИЯТ FIX ЗА БУТОНА RUN 🔥
export async function updateChatData(chat) {
    if (state.currentUser) {
        try {
            const chatRef = doc(db, "chats", chat.id);
            // Преди обновяваше само title и isPinned. 
            // Сега обновява и КОДА!
            await updateDoc(chatRef, {
                title: chat.title,
                isPinned: chat.isPinned || false,
                editorCode: chat.editorCode || "",      // 👈 ВАЖНО
                consoleOutput: chat.consoleOutput || "" // 👈 ВАЖНО
            });
        } catch (e) {
            console.error("Error updating chat:", e);
        }
    } else {
        saveToLocalStorage();
    }
}

export async function sendFeedbackReport(type, messageContent, reasons = [], details = "") {
    try {
        const report = {
            type: type,
            message: messageContent,
            userEmail: state.currentUser ? state.currentUser.email : "Guest",
            userId: state.currentUser ? state.currentUser.uid : "anonymous",
            timestamp: Date.now(),
            date: new Date().toLocaleString()
        };

        if (type === 'dislike') {
            report.reasons = reasons;
            report.details = details;
        }

        await addDoc(collection(db, "feedback_logs"), report);
        console.log(`✅ Feedback (${type}) изпратен успешно!`);
    } catch (error) {
        console.error("Грешка при пращане на feedback:", error);
    }
}