// ====================================================================
// PAINEL DE ADMINISTRAÇÃO & FAXINEIRO (VERSÃO FINAL)
// ====================================================================

// --- Funções de Abertura/Fechamento ---

function FuncaoParaAbrirPainel() {
    // Verifica se está logado usando a variável global do session.js
    if (!window.isAdminLoggedIn && !firebase.auth().currentUser) {
        // Tenta mostrar notificação ou alerta
        if(typeof showNotification === 'function') {
            showNotification("Faça login como Admin primeiro.", "error");
        } else {
            alert("Faça login como Admin primeiro (clique no cadeado no topo).");
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

// --- Carregamento das Salas ---

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

                // Dados
                var roomName = val.roomName || 'Sala sem Nome';
                var creatorName = val.creatorName || 'Desconhecido';
                
                // Contagem de usuários (Presença)
                var userCount = 0;
                if (val.presence) {
                    userCount = Object.keys(val.presence).length;
                }

                // Cria elemento visual
                var item = document.createElement('div');
                item.className = 'admin-room-item';
                
                // Marca visualmente se está vazia
                var statusColor = userCount > 0 ? '#00e676' : '#666'; 
                var statusText = userCount > 0 ? userCount + ' online' : 'Vazia';

                item.innerHTML = `
                    <div class="room-header" style="margin-bottom:0;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <h5 class="room-name" style="margin:0; font-size:1.1rem; color: white;">
                                <span style="display:inline-block; width:8px; height:8px; background:${statusColor}; border-radius:50%; margin-right:6px;"></span>
                                ${escapeHtml(roomName)}
                            </h5>
                            <span class="room-id" style="font-family:monospace; background:rgba(0,0,0,0.4); padding:2px 8px; border-radius:4px; font-size:0.85rem; color:#ccc;">
                                ${key}
                            </span>
                        </div>
                        
                        <div style="font-size: 0.85rem; color: #aaa; margin-top: 6px; display:flex; justify-content:space-between;">
                            <span>Criador: <strong>${escapeHtml(creatorName)}</strong></span>
                            <span style="color:${statusColor}">${statusText}</span>
                        </div>
                    </div>

                    <div class="room-actions" style="margin-top: 10px; display:flex; justify-content:flex-end; gap:10px;">
                        <button class="btn small secondary" onclick="entrarNaSalaPeloAdmin('${key}')">
                            <i class="fas fa-sign-in-alt"></i> Entrar
                        </button>
                        <button class="btn small danger" onclick="confirmDeleteRoom('${key}')">
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
        });
}

// --- AÇÕES DO ADMIN ---

function entrarNaSalaPeloAdmin(roomId) {
    window.location.href = 'index.html?room=' + roomId;
}

function confirmDeleteRoom(roomId) {
    if(confirm('Tem certeza que deseja apagar a sala ' + roomId + '?')) {
        firebase.database().ref('rooms/' + roomId).remove()
            .then(function() { 
                loadAdminPanelRooms(); // Recarrega a lista
                if(typeof showNotification === 'function') showNotification("Sala apagada.", "success");
            });
    }
}

/// === O FAXINEIRO AUTOMÁTICO (VERSÃO PROTEGIDA) ===
async function limparSalasVazias() {
    if(!confirm("Isso vai apagar salas vazias há mais de 24h.\nSalas novas e com pessoas estão seguras.\nDeseja continuar?")) return;

    try {
        const snapshot = await firebase.database().ref('rooms').once('value');
        if (!snapshot.exists()) {
            alert("Não há salas para verificar.");
            return;
        }

        const agora = Date.now();
        const VINTE_E_QUATRO_HORAS = 24 * 60 * 60 * 1000; 

        let deletedCount = 0;
        let skippedCount = 0;
        const updates = {};

        snapshot.forEach((child) => {
            const room = child.val();
            const roomId = child.key;
            
            // 1. VERIFICAÇÃO DE PRESENÇA
            const presence = room.presence || {};
            const userCount = Object.keys(presence).length;

            // --- TRAVA DE SEGURANÇA 1: SALA COM GENTE ---
            if (userCount > 0) {
                // Se tem gente, remove qualquer marcação de "vazia" e pula
                if (room.emptySince) updates[`rooms/${roomId}/emptySince`] = null;
                return; 
            }

            // --- TRAVA DE SEGURANÇA 2: DATA DE CRIAÇÃO ---
            // Se a sala NÃO tem data de criação, tratamos como "nova" por segurança e não mexemos
            if (!room.createdAt) {
                skippedCount++;
                return;
            }

            const tempoDeVida = agora - room.createdAt;
            // Se a sala foi criada a menos de 24h, NUNCA apaga, mesmo se estiver vazia
            if (tempoDeVida < VINTE_E_QUATRO_HORAS) {
                if (room.emptySince) updates[`rooms/${roomId}/emptySince`] = null;
                return;
            }

            // --- LÓGICA DE LIMPEZA (SÓ PARA SALAS ANTIGAS E VAZIAS) ---
            if (userCount === 0) {
                if (!room.emptySince) {
                    // Marca o início da contagem de tempo vazia
                    updates[`rooms/${roomId}/emptySince`] = agora;
                } else {
                    const tempoVazia = agora - room.emptySince;
                    // Só apaga se estiver vazia há mais de 24h
                    if (tempoVazia >= VINTE_E_QUATRO_HORAS) {
                        updates[`rooms/${roomId}`] = null;
                        deletedCount++;
                    }
                }
            }
        });

        if (Object.keys(updates).length > 0) {
            await firebase.database().ref().update(updates);
        }

        let msg = `Faxina concluída.\n`;
        if (deletedCount > 0) msg += `🧹 ${deletedCount} salas antigas apagadas.\n`;
        if (skippedCount > 0) msg += `🛡️ ${skippedCount} salas protegidas (sem data ou muito novas).`;
        if (deletedCount === 0 && skippedCount === 0) msg = "Nenhuma sala precisou ser alterada.";
        
        alert(msg);

    } catch (error) {
        console.error("Erro no faxineiro:", error);
        alert("Erro ao executar faxina: " + error.message);
    } finally {
        loadAdminPanelRooms();
    }
}

// --- UTIL ---
function escapeHtml(text) {
    if (!text) return text;
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}