export const state = {
    currentUser: null,
    hasPremiumAccess: false,
    currentChatId: null,
    allChats: [],
    currentAttachments: [],
    selectedModel: 'flash',
    isMuted: localStorage.getItem('scriptsensei_muted') === 'true',
    isSpeakingNow: false,
    speechCharIndex: 0,
    currentCleanText: ""
};

export function setCurrentUser(user) { state.currentUser = user; }
export function setPremiumStatus(value) { state.hasPremiumAccess = value; }
export function setCurrentChatId(id) { state.currentChatId = id; }
export function setAllChats(chats) { state.allChats = chats; }
export function setAttachments(files) { state.currentAttachments = files; }
export function setSelectedModel(val) { state.selectedModel = val; }

export function setIsMuted(val) { state.isMuted = val; }
export function setIsSpeakingNow(val) { state.isSpeakingNow = val; }
export function setSpeechCharIndex(val) { state.speechCharIndex = val; }
export function setCurrentCleanText(val) { state.currentCleanText = val; }