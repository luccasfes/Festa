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

    // === BOTÃO FAXINEIRO ===
    // Adiciona o botão de LIMPEZA no topo da lista
    var headerActions = document.createElement('div');
    headerActions.style.padding = "10px";
    headerActions.style.textAlign = "right";
    headerActions.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
    headerActions.innerHTML = `
        <button onclick="limparSalasVazias()" class="btn warning small" style="background: #ff9800; color: white; border: none;">
            <i class="fas fa-broom"></i> Limpar Salas Vazias
        </button>
    `;
    list.appendChild(headerActions);

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

// === O FAXINEIRO AUTOMÁTICO ===
async function limparSalasVazias() {
    if(!confirm("Isso vai apagar TODAS as salas que estão marcadas como 'Vazia'.\nDeseja continuar?")) return;

    var btn = document.querySelector('.btn.warning'); 
    if(btn) btn.innerText = "Limpando...";

    try {
        const snapshot = await firebase.database().ref('rooms').once('value');
        if (!snapshot.exists()) {
            alert("Não há salas para limpar.");
            loadAdminPanelRooms();
            return;
        }

        let deletedCount = 0;
        const updates = {};

        snapshot.forEach((child) => {
            const room = child.val();
            const roomId = child.key;

            // Lógica: Se não tem a chave 'presence' (ninguém online), deleta.
            if (!room.presence) {
                updates['rooms/' + roomId] = null; // Marca para deletar
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            await firebase.database().ref().update(updates);
            if(typeof showNotification === 'function') {
                showNotification(`Limpeza concluída! ${deletedCount} salas apagadas.`, "success");
            } else {
                alert(`Sucesso! ${deletedCount} salas vazias foram apagadas.`);
            }
        } else {
            alert("Nenhuma sala vazia encontrada no momento.");
        }

    } catch (error) {
        console.error(error);
        alert("Erro ao limpar: " + error.message);
    } finally {
        loadAdminPanelRooms(); // Atualiza a lista visual
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