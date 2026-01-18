// ====================================================================
// UTILITÁRIOS
// ====================================================================
let notificationTimer = null;

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');

    if (notificationTimer) clearTimeout(notificationTimer);

    notificationMessage.textContent = message;
    notification.className = 'notification ' + type + ' show';

    notificationTimer = setTimeout(() => {
        notification.classList.remove('show');
        notificationTimer = null;
    }, 5000);
}

function toggleLoading(buttonId, isLoading) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    
    // Tenta encontrar os spans pelo padrão de nomeação do seu HTML
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

// Fechar modais com ESC ou clique fora
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }
});