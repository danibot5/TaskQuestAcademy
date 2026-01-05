import { initAuth } from './auth.js';
import { initEditor } from './editor.js';
import { sendMessage, startNewChat } from './chat.js';
import { initFeedbackSystem, toggleTheme, initTheme, renderAttachments, renderSidebar, shareChat } from './ui.js';
import { state, setIsMuted, setIsSpeakingNow } from './state.js';
import { loadAndDebugVoices, resumeSpeaking, SVGs } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализация на модулите
    initAuth();
    initEditor();
    initFeedbackSystem();
    initTheme();

    // 2. Глобални функции (за HTML onclick достъп)
    window.removeAttachment = (index) => {
        state.currentAttachments.splice(index, 1);
        renderAttachments();
    };

    // 3. Event Listeners за основните бутони
    document.getElementById('send-btn').addEventListener('click', sendMessage);

    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            startNewChat();
            document.getElementById('sidebar').classList.remove('open');
        });
    }

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareChat);
    }

    // Sidebar бутони
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

    // 5. File Upload Logic
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

    // 6. Voice / Speech Logic
    const micBtn = document.getElementById('mic-btn');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
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
    } else {
        if (micBtn) micBtn.style.display = 'none';
    }

    // 7. Mute Button Logic
    const muteBtn = document.getElementById('mute-btn');
    const updateMuteUI = () => {
        if (state.isMuted) {
            muteBtn.innerHTML = SVGs.volumeOff;
            muteBtn.style.color = '#ff4444';
            if (state.isSpeakingNow) resumeSpeaking(state.speechCharIndex);
        } else {
            muteBtn.innerHTML = SVGs.volumeOn;
            muteBtn.style.color = '';
            if (state.isSpeakingNow) resumeSpeaking(state.speechCharIndex);
        }
    };

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            setIsMuted(!state.isMuted);
            localStorage.setItem('scriptsensei_muted', state.isMuted);
            updateMuteUI();
        });
        updateMuteUI(); // Init
    }

    // 8. Search Logic
    const searchWrapper = document.getElementById('search-wrapper');
    const searchInput = document.getElementById('search-input');
    const searchToggleBtn = document.getElementById('search-toggle-btn');

    function filterChats(term) {
        const items = document.querySelectorAll('.chat-item');
        items.forEach(item => {
            const title = item.querySelector('.chat-title').innerText.toLowerCase();
            item.style.display = title.includes(term) ? 'flex' : 'none';
        });
    }

    if (searchWrapper) {
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
    }
});