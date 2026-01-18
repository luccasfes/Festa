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

if (!currentRoomId) {
    document.body.style.overflow = 'hidden';
    document.body.innerHTML = `
        <div class="container" style="margin-top: 50px; text-align: center;">
            <div class="card" style="padding: 40px;">
                <h1><i class="fas fa-exclamation-triangle"></i> Erro: Sala não encontrada</h1>
                <p>Este link é inválido. (Ex: index.html?room=minha-sala-123)</p>
                <a href="create.html" class="btn primary">Criar Nova Sala</a>
            </div>
        </div>`;
    throw new Error("ID da Sala não fornecido.");
}

// Referências Globais do Firebase
const roomRef = database.ref('rooms/' + currentRoomId);
const videoQueueRef = roomRef.child('videoQueue');
const playerStateRef = roomRef.child('playerState');
const presenceRef = roomRef.child('presence');
const connectedRef = database.ref('.info/connected');
const chatMessagesRef = roomRef.child('chat/messages');
const chatTypingRef = roomRef.child('chat/typing');
let myPresenceRef = null;

// Variáveis de Estado Global
let onlineUserCount = 0;
let isPlayerReady = false;
let videoQueue = [];
let player;
let currentPlayerMode = null;
let isAdminLoggedIn = false;
let isBroadcaster = false;
let currentSessionUser = null;
let currentAdminUser = null;
let playedVideoHistory = new Set();
let syncInterval = null;

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
    });
}