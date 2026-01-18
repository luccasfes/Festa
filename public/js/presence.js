// ====================================================================
// PRESENÇA E CONTROLE DE VISIBILIDADE (CORRIGIDO)
// ====================================================================

connectedRef.on('value', (snap) => {
    if (snap.val() === true) {
        console.log('Conectado.');
        let userName = sessionStorage.getItem('ytSessionUser') || 'Visitante';
        myPresenceRef = presenceRef.push();
        myPresenceRef.onDisconnect().remove();
        myPresenceRef.set({
            name: userName,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        }).catch(()=>{}); 
    }
});

roomRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        document.getElementById('roomNameDisplay').textContent = data.roomName || 'Sala';
        document.getElementById('roomCreatorDisplay').textContent = data.creatorName || 'Desconhecido';
    }
});

presenceRef.on('value', (snap) => {
    onlineUserCount = snap.numChildren();
    
    document.getElementById('userCount').textContent = onlineUserCount;
    document.getElementById('onlineCount').textContent = onlineUserCount;

    if (onlineUserCount <= 1) {
        isBroadcaster = true;
        document.body.classList.add('solo-mode');
        document.body.classList.remove('festa-mode');
    } else {
        document.body.classList.add('festa-mode');
        document.body.classList.remove('solo-mode');
    }

    if(typeof updatePlayerMode === 'function') updatePlayerMode();
    if(typeof atualizarVisibilidadeAutoDJ === 'function') atualizarVisibilidadeAutoDJ();
    
    // Atualiza botões
    updateAdminButtonsVisibility();
    
    // Re-renderiza fila para aplicar lógica nos itens individuais (X e Checkbox)
    if(typeof renderQueue === 'function') renderQueue();
});

function updateAdminButtonsVisibility() {
    const showBulkControls = isAdminLoggedIn === true;
    const showSingleControls = isAdminLoggedIn || onlineUserCount <= 1;

    // Botões Admin
    const bulkBtn = document.getElementById('bulkRemoveBtn');
    if (bulkBtn) bulkBtn.style.setProperty('display', showBulkControls ? 'inline-block' : 'none', showBulkControls ? '' : 'important');

    const clearBtn = document.querySelector('.clear-queue-button');
    if (clearBtn) clearBtn.style.setProperty('display', showSingleControls ? 'inline-block' : 'none', showSingleControls ? '' : 'important');

    // Itens individuais
    document.querySelectorAll('.bulk-delete-controls').forEach(el => {
        el.style.setProperty('display', showBulkControls ? 'block' : 'none', showBulkControls ? '' : 'important');
    });

    document.querySelectorAll('.remove-button').forEach(el => {
        el.style.setProperty('display', showSingleControls ? 'block' : 'none', showSingleControls ? '' : 'important');
    });
    
    // Texto do Botão Pular
    const skipText = document.getElementById('skipVoteBtnText');
    const voteCounter = document.getElementById('voteCounterWrapper');
    if (skipText && voteCounter) {
        if (isAdminLoggedIn) {
            skipText.textContent = 'Pular (Admin)';
            voteCounter.style.display = 'none';
        } else if (onlineUserCount <= 1) {
            skipText.textContent = 'Pular (Modo Solo)';
            voteCounter.style.display = 'none';
        } else {
            const isVoted = document.getElementById('skipVoteBtn').classList.contains('voted');
            if(!isVoted) skipText.textContent = 'Votar para Pular';
            voteCounter.style.display = 'inline';
        }
    }
}

// CORREÇÃO CRÍTICA: Só Admin atualiza a atividade da sala
// Isso previne o erro "permission_denied" no console dos visitantes
function updateRoomActivity() {
    if (isAdminLoggedIn) {
        roomRef.update({ lastActivity: firebase.database.ServerValue.TIMESTAMP }).catch(()=>{});
    }
}