// ====================================================================
// SESSÃO E ADMINISTRAÇÃO
// ====================================================================

function openEditNameModal() {
    const currentName = sessionStorage.getItem('ytSessionUser') || '';
    document.getElementById('editNameInput').value = currentName;
    document.getElementById('editNameModal').style.display = 'flex';
    document.getElementById('editNameInput').focus();
}

function closeEditNameModal() {
    document.getElementById('editNameModal').style.display = 'none';
}

function saveUserName() {
    toggleLoading('saveUserNameBtn', true);
    const newName = document.getElementById('editNameInput').value.trim();

    if (!newName) {
        showNotification('Por favor, digite um nome.', 'error');
        toggleLoading('saveUserNameBtn', false);
        return;
    }

    currentSessionUser = newName;
    sessionStorage.setItem('ytSessionUser', newName);
    
    const display = document.getElementById('userNameDisplay');
    if(display) display.textContent = newName;
    
    // Atualiza modal de busca também
    if(document.getElementById('currentSessionUser')) 
        document.getElementById('currentSessionUser').textContent = newName;

    // Atualiza o input de nome dentro do modal de busca
    const searchInput = document.getElementById('ytSearchName');
    if(searchInput) searchInput.value = newName;

    if (myPresenceRef) myPresenceRef.update({ name: newName });

    setTimeout(() => {
        toggleLoading('saveUserNameBtn', false);
        showNotification('Nome atualizado!', 'success');
        closeEditNameModal();
    }, 300);
}

// --- ADMIN ---
function openAdminUnlockModal() {
    if (isAdminLoggedIn) {
        logoutAdminSession();
        return;
    }
    document.getElementById('adminUnlockModal').style.display = 'flex';
    document.getElementById('adminUnlockName').focus();
}

function closeAdminUnlockModal() {
    document.getElementById('adminUnlockModal').style.display = 'none';
    document.getElementById('adminUnlockName').value = '';
    document.getElementById('adminUnlockPassword').value = '';
}

async function loginAdminSession() {
    const email = document.getElementById('adminUnlockName').value.trim();
    const password = document.getElementById('adminUnlockPassword').value;

    if (!email || !password) return showNotification('Preencha os campos.', 'error');

    toggleLoading('adminUnlockConfirmBtn', true);

    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        
        isAdminLoggedIn = true;
        document.body.classList.remove('non-admin');
        
        updateAdminDisplay(email.split('@')[0]);
        closeAdminUnlockModal();
        
        // UI Admin
        document.getElementById('panelBtn').style.display = 'flex';
        document.getElementById('videoList').classList.add('admin-mode');
        document.getElementById('clearChatBtn').style.display = 'inline-block';
        
        // Atualiza botões da fila (CORREÇÃO)
        if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();
        
        // Player e DJ
        if(typeof enableAdminPlayerControls === 'function') enableAdminPlayerControls();
        if(typeof atualizarVisibilidadeAutoDJ === 'function') atualizarVisibilidadeAutoDJ();

        showNotification('Modo Admin ATIVADO.', 'success');

    } catch (error) {
        console.error(error);
        showNotification('Erro de autenticação.', 'error');
    } finally {
        toggleLoading('adminUnlockConfirmBtn', false);
    }
}

function logoutAdminSession() {
    isAdminLoggedIn = false;
    document.body.classList.add('non-admin');
    
    updateAdminDisplay(null);
    
    document.getElementById('panelBtn').style.display = 'none';
    document.getElementById('videoList').classList.remove('admin-mode');
    document.getElementById('clearChatBtn').style.display = 'none';
    
    // Atualiza botões da fila (CORREÇÃO)
    if(typeof updateAdminButtonsVisibility === 'function') updateAdminButtonsVisibility();

    if(typeof disableAdminPlayerControls === 'function') disableAdminPlayerControls();
    if(typeof atualizarVisibilidadeAutoDJ === 'function') atualizarVisibilidadeAutoDJ();
    
    showNotification('Modo Admin DESATIVADO.', 'info');
}

function updateAdminDisplay(name) {
    const btn = document.getElementById('adminUnlockBtn');
    const nameDisplay = document.getElementById('adminNameDisplay');

    if (isAdminLoggedIn) {
        btn.classList.add('admin-logged-in');
        document.getElementById('adminStatusText').textContent = 'Admin';
        if(nameDisplay) {
            nameDisplay.textContent = name;
            nameDisplay.style.display = 'inline';
        }
    } else {
        btn.classList.remove('admin-logged-in');
        document.getElementById('adminStatusText').textContent = 'Admin';
        if(nameDisplay) nameDisplay.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica se já existe um usuário salvo
    const saved = sessionStorage.getItem('ytSessionUser');
    
    if (saved) {
        // Se já tem nome, carrega normal
        currentSessionUser = saved;
        const display = document.getElementById('userNameDisplay');
        if(display) display.textContent = saved;
        
        // Preenche o input do modal de busca para não precisar digitar de novo
        const searchInput = document.getElementById('ytSearchName');
        if(searchInput) searchInput.value = saved;
        
    } else {
        // === AQUI ESTÁ O AJUSTE ===
        // Se NÃO tem nome, abre o modal pedindo o nome automaticamente
        setTimeout(() => {
            openEditNameModal();
            showNotification('Bem-vindo! Escolha um nome para participar.', 'info');
        }, 500); // Meio segundo de delay para ficar suave
    }

    document.getElementById('toggleAdminUnlockPassword')?.addEventListener('click', function() {
        const input = document.getElementById('adminUnlockPassword');
        input.type = input.type === 'password' ? 'text' : 'password';
    });
});