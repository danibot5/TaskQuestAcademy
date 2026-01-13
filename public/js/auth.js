import { loadUserProfile } from './db.js';
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

const getEl = (id) => document.getElementById(id);

export function initAuth() {
    onAuthStateChanged(auth, (user) => {
        const userDetailsDiv = document.querySelector('.user-details');
        const guestButtons = getEl('guest-buttons');
        const userInfoDiv = getEl('user-info');
        const userAvatar = getEl('user-avatar');
        const regModal = getEl('register-modal');
        const loginModal = getEl('login-modal');

        if (user) {
            setCurrentUser(user);

            loadUserProfile(user.uid).then(async () => {
                const ui = await import('./ui.js');
                ui.updateHeaderUI();
            });

            guestButtons.style.display = 'none';
            userInfoDiv.style.display = 'flex';
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

            regModal.style.display = 'none';
            loginModal.style.display = 'none';

            loadChatsFromFirestore();

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