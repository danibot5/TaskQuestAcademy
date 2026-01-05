import { initAuth } from './auth.js';
import { initEditor, editor } from './editor.js'; // Импортираме и editor инстанцията
import { sendMessage, startNewChat } from './chat.js';
import { initFeedbackSystem, toggleTheme, initTheme, renderAttachments, shareChat } from './ui.js';
import { state, setIsMuted, setIsSpeakingNow } from './state.js';
import { resumeSpeaking, SVGs } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализация
    initAuth();
    initEditor();
    initFeedbackSystem();
    initTheme();

    // 2. Глобални функции
    window.removeAttachment = (index) => {
        state.currentAttachments.splice(index, 1);
        renderAttachments();
    };

    // 3. Основни бутони
    document.getElementById('send-btn').addEventListener('click', sendMessage);

    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            startNewChat();
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('open');
        });
    }

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Share Button Listener
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareChat);
    }

    // Sidebar Toggle
    const menuBtn = document.getElementById('menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');
    if (menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));

    // 4. Input Area Logic
    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            this.style.overflowY = this.scrollHeight > 200 ? 'auto' : 'hidden';
            if (this.value === '') this.style.height = '';
        });

        userInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // 5. File Upload
    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (event) => {
            const files = Array.from(event.target.files);
            if (files.length === 0) return;
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64 = e.target.result.split(',')[1];
                    state.currentAttachments.push({
                        base64: base64,
                        mimeType: file.type,
                        name: file.name
                    });
                    renderAttachments();
                };
                reader.readAsDataURL(file);
            });
            fileInput.value = '';
            if (userInput) userInput.focus();
        });
    }

    // 6. Voice / Mute
    const micBtn = document.getElementById('mic-btn');
    const muteBtn = document.getElementById('mute-btn');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition && micBtn) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'bg-BG';
        recognition.continuous = false;
        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('recording')) recognition.stop();
            else recognition.start();
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
        recognition.onresult = (e) => {
            userInput.value += (userInput.value ? ' ' : '') + e.results[0][0].transcript;
        };
    } else if (micBtn) {
        micBtn.style.display = 'none';
    }

    if (muteBtn) {
        const updateMuteUI = () => {
            if (state.isMuted) {
                muteBtn.innerHTML = SVGs.volumeOff;
                muteBtn.style.color = '#ff4444';
            } else {
                muteBtn.innerHTML = SVGs.volumeOn;
                muteBtn.style.color = '';
            }
        };
        muteBtn.addEventListener('click', () => {
            setIsMuted(!state.isMuted);
            localStorage.setItem('scriptsensei_muted', state.isMuted);
            updateMuteUI();
            if (!state.isMuted && state.isSpeakingNow) resumeSpeaking(state.speechCharIndex);
            else window.speechSynthesis.cancel();
        });
        updateMuteUI();
    }

    // 7. 🔥 ПОПРАВЕН SEARCH LOGIC 🔥
    const searchWrapper = document.getElementById('search-wrapper');
    const searchInput = document.getElementById('search-input');
    const searchToggleBtn = document.getElementById('search-toggle-btn');

    if (searchWrapper && searchToggleBtn && searchInput) {
        searchToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (searchWrapper.classList.contains('active')) {
                searchWrapper.classList.remove('active');
                searchInput.value = '';
                filterChats('');
            } else {
                searchWrapper.classList.add('active');
                searchInput.focus();
            }
        });

        searchInput.addEventListener('input', (e) => filterChats(e.target.value.toLowerCase()));

        // Затваряне при клик навън
        document.addEventListener('click', (e) => {
            if (searchWrapper.classList.contains('active') && !searchWrapper.contains(e.target)) {
                searchWrapper.classList.remove('active');
                searchInput.value = '';
                filterChats('');
            }
        });
    }

    function filterChats(term) {
        const items = document.querySelectorAll('.chat-item');
        items.forEach(item => {
            const titleEl = item.querySelector('.chat-title');
            if (titleEl) {
                const title = titleEl.innerText.toLowerCase();
                item.style.display = title.includes(term) ? 'flex' : 'none';
            }
        });
    }

    // 8. 🔥 GLOBAL SHORTCUTS (F5 / Ctrl+Enter) 🔥
    document.addEventListener('keydown', (e) => {
        // Run Code
        if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
            e.preventDefault();
            const runBtn = document.getElementById('run-btn');
            if (runBtn) runBtn.click();
        }
    });
});