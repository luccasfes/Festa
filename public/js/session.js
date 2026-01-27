// ====================================================================
// SESSION.JS — VERSÃO FUNCIONAL + CORREÇÃO DA SENHA
// ====================================================================

console.log(">>> session.js carregado com sucesso");

// --------------------
// ESTADO GLOBAL
// --------------------
window.currentSessionUser = null;
window.isAdminLoggedIn = false;
window.currentRoomId = null;
window.currentRoomPasswordHash = null;
window.myPresenceRef = null;

// --------------------
// 1. FUNÇÃO ÚNICA PARA ATUALIZAR NOME
// --------------------
window.updateGlobalUserUI = function(name) {
    console.log("Atualizando nome para:", name);
    
    // 1. Guarda nas variáveis globais
    window.currentSessionUser = name;
    sessionStorage.setItem('ytSessionUser', name);
    
    // 2. Atualiza TODOS os lugares visíveis
    const places = [
        { id: 'userNameDisplay', text: name },      // Chat
        { id: 'currentSessionUser', text: name },   // Modal YouTube (Novo HTML)
        { id: 'phone', value: name }                // Input (se ainda existir)
    ];
    
    places.forEach(place => {
        const element = document.getElementById(place.id);
        if (element) {
            if (place.value !== undefined) {
                element.value = name;
            } else {
                element.textContent = name;
            }
        }
    });
    
    // 3. Atualiza Firebase Presence
    if (window.myPresenceRef) {
        window.myPresenceRef.update({ name: name });
    }
    
    // 4. Dispara evento (útil para outros scripts)
    document.dispatchEvent(new CustomEvent('userNameChanged', { detail: { name } }));
};

// --------------------
// 2. INICIALIZAÇÃO
// --------------------
document.addEventListener('DOMContentLoaded', function () {
    
    // A. Verifica Sala e Senha
    const params = new URLSearchParams(window.location.search);
    window.currentRoomId = params.get("room");
    
    if (window.currentRoomId && typeof firebase !== 'undefined') {
        window.checkRoomProtection(window.currentRoomId);
    } else {
        hideInitialLoader();
    }

    // B. Recupera Nome
    const savedName = sessionStorage.getItem('ytSessionUser');
    if (savedName && savedName !== 'Visitante') {
        window.updateGlobalUserUI(savedName);
    } 

    // C. Configura Enter no Modal de Nome
    const editInput = document.getElementById('editNameInput');
    if (editInput) {
        editInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.saveUserName();
            }
        });
    }

    // D. Toggle de ver senha (Admin)
    document.getElementById('toggleAdminUnlockPassword')?.addEventListener('click', function() {
        const input = document.getElementById('adminUnlockPassword');
        input.type = input.type === 'password' ? 'text' : 'password';
    });

    // === DETECTOR AUTOMÁTICO DE ADMIN Inteligente===
    // Assim que o Firebase carregar o usuário, se for Admin, libera tudo.
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            console.log("👑 Sessão Admin recuperada automaticamente.");
            window.isAdminLoggedIn = true;
            document.body.classList.remove('non-admin');
            
            // Atualiza UI do Admin
            updateAdminDisplay(user.email.split('@')[0]);
            const panelBtn = document.getElementById('panelBtn');
            if(panelBtn) panelBtn.style.display = 'flex';
            
            // === A MÁGICA: SE A TELA ESTIVER TRAVADA, DESTRAVA SOZINHO ===
            if (document.body.classList.contains('locked')) {
                console.log("🔓 Desbloqueando sala privada para o Admin...");
                unlockScreen();
                if(typeof showNotification === 'function') {
                    showNotification('Bem-vindo, Admin! Sala liberada.', 'success');
                }
            }
        } else {
            // Se não tiver usuário logado, garante que o modo admin está off
            window.isAdminLoggedIn = false;
            document.body.classList.add('non-admin');
        }
    });
});

// --------------------
// 3. PROTEÇÃO DE SALA (CORRIGIDO AQUI)
// --------------------
window.checkRoomProtection = function(roomId) {
    if (!roomId) return hideInitialLoader();
    
    firebase.database().ref('rooms/' + roomId).once('value')
        .then(snapshot => {
            const room = snapshot.val();
            
            
            if (!room || !room.creatorName) {
                console.warn("Sala inválida detectada! Redirecionando para criar...");
                window.location.replace("create.html");
                return; 
            }
            // ---------------------------

            // Atualiza UI básica
            if (document.getElementById('roomNameDisplay')) 
                document.getElementById('roomNameDisplay').textContent = room.roomName || "Sala";

            const isPrivate = room.isPrivate === true || room.isPrivate === "true";
            const storedHash = room.password || room.passwordHash;

            // Lógica de senha
            if (isPrivate && storedHash) {
                const currentUser = firebase.auth().currentUser;
                
                if (window.isAdminLoggedIn || currentUser) {
                    console.log("👑 Admin detectado: Acesso liberado sem senha.");
                    unlockScreen(); 
                } else {
                    console.log("🔒 Sala privada: Bloqueando para usuário comum.");
                    window.currentRoomPasswordHash = storedHash;
                    lockScreen();
                }
            } else {
                unlockScreen();
            }
            
            hideInitialLoader();
        })
        .catch(err => {
            console.error("Erro crítico ao verificar sala:", err);
            // Na dúvida (erro de rede/permissão), chuta para o create
            window.location.replace("create.html");
        });
};

function lockScreen() {
    const modal = document.getElementById('roomPasswordModal');
    if (modal) {
        modal.style.display = 'flex';
        // Força o foco no input
        setTimeout(() => document.getElementById('roomEntryPassword')?.focus(), 100);
    }
    document.body.classList.add('locked');
}

function unlockScreen() {
    const modal = document.getElementById('roomPasswordModal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('locked');
    
    // Só pede o nome se a sala foi liberada E o usuário não tem nome ainda
    const savedName = sessionStorage.getItem('ytSessionUser');
    if (!savedName || savedName === 'Visitante') {
        setTimeout(() => window.openEditNameModal(), 500);
    }
}

// Função chamada pelo botão "Entrar" do modal de senha
window.verifyRoomPassword = function () {
    const input = document.getElementById('roomEntryPassword');
    const btn = document.getElementById('verifyPassBtn');
    const errorMsg = document.getElementById('passwordErrorMsg');

    if (!input || typeof CryptoJS === 'undefined') {
        alert("Erro: Biblioteca de criptografia não carregada.");
        return;
    }

    btn.innerText = "Verificando...";
    // Desabilita para evitar múltiplos cliques
    btn.disabled = true;

    setTimeout(() => {
        const typedHash = CryptoJS.SHA256(input.value.trim()).toString();

        if (typedHash === window.currentRoomPasswordHash) {
            // Senha correta
            if (errorMsg) errorMsg.style.display = 'none';
            unlockScreen();
        } else {
            // Senha incorreta
            if (errorMsg) {
                errorMsg.style.display = 'block';
                // Efeito visual de erro (chacoalhar input se quiser adicionar css depois)
            }
            btn.innerText = "Entrar";
            btn.disabled = false;
            input.value = "";
            input.focus();
        }
    }, 500); // Pequeno delay dramático
};

// --------------------
// 4. FUNÇÕES DO MODAL "QUEM É VOCÊ?"
// --------------------
window.openEditNameModal = function () {
    const modal = document.getElementById('editNameModal');
    const input = document.getElementById('editNameInput');
    const currentName = sessionStorage.getItem('ytSessionUser') || '';
    
    if (modal) modal.style.display = 'flex';
    
    if (input) {
        // Se for visitante, limpa o campo para digitar
        input.value = currentName === 'Visitante' ? '' : currentName;
        setTimeout(() => { input.focus(); input.select(); }, 100);
    }
};

window.closeEditNameModal = function () {
    document.getElementById('editNameModal').style.display = 'none';
};

window.saveUserName = function () {
    const input = document.getElementById('editNameInput');
    let newName = input ? input.value.trim() : '';
    
    if (!newName) newName = 'Visitante';
    
    window.updateGlobalUserUI(newName);
    
    setTimeout(() => {
        window.closeEditNameModal();
        if (typeof showNotification === 'function') {
            showNotification('Nome definido: ' + newName, 'success');
        }
    }, 300);
};

// --------------------
// 5. FUNÇÕES DO MODAL YOUTUBE
// --------------------
window.openYTSearchModal = function() {
    const modal = document.getElementById('ytSearchModal');
    if (modal) {
        modal.style.display = 'flex';
        // Atualiza o texto visual (caso tenha mudado externamente)
        const nameDisplay = document.getElementById('currentSessionUser');
        if (nameDisplay) {
            nameDisplay.textContent = window.currentSessionUser || sessionStorage.getItem('ytSessionUser') || 'Visitante';
        }
        setTimeout(() => {
            const searchInput = document.getElementById('ytSearchQuery');
            if (searchInput) searchInput.focus();
        }, 100);
    }
    const results = document.getElementById('ytSearchResults');
    if(results) results.innerHTML = '';
};

window.closeYTSearchModal = function() {
    document.getElementById('ytSearchModal').style.display = 'none';
};

// --------------------
// 6. ADMIN
// --------------------
window.openAdminUnlockModal = function () {
    if (window.isAdminLoggedIn) {
        window.logoutAdminSession();
    } else {
        const modal = document.getElementById('adminUnlockModal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => document.getElementById('adminUnlockName')?.focus(), 100);
        }
    }
};

window.closeAdminUnlockModal = function () {
    const modal = document.getElementById('adminUnlockModal');
    if(modal) modal.style.display = 'none';
};

window.loginAdminSession = async function () {
    const email = document.getElementById('adminUnlockName')?.value.trim();
    const pass = document.getElementById('adminUnlockPassword')?.value;

    if (!email || !pass) return alert('Preencha os campos.');

    if(typeof toggleLoading === 'function') toggleLoading('adminUnlockConfirmBtn', true);

    try {
        await firebase.auth().signInWithEmailAndPassword(email, pass);
        window.isAdminLoggedIn = true;
        document.body.classList.remove('non-admin');
        
        updateAdminDisplay(email.split('@')[0]);
        closeAdminUnlockModal();
        
        // UI Updates
        document.getElementById('panelBtn').style.display = 'flex';
        document.getElementById('videoList').classList.add('admin-mode');
        document.getElementById('clearChatBtn').style.display = 'inline-block';
        document.getElementById('bulkRemoveBtn').style.display = 'inline-block';

        if(typeof showNotification === 'function') showNotification('Modo Admin ATIVADO.', 'success');

        // ===  LIBERA A SALA SE ESTIVER BLOQUEADA para o admin ===
        // Se a tela estiver bloqueada pela senha da sala, o Admin libera automaticamente.
        if (document.body.classList.contains('locked')) {
            console.log("👑 Admin detectado! Liberando sala privada.");
            unlockScreen(); // Função que remove o modal de senha
            if(typeof showNotification === 'function') showNotification('Sala liberada pelo Admin!', 'success');
        }

    } catch (error) {
        console.error(error);
        if(typeof showNotification === 'function') showNotification('Erro de autenticação.', 'error');
    } finally {
        if(typeof toggleLoading === 'function') toggleLoading('adminUnlockConfirmBtn', false);
    }
};

window.logoutAdminSession = function () {
    window.isAdminLoggedIn = false;
    document.body.classList.add('non-admin');
    updateAdminDisplay(null);
    
    document.getElementById('panelBtn').style.display = 'none';
    document.getElementById('videoList').classList.remove('admin-mode');
    document.getElementById('clearChatBtn').style.display = 'none';
    document.getElementById('bulkRemoveBtn').style.display = 'none';
    
    firebase.auth().signOut();
    if(typeof showNotification === 'function') showNotification('Modo Admin DESATIVADO.', 'info');
};

function updateAdminDisplay(name) {
    const btn = document.getElementById('adminUnlockBtn');
    const statusText = document.getElementById('adminStatusText');
    if (window.isAdminLoggedIn) {
        if(btn) btn.classList.add('admin-logged-in');
        if(statusText) statusText.textContent = 'Admin';
    } else {
        if(btn) btn.classList.remove('admin-logged-in');
        if(statusText) statusText.textContent = 'Admin';
    }
}

function hideInitialLoader() {
    const loader = document.getElementById('initialLoader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 400);
    }
    document.body.style.opacity = '1';
}