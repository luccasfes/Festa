// ====================================================================
// BUSCA NO YOUTUBE E AUTO DJ (CORRIGIDO: Botão Sugerir funciona sempre)
// ====================================================================

const generosMusicais = [
    { id: 'sertanejo', name: 'Sertanejo', icon: 'fa-guitar' },
    { id: 'funk', name: 'Funk', icon: 'fa-music' },
    { id: 'pop', name: 'Pop', icon: 'fa-star' },
    { id: 'rock', name: 'Rock', icon: 'fa-hand-rock' },
    { id: 'eletronica', name: 'Eletrônica', icon: 'fa-bolt' },
    { id: 'rap', name: 'Rap/Hip-Hop', icon: 'fa-microphone' },
    { id: 'reggaeton', name: 'Reggaeton', icon: 'fa-fire' },
    { id: 'pagode', name: 'Pagode/Samba', icon: 'fa-drum' }
];

// --- FUNÇÕES DE BUSCA ---
function openYTSearchModal() {
    document.getElementById('ytSearchModal').style.display = 'flex';
    const resultsDiv = document.getElementById('ytSearchResults');
    if (resultsDiv) resultsDiv.innerHTML = '';

    if (currentSessionUser) {
        document.querySelector('.session-info').style.display = 'flex';
        document.getElementById('userNameInputGroup').style.display = 'none';
        document.getElementById('currentSessionUser').textContent = currentSessionUser;
        setTimeout(() => {
            const input = document.getElementById('ytSearchQuery');
            if(input) input.focus();
        }, 100);
    } else {
        document.querySelector('.session-info').style.display = 'none';
        document.getElementById('userNameInputGroup').style.display = 'block';
    }
}

function closeYTSearchModal() {
    document.getElementById('ytSearchModal').style.display = 'none';
}

function setSessionUser() {
    const n = document.getElementById('ytSearchName').value;
    if(!n) return alert('Nome?');
    currentSessionUser = n;
    sessionStorage.setItem('ytSessionUser', n);
    openYTSearchModal();
}

function changeUserName() {
    sessionStorage.removeItem('ytSessionUser');
    currentSessionUser = null;
    openYTSearchModal();
}

async function searchYouTube() {
    const q = document.getElementById('ytSearchQuery').value;
    if(!q) return;
    
    const resultsDiv = document.getElementById('ytSearchResults');
    resultsDiv.innerHTML = '<div class="loading-yt" style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Buscando...</div>';
    
    try {
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}&maxResults=20`);
        if (!res.ok) throw new Error('Erro API');
        
        const json = await res.json();
        resultsDiv.innerHTML = '';
        
        if(!json.items || json.items.length === 0) {
            return resultsDiv.innerHTML = '<div style="padding:20px; text-align:center;">Nada encontrado.</div>';
        }
        
        json.items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'yt-video-result';
            const safeTitle = item.snippet.title.replace(/'/g, "\\'");
            
            el.innerHTML = `
                <img src="${item.snippet.thumbnails.default.url}" style="width:120px; height:90px; object-fit:cover; border-radius:4px;">
                <div style="flex:1;">
                    <h4 style="margin:0 0 5px 0; font-size:0.9rem; line-height:1.2;">${item.snippet.title}</h4>
                    <button class="btn primary small" onclick="addVideo('https://www.youtube.com/watch?v=${item.id.videoId}', '${safeTitle}')">Adicionar</button>
                </div>
            `;
            resultsDiv.appendChild(el);
        });

    } catch(e) {
        console.error(e);
        resultsDiv.innerHTML = '<div style="color:#ff6b6b; padding:10px;">Erro ao buscar. O servidor está rodando?</div>';
    }
}

// Verifica se o campo de busca existe antes de adicionar o evento (Segurança)
const searchInput = document.getElementById('ytSearchQuery');
if (searchInput) {
    searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchYouTube() });
}

// Se o campo existir, adiciona o evento de apertar Enter meio que se o user apertar enter ele fala entrega quando apertar enter
const nameInput = document.getElementById('ytSearchName');
if (nameInput) {
    nameInput.addEventListener('keypress', e => { if (e.key === 'Enter') setSessionUser() });
}


// --- AUTO DJ E GÊNEROS ---
let sugestaoGeneroSelecionado = 'pop';
let sugestaoTipoSelecionado = 'genero';
let autoSugestaoAtiva = false;
let autoSugestaoCount = 1;
let autoSugestaoInterval = null;

function renderizarGeneros() {
    const container = document.querySelector('.generos-container');
    if (!container) return;
    container.innerHTML = ''; 

    generosMusicais.forEach(g => {
        const btn = document.createElement('button');
        btn.className = 'genero-btn';
        btn.setAttribute('data-genero', g.id);
        btn.onclick = () => selectGenero(g.id);
        btn.innerHTML = `<i class="fas ${g.icon}"></i><span>${g.name}</span>`;
        container.appendChild(btn);
    });
}

function openSugestaoModal() {
    document.getElementById('sugestaoModal').style.display = 'flex';
    detectarGeneroAtual();
}

function closeSugestaoModal() {
    document.getElementById('sugestaoModal').style.display = 'none';
}

function switchTab(tabName) {
    document.querySelectorAll('.sugestao-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    
    const tabBtn = document.querySelector(`.sugestao-tab[onclick*="${tabName}"]`);
    if(tabBtn) tabBtn.classList.add('active');

    const content = document.getElementById(`${tabName}Content`);
    if(content) content.style.display = 'block';
    
    sugestaoTipoSelecionado = tabName;
}

function selectGenero(genero) {
    document.querySelectorAll('.genero-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.genero-btn[data-genero="${genero}"]`);
    if(btn) btn.classList.add('active');
    sugestaoGeneroSelecionado = genero;
}

function changeAutoCount(val) {
    let v = parseInt(document.getElementById('autoCount').textContent) + val;
    v = Math.max(1, Math.min(10, v));
    document.getElementById('autoCount').textContent = v;
    autoSugestaoCount = v;
}

function toggleAutoDjBtn() {
    const el = document.getElementById('autoAddToggle');
    el.checked = !el.checked;
    ativarAutoSugestao();
}

function ativarAutoSugestao() {
    const toggle = document.getElementById('autoAddToggle');
    if(!toggle) return;

    autoSugestaoAtiva = toggle.checked;
    
    if(autoSugestaoAtiva) {
        showNotification('Auto DJ Ligado', 'success');
        if(autoSugestaoInterval) clearInterval(autoSugestaoInterval);
        rodarCicloAutoDJ();
        autoSugestaoInterval = setInterval(rodarCicloAutoDJ, 15000);
    } else {
        if(autoSugestaoInterval) clearInterval(autoSugestaoInterval);
        showNotification('Auto DJ Desligado', 'info');
    }
    atualizarUIAutoDJ();
}

function atualizarUIAutoDJ() {
    const btn = document.getElementById("btn-auto-sugestao");
    if(!btn) return;
    if(autoSugestaoAtiva) {
        btn.classList.add("auto-dj-on");
        btn.innerHTML = '<i class="fas fa-robot"></i> Auto DJ Ligado';
    } else {
        btn.classList.remove("auto-dj-on");
        btn.innerHTML = '<i class="fas fa-magic"></i> Sugerir Música';
    }
}

function atualizarVisibilidadeAutoDJ() {
    const btn = document.getElementById("btn-auto-sugestao");
    if(!btn) return;
    if(isAdminLoggedIn || (typeof onlineUserCount !== 'undefined' && onlineUserCount <= 1)) {
        btn.style.setProperty('display', 'inline-flex', 'important');
    } else {
        btn.style.setProperty('display', 'none', 'important');
    }
}

function detectarGeneroAtual() {
    if(!player || typeof player.getVideoData !== 'function') return;
    try {
        const title = (player.getVideoData().title || '').toLowerCase();
        const map = {
            sertanejo: ['sertanejo', 'jorge'], funk: ['funk', 'mc'], pagode: ['pagode', 'samba'],
            rock: ['rock', 'banda'], eletronica: ['remix', 'alok'], rap: ['rap', 'trap']
        };
        for(let g in map) {
            if(map[g].some(k => title.includes(k))) { selectGenero(g); return; }
        }
    } catch(e){}
}

function gerarQuery() {
    const ano = new Date().getFullYear();
    if(sugestaoTipoSelecionado === 'tendencia') return `musicas mais tocadas ${ano} brasil`;
    
    if(sugestaoTipoSelecionado === 'similar') {
        const fullTitle = player?.getVideoData?.()?.title || '';
        if (!fullTitle) return `hits ${ano}`;

        // Tenta extrair o artista (geralmente antes do " - " ou " | ")
        const artista = fullTitle.split(/[-|]/)[0].trim();
        
        // Estratégia: buscar "rádio" ou "músicas parecidas" 
        // Adicionamos "-[título original]" para tentar excluir a música atual da busca
        const tituloLimpo = fullTitle.replace(/official video|clipe oficial|video/gi, '').trim();
        return `${artista} radio musicas similares -"${tituloLimpo}"`;
    }
    
    return `${sugestaoGeneroSelecionado} hits ${ano}`;
}

// CORREÇÃO AQUI: Aceita um parâmetro 'force' para rodar mesmo desligado
async function rodarCicloAutoDJ(force = false) {
    if(!force && !autoSugestaoAtiva) return;
    if(typeof videoQueue !== 'undefined' && videoQueue.length >= autoSugestaoCount && !force) return;

    try {
        const query = gerarQuery();
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}&maxResults=20`);
        if(!res.ok) return;
        const json = await res.json();
        if(!json.items) return;

        const currentTitle = (player?.getVideoData?.()?.title || '').toLowerCase();

        // Procura um vídeo que:
        // 1. Não esteja no histórico de IDs
        // 2. O título não contenha as palavras principais da música atual (para evitar covers/reposts)
        const vid = json.items.find(i => {
            const newTitle = i.snippet.title.toLowerCase();
            const idNaoRepetido = typeof playedVideoHistory !== 'undefined' && !playedVideoHistory.has(i.id.videoId);
            
            // Filtro de similaridade de texto simples:
            // Se o título atual tem "Flowers" e o novo também tem, ele ignora.
            const palavrasChave = currentTitle.split(' ').filter(w => w.length > 4); // pega palavras longas
            const eMesmaMusica = palavrasChave.some(p => newTitle.includes(p));

            return idNaoRepetido && !eMesmaMusica;
        });

        // Se o filtro rigoroso não achar nada, pegamos o primeiro do histórico mesmo (fallback)
        const finalVid = vid || json.items.find(i => typeof playedVideoHistory !== 'undefined' && !playedVideoHistory.has(i.id.videoId));

        if(finalVid) {
            await videoQueueRef.push({
                phone: '🤖 DJ Flow',
                videoUrl: `https://www.youtube.com/watch?v=${finalVid.id.videoId}`,
                title: finalVid.snippet.title
            });
            if(typeof playedVideoHistory !== 'undefined') playedVideoHistory.add(finalVid.id.videoId);
        }
    } catch(e){ console.error("Erro AutoDJ:", e); }
}

async function sugerirAgora() {
    const btn = document.querySelector('.btn-now');
    if(btn) { btn.disabled = true; btn.innerHTML = '...'; }
    
    // CORREÇÃO: Passamos 'true' para forçar a adição
    await rodarCicloAutoDJ(true);
    
    if(btn) {
        setTimeout(() => { 
            btn.disabled = false; 
            btn.innerHTML = '<i class="fas fa-plus-circle"></i> Adicionar Agora'; 
            closeSugestaoModal(); 
        }, 1000);
    }
}

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    renderizarGeneros();
    switchTab('genero');
    selectGenero('pop');
});