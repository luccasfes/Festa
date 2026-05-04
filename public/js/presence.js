// ====================================================================
// SISTEMA DE PLAYER SINCRONIZADO 
// ====================================================================

// --- ESTADO GLOBAL ---
window.currentVideoState = null;
window.broadcasterId = null;
window.myUserId = null;
window.roomId = null;

window.isBroadcaster = false;
window.hasAdminOnline = false; // Adicionado apenas a flag no window (seguro)
window.syncInterval = null;

let lastAppliedMode = null;
// A variável onlineUserCount foi removida daqui porque ela já vem de outro arquivo!

// ====================================================================
// 1. DETERMINAÇÃO DE MODO (ADMIN / SOLO / FESTA)
// ====================================================================

function determineAndApplyPlayerMode() {
    let targetMode = "";

    if (window.isAdminLoggedIn === true) {
        targetMode = "ADMIN";
    } else if (onlineUserCount <= 1) {
        targetMode = "SOLO";
    } else {
        targetMode = "FESTA";
    }

    if (typeof updateAdminButtonsVisibility === "function") {
        updateAdminButtonsVisibility();
    }

    // Evita recriar o player se o modo não mudou
    if (targetMode === lastAppliedMode) {
        // Se o player já existe e tem vídeo, não faz nada
        if (typeof player !== "undefined" && player?.getVideoData) {
            try {
                const vid = player.getVideoData().video_id;
                if (vid) return; 
            } catch(e) {}
        }
    }

    lastAppliedMode = targetMode;

    // Atualiza CSS do Body
    if (targetMode === "FESTA") {
        document.body.classList.add("festa-mode");
        document.body.classList.remove("solo-mode");
    } else {
        document.body.classList.add("solo-mode");
        document.body.classList.remove("festa-mode");
    }

   // Troca de modos
    if (targetMode === "ADMIN") {
        forceAdminPlayer();
    } else if (targetMode === "SOLO") {
        forceSoloPlayer();
    } else {
        forceNormalPlayer();
    }
}

// ====================================================================
// 2. LISTENERS FIREBASE (PRESENÇA, ESTADO DO VÍDEO)
// ====================================================================

// Listener do estado do vídeo
if (typeof firebase !== "undefined" && window.roomId) {
    window.currentVideoRef = firebase.database().ref(`rooms/${window.roomId}/playerState`);

    currentVideoRef.on("value", (snap) => {
        window.currentVideoState = snap.val();
        // Se chegou dado novo e o player não existe, tenta criar agora
        if (!player && window.currentVideoState) {
            determineAndApplyPlayerMode();
        }
    });
}

// Listener de presença
if (typeof presenceRef !== "undefined") {
    presenceRef.on("value", (snap) => {
        const users = snap.val();
        window.currentOnlineUsers = users || {}; // Guarda a lista globalmente
        
        // Força a atualização do select em tempo real
        if (typeof populateReportUserDropdown === 'function') {
            populateReportUserDropdown();
        }
        onlineUserCount = snap.numChildren();

        // UI
        const elA = document.getElementById("userCount");
        if (elA) elA.textContent = onlineUserCount;

        const elB = document.getElementById("onlineCount");
        if (elB) elB.textContent = onlineUserCount;

        renderUserListDropdown(users);

        // --- CORREÇÃO 1: Broadcaster respeitando a hierarquia do Admin ---
        if (users && onlineUserCount > 0) {
            const ids = Object.keys(users);
            
            if (window.myPresenceRef) {
                window.myUserId = window.myPresenceRef.key;
            }

            let adminOnline = false;
            let firstAdminId = null;

            for (let id of ids) {
                if (users[id] && users[id].isAdmin === true) {
                    adminOnline = true;
                    firstAdminId = id;
                    break;
                }
            }

            window.hasAdminOnline = adminOnline;

            if (window.hasAdminOnline) {
                window.broadcasterId = firstAdminId;
                window.isBroadcaster = false; 
            } else {
                window.broadcasterId = ids[0];
                window.isBroadcaster = (window.myUserId === window.broadcasterId);
            }
        }

        if (typeof updateVotesNeeded === "function") updateVotesNeeded();

        determineAndApplyPlayerMode();
    });
}

// Listener de conexão
if (typeof connectedRef !== "undefined") {
    connectedRef.on("value", (snap) => {
        if (snap.val() === true) {
            const name = sessionStorage.getItem("ytSessionUser") || "Visitante";

            if (window.myPresenceRef) window.myPresenceRef.remove();

            window.myPresenceRef = presenceRef.push();
            window.myPresenceRef.onDisconnect().remove();

            window.myPresenceRef
                .set({
                    name,
                    isAdmin: window.isAdminLoggedIn || false,
                    joinedAt: firebase.database.ServerValue.TIMESTAMP,
                    deviceId: window.getDeviceId() || 'unknown'
                })
                .then(() => {
                    if (roomRef)
                        roomRef.child("emptySince").remove().catch(() => {});
                })
                .catch(() => {});
        }
    });
}

// Dados da sala (UI)
if (typeof roomRef !== "undefined") {
    roomRef.on("value", (snap) => {
        const data = snap.val();
        if (!data) return;
        const rn = document.getElementById("roomNameDisplay");
        const rc = document.getElementById("roomCreatorDisplay");
        if (rn) rn.textContent = data.roomName || "Sala";
        if (rc) rc.textContent = data.creatorName || "Desconhecido";
    });
}

// ====================================================================
// 3. LOGIN ADMIN E INICIALIZAÇÃO
// ====================================================================

document.addEventListener("DOMContentLoaded", () => {
    const adminBtn = document.getElementById("adminUnlockBtn");

    function setAdminState(isLogged) {
        window.isAdminLoggedIn = isLogged;
        determineAndApplyPlayerMode();
    }

    if (adminBtn) {
        const obs = new MutationObserver((mut) => {
            mut.forEach((m) => {
                if (m.attributeName === "class") {
                    setAdminState(adminBtn.classList.contains("admin-logged-in"));
                }
            });
        });
        obs.observe(adminBtn, { attributes: true });

        setTimeout(() => {
            if (adminBtn.classList.contains("admin-logged-in") || window.isAdminLoggedIn) {
                setAdminState(true);
            }
        }, 500);
    }
    
    // Garante que a fila carregue assim que possível
    if (typeof loadVideoQueue === 'function') {
        loadVideoQueue(); 
    }
});

// Inicialização de segurança
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        if (typeof presenceRef !== "undefined") {
            presenceRef.once("value", (snap) => {
                onlineUserCount = snap.numChildren();
                determineAndApplyPlayerMode();
            });
        }
    }, 1000);
});

// ====================================================================
// 4. VISIBILIDADE DE BOTÕES E PLAYER
// ====================================================================

function updateAdminButtonsVisibility() {
    const souAdmin = window.isAdminLoggedIn === true;
    const sozinho = onlineUserCount <= 1;
    const festa = !souAdmin && !sozinho;

    document.querySelectorAll(".remove-button").forEach((el) => {
        el.style.display = souAdmin || sozinho ? "block" : "none";
    });

    const mask = document.getElementById("player-mask");
    const overlay = document.querySelector(".player-overlay-controls");

    if (mask) {
        mask.style.display = "block";
        mask.style.pointerEvents = festa ? "auto" : "none";
        mask.style.background = festa ? "rgba(0,0,0,0.01)" : "transparent";
    }

    if (overlay) overlay.style.display = festa ? "flex" : "none";

    const adminOnly = ["#bulkRemoveBtn", "#clearChatBtn", "#panelBtn"];
    adminOnly.forEach((sel) => {
        const el = document.querySelector(sel);
        if (el) el.style.display = souAdmin ? "inline-flex" : "none";
    });

    const adminOrSolo = ["#btn-auto-sugestao", ".clear-queue-button"];
    adminOrSolo.forEach((sel) => {
        const el = document.querySelector(sel);
        if (el) el.style.display = souAdmin || sozinho ? "inline-flex" : "none";
    });

    // Atualiza texto do botão Pular (Admins e usuários votam)
    const skipText = document.getElementById("skipVoteBtnText");
    const skipBtn = document.getElementById("skipVoteBtn");
    if (skipText && skipBtn) {
        if (sozinho) {
            skipText.textContent = "Pular (Solo)";
        } else {
            skipText.textContent = skipBtn.classList.contains("voted") ? "Voto Registrado" : "Votar para Pular";
        }
    }
}

// --- CORREÇÃO 2: Cálculo de tempo puxando o Offset do Servidor ---
function getCurrentVideoIdAndState() {
    if (window.currentVideoState && window.currentVideoState.videoId) {
        let calcTime = 0;
        if (typeof getStateVideoTime === 'function') {
            calcTime = getStateVideoTime(window.currentVideoState);
        } else {
            calcTime = Number(window.currentVideoState.videoTime ?? window.currentVideoState.currentTime ?? 0);
        }
        
        return {
            videoId: window.currentVideoState.videoId,
            currentTime: calcTime,
        };
    }
    if (typeof player !== "undefined" && player?.getVideoData) {
        try {
            return {
                videoId: player.getVideoData().video_id,
                currentTime: player.getCurrentTime(),
            };
        } catch {}
    }
    if (Array.isArray(videoQueue) && videoQueue.length > 0) {
        const url = videoQueue[0].videoUrl;
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/)([^#&?]*))/);
        if (match) return { videoId: match[1], currentTime: 0 };
    }
    return { videoId: null, currentTime: 0 };
}

function forceAdminPlayer() {
    if (!window.isAdminLoggedIn) return;
    recreatePlayerSafe(1);
}

function forceSoloPlayer() {
    if (window.isAdminLoggedIn || onlineUserCount > 1) return;
    recreatePlayerSafe(1);
}

function forceNormalPlayer() {
    if (window.isAdminLoggedIn || onlineUserCount <= 1) return;
    recreatePlayerSafe(0);
}

function recreatePlayerSafe(controlsValue) {
    const data = getCurrentVideoIdAndState();

    if (!data.videoId) {
        if ((!videoQueue || videoQueue.length === 0) && typeof loadVideoQueue === 'function') {
            loadVideoQueue();
        }
        return;
    }

    const container = document.getElementById("videoPlayer");

    if (container) {
        const novo = document.createElement("div");
        novo.id = "videoPlayer";
        container.replaceWith(novo);
    }

    setTimeout(() => {
        if (!YT?.Player) return;

        player = new YT.Player("videoPlayer", {
            height: "100%",
            width: "100%",
            videoId: data.videoId,
            playerVars: {
                autoplay: 1,
                controls: controlsValue,
                disablekb: controlsValue === 0 ? 1 : 0,
                rel: 0,
                fs: 1,
                iv_load_policy: 3, 
                modestbranding: 1, 
                start: Math.floor(data.currentTime),
            },
            events: {
                // --- CORREÇÃO 3: Aplica o tempo remotamente pro visitante ao recriar player ---
                onReady: (ev) => {
                    if (typeof loadVideoQueue === 'function') loadVideoQueue();
                    
                    if (typeof isPlayerReady !== 'undefined') isPlayerReady = true;

                    if (controlsValue === 0 && typeof applyRemoteState === 'function') {
                        const state = window.latestPlayerState || window.currentVideoState;
                        applyRemoteState(state, 'recreate-ready');
                    } else {
                        ev.target.playVideo();
                    }

                    if (controlsValue === 0) {
                        const iframe = ev.target.getIframe();
                        if (iframe) iframe.style.pointerEvents = "none";
                    }
                },
                onStateChange: (ev) => {
                    if (typeof onPlayerStateChange === "function") {
                        onPlayerStateChange(ev);
                    }
                },
            },
        });
    }, 150);
}


// 5. FUNÇÕES DO MODAL DE USUÁRIOS ONLINE
function openUsersModal() {
    document.getElementById('usersModal').style.display = 'flex';
}

function closeUsersModal() {
    document.getElementById('usersModal').style.display = 'none';
}

function renderUserListDropdown(usersObj) {
    const container = document.getElementById('userListContent');
    if (!container) return;

    container.innerHTML = ''; 
    
    if (!usersObj) return;

    const users = Object.values(usersObj);
    
    if (users.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #aaa;">Ninguém online.</p>';
        return;
    }

    users.forEach((user, index) => {
        const initial = (user.name || '?').charAt(0).toUpperCase();
        const color = ['#6366f1', '#ec4899', '#10b981', '#f59e0b'][index % 4];
        const adminBadge = user.isAdmin ? '<i class="fas fa-crown" style="color:#f59e0b; font-size: 0.9rem; margin-left: 8px;" title="Dono da Sala"></i>' : '';

        const div = document.createElement('div');
        div.className = 'user-list-item';
        
        const safeName = user.name ? user.name.replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'Visitante';

        div.innerHTML = `
            <div class="user-list-avatar" style="background:${color}">${initial}</div>
            <div class="user-list-name">${safeName}${adminBadge}</div>
        `;
        container.appendChild(div);
    });
}

// Fecha o modal ao clicar fora dele
window.addEventListener('click', (event) => {
    const usersModal = document.getElementById('usersModal');
    if (event.target === usersModal) {
        closeUsersModal();
    }
});