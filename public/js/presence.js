// ====================================================================
// PRESENÇA E CONTROLE DE VISIBILIDADE (CORRIGIDO E BLINDADO)
// ====================================================================

// --- 1. O VIGIA (MutationObserver + Verificação Inicial) ---
document.addEventListener('DOMContentLoaded', () => {
    const adminBtn = document.getElementById('adminUnlockBtn');
    
    // Função que aplica os poderes de Admin
    const aplicarEstadoAdmin = (isLogado) => {
        window.isAdminLoggedIn = isLogado;
        
        // 1. Atualiza Botões da Interface
        if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
        
        // 2. Atualiza a Fila (Checkboxes)
        if(typeof renderQueue === 'function') renderQueue();

        // 3. Atualiza o Player (O Pulo do Gato)
        if (isLogado) {
            // Tenta forçar o player imediatamente
            forceAdminPlayer();
            
            // E garante tentando de novo em 2s e 5s caso a internet esteja lenta
            setTimeout(forceAdminPlayer, 2000);
            setTimeout(forceAdminPlayer, 5000);
        } else {
            // Se deslogou, volta ao normal
            const mask = document.getElementById('player-mask');
            if(mask) mask.style.display = 'block';
        }
    };

    // A. Configura o Observador para mudanças futuras (Login/Logout manual)
    if (adminBtn) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    if (adminBtn.classList.contains('admin-logged-in')) {
                        console.log("VIGIA: Login detectado! Liberando tudo...");
                        aplicarEstadoAdmin(true);
                    } else {
                        console.log("VIGIA: Logout detectado! Bloqueando tudo...");
                        aplicarEstadoAdmin(false);
                    }
                }
            });
        });
        observer.observe(adminBtn, { attributes: true });

        // B. VERIFICAÇÃO INICIAL (Corrige o bug de ter que relogar)
        // Espera um pouquinho para o session.js definir a classe
        setTimeout(() => {
            if (adminBtn.classList.contains('admin-logged-in') || window.isAdminLoggedIn) {
                console.log("VIGIA: Admin já estava logado ao entrar. Aplicando poderes...");
                aplicarEstadoAdmin(true);
            }
        }, 1000);
    }
});

// --- 2. Lógica de Presença Padrão ---
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
            }).catch(()=>{}); 
        }
    });
}

if (typeof roomRef !== 'undefined') {
    roomRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const rn = document.getElementById('roomNameDisplay');
            const rc = document.getElementById('roomCreatorDisplay');
            if(rn) rn.textContent = data.roomName || 'Sala';
            if(rc) rc.textContent = data.creatorName || 'Desconhecido';
        }
    });
}

if (typeof presenceRef !== 'undefined') {
    presenceRef.on('value', (snap) => {
        onlineUserCount = snap.numChildren();
        const userCountEl = document.getElementById('userCount');
        if(userCountEl) userCountEl.textContent = onlineUserCount;
        const onlineCountEl = document.getElementById('onlineCount');
        if(onlineCountEl) onlineCountEl.textContent = onlineUserCount;

        if (window.isAdminLoggedIn) {
            if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
        } else {
            // Lógica de modo solo/festa para visitantes
            if (onlineUserCount <= 1) {
                document.body.classList.add('solo-mode');
                document.body.classList.remove('festa-mode');
            } else {
                document.body.classList.add('festa-mode');
                document.body.classList.remove('solo-mode');
            }
            if(typeof updatePlayerMode === 'function') updatePlayerMode();
            if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
        }
    });
}

// --- 3. Visibilidade dos Botões ---
function updateAdminButtonsVisibility() {
    const souAdmin = (window.isAdminLoggedIn === true);
    const estouSozinho = (onlineUserCount <= 1);
    
    const elementsToShowAdmin = [
        '#bulkRemoveBtn', '#clearChatBtn', '#panelBtn', '#btn-auto-sugestao', '.clear-queue-button'
    ];

    // Mostra/Esconde botões de admin
    elementsToShowAdmin.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.style.display = souAdmin ? 'inline-flex' : 'none';
    });

    // Checkboxes da fila
    document.querySelectorAll('.bulk-delete-controls').forEach(el => {
        el.style.setProperty('display', souAdmin ? 'block' : 'none', 'important');
    });

    // Botão X da fila (Admin ou Solo)
    document.querySelectorAll('.remove-button').forEach(el => {
        el.style.setProperty('display', (souAdmin || estouSozinho) ? 'block' : 'none', 'important');
    });

    // Texto do botão de Pular
    const skipText = document.getElementById('skipVoteBtnText');
    const voteCounter = document.getElementById('voteCounterWrapper');
    const skipBtn = document.getElementById('skipVoteBtn');

    if (skipText) {
        if (souAdmin) {
            skipText.textContent = 'Pular (Admin)';
            if(voteCounter) voteCounter.style.display = 'none';
            if(skipBtn) skipBtn.disabled = false;
        } else {
            // Lógica normal de votação...
            const isVoted = skipBtn && skipBtn.classList.contains('voted');
            if(!isVoted) skipText.textContent = 'Votar para Pular';
            if(voteCounter) voteCounter.style.display = 'inline';
        }
    }
}

// --- 4. CORREÇÃO DEFINITIVA DO PLAYER ADMIN (The Fix) ---
function forceAdminPlayer() {
    // Só roda se for admin mesmo
    if (!window.isAdminLoggedIn) return;

    console.log("👑 Admin: Tentando habilitar controles do Player...");

    // 1. Remove máscaras visuais
    const mask = document.getElementById('player-mask');
    const overlay = document.querySelector('.player-overlay-controls');
    if (mask) mask.style.display = 'none';
    if (overlay) overlay.style.display = 'none';

    // 2. Tenta descobrir qual vídeo tocar
    let currentVideoId = null;
    let currentTime = 0;

    // Tenta ler do player atual (se existir)
    if (typeof player !== 'undefined' && player && typeof player.getVideoData === 'function') {
        try {
            currentVideoId = player.getVideoData().video_id;
            currentTime = player.getCurrentTime();
        } catch(e) {}
    }

    // Se falhou, tenta ler da Fila (Backup vital!)
    if (!currentVideoId && typeof videoQueue !== 'undefined' && videoQueue.length > 0) {
        try {
            // Extrai ID da URL do primeiro vídeo da fila
            let url = videoQueue[0].videoUrl;
            let match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/)([^#&?]*))/);
            if (match) currentVideoId = match[1];
        } catch(e) {}
    }

    // Se ainda não temos vídeo, aborta mas tenta de novo em 2s
    if (!currentVideoId) {
        console.log("⚠️ Nenhum vídeo encontrado ainda. Tentando novamente em 2s...");
        // setTimeout(forceAdminPlayer, 2000); // Opcional: loop de retry
        return;
    }

    console.log(`🎬 Recriando player com controles para: ${currentVideoId}`);

    // 3. LIMPEZA TOTAL (O Segredo para não bugar)
    // Removemos o elemento antigo completamente do DOM
    const container = document.getElementById('player-container');
    if (!container) return;
    
    // Limpa o container mantendo apenas a máscara (que já está oculta)
    // Isso mata qualquer iframe zumbi do YouTube
    container.innerHTML = '<div id="player-mask" style="display:none;"></div><div id="videoPlayer"></div>';

    // 4. CRIAÇÃO DO NOVO PLAYER
    // Delay minúsculo para o navegador processar a limpeza do HTML
    setTimeout(() => {
        if (typeof YT === 'undefined' || !YT.Player) return;

        player = new YT.Player('videoPlayer', {
            height: '100%',
            width: '100%',
            videoId: currentVideoId,
            playerVars: {
                'autoplay': 1,
                'controls': 1,       // <--- ISSO TRAZ A BARRA DE VOLTA
                'disablekb': 0,      // Teclado funciona
                'fs': 1,             // Fullscreen funciona
                'modestbranding': 1,
                'rel': 0,
                'start': Math.max(0, Math.floor(currentTime))
            },
            events: {
                'onReady': (event) => {
                    event.target.playVideo();
                },
                'onStateChange': (event) => {
                    // Reconecta com a lógica do site se existir
                    if (typeof onPlayerStateChange === 'function') {
                        onPlayerStateChange(event);
                    }
                }
            }
        });
    }, 100);
}

function updateRoomActivity() {
    if (window.isAdminLoggedIn && window.roomRef) {
        window.roomRef.update({ lastActivity: firebase.database.ServerValue.TIMESTAMP }).catch(()=>{});
    }
}