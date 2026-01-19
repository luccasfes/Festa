// ====================================================================
// PRESENÇA E CONTROLE DE VISIBILIDADE (COM VIGIA DE LOGIN E LOGOUT)
// ====================================================================

// --- 1. O VIGIA (MutationObserver) ---
document.addEventListener('DOMContentLoaded', () => {
    const adminBtn = document.getElementById('adminUnlockBtn');
    
    const aplicarEstadoAdmin = (isLogado) => {
        window.isAdminLoggedIn = isLogado;
        
        // 1. Atualiza Botões
        if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
        
        // 2. Atualiza a Fila
        if(typeof renderQueue === 'function') renderQueue();

        // 3. Atualiza o Player (Só se logou)
        if (isLogado) {
            if(typeof forceAdminPlayer === 'function') forceAdminPlayer();
        } else {
            if(typeof updatePlayerMode === 'function') updatePlayerMode();
        }
    };

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
    }
});

// --- 2. Lógica de Presença Padrão ---
connectedRef.on('value', (snap) => {
    if (snap.val() === true) {
        let userName = sessionStorage.getItem('ytSessionUser') || 'Visitante';
        
        // Remove referência anterior se existir
        if (window.myPresenceRef) window.myPresenceRef.remove();
        
        // Cria nova referência de presença
        window.myPresenceRef = presenceRef.push();
        window.myPresenceRef.onDisconnect().remove();
    
        // Define os dados do usuário
        window.myPresenceRef.set({
            name: userName,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            // Isso avisa o faxineiro que a sala está ativa novamente.
            if (window.roomRef) {
                window.roomRef.child('emptySince').remove().catch(() => {});
            }
        }).catch(()=>{}); 
    }
});

roomRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const rn = document.getElementById('roomNameDisplay');
        const rc = document.getElementById('roomCreatorDisplay');
        if(rn) rn.textContent = data.roomName || 'Sala';
        if(rc) rc.textContent = data.creatorName || 'Desconhecido';
    }
});

presenceRef.on('value', (snap) => {
    onlineUserCount = snap.numChildren();
    
    const userCountEl = document.getElementById('userCount');
    if(userCountEl) userCountEl.textContent = onlineUserCount;
    const onlineCountEl = document.getElementById('onlineCount');
    if(onlineCountEl) onlineCountEl.textContent = onlineUserCount;

    if (window.isAdminLoggedIn) {
        if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
    } else {
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

// --- 3. Visibilidade dos Botões ---
function updateAdminButtonsVisibility() {
    const souAdmin = (window.isAdminLoggedIn === true);
    const estouSozinho = (onlineUserCount <= 1);
    
    const btnLimpar = document.querySelector('.clear-queue-button'); 
    const btnSugerir = document.getElementById('btn-auto-sugestao');
    const btnBulkRemove = document.getElementById('bulkRemoveBtn');
    const btnChatLimpar = document.getElementById('clearChatBtn');

    if (btnLimpar) btnLimpar.style.display = (souAdmin || estouSozinho) ? 'inline-block' : 'none';
    if (btnSugerir) btnSugerir.style.display = (souAdmin || estouSozinho) ? 'inline-flex' : 'none';
    
    // Botão Painel (Adicionado verificação aqui também)
    const btnPainel = document.getElementById('panelBtn');
    if (btnPainel) btnPainel.style.display = souAdmin ? 'inline-flex' : 'none';

    if (btnBulkRemove) btnBulkRemove.style.display = souAdmin ? 'inline-block' : 'none';
    if (btnChatLimpar) btnChatLimpar.style.display = souAdmin ? 'inline-block' : 'none';

    const checkboxes = document.querySelectorAll('.bulk-delete-controls');
    checkboxes.forEach(el => {
        el.style.setProperty('display', souAdmin ? 'block' : 'none', 'important');
    });

    const removeBtns = document.querySelectorAll('.remove-button');
    removeBtns.forEach(el => {
        el.style.setProperty('display', (souAdmin || estouSozinho) ? 'block' : 'none', 'important');
    });

    const skipText = document.getElementById('skipVoteBtnText');
    const voteCounter = document.getElementById('voteCounterWrapper');
    const skipBtn = document.getElementById('skipVoteBtn');

    if (skipText) {
        if (souAdmin) {
            skipText.textContent = 'Pular (Admin)';
            if(voteCounter) voteCounter.style.display = 'none';
            if(skipBtn) skipBtn.disabled = false;
        } else if (estouSozinho) {
            skipText.textContent = 'Pular (Modo Solo)';
            if(voteCounter) voteCounter.style.display = 'none';
            if(skipBtn) skipBtn.disabled = false;
        } else {
            const isVoted = skipBtn && skipBtn.classList.contains('voted');
            if(!isVoted) skipText.textContent = 'Votar para Pular';
            if(voteCounter) voteCounter.style.display = 'inline';
        }
    }
}

// --- 4. CORREÇÃO DO ERRO DO PLAYER ---
function forceAdminPlayer() {
    console.log("Forçando Player Admin...");
    
    // Verificação de segurança: O player existe?
    if (typeof player === 'undefined' || !player) return;

    let currentTime = 0;
    let currentVideoId = null;

    // Tenta pegar os dados com segurança (try-catch)
    try {
        if (typeof player.getCurrentTime === 'function') {
            currentTime = player.getCurrentTime();
        }
        if (typeof player.getVideoData === 'function') {
            currentVideoId = player.getVideoData().video_id;
        }
    } catch (e) {
        console.warn("Player ainda não estava pronto para ler tempo/ID:", e);
        // Se der erro, não faz nada e espera a próxima atualização natural
        return;
    }

    if (currentVideoId) {
        try {
            player.destroy(); // Tenta destruir
        } catch(e) {}

        player = new YT.Player('videoPlayer', {
            height: '100%',
            width: '100%',
            videoId: currentVideoId,
            playerVars: {
                'autoplay': 1,
                'controls': 1, // Habilita Seek
                'modestbranding': 1,
                'rel': 0,
                'start': Math.floor(currentTime)
            },
            events: {
                'onReady': (event) => {
                     event.target.playVideo();
                     const mask = document.getElementById('player-mask');
                     if(mask) mask.style.display = 'none';
                },
                'onStateChange': onPlayerStateChange
            }
        });
        
        const overlay = document.querySelector('.player-overlay-controls');
        if(overlay) overlay.style.display = 'none';
    }
}

function updateRoomActivity() {
    if (window.isAdminLoggedIn) {
        roomRef.update({ lastActivity: firebase.database.ServerValue.TIMESTAMP }).catch(()=>{});
    }
}