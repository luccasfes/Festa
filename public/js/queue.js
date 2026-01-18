// ====================================================================
// FILA DE VÍDEOS E SISTEMA DE VOTAÇÃO (COM NOTIFICAÇÃO)
// ====================================================================

let lastVoteCount = 0; // Para controlar notificação de novos votos

async function addVideo(urlArg = null, titleArg = null) {
    let phone = document.getElementById('phone').value.trim(); 
    if (!phone) phone = sessionStorage.getItem('ytSessionUser') || '';

    // Pega nome do modal de busca se necessário
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
        const isSearchOpen = searchModal && searchModal.style.display === 'flex';

        if (isSearchOpen) {
            showNotification('Digite seu nome no campo acima para adicionar!', 'error');
            if (searchNameInput) {
                searchNameInput.focus();
                searchNameInput.style.border = "2px solid #ff4444";
                setTimeout(() => { searchNameInput.style.border = ""; }, 2000);
            }
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

        // SUA REGRA PERMITE ISSO (videoQueue: write true)
        await videoQueueRef.push({ phone, videoUrl: url, title });

        showNotification('Vídeo adicionado na Fila!', 'success');
        if (!urlArg) document.getElementById('videoUrl').value = '';
        
        if(phone && !sessionStorage.getItem('ytSessionUser')) {
            sessionStorage.setItem('ytSessionUser', phone);
            const d = document.getElementById('userNameDisplay');
            if(d) d.textContent = phone;
        }

    } catch (e) {
        console.error(e);
        showNotification('Erro ao adicionar. Tente novamente.', 'error');
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
    
    const checkboxDisplay = isAdminLoggedIn ? 'block' : 'none';
    const removeBtnDisplay = (isAdminLoggedIn || onlineUserCount <= 1) ? 'block' : 'none';

    if (isAdminLoggedIn) list.classList.add('admin-mode');
    else list.classList.remove('admin-mode');

    if (videoQueue.length === 0) {
        list.innerHTML = '<li class="empty-queue" style="text-align:center; padding:20px; color:#888;">Fila vazia.</li>';
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

        const checkboxHtml = `
            <div class="bulk-delete-controls" style="margin-right:10px; display: ${checkboxDisplay};">
                <input type="checkbox" class="video-select-checkbox" data-videoid="${video.id}">
            </div>`;

        const removeBtnHtml = `
            <button class="remove-button" onclick="handleRemoveVideo('${video.id}')" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:1.1rem; display: ${removeBtnDisplay};">
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
                if(typeof playedVideoHistory !== 'undefined') playedVideoHistory.add(queueVideoId);
            }
        }
    } else {
        const u = document.getElementById('currentUser');
        if(u) u.textContent = 'Nenhum vídeo';
        const urlD = document.getElementById('currentVideoUrl');
        if(urlD) urlD.style.display = 'none';
        
        lastVoteCount = 0; // Reseta votos visualmente
    }
}

// Ações 
// remove da fila 
function handleRemoveVideo(id) {
    // Verifica se é admin ou se a sala está vazia (modo livre)
    if (isAdminLoggedIn || onlineUserCount <= 1) {
        
        // Remove do Firebase e DEPOIS mostra a notificação
        videoQueueRef.child(id).remove()
            .then(() => {
                showNotification('Vídeo removido da fila!', 'success');
            })
            .catch((error) => {
                console.error(error);
                showNotification('Erro ao remover vídeo.', 'error');
            });

    } else {
        // Se não for admin e tiver gente na sala, abre o modal de senha
        openRemoveModalWithId(id);
    }
}

// Skipa o voto
function handleSkipOrVote() {
    if (isAdminLoggedIn || onlineUserCount <= 1) {
        if (videoQueue.length > 0) videoQueueRef.child(videoQueue[0].id).remove();
    } else {
        castVoteToSkip();
    }
}

function handleClearQueue() {
    if (isAdminLoggedIn || onlineUserCount <= 1) {
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

    if (isAdminLoggedIn) {
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

// Votação
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

// LISTENER DE VOTOS (Com notificação que você pediu)
roomRef.child('currentSong/votes').on('value', snap => {
    const votes = snap.val() || {};
    const count = Object.keys(votes).length;
    const needed = Math.max(2, Math.ceil(onlineUserCount * 0.5));
    
    const cEl = document.getElementById('voteCount');
    if(cEl) cEl.textContent = count;
    const nEl = document.getElementById('votesNeeded');
    if(nEl) nEl.textContent = needed;

    // === NOTIFICAÇÃO DISCRETA QUANDO ALGUÉM VOTA ===
    if (count > lastVoteCount && count > 0 && onlineUserCount > 1) {
        if (count < needed) {
            showNotification(`Alguém votou para pular (${count}/${needed})`, 'info');
        }
    }
    lastVoteCount = count;
    // ===============================================

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
            // O presence.js pode sobrescrever isso, mas aqui garantimos o estado correto
            if(txt && !isAdminLoggedIn && onlineUserCount > 1) txt.textContent = 'Votar para Pular';
        }
    }

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

// Modais
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