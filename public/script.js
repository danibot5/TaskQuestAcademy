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
let currentAttachments = [];
let currentCleanText = "";
let speechCharIndex = 0;
let isSpeakingNow = false;

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


const API_URL = 'http://127.0.0.1:5001/scriptsensei-4e8fe/us-central1/chat';
const TITLE_API_URL = 'http://127.0.0.1:5001/scriptsensei-4e8fe/us-central1/generateTitle';

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

async function updateChatData(chat) {
    if (currentUser) {
        try {
            const chatRef = doc(db, "chats", chat.id);
            await updateDoc(chatRef, {
                title: chat.title,
                isPinned: chat.isPinned || false
            });
        } catch (e) {
            console.error("Error updating chat:", e);
        }
    } else {
        saveToLocalStorage();
    }
}

function renderSidebar() {
    chatList.innerHTML = '';

    allChats.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        const dateA = a.createdAt || a.id;
        const dateB = b.createdAt || b.id;
        return dateB - dateA;
    });

    allChats.forEach(chat => {
        const div = document.createElement('div');
        div.classList.add('chat-item');
        div.style.position = 'relative';
        if (chat.id === currentChatId) div.classList.add('active');

        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            optionsBtn.click();
        });

        div.addEventListener('click', (e) => {
            if (e.target.closest('.chat-options-btn') || e.target.closest('.chat-menu-dropdown')) return;
            loadChat(chat.id);
        });

        // --- ЗАГЛАВИЕ ---
        const titleSpan = document.createElement('span');
        titleSpan.classList.add('chat-title');

        // Добавяме иконка, ако е Pinned 📌
        let pinIconHTML = chat.isPinned ? `<span class="pinned-icon" style="color: #abababff; margin-right: 7.5px; margin-top: 5px;">${SVGs.pin}</span>` : '';
        titleSpan.innerHTML = pinIconHTML + (chat.title || "Нов разговор");


        // --- БУТОН С ТРИ ТОЧКИ (MENU) ---
        const optionsBtn = document.createElement('button');
        optionsBtn.className = 'chat-options-btn';
        optionsBtn.innerHTML = SVGs.moreVertical;

        // --- ПАДАЩО МЕНЮ ---
        const menuDropdown = document.createElement('div');
        menuDropdown.className = 'chat-menu-dropdown';

        // Опция 1: RENAME ✏️
        const renameOpt = document.createElement('button');
        renameOpt.className = 'menu-option';
        renameOpt.innerHTML = `${SVGs.edit} Преименувай`;
        renameOpt.onclick = async () => {
            const newTitle = prompt("Ново име на чата:", chat.title);
            if (newTitle && newTitle.trim() !== "") {
                chat.title = newTitle.trim();
                await updateChatData(chat); // Запазваме промяната
                renderSidebar();
            }
        };

        // Опция 2: PIN / UNPIN 📌
        const pinOpt = document.createElement('button');
        pinOpt.className = 'menu-option';
        const isPinned = chat.isPinned;
        pinOpt.innerHTML = isPinned ? `${SVGs.pin} Откачи` : `${SVGs.pin} Закачи`;
        // Лека визуална разлика, ако е закачен
        if (isPinned) pinOpt.style.color = '#1a73e8';

        pinOpt.onclick = async () => {
            chat.isPinned = !chat.isPinned; // Обръщаме стойността (true <-> false)
            await updateChatData(chat); // Запазваме
            renderSidebar(); // Пренареждаме
        };

        // Опция 3: DELETE 🗑️
        const deleteOpt = document.createElement('button');
        deleteOpt.className = 'menu-option delete-opt';
        deleteOpt.innerHTML = `${SVGs.trash} Изтрий`;
        deleteOpt.onclick = async () => {
            if (!confirm("Сигурен ли си, че искаш да изтриеш този чат?")) return;

            // Локално триене
            allChats = allChats.filter(c => c.id !== chat.id);

            // DB триене
            if (currentUser) await deleteFromFirestore(chat.id);
            else saveToLocalStorage();

            if (chat.id === currentChatId) startNewChat();
            else renderSidebar();
        };

        // Сглобяване на менюто
        menuDropdown.appendChild(renameOpt);
        menuDropdown.appendChild(pinOpt);
        menuDropdown.appendChild(deleteOpt);

        // Логика за отваряне на менюто
        optionsBtn.onclick = (e) => {
            e.stopPropagation(); // Спира клика да не стигне до чата

            // Затваряме всички други отворени менюта първо
            document.querySelectorAll('.chat-menu-dropdown.show').forEach(el => {
                if (el !== menuDropdown) el.classList.remove('show');
            });
            document.querySelectorAll('.chat-options-btn.active').forEach(el => {
                if (el !== optionsBtn) el.classList.remove('active');
            });

            // Отваряме/Затваряме текущото
            menuDropdown.classList.toggle('show');
            optionsBtn.classList.toggle('active');
        };

        div.appendChild(titleSpan);
        div.appendChild(optionsBtn);
        div.appendChild(menuDropdown);
        chatList.appendChild(div);
    });

    // Запазване на Search филтъра (Memory Fix)
    const searchInputRef = document.getElementById('search-input');
    if (searchInputRef && searchInputRef.value.trim() !== "") {
        filterChats(searchInputRef.value.toLowerCase());
    }
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.chat-options-btn')) {
        document.querySelectorAll('.chat-menu-dropdown.show').forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.chat-options-btn.active').forEach(el => el.classList.remove('active'));
    }
});

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

        // Ако текстът съдържа HTML тагове за прикачени файлове (от sendMessage), ги ползваме
        if (text.includes('<i>Изпратен файл') || text.includes('<i>Изпратени файлове')) {
            bubble.innerHTML = text;
        } else {
            bubble.innerText = text;
        }

        rowDiv.appendChild(bubble);

    } else {
        // --- БОТ (ScriptSensei) ---
        rowDiv.classList.add('bot-row');

        const avatarImg = document.createElement('img');
        avatarImg.src = 'bot-avatar.png';
        avatarImg.classList.add('avatar');

        const messageContainer = document.createElement('div');
        messageContainer.style.display = 'flex';
        messageContainer.style.flexDirection = 'column';
        messageContainer.style.maxWidth = '80%';
        messageContainer.style.width = '100%'; // Важно за кода

        const textDiv = document.createElement('div');
        textDiv.classList.add('bot-text');

        // 1. Рендираме Markdown (Текст -> HTML)
        if (typeof marked !== 'undefined') {
            textDiv.innerHTML = marked.parse(text);
            if (typeof hljs !== 'undefined') {
                textDiv.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
            }
        } else {
            textDiv.innerText = text;
        }

        // ============================================================
        // 🔥 НОВА ЛОГИКА: БУТОНИ ПОД ВСЕКИ КОДОВ БЛОК 🔥
        // ============================================================

        // Намираме всички блокове с код, които marked.js е създал
        const codeBlocks = textDiv.querySelectorAll('pre');

        codeBlocks.forEach((preBlock) => {
            const codeElement = preBlock.querySelector('code');
            if (!codeElement) return;

            const codeText = codeElement.innerText; // Самият код

            // Опитваме се да познаем езика от класа (напр. language-javascript)
            let language = 'txt';
            codeElement.classList.forEach(cls => {
                if (cls.startsWith('language-')) {
                    language = cls.replace('language-', '');
                }
            });

            // Създаваме лентата с бутони
            const toolbar = document.createElement('div');
            toolbar.style.display = 'flex';
            toolbar.style.gap = '10px';
            toolbar.style.marginTop = '5px';
            toolbar.style.marginBottom = '15px';
            toolbar.style.justifyContent = 'flex-end';

            // --- БУТОН 1: ПРЕХВЪРЛИ 🚀 ---
            const runBtn = document.createElement('button');
            runBtn.className = 'code-btn';
            runBtn.classList.add('transfer-to-editor-btn');
            runBtn.innerHTML = `Прехвърли в редактора`;
            runBtn.title = "Сложи този код в редактора";
            runBtn.onclick = () => {
                editor.setValue(codeText);
                runBtn.innerHTML = "✅ Готово!";
                setTimeout(() => runBtn.innerHTML = "Прехвърли в редактора", 2500);
            };

            // --- БУТОН 2: ИЗТЕГЛИ 💾 ---
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'code-btn';
            downloadBtn.classList.add('download-btn-style');
            downloadBtn.style.color = 'white';

            // Оправяме разширението за файла
            let ext = language ? language.toLowerCase() : 'txt';
            const extensionMap = {
                'javascript': 'js',
                'js': 'js',
                'python': 'py',
                'py': 'py',
                'csharp': 'cs',
                'cs': 'cs',
                'cpp': 'cpp',
                'c++': 'cpp',
                'html': 'html',
                'xml': 'html',
                'css': 'css',
                'json': 'json',
                'markdown': 'md',
                'md': 'md',
                'java': 'java',
                'php': 'php',
                'ruby': 'rb',
                'rb': 'rb',
                'go': 'go',
                'golang': 'go',
                'typescript': 'ts',
                'ts': 'ts',
                'txt': 'txt',
                'text': 'txt'
            };

            if (extensionMap[ext]) {
                ext = extensionMap[ext];
            } else if (ext.length > 5)
                ext = 'txt';

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

                downloadBtn.innerHTML = "✅ Изтеглен!";
                setTimeout(() => downloadBtn.innerHTML = `Изтегли .${ext}`, 2500);
            };

            // Добавяме бутоните в лентата
            toolbar.appendChild(runBtn);
            toolbar.appendChild(downloadBtn);

            // Вмъкваме лентата ВЕДНАГА СЛЕД <pre> блока
            preBlock.parentNode.insertBefore(toolbar, preBlock.nextSibling);
        });

        // ============================================================

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        let likeBtn, dislikeBtn;
        const speakBtn = createActionButton(SVGs.speak, 'Прочети на глас', () => speakText(text));
        const copyBtn = createActionButton(SVGs.copy, 'Копирай текста', (e) => copyMessageText(text, e.currentTarget));

        likeBtn = createActionButton(SVGs.like, 'Полезен отговор', () => {
            if (likeBtn.disabled) return;
            likeBtn.innerHTML = SVGs.likeFilled;
            likeBtn.style.color = '#4caf50';
            likeBtn.style.opacity = '1';
            if (dislikeBtn) dislikeBtn.remove();
            likeBtn.disabled = true;
            likeBtn.style.cursor = 'default';
            sendFeedbackReport('like', text);
            showToast('Благодарим за оценката!', '👍');
        });

        dislikeBtn = createActionButton(SVGs.dislike, 'Неполезен отговор', () => {
            if (dislikeBtn.disabled) return;
            openFeedbackModal(likeBtn, dislikeBtn);
        });

        const isWelcomeMessage = text.startsWith("Здравей! Аз съм твоят ментор");

        actionsDiv.appendChild(copyBtn);
        if (!isWelcomeMessage) {
            actionsDiv.appendChild(likeBtn);
            actionsDiv.appendChild(dislikeBtn);
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
    dislikeFilled: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>`,

    // ИКОНИ ЗА МЕНЮТО
    moreVertical: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`,
    edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    pin: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,

    // НОВИ ИКОНИ ЗА HEADER-А
    share: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>`,
    volumeOn: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    volumeOff: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`
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

// --- ФУНКЦИЯ ЗА РИСУВАНЕ НА ПРИКАЧЕНИТЕ ФАЙЛОВЕ ---
function renderAttachments() {
    const list = document.getElementById('attachment-preview-list');

    if (currentAttachments.length === 0) {
        list.style.display = 'none';
        return;
    }

    list.style.display = 'flex';
    list.innerHTML = ''; // Чистим старото, за да нарисуваме актуалното състояние

    currentAttachments.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'attachment-item';

        // Проверка: Картинка ли е?
        if (file.mimeType.startsWith('image/')) {
            item.innerHTML = `
                <img src="data:${file.mimeType};base64,${file.base64}">
                <button class="remove-file-btn" onclick="removeAttachment(${index})">✕</button>
            `;
        } else {
            // PDF или код
            item.innerHTML = `
                <div class="file-icon" title="${file.name}">📄</div>
                <button class="remove-file-btn" onclick="removeAttachment(${index})">✕</button>
            `;
        }
        list.appendChild(item);
    });
}

// Глобална функция за триене (за да се вика от onclick в HTML-а горе)
window.removeAttachment = (index) => {
    currentAttachments.splice(index, 1); // Махаме от масива
    renderAttachments(); // Прерисуваме
};

async function sendMessage() {
    const text = userInput.value;

    // Проверка: Има ли текст ИЛИ файлове?
    if (text.trim() === "" && currentAttachments.length === 0) return;

    const isNewChat = !allChats.find(c => c.id === currentChatId) || (typeof currentChatId === 'number');

    // UI: Текст
    if (text.trim() !== "") {
        addMessageToUI(text, 'user');
        await saveMessage(text, 'user');
    }

    // UI: Файлове (Показваме колко са пратени)
    if (currentAttachments.length > 0) {
        const fileNames = currentAttachments.map(f => f.name).join(', ');
        addMessageToUI(`📎 <i>Изпратени файлове (${currentAttachments.length}): ${fileNames}</i>`, 'user');
    }

    userInput.value = '';

    // Title Logic
    if (isNewChat && text.trim() !== "") {
        setTimeout(() => generateSmartTitle(currentChatId, text), 500);
    }

    // Context Logic
    const currentChat = allChats.find(c => c.id === currentChatId);
    let messagesPayload = [];
    if (currentChat && currentChat.messages) {
        messagesPayload = currentChat.messages.slice(-10).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));
    }

    // Подготовка на Payload
    const editorCode = editor.getValue();
    const consoleOutput = document.getElementById('console-output').innerText;
    let messageToSendToAI = text;

    if (messageToSendToAI.trim() === "" && currentAttachments.length > 0) {
        messageToSendToAI = "Разгледай прикачените файлове.";
    }

    if (editorCode.trim().length > 0) {
        messageToSendToAI += `\n\n--- [SYSTEM CONTEXT] ---\nCODE:\n\`\`\`javascript\n${editorCode}\n\`\`\`\nCONSOLE:\n${consoleOutput}\n------------------------`;
    }

    messagesPayload.push({ role: 'user', content: messageToSendToAI });

    showLoading();

    const requestBody = { messages: messagesPayload };

    // 🔥 ПРИКАЧВАМЕ ВСИЧКИ ФАЙЛОВЕ
    if (currentAttachments.length > 0) {
        requestBody.attachments = currentAttachments; // Вече пращаме масива, а не единичен файл

        // Чистим UI
        currentAttachments = [];
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

document.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
        e.preventDefault();
        document.getElementById('run-btn').click();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        document.getElementById('run-btn').click();
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
    // Разрешаваме избирането на повече от 1 файл (multiple)
    fileInput.multiple = true;

    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
        const files = Array.from(event.target.files); // Взимаме всички избрани
        if (files.length === 0) return;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const base64String = e.target.result.split(',')[1];

                // Добавяме в масива
                currentAttachments.push({
                    base64: base64String,
                    mimeType: file.type,
                    name: file.name
                });

                // Когато се зареди -> рисуваме
                renderAttachments();
            };
            reader.readAsDataURL(file);
        });

        fileInput.value = ''; // Ресет на инпута, за да може да качим същите пак
        userInput.focus();
    });
}

// ==========================================
// 10. HEADER CONTROLS (MUTE & SHARE) 🎛️
// ==========================================
const muteBtn = document.getElementById('mute-btn');
const shareAppBtn = document.getElementById('share-app-btn');
let isMuted = localStorage.getItem('scriptsensei_muted') === 'true'; // Помни избора

// --- 1. MUTE LOGIC ---
function updateMuteUI() {
    if (isMuted) {
        muteBtn.innerHTML = SVGs.volumeOff;
        muteBtn.style.color = '#ff4444';

        // АКО В МОМЕНТА ГОВОРИ:
        // Рестартираме го от текущата позиция, но този път ще тръгне с volume = 0
        if (isSpeakingNow) {
            resumeSpeaking(speechCharIndex);
        }

    } else {
        muteBtn.innerHTML = SVGs.volumeOn;
        muteBtn.style.color = '';

        // АКО В МОМЕНТА ГОВОРИ (БЕЗШУМНО):
        // Рестартираме го от текущата позиция, но този път ще тръгне с volume = 1
        if (isSpeakingNow) {
            resumeSpeaking(speechCharIndex);
        }
    }
}

if (muteBtn) {
    updateMuteUI(); // Init

    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        localStorage.setItem('scriptsensei_muted', isMuted);
        updateMuteUI();
    });
}

// --- 2. SHARE LOGIC ---
if (shareAppBtn) {
    shareAppBtn.innerHTML = SVGs.share;

    shareAppBtn.addEventListener('click', async () => {
        const shareData = {
            title: 'ScriptSensei',
            text: 'Учи JavaScript с моя личен AI ментор! 🚀',
            url: window.location.href
        };

        // Ако браузърът поддържа модерно споделяне (на телефони)
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Share canceled');
            }
        } else {
            // За компютри: Копираме линка
            try {
                await navigator.clipboard.writeText(window.location.href);
                showToast('Линка е копиран!', '🔗');
            } catch (err) {
                showToast('Грешка при споделяне', '⚠️');
            }
        }
    });
}

// ==========================================
// 11. TEXT-TO-SPEECH
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
    // 1. Почистване на текста
    const cleanText = text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/\#/g, '')
        .replace(/`/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/https?:\/\/\S+/g, 'линк')
        .replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, '')
        .replace(/```[\s\S]*?```/g, 'Ето примерен код в редактора.');

    // 2. Запазваме данните в глобалните променливи
    currentCleanText = cleanText;
    speechCharIndex = 0; // Ресетваме брояча
    isSpeakingNow = true;

    // 3. Стартираме говора от началото
    resumeSpeaking(0);
}

function resumeSpeaking(startIndex) {
    // Спираме текущото (за да не се застъпят)
    window.speechSynthesis.cancel();

    // Ако сме стигнали края, спираме
    if (startIndex >= currentCleanText.length) {
        isSpeakingNow = false;
        return;
    }

    // Взимаме оставащия текст
    const remainingText = currentCleanText.substring(startIndex);
    const utterance = new SpeechSynthesisUtterance(remainingText);

    // --- НАСТРОЙКА НА ГЛАСА ---
    if (allVoices.length === 0) allVoices = window.speechSynthesis.getVoices();
    let selectedVoice = allVoices.find(v => v.name.includes("Google") && v.lang.includes("bg")) ||
        allVoices.find(v => v.name.includes("Ivan")) ||
        allVoices.find(v => v.lang.includes("bg"));

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = 'bg-BG';
    }

    // --- МАГИЯТА: VOLUME 🎛️ ---
    // Ако е mute -> volume = 0 (говори безшумно)
    // Ако не е mute -> volume = 1 (чува се)
    utterance.volume = isMuted ? 0 : 1;

    utterance.rate = 0.9;
    utterance.pitch = 0.8;

    // --- СЛЕДЕНЕ НА ПРОГРЕСА (TRACKING) 📡 ---
    // Това събитие се вика на всяка дума/граница, дори когато е muted!
    utterance.onboundary = (event) => {
        // Обновяваме глобалния индекс: Началото на отрязъка + колкото е минало сега
        speechCharIndex = startIndex + event.charIndex;
    };

    utterance.onend = () => {
        // Когато свърши естествено
        if (speechCharIndex >= currentCleanText.length - 10) {
            isSpeakingNow = false;
        }
    };

    window.speechSynthesis.speak(utterance);
}

// ==========================================
// 12. DARK MODE    
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
// 12. SMART TITLE GENERATION
// ==========================================
async function generateSmartTitle(chatId, firstMessage) {
    console.log("Generating smart title for:", firstMessage);

    try {
        // Пращаме заявка към новата ни специализирана функция
        const response = await fetch(TITLE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: firstMessage }) // Пращаме само текста
        });

        const data = await response.json();

        if (data.reply) {
            let smartTitle = data.reply;

            // Намираме чата и го обновяваме
            const chat = allChats.find(c => c.id === chatId);
            if (chat) {
                chat.title = smartTitle;

                // Запазваме новото яко заглавие
                if (currentUser) {
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

// ==========================================
// 13. SEARCH FUNCTIONALITY
// ==========================================
const searchWrapper = document.getElementById('search-wrapper');
const searchInput = document.getElementById('search-input');
const searchToggleBtn = document.getElementById('search-toggle-btn');

function closeSearch() {
    searchWrapper.classList.remove('active');
    searchInput.value = '';
    filterChats('');
}

if (searchWrapper && searchToggleBtn) {

    searchToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (searchWrapper.classList.contains('active')) {
            closeSearch();
        } else {
            searchWrapper.classList.add('active');
            searchInput.focus();
        }
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filterChats(searchTerm);
    });

    document.addEventListener('click', (e) => {
        if (!searchWrapper.classList.contains('active')) return;

        // Проверяваме какво е натиснато:
        const isClickInsideSearch = searchWrapper.contains(e.target);
        const isClickOnChat = e.target.closest('.chat-item'); // Магията!

        if (!isClickInsideSearch && !isClickOnChat) {
            closeSearch();
        }
    });
}

function filterChats(term) {
    const chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
        const titleSpan = item.querySelector('.chat-title');
        const titleText = titleSpan ? titleSpan.innerText.toLowerCase() : "";

        if (titleText.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ==========================================
// 14. START
// ==========================================
startNewChat();
loadVoices();