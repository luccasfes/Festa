// ====================================================================
// SESSION.JS — VERSÃO FINAL (ROOM BAN ONLY + ADMIN SECURE)
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

    // === DETECTOR AUTOMÁTICO DE ADMIN ===
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            console.log("👑 Sessão Admin ativa.");
            window.isAdminLoggedIn = true;
            document.body.classList.remove('non-admin');
            
            // Pega o nome do perfil ou usa fallback do email
            const adminName = user.displayName || user.email.split('@')[0]; 
            
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
            
            // --- [IMPORTANTE] LIGA O SISTEMA DE BANIMENTO AQUI ---
            if (window.monitorBans) {
                window.monitorBans(roomId);
            }
            // -----------------------------------------------------

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
        
        // Pega nome do perfil
        const adminName = user.displayName || user.email.split('@')[0];

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

// ====================================================================
// 7. SISTEMA DE BANIMENTO (SALA APENAS)
// ====================================================================

// 1. Gera ID do Navegador
window.getDeviceId = function() {
    let deviceId = localStorage.getItem('flowLinkDeviceId');
    if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('flowLinkDeviceId', deviceId);
    }
    return deviceId;
};

// 2. VIGIA (Monitora APENAS a sala atual)
window.monitorBans = function(roomId) {
    if (!roomId) return;

    // Escuta a lista de banidos DA SALA
    firebase.database().ref(`rooms/${roomId}/banned`).on('value', (snapshot) => {
        const bannedList = snapshot.val();
        if (!bannedList) return;

        const myName = sessionStorage.getItem('ytSessionUser');
        const myDeviceId = window.getDeviceId();

        // Verifica Nome e ID
        const isNameBanned = bannedList[myName] === true;
        const isDeviceBanned = bannedList[myDeviceId] === true;

        if ((isNameBanned || isDeviceBanned) && !window.isAdminLoggedIn) {
            console.warn("🚫 Banimento detectado.");
            
            sessionStorage.removeItem('ytSessionUser');
            alert("🚫 Você foi banido desta sala.");
            window.location.href = 'index.html'; 
        }
    });
};

// 3. COMANDO ADMIN (Banir)
window.banUser = function(targetName) {
    if (!window.isAdminLoggedIn) return console.error("⛔ Apenas admins.");
    if (!window.currentRoomId) return console.error("⛔ Nenhuma sala.");
    if (!targetName) return console.error("⛔ Informe o nome.");

    const roomId = window.currentRoomId;
    const usersRef = firebase.database().ref(`rooms/${roomId}/users`);

    // Busca o ID do usuário para banir o dispositivo também
    usersRef.once('value').then(snapshot => {
        const users = snapshot.val();
        let targetDeviceId = null;

        for (let key in users) {
            if (users[key].name === targetName) {
                targetDeviceId = users[key].deviceId; 
                break;
            }
        }

        const updates = {};
        // Bane o NOME
        updates[`rooms/${roomId}/banned/${targetName}`] = true;

        // Bane o ID (se encontrado)
        if (targetDeviceId) {
            updates[`rooms/${roomId}/banned/${targetDeviceId}`] = true;
            console.log(`🔫 ID do dispositivo banido: ${targetDeviceId}`);
        }

        return firebase.database().ref().update(updates);
    }).then(() => {
        console.log(`🔨 Usuário ${targetName} banido com sucesso!`);
        if(typeof window.sendSystemMessage === 'function') {
            window.sendSystemMessage(`🚫 O usuário ${targetName} foi banido da sala.`);
        }
    });
};

window.unbanUser = function(target) {
    if (!window.isAdminLoggedIn) return;
    firebase.database().ref(`rooms/${window.currentRoomId}/banned/${target}`).remove()
        .then(() => console.log(`😇 Banimento de '${target}' removido.`));
};

window.nukeRoom = function() {
    if (!window.isAdminLoggedIn) return;
    if (!confirm("☢️ DESTRUIR SALA?")) return;
    firebase.database().ref(`rooms/${window.currentRoomId}`).remove()
        .then(() => window.location.href = 'create.html');
};