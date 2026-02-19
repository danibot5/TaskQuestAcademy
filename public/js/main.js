import { initAuth } from './auth.js';
import { initEditor } from './editor.js';
import { sendMessage, startNewChat } from './chat.js';
import { initFeedbackSystem, initMuteButton, toggleTheme, initTheme, renderAttachments, shareChat, initProfileModal } from './ui.js';
import { state } from './state.js';
import { SVGs, showToast } from './utils.js';
import { startCheckout } from './payment.js';

document.addEventListener('DOMContentLoaded', async () => {
    initAuth();
    initEditor();
    initProfileModal();
    initFeedbackSystem();
    initTheme();
    initMuteButton();

    window.removeAttachment = (index) => {
        if (state.currentAttachments && state.currentAttachments.length > index) {
            state.currentAttachments.splice(index, 1);
            renderAttachments();
        }
    };

    const oldSendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const attachmentList = document.getElementById('attachment-preview-list');

    let checkSendButtonState = () => { };

    if (oldSendBtn && userInput) {
        const newSendBtn = oldSendBtn.cloneNode(true);
        oldSendBtn.parentNode.replaceChild(newSendBtn, oldSendBtn);

        checkSendButtonState = () => {
            const text = userInput.value.trim();
            const hasFiles = state.currentAttachments && state.currentAttachments.length > 0;
            const shouldBeEnabled = text.length > 0 || hasFiles;
            newSendBtn.disabled = !shouldBeEnabled;
        };

        checkSendButtonState();

        newSendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            newSendBtn.setAttribute('disabled', 'true');
            newSendBtn.classList.remove('active');
            userInput.style.height = 'auto';

            import('./chat.js').then(m => m.sendMessage());
        });

        userInput.addEventListener('input', () => {
            userInput.style.height = 'auto';
            userInput.style.height = (userInput.scrollHeight) + 'px';
            if (userInput.value === '') userInput.style.height = 'auto';
            checkSendButtonState();
        });

        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = userInput.value.trim();
                const hasFiles = state.currentAttachments && state.currentAttachments.length > 0;
                
                if (text.length > 0 || hasFiles) {
                    newSendBtn.setAttribute('disabled', 'true');
                    newSendBtn.classList.remove('active');
                    userInput.style.height = 'auto';

                    import('./chat.js').then(m => m.sendMessage());
                }
            }
        });

        if (attachmentList) {
            const observer = new MutationObserver(() => checkSendButtonState());
            observer.observe(attachmentList, { childList: true, subtree: true });
        }
    }

    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');

    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            for (const file of files) {
                // ПРОВЕРКА ЗА ДУБЛИКАТИ!!! 
                const isDuplicate = state.currentAttachments.some(existing => existing.name === file.name);

                if (isDuplicate) {
                    showToast(`Файлът "${file.name}" вече е добавен!`, '⚠️');
                    continue; // Пропускаме този файл и минаваме на следващия
                }

                // 2. Проверка за размер (5MB)
                if (file.size > 5 * 1024 * 1024) {
                    showToast(`"${file.name}" е твърде голям (max 5MB).`, '❌');
                    continue;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64String = event.target.result.split(',')[1];

                    state.currentAttachments.push({
                        name: file.name,
                        mimeType: file.type,
                        base64: base64String
                    });

                    renderAttachments();
                    checkSendButtonState();
                };
                reader.readAsDataURL(file);
            }

            fileInput.value = ''; // Чистим, за да хване change event ако изберем същото пак (след като сме го изтрили)
        });
    }

    const micBtn = document.getElementById('mic-btn');
    let recognition = null;

    if (micBtn && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'bg-BG'; // Български език
        recognition.interimResults = true;

        let isListening = false;

        micBtn.addEventListener('click', (e) => {
            e.preventDefault();

            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });

        recognition.onstart = () => {
            isListening = true;
            micBtn.classList.add('listening');
            micBtn.style.color = '#ff4444'; // Червен цвят докато слуша
        };

        recognition.onend = () => {
            isListening = false;
            micBtn.classList.remove('listening');
            micBtn.style.color = ''; // Връщаме нормалния цвета
            checkSendButtonState(); // Проверяваме дали да активираме Send бутона
        };

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');

            if (userInput) {
                userInput.value = transcript;
                // Тригер-ваме auto-resize
                userInput.dispatchEvent(new Event('input'));
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech error", event.error);
            isListening = false;
            micBtn.classList.remove('listening');
            micBtn.style.color = '';
        };
    } else if (micBtn) {
        // Ако браузърът не поддържа speech API
        micBtn.style.display = 'none';
    }

    const newChatBtn = document.getElementById('new-chat-btn');
    const topNewChatBtn = document.getElementById('top-new-chat-btn');
    const handleNewChat = () => {
        startNewChat();
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
        if (userInput) { userInput.value = ''; checkSendButtonState(); }
    };
    if (newChatBtn) newChatBtn.addEventListener('click', handleNewChat);
    if (topNewChatBtn) topNewChatBtn.addEventListener('click', handleNewChat);

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) shareBtn.addEventListener('click', shareChat);

    const menuBtn = document.getElementById('menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');

    if (menuBtn && document.getElementById('sidebar')) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('sidebar').classList.toggle('open');
        });
    }
    if (closeSidebarBtn && document.getElementById('sidebar')) {
        closeSidebarBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });
    }

    document.addEventListener('click', (e) => {
        const sb = document.getElementById('sidebar');
        if (window.innerWidth <= 768 && sb && sb.classList.contains('open')) {
            if (!sb.contains(e.target) && e.target !== menuBtn) {
                sb.classList.remove('open');
            }
        }
    });

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
                if (titleText.includes(term) || term === "") item.style.display = 'flex';
                else item.style.display = 'none';
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
            if (e.key === 'Escape' && searchWrapper.classList.contains('active')) closeSearch();
        });

        document.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.pro-btn');

        if (targetBtn) {
            e.preventDefault();
            startCheckout();
        }
    });
    }
});