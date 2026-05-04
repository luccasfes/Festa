// ====================================================================
// PLAYER DO YOUTUBE (VERSÃO FINAL: SINCRONIZADA E SEM CONFLITOS - v2)
// ====================================================================

// Variáveis Globais de Controle
var syncInterval = null;
window.isBroadcaster = false; 
var currentPlayerMode = null; 
window.isAdminLoggedIn = false; 
window.currentVideoRef = null; 
window.hasAdminOnline = false;

let localResumeAlreadyUsed = false;

// ====================================================================
// NOVOS HELPERS DE TEMPO E SINCRONIZAÇÃO
// ====================================================================
var isSeeking = false;
window.latestPlayerState = null;
window.firebaseServerOffset = 0;

if (typeof firebase !== 'undefined' && firebase.database) {
    firebase.database().ref('.info/serverTimeOffset').on('value', (snap) => {
        window.firebaseServerOffset = snap.val() || 0;
    });
}

function serverNow() {
    return Date.now() + (window.firebaseServerOffset || 0);
}

function amISyncMaster() {
    return window.isAdminLoggedIn === true || 
           (window.isBroadcaster === true && window.hasAdminOnline !== true);
}

function remoteIsPlaying(state) {
    return state && (state.status === 'playing' || state.state === 1);
}

function remoteIsPaused(state) {
    return state && (state.status === 'paused' || state.state === 2);
}

function remoteIsEnded(state) {
    return state && (state.status === 'ended' || state.state === 0);
}

function getStateVideoTime(state) {
    if (!state) return 0;

    const base = Number(state.videoTime ?? state.currentTime ?? 0);
    if (!Number.isFinite(base)) return 0;

    if (remoteIsPlaying(state) && typeof state.timestamp === 'number') {
        return Math.max(0, base + ((serverNow() - state.timestamp) / 1000));
    }

    return Math.max(0, base);
}

function applyRemoteState(state, origin = '') {
    if (!state) return;
    if (amISyncMaster()) return;
    if (typeof player === 'undefined' || !player || typeof player.getVideoData !== 'function') return;
    if (!state.videoId) return;
    if (remoteIsEnded(state)) return;

    const wantsPlay = remoteIsPlaying(state);
    const wantsPause = remoteIsPaused(state);

    let targetTime = getStateVideoTime(state);

    const duration = player.getDuration ? player.getDuration() : 0;

    // Evita seguidor cair no fim e disparar ENDED local
    if (duration && targetTime > duration - 2) {
        targetTime = Math.max(0, duration - 2);
    }

    let currentVideoId = null;
    try {
        currentVideoId = player.getVideoData()?.video_id || null;
    } catch (e) {}

    // Se o visitante ainda não carregou o vídeo certo, carrega já no tempo certo
    if (currentVideoId !== state.videoId) {
        isSeeking = true;

        player.loadVideoById({
            videoId: state.videoId,
            startSeconds: Math.floor(targetTime)
        });

        setTimeout(() => {
            try {
                player.seekTo(targetTime, true);
                if (wantsPause) player.pauseVideo();
                if (wantsPlay) player.playVideo();
            } catch (e) {}

            isSeeking = false;
        }, 900);

        return;
    }

    const myTime = player.getCurrentTime ? player.getCurrentTime() : 0;

    if (Math.abs(myTime - targetTime) > 1.5 && !isSeeking) {
        isSeeking = true;
        player.seekTo(targetTime, true);

        setTimeout(() => {
            isSeeking = false;
            if (wantsPause) player.pauseVideo();
            if (wantsPlay) player.playVideo();
        }, 700);
    } else {
        if (wantsPause && player.getPlayerState() !== YT.PlayerState.PAUSED) {
            player.pauseVideo();
        }

        if (wantsPlay && player.getPlayerState() !== YT.PlayerState.PLAYING) {
            player.playVideo();
        }
    }
}
// ====================================================================

// INICIALIZAÇÃO DINÂMICA
function onYouTubeIframeAPIReady() {
    window.currentPlayerMode = 'INICIANDO';

    // Evitar que visitante recém-chegado seja tratado como Solo
    const initialControls = window.isAdminLoggedIn ? 1 : 0;
    
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
            'origin': window.location.origin
        },
        events: {
            onReady: (event) => {
                if (typeof loadVideoQueue === 'function') loadVideoQueue();
                player.setVolume(50);
                if (typeof isPlayerReady !== 'undefined') isPlayerReady = true;
                startSyncHeartbeat();

                // Visitante: pega o último estado logo que nasce
                if (!amISyncMaster() && typeof playerStateRef !== 'undefined') {
                    playerStateRef.once('value').then((snap) => {
                        window.latestPlayerState = snap.val();
                        applyRemoteState(window.latestPlayerState, 'player-ready');
                    });
                }
            },
            onStateChange: onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    const playerSeguro = event.target; 

    // --- RESUME LOCAL (SÓ NO MODO SOLO REAL E SEM ADMIN) ---
    if (
        event.data === YT.PlayerState.PLAYING &&
        !localResumeAlreadyUsed &&
        (typeof onlineUserCount !== 'undefined' && onlineUserCount <= 1 && !window.hasAdminOnline)
    ) {
        const savedVideoId = localStorage.getItem('localPlayerVideoId');
        const savedTime = parseFloat(localStorage.getItem('localPlayerTime'));
        const lastSaveTime = parseInt(localStorage.getItem('localPlayerTimestamp') || '0');
        const now = Date.now();

        if (savedVideoId && !isNaN(savedTime) && (now - lastSaveTime < 3600000)) {
            const currentVideoId = playerSeguro.getVideoData ? playerSeguro.getVideoData()?.video_id : null;
            
            if (currentVideoId === savedVideoId && savedTime > 5) {
                console.log(`🔄 RESUMINDO LOCAL EM ${savedTime}s`);
                localResumeAlreadyUsed = true;
                
                if (typeof playerSeguro.seekTo === 'function') {
                    playerSeguro.seekTo(savedTime, true);
                }
                
                localStorage.removeItem('localPlayerTime');
                localStorage.removeItem('localPlayerVideoId');
                localStorage.removeItem('localPlayerTimestamp');
            }
        }
    }

    // --- FIM DO VÍDEO ---
    if (event.data === YT.PlayerState.ENDED) {
        console.log("🎬 Vídeo acabou.");

        localStorage.removeItem('localPlayerTime');
        localStorage.removeItem('localPlayerVideoId');
        localStorage.removeItem('localPlayerTimestamp');

        if (!amISyncMaster()) {
            console.log("ENDED ignorado: este usuário não é mestre de sincronização.");
            return; 
        }

        if (typeof videoQueue !== 'undefined' && videoQueue.length > 0) {
            const endedId = videoQueue[0].id;
            setTimeout(() => {
                if (typeof videoQueueRef !== 'undefined') {
                    videoQueueRef.child(endedId).remove().catch(err => console.error(err));
                }
            }, 500);
        }

        if (typeof runAutoDJCycle === 'function' && (typeof onlineUserCount === 'undefined' || onlineUserCount <= 1)) {
             setTimeout(() => runAutoDJCycle(), 1000);
        }
        
        return; 
    }

    // --- SINCRONIA MESTRE (ADMIN OU BROADCASTER ENVIA DADOS) ---
    if (
        amISyncMaster() && 
        (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED)
    ) {
        let vidId = null;
        try { 
            if (playerSeguro.getVideoData) {
                vidId = playerSeguro.getVideoData().video_id; 
            }
        } catch (e) {}

        if (vidId && typeof playerStateRef !== 'undefined') {
            const currentTime = playerSeguro.getCurrentTime ? playerSeguro.getCurrentTime() : 0;
            
            playerStateRef.update({ 
                state: event.data,
                videoId: vidId,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                videoTime: currentTime,
                status: event.data === YT.PlayerState.PLAYING ? 'playing' : 'paused'
            });
        }
    }
}

function startSyncHeartbeat() {
    if (typeof syncInterval !== 'undefined' && syncInterval) clearInterval(syncInterval);
    
    syncInterval = setInterval(() => {
        if (typeof player !== 'undefined' && player && typeof player.getPlayerState === 'function' && player.getPlayerState() === YT.PlayerState.PLAYING) {
            
            const currentTime = player.getCurrentTime();
            let currentData = null;
            try { currentData = player.getVideoData(); } catch (e) {}
            
            if (currentData && currentData.video_id) {
                localStorage.setItem('localPlayerVideoId', currentData.video_id);
                localStorage.setItem('localPlayerTime', currentTime);
                localStorage.setItem('localPlayerTimestamp', Date.now());
            }

            if (amISyncMaster()) {
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

// --- NOVO LISTENER DE SINCRONIZAÇÃO PARA VISITANTES ---
if (typeof playerStateRef !== 'undefined') {
    playerStateRef.on('value', (snapshot) => {
        const state = snapshot.val();
        window.latestPlayerState = state;

        if (!state) return;
        if (amISyncMaster()) return;

        applyRemoteState(state, 'firebase-listener');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('overlayPlayBtn');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (typeof player !== 'undefined' && player) {
                const s = player.getPlayerState();
                s === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
            }
        });
    }

    const volInp = document.getElementById('overlayVolume');
    if (volInp) {
        volInp.addEventListener('input', (e) => {
            if (typeof player !== 'undefined' && player) player.setVolume(e.target.value);
        });
    }

    const fsBtn = document.getElementById('overlayFullscreenBtn');
    if (fsBtn) {
        fsBtn.addEventListener('click', () => {
            const el = document.getElementById('player-container');
            if (el) {
                document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
            }
        });
    }

    if (typeof playerStateRef !== 'undefined') {
        window.currentVideoRef = playerStateRef; 
    }
});