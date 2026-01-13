import { state } from './state.js';
import { updateChatData } from './db.js'; // Ще ползваме това за запис на статус
import { showToast } from './utils.js';
import { collection, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './config.js';

// 👇 СЛОЖИ ТВОЯ PUBLISHABLE KEY ТУК (pk_test_...)
const STRIPE_PUBLIC_KEY = 'pk_test_51SoiD2FCI9V7RPg1fFJ1KJJFZ3p75plHw5Mc5b6XIz4xs2VWplVR7yo8YbjFh7UksvmwOVLz4MwekZwm2aAhfKE400D4hoF4T1';

export async function startCheckout() {
    if (!state.currentUser) {
        alert("Моля, влез в профила си, за да купиш PRO!");
        return;
    }

    const buyBtn = document.getElementById('buy-pro-btn');
    if (buyBtn) buyBtn.innerText = "Зареждане...";

    try {
        const response = await fetch('https://us-central1-scriptsensei-4e8fe.cloudfunctions.net/createCheckoutSession', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: state.currentUser.uid,
                userEmail: state.currentUser.email
            })
        });

        const data = await response.json();

        if (data.url) {
            window.location.href = data.url; // Пращаме го към Stripe
        } else {
            alert("Грешка при създаване на поръчката.");
        }

    } catch (error) {
        console.error(error);
        alert("Нещо се обърка. Виж конзолата.");
        if (buyBtn) buyBtn.innerText = "Купи PRO 💎";
    }
}

// Тази функция се вика автоматично, когато потребителят се върне от Stripe
// 👇 Тази функция проверява дали потребителят се връща от Stripe
export async function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const isSuccess = urlParams.get('payment_success');

    if (isSuccess && sessionId && state.currentUser) {
        // Показваме, че нещо се случва, за да не се шашне потребителят
        showToast("Обработване на поръчката...", "⏳");

        try {
            // 1. Питаме сървъра: "Вярно ли плати тоя човек?"
            const response = await fetch('https://us-central1-scriptsensei-4e8fe.cloudfunctions.net/verifyPayment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });

            const data = await response.json();

            if (data.success) {
                // 2. ✅ УСПЕХ! Сървърът потвърди и записа в базата.

                // Изчистваме грозния URL (?session_id=...)
                window.history.replaceState({}, document.title, "/");

                alert("🎉 ЧЕСТИТО! Плащането е успешно! Сега си ScriptSensei PRO! 💎");

                // 👇 ТОВА ЛИПСВАШЕ: Презареждаме, за да активираме PRO функциите веднага!
                window.location.href = "/";
            } else {
                showToast("Плащането не беше потвърдено.", "❌");
            }
        } catch (error) {
            console.error("Verification failed", error);
            showToast("Грешка при проверка на плащането.", "⚠️");
        }
    }
}