// Импортираме Firebase функциите
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
    const userDetailsDiv = document.querySelector('.user-details');

    if (user) {
        // --- ПОТРЕБИТЕЛЯТ Е ВЛЯЗЪЛ ---
        currentUser = user;

        // Скриваме/Показваме основните контейнери
        guestButtons.style.display = 'none';
        userInfoDiv.style.display = 'flex';

        // Слагаме аватара
        userAvatar.src = user.photoURL || 'bot-avatar.png';

        // 1. Подготвяме името
        let nameHTML = `<div id="user-name" style="font-weight: bold; font-size: 0.9rem;">${user.displayName || 'User'}</div>`;

        // Ако е потвърден, добавяме тикчето към името
        if (user.emailVerified) {
            nameHTML = `<div id="user-name" style="font-weight: bold; font-size: 0.9rem;">
                ${user.displayName || 'User'} <span title="Потвърден" style="color: #4caf50;">✔</span>
             </div>`;
        }

        // 2. Подготвяме имейла
        const emailHTML = `<div class="user-email-text">${user.email}</div>`;

        // 3. Подготвяме бутоните
        let actionButtonsHTML = '';

        // АКО НЕ Е ПОТВЪРДЕН -> Слагаме бутон за верификация
        if (!user.emailVerified) {
            actionButtonsHTML += `<button id="resend-verify-btn" class="verify-link">Потвърди имейл</button>`;
        }

        // Винаги слагаме бутон за изход
        actionButtonsHTML += `<button id="logout-btn" class="logout-link">Изход</button>`;

        // 4. Сглобяваме всичко и го слагаме в HTML-а
        userDetailsDiv.innerHTML = nameHTML + emailHTML + actionButtonsHTML;

        // 5. ЗАКАЧАМЕ EVENT LISTENERS (Защото пренаписахме HTML-а, старите връзки изчезнаха)

        // Логика за бутона "Изход"
        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

        // Логика за бутона "Потвърди имейл" (ако съществува)
        const verifyBtn = document.getElementById('resend-verify-btn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', async () => {
                try {
                    await sendEmailVerification(user);
                    alert(`✅ Изпратихме нов линк на ${user.email}!\nПровери пощата си (и папка Спам).`);
                } catch (error) {
                    console.error(error);
                    alert("Грешка при изпращане (може би твърде скоро си поискал линк?). Изчакай малко.");
                }
            });
        }

        // Затваряме модалите и зареждаме чатовете
        regModal.style.display = 'none';
        loginModal.style.display = 'none';
        loadChatsFromFirestore();

    } else {
        // --- GUEST MODE ---
        currentUser = null;
        guestButtons.style.display = 'flex';
        userInfoDiv.style.display = 'none';

        // Изчистваме userDetails, за да не стават грешки
        userDetailsDiv.innerHTML = '';

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
        // 1. Създаваме потребителя
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Запазваме името му
        await updateProfile(user, { displayName: name });

        // 3. НОВО: Пращаме имейл за потвърждение! 📧
        await sendEmailVerification(user);

        alert(`Успешна регистрация! 🚀\nИзпратихме линк за потвърждение на ${email}.\nМоля, провери си пощата!`);

        // Презареждаме, за да влезе в системата
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
        // --- ПОТРЕБИТЕЛ ---
        rowDiv.classList.add('user-row');
        const bubble = document.createElement('div');
        bubble.classList.add('user-bubble');
        bubble.innerText = text;
        rowDiv.appendChild(bubble);

    } else {
        // --- БОТ (ScriptSensei) ---
        rowDiv.classList.add('bot-row');

        // 1. Аватар
        const avatarImg = document.createElement('img');
        avatarImg.src = 'bot-avatar.png';
        avatarImg.classList.add('avatar');

        // 2. Контейнер
        const messageContainer = document.createElement('div');
        messageContainer.style.display = 'flex';
        messageContainer.style.flexDirection = 'column';
        messageContainer.style.maxWidth = '80%';

        // 3. Балонче с текст
        const textDiv = document.createElement('div');
        textDiv.classList.add('bot-text');

        if (typeof marked !== 'undefined') {
            textDiv.innerHTML = marked.parse(text);
            if (typeof hljs !== 'undefined') {
                textDiv.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
            }
        } else {
            textDiv.innerText = text;
        }

        // Бутон за прехвърли в редактора
        if (text.includes('```')) {
            const codeMatch = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
            if (codeMatch && codeMatch[1]) {
                const cleanCode = codeMatch[1].trim();
                const runCodeBtn = document.createElement('button');
                runCodeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg> Прехвърли в редактора`;
                runCodeBtn.className = "code-btn";
                runCodeBtn.onclick = function () {
                    editor.setValue(cleanCode);
                    runCodeBtn.innerHTML = "✅ Готово!";
                    setTimeout(() => runCodeBtn.innerHTML = "Прехвърли пак", 2000);
                };
                textDiv.appendChild(runCodeBtn);
            }
        }

        // 4. Лента с действия
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        let likeBtn, dislikeBtn;

        // A) Бутон ЗВУК 🔊
        const speakBtn = createActionButton(SVGs.speak, 'Прочети на глас', () => speakText(text));

        // B) Бутон КОПИРАНЕ 📋
        const copyBtn = createActionButton(SVGs.copy, 'Копирай текста', (e) => copyMessageText(text, e.currentTarget));

        // C) Бутон LIKE 👍
        likeBtn = createActionButton(SVGs.like, 'Полезен отговор', () => {
            if (likeBtn.disabled) return;
            likeBtn.innerHTML = SVGs.likeFilled;
            likeBtn.style.color = '#4caf50'; // Зелено
            likeBtn.style.opacity = '1';

            if (dislikeBtn) dislikeBtn.remove();

            likeBtn.disabled = true;
            likeBtn.style.cursor = 'default';

            sendFeedbackReport('like', text);
            showToast('Благодарим за оценката!', '👍');
        });

        // D) Бутон DISLIKE 👎
        dislikeBtn = createActionButton(SVGs.dislike, 'Неполезен отговор', () => {
            if (dislikeBtn.disabled) return;
            openFeedbackModal(likeBtn, dislikeBtn);
        });

        // =========================================================
        // 🔥 ТУК Е ПРОМЯНАТА (СКРИВАНЕ НА ПАЛЦИТЕ ЗА ЗДРАВЕЙ) 🔥
        // =========================================================

        // Проверяваме дали съобщението започва с нашия поздрав
        const isWelcomeMessage = text.startsWith("Здравей! Аз съм твоят ментор");

        // 1. Копирането е винаги налично
        actionsDiv.appendChild(copyBtn);

        // 2. Слагаме палците САМО ако НЕ е "Здравей..."
        if (!isWelcomeMessage) {
            actionsDiv.appendChild(likeBtn);
            actionsDiv.appendChild(dislikeBtn);
        }

        // 3. Звукът е винаги наличен
        actionsDiv.appendChild(speakBtn);

        // 5. Сглобяване
        messageContainer.appendChild(textDiv);
        messageContainer.appendChild(actionsDiv);

        rowDiv.appendChild(avatarImg);
        rowDiv.appendChild(messageContainer);
    }

    chatHistory.appendChild(rowDiv);
    rowDiv.scrollIntoView({ behavior: "smooth", block: "end" });
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
    rowDiv.scrollIntoView({ behavior: "smooth", block: "end" });
}

function removeLoading() {
    const loader = document.getElementById('loading-indicator');
    if (loader) loader.remove();
}

// ==========================================
// 7. ACTIONS & FEEDBACK SYSTEM
// ==========================================

// --- SVG ИКОНИ (Добавихме Filled версиите) ---
const SVGs = {
    speak: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    copyDone: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,

    // LIKE (Outline & Filled)
    like: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`,
    likeFilled: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`,

    // DISLIKE (Outline & Filled)
    dislike: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>`,
    dislikeFilled: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>`
};

// --- 1. Функция за показване на TOAST съобщение ---
function showToast(message, icon = '👍') {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    toastMsg.innerText = message;
    toastIcon.innerText = icon;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// --- 2. Функция за КОПИРАНЕ ---
async function copyMessageText(text, buttonElement) {
    try {
        await navigator.clipboard.writeText(text);
        const originalSVG = buttonElement.innerHTML;
        buttonElement.innerHTML = SVGs.copyDone;
        buttonElement.style.color = '#4caf50';
        showToast('Текстът е копиран!', '📋');
        setTimeout(() => {
            buttonElement.innerHTML = originalSVG;
            buttonElement.style.color = '';
        }, 2000);
    } catch (err) {
        showToast('Грешка при копиране.', '⚠️');
    }
}

// --- 3. Логика за FEEDBACK MODAL (Dislike) ---
const feedbackModal = document.getElementById('feedback-modal');
const closeFeedbackBtn = document.getElementById('close-feedback');
const feedbackForm = document.getElementById('feedback-form');

// Променлива, която ще помни КОИ бутони са натиснати в момента
let activeFeedbackUI = null;

const submitFeedbackBtn = document.getElementById('submit-feedback');
const otherCheckbox = document.getElementById('other-checkbox');
const feedbackDetails = document.getElementById('feedback-details');
const allCheckboxes = feedbackForm.querySelectorAll('input[type="checkbox"]');

// ФУНКЦИЯ ЗА ВАЛИДАЦИЯ (Вика се при всеки клик)
function validateFeedbackForm() {
    const isOtherChecked = otherCheckbox.checked;

    // 1. Управление на полето за писане
    if (isOtherChecked) {
        feedbackDetails.disabled = false;
        // Премахваме автоматичния focus(), за да не дразни при писане
    } else {
        feedbackDetails.disabled = true;
        feedbackDetails.value = ""; // Чистим текста, ако се откаже
    }

    // 2. Логика: Валидно ли е за изпращане?
    let isValid = false;
    let isAnyChecked = false;

    // Проверяваме дали изобщо има чекнати кутийки
    allCheckboxes.forEach(box => {
        if (box.checked) isAnyChecked = true;
    });

    if (isAnyChecked) {
        // Имаме поне един чекнат бокс.

        // Ако "Друго" е чекнато -> ЗАДЪЛЖИТЕЛНО трябва да има текст!
        if (isOtherChecked) {
            if (feedbackDetails.value.trim().length > 0) {
                isValid = true; // Хем е чекнато, хем има текст
            } else {
                isValid = false; // Чекнато е "Друго", но полето е празно -> ГРЕШКА
            }
        } else {
            // "Друго" не е чекнато, но имаме други чекнати боксове -> ОК
            isValid = true;
        }
    }

    // 3. Управление на бутона
    if (isValid) {
        submitFeedbackBtn.disabled = false;
        submitFeedbackBtn.style.cursor = 'pointer';
    } else {
        submitFeedbackBtn.disabled = true;
        submitFeedbackBtn.style.cursor = 'default';
    }
}

// Закачаме слушател към формата (хваща всяка промяна)
feedbackForm.addEventListener('change', validateFeedbackForm);

// НОВО: Закачаме слушател към полето за писане (хваща всяка буква)
feedbackDetails.addEventListener('input', validateFeedbackForm);

// Отваряне на модала (вече приема UI елементите като аргументи)
function openFeedbackModal(likeBtn, dislikeBtn) {
    activeFeedbackUI = { likeBtn, dislikeBtn };
    feedbackModal.style.display = 'flex';
    feedbackForm.reset();
    validateFeedbackForm();
}

closeFeedbackBtn.addEventListener('click', () => feedbackModal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target === feedbackModal) feedbackModal.style.display = 'none';
});

// Изпращане на формата
feedbackForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Събираме данните от формата
    const selectedReasons = [];
    allCheckboxes.forEach(box => {
        if (box.checked) {
            // Взимаме текста на лейбъла, или стойността (value)
            selectedReasons.push(box.value);
        }
    });
    const detailsText = feedbackDetails.value;

    // Ако имаме активни бутони
    if (activeFeedbackUI) {
        const { likeBtn, dislikeBtn } = activeFeedbackUI;

        // Взимаме текста на съобщението, за което се отнася
        // (Намираме го като се качим нагоре по DOM дървото до bot-text)
        // Трик: Тъй като activeFeedbackUI пази бутоните, можем да намерим текста до тях.
        // Но по-лесно: Нека просто вземем последния bot-msg или да разчитаме, че е ясно.
        // ПО-ДОБЪР ВАРИАНТ: Трябва да знаем текста.
        // Най-лесно е да вземем текста от DOM-а спрямо бутона:
        const messageContainer = dislikeBtn.closest('.message-row').querySelector('.bot-text');
        const messageText = messageContainer ? messageContainer.innerText : "Текстът не е намерен";

        // 1. Пълним Dislike иконата
        dislikeBtn.innerHTML = SVGs.dislikeFilled;
        dislikeBtn.style.color = '#f44336'; // Червено
        dislikeBtn.style.opacity = '1';
        dislikeBtn.disabled = true;
        dislikeBtn.style.cursor = 'default';

        // 2. Премахваме Like бутона
        if (likeBtn) likeBtn.remove();

        // 3. ИЗПРАЩАМЕ ДОКЛАДА КЪМ FIREBASE 🚀
        sendFeedbackReport('dislike', messageText, selectedReasons, detailsText);

        // Чистим паметта
        activeFeedbackUI = null;
    }

    console.log("Feedback изпратен!");
    feedbackModal.style.display = 'none';
    feedbackForm.reset();
    showToast('Благодарим за мнението!', '🙏');
});

// --- Помощна функция за създаване на бутон ---
function createActionButton(svgContent, title, onClickHandler) {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.innerHTML = svgContent;
    btn.title = title;
    btn.addEventListener('click', onClickHandler);
    return btn;
}

// ==========================================
// 8. FEEDBACK TO FIREBASE
// ==========================================
async function sendFeedbackReport(type, messageContent, reasons = [], details = "") {
    try {
        // Събираме данните за доклада
        const report = {
            type: type, // 'like' или 'dislike'
            message: messageContent, // Какво е казал бота
            userEmail: currentUser ? currentUser.email : "Guest", // Кой го е казал
            userId: currentUser ? currentUser.uid : "anonymous",
            timestamp: Date.now(), // Кога
            date: new Date().toLocaleString() // Човешка дата
        };

        // Ако е dislike, добавяме причините
        if (type === 'dislike') {
            report.reasons = reasons;
            report.details = details;
        }

        // Пращаме го в нова колекция "feedback_logs"
        // (Firestore автоматично ще я създаде, ако я няма!)
        await addDoc(collection(db, "feedback_logs"), report);

        console.log(`✅ Feedback (${type}) изпратен успешно!`);

    } catch (error) {
        console.error("Грешка при пращане на feedback:", error);
    }
}

// ==========================================
// 9. EVENT LISTENERS
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

    const editorCode = editor.getValue();
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
const editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "javascript",
    theme: "eclipse",
    lineNumbers: true,
    autoCloseBrackets: true,
    lineWrapping: true,
    readOnly: false,
    cursorBlinkRate: 530,
});

// 2. Логика на бутона "Изпълни"
document.getElementById('run-btn').addEventListener('click', () => {
    const userCode = editor.getValue();
    const outputBox = document.getElementById('console-output');

    // Ресет на конзолата
    outputBox.innerHTML = '<div class="console-label">Console Output:</div>';

    try {
        const originalLog = console.log;
        // Пренасочваме console.log към нашето прозорче
        console.log = (msg) => {
            if (typeof msg === 'object') msg = JSON.stringify(msg, null, 2);
            outputBox.innerHTML += `<div>> ${msg}</div>`;
            originalLog(msg);
        };

        // Изпълняваме кода
        new Function(userCode)();

        // Връщаме старата конзола
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

// ==========================================
// 10. TEXT-TO-SPEECH
// ==========================================

let allVoices = [];

// Функция за зареждане и дебъгване
function loadAndDebugVoices() {
    allVoices = window.speechSynthesis.getVoices();
    if (allVoices.length === 0) return;

    // Търсим нашия човек (Иван или Google BG)
    const bgVoice = allVoices.find(v => v.lang.includes('bg') || v.name.includes('Bulgarian') || v.name.includes('Ivan'));

    if (bgVoice) {
        console.log(`✅ ГОТОВ ЗА ГОВОРЕНЕ: ${bgVoice.name}`);
    }
}

// Слушаме за промени в гласовете
window.speechSynthesis.onvoiceschanged = loadAndDebugVoices;
loadAndDebugVoices();

function speakText(text) {
    // 1. Спираме старите приказки
    window.speechSynthesis.cancel();

    // 2. Гаранция за зареждане
    if (allVoices.length === 0) {
        allVoices = window.speechSynthesis.getVoices();
    }

    // 3. ТЪРСЕНЕ НА ГЛАСА (Приоритет: Google -> Ivan -> Който и да е BG)
    let selectedVoice = allVoices.find(voice => voice.name.includes("Google") && voice.lang.includes("bg"));

    if (!selectedVoice) {
        selectedVoice = allVoices.find(voice => voice.name.includes("Ivan")); // Microsoft Ivan
    }
    if (!selectedVoice) {
        selectedVoice = allVoices.find(voice => voice.lang.includes("bg"));
    }

    // 4. ПОЧИСТВАНЕ (Clean up)
    const cleanText = text
        .replace(/\*\*/g, '')           // Маха bold
        .replace(/\*/g, '')             // Маха italic
        .replace(/\#/g, '')             // Маха заглавия
        .replace(/`/g, '')              // Маха code ticks
        .replace(/\[.*?\]/g, '')        // Маха линкове
        .replace(/https?:\/\/\S+/g, 'линк')
        .replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, '')
        .replace(/```[\s\S]*?```/g, 'Ето примерен код в редактора.');

    // 5. ГОВОРЕНЕ
    const utterance = new SpeechSynthesisUtterance(cleanText);

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = 'bg-BG';
    } else {
        alert("Грешка: Не намирам БГ глас. Увери се, че си рестартирал браузъра след инсталацията!");
        return;
    }

    utterance.volume = 0.65;
    utterance.rate = 0.85;
    utterance.pitch = 0.7;

    window.speechSynthesis.speak(utterance);
}

// ==========================================
// 11. DARK MODE    
// ==========================================
const themeToggleBtn = document.getElementById('theme-toggle');
const body = document.body;

// ФУНКЦИЯ-ДИРИГЕНТ: Тя управлява всичко наведнъж
function applyTheme(themeName) {
    if (themeName === 'dark') {
        // 1. Включваме тъмния CSS за сайта (Sidebar, Chat, Console стават тъмни от CSS-а)
        body.classList.add('dark-mode');
        themeToggleBtn.innerText = '☀️';

        // 2. Ключовият момент: Казваме на CodeMirror да си сложи вампирското наметало
        editor.setOption("theme", "dracula");
    } else {
        // 1. Изключваме тъмния CSS (връщаме се към Light CSS)
        body.classList.remove('dark-mode');
        themeToggleBtn.innerText = '🌙';

        // 2. Връщаме светлата тема на редактора
        editor.setOption("theme", "eclipse");
    }

    // 3. Запомняме избора
    localStorage.setItem('scriptsensei_theme', themeName);
}

// ПРОВЕРКА ПРИ ЗАРЕЖДАНЕ (Initial Check)
const savedTheme = localStorage.getItem('scriptsensei_theme');
if (savedTheme === 'dark') {
    applyTheme('dark');
} else {
    applyTheme('light');
}

// СЛУШАТЕЛ НА БУТОНА
themeToggleBtn.addEventListener('click', () => {
    if (body.classList.contains('dark-mode')) {
        applyTheme('light');
    } else {
        applyTheme('dark');
    }
});

// ==========================================
// 12. START
// ==========================================
startNewChat();
loadVoices();