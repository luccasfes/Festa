// ====================================================================
// PRESENÇA, CONTROLE DE MODO E VISIBILIDADE (CORRIGIDO v2.7 - USANDO CONTADOR DA VERSÃO FUNCIONANDO)
// ====================================================================

// --- Variáveis Globais de Estado ---
window.currentVideoState = null;
window.broadcasterId = null;
window.myUserId = null;
window.roomId = null;

// NOVO: Definições globais para compatibilidade com player.js
window.isBroadcaster = false; // Será atualizada dinamicamente
window.syncInterval = null;   // Para sincronização de tempo

// VARIÁVEL CHAVE: Impede que o player recarregue se o modo não mudar
let lastAppliedMode = null; // Valores possíveis: 'ADMIN', 'SOLO', 'FESTA'

// --- 1. Lógica Central de Decisão (O CÉREBRO) ---
function determineAndApplyPlayerMode() {
    let targetMode = '';

    // 1. Define qual deveria ser o modo atual
    if (window.isAdminLoggedIn === true) {
        targetMode = 'ADMIN';
    } else if (onlineUserCount <= 1) {
        targetMode = 'SOLO';
    } else {
        targetMode = 'FESTA';
    }

    // 2. Atualiza botões (sempre necessário pois contagens de voto mudam)
    if (typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();

    // 3. O PULO DO GATO: Se o modo é o mesmo, NÃO MEXE NO PLAYER
    if (targetMode === lastAppliedMode) {
        // console.log(`Manter modo: ${targetMode} (Nova entrada ignorada pelo player)`);
        return; 
    }

    console.log(`🔄 Mudança de Modo Detectada: ${lastAppliedMode || 'Início'} -> ${targetMode}`);
    lastAppliedMode = targetMode; // Salva o novo modo

    // 4. Aplica as classes CSS no Body
    if (targetMode === 'FESTA') {
        document.body.classList.add('festa-mode');
        document.body.classList.remove('solo-mode');
    } else {
        // Tanto Admin quanto Solo usam estilo "livre"
        document.body.classList.add('solo-mode');
        document.body.classList.remove('festa-mode');
    }

    // 5. Executa a troca de Player apropriada
    if (targetMode === 'ADMIN') {
        forceAdminPlayer(); 
    } else if (targetMode === 'SOLO') {
        forceSoloPlayer();
    } else if (targetMode === 'FESTA') {
        forceNormalPlayer();
    }
}

// --- 2. Listeners do Firebase (Presença, Conexão e Estado do Vídeo) ---

// NOVO: Inicialize currentVideoRef (assumindo Firebase configurado)
if (typeof firebase !== 'undefined' && window.roomId) {
    window.currentVideoRef = firebase.database().ref('rooms/' + window.roomId + '/currentVideo');
}

// NOVO: Listener para o estado global do vídeo (para sincronização)
if (typeof currentVideoRef !== 'undefined') {
    currentVideoRef.on('value', (snap) => {
        window.currentVideoState = snap.val(); // Ex.: { videoId: 'abc123', currentTime: 45, state: 1 }
    });
}

// Monitora Entradas e Saídas (USANDO A VERSÃO FUNCIONANDO DA SUA MENSAGEM)
if (typeof presenceRef !== 'undefined') {
    presenceRef.on('value', (snap) => {
        console.log('🔍 DEBUG: Listener de presenceRef executado!');
        
        const oldCount = onlineUserCount;
        onlineUserCount = snap.numChildren();
        
        console.log(`🔍 DEBUG: Contador atualizado: ${oldCount} -> ${onlineUserCount}`);

        // Atualiza UI de contagem
        const userCountEl = document.getElementById('userCount');
        if (userCountEl) {
            userCountEl.textContent = onlineUserCount;
            console.log(`🔍 DEBUG: UI atualizada para ${onlineUserCount}`);
        }
        const onlineCountEl = document.getElementById('onlineCount');
        if (onlineCountEl) onlineCountEl.textContent = onlineUserCount;

        // Determina Broadcaster (O mais antigo na sala)
        const users = snap.val();
        if (users && onlineUserCount > 0) {
            const userIds = Object.keys(users);
            window.broadcasterId = userIds[0]; 
            
            if (window.myPresenceRef && window.myPresenceRef.key) {
                window.myUserId = window.myPresenceRef.key;
            }

            // NOVO: Atualiza isBroadcaster
            window.isBroadcaster = (window.myUserId === window.broadcasterId);
            console.log(`🔍 DEBUG: Broadcaster definido: ${window.broadcasterId}, Eu sou: ${window.isBroadcaster}`);
        }

        // Atualiza meta de votos
        if (typeof updateVotesNeeded === 'function') updateVotesNeeded();

        // CHAMA O CÉREBRO para decidir o que fazer
        determineAndApplyPlayerMode();
    });
}

// Monitora Estado da Conexão (.info/connected)
if (typeof connectedRef !== 'undefined') {
    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            let userName = sessionStorage.getItem('ytSessionUser') || 'Visitante';
            if (window.myPresenceRef) window.myPresenceRef.remove();
            
            window.myPresenceRef = presenceRef.push();
            window.myPresenceRef.onDisconnect().remove();
            
            window.myPresenceRef.set({
                name: userName,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                if (window.roomRef) window.roomRef.child('emptySince').remove().catch(() => {});
            }).catch(() => {}); 
        }
    });
}

// Monitora Dados da Sala (Nome, etc)
if (typeof roomRef !== 'undefined') {
    roomRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const rn = document.getElementById('roomNameDisplay');
            const rc = document.getElementById('roomCreatorDisplay');
            if (rn) rn.textContent = data.roomName || 'Sala';
            if (rc) rc.textContent = data.creatorName || 'Desconhecido';
        }
    });
}

// --- 3. O VIGIA (Admin Login/Logout) ---
document.addEventListener('DOMContentLoaded', () => {
    const adminBtn = document.getElementById('adminUnlockBtn');
    
    const aplicarEstadoAdmin = (isLogado) => {
        window.isAdminLoggedIn = isLogado;
        // Chama a lógica central para atualizar tudo
        determineAndApplyPlayerMode();
        // Atualiza a fila visualmente (checkboxes)
        if (typeof renderQueue === 'function') renderQueue();
    };

    if (adminBtn) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    if (adminBtn.classList.contains('admin-logged-in')) {
                        console.log("🔑 Login Admin detectado.");
                        aplicarEstadoAdmin(true);
                    } else {
                        console.log("🔒 Logout Admin detectado.");
                        aplicarEstadoAdmin(false);
                    }
                }
            });
        });
        observer.observe(adminBtn, { attributes: true });

        // Verificação Inicial (caso já carregue logado)
        setTimeout(() => {
            if (adminBtn.classList.contains('admin-logged-in') || window.isAdminLoggedIn) {
                aplicarEstadoAdmin(true);
            }
        }, 1000);
    }
});

// --- 4. Visibilidade dos Botões ---
function updateAdminButtonsVisibility() {
    const souAdmin = (window.isAdminLoggedIn === true);
    const estouSozinho = (onlineUserCount <= 1);
    // Modo Festa é quando não sou admin E tem mais gente na sala
    const emModoFesta = (!souAdmin && !estouSozinho);

    // --- CONTROLE DO OVERLAY E MÁSCARA ---
    const mask = document.getElementById('player-mask');
    const overlay = document.querySelector('.player-overlay-controls');
    
    if (mask) mask.style.display = emModoFesta ? 'block' : 'none';
    if (overlay) overlay.style.display = emModoFesta ? 'flex' : 'none';

    // --- CONTROLE DE BOTÕES DE ADMIN ---
    const elementsToShowAdminOnly = ['#bulkRemoveBtn', '#clearChatBtn', '#panelBtn'];
    elementsToShowAdminOnly.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.style.display = souAdmin ? 'inline-flex' : 'none';
    });

    const elementsToShowAdminOrSolo = ['#btn-auto-sugestao', '.clear-queue-button'];
    elementsToShowAdminOrSolo.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.style.display = (souAdmin || estouSozinho) ? 'inline-flex' : 'none';
    });

    // Texto do botão de Pular (Diferencia Solo de Festa)
    const skipText = document.getElementById('skipVoteBtnText');
    const skipBtn = document.getElementById('skipVoteBtn');
    if (skipText && skipBtn) {
        if (souAdmin) {
            skipText.textContent = 'Pular (Admin)';
        } else if (estouSozinho) {
            skipText.textContent = 'Pular (Solo)';
        } else {
            skipText.textContent = skipBtn.classList.contains('voted') ? 'Voto Registrado' : 'Votar para Pular';
        }
    }
}

// --- 5. Funções de Forçar Player (ADMIN, SOLO, FESTA) ---

// MODIFICADO: Helper para pegar vídeo atual (prioriza estado global para sincronização)
function getCurrentVideoIdAndState() {
    // NOVO: Prioriza estado global (do broadcaster) para sincronização de novos usuários
    if (window.currentVideoState && window.currentVideoState.videoId) {
        return {
            videoId: window.currentVideoState.videoId,
            currentTime: window.currentVideoState.currentTime || 0
        };
    }

    // Fallback: Tenta pegar do player local
    let vidId = null;
    let time = 0;
    if (typeof player !== 'undefined' && player && typeof player.getVideoData === 'function') {
        try {
            vidId = player.getVideoData().video_id;
            time = player.getCurrentTime();
        } catch (e) {}
    }

    // Se falhar, tenta pegar da fila
    if (!vidId && typeof videoQueue !== 'undefined' && videoQueue.length > 0) {
        try {
            let url = videoQueue[0].videoUrl;
            let match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/)([^#&?]*))/);
            if (match) vidId = match[1];
        } catch (e) {}
    }
    return { videoId: vidId, currentTime: time };
}

function forceAdminPlayer() {
    if (!window.isAdminLoggedIn) return;
    console.log("👑 Ativando Player ADMIN (Com Controles)");
    recreatePlayerSafe(1); // 1 = Com controles
}

function forceSoloPlayer() {
    if (window.isAdminLoggedIn || onlineUserCount > 1) return;
    console.log("👤 Ativando Player SOLO (Com Controles - Liberado como Admin)");
    recreatePlayerSafe(1); // 1 = Com controles (já garante liberação)
}

function forceNormalPlayer() {
    if (window.isAdminLoggedIn || onlineUserCount <= 1) return;
    console.log("🎉 Ativando Player FESTA (Sem Controles - Sincronizado)");
    recreatePlayerSafe(0); // 0 = Sem controles
}

// Função unificada para recriar o player
function recreatePlayerSafe(controlsValue) {
    const data = getCurrentVideoIdAndState();
    
    // 1. Atualiza o Estado Global
    window.currentPlayerMode = (controlsValue === 1) ? 'SOLO' : 'FESTA';

    // 2. Tenta encontrar os elementos visuais
    const mask = document.getElementById('player-mask');
    const overlay = document.querySelector('.player-overlay-controls');
    
    // 3. Aplica a visibilidade (isso garante que apareçam/sumam)
    if (mask) {
        mask.style.display = (controlsValue === 0) ? 'block' : 'none'; 
        if (controlsValue === 0) {
            mask.style.zIndex = "10"; // Garante que fique na frente do vídeo
        }
    }

    if (overlay) {
        overlay.style.display = (controlsValue === 0) ? 'flex' : 'none';
        overlay.style.zIndex = "11"; // Garante que os botões fiquem clicáveis
    }

    if (typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();

    // 4. Proteção contra fila vazia
    if (!data.videoId) {
        console.warn("⚠️ UI atualizada para " + window.currentPlayerMode + ", mas player não recriado: Sem vídeo.");
        return;
    }

    // 5. RECONSTRUÇÃO SEGURA (O PONTO CHAVE)
    const oldPlayerDiv = document.getElementById('videoPlayer');
    if (oldPlayerDiv) {
        // Em vez de limpar o container.innerHTML, criamos um novo elemento e substituímos o antigo
        const newPlayerDiv = document.createElement('div');
        newPlayerDiv.id = 'videoPlayer';
        oldPlayerDiv.replaceWith(newPlayerDiv);
    }

    // 6. Recria o Player do YouTube
    setTimeout(() => {
        if (typeof YT === 'undefined' || !YT.Player) return;
        
        console.log(`🎬 [${window.currentPlayerMode}] Renderizando vídeo: ${data.videoId}`);

        player = new YT.Player('videoPlayer', {
            height: '100%',
            width: '100%',
            videoId: data.videoId,
            playerVars: {
                'autoplay': 1,
                'controls': controlsValue,
                'disablekb': (controlsValue === 0) ? 1 : 0,
                'fs': 1,
                'modestbranding': 1,
                'rel': 0,
                'start': Math.max(0, Math.floor(data.currentTime))
            },
            events: {
                'onReady': (event) => {
                    event.target.playVideo();
                    if (controlsValue === 0) {
                        const iframe = event.target.getIframe();
                        if (iframe) iframe.style.pointerEvents = 'none';
                    }
                },
                'onStateChange': (event) => {
                    if (typeof onPlayerStateChange === 'function') onPlayerStateChange(event);
                }
            }
        });
    }, 150);
}

function updateRoomActivity() {
    if (window.isAdminLoggedIn && window.roomRef) {
        window.roomRef.update({ lastActivity: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
    }
}

// FORÇA ATUALIZAÇÃO INICIAL DO CONTADOR (DEBUG)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        console.log(`🔍 DEBUG: Contador inicial: ${onlineUserCount}`);
        if (typeof presenceRef !== 'undefined') {
            presenceRef.once('value', (snap) => {
                onlineUserCount = snap.numChildren();
                console.log(`🔍 DEBUG: Contador forçado para ${onlineUserCount}`);
                determineAndApplyPlayerMode();
            });
        }
    }, 2000); // Delay para garantir que Firebase esteja carregado
});