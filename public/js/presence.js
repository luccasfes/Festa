// ====================================================================
// SISTEMA DE PLAYER SINCRONIZADO 
// ====================================================================

// --- ESTADO GLOBAL ---
window.currentVideoState = null;
window.broadcasterId = null;
window.myUserId = null;
window.roomId = null;

window.isBroadcaster = false;
window.syncInterval = null;

let lastAppliedMode = null;

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

    console.log(`🔄 Aplicando modo: ${targetMode}`);

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

// Listener do estado do vídeo (CORRIGIDO PARA playerState)
if (typeof firebase !== "undefined" && window.roomId) {
    // Aponta para 'playerState', onde o player.js realmente salva os dados
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
        // 2. Força a atualização do select em tempo real
        if (typeof populateReportUserDropdown === 'function') {
            populateReportUserDropdown();
        }
        onlineUserCount = snap.numChildren();

        // UI
        const elA = document.getElementById("userCount");
        if (elA) elA.textContent = onlineUserCount;

        const elB = document.getElementById("onlineCount");
        if (elB) elB.textContent = onlineUserCount;

        // Broadcaster
        if (users && onlineUserCount > 0) {
            const ids = Object.keys(users);
            window.broadcasterId = ids[0];

            if (window.myPresenceRef) {
                window.myUserId = window.myPresenceRef.key;
            }

            window.isBroadcaster = window.myUserId === window.broadcasterId;
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
// 3. LOGIN ADMIN (VIGIA)
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

// ====================================================================
// 4. VISIBILIDADE DE BOTÕES
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

    // Atualiza texto do botão Pular
    const skipText = document.getElementById("skipVoteBtnText");
    const skipBtn = document.getElementById("skipVoteBtn");
    if (skipText && skipBtn) {
        if (souAdmin) skipText.textContent = "Pular (Admin)";
        else if (sozinho) skipText.textContent = "Pular (Solo)";
        else skipText.textContent = skipBtn.classList.contains("voted") ? "Voto Registrado" : "Votar para Pular";
    }
}

// ====================================================================
// 5. MODO DO PLAYER + SINCRONIZAÇÃO
// ====================================================================

function getCurrentVideoIdAndState() {
    // 1. Prioridade: Estado Global (Firebase) - Essencial para Sincronia
    if (window.currentVideoState && window.currentVideoState.videoId) {
        return {
            videoId: window.currentVideoState.videoId,
            currentTime: window.currentVideoState.currentTime || 0,
        };
    }

    // 2. Fallback: Player atual (se existir)
    if (typeof player !== "undefined" && player?.getVideoData) {
        try {
            return {
                videoId: player.getVideoData().video_id,
                currentTime: player.getCurrentTime(),
            };
        } catch {}
    }

    // 3. Fallback: Fila Local
    if (Array.isArray(videoQueue) && videoQueue.length > 0) {
        const url = videoQueue[0].videoUrl;
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/)([^#&?]*))/);
        if (match) {
            return { videoId: match[1], currentTime: 0 };
        }
    }

    return { videoId: null, currentTime: 0 };
}

// --- MODOS ---
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

// ====================================================================
// 6. RECRIAÇÃO SEGURA DO PLAYER
// ====================================================================

function recreatePlayerSafe(controlsValue) {
    const data = getCurrentVideoIdAndState();

    if (!data.videoId) {
        // Se não achou vídeo, tenta forçar o carregamento da fila se ela estiver vazia
        if ((!videoQueue || videoQueue.length === 0) && typeof loadVideoQueue === 'function') {
            loadVideoQueue();
        }
        console.warn("⚠️ Player não recriado: Nenhum vídeo encontrado.");
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

        console.log(`🎬 Recriando Player [${controlsValue === 1 ? 'COM' : 'SEM'} Controles]. Video: ${data.videoId}`);

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
    iv_load_policy: 3, // Esconde anotações/cards de inscrição
    modestbranding: 1, // Tenta esconder o logo do YouTube na barra
    start: Math.floor(data.currentTime),
},
            events: {
                onReady: (ev) => {
                    // CORREÇÃO 3: Garante o carregamento da fila quando o player volta
                    if (typeof loadVideoQueue === 'function') loadVideoQueue();
                    
                    ev.target.playVideo();
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