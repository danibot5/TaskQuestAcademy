import { state, setSelectedModel, setIsMuted } from './state.js';
import { SVGs, showToast, copyMessageText, speakText, resumeSpeaking } from './utils.js';
import { deleteFromFirestore, saveToLocalStorage, updateChatData, sendFeedbackReport, saveFeedbackToHistory } from './db.js';
import { editor } from './editor.js';
import { startCheckout, checkPaymentStatus, openCustomerPortal } from './payment.js';
import { auth } from './config.js';
import { signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const chatHistory = document.getElementById('chat-history');
const chatList = document.querySelector('.chat-list');
const sidebar = document.getElementById('sidebar');
const mobileEditorBtn = document.getElementById('mobile-editor-toggle');
const body = document.body;
const closeEditorBtn = document.getElementById('close-mobile-editor');

let isUserScrolledUp = false;

if (chatHistory) {
    chatHistory.addEventListener('scroll', () => {
        const distanceToBottom = chatHistory.scrollHeight - chatHistory.scrollTop - chatHistory.clientHeight;
        
        if (distanceToBottom > 100) {
            isUserScrolledUp = true;
        } else {
            isUserScrolledUp = false;
        }
    });
}

export function renderSidebar() {
    chatList.innerHTML = '';

    const searchInput = document.getElementById('search-input');
    const filterTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";

    state.allChats.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const dateA = a.createdAt || a.id;
        const dateB = b.createdAt || b.id;
        return dateB - dateA;
    });

    state.allChats.forEach(chat => {
        const div = document.createElement('div');
        div.classList.add('chat-item');
        div.style.position = 'relative';

        if (chat.id === state.currentChatId) div.classList.add('active');

        if (filterTerm && !chat.title.toLowerCase().includes(filterTerm)) {
            div.style.display = 'none';
        } else {
            div.style.display = 'flex';
        }

        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.querySelectorAll('.chat-menu-dropdown.show').forEach(el => el.classList.remove('show'));
            menuDropdown.classList.add('show');
        });

        div.addEventListener('click', async (e) => {
            if (e.target.closest('.chat-options-btn') || e.target.closest('.chat-menu-dropdown')) return;

            const module = await import('./chat.js');
            module.loadChat(chat.id);

            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.classList.remove('open');
            }
        });

        const titleSpan = document.createElement('span');
        titleSpan.classList.add('chat-title');
        let pinIconHTML = chat.isPinned ? `<span class="pinned-icon">${SVGs.pin}</span>` : '';
        titleSpan.innerHTML = pinIconHTML + (chat.title || "Нов разговор");

        const optionsBtn = document.createElement('button');
        optionsBtn.className = 'chat-options-btn';
        optionsBtn.innerHTML = SVGs.moreVertical;

        const menuDropdown = document.createElement('div');
        menuDropdown.className = 'chat-menu-dropdown';

        const renameOpt = document.createElement('button');
        renameOpt.className = 'menu-option';
        renameOpt.innerHTML = `${SVGs.edit} Преименувай`;
        renameOpt.onclick = async () => {
            const newTitle = prompt("Ново име на чата:", chat.title);
            if (newTitle && newTitle.trim() !== "") {
                chat.title = newTitle.trim();
                await updateChatData(chat);
                renderSidebar();
            }
        };

        const pinOpt = document.createElement('button');
        pinOpt.className = 'menu-option';
        pinOpt.innerHTML = chat.isPinned ? `${SVGs.pin} Откачи` : `${SVGs.pin} Закачи`;
        if (chat.isPinned) pinOpt.style.color = '#1a73e8';
        pinOpt.onclick = async () => {
            chat.isPinned = !chat.isPinned;
            await updateChatData(chat);
            renderSidebar();
        };

        const deleteOpt = document.createElement('button');
        deleteOpt.className = 'menu-option delete-opt';
        deleteOpt.innerHTML = `${SVGs.trash} Изтрий`;
        deleteOpt.onclick = async () => {
            if (!confirm("Сигурен ли си, че искаш да изтриеш този чат?")) return;
            state.allChats = state.allChats.filter(c => c.id !== chat.id);
            if (state.currentUser) await deleteFromFirestore(chat.id);
            else saveToLocalStorage();

            if (chat.id === state.currentChatId) {
                const module = await import('./chat.js');
                module.startNewChat();
            } else {
                renderSidebar();
            }
        };

        menuDropdown.appendChild(renameOpt);
        menuDropdown.appendChild(pinOpt);
        menuDropdown.appendChild(deleteOpt);

        optionsBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.chat-menu-dropdown.show').forEach(el => {
                if (el !== menuDropdown) el.classList.remove('show');
            });
            menuDropdown.classList.toggle('show');
        };

        div.appendChild(titleSpan);
        div.appendChild(optionsBtn);
        div.appendChild(menuDropdown);
        chatList.appendChild(div);
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.chat-options-btn')) {
        document.querySelectorAll('.chat-menu-dropdown.show').forEach(el => el.classList.remove('show'));
    }
});

export function addMessageToUI(text, sender, feedbackStatus = null) {
    const rowDiv = document.createElement('div');
    rowDiv.classList.add('message-row');

    if (sender === 'user') {
        rowDiv.classList.add('user-row');
        const bubble = document.createElement('div');
        bubble.classList.add('user-bubble');

        if (text.includes('<i>Изпратен файл') || text.includes('<i>Изпратени файлове')) {
            bubble.innerHTML = text;
        } else {
            bubble.innerText = text;
        }

        rowDiv.appendChild(bubble);

    } else {
        rowDiv.classList.add('bot-row');

        const avatarImg = document.createElement('img');
        avatarImg.src = 'images/bot-avatar.png';
        avatarImg.classList.add('avatar');

        const messageContainer = document.createElement('div');
        messageContainer.style.display = 'flex';
        messageContainer.style.flexDirection = 'column';
        messageContainer.style.maxWidth = '80%';
        messageContainer.style.width = '100%';

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

        injectCodeButtons(textDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        let likeBtn, dislikeBtn;
        const speakBtn = createActionButton(SVGs.speak, 'Прочети на глас', () => speakText(text));
        const copyBtn = createActionButton(SVGs.copy, 'Копирай текста', (e) => copyMessageText(text, e.currentTarget));

        likeBtn = createActionButton(
            feedbackStatus === 'like' ? SVGs.likeFilled : SVGs.like,
            'Полезен отговор',
            () => handleFeedback('like', text, rowDiv, likeBtn, dislikeBtn)
        );

        dislikeBtn = createActionButton(
            feedbackStatus === 'dislike' ? SVGs.dislikeFilled : SVGs.dislike,
            'Неполезен отговор',
            () => handleFeedback('dislike', text, rowDiv, likeBtn, dislikeBtn)
        );

        if (feedbackStatus === 'like') {
            likeBtn.innerHTML = SVGs.likeFilled;
            likeBtn.style.color = '#c9c9c9ff';
            likeBtn.style.opacity = '1';
            likeBtn.disabled = true;
            likeBtn.style.cursor = 'default';
        } else if (feedbackStatus === 'dislike') {
            dislikeBtn.innerHTML = SVGs.dislikeFilled;
            dislikeBtn.style.color = '#c9c9c9ff';
            dislikeBtn.style.opacity = '1';
            dislikeBtn.disabled = true;
            dislikeBtn.style.cursor = 'default';
        }

        const isWelcomeMessage = text.startsWith("Здравей! Аз съм твоят ментор");

        actionsDiv.appendChild(copyBtn);

        if (!isWelcomeMessage) {
            if (feedbackStatus !== 'dislike') {
                actionsDiv.appendChild(likeBtn);
            }
            if (feedbackStatus !== 'like') {
                actionsDiv.appendChild(dislikeBtn);
            }
        }

        actionsDiv.appendChild(speakBtn);

        messageContainer.appendChild(textDiv);
        messageContainer.appendChild(actionsDiv);

        rowDiv.appendChild(avatarImg);
        rowDiv.appendChild(messageContainer);
    }

    chatHistory.appendChild(rowDiv);
    scrollToBottom(true);
}

function createActionButton(svg, title, handler) {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.innerHTML = svg;
    btn.title = title;
    btn.onclick = handler;
    return btn;
}

export function showLoading() {
    const rowDiv = document.createElement('div');
    rowDiv.classList.add('message-row', 'bot-row');
    rowDiv.id = 'loading-indicator';

    const avatarImg = document.createElement('img');
    avatarImg.src = 'images/bot-avatar.png';
    avatarImg.classList.add('avatar');

    const bubble = document.createElement('div');
    bubble.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;

    rowDiv.appendChild(avatarImg);
    rowDiv.appendChild(bubble);
    chatHistory.appendChild(rowDiv);
    rowDiv.scrollIntoView({ behavior: "smooth", block: "end" });
}

export function removeLoading() {
    const loader = document.getElementById('loading-indicator');
    if (loader) loader.remove();
}

export function renderAttachments() {
    const list = document.getElementById('attachment-preview-list');
    const files = state.currentAttachments;

    if (files.length === 0) {
        list.style.display = 'none';
        return;
    }

    list.style.display = 'flex';
    list.innerHTML = '';

    files.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'attachment-item';

        if (file.mimeType.startsWith('image/')) {
            item.innerHTML = `
                <img src="data:${file.mimeType};base64,${file.base64}">
                <button class="remove-file-btn" onclick="window.removeAttachment(${index})">✕</button>
            `;
        } else {
            item.innerHTML = `
                <div class="file-icon" title="${file.name}">📄</div>
                <button class="remove-file-btn" onclick="window.removeAttachment(${index})">✕</button>
            `;
        }
        list.appendChild(item);
    });
}

export function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('scriptsensei_theme', isDark ? 'dark' : 'light');
    
    if (editor) {
        editor.setOption("theme", isDark ? "dracula" : "eclipse");
        setTimeout(() => editor.refresh(), 50);
    }

    const themeCheckbox = document.getElementById('theme-checkbox');
    if (themeCheckbox) {
        themeCheckbox.checked = isDark;
    }
}

export function initTheme() {
    const savedTheme = localStorage.getItem('scriptsensei_theme');
    const themeCheckbox = document.getElementById('theme-checkbox');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (editor) editor.setOption("theme", "dracula"); 
        if (themeCheckbox) themeCheckbox.checked = true;
    } else {
        if (editor) editor.setOption("theme", "eclipse");
    }

    if (themeCheckbox) {
        themeCheckbox.addEventListener('change', toggleTheme);
    }

    const mobileThemeToggle = document.getElementById('theme-toggle-mobile');
    if (mobileThemeToggle) {
        mobileThemeToggle.addEventListener('click', (e) => {
             e.preventDefault();
             toggleTheme();
        });
    }
}

const feedbackModal = document.getElementById('feedback-modal');
const feedbackForm = document.getElementById('feedback-form');
let activeFeedbackUI = null;

async function handleFeedback(type, text, messageRow, likeBtn, dislikeBtn) {
    if (type === 'like') {
        if (likeBtn.disabled) return;

        likeBtn.innerHTML = SVGs.likeFilled;
        likeBtn.style.color = '#c9c9c9ff';
        likeBtn.disabled = true;
        likeBtn.style.cursor = 'default';
        if (dislikeBtn) dislikeBtn.remove();

        sendFeedbackReport('like', text);
        showToast('Благодарим за оценката!', '👍');
        await saveFeedbackToHistory(text, 'like');
    } else {
        openFeedbackModal(likeBtn, dislikeBtn, text);
    }
}

function openFeedbackModal(likeBtn, dislikeBtn, rawText) {
    activeFeedbackUI = { likeBtn, dislikeBtn, rawText };
    feedbackModal.style.display = 'flex';
    feedbackForm.reset();
    document.getElementById('feedback-details').disabled = true;
    document.getElementById('submit-feedback').disabled = true;
}

export function initFeedbackSystem() {
    const closeBtn = document.getElementById('close-feedback');
    const detailsInput = document.getElementById('feedback-details');
    const otherCheckbox = document.getElementById('other-checkbox');
    const submitBtn = document.getElementById('submit-feedback');

    closeBtn.onclick = () => feedbackModal.style.display = 'none';

    feedbackForm.addEventListener('change', validate);
    detailsInput.addEventListener('input', validate);

    function validate() {
        const isOther = otherCheckbox.checked;
        detailsInput.disabled = !isOther;

        let hasChecked = Array.from(feedbackForm.querySelectorAll('input[type="checkbox"]')).some(c => c.checked);
        let isValid = hasChecked;

        if (isOther && detailsInput.value.trim() === "") isValid = false;

        submitBtn.disabled = !isValid;
        submitBtn.style.cursor = isValid ? 'pointer' : 'default';
    }

    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeFeedbackUI) return;

        const { likeBtn, dislikeBtn, rawText } = activeFeedbackUI;

        const reasons = Array.from(feedbackForm.querySelectorAll('input:checked')).map(i => i.value);
        const details = detailsInput.value;

        dislikeBtn.innerHTML = SVGs.dislikeFilled;
        dislikeBtn.style.color = '#c9c9c9ff';
        dislikeBtn.disabled = true;
        dislikeBtn.style.cursor = 'default';
        if (likeBtn) likeBtn.remove();

        sendFeedbackReport('dislike', rawText, reasons, details);
        await saveFeedbackToHistory(rawText, 'dislike');

        feedbackModal.style.display = 'none';
        activeFeedbackUI = null;
        showToast('Благодарим за мнението!', '🙏');
    });
}

export async function shareChat() {
    const currentChat = state.allChats.find(c => c.id === state.currentChatId);
    if (!currentChat || !currentChat.messages || currentChat.messages.length === 0) {
        showToast('Няма какво да се сподели!', '⚠️');
        return;
    }

    let shareText = `📜 *Чат със ScriptSensei: ${currentChat.title || 'Разговор'}*\n\n`;
    currentChat.messages.forEach(msg => {
        const role = msg.sender === 'user' ? '👤 Аз' : '🤖 Sensei';
        let cleanText = msg.text.replace(/```/g, '');
        shareText += `${role}: ${cleanText}\n\n`;
    });
    shareText += `\n🚀 *Генерирано от ScriptSensei*`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'ScriptSensei Chat',
                text: shareText
            });
            return;
        } catch (err) {
        }
    }

    try {
        await navigator.clipboard.writeText(shareText);
        showToast('Чатът е копиран в клипборда!', '📋');
    } catch (err) {
        showToast('Грешка при споделяне.', '❌');
    }
}

if (mobileEditorBtn) {
    mobileEditorBtn.addEventListener('click', () => {
        body.classList.toggle('mobile-editor-active');

        if (body.classList.contains('mobile-editor-active')) {
            mobileEditorBtn.style.color = '#1a73e8';

            setTimeout(() => {
                editor.refresh();
            }, 10);
        } else {
            mobileEditorBtn.style.color = '';
        }
    });
}

if (closeEditorBtn) {
    closeEditorBtn.addEventListener('click', () => {
        document.body.classList.remove('mobile-editor-active');

        const openBtn = document.getElementById('mobile-editor-toggle');
        if (openBtn) openBtn.style.color = '';
    });
}

export function initProfileModal() {
    const userInfoBtn = document.getElementById('user-info');
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.getElementById('close-profile');

    // 👇 Взимаме САМО бутона от модала. Сайдбар бутонът се управлява от auth.js!
    const logoutBtnModal = document.getElementById('logout-btn-modal');

    const buyBtnModal = document.getElementById('buy-pro-modal');
    const buyBtnSidebar = document.getElementById('buy-pro-sidebar');

    if (!userInfoBtn || !modal) return;

    userInfoBtn.addEventListener('click', (e) => {
        // Ако е кликнал на малкия бутон "Изход" в сайдбара, не отваряме модала
        if (e.target.closest('.logout-link')) return;

        if (!state.currentUser) {
            document.getElementById('login-modal').style.display = 'flex';
            return;
        }

        populateProfileData();
        modal.style.display = 'flex';
    });

    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';

    // 🔥 FIX: Махнахме проверката за '&& logoutBtnSidebar'
    // Сега бутонът в модала работи винаги, независимо от сайдбара!
    if (logoutBtnModal) {
        logoutBtnModal.onclick = async () => {
            if (confirm("Сигурен ли си, че искаш да излезеш?")) {
                modal.style.display = 'none';
                await signOut(auth);
                window.location.reload();
            }
        };
    }

    if (buyBtnModal) {
        buyBtnModal.onclick = () => {
            if (state.hasPremiumAccess) {
                openCustomerPortal();
            } else {
                startCheckout();
            }
        };
    }

    if (buyBtnSidebar) {
        buyBtnSidebar.onclick = () => {
            startCheckout();
        };
    }
}

export function populateProfileData() {
    const user = state.currentUser;
    if (!user) return;

    document.getElementById('profile-avatar').src = user.photoURL || 'images/bot-avatar.png';
    document.getElementById('profile-name').innerText = user.displayName || 'Нинджа';
    document.getElementById('profile-email').innerText = user.email || '';

    const badge = document.getElementById('pro-badge');
    const planLabel = document.querySelector('.stat-item:nth-child(3) .stat-value');
    const buyBtnModal = document.getElementById('buy-pro-modal');


    if (state.hasPremiumAccess) {
        if (badge) badge.style.display = 'inline-block';

        if (planLabel) {
            planLabel.innerText = "PRO";
            planLabel.style.color = "gold";
        }

        if (buyBtnModal) {
            buyBtnModal.innerText = "⚙️ Управление на абонамента";
            buyBtnModal.style.background = "#333";
            buyBtnModal.style.color = "#fff";
            buyBtnModal.style.boxShadow = "none";
            buyBtnModal.style.border = "1px solid #555";
            buyBtnModal.onclick = () => {
                openCustomerPortal();
            };
        }
    } else {
        if (badge) badge.style.display = 'none';

        if (planLabel) {
            planLabel.innerText = "Free";
            planLabel.style.color = "";
        }

        if (buyBtnModal) {
            buyBtnModal.innerText = "Вземи PRO (10.00 лв/мес)";
            buyBtnModal.style.background = "linear-gradient(135deg, #FFD700 0%, #FDB931 100%)";
            buyBtnModal.style.color = "#000";
            buyBtnModal.onclick = () => {
                startCheckout();
            };
        }
    }

    const chatCount = state.allChats.length;
    document.getElementById('stat-chats').innerText = chatCount;

    const creationTime = user.metadata?.creationTime;
    if (creationTime) {
        const date = new Date(creationTime);
        const dateStr = date.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' });
        document.getElementById('stat-date').innerText = dateStr;
    }

    let level = "Новак 🥚";
    if (chatCount > 5) level = "Чирак 🔨";
    if (chatCount > 10) level = "Нинджа 🥷";
    if (chatCount > 25) level = "Сенсей 🧘";
    if (chatCount > 45) level = "Легенда 🏆";

    document.getElementById('profile-level').innerText = `Ранк: ${level}`;
}

export function updateHeaderUI() {
    const modelSelectorContainer = document.getElementById('model-selector-container');
    const sidebarProCard = document.querySelector('.pro-card');
    const buyBtnModal = document.getElementById('buy-pro-modal');
    const buyBtnSidebar = document.getElementById('buy-pro-sidebar');
    const badge = document.getElementById('pro-badge');
    const planLabel = document.querySelector('.stat-item:nth-child(3) .stat-value');

    const currentText = document.getElementById('current-model-text');

    if (state.hasPremiumAccess) {
        if (badge) badge.style.display = 'inline-block';
        if (planLabel) { planLabel.innerText = "PRO"; planLabel.style.color = "gold"; }

        if (buyBtnModal) {
            buyBtnModal.style.display = 'block';
            buyBtnModal.innerText = "⚙️ Управление на абонамента";
            buyBtnModal.onclick = () => openCustomerPortal();
        }

        if (sidebarProCard) {
            sidebarProCard.innerHTML = `<div class="pro-bg-shine"></div>
                <div class="pro-content">
                    <div class="pro-header">
                        <span class="pro-title">ScriptSensei <strong>PRO</strong></span>
                    </div>
                    <p class="pro-desc">ScriptSensei Pro е активиран</p>
                </div>`;
        }

        if (modelSelectorContainer) {
            modelSelectorContainer.style.display = 'block';
            initCustomDropdown();

            const savedModel = localStorage.getItem('scriptsensei_model');
            let targetModel = savedModel || 'flash';

            let optionToSelect = modelSelectorContainer.querySelector(`.custom-option[data-value="${targetModel}"]`);

            if (!optionToSelect) {
                targetModel = 'flash';
                optionToSelect = modelSelectorContainer.querySelector(`.custom-option[data-value="flash"]`);
            }

            if (optionToSelect && currentText) {
                currentText.innerText = optionToSelect.innerText.split('(')[0].trim();

                const options = modelSelectorContainer.querySelectorAll('.custom-option');
                options.forEach(opt => opt.classList.remove('selected'));
                optionToSelect.classList.add('selected');

                setSelectedModel(targetModel);
                localStorage.setItem('scriptsensei_model', targetModel);
            } else if (currentText && !currentText.innerText.trim()) {
                currentText.innerText = "Flash";
            }
        }

    } else {
        if (badge) badge.style.display = 'none';
        if (planLabel) { planLabel.innerText = "Free"; planLabel.style.color = ""; }

        if (modelSelectorContainer) {
            modelSelectorContainer.style.display = 'none';
            setSelectedModel('flash');
        }

        if (sidebarProCard) {
            sidebarProCard.innerHTML = `<div class="pro-bg-shine"></div>
                <div class="pro-content">
                    <div class="pro-header">
                        <span class="pro-title">ScriptSensei <strong>PRO</strong></span>
                    </div>
                    <p class="pro-desc">Отключи пълната мощ <br>GEMINI 2.5 PRO И ОЩЕ МНОГО</p>
                    <button id="buy-pro-sidebar" class="pro-btn">Вземи PRO</button>
                </div>`;
        }

        if (buyBtnModal || buyBtnSidebar) {
            if (buyBtnModal) {
                buyBtnModal.innerText = "Вземи PRO (10.00 лв/мес)";
                buyBtnModal.onclick = () => startCheckout();
            }

            if (buyBtnSidebar) {
                buyBtnSidebar.innerText = "Вземи PRO (10.00 лв/мес)";
                buyBtnSidebar.onclick = () => startCheckout();
            }
        }
    }
}

export function updateLastBotMessage(fullText) {
    const chatHistory = document.getElementById('chat-history');
    const lastBotRow = chatHistory.querySelector('.bot-row:last-child');

    if (!lastBotRow) return;

    const textDiv = lastBotRow.querySelector('.bot-text');

    // Рендираме Markdown наново с целия текст до момента
    if (typeof marked !== 'undefined') {
        textDiv.innerHTML = marked.parse(fullText);
        // Highlight на кода в движение (може да е тежко, но е красиво)
        if (typeof hljs !== 'undefined') {
            textDiv.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
        }
    } else {
        textDiv.innerText = fullText;
    }

    injectCodeButtons(textDiv);

    scrollToBottom(false);
}

export function scrollToBottom(forceInstant = false) {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;

    if (isUserScrolledUp && !forceInstant) {
        return;
    }

    const behaviorType = forceInstant ? 'auto' : 'smooth';

    chatHistory.scrollTo({
        top: chatHistory.scrollHeight,
        behavior: behaviorType
    });
    
    if (forceInstant) {
        isUserScrolledUp = false;
    }
}

function initCustomDropdown() {
    const container = document.getElementById('model-selector-container');
    if (!container) return;

    // Махаме проверката за initialized, за да сме сигурни, че винаги обновяваме логиката
    // container.dataset.initialized ... (махнато)

    const trigger = container.querySelector('.custom-select__trigger');
    const customSelect = container.querySelector('.custom-select');
    const options = container.querySelectorAll('.custom-option');
    const currentText = document.getElementById('current-model-text');

    if (!trigger || !customSelect) return;

    // 1. Използваме .onclick (по-сигурно от addEventListener в този случай)
    trigger.onclick = (e) => {
        e.stopPropagation(); // Спираме клика да не отиде към document
        customSelect.classList.toggle('open');
        console.log("Dropdown clicked! Open class:", customSelect.classList.contains('open'));
    };

    // 2. Логика за опциите
    options.forEach(option => {
        option.onclick = (e) => {
            e.stopPropagation();

            // Визуална смяна
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // Текст
            if (currentText) currentText.innerText = option.innerText.split('(')[0].trim();

            // Логика
            const value = option.getAttribute('data-value');
            setSelectedModel(value);
            localStorage.setItem('scriptsensei_model', value);

            // Затваряне
            customSelect.classList.remove('open');
            console.log("Model changed to:", value);
        };
    });

    // 3. Затваряне при клик навсякъде другаде
    // Използваме window, за да сме сигурни, че хващаме всичко
    window.addEventListener('click', (e) => {
        if (!customSelect.contains(e.target)) {
            customSelect.classList.remove('open');
        }
    });
}

// В js/ui.js - Замени функцията injectCodeButtons с тази:

function injectCodeButtons(container) {
    const codeBlocks = container.querySelectorAll('pre');

    codeBlocks.forEach((preBlock) => {
        // 1. Проверка дали има code елемент вътре
        const codeElement = preBlock.querySelector('code');
        if (!codeElement) return;

        // 🔥 FIX: Проверяваме дали КОНКРЕТНО ТОЗИ блок вече има тулбар отдолу.
        // Предишната грешка беше, че търсихме в целия контейнер (parentNode) 
        // и спирахме още след първия намерен тулбар.
        if (preBlock.nextElementSibling && preBlock.nextElementSibling.classList.contains('code-toolbar-custom')) {
            return;
        }

        const codeText = codeElement.innerText;

        // Определяме езика
        let language = 'txt';
        codeElement.classList.forEach(cls => {
            if (cls.startsWith('language-')) {
                language = cls.replace('language-', '');
            }
        });

        // Създаваме контейнер за бутоните (Toolbar)
        const toolbar = document.createElement('div');
        toolbar.className = 'code-toolbar-custom'; // Уникален клас
        toolbar.style.display = 'flex';
        toolbar.style.gap = '10px';
        toolbar.style.marginTop = '5px';
        toolbar.style.marginBottom = '15px';
        toolbar.style.justifyContent = 'flex-end';

        // 1. Бутон "Прехвърли в редактора" (Само за JS)
        if (language === 'javascript' || language === 'js') {
            const runBtn = document.createElement('button');
            runBtn.className = 'code-btn transfer-to-editor-btn';
            runBtn.innerHTML = `Прехвърли в редактора`;
            runBtn.title = "Сложи този код в редактора";

            runBtn.onclick = async () => {
                const { editor } = await import('./editor.js');
                editor.setValue(codeText);
                runBtn.innerHTML = "✅ Готово!";
                setTimeout(() => runBtn.innerHTML = "Прехвърли в редактора", 2500);
            };
            toolbar.appendChild(runBtn);
        }

        // 2. Бутон "Изтегли" (За всички)
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'code-btn download-btn-style';
        downloadBtn.style.color = 'white';

        const exts = {
            'javascript': 'js', 'js': 'js', 'python': 'py', 'py': 'py',
            'csharp': 'cs', 'cs': 'cs', 'cpp': 'cpp', 'c++': 'cpp',
            'html': 'html', 'xml': 'html', 'css': 'css', 'json': 'json',
            'markdown': 'md', 'md': 'md', 'java': 'java', 'php': 'php',
            'ruby': 'rb', 'rb': 'rb', 'go': 'go', 'golang': 'go',
            'typescript': 'ts', 'ts': 'ts', 'txt': 'txt', 'text': 'txt'
        };
        let ext = exts[language] || 'txt';

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

        toolbar.appendChild(downloadBtn);

        preBlock.parentNode.insertBefore(toolbar, preBlock.nextSibling);
    });
}

export function initMuteButton() {
    const muteBtn = document.getElementById('mute-btn');
    if (!muteBtn) return;

    // Функция за обновяване на вида на бутона
    const updateUI = () => {
        if (state.isMuted) {
            muteBtn.innerHTML = SVGs.volumeOff;
            muteBtn.style.color = '#ff4444'; // Червено, за да се вижда, че е спрян
            muteBtn.title = "Пусни звука";
        } else {
            muteBtn.innerHTML = SVGs.volumeOn;
            muteBtn.style.color = ''; // Връщаме оригиналния цвят
            muteBtn.title = "Спри звука";
        }
    };

    // 1. Първоначална инициализация (Това липсваше/не сработваше преди!)
    updateUI();

    // 2. Event Listener
    muteBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Спираме всякакви странични ефекти

        // Обръщаме стойността
        const newState = !state.isMuted;
        setIsMuted(newState);
        localStorage.setItem('scriptsensei_muted', newState);

        // Ако пускаме звука и в момента AI говори -> продължи говоренето
        if (!newState && state.isSpeakingNow) {
            resumeSpeaking(state.speechCharIndex);
        } else if (newState) {
            // Ако спираме звука -> млъкни веднага
            window.speechSynthesis.cancel();
        }

        updateUI();
    });
}

setTimeout(() => {
    checkPaymentStatus();
}, 2000);