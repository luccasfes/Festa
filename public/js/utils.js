// ====================================================================
// UTILITÁRIOS GERAIS
// ====================================================================
let notificationTimer = null;

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');

    if (notificationTimer) clearTimeout(notificationTimer);

    if (notification && notificationMessage) {
        notificationMessage.textContent = message;
        notification.className = 'notification ' + type + ' show';

        notificationTimer = setTimeout(() => {
            notification.classList.remove('show');
            notificationTimer = null;
        }, 5000);
    }
}

function toggleLoading(buttonId, isLoading) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    
    const btnText = btn.querySelector('span:not(.loading)');
    const btnLoader = btn.querySelector('.loading');

    if (isLoading) {
        btn.disabled = true;
        if(btnText) btnText.style.display = 'none';
        if(btnLoader) btnLoader.style.display = 'inline-block';
    } else {
        btn.disabled = false;
        if(btnText) btnText.style.display = 'inline';
        if(btnLoader) btnLoader.style.display = 'none';
    }
}

function extractVideoId(url) {
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
    const match = url.match(regExp);
    return (match && match[1]) ? match[1] : null;
}

function escapeHtml(text) {
    if (!text) return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getUserColor(str) {
    if (!str || str === 'Visitante') return 'hsl(0, 0%, 70%)';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${hash % 360}, 70%, 65%)`;
}

// ====================================================================
// CONTROLE DE MODAIS (GERAL)
// ====================================================================

// Fechar modais com clique fora
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// Fechar modais com ESC
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }
});

// ====================================================================
// ATALHOS DE TECLADO (BLINDADO)
// ====================================================================
document.addEventListener('keydown', function(event) {
    // 1. Se estiver digitando em inputs, ignora
    if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;

    // 2. PROTEÇÃO MÁXIMA: Se qualquer tecla especial estiver apertada, PARA TUDO.
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return; 
    }

    // 3. Atalho 'R'
    if (event.key.toLowerCase() === 'r') {
        event.preventDefault(); // Evita escrever 'r' se algo estiver focado sem querer
        openReportModal();
    }
});

// ====================================================================
// LÓGICA DO SISTEMA DE REPORT (NOVO)
// ====================================================================

function openReportModal() {
    const modal = document.getElementById('reportModal');
    if(modal) modal.style.display = 'flex';
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if(modal) modal.style.display = 'none';
}

// Contador de caracteres (0/500)
function updateCharCount(textarea) {
    const currentLength = textarea.value.length;
    const display = document.getElementById('charCountDisplay');
    if(display) display.innerText = currentLength;
}

// Função de validação (Habilita o botão apenas se tudo estiver ok)
function checkReportValidity() {
    const confirmCheck = document.getElementById('confirmLegit');
    const reportUserParams = document.getElementById('reportUser');
    const submitBtn = document.getElementById('submitReportBtn');

    if (confirmCheck && reportUserParams && submitBtn) {
        // Regra: Checkbox marcado E nome do usuário preenchido
        if (confirmCheck.checked && reportUserParams.value.trim() !== "") {
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
            submitBtn.style.pointerEvents = "auto";
        } else {
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.5";
            submitBtn.style.pointerEvents = "none";
        }
    }
}

// Inicializa os ouvintes de evento para validação quando o site carrega
document.addEventListener('DOMContentLoaded', () => {
    const confirmCheck = document.getElementById('confirmLegit');
    const reportUserParams = document.getElementById('reportUser');

    if(confirmCheck) confirmCheck.addEventListener('change', checkReportValidity);
    if(reportUserParams) reportUserParams.addEventListener('input', checkReportValidity);
});

// Função Principal de Envio (Conectada ao novo Modal Compacto)
async function submitReportFull() {
    const userReported = document.getElementById('reportUser').value;
    const description = document.getElementById('reportReason').value;
    const roomNameElement = document.getElementById('roomNameDisplay');
    const roomName = roomNameElement ? roomNameElement.innerText : "Sala Desconhecida";
    
    // Coleta os checkboxes marcados (Motivos)
    const checkedBoxes = document.querySelectorAll('input[name="reportReasonType"]:checked');
    let selectedReasons = [];
    checkedBoxes.forEach((box) => selectedReasons.push(box.value));

    // Formata o motivo final
    const finalReason = selectedReasons.length > 0 ? selectedReasons.join(", ") : "Outro/Não especificado";
    const fullReasonText = `[Tipos: ${finalReason}] \nDetalhes: ${description}`;

    // Dados de quem enviou e da sala
    const roomId = window.currentRoomId || "ID Desconhecido"; 
    const reporter = window.currentSessionUser || sessionStorage.getItem('ytSessionUser') || "Anônimo";

    const btn = document.getElementById('submitReportBtn');
    const originalContent = btn.innerHTML; // Salva o texto original do botão
    
    // Estado de carregamento
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userReported: userReported,
                reason: fullReasonText, // Manda o texto combinado
                room: roomName,
                roomId: roomId,
                reporter: reporter
            })
        });

        if (response.ok) {
            alert("✅ Denúncia enviada com sucesso! A administração irá analisar.");
            closeReportModal();
            
            // Limpa o formulário após enviar
            document.getElementById('reportUser').value = '';
            document.getElementById('reportReason').value = '';
            document.getElementById('confirmLegit').checked = false;
            document.querySelectorAll('input[name="reportReasonType"]').forEach(box => box.checked = false);
            
            // Reseta contagem
            const countDisplay = document.getElementById('charCountDisplay');
            if(countDisplay) countDisplay.innerText = '0';

        } else {
            throw new Error("Erro no servidor");
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao enviar report. Tente novamente.");
    } finally {
        // Restaura o botão
        btn.innerHTML = originalContent;
        btn.disabled = true; // Volta desabilitado até preencher de novo
        btn.style.opacity = "0.5";
    }
}