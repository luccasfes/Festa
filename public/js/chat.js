// ====================================================================
// CHAT.JS - VERSÃO UNIFICADA (Avatar Sincronizado + Emojis Originais)
// ====================================================================

let isTyping = false;
let typingTimeout;
let currentReplyMessage = null;

// Variáveis globais para guardar quem manda na sala
window.roomCreatorName = null;
window.roomCreatorAvatar = null;

// ====================================================================
// 1. INICIALIZAÇÃO SINCRONIZADA DO CHAT
// ====================================================================

function initChatSystem() {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');

    if (!roomId) return;

    console.log("🔄 Buscando informações do dono da sala...");

    firebase.database().ref('rooms/' + roomId).once('value').then(snapshot => {
        const data = snapshot.val();
        
        if (data) {
            // Guarda os dados nas variáveis globais
            window.roomCreatorName = data.creatorName;
            window.roomCreatorAvatar = data.creatorAvatar || 'fas fa-user'; 
            
            console.log("✅ Dono encontrado:", window.roomCreatorName, "Avatar:", window.roomCreatorAvatar);
            
            // Atualiza o display do criador no header (opcional)
            const creatorDisplay = document.getElementById('roomCreatorDisplay');
            if (creatorDisplay) creatorDisplay.textContent = window.roomCreatorName;
        }

        // IMPORTANTE: Só inicia o chat DEPOIS de ter os dados do dono
        startChatListener();
    });
}

// Chama a inicialização do chat
initChatSystem();

window.updateChatUserDisplay = function(name) {
    const chatDisplay = document.getElementById('userNameDisplay');
    if (chatDisplay) chatDisplay.textContent = name || 'Visitante';
};

// ====================================================================
// 2. LISTENER DO CHAT
// ====================================================================

function startChatListener() {
    chatMessagesRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
        const container = document.getElementById('chatMessages');
        const messages = snapshot.val() || {};
        
        if(Object.keys(messages).length > 0) {
            const empty = container.querySelector('.empty-chat');
            if(empty) empty.remove();
        } else {
            container.innerHTML = `<div class="empty-chat"><i class="fas fa-comment-slash"></i><p>Chat vazio.</p></div>`;
            return;
        }

        container.innerHTML = '';
        
        Object.keys(messages).forEach(key => {
            const msg = messages[key];
            const div = createMessageElement(key, msg);
            container.appendChild(div);
        });

        container.scrollTop = container.scrollHeight;
    });
}

// ====================================================================
// 3. ENVIO DE MENSAGENS
// ====================================================================

function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const text = input.value.trim();
    if (!text) return;

    const userName = window.currentSessionUser || sessionStorage.getItem('ytSessionUser') || 'Visitante';
    const userId = sessionStorage.getItem('userVoteId');
    const isReallyAdmin = (window.isAdminLoggedIn === true) || (firebase.auth().currentUser !== null);

    const msgData = {
        userId: userId,
        userName: userName,
        userIsAdmin: isReallyAdmin,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        isEdited: false
    };

    if (currentReplyMessage) {
        msgData.replyToId = currentReplyMessage.id;
        msgData.replyToUser = currentReplyMessage.user;
        msgData.replyToText = currentReplyMessage.text;
    }

    chatMessagesRef.push(msgData).then(() => {
        input.value = '';
        cancelReply();
    });
}

// ====================================================================
// 4. CRIAR ELEMENTO HTML (Com a Lógica do Avatar)
// ====================================================================

function createMessageElement(key, msg) {
    const isMine = msg.userId === sessionStorage.getItem('userVoteId');
    const div = document.createElement('div');
    div.className = `chat-message ${isMine ? 'mine' : ''} ${msg.userIsAdmin ? 'admin-king' : ''}`;
    div.id = 'msg-' + key;

    const safeUser = escapeHtml(msg.userName);
    const safeText = escapeHtml(msg.text);
    const safeTextForJs = safeText.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeUserForJs = safeUser.replace(/'/g, "\\'");
    const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const color = msg.userIsAdmin ? '#000000' : getUserColor(safeUser);

    // --- LÓGICA DO AVATAR ---
    let userIconHtml = '';
    const msgUserClean = safeUser.trim();
    const creatorClean = (window.roomCreatorName || '').trim();

    if (msg.userIsAdmin) {
        userIconHtml = '<i class="fas fa-crown" style="margin-right:5px; color:#3e2723; font-size: 0.9em;" title="Admin"></i>';
    } else if (creatorClean && msgUserClean === creatorClean) {
        const avatarClass = window.roomCreatorAvatar || 'fas fa-user';
        userIconHtml = `<i class="${avatarClass}" style="margin-right:5px; color:${color};" title="Dono da Sala"></i>`;
    }

    // HTML da Resposta
    let replyHtml = '';
    if(msg.replyToId) {
        replyHtml = `<div class="chat-reply-block"><small>${escapeHtml(msg.replyToUser)}</small><div>${escapeHtml(msg.replyToText)}</div></div>`;
    }

    const editedHtml = msg.isEdited ? '<span class="edited-marker" style="font-size:0.7em; opacity:0.7; font-style:italic;">(editado)</span>' : '';

    // Botões
    let actionsHtml = `
        <button class="chat-reply-btn" title="Responder" onclick="setReplyContext('${key}', '${safeUserForJs}', '${safeTextForJs}')">
            <i class="fas fa-reply"></i>
        </button>
    `;
    if (isMine) {
        actionsHtml += `
            <button class="chat-edit-btn" title="Editar" onclick="startEditing('${key}', '${safeTextForJs}')">
                <i class="fas fa-pen"></i>
            </button>
        `;
    }

    div.innerHTML = `
        ${replyHtml}
        <div class="chat-header">
            <span class="chat-user" style="color:${color}; font-weight: ${msg.userIsAdmin || (creatorClean && msgUserClean === creatorClean) ? 'bold' : 'normal'}">
                ${userIconHtml}${safeUser}
            </span>
            <div class="chat-message-actions" style="display:flex; gap:5px;">${actionsHtml}</div>
        </div>
        <div class="chat-body" id="body-${key}" style="color: ${msg.userIsAdmin ? '#2d1a0e' : 'inherit'}">${safeText}${editedHtml}</div>
        <div class="chat-time" style="color: ${msg.userIsAdmin ? '#5d4037' : 'inherit'}">${time}</div>
    `;
    return div;
}

// ===================================
// FUNÇÕES DE EDIÇÃO & RESPOSTA
// ===================================

function startEditing(key, currentText) {
    const bodyEl = document.getElementById(`body-${key}`);
    if (!bodyEl) return;
    bodyEl.dataset.originalHtml = bodyEl.innerHTML;
    bodyEl.innerHTML = `
        <div class="chat-edit-container">
            <textarea id="input-edit-${key}" class="chat-edit-input">${currentText}</textarea>
            <div class="chat-edit-actions" style="margin-top:5px; display:flex; justify-content:flex-end; gap:5px;">
                <button class="btn small danger" onclick="cancelEdit('${key}')">Cancelar</button>
                <button class="btn small primary" onclick="saveEdit('${key}')">Salvar</button>
            </div>
        </div>
    `;
    const textarea = document.getElementById(`input-edit-${key}`);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

function cancelEdit(key) {
    const bodyEl = document.getElementById(`body-${key}`);
    if (bodyEl && bodyEl.dataset.originalHtml) bodyEl.innerHTML = bodyEl.dataset.originalHtml;
}

function saveEdit(key) {
    const input = document.getElementById(`input-edit-${key}`);
    const newText = input.value.trim();
    if (!newText) { alert("A mensagem não pode ficar vazia."); return; }
    chatMessagesRef.child(key).update({ text: newText, isEdited: true }).catch(err => { alert("Erro ao salvar."); });
}

function setReplyContext(id, user, text) {
    currentReplyMessage = { id, user, text };
    const ctx = document.getElementById('chatReplyContext');
    ctx.style.display = 'flex';
    document.querySelector('.chat-reply-user').textContent = `Respondendo a ${user}`;
    document.querySelector('.chat-reply-text').textContent = text;
    document.getElementById('chatActionsBar').style.display = 'block';
    document.getElementById('chatMessageInput').focus();
}

function cancelReply() {
    currentReplyMessage = null;
    document.getElementById('chatReplyContext').style.display = 'none';
    document.getElementById('chatActionsBar').style.display = 'none';
}

function handleChatInput(e) {
    if (e.key === 'Enter') sendChatMessage();
    else {
        if (!isTyping) {
            isTyping = true;
            chatTypingRef.child(sessionStorage.getItem('userVoteId')).set({
                name: sessionStorage.getItem('ytSessionUser') || 'Visitante',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            isTyping = false;
            chatTypingRef.child(sessionStorage.getItem('userVoteId')).remove();
        }, 3000);
    }
}

chatTypingRef.on('value', snap => {
    const users = snap.val() || {};
    const names = Object.values(users)
        .filter(u => Date.now() - u.timestamp < 3000 && u.name !== sessionStorage.getItem('ytSessionUser'))
        .map(u => u.name);
    const el = document.getElementById('typingIndicator');
    if (names.length > 0) {
        el.classList.add('active');
        document.getElementById('typingUser').textContent = names.join(', ');
    } else {
        el.classList.remove('active');
    }
});

function handleClearChat() {
    if(confirm('Apagar todo o chat?')) chatMessagesRef.remove();
}

// ===================================
// SCROLL
// ===================================
let isUserScrolledUp = false;
let unreadCount = 0;

function setupChatScroll() {
    const chatList = document.getElementById('chatMessages');
    chatList.addEventListener('scroll', () => {
        const threshold = 100;
        const isNearBottom = chatList.scrollTop + chatList.clientHeight >= chatList.scrollHeight - threshold;
        isUserScrolledUp = !isNearBottom;
        if (isNearBottom && unreadCount > 0) {
            unreadCount = 0;
            updateNewMessagesIndicator();
        }
    });
}

function updateNewMessagesIndicator() {
    const indicator = document.getElementById('newMessagesIndicator');
    const countEl = document.getElementById('newMessagesCount');
    if (unreadCount > 0 && isUserScrolledUp) {
        countEl.textContent = unreadCount;
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

function scrollToBottom() {
    const chatList = document.getElementById('chatMessages');
    chatList.scrollTop = chatList.scrollHeight;
    unreadCount = 0;
    updateNewMessagesIndicator();
}

function onNewMessage(message) {
    if (isUserScrolledUp) { unreadCount++; updateNewMessagesIndicator(); }
}

// ====================================================================
// 5. EMOJIS - LÓGICA CORRIGIDA (Detecta botão HTML e JS)
// ====================================================================

let emojiPickerInitialized = false;

function setupEmojiSystem() {
    // 1. Garante que o modal existe
    if (!document.getElementById('emojiModal')) {
        createEmojiModal();
    }

    // 2. Configura o botão (seja ele do HTML ou criado via JS)
    const chatInputGroup = document.querySelector('.chat-input-group');
    let emojiBtn = document.getElementById('emojiBtn');

    // Se o botão NÃO existir no HTML, cria ele dinamicamente
    if (!emojiBtn && chatInputGroup) {
        const chatSendBtn = document.querySelector('.chat-input-group .btn.primary');
        if (chatSendBtn) {
            emojiBtn = document.createElement('button');
            emojiBtn.type = 'button';
            emojiBtn.className = 'btn small';
            emojiBtn.id = 'emojiBtn';
            emojiBtn.title = 'Emojis';
            emojiBtn.innerHTML = '<i class="far fa-smile"></i>';
            chatInputGroup.insertBefore(emojiBtn, chatSendBtn);
        }
    }

    // 3. ADICIONA O CLIQUE (A parte que estava faltando)
    if (emojiBtn) {
        // Removemos onclicks antigos para evitar conflito
        emojiBtn.onclick = null;
        
        // Adicionamos o novo evento corretamente
        emojiBtn.addEventListener('click', function(e) {
            e.preventDefault(); // Impede recarregar a página
            openEmojiPicker();
        });
    } else {
        // Se ainda não achou o input group (DOM lento), tenta de novo em breve
        setTimeout(setupEmojiSystem, 500);
    }
}

function openEmojiPicker() {
    const modal = document.getElementById('emojiModal');
    const picker = document.getElementById('emojiPicker');
    
    if (!modal) return; // Segurança

    // Inicializa a lógica do picker se for a primeira vez
    if (!emojiPickerInitialized) {
        initializeEmojiPicker();
        emojiPickerInitialized = true;
    }
    
    modal.style.display = 'flex';
    
    // Tenta focar na busca do emoji
    setTimeout(() => {
        if (picker && picker.shadowRoot) {
            const searchInput = picker.shadowRoot.querySelector('input');
            if (searchInput) searchInput.focus();
        }
    }, 100);
}

function closeEmojiPicker() {
    const modal = document.getElementById('emojiModal');
    if(modal) modal.style.display = 'none';
}

function initializeEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    const chatInput = document.getElementById('chatMessageInput');
    
    if(!picker || !chatInput) return;

    // Remove listener antigo e adiciona novo (para não duplicar emojis)
    picker.removeEventListener('emoji-click', insertEmoji);
    picker.addEventListener('emoji-click', insertEmoji);
    
    // Fechar ao clicar no fundo
    const modal = document.getElementById('emojiModal');
    if(modal) {
        modal.onclick = function(e) {
            if (e.target.id === 'emojiModal') closeEmojiPicker();
        };
    }
    
    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
            closeEmojiPicker();
        }
    });
}

// Função separada para inserir o emoji
function insertEmoji(event) {
    const chatInput = document.getElementById('chatMessageInput');
    if (!chatInput) return;

    const emoji = event.detail.unicode;
    
    const cursorPos = chatInput.selectionStart || 0;
    const textBefore = chatInput.value.substring(0, cursorPos);
    const textAfter = chatInput.value.substring(cursorPos);
    
    chatInput.value = textBefore + emoji + textAfter;
    
    const newPos = cursorPos + emoji.length;
    chatInput.setSelectionRange(newPos, newPos);
    chatInput.focus();
}

function createEmojiModal() {
    if (document.getElementById('emojiModal')) return;

    const modal = document.createElement('div');
    modal.id = 'emojiModal';
    modal.className = 'emoji-modal';
    modal.style.display = 'none';
    modal.style.zIndex = "99999"; // Garante que fique na frente de tudo
    modal.innerHTML = `
        <div class="emoji-modal-content">
            <emoji-picker id="emojiPicker"></emoji-picker>
            <div style="margin-top: 15px; text-align: center;">
                <button class="btn small danger" onclick="closeEmojiPicker()">Fechar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    if (typeof setupChatScroll === 'function') setupChatScroll();
    
    // Chama a nova função de setup unificada
    setupEmojiSystem();
});