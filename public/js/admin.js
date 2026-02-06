// ====================================================================
// PAINEL DE ADMINISTRAÇÃO & GERENCIAMENTO (VERSÃO COM SUB-VIEW)
// ====================================================================

// Variável global para saber qual sala está aberta no gerenciador
let currentAdminRoomId = null;

// --- Abertura/Fechamento do Modal ---

function FuncaoParaAbrirPainel() {
    // Verificação de Auth (ajuste conforme seu sistema)
    // if (!window.isAdminLoggedIn) return alert("Faça login como Admin.");

    var modal = document.getElementById('panelModal');
    if (modal) {
        modal.style.display = 'flex';
        // Sempre reseta para a visão de lista ao abrir
        backToRooms(false); 
        loadAdminPanelRooms();
    }
}

function closePanelModal() {
    var modal = document.getElementById('panelModal');
    if (modal) modal.style.display = 'none';
}

// --- Navegação entre Views (Lista <-> Gerenciador) ---

function backToRooms(reload = true) {
    document.getElementById('adminUsersView').style.display = 'none';
    document.getElementById('adminRoomsView').style.display = 'block';
    currentAdminRoomId = null;
    if(reload) loadAdminPanelRooms();
}

function openRoomManager(roomId, roomName) {
    currentAdminRoomId = roomId;

    // 1. Troca a interface
    document.getElementById('adminRoomsView').style.display = 'none';
    document.getElementById('adminUsersView').style.display = 'flex';

    // 2. Atualiza cabeçalho
    document.getElementById('adminUsersRoomTitle').innerText = roomName || 'Sala sem Nome';
    document.getElementById('adminUsersRoomId').innerText = 'ID: ' + roomId;
    document.getElementById('adminUsersList').innerHTML = ''; // Limpa anterior

    // 3. Carrega dados da sala específica
    loadRoomUsersData(roomId);
}

// --- Carregamento: Lista de Salas (VIEW 1) ---

function loadAdminPanelRooms() {
    var list = document.getElementById('adminRoomList');
    var loader = document.getElementById('adminRoomLoader');
    
    if (!list) return;
    if (loader) loader.style.display = 'block';
    list.innerHTML = '';

    firebase.database().ref('rooms').once('value')
        .then(function(snapshot) {
            if (loader) loader.style.display = 'none';
            
            if (!snapshot.exists()) {
                list.innerHTML = '<div style="padding:20px; text-align:center; color:#aaa;">Nenhuma sala ativa.</div>';
                return;
            }

            snapshot.forEach(function(childSnapshot) {
                var key = childSnapshot.key;
                var val = childSnapshot.val();

                // Dados
                var roomName = val.roomName || 'Sala sem Nome';
                var creatorName = val.creatorName || 'Desconhecido';
                
                // Contagens
                var presence = val.presence || {};
                var userCount = Object.keys(presence).length;
                var videoCount = val.videoQueue ? Object.keys(val.videoQueue).length : 0;
                var chatCount = (val.chat && val.chat.messages) ? Object.keys(val.chat.messages).length : 0;
                var statusColor = userCount > 0 ? '#00e676' : '#666'; 

                // --- CARD SIMPLIFICADO (Sem lista de users) ---
                var item = document.createElement('div');
                item.className = 'admin-room-item';
                item.style.marginBottom = '15px';
                item.style.background = 'rgba(255,255,255,0.05)';
                item.style.border = '1px solid rgba(255,255,255,0.1)';
                item.style.borderRadius = '8px';
                item.style.padding = '15px';
                
                item.innerHTML = `
                    <div class="room-header">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
                            <h5 style="margin:0; font-size:1.1rem; color: white; font-weight: 600;">${escapeHtml(roomName)}</h5>
                            <span style="font-family:monospace; background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; font-size:0.75rem; color:#aaa;">${key}</span>
                        </div>
                        
                        <div style="font-size: 0.85rem; color: #bbb; margin-bottom: 12px;">
                            Criador: <strong style="color:#ddd;">${escapeHtml(creatorName)}</strong>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 8px; margin-bottom: 12px;">
                            <div style="text-align: center; color: ${statusColor};" title="Usuários Online">
                                <i class="fas fa-users"></i> <b>${userCount}</b>
                            </div>
                            <div style="text-align: center; color: #29b6f6;" title="Vídeos na Fila">
                                <i class="fas fa-music"></i> <b>${videoCount}</b>
                            </div>
                            <div style="text-align: center; color: #ffca28;" title="Mensagens no Chat">
                                <i class="fas fa-comments"></i> <b>${chatCount}</b>
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; gap:8px;">
                        <button class="btn small" onclick="openRoomManager('${key}', '${escapeHtml(roomName)}')" 
                                style="flex:1; background:rgba(255,255,255,0.1); color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer;">
                            <i class="fas fa-user-cog"></i> Gerenciar
                        </button>
                        
                        <button class="btn small secondary" onclick="entrarNaSalaPeloAdmin('${key}')" 
                                style="flex:1; background:#2196f3; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">
                            <i class="fas fa-sign-in-alt"></i> Entrar
                        </button>
                        
                        <button class="btn small danger" onclick="confirmDeleteRoom('${key}')" 
                                style="width: 40px; background:rgba(244,67,54,0.2); color:#ff5252; border:none; borderRadius:4px; cursor:pointer;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;

                list.appendChild(item);
            });
        })
        .catch(err => {
            if (loader) loader.style.display = 'none';
            list.innerHTML = '<div style="color:red; text-align:center;">Erro ao carregar salas.</div>';
            console.error(err);
        });
}

// --- Carregamento: Detalhes da Sala (VIEW 2) ---

function loadRoomUsersData(roomId) {
    var listDiv = document.getElementById('adminUsersList');
    var loader = document.getElementById('adminUsersListLoader');
    
    loader.style.display = 'block';
    
    firebase.database().ref('rooms/' + roomId).once('value')
        .then(function(snapshot) {
            loader.style.display = 'none';
            if(!snapshot.exists()) {
                listDiv.innerHTML = "<p>Sala não encontrada ou deletada.</p>";
                return;
            }
            
            var val = snapshot.val();
            renderRoomUsers(roomId, val);
        });
}

function renderRoomUsers(roomId, roomData) {
    var container = document.getElementById('adminUsersList');
    var html = '';

    var presence = roomData.presence || {};
    var banned = roomData.banned || {};
    var onlineUsers = Object.values(presence);
    var bannedKeys = Object.keys(banned);

    // 1. USUÁRIOS ONLINE
    html += `<h5 style="color:#00e676; margin: 10px 0; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
                <i class="fas fa-wifi"></i> ONLINE (${onlineUsers.length})
             </h5>`;
    
    if (onlineUsers.length > 0) {
        onlineUsers.forEach(u => {
            var uName = escapeHtml(u.name || 'Sem Nome');
            var uDevice = u.deviceId || 'unknown';
            
            html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); margin-bottom:5px; padding:10px; border-radius:6px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:30px; height:30px; background:#333; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                        ${uName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="color:#eee; font-weight:500;">${uName}</div>
                        <div style="color:#666; font-size:0.75rem; font-family:monospace;">${uDevice.substr(0,10)}...</div>
                    </div>
                </div>
                <button onclick="adminBanUser('${roomId}', '${uName}', '${uDevice}')" 
                        style="background:rgba(239,68,68,0.2); color:#ef4444; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                    <i class="fas fa-ban"></i> Banir
                </button>
            </div>`;
        });
    } else {
        html += `<div style="padding:15px; color:#666; text-align:center; font-style:italic;">Nenhum usuário online no momento.</div>`;
    }

    // 2. USUÁRIOS BANIDOS
    html += `<h5 style="color:#ef4444; margin: 25px 0 10px 0; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
                <i class="fas fa-user-slash"></i> BANIDOS (${bannedKeys.length})
             </h5>`;

    if (bannedKeys.length > 0) {
        bannedKeys.forEach(bName => {
            html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(60,20,20,0.3); margin-bottom:5px; padding:10px; border-radius:6px; border-left: 3px solid #ef4444;">
                <span style="color:#fca5a5;">🚫 ${escapeHtml(bName)}</span>
                <button onclick="adminUnbanUser('${roomId}', '${escapeHtml(bName)}')" 
                        style="background:rgba(255,255,255,0.1); color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                    Desbanir
                </button>
            </div>`;
        });
    } else {
        html += `<div style="padding:10px; color:#666;">Ninguém banido.</div>`;
    }

    container.innerHTML = html;
}

// --- Ações: Banir / Desbanir / Apagar ---

function adminBanUser(roomId, userName, deviceId) {
    if(!confirm(`Banir "${userName}"? Ele será removido da sala.`)) return;

    var updates = {};
    updates[`rooms/${roomId}/banned/${userName}`] = true;
    if(deviceId && deviceId !== 'unknown') {
        updates[`rooms/${roomId}/banned/${deviceId}`] = true;
    }

    // Remove também da presence para "chutar" imediatamente (opcional, mas recomendado)
    // Para remover da presence, precisamos achar a chave do usuario, mas o update acima previne reentrada.
    
    firebase.database().ref().update(updates).then(() => {
        // Recarrega a view de detalhes se estivermos nela
        if(currentAdminRoomId === roomId) {
            loadRoomUsersData(roomId);
        }
    }).catch(e => alert("Erro: " + e.message));
}

function adminUnbanUser(roomId, target) {
    if(!confirm(`Desbanir "${target}"?`)) return;
    
    firebase.database().ref(`rooms/${roomId}/banned/${target}`).remove().then(() => {
        if(currentAdminRoomId === roomId) {
            loadRoomUsersData(roomId);
        }
    });
}

function confirmDeleteRoom(roomId) {
    if(confirm('Apagar sala permanentemente?')) {
        firebase.database().ref('rooms/' + roomId).remove()
            .then(() => {
                // Se apagou a sala que estava aberta no gerenciador, volta
                if (currentAdminRoomId === roomId) backToRooms(true);
                else loadAdminPanelRooms();
            });
    }
}

function entrarNaSalaPeloAdmin(roomId) {
    sessionStorage.setItem(`bypass_pw_${roomId}`, 'true');
    window.location.href = 'index.html?room=' + roomId;
}

// --- Utils ---
function escapeHtml(text) {
    if (!text) return text;
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// --- FAXINEIRO (LIMPEZA DE SALAS VAZIAS) ---
async function limparSalasVazias() {
    // 1. Confirmação de segurança
    if(!confirm("Isso fará uma varredura nas salas vazias.\nDeseja continuar?")) return;

    var loader = document.getElementById('adminRoomLoader');
    if(loader) loader.style.display = 'block';

    try {
        // 2. Busca todas as salas
        const snapshot = await firebase.database().ref('rooms').once('value');
        
        if (!snapshot.exists()) {
            if(loader) loader.style.display = 'none';
            return alert("Não há salas para verificar.");
        }

        const agora = Date.now();
        const H24 = 24 * 60 * 60 * 1000; // 24 Horas em milissegundos
        let deleted = 0;
        const updates = {};

        // 3. Analisa cada sala
        snapshot.forEach((child) => {
            const r = child.val();
            const id = child.key;
            const presence = r.presence || {};
            const userCount = Object.keys(presence).length;

            // Se a sala tem gente, ignoramos
            if (userCount > 0) {
                // Se ela estava marcada como vazia antes, removemos a marcação (pois voltou a ter gente)
                if (r.emptySince) updates[`rooms/${id}/emptySince`] = null;
                return; 
            }
            
            // Lógica de Exclusão:
            // Se não tem ninguém...
            if (userCount === 0) {
                // A) Se já tem a flag 'emptySince' e já passou 24h, deleta.
                if (r.emptySince && (agora - r.emptySince) >= H24) {
                    updates[`rooms/${id}`] = null;
                    deleted++;
                } 
                // B) Se não tem a flag, marca que está vazia a partir de AGORA
                else if (!r.emptySince) {
                    updates[`rooms/${id}/emptySince`] = agora;
                }
                // C) Se a sala foi criada há muito tempo e não tem 'createdAt' (salas antigas bugadas), deleta direto
                else if (!r.createdAt && !r.emptySince) {
                     updates[`rooms/${id}`] = null;
                     deleted++;
                }
            }
        });

        // 4. Executa as atualizações no Firebase
        if (Object.keys(updates).length > 0) {
            await firebase.database().ref().update(updates);
        }
        
        if(loader) loader.style.display = 'none';

        if (deleted > 0) {
            alert(`Limpeza concluída! ${deleted} salas antigas foram removidas.`);
        } else {
            alert("Varredura feita. Salas vazias foram marcadas, mas nenhuma estava abandonada há tempo suficiente (+24h) para ser excluída agora.");
        }

        // 5. Atualiza a lista visual
        loadAdminPanelRooms();

    } catch (error) {
        console.error(error);
        if(loader) loader.style.display = 'none';
        alert("Erro na faxina: " + error.message);
    }
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