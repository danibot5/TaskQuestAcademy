export const state = {
    currentUser: null,
    currentChatId: null,
    allChats: [],
    currentAttachments: [],
    isMuted: localStorage.getItem('scriptsensei_muted') === 'true',
    isSpeakingNow: false,
    speechCharIndex: 0,
    currentCleanText: ""
};

export function setCurrentUser(user) { state.currentUser = user; }
export function setCurrentChatId(id) { state.currentChatId = id; }
export function setAllChats(chats) { state.allChats = chats; }
export function setAttachments(files) { state.currentAttachments = files; }

export function setIsMuted(val) { state.isMuted = val; }
export function setIsSpeakingNow(val) { state.isSpeakingNow = val; }
export function setSpeechCharIndex(val) { state.speechCharIndex = val; }
export function setCurrentCleanText(val) { state.currentCleanText = val; }