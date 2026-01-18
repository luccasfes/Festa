// ====================================================================
// PLAYER DO YOUTUBE (CORRIGIDO: FILA + SEEK DE ADMIN)
// ====================================================================

function onYouTubeIframeAPIReady() {
    // Cria o player inicial
    player = new YT.Player('videoPlayer', {
        height: '100%',
        width: '100%',
        playerVars: {
            'autoplay': 1,
            'controls': 0, // Começa bloqueado por padrão visual
            'modestbranding': 1,
            'rel': 0,
            'disablekb': 1
        },
        events: {
            'onReady': (event) => {
                // AQUI ESTAVA O ERRO: Faltava carregar a fila!
                loadVideoQueue(); 
                
                player.setVolume(50);
                isPlayerReady = true;
                startSyncHeartbeat();
                
                // Verifica se é Admin para liberar os controles
                setTimeout(updatePlayerMode, 1000);
            },
            'onStateChange': onPlayerStateChange
        }
    });
}

function updatePlayerMode() {
    if (!isPlayerReady) return;
    
    // REGRA DE OURO: Se é Admin, TEM que ter controle total (Modo Solo/Nativo)
    // Isso libera a barra de seek e remove a máscara
    if (isAdminLoggedIn === true) {
        enableSoloPlayerControls();
        return;
    }

    // Se não é admin, mas está sozinho, também libera
    if (onlineUserCount <= 1) {
        enableSoloPlayerControls();
    } else {
        // Se tem mais gente e não é admin, bloqueia (Modo Festa)
        disableSoloPlayerControls();
    }
}

function enableSoloPlayerControls() {
    // Se já estiver no modo SOLO, apenas garante que a UI está certa
    if (currentPlayerMode === 'SOLO') {
        document.getElementById('player-mask').style.display = 'none';
        const ov = document.querySelector('.player-overlay-controls');
        if(ov) ov.style.display = 'none';
        return;
    }
    
    console.log("Ativando Controles Nativos (Admin/Solo)...");
    
    // 1. Esconde a máscara transparente que bloqueia o clique
    const mask = document.getElementById('player-mask');
    if(mask) mask.style.display = 'none'; // CRUCIAL: Isso permite clicar no seek

    // 2. Esconde os controles customizados (botão play azul)
    const ov = document.querySelector('.player-overlay-controls');
    if(ov) ov.style.display = 'none';

    // 3. Recria o player com controls: 1 (Barra vermelha do YouTube)
    recreatePlayer(1);
    currentPlayerMode = 'SOLO';
    
    // Atualiza a interface da fila
    if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
}

function disableSoloPlayerControls() {
    if (currentPlayerMode === 'FESTA') return;
    
    console.log("Ativando Modo Festa (Bloqueado)...");

    // 1. Mostra a máscara para bloquear cliques
    const mask = document.getElementById('player-mask');
    if(mask) mask.style.display = 'block';

    // 2. Mostra os controles customizados
    const ov = document.querySelector('.player-overlay-controls');
    if(ov) ov.style.display = 'flex';

    // 3. Recria o player sem controles nativos
    recreatePlayer(0);
    currentPlayerMode = 'FESTA';

    if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
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
    } catch(e){}

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
            'controls': controlsValue, // 1 = Com Seek (Admin), 0 = Sem Seek (User)
            'modestbranding': 1,
            'rel': 0,
            'disablekb': 1,
            'fs': 1, // Permite fullscreen nativo
            'start': Math.floor(savedTime)
        },
        events: {
            'onReady': (e) => {
                if (savedTime > 0) e.target.seekTo(savedTime, true);
                // Só dá play se tiver vídeo valido
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
    // Se acabou o vídeo, remove da fila
    if (event.data === YT.PlayerState.ENDED) {
        if (videoQueue.length > 0) {
             // Pequeno delay para garantir que o vídeo acabou visualmente
             setTimeout(() => {
                 if(typeof videoQueueRef !== 'undefined') videoQueueRef.child(videoQueue[0].id).remove();
             }, 500);
        }
    }
    
    // SINCRONIA: O Admin é o Mestre. O estado dele é enviado para o Firebase.
    if (isAdminLoggedIn || isBroadcaster) {
        const status = event.data === YT.PlayerState.PLAYING ? 'playing' : 'paused';
        const vidId = player.getVideoData ? player.getVideoData().video_id : null;
        
        if(vidId) {
            playerStateRef.set({
                status: status,
                videoId: vidId,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                videoTime: player.getCurrentTime()
            });
        }
    }
}

function startSyncHeartbeat() {
    if (syncInterval) clearInterval(syncInterval);
    
    // A cada 5 segundos, se for Admin e estiver tocando, força a sincronia do tempo
    syncInterval = setInterval(() => {
        if ((isAdminLoggedIn || isBroadcaster) && player && player.getPlayerState && player.getPlayerState() === YT.PlayerState.PLAYING) {
            playerStateRef.update({
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                videoTime: player.getCurrentTime()
            });
            updateRoomActivity();
        }
    }, 5000);
}

let isSeeking = false;

// OUVINTE: Usuários comuns ouvem isso. Admin IGNORA isso (para poder controlar o seek).
playerStateRef.on('value', (snapshot) => {
    // SE FOR ADMIN, RETORNA IMEDIATAMENTE.
    // Isso impede que o seek "volte" quando você tenta adiantar o vídeo.
    if (isAdminLoggedIn || isBroadcaster) return;

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

// Controles do Overlay (apenas para modo Festa/Visitante)
if(document.getElementById('overlayPlayBtn')){
    document.getElementById('overlayPlayBtn').addEventListener('click', () => {
        if(player) player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
    });
}
if(document.getElementById('overlayVolume')){
    document.getElementById('overlayVolume').addEventListener('input', (e) => {
        if(player) player.setVolume(e.target.value);
    });
}
if(document.getElementById('overlayFullscreenBtn')){
    document.getElementById('overlayFullscreenBtn').addEventListener('click', () => {
        const el = document.getElementById('player-container');
        document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
    });
}