// ====================================================================
// ADMIN PAINEL - VERSÃO CORRIGIDA E MODERNA
// ====================================================================

function FuncaoParaAbrirPainel() {
    const modal = document.getElementById('panelModal');
    if (modal) {
        modal.style.display = 'flex';
        loadAdminPanelRooms();
    } else {
        console.error("Erro: Modal 'panelModal' não encontrado no HTML.");
    }
}

function closePanelModal() {
    document.getElementById('panelModal').style.display = 'none';
}

function loadAdminPanelRooms() {
    const list = document.getElementById('adminRoomList');
    const loader = document.getElementById('adminRoomLoader');
    
    if (!list) return;

    // Mostra loading se existir o elemento, senão limpa a lista
    if (loader) loader.style.display = 'flex';
    list.innerHTML = '';

    // Busca as salas no Firebase
    database.ref('rooms').once('value')
        .then((snapshot) => {
            if (loader) loader.style.display = 'none';
            
            if (!snapshot.exists()) {
                list.innerHTML = '<div style="text-align:center; color:#aaa; padding:20px; font-style:italic;">Nenhuma sala ativa no momento.</div>';
                return;
            }

            snapshot.forEach((childSnapshot) => {
                const key = childSnapshot.key;
                const val = childSnapshot.val();

                // === 1. CORREÇÃO DE DADOS ===
                
                // Nome da sala (fallback para 'Sala sem Nome')
                const roomName = val.name || val.titulo || val.roomName || 'Sala sem Nome';
                
                // Nome do Criador (Tenta todas as variações possíveis para evitar "Desconhecido")
                const creatorName = val.creatorName || val.adminName || val.criador || val.createdBy || 'Desconhecido';

                // Data de criação (se existir timestamp)
                let dateStr = "";
                if (val.createdAt) {
                    const date = new Date(val.createdAt);
                    dateStr = date.toLocaleDateString('pt-BR');
                }

                // Estatísticas rápidas (Opcional, mas útil)
                const userCount = val.presence ? Object.keys(val.presence).length : 0;
                const videoCount = val.videoQueue ? Object.keys(val.videoQueue).length : 0;

                // === 2. GERAÇÃO DO HTML MODERNO ===
                const item = document.createElement('div');
                item.className = 'admin-room-item';
                
                // Estrutura: Cabeçalho com Nome e ID, Subtítulo com Criador, Rodapé com Ações
                item.innerHTML = `
                    <div class="room-header" style="margin-bottom:0;">
                        <div style="display:flex; flex-direction:column; width:100%;">
                            
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <h5 class="room-name" style="margin:0; font-size:1.1rem; color: white;">${escapeHtml(roomName)}</h5>
                                <span class="room-id" style="font-family:monospace; background:rgba(0,0,0,0.4); padding:2px 8px; border-radius:4px; font-size:0.85rem; color:#ccc; border:1px solid rgba(255,255,255,0.1);">
                                    ID: ${key}
                                </span>
                            </div>
                            
                            <div style="font-size: 0.85rem; color: #aaa; margin-top: 8px; display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-user-circle" style="color:var(--accent-color);"></i> 
                                <strong style="color:#ddd;">${escapeHtml(creatorName)}</strong> 
                                ${dateStr ? `<span style="opacity:0.5; font-size:0.8rem;">• Criada em ${dateStr}</span>` : ''}
                            </div>

                            <div style="display:flex; gap:10px; margin-top:8px;">
                                <span style="font-size:0.75rem; color:#00b894; background:rgba(0, 184, 148, 0.1); padding:2px 6px; border-radius:4px;">
                                    <i class="fas fa-users"></i> ${userCount} online
                                </span>
                                <span style="font-size:0.75rem; color:#74b9ff; background:rgba(9, 132, 227, 0.1); padding:2px 6px; border-radius:4px;">
                                    <i class="fas fa-play"></i> ${videoCount} vídeos
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="room-actions" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px; margin-top: 12px; display:flex; justify-content:flex-end; gap:10px;">
                        <button class="btn small secondary" onclick="entrarNaSala('${key}')" title="Entrar na sala">
                            <i class="fas fa-sign-in-alt"></i> Entrar
                        </button>
                        <button class="btn small danger" onclick="deleteRoom('${key}')" title="Deletar Sala">
                            <i class="fas fa-trash"></i> Deletar
                        </button>
                    </div>
                `;

                list.appendChild(item);
            });
        })
        .catch((error) => {
            console.error(error);
            if (loader) loader.style.display = 'none';
            list.innerHTML = `<div class="error-message" style="color:#ff7675; padding:20px;">Erro ao carregar salas: ${error.message}</div>`;
        });
}

// === FUNÇÕES DE AÇÃO ===

function entrarNaSala(roomId) {
    // Recarrega a página atual com o novo hash da sala
    window.location.hash = roomId;
    window.location.reload();
}

async function deleteRoom(id) {
    if(confirm(`Tem certeza absoluta que deseja DELETAR a sala ID: ${id}?\nEssa ação não pode ser desfeita.`)) {
        try {
            await database.ref('rooms/' + id).remove();
            // Recarrega a lista para mostrar que sumiu
            loadAdminPanelRooms();
            // Mostra um alerta simples (ou use toast se tiver)
            // alert('Sala deletada com sucesso!'); 
        } catch(e) {
            alert('Erro ao deletar: ' + e.message);
        }
    }
}

// === FUNÇÕES DO MODAL "DELETAR TUDO" ===

function openDeleteAllRoomsModal() {
    document.getElementById('deleteAllRoomsModal').style.display = 'flex';
}

function closeDeleteAllRoomsModal() {
    document.getElementById('deleteAllRoomsModal').style.display = 'none';
}

async function executeDeleteAllRooms() {
    // Muda o texto do botão para dar feedback
    const btn = document.getElementById('deleteAllRoomsConfirmBtn'); // Certifique-se que o botão tem esse ID no HTML
    const originalText = btn ? btn.innerText : 'Sim';
    
    if(btn) {
        btn.innerText = "Apagando...";
        btn.disabled = true;
    }

    try {
        await database.ref('rooms').remove();
        closeDeleteAllRoomsModal();
        loadAdminPanelRooms();
        alert('Todas as salas foram apagadas com sucesso.');
    } catch(e) {
        alert('Erro ao apagar tudo: ' + e.message);
    } finally {
        if(btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

// Função auxiliar de segurança (para evitar injeção de HTML nos nomes)
function escapeHtml(text) {
    if (!text) return text;
    return text
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}