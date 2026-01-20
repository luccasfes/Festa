// ====================================================================
// PLAYER DO YOUTUBE (CORRIGIDO: FILA + SEEK DE ADMIN + MÁSCARA AJUSTADA)
// ====================================================================

// Variáveis Globais de Controle do Player (INTEGRADAS COM PRESENCE.JS)
var syncInterval = null; // Resolve o erro "syncInterval is not defined"
window.isBroadcaster = false; // Valor padrão para evitar erro antes do presence.js carregar
var currentPlayerMode = null; // 'SOLO' ou 'FESTA'
window.isAdminLoggedIn = false; // Valor padrão
window.currentVideoRef = null; // Será definido como playerStateRef para compatibilidade

let localResumeAlreadyUsed = false;

function onYouTubeIframeAPIReady() {
    window.currentPlayerMode = 'INICIANDO';
    player = new YT.Player('videoPlayer', {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            disablekb: 1
        },
        events: {
            onReady: (event) => {
                loadVideoQueue();
                player.setVolume(50);
                isPlayerReady = true;
                startSyncHeartbeat();
                setTimeout(updatePlayerMode, 1000); // Delay inicial
            },
            onStateChange: onPlayerStateChange
        }
    });
}

function updatePlayerMode() {
    if (!isPlayerReady) return;
    
    // REGRA DE OURO: Se é Admin, TEM que ter controle total (Modo Solo/Nativo)
    // Isso libera a barra de seek e remove a máscara
    if (window.isAdminLoggedIn === true) {
        enableSoloPlayerControls();
        return;
    }

    // Se não é admin, mas está sozinho, também libera (máscara escondida)
    if (onlineUserCount <= 1) {
        enableSoloPlayerControls();
    } else {
        // Se tem mais gente e não é admin, bloqueia (Modo Festa - máscara visível)
        disableSoloPlayerControls();
    }
}

function enableSoloPlayerControls() {
    // Se já estiver no modo SOLO, apenas garante que a UI está certa
    if (currentPlayerMode === 'SOLO') {
        document.getElementById('player-mask').style.display = 'none'; // Máscara escondida no Solo
        const ov = document.querySelector('.player-overlay-controls');
        if (ov) ov.style.display = 'none';
        return;
    }
    
    console.log("Ativando Controles Nativos (Admin/Solo) - Máscara Escondida...");
    
    // 1. Esconde a máscara transparente que bloqueia o clique (CRUCIAL para Solo)
    const mask = document.getElementById('player-mask');
    if (mask) mask.style.display = 'none';

    // 2. Esconde os controles customizados (botão play azul)
    const ov = document.querySelector('.player-overlay-controls');
    if (ov) ov.style.display = 'none';

    // 3. Recria o player com controls: 1 (Barra vermelha do YouTube)
    recreatePlayer(1);
    currentPlayerMode = 'SOLO';
    
    // Atualiza a interface da fila
    if (typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
}

function disableSoloPlayerControls() {
    if (currentPlayerMode === 'FESTA') return;
    
    console.log("Ativando Modo Festa (Bloqueado) - Máscara Visível...");

    // 1. Mostra a máscara para bloquear cliques (CRUCIAL para Festa)
    const mask = document.getElementById('player-mask');
    if (mask) mask.style.display = 'block';

    // 2. Mostra os controles customizados
    const ov = document.querySelector('.player-overlay-controls');
    if (ov) ov.style.display = 'flex';

    // 3. Recria o player sem controles nativos
    recreatePlayer(0);
    currentPlayerMode = 'FESTA';

    if (typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
}

function recreatePlayer(controlsValue) {
    let savedTime = 0;
    let currentVideoId = null;

    // Tenta salvar o estado atual antes de destruir
    try {
        if (player && typeof player.getCurrentTime === 'function') {
            savedTime = player.getCurrentTime();
        }
        // Tenta pegar o ID do vídeo atual da fila ou do player
        if (videoQueue && videoQueue.length > 0) {
            currentVideoId = extractVideoId(videoQueue[0].videoUrl);
        } else if (player && typeof player.getVideoData === 'function' && player.getVideoData()) {
            currentVideoId = player.getVideoData().video_id;
        }
    } catch (e) {}

    // Destrói o player antigo
    if (player && typeof player.destroy === 'function') {
        player.destroy();
    }

    // Configuração segura
    let playerConfig = {
        height: '100%',
        width: '100%',
        playerVars: {
            'autoplay': 1,
            'controls': controlsValue, // 1 = Com Seek (Admin/Solo), 0 = Sem Seek (Festa)
            'modestbranding': 1,
            'rel': 0,
            'disablekb': 1,
            'fs': 1, // Permite fullscreen nativo
            'start': Math.floor(savedTime)
        },
        events: {
            'onReady': (e) => {
                if (savedTime > 0) e.target.seekTo(savedTime, true);
                // Só dá play se tiver vídeo válido
                if (currentVideoId) e.target.playVideo();
            },
            'onStateChange': onPlayerStateChange
        }
    };

    // Só define o ID se existir vídeo (Correção do erro de travamento)
    if (currentVideoId) {
        playerConfig.videoId = currentVideoId;
    }

    player = new YT.Player('videoPlayer', playerConfig);
}

function onPlayerStateChange(event) {
    // =========================================================
    // 🔁 RESUME LOCAL APÓS F5 (SÓ SE ESTIVER SOZINHO NA SALA)
    // =========================================================
    if (
        event.data === YT.PlayerState.PLAYING &&
        !localResumeAlreadyUsed &&
        (typeof onlineUserCount === 'undefined' || onlineUserCount <= 1)
    ) {
        const savedVideoId = localStorage.getItem('localPlayerVideoId');
        const savedTime = parseFloat(localStorage.getItem('localPlayerTime'));
        const lastSaveTime = parseInt(localStorage.getItem('localPlayerTimestamp') || '0');
        const now = Date.now();

        if (
            savedVideoId &&
            !isNaN(savedTime) &&
            (now - lastSaveTime < 3600000) // Validade de 1 hora
        ) {
            const currentVideoId = player.getVideoData()?.video_id;

            // Só resume se for o mesmo vídeo e tiver passado de 5 segundos
            if (currentVideoId === savedVideoId && savedTime > 5) {
                console.log(`🔄 RESUMINDO LOCAL EM ${savedTime}s`);

                localResumeAlreadyUsed = true; // 🔒 trava pra nunca mais rodar nesta sessão
                player.seekTo(savedTime, true);

                // Limpa pra não usar de novo
                localStorage.removeItem('localPlayerTime');
                localStorage.removeItem('localPlayerVideoId');
                localStorage.removeItem('localPlayerTimestamp');
            }
        }
    }

    // =========================================================
    // ⏹️ SE ACABOU O VÍDEO
    // =========================================================
    if (event.data === YT.PlayerState.ENDED) {
        // Limpa qualquer resume pendente
        localStorage.removeItem('localPlayerTime');
        localStorage.removeItem('localPlayerVideoId');
        localStorage.removeItem('localPlayerTimestamp');

        if (typeof videoQueue !== 'undefined' && videoQueue.length > 0) {
            // Pequeno delay pra garantir que o vídeo acabou visualmente
            setTimeout(() => {
                // CORREÇÃO: Garante que videoQueueRef existe
                if (typeof videoQueueRef !== 'undefined') {
                    // Remove o primeiro da fila
                    videoQueueRef.child(videoQueue[0].id).remove().catch(err => console.error(err));
                }
            }, 500);
        }
    }

    // =========================================================
    // 🔥 SINCRONIA COM FIREBASE (ADMIN/BROADCASTER É O MESTRE)
    // =========================================================
    if (window.isAdminLoggedIn || window.isBroadcaster) {
        const status = event.data === YT.PlayerState.PLAYING ? 'playing' : 'paused';
        let vidId = null;
        try { vidId = player.getVideoData().video_id; } catch (e) {}

        if (vidId && typeof playerStateRef !== 'undefined') {
            playerStateRef.update({ // Usando playerStateRef como no exemplo
                state: event.data,
                videoId: vidId,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                videoTime: player.getCurrentTime()
            });
        }
    }
}

function startSyncHeartbeat() {
    // Limpa intervalo anterior se existir
    if (typeof syncInterval !== 'undefined' && syncInterval) clearInterval(syncInterval);
    
    syncInterval = setInterval(() => {
        // Verifica se o player existe e está tocando
        if (player && typeof player.getPlayerState === 'function' && player.getPlayerState() === YT.PlayerState.PLAYING) {
            
            const currentTime = player.getCurrentTime();
            let currentData = null;
            try { currentData = player.getVideoData(); } catch (e) {}
            
            // --- SALVAMENTO LOCAL (Para sobreviver ao F5) ---
            if (currentData && currentData.video_id) {
                localStorage.setItem('localPlayerVideoId', currentData.video_id);
                localStorage.setItem('localPlayerTime', currentTime);
                localStorage.setItem('localPlayerTimestamp', Date.now());
            }

            // --- SINCRONIA COM FIREBASE (Apenas Admin ou Broadcaster) ---
            if (window.isAdminLoggedIn || window.isBroadcaster) {
                
                // Verifica se playerStateRef foi definido
                if (typeof playerStateRef !== 'undefined') {
                    playerStateRef.update({
                        timestamp: firebase.database.ServerValue.TIMESTAMP,
                        videoTime: currentTime,
                        state: YT.PlayerState.PLAYING
                    });
                }

                // Atualiza atividade da sala (se a função existir)
                if (typeof updateRoomActivity === 'function') updateRoomActivity();
            }
        }
    }, 5000); // Executa a cada 5 segundos
}

let isSeeking = false;

// OUVINTE: Usuários comuns ouvem isso. Admin IGNORA isso (para poder controlar o seek).
// (MOVIDO PARA O FINAL PARA GARANTIR QUE playerStateRef ESTEJA DEFINIDO)
if (typeof playerStateRef !== 'undefined') {
    playerStateRef.on('value', (snapshot) => {
        // SE FOR ADMIN, RETORNA IMEDIATAMENTE.
        if (window.isAdminLoggedIn || window.isBroadcaster) return;

        if (!player || typeof player.seekTo !== 'function') return;

        const state = snapshot.val();
        if (!state) return;

        const now = Date.now();
        let targetTime = state.videoTime;
        
        // Compensa o delay da rede
        if (state.status === 'playing') {
            targetTime += (now - state.timestamp) / 1000;
        }

        const myTime = player.getCurrentTime();
        
        // Só ajusta se a diferença for maior que 2 segundos (evita "pulos" constantes)
        if (Math.abs(myTime - targetTime) > 2 && !isSeeking) {
            isSeeking = true;
            player.seekTo(targetTime, true);
            setTimeout(() => isSeeking = false, 1000);
        }

        // Sincroniza Play/Pause
        if (state.status === 'playing' && player.getPlayerState() !== YT.PlayerState.PLAYING) {
            player.playVideo();
        } else if (state.status === 'paused' && player.getPlayerState() !== YT.PlayerState.PAUSED) {
            player.pauseVideo();
        }
    });
}

// Controles do Overlay (apenas para modo Festa/Visitante)
if (document.getElementById('overlayPlayBtn')) {
    document.getElementById('overlayPlayBtn').addEventListener('click', () => {
        if (player) player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
    });
}
if (document.getElementById('overlayVolume')) {
    document.getElementById('overlayVolume').addEventListener('input', (e) => {
        if (player) player.setVolume(e.target.value);
    });
}
if (document.getElementById('overlayFullscreenBtn')) {
    document.getElementById('overlayFullscreenBtn').addEventListener('click', () => {
        const el = document.getElementById('player-container');
        document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
    });
}

// INICIALIZAÇÃO: Define currentVideoRef para compatibilidade
document.addEventListener('DOMContentLoaded', () => {
    if (typeof playerStateRef !== 'undefined') {
        window.currentVideoRef = playerStateRef; // Compatibilidade com código antigo
    }
});