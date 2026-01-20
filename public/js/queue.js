// ====================================================================
// FILA DE VÍDEOS (AJUSTADA - MODO SOLO & VOTAÇÃO 50%+1)
// ====================================================================

let lastVoteCount = 0; 

async function addVideo(urlArg = null, titleArg = null) {
    let phone = document.getElementById('phone').value.trim(); 
    if (!phone) phone = sessionStorage.getItem('ytSessionUser') || '';

    const searchNameInput = document.getElementById('ytSearchName');
    if (!phone && searchNameInput && searchNameInput.value.trim()) {
        phone = searchNameInput.value.trim();
        sessionStorage.setItem('ytSessionUser', phone); 
        currentSessionUser = phone;
    }

    let url = urlArg || document.getElementById('videoUrl').value.trim();
    let title = titleArg || null;

    if (!phone) {
        const searchModal = document.getElementById('ytSearchModal');
        if (searchModal && searchModal.style.display === 'flex') {
            showNotification('Digite seu nome no campo acima!', 'error');
            if (searchNameInput) searchNameInput.focus();
        } else {
            if(!urlArg) showNotification('Diga seu nome primeiro!', 'error');
            openEditNameModal();
        }
        return;
    }

    if (!url) return showNotification('Cole a URL do vídeo.', 'error');
    const videoId = extractVideoId(url);
    if (!videoId) return showNotification('URL inválida.', 'error');

    toggleLoading('addVideoBtn', true);

    try {
        if (!title) {
            try {
                const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
                const data = await response.json();
                title = data.title;
            } catch (err) { }
        }
        if (!title) title = `Vídeo (ID: ${videoId})`;

        await videoQueueRef.push({ phone, videoUrl: url, title });
        showNotification('Vídeo adicionado!', 'success');
        if (!urlArg) document.getElementById('videoUrl').value = '';
        
        if(phone && !sessionStorage.getItem('ytSessionUser')) {
            sessionStorage.setItem('ytSessionUser', phone);
            const d = document.getElementById('userNameDisplay');
            if(d) d.textContent = phone;
        }

    } catch (e) {
        console.error(e);
        showNotification('Erro ao adicionar.', 'error');
    } finally {
        toggleLoading('addVideoBtn', false);
    }
}

function loadVideoQueue() {
    videoQueueRef.on('value', async (snapshot) => {
        const data = snapshot.val();
        let fetchedQueue = data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : [];

        const BOT_NAME = '🤖 DJ Flow';
        const currentPlayingId = videoQueue.length > 0 ? videoQueue[0].id : null;
        const currentStillExists = fetchedQueue.find(v => v.id === currentPlayingId);

        if (currentStillExists) {
            const waiting = fetchedQueue.filter(v => v.id !== currentPlayingId);
            waiting.sort((a, b) => (a.phone === BOT_NAME) - (b.phone === BOT_NAME));
            videoQueue = [currentStillExists, ...waiting];
        } else {
            fetchedQueue.sort((a, b) => (a.phone === BOT_NAME) - (b.phone === BOT_NAME));
            videoQueue = fetchedQueue;
        }

        renderQueue();
        checkCurrentVideo();
        if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
    });
}

function renderQueue() {
    const list = document.getElementById('videoList');
    list.innerHTML = '';
    
    // Verifica Admin direto da variável global
    const isAdmin = (window.isAdminLoggedIn === true);

    if (isAdmin) list.classList.add('admin-mode');
    else list.classList.remove('admin-mode');

    if (videoQueue.length === 0) {
        list.innerHTML = '<li class="empty-queue" style="text-align:center; padding:20px; color:#888;">Fila vazia.</li>';
        if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
        return;
    }

    videoQueue.forEach((video, index) => {
        const li = document.createElement('li');
        li.className = 'video-item';
        li.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 10px; background: rgba(255, 255, 255, 0.05); margin-bottom: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);";
        
        if (index === 0) li.classList.add('playing');
        if (video.phone === '🤖 DJ Flow') {
            li.style.opacity = '0.8';
            li.style.borderLeft = '3px solid #777';
        }

        let vId = extractVideoId(video.videoUrl);
        const displayTitle = video.title || `Vídeo (ID: ${vId})`;
        const thumbUrl = vId ? `https://img.youtube.com/vi/${vId}/mqdefault.jpg` : '';

        // Se for admin, já deixa block. Se não, none.
        const displayStyle = isAdmin ? 'block' : 'none';
        
        const checkboxHtml = `
            <div class="bulk-delete-controls" style="margin-right:10px; display: ${displayStyle} !important;">
                <input type="checkbox" class="video-select-checkbox" data-videoid="${video.id}">
            </div>`;

        const removeBtnHtml = `
            <button class="remove-button" onclick="handleRemoveVideo('${video.id}')" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:1.1rem; display: ${displayStyle} !important;">
                <i class="fas fa-times"></i>
            </button>`;

        li.innerHTML = `
            ${checkboxHtml}
            <div class="video-info-wrapper" style="display: flex; align-items: center; gap: 12px; flex: 1; overflow: hidden;">
                <img src="${thumbUrl}" class="queue-thumb" alt="Capa">
                <div class="video-info">
                    <span class="video-title">${escapeHtml(displayTitle)}</span>
                    <div class="video-meta">
                        <span class="video-added-by" style="color: #6c5ce7;">Por: ${escapeHtml(video.phone)}</span>
                    </div>
                </div>
            </div>
            ${removeBtnHtml}
        `;
        list.appendChild(li);
    });
    
    if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
}

function checkCurrentVideo() {
    if (videoQueue.length > 0) {
        const currentVideo = videoQueue[0];
        const queueVideoId = extractVideoId(currentVideo.videoUrl);
        const u = document.getElementById('currentUser');
        if(u) u.textContent = currentVideo.phone;
        const urlD = document.getElementById('currentVideoUrl');
        if(urlD) {
            urlD.textContent = currentVideo.title || 'Tocando...';
            urlD.style.display = 'block';
        }
        if (player && typeof player.loadVideoById === 'function') {
            let pid = null;
            try { pid = player.getVideoData().video_id; } catch(e){}
            if (pid !== queueVideoId && queueVideoId) {
                player.loadVideoById(queueVideoId);
                if(typeof playedVideoHistory !== '') playedVideoHistory.add(queueVideoId);
            }
        }
    } else {
        const u = document.getElementById('currentUser');
        if(u) u.textContent = 'Nenhum vídeo';
        const urlD = document.getElementById('currentVideoUrl');
        if(urlD) urlD.style.display = 'none';
        lastVoteCount = 0; 
    }
}

// Agora verifica explicitamente se onlineUserCount <= 1 para liberar sem senha
function handleRemoveVideo(id) {
    const isSolo = (typeof onlineUserCount !== 'undefined' && onlineUserCount <= 1);
    
    if (window.isAdminLoggedIn || isSolo) {
        videoQueueRef.child(id).remove()
            .then(() => showNotification('Vídeo removido!', 'success'))
            .catch((error) => showNotification('Erro ao remover.', 'error'));
    } else {
        openRemoveModalWithId(id);
    }
}

// === CORREÇÃO: Botão de Pular ===
function handleSkipOrVote() {
    // Verifica se é Admin OU se está Sozinho na sala
    const isSolo = (typeof onlineUserCount !== 'undefined' && onlineUserCount <= 1);

    if (window.isAdminLoggedIn || isSolo) {
        // PULA DIRETO
        if (videoQueue.length > 0) {
            toggleLoading('skipVoteBtn', true); // Mostra loading
            videoQueueRef.child(videoQueue[0].id).remove()
                .then(() => {
                    showNotification(window.isAdminLoggedIn ? 'Pulado pelo Admin!' : 'Pulado (Modo Solo)!', 'success');
                })
                .finally(() => toggleLoading('skipVoteBtn', false));
        } else {
            showNotification('Fila vazia.', 'info');
        }
    } else {
        // MODO FESTA: Registra Voto
        castVoteToSkip();
    }
}

// === Limpar Fila ===
// Agora verifica explicitamente se onlineUserCount <= 1 para liberar sem senha
function handleClearQueue() {
    const isSolo = (typeof onlineUserCount !== 'undefined' && onlineUserCount <= 1);

    if (window.isAdminLoggedIn || isSolo) {
        if(confirm('Limpar toda a fila?')) {
            videoQueueRef.remove();
            showNotification('Fila limpa!', 'success');
        }
    } else {
        document.getElementById('modal').style.display = 'flex';
    }
}

function removeSelectedVideos() {
    const checkboxes = document.querySelectorAll('.video-select-checkbox:checked');
    if (checkboxes.length === 0) return showNotification('Selecione vídeos.', 'info');

    if (window.isAdminLoggedIn) {
        if(confirm(`Remover ${checkboxes.length} vídeos?`)) {
             const updates = {};
             checkboxes.forEach(cb => updates[cb.dataset.videoid] = null);
             videoQueueRef.update(updates);
             showNotification('Vídeos removidos!', 'success');
        }
    } else {
        showNotification('Ação exclusiva de Admin.', 'error');
    }
}

let userVoteId = sessionStorage.getItem('userVoteId') || ('user_' + Date.now());
sessionStorage.setItem('userVoteId', userVoteId);

function castVoteToSkip() {
    if (videoQueue.length === 0 || onlineUserCount < 2) return showNotification('Não dá pra votar agora.', 'info');
    const votesRef = roomRef.child('currentSong/votes');
    toggleLoading('skipVoteBtn', true);
    votesRef.child(userVoteId).set({
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        userName: currentSessionUser || 'Anônimo'
    }).finally(() => toggleLoading('skipVoteBtn', false));
}

// === Função para Atualizar Votos Necessários ===
function updateVotesNeeded() {
    const safeUserCount = (typeof onlineUserCount !== 'undefined' && onlineUserCount > 0) ? onlineUserCount : 1;
    let needed = Math.floor(safeUserCount / 2) + 1;
    if (needed < 2) needed = 2; // Mínimo 2 para mais de 1 pessoa

    const nEl = document.getElementById('votesNeeded');
    if (nEl) nEl.textContent = needed;
}

// === Lógica de Votação (50% + 1) ===
roomRef.child('currentSong/votes').on('value', snap => {
    const votes = snap.val() || {};
    const count = Object.keys(votes).length;
    
    // Atualiza votos necessários sempre (caso o número de usuários tenha mudado)
    updateVotesNeeded();
    
    const safeUserCount = (typeof onlineUserCount !== 'undefined' && onlineUserCount > 0) ? onlineUserCount : 1;
    let needed = Math.floor(safeUserCount / 2) + 1;
    if (needed < 2) needed = 2;

    const cEl = document.getElementById('voteCount');
    if(cEl) cEl.textContent = count;
    
    if (count > lastVoteCount && count > 0 && safeUserCount > 1) {
        if (count < needed) showNotification(`Voto registrado (${count}/${needed})`, 'info');
    }
    lastVoteCount = count;
    
    const btn = document.getElementById('skipVoteBtn');
    const txt = document.getElementById('skipVoteBtnText');
    
    if (btn) {
        if (votes[userVoteId]) {
            btn.disabled = true;
            btn.classList.add('voted');
            if(txt) txt.textContent = 'Você Votou';
        } else {
            btn.disabled = false;
            btn.classList.remove('voted');
            // Verifica Admin ou Modo Solo para definir texto
            const isSolo = safeUserCount <= 1;
            if(txt && !window.isAdminLoggedIn && !isSolo) txt.textContent = 'Votar para Pular';
        }
    }
    
    // Executa o Pulo se atingiu a meta
    if (count >= needed && videoQueue.length > 0) {
        videoQueueRef.child(videoQueue[0].id).remove().then(() => {
            roomRef.child('currentSong/votes').remove();
            showNotification('Pulado por votação!', 'success');
            lastVoteCount = 0;
        });
    }
});

videoQueueRef.on('child_removed', () => {
    roomRef.child('currentSong/votes').remove();
    lastVoteCount = 0;
});

let videoToRemoveId = null;
function openRemoveModalWithId(id) { videoToRemoveId = id; document.getElementById('removeModal').style.display = 'flex'; }
function closeRemoveModal() { document.getElementById('removeModal').style.display = 'none'; videoToRemoveId = null; }

function removeVideo() { 
    const e = document.getElementById('removeAdminName').value;
    const p = document.getElementById('removePassword').value;
    if(!e || !p) return showNotification('Preencha', 'error');
    toggleLoading('removeVideoBtn', true);
    firebase.auth().signInWithEmailAndPassword(e,p).then(()=>{
        if(videoToRemoveId) videoQueueRef.child(videoToRemoveId).remove();
        closeRemoveModal();
        showNotification('Removido', 'success');
    }).catch(()=>showNotification('Senha errada', 'error')).finally(()=>toggleLoading('removeVideoBtn', false));
}

function clearQueue() {
    const e = document.getElementById('adminName').value;
    const p = document.getElementById('clearPassword').value;
    if(!e || !p) return showNotification('Preencha', 'error');
    toggleLoading('clearQueueBtn', true);
    firebase.auth().signInWithEmailAndPassword(e,p).then(()=>{
        videoQueueRef.remove();
        document.getElementById('modal').style.display = 'none';
        showNotification('Fila limpa', 'success');
    }).catch(()=>showNotification('Senha errada', 'error')).finally(()=>toggleLoading('clearQueueBtn', false));
}