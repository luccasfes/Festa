// ====================================================================
// CHAT (COM RESPOSTA E EDIÇÃO CORRIGIDOS)
// ====================================================================

let isTyping = false;
let typingTimeout;
let currentReplyMessage = null;


// Enviar Mensagem Nova
window.updateChatUserDisplay = function(name) {
    console.log("Chat: Atualizando display para:", name);
    const chatDisplay = document.getElementById('userNameDisplay');
    if (chatDisplay) {
        chatDisplay.textContent = name || 'Visitante';
    }
};
// E modifique a função sendChatMessage para usar o nome atualizado:
function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const text = input.value.trim();
    if (!text) return;

    const userName = window.currentSessionUser || sessionStorage.getItem('ytSessionUser') || 'Visitante';
    const userId = sessionStorage.getItem('userVoteId');

    // VERIFICAÇÃO ROBUSTA DE ADMIN
    // Verifica a variável global OU se o usuário está autenticado no Firebase
    const isReallyAdmin = (window.isAdminLoggedIn === true) || (firebase.auth().currentUser !== null);

    const msgData = {
        userId: userId,
        userName: userName,
        userIsAdmin: isReallyAdmin, // Agora ele não esquece se der F5
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

// Receber Mensagens (Listener)
chatMessagesRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
    const container = document.getElementById('chatMessages');
    const messages = snapshot.val() || {};
    
    // Remove empty state se houver mensagens
    if(Object.keys(messages).length > 0) {
        const empty = container.querySelector('.empty-chat');
        if(empty) empty.remove();
    } else {
        container.innerHTML = `<div class="empty-chat"><i class="fas fa-comment-slash"></i><p>Chat vazio.</p></div>`;
        return;
    }

    // Estratégia simples: Limpa e redesenha (para garantir ordem e atualizações de edição)
    // Em apps muito grandes usaríamos diff, mas para 50 msgs isso é rápido.
    container.innerHTML = '';
    
    Object.keys(messages).forEach(key => {
        const msg = messages[key];
        const div = createMessageElement(key, msg);
        container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
});

// Cria o HTML da mensagem
function createMessageElement(key, msg) {
    const isMine = msg.userId === sessionStorage.getItem('userVoteId');
    
    // Adiciona a classe 'admin-king'
    const div = document.createElement('div');
    
    // AQUI: Adicionamos a classe 'admin-king' sempre que o banco disser que é admin
    div.className = `chat-message ${isMine ? 'mine' : ''} ${msg.userIsAdmin ? 'admin-king' : ''}`;
    div.id = 'msg-' + key;

    const safeUser = escapeHtml(msg.userName);
    const safeText = escapeHtml(msg.text);
    const safeTextForJs = safeText.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeUserForJs = safeUser.replace(/'/g, "\\'");

    const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // CORREÇÃO DE COR: Se for Admin, usa PRETO (#000) para destacar no fundo Dourado
    const color = msg.userIsAdmin ? '#000000' : getUserColor(safeUser);

    // CORREÇÃO DA COROA: Coroa escura para ver no fundo claro
    const crownHtml = msg.userIsAdmin ? '<i class="fas fa-crown" style="margin-right:5px; color:#3e2723; font-size: 0.9em;"></i>' : '';

    // HTML da Resposta
    let replyHtml = '';
    if(msg.replyToId) {
        replyHtml = `<div class="chat-reply-block"><small>${escapeHtml(msg.replyToUser)}</small><div>${escapeHtml(msg.replyToText)}</div></div>`;
    }

    const editedHtml = msg.isEdited ? '<span class="edited-marker" style="font-size:0.7em; opacity:0.7; font-style:italic; margin-left:5px;">(editado)</span>' : '';

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
            <span class="chat-user" style="color:${color}; font-weight: ${msg.userIsAdmin ? 'bold' : 'normal'}">
                ${crownHtml}${safeUser}
            </span>
            <div class="chat-message-actions" style="display:flex; gap:5px;">
                ${actionsHtml}
            </div>
        </div>
        <div class="chat-body" id="body-${key}" style="color: ${msg.userIsAdmin ? '#2d1a0e' : 'inherit'}">${safeText}${editedHtml}</div>
        <div class="chat-time" style="color: ${msg.userIsAdmin ? '#5d4037' : 'inherit'}">${time}</div>
    `;
    return div;
}

// ===================================
// FUNÇÕES DE EDIÇÃO (RESTAURADAS)
// ===================================

function startEditing(key, currentText) {
    const bodyEl = document.getElementById(`body-${key}`);
    if (!bodyEl) return;

    // Salva o texto original no dataset para caso de cancelamento
    bodyEl.dataset.originalHtml = bodyEl.innerHTML;

    // Cria a interface de edição
    // As classes usadas aqui (chat-edit-container, chat-edit-input, btn small) devem existir no CSS
    bodyEl.innerHTML = `
        <div class="chat-edit-container">
            <textarea id="input-edit-${key}" class="chat-edit-input">${currentText}</textarea>
            <div class="chat-edit-actions" style="margin-top:5px; display:flex; justify-content:flex-end; gap:5px;">
                <button class="btn small danger" onclick="cancelEdit('${key}')">Cancelar</button>
                <button class="btn small primary" onclick="saveEdit('${key}')">Salvar</button>
            </div>
        </div>
    `;

    // Foca no textarea e move o cursor pro final
    const textarea = document.getElementById(`input-edit-${key}`);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

function cancelEdit(key) {
    const bodyEl = document.getElementById(`body-${key}`);
    if (bodyEl && bodyEl.dataset.originalHtml) {
        bodyEl.innerHTML = bodyEl.dataset.originalHtml;
    }
}

function saveEdit(key) {
    const input = document.getElementById(`input-edit-${key}`);
    const newText = input.value.trim();

    if (!newText) {
        alert("A mensagem não pode ficar vazia.");
        return;
    }

    // Atualiza no Firebase
    chatMessagesRef.child(key).update({
        text: newText,
        isEdited: true
    }).then(() => {
        // O listener 'on value' vai atualizar a tela automaticamente
    }).catch(err => {
        console.error("Erro ao editar:", err);
        alert("Erro ao salvar edição.");
    });
}


// ===================================
// FUNÇÕES DE RESPOSTA E DIGITAÇÃO
// ===================================

function setReplyContext(id, user, text) {
    currentReplyMessage = { id, user, text };
    const ctx = document.getElementById('chatReplyContext');
    ctx.style.display = 'flex';
    document.querySelector('.chat-reply-user').textContent = `Respondendo a ${user}`;
    document.querySelector('.chat-reply-text').textContent = text;
    
    // Mostra a barra de ações
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

// Indicador de digitação
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

// rolagem automática inteligente:

let isUserScrolledUp = false;
let unreadCount = 0;

function setupChatScroll() {
    const chatList = document.getElementById('chatMessages');
    
    chatList.addEventListener('scroll', () => {
        const threshold = 100;
        const isNearBottom = 
            chatList.scrollTop + chatList.clientHeight >= 
            chatList.scrollHeight - threshold;
        
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

// Chamar quando uma nova mensagem chegar (no listener do Firebase)
function onNewMessage(message) {
    if (isUserScrolledUp) {
        unreadCount++;
        updateNewMessagesIndicator();
    }
}

// Adicionar botão de emoji ao lado do input
function addEmojiPicker() {
    const emojiBtn = document.createElement('button');
    emojiBtn.innerHTML = '😀';
    emojiBtn.type = 'button';
    emojiBtn.className = 'btn small';
    emojiBtn.onclick = () => {
        // Abrir picker de emojis
        openEmojiPicker();
    };
    chatInputGroup.insertBefore(emojiBtn, chatSendBtn);
}

// No final do seu chat.js (ou no load da página)
document.addEventListener('DOMContentLoaded', function() {
    setupChatScroll();
    
    // Inicializar botão de emoji (opcional)
    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiBtn) {
        emojiBtn.style.display = 'flex'; // Mostrar o botão
        emojiBtn.addEventListener('click', openEmojiPicker);
    }
});

// FUNÇÕES DO EMOJI PICKER

let emojiPickerInitialized = false;

function openEmojiPicker() {
    const modal = document.getElementById('emojiModal');
    const picker = document.getElementById('emojiPicker');
    
    // Inicializar o picker se não estiver inicializado
    if (!emojiPickerInitialized) {
        initializeEmojiPicker();
        emojiPickerInitialized = true;
    }
    
    modal.style.display = 'flex';
    
    // Focar no input do emoji picker
    setTimeout(() => {
        const searchInput = picker.shadowRoot?.querySelector('input');
        if (searchInput) searchInput.focus();
    }, 100);
}

function closeEmojiPicker() {
    document.getElementById('emojiModal').style.display = 'none';
}

function initializeEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    const chatInput = document.getElementById('chatMessageInput');
    
    // Configurar o picker
    picker.addEventListener('emoji-click', event => {
        const emoji = event.detail.unicode;
        
        // Inserir o emoji no cursor atual
        const cursorPos = chatInput.selectionStart;
        const textBefore = chatInput.value.substring(0, cursorPos);
        const textAfter = chatInput.value.substring(cursorPos);
        
        chatInput.value = textBefore + emoji + textAfter;
        
        // Reposicionar o cursor
        const newPos = cursorPos + emoji.length;
        chatInput.setSelectionRange(newPos, newPos);
        
        // Focar de volta no input
        chatInput.focus();
        
        // Fechar o modal (opcional)
        // closeEmojiPicker();
    });
    
    // Fechar modal ao clicar fora
    document.getElementById('emojiModal').addEventListener('click', (e) => {
        if (e.target.id === 'emojiModal') {
            closeEmojiPicker();
        }
    });
    
    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('emojiModal').style.display === 'flex') {
            closeEmojiPicker();
        }
    });
}

// Modificar a função addEmojiPicker (se estiver usando)
function addEmojiPicker() {
    const chatInputGroup = document.querySelector('.chat-input-group');
    const chatSendBtn = document.querySelector('.chat-input-group .btn.primary');
    
    if (!chatInputGroup || !chatSendBtn) return;
    
    // Criar botão de emoji
    const emojiBtn = document.createElement('button');
    emojiBtn.type = 'button';
    emojiBtn.className = 'btn small';
    emojiBtn.id = 'emojiBtn';
    emojiBtn.title = 'Emojis';
    emojiBtn.innerHTML = '<i class="far fa-smile"></i>';
    emojiBtn.onclick = openEmojiPicker;
    
    // Inserir antes do botão de enviar
    chatInputGroup.insertBefore(emojiBtn, chatSendBtn);
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    setupChatScroll();
    
    // Adicionar o botão de emoji (se não existir no HTML)
    if (!document.getElementById('emojiBtn')) {
        addEmojiPicker();
    }
    
    // Criar o modal de emojis (se não existir)
    if (!document.getElementById('emojiModal')) {
        createEmojiModal();
    }
});

function createEmojiModal() {
    const modal = document.createElement('div');
    modal.id = 'emojiModal';
    modal.className = 'emoji-modal';
    modal.style.display = 'none';
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
