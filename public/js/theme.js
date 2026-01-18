// ====================================================================
// TEMAS
// ====================================================================
const THEMES = {
    'default': { name: 'Roxo Clássico' },
    'pink': { name: 'Pink Vibes' },
    'light': { name: 'Modo Claro' },
    'oled': { name: 'Preto Absoluto' }
};

function openThemeModal() {
    const m = document.getElementById('themeModal');
    m.style.display = 'flex';
    setTimeout(() => m.style.opacity = '1', 10);
    
    const cur = localStorage.getItem('flowLinkTheme') || 'default';
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`theme-btn-${cur}`).classList.add('active');
}

function closeThemeModal() {
    const m = document.getElementById('themeModal');
    m.style.opacity = '0';
    setTimeout(() => m.style.display = 'none', 300);
}

function applyTheme(name) {
    document.body.classList.add('theme-transition');
    if(name === 'default') document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', name);
    localStorage.setItem('flowLinkTheme', name);
    
    setTimeout(() => document.body.classList.remove('theme-transition'), 500);
}

function resetToDefault() {
    applyTheme('default');
    showNotification('Tema padrão.', 'info');
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme(localStorage.getItem('flowLinkTheme') || 'default');
});