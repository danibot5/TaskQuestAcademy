import { auth, googleProvider } from './config.js';
import { setCurrentUser } from './state.js';
import { loadChatsFromFirestore, loadChatsFromLocalStorage } from './db.js';
import {
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// DOM Елементи (ще ги вземем динамично, за да сме сигурни, че HTML-ът е зареден)
const getEl = (id) => document.getElementById(id);

export function initAuth() {
    // Слушаме за промяна в статуса (Login/Logout)
    onAuthStateChanged(auth, (user) => {
        const userDetailsDiv = document.querySelector('.user-details');
        const guestButtons = getEl('guest-buttons');
        const userInfoDiv = getEl('user-info');
        const userAvatar = getEl('user-avatar');

        // Модали
        const regModal = getEl('register-modal');
        const loginModal = getEl('login-modal');

        if (user) {
            // --- ПОТРЕБИТЕЛЯТ Е ВЛЯЗЪЛ ---
            setCurrentUser(user);

            guestButtons.style.display = 'none';
            userInfoDiv.style.display = 'flex';
            userAvatar.src = user.photoURL || 'images/bot-avatar.png';

            // Рендираме UI за потребителя
            let nameHTML = `<div id="user-name" style="font-weight: bold; font-size: 0.9rem;">${user.displayName || 'User'}</div>`;
            if (user.emailVerified) {
                nameHTML = `<div id="user-name" style="font-weight: bold; font-size: 0.9rem;">
                    ${user.displayName || 'User'} <span title="Потвърден" style="color: #4caf50;">✔</span>
                 </div>`;
            }
            const emailHTML = `<div class="user-email-text">${user.email}</div>`;

            let actionButtonsHTML = '';
            if (!user.emailVerified) {
                actionButtonsHTML += `<button id="resend-verify-btn" class="verify-link">Потвърди имейл</button>`;
            }
            actionButtonsHTML += `<button id="logout-btn" class="logout-link">Изход</button>`;

            userDetailsDiv.innerHTML = nameHTML + emailHTML + actionButtonsHTML;

            // Закачаме слушатели за новите бутони
            document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

            const verifyBtn = document.getElementById('resend-verify-btn');
            if (verifyBtn) {
                verifyBtn.addEventListener('click', async () => {
                    try {
                        await sendEmailVerification(user);
                        alert(`✅ Изпратихме нов линк на ${user.email}!`);
                    } catch (error) {
                        console.error(error);
                        alert("Грешка при изпращане. Изчакай малко.");
                    }
                });
            }

            // Затваряме модалите и зареждаме чатовете
            regModal.style.display = 'none';
            loginModal.style.display = 'none';

            loadChatsFromFirestore();

        } else {
            // --- GUEST MODE ---
            setCurrentUser(null);
            guestButtons.style.display = 'flex';
            userInfoDiv.style.display = 'none';
            userDetailsDiv.innerHTML = '';

            loadChatsFromLocalStorage();
        }
    });

    // --- SETUP EVENT LISTENERS ЗА МОДАЛИТЕ ---
    setupAuthEventListeners();
}

function setupAuthEventListeners() {
    const regModal = getEl('register-modal');
    const loginModal = getEl('login-modal');
    const errorBoxReg = getEl('reg-error');
    const errorBoxLogin = getEl('login-error');

    // Отваряне
    getEl('open-register-btn').addEventListener('click', () => { regModal.style.display = 'flex'; });
    getEl('open-login-btn').addEventListener('click', () => { loginModal.style.display = 'flex'; });

    // Затваряне
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            regModal.style.display = 'none';
            loginModal.style.display = 'none';
        });
    });

    // Регистрация
    getEl('perform-register-btn').addEventListener('click', async () => {
        const name = getEl('reg-name').value;
        const email = getEl('reg-email').value;
        const password = getEl('reg-password').value;

        errorBoxReg.innerText = "";

        if (!name || !email || !password) {
            errorBoxReg.innerText = "Моля, попълнете всички полета.";
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            await sendEmailVerification(userCredential.user);
            alert(`Успешна регистрация! Провери си пощата.`);
            window.location.reload();
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') errorBoxReg.innerText = "Този имейл вече е регистриран.";
            else if (error.code === 'auth/weak-password') errorBoxReg.innerText = "Паролата е слаба.";
            else errorBoxReg.innerText = "Грешка: " + error.message;
        }
    });

    // Логин с Email
    getEl('perform-login-btn').addEventListener('click', async () => {
        const email = getEl('login-email').value;
        const password = getEl('login-password').value;
        errorBoxLogin.innerText = "";
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            errorBoxLogin.innerText = "Грешен имейл или парола.";
        }
    });

    // Логин с Google
    getEl('google-login-btn').addEventListener('click', () => {
        signInWithPopup(auth, googleProvider).catch((error) => {
            getEl('login-error').innerText = error.message;
        });
    });
}