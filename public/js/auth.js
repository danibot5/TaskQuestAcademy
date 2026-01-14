import { loadUserProfile, loadChatsFromFirestore, loadChatsFromLocalStorage } from './db.js';
import { auth, googleProvider } from './config.js';
import { setCurrentUser } from './state.js';
import {
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const getEl = (id) => document.getElementById(id);

export function initAuth() {
    onAuthStateChanged(auth, async (user) => { // 👈 Правим го async
        const userDetailsDiv = document.querySelector('.user-details');
        const guestButtons = getEl('guest-buttons');
        const userInfoDiv = getEl('user-info');
        const userAvatar = getEl('user-avatar');
        const regModal = getEl('register-modal');
        const loginModal = getEl('login-modal');

        if (user) {
            setCurrentUser(user);

            // Скриваме всичко временно или показваме лоудър, ако искаш
            guestButtons.style.display = 'none';
            userInfoDiv.style.display = 'flex';

            // 🔥 КРИТИЧНА ПРОМЯНА: Чакаме профила ДА ЗАРЕДИ ПРЕДИ ВСИЧКО ДРУГО
            // Използваме await, за да спрем изпълнението тук, докато не знаем дали е PRO
            await loadUserProfile(user.uid);

            // Сега вече state.hasPremiumAccess е 100% вярно.
            // Можем безопасно да заредим UI-а.
            const ui = await import('./ui.js');

            // 1. Оправяме Хедъра (Модел селектора) и Сайдбара (Pro картата)
            ui.updateHeaderUI();

            // 2. Оправяме данните в модала (за да е готов преди клик)
            if (typeof ui.populateProfileData === 'function') {
                ui.populateProfileData();
            }

            // 3. Чак сега зареждаме чатовете
            loadChatsFromFirestore();

            // ... (Кодът за UI на потребителя - аватар, име и т.н. си остава тук) ...
            userAvatar.src = user.photoURL || 'images/bot-avatar.png';
            const displayName = user.displayName || 'User';
            const verifiedIcon = user.emailVerified
                ? `<span class="verified-badge" title="Потвърден имейл">✔</span>`
                : '';

            const nameHTML = `
                <div class="name-wrapper">
                    <div id="user-name" title="${displayName}">${displayName}</div>
                    ${verifiedIcon}
                </div>`;

            const emailHTML = `<div class="user-email-text">${user.email}</div>`;

            let actionButtonsHTML = '';
            if (!user.emailVerified) {
                actionButtonsHTML += `<button id="resend-verify-btn" class="verify-link">Потвърди имейл</button>`;
            }
            actionButtonsHTML += `<button id="logout-btn" class="logout-link">Изход</button>`;

            userDetailsDiv.innerHTML = nameHTML + emailHTML + actionButtonsHTML;

            document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
            // ... (Event listener за verify btn) ...

            regModal.style.display = 'none';
            loginModal.style.display = 'none';

        } else {
            setCurrentUser(null);
            guestButtons.style.display = 'flex';
            userInfoDiv.style.display = 'none';
            userDetailsDiv.innerHTML = '';

            loadChatsFromLocalStorage();
        }
    });

    setupAuthEventListeners();
}

function setupAuthEventListeners() {
    const regModal = getEl('register-modal');
    const loginModal = getEl('login-modal');
    const errorBoxReg = getEl('reg-error');
    const errorBoxLogin = getEl('login-error');
    const googleRegBtn = document.getElementById('google-register-btn');

    getEl('open-register-btn').addEventListener('click', () => { regModal.style.display = 'flex'; });
    getEl('open-login-btn').addEventListener('click', () => { loginModal.style.display = 'flex'; });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            regModal.style.display = 'none';
            loginModal.style.display = 'none';
        });
    });

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

    getEl('google-login-btn').addEventListener('click', () => {
        signInWithPopup(auth, googleProvider).catch((error) => {
            getEl('login-error').innerText = error.message;
        });
    });

    if (googleRegBtn) {
        googleRegBtn.addEventListener('click', () => {
            signInWithPopup(auth, googleProvider).catch((error) => {
                const errorBox = document.getElementById('reg-error');
                if (errorBox) errorBox.innerText = error.message;
            });
        });
    }
}