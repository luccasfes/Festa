// ====================================================================
// SESSION.JS — VERSÃO FINAL (VIA PERFIL DO FIREBASE)
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
        { id: 'userNameDisplay', text: name },
        { id: 'currentSessionUser', text: name },
        { id: 'phone', value: name }
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
    
    // 4. Dispara evento
    document.dispatchEvent(new CustomEvent('userNameChanged', { detail: { name } }));
};

// --------------------
// 2. INICIALIZAÇÃO
// --------------------
document.addEventListener('DOMContentLoaded', function () {
    
    // A. Verifica Sala
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

    // C. Enter no Input
    const editInput = document.getElementById('editNameInput');
    if (editInput) {
        editInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.saveUserName();
            }
        });
    }

    // D. Toggle Senha Admin
    document.getElementById('toggleAdminUnlockPassword')?.addEventListener('click', function() {
        const input = document.getElementById('adminUnlockPassword');
        input.type = input.type === 'password' ? 'text' : 'password';
    });

    // === DETECTOR AUTOMÁTICO DE ADMIN (O SEGREDO ESTÁ AQUI) ===
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            console.log("👑 Sessão Admin ativa.");
            window.isAdminLoggedIn = true;
            document.body.classList.remove('non-admin');
            
            // --- AQUI A MÁGICA ---
            // Ele vai pegar "Lucas" direto do banco de dados (user.displayName)
            // Se não achar, pega o email (fallback de segurança)
            const adminName = user.displayName || user.email.split('@')[0]; 
            // ---------------------

            updateAdminDisplay(adminName);
            
            const panelBtn = document.getElementById('panelBtn');
            if(panelBtn) panelBtn.style.display = 'flex';

            const currentName = sessionStorage.getItem('ytSessionUser');
            if (!currentName || currentName === 'Visitante') {
                window.updateGlobalUserUI(adminName);
            }

            if (typeof window.closeEditNameModal === 'function') {
                window.closeEditNameModal();
            }
            
            if (window.myPresenceRef) {
                window.myPresenceRef.update({ isAdmin: true });
            }

            if (document.body.classList.contains('locked')) {
                unlockScreen();
                if(typeof showNotification === 'function') {
                    showNotification('Bem-vindo, ' + adminName + '!', 'success');
                }
            }
        } else {
            window.isAdminLoggedIn = false;
            document.body.classList.add('non-admin');
            
            if (window.myPresenceRef) {
                window.myPresenceRef.update({ isAdmin: false });
            }
        }
    });
});

// --------------------
// 3. PROTEÇÃO DE SALA
// --------------------
window.checkRoomProtection = function(roomId) {
    if (!roomId) return hideInitialLoader();
    
    firebase.database().ref('rooms/' + roomId).once('value')
        .then(snapshot => {
            const room = snapshot.val();
            
            if (!room || !room.creatorName) {
                window.location.replace("create.html");
                return; 
            }

            if (document.getElementById('roomNameDisplay')) 
                document.getElementById('roomNameDisplay').textContent = room.roomName || "Sala";

            const isPrivate = room.isPrivate === true || room.isPrivate === "true";
            const storedHash = room.password || room.passwordHash;

            if (isPrivate && storedHash) {
                const currentUser = firebase.auth().currentUser;
                
                if (window.isAdminLoggedIn || currentUser) {
                    unlockScreen(); 
                } else {
                    window.currentRoomPasswordHash = storedHash;
                    lockScreen();
                }
            } else {
                unlockScreen();
            }
            
            hideInitialLoader();
        })
        .catch(err => {
            console.error(err);
            window.location.replace("create.html");
        });
};

function lockScreen() {
    const modal = document.getElementById('roomPasswordModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('roomEntryPassword')?.focus(), 100);
    }
    document.body.classList.add('locked');
}

function unlockScreen() {
    const modal = document.getElementById('roomPasswordModal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('locked');
    
    if (!window.isAdminLoggedIn) {
        const savedName = sessionStorage.getItem('ytSessionUser');
        if (!savedName || savedName === 'Visitante') {
            setTimeout(() => window.openEditNameModal(), 500);
        }
    }
}

window.verifyRoomPassword = function () {
    const input = document.getElementById('roomEntryPassword');
    const btn = document.getElementById('verifyPassBtn');
    const errorMsg = document.getElementById('passwordErrorMsg');

    if (!input || typeof CryptoJS === 'undefined') return;

    btn.innerText = "Verificando...";
    btn.disabled = true;

    setTimeout(() => {
        const typedHash = CryptoJS.SHA256(input.value.trim()).toString();

        if (typedHash === window.currentRoomPasswordHash) {
            if (errorMsg) errorMsg.style.display = 'none';
            unlockScreen();
        } else {
            if (errorMsg) errorMsg.style.display = 'block';
            btn.innerText = "Entrar";
            btn.disabled = false;
            input.value = "";
            input.focus();
        }
    }, 500);
};

// --------------------
// 4. MODAL NOME
// --------------------
window.openEditNameModal = function () {
    if (window.isAdminLoggedIn) return;
    const modal = document.getElementById('editNameModal');
    const input = document.getElementById('editNameInput');
    const currentName = sessionStorage.getItem('ytSessionUser') || '';
    if (modal) modal.style.display = 'flex';
    if (input) {
        input.value = currentName === 'Visitante' ? '' : currentName;
        setTimeout(() => { input.focus(); input.select(); }, 100);
    }
};

window.closeEditNameModal = function () {
    document.getElementById('editNameModal').style.display = 'none';
};

window.saveUserName = function () {
    const input = document.getElementById('editNameInput');
    let newName = input ? input.value.trim() : 'Visitante';
    if (!newName) newName = 'Visitante';
    window.updateGlobalUserUI(newName);
    setTimeout(() => {
        window.closeEditNameModal();
    }, 300);
};

// --------------------
// 5. MODAL YOUTUBE
// --------------------
window.openYTSearchModal = function() {
    const modal = document.getElementById('ytSearchModal');
    if (modal) {
        modal.style.display = 'flex';
        const nameDisplay = document.getElementById('currentSessionUser');
        if (nameDisplay) {
            nameDisplay.textContent = window.currentSessionUser || 'Visitante';
        }
        setTimeout(() => document.getElementById('ytSearchQuery')?.focus(), 100);
    }
    const results = document.getElementById('ytSearchResults');
    if(results) results.innerHTML = '';
};

window.closeYTSearchModal = function() {
    document.getElementById('ytSearchModal').style.display = 'none';
};

// --------------------
// 6. LOGIN MANUAL (ADMIN)
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
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, pass);
        const user = userCredential.user;
        
        window.isAdminLoggedIn = true;
        document.body.classList.remove('non-admin');
        
        // --- PEGA O NOME "LUCAS" DO PERFIL ---
        const adminName = user.displayName || user.email.split('@')[0];
        // -------------------------------------

        updateAdminDisplay(adminName);
        closeAdminUnlockModal();

        window.updateGlobalUserUI(adminName);
        window.closeEditNameModal();

        if (window.myPresenceRef) {
            window.myPresenceRef.update({ 
                isAdmin: true,
                name: adminName 
            });
        }
        
        document.getElementById('panelBtn').style.display = 'flex';
        document.getElementById('videoList').classList.add('admin-mode');
        document.getElementById('clearChatBtn').style.display = 'inline-block';
        document.getElementById('bulkRemoveBtn').style.display = 'inline-block';

        if(typeof showNotification === 'function') showNotification('Modo Admin ATIVADO.', 'success');
        if (document.body.classList.contains('locked')) unlockScreen();

    } catch (error) {
        console.error(error);
        if(typeof showNotification === 'function') showNotification('Erro de autenticação.', 'error');
    } finally {
        if(typeof toggleLoading === 'function') toggleLoading('adminUnlockConfirmBtn', false);
    }
};

window.logoutAdminSession = function () {
    window.isAdminLoggedIn = false;
    if (window.myPresenceRef) window.myPresenceRef.update({ isAdmin: false });
    
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