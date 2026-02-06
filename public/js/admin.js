// ====================================================================
// PAINEL DE ADMINISTRAÇÃO & GERENCIAMENTO (VERSÃO FINAL COM BANIMENTO)
// ====================================================================

// --- Funções de Abertura/Fechamento ---

function FuncaoParaAbrirPainel() {
    // Verifica se está logado (ajuste conforme sua lógica de auth)
    if (!window.isAdminLoggedIn && !firebase.auth().currentUser) {
        if(typeof showNotification === 'function') {
            showNotification("Faça login como Admin primeiro.", "error");
        } else {
            alert("Faça login como Admin primeiro.");
        }
        return;
    }

    var modal = document.getElementById('panelModal');
    if (modal) {
        modal.style.display = 'flex';
        loadAdminPanelRooms();
    }
}

function closePanelModal() {
    var modal = document.getElementById('panelModal');
    if (modal) modal.style.display = 'none';
}

// --- Carregamento das Salas e Usuários ---

function loadAdminPanelRooms() {
    var list = document.getElementById('adminRoomList');
    var loader = document.getElementById('adminRoomLoader');
    
    if (!list) return;

    if (loader) loader.style.display = 'flex';
    list.innerHTML = '';

    firebase.database().ref('rooms').once('value')
        .then(function(snapshot) {
            if (loader) loader.style.display = 'none';
            
            if (!snapshot.exists()) {
                list.innerHTML += '<div style="padding:20px; text-align:center; color:#aaa;">Nenhuma sala ativa.</div>';
                return;
            }

            snapshot.forEach(function(childSnapshot) {
                var key = childSnapshot.key;
                var val = childSnapshot.val();

                // 1. DADOS BÁSICOS
                var roomName = val.roomName || 'Sala sem Nome';
                var creatorName = val.creatorName || 'Desconhecido';
                
                // 2. CONTAGEM
                var presence = val.presence || {};
                var banned = val.banned || {};
                var userCount = Object.keys(presence).length;
                var videoCount = val.videoQueue ? Object.keys(val.videoQueue).length : 0;
                var chatCount = (val.chat && val.chat.messages) ? Object.keys(val.chat.messages).length : 0;
                var statusColor = userCount > 0 ? '#00e676' : '#666'; 

                // --- GERAÇÃO DA LISTA DE USUÁRIOS (HTML) ---
                let usersListHTML = '';
                
                // A) Usuários Online
                if(userCount > 0) {
                    usersListHTML += `<div style="margin-top:10px; border-bottom:1px solid #333; padding-bottom:5px; color:#00e676; font-size:0.85rem; font-weight:bold;">ONLINE (${userCount})</div>`;
                    Object.values(presence).forEach(u => {
                        const uName = escapeHtml(u.name || 'Sem Nome');
                        const uDevice = u.deviceId || 'unknown';
                        usersListHTML += `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <div style="width:24px; height:24px; background:#333; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.7rem;">${uName.charAt(0).toUpperCase()}</div>
                                    <div style="display:flex; flex-direction:column;">
                                        <span style="color:#eee; font-size:0.9rem;">${uName}</span>
                                        <span style="color:#666; font-size:0.7rem;">ID: ${uDevice.substr(0,6)}...</span>
                                    </div>
                                </div>
                                <button onclick="adminBanUser('${key}', '${uName}', '${uDevice}')" style="background:rgba(239,68,68,0.2); color:#ef4444; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">
                                    <i class="fas fa-ban"></i> Banir
                                </button>
                            </div>
                        `;
                    });
                } else {
                    usersListHTML += `<div style="padding:10px; color:#666; font-size:0.8rem; text-align:center;">Ninguém online.</div>`;
                }

                // B) Usuários Banidos
                const bannedKeys = Object.keys(banned);
                if(bannedKeys.length > 0) {
                    usersListHTML += `<div style="margin-top:15px; border-bottom:1px solid #333; padding-bottom:5px; color:#ef4444; font-size:0.85rem; font-weight:bold;">BANIDOS (${bannedKeys.length})</div>`;
                    bannedKeys.forEach(bName => {
                        usersListHTML += `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                                <span style="color:#fca5a5; font-size:0.9rem;">🚫 ${escapeHtml(bName)}</span>
                                <button onclick="adminUnbanUser('${key}', '${escapeHtml(bName)}')" style="background:rgba(255,255,255,0.1); color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">
                                    Desbanir
                                </button>
                            </div>
                        `;
                    });
                }

                // --- MONTAGEM DO CARD ---
                var item = document.createElement('div');
                item.className = 'admin-room-item';
                item.style.marginBottom = '15px';
                
                item.innerHTML = `
                    <div class="room-header" style="margin-bottom:0;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                            <h5 class="room-name" style="margin:0; font-size:1.1rem; color: white; font-weight: 600;">
                                ${escapeHtml(roomName)}
                            </h5>
                            <span class="room-id" style="font-family:monospace; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:4px; font-size:0.8rem; color:#aaa; border: 1px solid rgba(255,255,255,0.05);">
                                ${key}
                            </span>
                        </div>
                        
                        <div style="font-size: 0.9rem; color: #ddd; margin-bottom: 12px;">
                            Criador: <strong>${escapeHtml(creatorName)}</strong>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 8px; margin-bottom: 10px;">
                            <div style="text-align: center; color: ${statusColor};">
                                <i class="fas fa-users"></i> <b>${userCount}</b>
                            </div>
                            <div style="text-align: center; color: #29b6f6;">
                                <i class="fas fa-music"></i> <b>${videoCount}</b>
                            </div>
                            <div style="text-align: center; color: #ffca28;">
                                <i class="fas fa-comments"></i> <b>${chatCount}</b>
                            </div>
                        </div>

                        <div id="users-area-${key}" style="display:none; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; margin-bottom:10px;">
                            ${usersListHTML}
                        </div>
                    </div>

                    <div class="room-actions" style="margin-top: 10px; display:flex; gap:8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                        <button class="btn small" onclick="toggleUserList('${key}')" style="flex:1; background:rgba(255,255,255,0.05); color:#fff;">
                            <i class="fas fa-user-cog"></i> Gerenciar
                        </button>
                        <button class="btn small secondary" onclick="entrarNaSalaPeloAdmin('${key}')" style="flex:1;">
                            <i class="fas fa-sign-in-alt"></i> Entrar
                        </button>
                        <button class="btn small danger" onclick="confirmDeleteRoom('${key}')" style="width: 40px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;

                list.appendChild(item);
            });
        })
        .catch(function(error) {
            console.error(error);
            if (loader) loader.style.display = 'none';
            list.innerHTML = '<div style="padding:20px; text-align:center; color: #ff5252;">Erro ao carregar salas.</div>';
        });
}

// --- LÓGICA DE INTERFACE (TOGGLE) ---
function toggleUserList(roomId) {
    var area = document.getElementById('users-area-' + roomId);
    if(area) {
        if(area.style.display === 'none') {
            area.style.display = 'block';
        } else {
            area.style.display = 'none';
        }
    }
}

// --- AÇÕES DO ADMIN (BANIR / ENTRAR / APAGAR) ---

function adminBanUser(roomId, userName, deviceId) {
    if(!confirm(`Tem certeza que deseja banir "${userName}" desta sala?`)) return;

    var updates = {};
    // Bane o Nome
    updates[`rooms/${roomId}/banned/${userName}`] = true;
    // Bane o ID do dispositivo (se existir e não for unknown)
    if(deviceId && deviceId !== 'unknown') {
        updates[`rooms/${roomId}/banned/${deviceId}`] = true;
    }

    firebase.database().ref().update(updates).then(() => {
        // Opcional: Recarregar a lista para ver a mudança imediata
        loadAdminPanelRooms();
    }).catch(e => alert("Erro ao banir: " + e.message));
}

function adminUnbanUser(roomId, target) {
    if(!confirm(`Remover banimento de "${target}"?`)) return;
    
    firebase.database().ref(`rooms/${roomId}/banned/${target}`).remove().then(() => {
        loadAdminPanelRooms();
    });
}

function entrarNaSalaPeloAdmin(roomId) {
    // Define bypass para não pedir senha
    sessionStorage.setItem(`bypass_pw_${roomId}`, 'true');
    window.location.href = 'index.html?room=' + roomId;
}

function confirmDeleteRoom(roomId) {
    if(confirm('ATENÇÃO: Isso apagará a sala ' + roomId + ' para todos!\nConfirmar exclusão?')) {
        firebase.database().ref('rooms/' + roomId).remove()
            .then(function() { 
                loadAdminPanelRooms(); 
            });
    }
}

// --- FAXINEIRO (LIMPEZA AUTOMÁTICA) ---
async function limparSalasVazias() {
    if(!confirm("Isso vai apagar salas vazias há mais de 24h.\nDeseja continuar?")) return;

    try {
        const snapshot = await firebase.database().ref('rooms').once('value');
        if (!snapshot.exists()) return alert("Não há salas.");

        const agora = Date.now();
        const H24 = 24 * 60 * 60 * 1000; 
        let deleted = 0;
        const updates = {};

        snapshot.forEach((child) => {
            const r = child.val();
            const id = child.key;
            const presence = r.presence || {};
            const userCount = Object.keys(presence).length;

            // Se tem gente, remove flag de vazia
            if (userCount > 0) {
                if (r.emptySince) updates[`rooms/${id}/emptySince`] = null;
                return; 
            }
            
            // Protege salas sem data ou muito novas
            if (!r.createdAt || (agora - r.createdAt < H24)) {
                if (r.emptySince) updates[`rooms/${id}/emptySince`] = null;
                return;
            }

            // Lógica de exclusão
            if (userCount === 0) {
                if (!r.emptySince) {
                    updates[`rooms/${id}/emptySince`] = agora;
                } else if ((agora - r.emptySince) >= H24) {
                    updates[`rooms/${id}`] = null;
                    deleted++;
                }
            }
        });

        if (Object.keys(updates).length > 0) await firebase.database().ref().update(updates);
        
        alert(deleted > 0 ? `Faxina: ${deleted} salas apagadas.` : "Nenhuma sala antiga vazia encontrada.");
        loadAdminPanelRooms();

    } catch (error) {
        console.error(error);
        alert("Erro na faxina: " + error.message);
    }
}

// --- UTIL ---
function escapeHtml(text) {
    if (!text) return text;
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ==========================================================
// PREVENÇÃO DE FECHAMENTO ACIDENTAL (MODAL FORTE)
// ==========================================================
// Adiciona o listener para impedir fechar clicando fora
// Aplica para o Modal de Senha E para o Painel Admin
window.addEventListener('click', function(e) {
    const passModal = document.getElementById('roomPasswordModal');
    const adminModal = document.getElementById('panelModal');
    
    // Função para aplicar o efeito de "não pode fechar"
    const shakeModal = (modalElement) => {
        const content = modalElement.querySelector('.modal-content') || modalElement.querySelector('.admin-panel-content');
        if(content) {
            content.style.transition = "transform 0.1s";
            content.style.transform = "scale(1.02)";
            setTimeout(() => content.style.transform = "scale(1)", 150);
        }
    };

    if (passModal && e.target === passModal) {
        e.stopPropagation();
        e.preventDefault();
        shakeModal(passModal);
    }

    if (adminModal && e.target === adminModal) {
        e.stopPropagation();
        e.preventDefault();
        shakeModal(adminModal);
    }
}, true);