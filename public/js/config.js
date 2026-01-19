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
// Verifica ID da sala
const urlParams = new URLSearchParams(window.location.search);
const currentRoomId = urlParams.get('room');

// SE NÃO TIVER SALA: MOSTRA A TELA INICIAL (LANDING PAGE)
if (!currentRoomId) {
    // Aplica o estilo de fundo animado do CSS
    document.body.className = 'theme-transition'; 

// Reset e centralização inteligente
document.body.style.display = 'flex';
document.body.style.alignItems = 'center';
document.body.style.justifyContent = 'center';
document.body.style.minHeight = '100vh';
document.body.style.margin = '0';
document.body.style.overflowX = 'hidden';

document.body.innerHTML = `
    <div class="bg-decoration">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
    </div>

    <div class="container landing-wrapper">
        <header class="landing-header">
            <div class="logo-area">
                <h1>FlowLink</h1>
            </div>
            <p>Sincronize sua vibe, amplifique a festa.</p>
        </header>

        <main class="glass-card main-panel">
            <div class="panel-side-info">
                <div class="icon-pulse">
                    <i class="fas fa-rocket"></i>
                </div>
                <h2>Pronto para o Play?</h2>
                <p>Assista vídeos do YouTube em tempo real com seus amigos. Crie sua sala e controle a playlist de qualquer lugar.</p>
                <div class="features-list">
                    <span><i class="fas fa-check"></i> Sync Global</span>
                    <span><i class="fas fa-check"></i> Chat Integrado</span>
                    <span><i class="fas fa-check"></i> DJ inteligente</span>
                </div>
            </div>

            <div class="panel-actions">
                <div class="mobile-only-header">
                     <i class="fas fa-rocket"></i>
                     <h2>Pronto para o Play?</h2>
                </div>

                <a href="create.html" class="btn action-btn primary-glow">
                    <i class="fas fa-plus-circle"></i> Criar Nova Sala
                </a>

                <div class="fancy-divider">
                    <span>ou acesse via código</span>
                </div>

                <div class="join-input-group">
                    <input type="text" id="joinRoomInput" placeholder="Código da sala...">
                    <button class="btn enter-btn" onclick="irParaSala()">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
                
                <p class="terms-disclaimer">Ao criar uma sala, você concorda com as diretrizes da comunidade.</p>
            </div>
        </main>

        <footer class="enhanced-footer">
            <div class="footer-content">
                <div class="footer-brand">
                    <i class="fas fa-music"></i> <span>FlowLink</span>
                </div>
                <div class="footer-links">
                    <a href="#"><i class="fas fa-shield-alt"></i> Privado</a>
                </div>
                
            </div>
        </footer>
    </div>

    <style>
        /* === ANIMAÇÕES DE FUNDO === */
        .bg-decoration {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            z-index: -1;
            overflow: hidden;
            pointer-events: none;
        }

        .shape {
            position: absolute;
            background: var(--accent-color);
            opacity: 0.1;
            filter: blur(50px);
            border-radius: 50%;
            animation: floatShape 15s infinite alternate ease-in-out;
        }

        .shape-1 { width: 400px; height: 400px; top: -100px; right: -50px; }
        .shape-2 { width: 300px; height: 300px; bottom: -50px; left: -50px; animation-delay: -5s; opacity: 0.05; }
        .shape-3 { width: 150px; height: 150px; top: 40%; left: 30%; animation-delay: -2s; background: #fff; }

        @keyframes floatShape {
            0% { transform: translate(0, 0) rotate(0deg); }
            100% { transform: translate(50px, 100px) rotate(30deg); }
        }

        /* === ESTRUTURA RESPONSIVA (RETANGULAR NO PC / VERTICAL NO CELULAR) === */
        .landing-wrapper {
            width: 95%;
            max-width: 900px; /* Mais largo para o PC */
            animation: modalFadeIn 1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .main-panel {
            display: flex;
            flex-direction: row; /* Retangular no PC */
            padding: 0;
            overflow: hidden;
            min-height: 420px;
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 30px;
        }

        /* Lateral com Info (SÓ PC) */
        .panel-side-info {
            flex: 1.2;
            padding: 50px;
            background: rgba(255, 255, 255, 0.03);
            text-align: left;
            display: flex;
            flex-direction: column;
            justify-content: center;
            border-right: 1px solid rgba(255, 255, 255, 0.05);
        }

        .panel-actions {
            flex: 1;
            padding: 50px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 20px;
        }

        .mobile-only-header { display: none; }

        /* Ajuste para Celular */
        @media (max-width: 768px) {
            .main-panel {
                flex-direction: column; /* Vertical no Celular */
                max-width: 400px;
                margin: 0 auto;
            }
            .panel-side-info { display: none; } /* Esconde o lado do banner no celular */
            .panel-actions { padding: 40px 25px; }
            .mobile-only-header { 
                display: block; 
                text-align: center; 
                margin-bottom: 20px;
            }
            .mobile-only-header i { font-size: 2.5rem; color: var(--accent-color); margin-bottom: 10px;}
            .mobile-only-header h2 { font-size: 1.6rem; color: #fff; margin: 0; }
        }

        /* === ESTILOS VISUAIS === */
        .landing-header { text-align: center; margin-bottom: 30px; }
        .logo-area { display: inline-flex; align-items: center; gap: 10px; position: relative; }
        .logo-area h1 { font-size: 3.2rem; font-weight: 800; background: linear-gradient(to right, #fff, var(--accent-color)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
        .v-tag { background: var(--accent-color); color: #000; padding: 2px 8px; border-radius: 8px; font-weight: bold; font-size: 0.8rem; }

        .icon-pulse {
            width: 60px; height: 60px; background: rgba(99, 102, 241, 0.1); border-radius: 15px;
            display: flex; align-items: center; justify-content: center; margin-bottom: 25px;
            font-size: 1.8rem; color: var(--accent-color); border: 1px solid rgba(255,255,255,0.1);
        }

        .panel-side-info h2 { color: #fff; margin-bottom: 15px; font-size: 1.8rem; }
        .panel-side-info p { color: #94a3b8; line-height: 1.6; margin-bottom: 20px; }
        .features-list { display: flex; gap: 15px; color: var(--accent-color); font-size: 0.85rem; font-weight: 600; }

        .action-btn { 
            padding: 18px !important; border-radius: 18px !important; font-size: 1.1rem !important; 
            font-weight: 700 !important; transition: 0.4s !important;
            display: flex; align-items: center; justify-content: center; text-decoration: none;
        }
        .primary-glow { background: var(--accent-color) !important; color: #000 !important; box-shadow: 0 10px 30px -10px var(--accent-color) !important; }
        .primary-glow:hover { transform: scale(1.02); opacity: 0.9; }

        .fancy-divider { display: flex; align-items: center; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; }
        .fancy-divider::before, .fancy-divider::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.05); }
        .fancy-divider span { padding: 0 15px; }

        .join-input-group {
            display: flex; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);
        }
        .join-input-group input { flex: 1; background: transparent; border: none; color: #fff; padding: 10px 15px; outline: none; }
        .enter-btn { width: 45px !important; height: 45px !important; border-radius: 15px !important; display: flex; align-items: center; justify-content: center; padding: 0 !important; }

        .terms-disclaimer { font-size: 0.7rem; color: #475569; text-align: center; margin: 0; }

        /* === FOOTER MELHORADO === */
        .enhanced-footer { margin-top: 40px; padding: 20px; border-top: 1px solid rgba(255,255,255,0.05); }
        .footer-content { display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .footer-brand { color: #fff; opacity: 0.8; display: flex; align-items: center; gap: 8px; font-weight: 600; }
        .footer-links { display: flex; gap: 20px; }
        .footer-links a { color: #64748b; text-decoration: none; font-size: 0.85rem; transition: 0.3s; }
        .footer-links a:hover { color: var(--accent-color); }
        .footer-copy { color: #475569; font-size: 0.75rem; }

        @keyframes modalFadeIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
`;
    
    // Interrompe o carregamento do resto do script da sala
    throw new Error("Modo Introdução: Nenhuma sala selecionada (Comportamento Esperado).");
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