// Импортираме Firebase функциите
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, orderBy, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================================
// --- 1. FIREBASE CONFIG ---
// ==========================================================
const firebaseConfig = {
    apiKey: "AIzaSyBBHjUB1-WbBPW9d8TBj4w_DjUAwDZ4Dlc",
    authDomain: "scriptsensei-4e8fe.firebaseapp.com",
    projectId: "scriptsensei-4e8fe",
    storageBucket: "scriptsensei-4e8fe.firebasestorage.app",
    messagingSenderId: "1043964924444",
    appId: "1:1043964924444:web:1606274b5d28087d4b05d9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ==========================================
// 2. ГЛОБАЛНИ ПРОМЕНЛИВИ
// ==========================================
let currentUser = null;
let currentChatId = null;
let allChats = [];

const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menu-btn');
const closeSidebarBtn = document.getElementById('close-sidebar');
const newChatBtn = document.getElementById('new-chat-btn');
const chatList = document.querySelector('.chat-list');

// Auth DOM Elements
const guestButtons = document.getElementById('guest-buttons');
const userInfoDiv = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');

// Modal Elements
const openRegBtn = document.getElementById('open-register-btn');
const openLoginBtn = document.getElementById('open-login-btn');
const regModal = document.getElementById('register-modal');
const loginModal = document.getElementById('login-modal');
const closeModals = document.querySelectorAll('.close-modal');

// Линк към Backend (Смени го, ако не е локален)
const API_URL = 'http://127.0.0.1:5001/scriptsensei-4e8fe/us-central1/chat';

// ==========================================
// 3. AUTHENTICATION LOGIC (Вход/Изход)
// ==========================================

// Слушаме дали някой влиза или излиза
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User Logged In
        currentUser = user;
        guestButtons.style.display = 'none';
        userInfoDiv.style.display = 'flex';

        // Ако няма аватар (напр. имейл регистрация), слагаме иконка по подразбиране
        userAvatar.src = user.photoURL || 'bot-avatar.png';
        userName.innerText = user.displayName || user.email.split('@')[0];

        // Затваряме всички модали, ако са отворени
        regModal.style.display = 'none';
        loginModal.style.display = 'none';

        loadChatsFromFirestore();
    } else {
        // Guest Mode
        currentUser = null;
        guestButtons.style.display = 'flex';
        userInfoDiv.style.display = 'none';
        loadChatsFromLocalStorage();
    }
});

// --- MODAL CONTROLS ---
openRegBtn.addEventListener('click', () => { regModal.style.display = 'flex'; });
openLoginBtn.addEventListener('click', () => { loginModal.style.display = 'flex'; });

closeModals.forEach(btn => {
    btn.addEventListener('click', () => {
        regModal.style.display = 'none';
        loginModal.style.display = 'none';
    });
});

// Затваряне при клик извън кутията
window.addEventListener('click', (e) => {
    if (e.target == regModal) regModal.style.display = 'none';
    if (e.target == loginModal) loginModal.style.display = 'none';
});

// --- ЛОГИКА ЗА РЕГИСТРАЦИЯ (EMAIL) ---
document.getElementById('perform-register-btn').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const errorBox = document.getElementById('reg-error');

    errorBox.innerText = ""; // Чистим стари грешки

    if (!name || !email || !password) {
        errorBox.innerText = "Моля, попълнете всички полета.";
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Запазваме името на потребителя
        await updateProfile(user, { displayName: name });

        // Презареждаме страницата, за да се види името веднага
        window.location.reload();
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') errorBox.innerText = "Този имейл вече е регистриран.";
        else if (error.code === 'auth/weak-password') errorBox.innerText = "Паролата е твърде слаба (мин. 6 символа).";
        else errorBox.innerText = "Грешка: " + error.message;
    }
});

// --- ЛОГИКА ЗА ВХОД (EMAIL) ---
document.getElementById('perform-login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorBox = document.getElementById('login-error');

    errorBox.innerText = "";

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Успех! onAuthStateChanged ще свърши останалото
    } catch (error) {
        console.error(error);
        errorBox.innerText = "Грешен имейл или парола.";
    }
});

// --- ЛОГИКА ЗА ВХОД (GOOGLE) - ВЪТРЕ В МОДАЛА ---
document.getElementById('google-login-btn').addEventListener('click', () => {
    signInWithPopup(auth, googleProvider).catch((error) => {
        document.getElementById('login-error').innerText = error.message;
    });
});

// Logout си е същият
logoutBtn.addEventListener('click', () => signOut(auth));


// ==========================================
// 4. DATA LOGIC (Историята)
// ==========================================

// --- ВАРИАНТ А: GUEST (LocalStorage) ---
function loadChatsFromLocalStorage() {
    const localData = localStorage.getItem('scriptsensei_chats');
    allChats = localData ? JSON.parse(localData) : [];
    renderSidebar();
    startNewChat(); // Отваряме нов чат
}

function saveToLocalStorage() {
    if (!currentUser) {
        localStorage.setItem('scriptsensei_chats', JSON.stringify(allChats));
    }
}

// --- ВАРИАНТ Б: USER (Firestore) ---
async function loadChatsFromFirestore() {
    chatList.innerHTML = '<div style="padding:10px; color:#888;">Зареждане...</div>';

    // 1. ВЕДНАГА чистим старите чатове, за да не се смесват с тези на потребителя!
    allChats = [];

    try {
        // 2. Променихме заявката: Махнахме 'orderBy', за да не гърми за липсващ индекс
        const q = query(
            collection(db, "chats"),
            where("userId", "==", currentUser.uid)
        );

        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            allChats.push({ id: doc.id, ...doc.data() });
        });

        // 3. Сортираме тук (в JavaScript), вместо в базата
        // (Най-новите отгоре)
        allChats.sort((a, b) => b.createdAt - a.createdAt);

        renderSidebar();

        // Стартираме нов чат, само ако нямаме никакви заредени
        // (За да не ти отваря празен чат всеки път, ако искаш да видиш старите)
        startNewChat();

    } catch (error) {
        console.error("Грешка при зареждане на чатовете:", error);
        chatList.innerHTML = '<div style="padding:10px; color:red;">Грешка. Виж конзолата.</div>';
    }
}

async function saveToFirestore(chat) {
    if (currentUser) {
        // Проверка дали ID-то е число (значи е временно, локално)
        const isNewChat = typeof chat.id === 'number';

        if (isNewChat) {
            // Запазваме временното ID, за да знаем какво да сменим
            const tempId = chat.id;

            // Създаваме нов документ в облака
            const docRef = await addDoc(collection(db, "chats"), {
                userId: currentUser.uid,
                title: chat.title,
                messages: chat.messages,
                createdAt: Date.now()
            });

            // Сменяме временното ID с истинското от базата в обекта
            chat.id = docRef.id;

            // 🔥 ВАЖНАТА ПОПРАВКА 🔥
            // Трябва да кажем на приложението: "Хей, текущият чат вече не е 123, а е abc!"
            if (currentChatId === tempId) {
                currentChatId = docRef.id;
            }

        } else {
            // Ако вече си е с истинско ID, само обновяваме съобщенията
            const chatRef = doc(db, "chats", chat.id);
            await updateDoc(chatRef, {
                messages: chat.messages,
                title: chat.title
            });
        }
    }
}

async function deleteFromFirestore(chatId) {
    if (currentUser) {
        await deleteDoc(doc(db, "chats", chatId));
    }
}


// ==========================================
// 5. CHAT FUNCTIONS
// ==========================================

function startNewChat() {
    currentChatId = Date.now(); // Временно ID
    chatHistory.innerHTML = '';
    addMessageToUI("Здравей! Аз съм твоят ментор. Какво искаш да научим днес?", 'bot');

    // Махаме активния клас от менюто
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
}

async function saveMessage(text, sender) {
    let chat = allChats.find(c => c.id === currentChatId);

    // Ако няма такъв чат, създаваме го
    if (!chat) {
        chat = {
            id: currentChatId,
            title: text.substring(0, 30) + "...", // Първите думи са заглавие
            messages: [],
            userId: currentUser ? currentUser.uid : 'guest'
        };
        allChats.unshift(chat); // Слагаме го най-отпред в масива
    }

    chat.messages.push({ text, sender });

    // Запазваме според това дали си Guest или User
    if (currentUser) {
        await saveToFirestore(chat);
    } else {
        saveToLocalStorage();
    }

    renderSidebar();
}

function loadChat(id) {
    currentChatId = id;
    chatHistory.innerHTML = '';

    const chat = allChats.find(c => c.id === id);
    if (chat) {
        addMessageToUI("Здравей! Аз съм твоят ментор. Какво искаш да научим днес?", 'bot'); // Винаги показваме поздрава
        chat.messages.forEach(msg => addMessageToUI(msg.text, msg.sender));
    }

    renderSidebar();
    if (window.innerWidth < 800) sidebar.classList.remove('open');
}

function renderSidebar() {
    chatList.innerHTML = '';

    // Сортираме (ако сме Guest, защото Firestore ги връща сортирани)
    if (!currentUser) {
        // allChats.sort((a, b) => b.id - a.id); 
    }

    allChats.forEach(chat => {
        const div = document.createElement('div');
        div.classList.add('chat-item');
        if (chat.id === currentChatId) div.classList.add('active');

        // Клик върху чата
        div.addEventListener('click', () => loadChat(chat.id));

        const titleSpan = document.createElement('span');
        titleSpan.classList.add('chat-title');
        titleSpan.innerText = chat.title || "Нов разговор";

        const delBtn = document.createElement('button');
        delBtn.classList.add('delete-btn');
        delBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        `;

        // Клик върху кошчето
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm("Искаш ли да изтриеш този чат?")) return;

            // Локално изтриване
            allChats = allChats.filter(c => c.id !== chat.id);

            // Cloud/Storage изтриване
            if (currentUser) {
                await deleteFromFirestore(chat.id);
            } else {
                saveToLocalStorage();
            }

            if (chat.id === currentChatId) startNewChat();
            else renderSidebar();
        });

        div.appendChild(titleSpan);
        div.appendChild(delBtn);
        chatList.appendChild(div);
    });
}

// ==========================================
// 6. UI HELPERS (Непроменени)
// ==========================================

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
        avatarImg.src = 'bot-avatar.png'; // Твоята икона
        avatarImg.classList.add('avatar');

        const textDiv = document.createElement('div');
        textDiv.classList.add('bot-text');

        // Markdown + Highlighting
        if (typeof marked !== 'undefined') {
            textDiv.innerHTML = marked.parse(text);
            if (typeof hljs !== 'undefined') {
                textDiv.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }
        } else {
            textDiv.innerText = text;
        }

        // Бутон "Прехвърли в редактора"
        if (text.includes('```')) {
            const codeMatch = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
            if (codeMatch && codeMatch[1]) {
                const cleanCode = codeMatch[1].trim();
                const runCodeBtn = document.createElement('button');
                runCodeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg> Прехвърли в редактора`;
                runCodeBtn.className = "code-btn";
                runCodeBtn.onclick = function () {
                    document.getElementById('code-editor').value = cleanCode;
                    runCodeBtn.innerHTML = "✅ Готово!";
                    setTimeout(() => runCodeBtn.innerHTML = "Прехвърли пак", 2000);
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
    rowDiv.id = 'loading-indicator';

    const avatarImg = document.createElement('img');
    avatarImg.src = 'bot-avatar.png';
    avatarImg.classList.add('avatar');

    const bubble = document.createElement('div');
    bubble.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;

    rowDiv.appendChild(avatarImg);
    rowDiv.appendChild(bubble);
    chatHistory.appendChild(rowDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function removeLoading() {
    const loader = document.getElementById('loading-indicator');
    if (loader) loader.remove();
}

// ==========================================
// 7. EVENT LISTENERS
// ==========================================

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

async function sendMessage() {
    const text = userInput.value;
    if (text.trim() === "") return;

    addMessageToUI(text, 'user');
    await saveMessage(text, 'user'); // Запазваме веднага
    userInput.value = '';

    // --- CONTEXT INJECTION ---
    const currentChat = allChats.find(c => c.id === currentChatId);
    let messagesPayload = [];

    if (currentChat) {
        const recentMessages = currentChat.messages.slice(-10);
        messagesPayload = recentMessages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));
    }

    const editorCode = document.getElementById('code-editor').value;
    const consoleOutput = document.getElementById('console-output').innerText;
    let messageToSendToAI = text;

    if (editorCode.trim().length > 0) {
        messageToSendToAI += `\n\n--- [SYSTEM CONTEXT] ---\nCODE:\n\`\`\`javascript\n${editorCode}\n\`\`\`\nCONSOLE:\n${consoleOutput}\n------------------------`;
    }

    messagesPayload.push({ role: 'user', content: messageToSendToAI });

    showLoading();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: messagesPayload })
        });

        const data = await response.json();
        removeLoading();

        if (data.reply) {
            addMessageToUI(data.reply, 'bot');
            await saveMessage(data.reply, 'bot'); // Запазваме отговора
        } else if (data.error) {
            addMessageToUI("🚨 " + data.error, 'bot');
        }

    } catch (error) {
        removeLoading();
        addMessageToUI("Грешка: Сървърът не отговаря.", 'bot');
        console.error(error);
    }
}

// Side Menu Listeners
if (menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
if (newChatBtn) newChatBtn.addEventListener('click', () => { startNewChat(); sidebar.classList.remove('open'); });

// Code Runner
document.getElementById('run-btn').addEventListener('click', () => {
    const userCode = document.getElementById('code-editor').value;
    const outputBox = document.getElementById('console-output');
    outputBox.innerHTML = '<div class="console-label">Console Output:</div>';

    try {
        const originalLog = console.log;
        console.log = (msg) => { outputBox.innerHTML += `<div>> ${msg}</div>`; originalLog(msg); };
        new Function(userCode)();
        console.log = originalLog;
    } catch (e) {
        outputBox.innerHTML += `<div style="color:#ff4444;">🚨 ${e.message}</div>`;
    }
});

const micBtn = document.getElementById('mic-btn');
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');

// --- ГЛАСОВО РАЗПОЗНАВАНЕ ---
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
    if (micBtn) micBtn.style.display = 'none';
}

// --- КАЧВАНЕ НА ФАЙЛОВЕ ---
if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            // Вмъкваме съдържанието в полето за писане
            userInput.value = `Ето съдържанието на файла "${file.name}":\n\n${content}\n\nМоля, обясни кода.`;
            userInput.focus();
        };
        reader.readAsText(file);
        fileInput.value = ''; // Чистим, за да може да качим същия файл пак
    });
}

// Start
startNewChat();