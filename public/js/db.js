import { db } from './config.js';
import { state, setAllChats, setCurrentChatId, setPremiumStatus } from './state.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. LOCAL STORAGE ---
export async function loadChatsFromLocalStorage() {
    const localData = localStorage.getItem('scriptsensei_chats');
    const chats = localData ? JSON.parse(localData) : [];
    setAllChats(chats);

    // ✅ DYNAMIC IMPORT (Зареждаме ги само когато трябват)
    const ui = await import('./ui.js');
    const chat = await import('./chat.js');
    ui.renderSidebar();
    chat.startNewChat();
}

export function saveToLocalStorage() {
    if (!state.currentUser) {
        localStorage.setItem('scriptsensei_chats', JSON.stringify(state.allChats));
    }
}

// --- 2. FIRESTORE LOAD ---
export async function loadChatsFromFirestore() {
    const chatListEl = document.querySelector('.chat-list');
    if (chatListEl) chatListEl.innerHTML = '<div style="padding:10px; color:#888;">Зареждане...</div>';
    setAllChats([]);

    try {
        const q = query(
            collection(db, "chats"),
            where("userId", "==", state.currentUser.uid),
            orderBy("createdAt", "desc"),
            limit(20)
        );

        const querySnapshot = await getDocs(q);
        const loadedChats = [];

        querySnapshot.forEach((doc) => {
            loadedChats.push({ id: doc.id, ...doc.data() });
        });

        loadedChats.sort((a, b) => b.createdAt - a.createdAt);
        setAllChats(loadedChats);

        // ✅ DYNAMIC IMPORT
        const ui = await import('./ui.js');
        const chat = await import('./chat.js');
        ui.renderSidebar();
        chat.startNewChat();

    } catch (error) {
        console.error("Грешка при зареждане на чатовете:", error);
        if (chatListEl) chatListEl.innerHTML = '<div style="padding:10px; color:red;">Грешка. Виж конзолата.</div>';
    }
}

// --- 3. FIRESTORE SAVE ---
export async function saveToFirestore(chat) {
    if (state.currentUser) {
        const isNewChat = typeof chat.id === 'number';

        const chatData = {
            userId: state.currentUser.uid,
            title: chat.title,
            messages: chat.messages,
            editorCode: chat.editorCode || "",
            consoleOutput: chat.consoleOutput || ""
        };

        if (isNewChat) {
            const tempId = chat.id;
            chatData.createdAt = Date.now();
            const docRef = await addDoc(collection(db, "chats"), chatData);
            chat.id = docRef.id;

            if (state.currentChatId === tempId) {
                setCurrentChatId(docRef.id);
            }
        } else {
            const chatRef = doc(db, "chats", chat.id);
            await updateDoc(chatRef, {
                messages: chat.messages,
                title: chat.title,
                editorCode: chat.editorCode || "",
                consoleOutput: chat.consoleOutput || ""
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
            editorCode: "",
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

    // ✅ DYNAMIC IMPORT
    const ui = await import('./ui.js');
    ui.renderSidebar();
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

export async function updateChatData(chat) {
    if (state.currentUser) {
        try {
            const chatRef = doc(db, "chats", chat.id);
            await updateDoc(chatRef, {
                title: chat.title,
                isPinned: chat.isPinned || false,
                editorCode: chat.editorCode || "",
                consoleOutput: chat.consoleOutput || ""
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

export async function loadUserProfile(userId) {
    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.hasPremiumAccess) {
                setPremiumStatus(true);
                console.log("💎 User has premium access!");
            } else {
                setPremiumStatus(false);
            }
        } else {
            // Ако няма запис, значи е нов и не е Pro
            setPremiumStatus(false);
        }
    } catch (e) {
        console.error("Error loading profile:", e);
    }
}