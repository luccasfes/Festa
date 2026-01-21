// ====================================================================
// PLAYER DO YOUTUBE (VERSÃO FINAL: SINCRONIZADA E SEM CONFLITOS)
// ====================================================================

// Variáveis Globais de Controle
var syncInterval = null;
window.isBroadcaster = false; 
var currentPlayerMode = null; 
window.isAdminLoggedIn = false; 
window.currentVideoRef = null; 

let localResumeAlreadyUsed = false;

/**
 * 1. INICIALIZAÇÃO DINÂMICA
 * Decide se o player nasce com ou sem controles baseado no número de usuários.
 */
function onYouTubeIframeAPIReady() {
    window.currentPlayerMode = 'INICIANDO';

    // Se estiver sozinho ou for admin, nasce com controles (1). Caso contrário, bloqueado (0).
    const initialControls = (window.isAdminLoggedIn || typeof onlineUserCount === 'undefined' || onlineUserCount <= 1) ? 1 : 0;
    
    console.log(`🚀 Inicializando Player. Modo sugerido: ${initialControls === 1 ? 'SOLO' : 'FESTA'}`);

    player = new YT.Player('videoPlayer', {
        height: '100%',
        width: '100%',
        playerVars: {
            'autoplay': 1,
            'controls': initialControls, 
            'modestbranding': 1,
            'rel': 0,
            'disablekb': (initialControls === 0 ? 1 : 0),
            'enablejsapi': 1,
            'origin': window.location.origin // Resolve erros de postMessage no localhost
        },
        events: {
            onReady: (event) => {
                loadVideoQueue();
                player.setVolume(50);
                isPlayerReady = true;
                startSyncHeartbeat();
                // NOTA: O presence.js assumirá o controle daqui em diante.
            },
            onStateChange: onPlayerStateChange
        }
    });
}

/**
 * 2. MONITORAMENTO DE ESTADO
 * Gerencia o que acontece quando o vídeo dá play, pause ou acaba.
 */
function onPlayerStateChange(event) {
    // --- RESUME LOCAL (SÓ NO MODO SOLO) ---
    if (
        event.data === YT.PlayerState.PLAYING &&
        !localResumeAlreadyUsed &&
        (typeof onlineUserCount === 'undefined' || onlineUserCount <= 1)
    ) {
        const savedVideoId = localStorage.getItem('localPlayerVideoId');
        const savedTime = parseFloat(localStorage.getItem('localPlayerTime'));
        const lastSaveTime = parseInt(localStorage.getItem('localPlayerTimestamp') || '0');
        const now = Date.now();

        if (savedVideoId && !isNaN(savedTime) && (now - lastSaveTime < 3600000)) {
            const currentVideoId = player.getVideoData()?.video_id;
            if (currentVideoId === savedVideoId && savedTime > 5) {
                console.log(`🔄 RESUMINDO LOCAL EM ${savedTime}s`);
                localResumeAlreadyUsed = true;
                player.seekTo(savedTime, true);
                
                localStorage.removeItem('localPlayerTime');
                localStorage.removeItem('localPlayerVideoId');
                localStorage.removeItem('localPlayerTimestamp');
            }
        }
    }

    // --- FIM DO VÍDEO (PRÓXIMO DA FILA) ---
    if (event.data === YT.PlayerState.ENDED) {
        localStorage.removeItem('localPlayerTime');
        localStorage.removeItem('localPlayerVideoId');
        localStorage.removeItem('localPlayerTimestamp');

        if (typeof videoQueue !== 'undefined' && videoQueue.length > 0) {
            setTimeout(() => {
                if (typeof videoQueueRef !== 'undefined') {
                    videoQueueRef.child(videoQueue[0].id).remove().catch(err => console.error(err));
                }
            }, 500);
        }
    }

    // --- SINCRONIA MESTRE (ADMIN OU BROADCASTER ENVIA DADOS) ---
    if (window.isAdminLoggedIn || window.isBroadcaster) {
        let vidId = null;
        try { vidId = player.getVideoData().video_id; } catch (e) {}

        if (vidId && typeof playerStateRef !== 'undefined') {
            playerStateRef.update({ 
                state: event.data,
                videoId: vidId,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                videoTime: player.getCurrentTime(),
                status: event.data === YT.PlayerState.PLAYING ? 'playing' : 'paused'
            });
        }
    }
}

/**
 * 3. HEARTBEAT DE SINCRONIZAÇÃO
 * Envia o tempo atual do vídeo para o Firebase a cada 5 segundos.
 */
function startSyncHeartbeat() {
    if (typeof syncInterval !== 'undefined' && syncInterval) clearInterval(syncInterval);
    
    syncInterval = setInterval(() => {
        if (player && typeof player.getPlayerState === 'function' && player.getPlayerState() === YT.PlayerState.PLAYING) {
            
            const currentTime = player.getCurrentTime();
            let currentData = null;
            try { currentData = player.getVideoData(); } catch (e) {}
            
            if (currentData && currentData.video_id) {
                localStorage.setItem('localPlayerVideoId', currentData.video_id);
                localStorage.setItem('localPlayerTime', currentTime);
                localStorage.setItem('localPlayerTimestamp', Date.now());
            }

            if (window.isAdminLoggedIn || window.isBroadcaster) {
                if (typeof playerStateRef !== 'undefined') {
                    playerStateRef.update({
                        timestamp: firebase.database.ServerValue.TIMESTAMP,
                        videoTime: currentTime,
                        state: YT.PlayerState.PLAYING,
                        status: 'playing'
                    });
                }
                if (typeof updateRoomActivity === 'function') updateRoomActivity();
            }
        }
    }, 5000);
}

/**
 * 4. OUVINTE DE SINCRONIA (PARA VISITANTES)
 * Segue o tempo ditado pelo Admin/Broadcaster.
 */
let isSeeking = false;
if (typeof playerStateRef !== 'undefined') {
    playerStateRef.on('value', (snapshot) => {
        // Admin e Broadcaster nunca são controlados pelo Firebase
        if (window.isAdminLoggedIn || window.isBroadcaster) return;

        if (!player || typeof player.seekTo !== 'function') return;

        const state = snapshot.val();
        if (!state) return;

        const now = Date.now();
        let targetTime = state.videoTime;
        
        if (state.status === 'playing') {
            targetTime += (now - state.timestamp) / 1000;
        }

        const myTime = player.getCurrentTime();
        
        if (Math.abs(myTime - targetTime) > 2 && !isSeeking) {
            isSeeking = true;
            player.seekTo(targetTime, true);
            setTimeout(() => isSeeking = false, 1000);
        }

        if (state.status === 'playing' && player.getPlayerState() !== YT.PlayerState.PLAYING) {
            player.playVideo();
        } else if (state.status === 'paused' && player.getPlayerState() !== YT.PlayerState.PAUSED) {
            player.pauseVideo();
        }
    });
}

/**
 * 5. CONTROLES DO OVERLAY E INTERFACE
 */
document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('overlayPlayBtn');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (player) {
                const s = player.getPlayerState();
                s === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
            }
        });
    }

    const volInp = document.getElementById('overlayVolume');
    if (volInp) {
        volInp.addEventListener('input', (e) => {
            if (player) player.setVolume(e.target.value);
        });
    }

    const fsBtn = document.getElementById('overlayFullscreenBtn');
    if (fsBtn) {
        fsBtn.addEventListener('click', () => {
            const el = document.getElementById('player-container');
            document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
        });
    }

    if (typeof playerStateRef !== 'undefined') {
        window.currentVideoRef = playerStateRef; 
    }
});