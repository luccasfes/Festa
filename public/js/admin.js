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

    // (Removi a parte que criava os botões de Atualizar e Limpar aqui)

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
                
                // 2. CONTAGEM INTELIGENTE
                var userCount = val.presence ? Object.keys(val.presence).length : 0;
                var videoCount = val.videoQueue ? Object.keys(val.videoQueue).length : 0;
                var chatCount = (val.chat && val.chat.messages) ? Object.keys(val.chat.messages).length : 0;

                // Cor do status
                var statusColor = userCount > 0 ? '#00e676' : '#666'; 

                // Cria elemento visual
                var item = document.createElement('div');
                item.className = 'admin-room-item';
                item.style.marginBottom = '15px'; // Espaçamento entre salas
                
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
                        
                        <div style="font-size: 0.9rem; color: #ddd; margin-bottom: 12px; display: flex; align-items: center;">
                            <i class="fas fa-crown" style="color: #ffb300; margin-right: 6px; font-size: 0.8rem;"></i> 
                            Criador: <strong style="margin-left: 4px;">${escapeHtml(creatorName)}</strong>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 8px; margin-bottom: 10px;">
                            
                            <div style="text-align: center; color: ${statusColor};" title="Usuários Online">
                                <i class="fas fa-users"></i> <span style="font-weight:bold; margin-left:4px;">${userCount}</span>
                                <div style="font-size:0.65rem; opacity:0.7;">Online</div>
                            </div>

                            <div style="text-align: center; color: #29b6f6;" title="Vídeos na Fila">
                                <i class="fas fa-music"></i> <span style="font-weight:bold; margin-left:4px;">${videoCount}</span>
                                <div style="font-size:0.65rem; opacity:0.7;">Músicas</div>
                            </div>

                            <div style="text-align: center; color: #ffca28;" title="Total de Mensagens">
                                <i class="fas fa-comments"></i> <span style="font-weight:bold; margin-left:4px;">${chatCount}</span>
                                <div style="font-size:0.65rem; opacity:0.7;">Chats</div>
                            </div>

                        </div>
                    </div>

                    <div class="room-actions" style="margin-top: 10px; display:flex; justify-content:flex-end; gap:10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                        <button class="btn small secondary" onclick="entrarNaSalaPeloAdmin('${key}')" style="flex: 1;">
                            <i class="fas fa-sign-in-alt"></i> Espiar / Entrar
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

// Este script FORÇA o modal de senha a ficar aberto se alguém clicar fora
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('roomPasswordModal');
        // Se o clique foi no fundo escuro (background) do modal de senha
        if (e.target === modal) {
            e.stopPropagation(); // Impede que outros scripts fechem
            e.preventDefault();  // Cancela a ação
            
            // Efeito visual para mostrar que está bloqueado
            const content = modal.querySelector('.modal-content');
            content.style.transform = "scale(1.05)";
            setTimeout(() => content.style.transform = "scale(1)", 150);
        }
    }, true); // 'true' garante que este script rode antes de qualquer outro