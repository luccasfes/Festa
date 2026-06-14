// ====================================================================
// PLAYER DO YOUTUBE (VERSÃO DEFINITIVA: PROTEÇÃO CONTRA RACE CONDITION E BUG DE UI)
// ====================================================================

// Variáveis Globais de Controle
var syncInterval = null;
window.isBroadcaster = false; 
var currentPlayerMode = null; 
window.isAdminLoggedIn = false; 
window.currentVideoRef = null; 
window.hasAdminOnline = false;

let localResumeAlreadyUsed = false;
window.isRecoveringState = false; // CADEADO

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

function applyRemoteState(state, origin = '', forceSync = false) {
    if (!state) return;
    if (amISyncMaster() && !forceSync) return;
    if (typeof player === 'undefined' || !player || typeof player.getVideoData !== 'function') return;
    if (!state.videoId) return;
    if (remoteIsEnded(state)) return;

    const wantsPlay = remoteIsPlaying(state);
    const wantsPause = remoteIsPaused(state);

    let targetTime = getStateVideoTime(state);

    const duration = player.getDuration ? player.getDuration() : 0;

    if (duration && targetTime > duration - 2) {
        targetTime = Math.max(0, duration - 2);
    }

    let currentVideoId = null;
    try {
        currentVideoId = player.getVideoData()?.video_id || null;
    } catch (e) {}

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

    // AJUSTE 1: Evita que o Admin perca a barra de progresso se o Firebase demorar a logar
    const isUrlAdmin = window.location.pathname.includes('admin');
    const initialControls = (window.isAdminLoggedIn || isUrlAdmin) ? 1 : 0;
    
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
                player.setVolume(50);
                if (typeof isPlayerReady !== 'undefined') isPlayerReady = true;
                startSyncHeartbeat();

                if (typeof playerStateRef !== 'undefined') {
                    playerStateRef.once('value').then((snap) => {
                        window.latestPlayerState = snap.val();
                        
                        // CADEADO: Trava o Firebase do Admin por 2.5s para blindar os convidados no F5
                        if (amISyncMaster()) {
                            window.isRecoveringState = true;
                            setTimeout(() => { window.isRecoveringState = false; }, 2500);
                        }
                        
                        if (typeof loadVideoQueue === 'function') loadVideoQueue();

                        if (!amISyncMaster()) {
                            applyRemoteState(window.latestPlayerState, 'player-ready');
                        }
                    });
                } else {
                    if (typeof loadVideoQueue === 'function') loadVideoQueue();
                }
            },
            onStateChange: onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    const playerSeguro = event.target; 
    const myTime = playerSeguro.getCurrentTime ? playerSeguro.getCurrentTime() : 0;
    const duration = playerSeguro.getDuration ? playerSeguro.getDuration() : 0;

    // --- 1. RESGATE INFALÍVEL (COM LEITURA DIRETA DO FIREBASE PARA EVITAR RACE CONDITION) ---
    if (
        event.data === YT.PlayerState.PLAYING &&
        !localResumeAlreadyUsed
    ) {
        localResumeAlreadyUsed = true; // Gasta a chance (só roda no recarregamento)
        
        const isMaster = amISyncMaster();
        const isSolo = (typeof onlineUserCount !== 'undefined' && onlineUserCount <= 1 && !window.hasAdminOnline);

        if (isMaster || isSolo) {
            window.isRecoveringState = true; // Trava o Firebase imediatamente

            const finalizeRecovery = (remoteState) => {
                let currentVideoId = null;
                try { currentVideoId = playerSeguro.getVideoData()?.video_id; } catch(e){}
                
                // Se a API ainda não tiver o ID pronto, usa o do Firebase/Local
                if (!currentVideoId && remoteState) currentVideoId = remoteState.videoId;
                if (!currentVideoId) currentVideoId = localStorage.getItem('localPlayerVideoId');

                const savedVideoId = localStorage.getItem('localPlayerVideoId');
                const savedTime = parseFloat(localStorage.getItem('localPlayerTime'));
                const lastSaveTime = parseInt(localStorage.getItem('localPlayerTimestamp') || '0');
                const now = Date.now();

                let targetTime = 0;
                let shouldRecover = false;

                // PLANO A: Sala (Firebase) - O Admin precisa nascer exatament onde os convidados estão!
                if (isMaster && remoteState && remoteState.videoId === currentVideoId) {
                    const fbTime = getStateVideoTime(remoteState);
                    if (fbTime > 5) {
                        targetTime = fbTime;
                        shouldRecover = true;
                        console.log("🔄 PLANO A: Recuperando da Sala", fbTime);
                    }
                }

                // PLANO B: Cache Local - Se estiver Solo ou o Firebase estiver vazio
                if (!shouldRecover && savedVideoId === currentVideoId && !isNaN(savedTime) && (now - lastSaveTime < 3600000)) {
                    if (savedTime > 5) {
                        targetTime = savedTime;
                        shouldRecover = true;
                        console.log("🔄 PLANO B: Recuperando do Local", savedTime);
                    }
                }

                // Pula o tempo se o Admin estiver perdido no início do vídeo
                if (shouldRecover && playerSeguro.getCurrentTime() < targetTime - 3) {
                    console.log(`🔄 PULO DE TEMPO: Indo para ${targetTime}s`);
                    isSeeking = true;
                    
                    // AJUSTE 2: Respiro de 400ms para a interface do YouTube renderizar!
                    // Sem isso, a barra de progresso do YouTube quebra e só mostra o botão de pause.
                    setTimeout(() => {
                        if (typeof playerSeguro.seekTo === 'function') {
                            playerSeguro.seekTo(targetTime, true);
                        }
                    }, 400);
                    
                    // Destrava o cadeado 2 segundos após o pulo de tempo
                    setTimeout(() => { 
                        window.isRecoveringState = false; 
                        isSeeking = false; 
                    }, 2000);
                }
            };

            // O GRANDE SEGREDO: O Admin força a leitura do Firebase AQUI!
            // Isso impede que ele mande "0:00" caso o vídeo carregue mais rápido que o Banco de Dados.
            if (isMaster && typeof playerStateRef !== 'undefined') {
                playerStateRef.once('value').then(snap => {
                    window.latestPlayerState = snap.val();
                    finalizeRecovery(window.latestPlayerState);
                }).catch(() => finalizeRecovery(window.latestPlayerState));
                
                return; // Aborta e não deixa a função continuar e enviar "0" pros convidados
            } else {
                finalizeRecovery(window.latestPlayerState);
            }
        }
    }

    // --- 2. FIM DO VÍDEO BLINDADO ---
    if (event.data === YT.PlayerState.ENDED) {
        // Proteção: Só processa o fim se realmente estiver no final do vídeo (protege contra Falso ENDED do YouTube no F5)
        if (duration > 0 && myTime >= duration - 3) {
            console.log("🎬 Vídeo acabou legitimamente.");

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
        } else {
            console.log("🚫 Falso ENDED ignorado para proteger a memória do player.");
        }
        
        return; 
    }

    // --- 3. SINCRONIA MESTRE (ADMIN OU BROADCASTER ENVIA DADOS) ---
    if (
        amISyncMaster() && 
        (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED)
    ) {
        // CADEADO: Se o Admin estiver no processo de F5 e resgatando o tempo, não sobrescreve a sala com "0:00"!
        if (window.isRecoveringState || isSeeking) {
            console.log("Protegendo Firebase contra reset durante o carregamento inicial...");
            return;
        }

        let vidId = null;
        try { 
            if (playerSeguro.getVideoData) {
                vidId = playerSeguro.getVideoData().video_id; 
            }
        } catch (e) {}

        if (vidId && typeof playerStateRef !== 'undefined') {
            playerStateRef.update({ 
                state: event.data,
                videoId: vidId,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                videoTime: myTime,
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
                if (window.isRecoveringState || isSeeking) return; // Cadeado no heartbeat também!

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