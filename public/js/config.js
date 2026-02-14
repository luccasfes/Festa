// ====================================================================
// CONFIGURAÇÃO DO FIREBASE E VARIÁVEIS GLOBAIS 
// ====================================================================

const firebaseConfig = {
    apiKey: "AIzaSyCDlr4XHXuwWQ9Zj9dd2yoctLhFz1vbbyM",
    authDomain: "flowlink-7fd57.firebaseapp.com",
    databaseURL: "https://flowlink-7fd57-default-rtdb.firebaseio.com",
    projectId: "flowlink-7fd57",
    storageBucket: "flowlink-7fd57.firebasestorage.app",
    messagingSenderId: "1035085936175",
    appId: "1:1035085936175:web:2732042d77792118b8f8da",
    measurementId: "G-B0NE1GDVQK"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Verifica ID da sala
const urlParams = new URLSearchParams(window.location.search);
const currentRoomId = urlParams.get('room');

// Referências Globais (Sempre criadas como nulas para não dar erro de undefined)
let roomRef = null;
let videoQueueRef = null;
let playerStateRef = null;
let presenceRef = null;
let connectedRef = database.ref('.info/connected'); 
let chatMessagesRef = null;
let chatTypingRef = null;
let myPresenceRef = null;

// Se houver sala, preenche as referências
if (currentRoomId) {
    roomRef = database.ref('rooms/' + currentRoomId);
    videoQueueRef = roomRef.child('videoQueue');
    playerStateRef = roomRef.child('playerState');
    presenceRef = roomRef.child('presence');
    chatMessagesRef = roomRef.child('chat/messages');
    chatTypingRef = roomRef.child('chat/typing');
}

// Variáveis de Estado Global
let onlineUserCount = 0;
let isPlayerReady = false;
let videoQueue = [];
let player;
let isAdminLoggedIn = false;
let currentSessionUser = sessionStorage.getItem('ytSessionUser') || null;
let playedVideoHistory = new Set();

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
    });
}