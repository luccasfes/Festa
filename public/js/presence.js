// ====================================================================
// PRESENÇA E CONTROLE DE VISIBILIDADE (COM VIGIA DE LOGIN E LOGOUT)
// ====================================================================

// --- 1. O VIGIA (MutationObserver) ---
document.addEventListener('DOMContentLoaded', () => {
    const adminBtn = document.getElementById('adminUnlockBtn');
    
    // Função auxiliar para aplicar as mudanças
    const aplicarEstadoAdmin = (isLogado) => {
        window.isAdminLoggedIn = isLogado;
        
        // 1. Atualiza Botões (Esconde ou Mostra)
        updateAdminButtonsVisibility();
        
        // 2. Atualiza a Fila (Para mostrar/esconder checkboxes)
        if(typeof renderQueue === 'function') renderQueue();

        // 3. Atualiza o Player
        if (isLogado) {
            // Se logou, força o player a ter controles (seek liberado)
            if(typeof forceAdminPlayer === 'function') forceAdminPlayer();
        } else {
            // Se DESLOGOU, volta para a regra normal (Sozinho = Com controles, Festa = Sem controles)
            if(typeof updatePlayerMode === 'function') updatePlayerMode();
        }
    };

    if (adminBtn) {
        // Observa mudanças na classe do botão (se ficou verde ou cinza)
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
        if (window.myPresenceRef) window.myPresenceRef.remove();
        window.myPresenceRef = presenceRef.push();
        window.myPresenceRef.onDisconnect().remove();
        window.myPresenceRef.set({
            name: userName,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
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

    // Se sou Admin, IGNORO o modo festa e mantenho o modo Admin
    if (window.isAdminLoggedIn) {
        // Se a contagem mudou, apenas garante que os botões continuem visíveis
        updateAdminButtonsVisibility();
    } else {
        // Se NÃO sou admin, obedeço as regras da sala
        if (onlineUserCount <= 1) {
            document.body.classList.add('solo-mode');
            document.body.classList.remove('festa-mode');
        } else {
            document.body.classList.add('festa-mode');
            document.body.classList.remove('solo-mode');
        }
        // Atualiza o player (trava se tiver gente, destrava se tiver sozinho)
        if(typeof updatePlayerMode === 'function') updatePlayerMode();
        
        // Esconde os botões de admin
        updateAdminButtonsVisibility();
    }
});

// --- 3. Função de Visibilidade (Blindada) ---
function updateAdminButtonsVisibility() {
    const souAdmin = (window.isAdminLoggedIn === true);
    const estouSozinho = (onlineUserCount <= 1);
    
    // Seletores (baseados no seu HTML)
    const btnLimpar = document.querySelector('.clear-queue-button'); 
    const btnSugerir = document.getElementById('btn-auto-sugestao');
    const btnBulkRemove = document.getElementById('bulkRemoveBtn');
    const btnChatLimpar = document.getElementById('clearChatBtn');

    // REGRA DE OURO: Admin vê tudo. Usuário comum vê só se estiver sozinho.
    
    // Botões que aparecem para Admin OU Modo Solo
    if (btnLimpar) btnLimpar.style.display = (souAdmin || estouSozinho) ? 'inline-block' : 'none';
    if (btnSugerir) btnSugerir.style.display = (souAdmin || estouSozinho) ? 'inline-block' : 'none';

    // Botões EXCLUSIVOS de Admin (Remover Lote e Limpar Chat) - NÃO aparecem no modo solo
    if (btnBulkRemove) btnBulkRemove.style.display = souAdmin ? 'inline-block' : 'none';
    if (btnChatLimpar) btnChatLimpar.style.display = souAdmin ? 'inline-block' : 'none';

    // Checkboxes (Só Admin vê)
    const checkboxes = document.querySelectorAll('.bulk-delete-controls');
    checkboxes.forEach(el => {
        el.style.setProperty('display', souAdmin ? 'block' : 'none', 'important');
    });

    // Botões X individuais (Admin ou Solo)
    const removeBtns = document.querySelectorAll('.remove-button');
    removeBtns.forEach(el => {
        el.style.setProperty('display', (souAdmin || estouSozinho) ? 'block' : 'none', 'important');
    });

    // Botão Pular
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

// --- 4. Função Auxiliar para destravar o Player (Seek) ---
function forceAdminPlayer() {
    console.log("Forçando Player Admin (com seek)...");
    if (typeof player !== 'undefined' && player) {
        const currentTime = player.getCurrentTime();
        let currentVideoId = null;
        try { currentVideoId = player.getVideoData().video_id; } catch(e){}

        if (currentVideoId) {
            player.destroy(); 
            player = new YT.Player('videoPlayer', {
                height: '100%',
                width: '100%',
                videoId: currentVideoId,
                playerVars: {
                    'autoplay': 1,
                    'controls': 1, // <--- SEEK BAR LIBERADO
                    'modestbranding': 1,
                    'rel': 0,
                    'start': Math.floor(currentTime)
                },
                events: {
                    'onReady': (event) => {
                         event.target.playVideo();
                         document.getElementById('player-mask').style.display = 'none';
                    },
                    'onStateChange': onPlayerStateChange
                }
            });
            const overlay = document.querySelector('.player-overlay-controls');
            if(overlay) overlay.style.display = 'none';
        }
    }
}

function updateRoomActivity() {
    if (window.isAdminLoggedIn) {
        roomRef.update({ lastActivity: firebase.database.ServerValue.TIMESTAMP }).catch(()=>{});
    }
}