// ====================================================================
// FILA DE VÍDEOS (AJUSTADA - PROTEÇÃO CONTRA DOUBLE-SKIP E RACE CONDITIONS)
// ====================================================================

let lastVoteCount = 0; 
let isProcessingSkip = false; // TRAVA DE SEGURANÇA: Evita que o YouTube ou cliques duplos pulem 2 vídeos

async function addVideo(urlArg = null, titleArg = null) {
    let phone = document.getElementById('phone')?.value.trim(); 
    if (!phone) phone = sessionStorage.getItem('ytSessionUser') || '';

    const searchNameInput = document.getElementById('ytSearchName');
    if (!phone && searchNameInput && searchNameInput.value.trim()) {
        phone = searchNameInput.value.trim();
        sessionStorage.setItem('ytSessionUser', phone); 
        currentSessionUser = phone;
    }

    let url = urlArg || document.getElementById('videoUrl')?.value.trim();
    let title = titleArg || null;

    if (!phone) {
        const searchModal = document.getElementById('ytSearchModal');
        if (searchModal && searchModal.style.display === 'flex') {
            showNotification('Digite seu nome no campo acima!', 'error');
            if (searchNameInput) searchNameInput.focus();
        } else {
            if(!urlArg) showNotification('Diga seu nome primeiro!', 'error');
            if(typeof openEditNameModal === 'function') openEditNameModal();
        }
        return;
    }

    if (!url) return showNotification('Cole a URL do vídeo.', 'error');
    const videoId = typeof extractVideoId === 'function' ? extractVideoId(url) : url.split('v=')[1]?.substring(0, 11);
    if (!videoId) return showNotification('URL inválida.', 'error');

    if(typeof toggleLoading === 'function') toggleLoading('addVideoBtn', true);

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
        
        const urlInput = document.getElementById('videoUrl');
        if (!urlArg && urlInput) urlInput.value = '';
        
        if(phone && !sessionStorage.getItem('ytSessionUser')) {
            sessionStorage.setItem('ytSessionUser', phone);
            const d = document.getElementById('userNameDisplay');
            if(d) d.textContent = phone;
        }

    } catch (e) {
        console.error(e);
        showNotification('Erro ao adicionar.', 'error');
    } finally {
        if(typeof toggleLoading === 'function') toggleLoading('addVideoBtn', false);
    }
}

function loadVideoQueue() {
    videoQueueRef.on('value', async (snapshot) => {
        const data = snapshot.val();
        let fetchedQueue = data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : [];

        const BOT_NAME = '🤖 DJ Maestro';
        const currentPlayingId = videoQueue && videoQueue.length > 0 ? videoQueue[0].id : null;
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
    if (!list) return;
    
    list.innerHTML = '';
    
    const isAdmin = (window.isAdminLoggedIn === true);

    if (isAdmin) list.classList.add('admin-mode');
    else list.classList.remove('admin-mode');

    if (!videoQueue || videoQueue.length === 0) {
        list.innerHTML = '<li class="empty-queue" style="text-align:center; padding:20px; color:#888;">Fila vazia.</li>';
        if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
        return;
    }

    videoQueue.forEach((video, index) => {
        const li = document.createElement('li');
        li.className = 'video-item';
        li.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 10px; background: rgba(255, 255, 255, 0.05); margin-bottom: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);";
        
        if (index === 0) li.classList.add('playing');
        if (video.phone === '🤖 DJ Maestro') {
            li.style.opacity = '0.8';
            li.style.borderLeft = '3px solid #777';
        }

        let vId = typeof extractVideoId === 'function' ? extractVideoId(video.videoUrl) : video.videoUrl.split('v=')[1]?.substring(0,11);
        
        const escapeTxt = typeof escapeHtml === 'function' ? escapeHtml : (t) => {
            const div = document.createElement('div');
            div.innerText = t;
            return div.innerHTML;
        };

        const displayTitle = video.title || `Vídeo (ID: ${vId})`;
        const thumbUrl = vId ? `https://img.youtube.com/vi/${vId}/mqdefault.jpg` : '';
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
                    <span class="video-title">${escapeTxt(displayTitle)}</span>
                    <div class="video-meta">
                        <span class="video-added-by" style="color: #6c5ce7;">Por: ${escapeTxt(video.phone)}</span>
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
    if (videoQueue && videoQueue.length > 0) {
        const currentVideo = videoQueue[0];
        const queueVideoId = typeof extractVideoId === 'function' ? extractVideoId(currentVideo.videoUrl) : currentVideo.videoUrl.split('v=')[1]?.substring(0,11);
        
        const u = document.getElementById('currentUser');
        if(u) u.textContent = currentVideo.phone;
        
        const urlD = document.getElementById('currentVideoUrl');
        if(urlD) {
            urlD.textContent = currentVideo.title || 'Tocando...';
            urlD.style.display = 'block';
        }

        if (player && typeof player.loadVideoById === 'function') {
            let pid = null;
            let pState = null;
            try { 
                pid = player.getVideoData().video_id; 
                pState = player.getPlayerState();
            } catch(e){}
            
            // CORREÇÃO: Só força o recarregamento do player se o ID for realmente diferente.
            // Se for o mesmo vídeo, apenas manda dar play se estiver parado (UNSTARTED ou CUED).
            // Isso evita o reload forçado quando o AutoDJ atualiza a fila.
            if (queueVideoId) {
                if (pid !== queueVideoId) {
                    player.loadVideoById(queueVideoId);
                    if(typeof playedVideoHistory !== 'undefined') playedVideoHistory.add(queueVideoId);
                } else if (pState === YT.PlayerState.UNSTARTED || pState === YT.PlayerState.CUED) {
                    if (typeof player.playVideo === 'function') player.playVideo();
                }
            }
        }
    } else {
        const u = document.getElementById('currentUser');
        if(u) u.textContent = 'Nenhum vídeo';
        const urlD = document.getElementById('currentVideoUrl');
        if(urlD) urlD.style.display = 'none';
        lastVoteCount = 0; 

        if (player && typeof player.stopVideo === 'function') {
            player.stopVideo();
        }
    }
}

function handleRemoveVideo(id) {
    const isSolo = (typeof onlineUserCount === 'undefined' || onlineUserCount <= 1);
    
    if (window.isAdminLoggedIn || isSolo) {
        if (isProcessingSkip) return; // Se já está removendo algo, ignora
        isProcessingSkip = true;

        videoQueueRef.child(id).remove()
            .then(() => {
                showNotification('Vídeo removido!', 'success');
                if (typeof runAutoDJCycle === 'function') setTimeout(() => runAutoDJCycle(), 2500);
            })
            .catch((error) => showNotification('Erro ao remover.', 'error'))
            .finally(() => {
                setTimeout(() => { isProcessingSkip = false; }, 1000); // Libera o cadeado após 1 seg
            });
    } else {
        openRemoveModalWithId(id);
    }
}

function handleSkipOrVote() {
    const isSolo = (typeof onlineUserCount === 'undefined' || onlineUserCount <= 1);

    if (window.isAdminLoggedIn || isSolo) {
        if (videoQueue && videoQueue.length > 0) {
            if (isProcessingSkip) return; // Se o YouTube mandar o evento de ENDED duas vezes, barra aqui
            isProcessingSkip = true;

            if(typeof toggleLoading === 'function') toggleLoading('skipVoteBtn', true);
            const idToRemove = videoQueue[0].id; 
            
            videoQueueRef.child(idToRemove).remove()
                .then(() => {
                    showNotification(window.isAdminLoggedIn ? 'Pulado pelo Admin!' : 'Pulado!', 'success');
                    if (typeof runAutoDJCycle === 'function') setTimeout(() => runAutoDJCycle(), 2500);
                })
                .finally(() => {
                    if(typeof toggleLoading === 'function') toggleLoading('skipVoteBtn', false);
                    setTimeout(() => { isProcessingSkip = false; }, 1000); // Libera o cadeado após 1 seg
                });
        } else {
            showNotification('Fila vazia.', 'info');
        }
    } else {
        castVoteToSkip();
    }
}

function handleClearQueue() {
    const isSolo = (typeof onlineUserCount === 'undefined' || onlineUserCount <= 1);

    if (window.isAdminLoggedIn || isSolo) {
        if(confirm('Limpar toda a fila?')) {
            videoQueueRef.remove();
            showNotification('Fila limpa!', 'success');
        }
    } else {
        const modal = document.getElementById('modal');
        if(modal) modal.style.display = 'flex';
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
    if (!videoQueue || videoQueue.length === 0 || (typeof onlineUserCount !== 'undefined' && onlineUserCount < 2)) {
        return showNotification('Não dá pra votar agora.', 'info');
    }
    const votesRef = roomRef.child('currentSong/votes');
    if(typeof toggleLoading === 'function') toggleLoading('skipVoteBtn', true);
    
    votesRef.child(userVoteId).set({
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        userName: currentSessionUser || 'Anônimo'
    }).finally(() => {
        if(typeof toggleLoading === 'function') toggleLoading('skipVoteBtn', false);
    });
}

function updateVotesNeeded() {
    const safeUserCount = (typeof onlineUserCount !== 'undefined' && onlineUserCount > 0) ? onlineUserCount : 1;
    let needed = Math.floor(safeUserCount / 2) + 1;
    if (needed < 2) needed = 2;

    const nEl = document.getElementById('votesNeeded');
    if (nEl) nEl.textContent = needed;
}

if (typeof roomRef !== 'undefined') {
    roomRef.child('currentSong/votes').on('value', snap => {
        const votes = snap.val() || {};
        const count = Object.keys(votes).length;
        
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
                const isSolo = (typeof onlineUserCount === 'undefined' || onlineUserCount <= 1);
                if(txt && !window.isAdminLoggedIn && !isSolo) txt.textContent = 'Votar para Pular';
            }
        }
        
        if (count >= needed && videoQueue && videoQueue.length > 0) {
            if (isProcessingSkip) return; 
            isProcessingSkip = true;

            videoQueueRef.child(videoQueue[0].id).remove().then(() => {
                roomRef.child('currentSong/votes').remove();
                showNotification('Pulado por votação!', 'success');
                lastVoteCount = 0;
                if (typeof runAutoDJCycle === 'function') setTimeout(() => runAutoDJCycle(), 2500);
            }).finally(() => {
                setTimeout(() => { isProcessingSkip = false; }, 1000); // Libera a trava após 1 segundo
            });
        }
    });
}

if (typeof videoQueueRef !== 'undefined') {
    videoQueueRef.on('child_removed', () => {
        if (typeof roomRef !== 'undefined') {
            roomRef.child('currentSong/votes').remove();
        }
        lastVoteCount = 0;
    });
}

let videoToRemoveId = null;
function openRemoveModalWithId(id) { videoToRemoveId = id; const m = document.getElementById('removeModal'); if(m) m.style.display = 'flex'; }
function closeRemoveModal() { const m = document.getElementById('removeModal'); if(m) m.style.display = 'none'; videoToRemoveId = null; }

function removeVideo() { 
    const e = document.getElementById('removeAdminName')?.value;
    const p = document.getElementById('removePassword')?.value;
    if(!e || !p) return showNotification('Preencha os campos', 'error');
    
    if(typeof toggleLoading === 'function') toggleLoading('removeVideoBtn', true);
    
    firebase.auth().signInWithEmailAndPassword(e,p).then(()=>{
        if(videoToRemoveId && typeof videoQueueRef !== 'undefined') videoQueueRef.child(videoToRemoveId).remove();
        closeRemoveModal();
        showNotification('Removido', 'success');
    }).catch(()=>showNotification('Senha errada', 'error')).finally(()=>{
        if(typeof toggleLoading === 'function') toggleLoading('removeVideoBtn', false);
    });
}

function clearQueue() {
    const e = document.getElementById('adminName')?.value;
    const p = document.getElementById('clearPassword')?.value;
    if(!e || !p) return showNotification('Preencha os campos', 'error');
    
    if(typeof toggleLoading === 'function') toggleLoading('clearQueueBtn', true);
    
    firebase.auth().signInWithEmailAndPassword(e,p).then(()=>{
        if (typeof videoQueueRef !== 'undefined') videoQueueRef.remove();
        const m = document.getElementById('modal');
        if(m) m.style.display = 'none';
        showNotification('Fila limpa', 'success');
    }).catch(()=>showNotification('Senha errada', 'error')).finally(()=>{
        if(typeof toggleLoading === 'function') toggleLoading('clearQueueBtn', false);
    });
}