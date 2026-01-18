import { initAuth } from './auth.js';
import { initEditor } from './editor.js';
import { sendMessage, startNewChat } from './chat.js';
import { initFeedbackSystem, initMuteButton, toggleTheme, initTheme, renderAttachments, shareChat, initProfileModal } from './ui.js';
import { state } from './state.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Инициализация на системите
    initAuth();
    initEditor();
    initProfileModal();
    initFeedbackSystem();
    initTheme();
    initMuteButton();

    // 2. Глобална функция за махане на файлове (за UI-а)
    window.removeAttachment = (index) => {
        if (state.currentAttachments && state.currentAttachments.length > index) {
            state.currentAttachments.splice(index, 1);
            renderAttachments();
            // Ще се опресни автоматично от MutationObserver-а по-долу
        }
    };

    // --- ЛОГИКА ЗА SEND БУТОНА (FIXED & WORKING) ---
    const oldSendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const attachmentList = document.getElementById('attachment-preview-list');

    if (oldSendBtn && userInput) {
        // 1. Клонираме бутона, за да изчистим стари слушатели
        const newSendBtn = oldSendBtn.cloneNode(true);
        oldSendBtn.parentNode.replaceChild(newSendBtn, oldSendBtn);

        // 2. Функция за проверка на състоянието (Ползва НОВИЯ бутон)
        const checkSendButtonState = () => {
            const text = userInput.value.trim();
            const hasFiles = state.currentAttachments && state.currentAttachments.length > 0;

            // Ако има текст ИЛИ има файлове -> Активен
            const shouldBeEnabled = text.length > 0 || hasFiles;

            newSendBtn.disabled = !shouldBeEnabled;
        };

        // 3. Първоначална проверка (за да стане сив веднага)
        checkSendButtonState();

        // 4. Слушател за клик
        newSendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (newSendBtn.disabled) return; // Защита

            // МИГНОВЕН BLUR
            userInput.blur();
            newSendBtn.blur();

            sendMessage();

            // Деактивираме веднага след пращане
            setTimeout(checkSendButtonState, 10);
        });

        // 5. Слушател при писане
        userInput.addEventListener('input', () => {
            // Auto-resize
            userInput.style.height = 'auto';
            userInput.style.height = (userInput.scrollHeight) + 'px';
            if (userInput.value === '') userInput.style.height = 'auto';

            // Проверка
            checkSendButtonState();
        });

        // 6. Слушател за Enter
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!newSendBtn.disabled) {
                    userInput.blur();
                    newSendBtn.blur();
                    sendMessage();
                    setTimeout(checkSendButtonState, 10);
                }
            }
        });

        // 7. OBSERVER: Следим за промени във файловете
        if (attachmentList) {
            const observer = new MutationObserver(() => {
                checkSendButtonState();
            });
            observer.observe(attachmentList, { childList: true, subtree: true });
        }
    }

    // --- ОСТАНАЛИТЕ БУТОНИ ---

    // Бутон за нов чат
    const newChatBtn = document.getElementById('new-chat-btn');
    const topNewChatBtn = document.getElementById('top-new-chat-btn');

    const handleNewChat = () => {
        startNewChat();
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
        // Ресет на бутона при нов чат
        if (userInput) {
            userInput.value = '';
            // Трябва да извикаме събитие input, за да може логиката горе да хване промяната
            userInput.dispatchEvent(new Event('input'));
        }
    };

    if (newChatBtn) newChatBtn.addEventListener('click', handleNewChat);
    if (topNewChatBtn) topNewChatBtn.addEventListener('click', handleNewChat);

    // Тема и споделяне
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) shareBtn.addEventListener('click', shareChat);

    // Мобилно меню
    const menuBtn = document.getElementById('menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');

    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });
    }

    if (closeSidebarBtn && sidebar) {
        closeSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    }

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && e.target !== menuBtn) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Търсачка (Search)
    const searchBtn = document.querySelector('.search-btn') || document.getElementById('search-toggle-btn');
    const searchWrapper = document.querySelector('.search-wrapper');
    const searchInput = document.getElementById('search-input');

    if (searchBtn && searchWrapper && searchInput) {
        const closeSearch = () => {
            searchWrapper.classList.remove('active');
            searchInput.value = '';
            const chatItems = document.querySelectorAll('.chat-item');
            chatItems.forEach(item => item.style.display = 'flex');
        };

        searchBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (searchWrapper.classList.contains('active')) {
                closeSearch();
            } else {
                searchWrapper.classList.add('active');
                setTimeout(() => searchInput.focus(), 100);
            }
        });

        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const chatItems = document.querySelectorAll('.chat-item');

            chatItems.forEach(item => {
                const titleSpan = item.querySelector('.chat-title');
                const titleText = titleSpan ? titleSpan.innerText.toLowerCase() : "";

                if (titleText.includes(term) || term === "") {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });

        document.addEventListener('click', (e) => {
            if (!searchWrapper.classList.contains('active')) return;
            if (searchWrapper.contains(e.target)) return;
            if (searchBtn.contains(e.target)) return;
            if (e.target.closest('.chat-item')) return;
            closeSearch();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchWrapper.classList.contains('active')) {
                closeSearch();
            }
        });
    }
});