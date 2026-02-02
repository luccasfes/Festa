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
let autoSugestaoCount = 5;
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
    v = Math.max(1, Math.min(5, v));
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
       // 240000 (4 minutos)
       // 15000 (15 segundos)
        autoSugestaoInterval = setInterval(rodarCicloAutoDJ, 240000);
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
// public/js/search.js

async function rodarCicloAutoDJ(force = false) {
    // Verifica se deve rodar
    if (!force && !autoSugestaoAtiva) return;
    if (typeof videoQueue !== 'undefined' && videoQueue.length >= autoSugestaoCount && !force) return;

    try {
        let queryParaYouTube = '';
        let contextoOficial = false; // Se true, força busca VEVO/Oficial
        let apiEndpoint = '';

        // === DECISÃO: MODO GÊNERO ou MODO SIMILAR? ===
        // Se o usuário selecionou a aba "Gênero" explicitamente
        if (sugestaoTipoSelecionado === 'genero' && sugestaoGeneroSelecionado) {
            console.log(`[DJ Maestro] Modo Gênero Ativo: ${sugestaoGeneroSelecionado}`);
            apiEndpoint = `/api/spotify-recommendations?genre=${sugestaoGeneroSelecionado}`;
        } 
        // Caso contrário, usa a música atual como base (Modo Similar/Contexto)
        else {
            const currentTitle = player?.getVideoData?.()?.title || '';
            if (!currentTitle) return; // Se não tem música tocando nem gênero, não faz nada
            console.log(`[DJ Maestro] Modo Contexto: Baseado em "${currentTitle}"`);
            apiEndpoint = `/api/spotify-recommendations?q=${encodeURIComponent(currentTitle)}`;
        }

        // 1. Busca recomendação inteligente no Servidor/Spotify
        try {
            const spotifyRes = await fetch(apiEndpoint);
            if (spotifyRes.ok) {
                const recs = await spotifyRes.json();
                if (recs && recs.length > 0) {
                    // Pega uma sugestão aleatória das 5 retornadas para variar mais
                    const index = Math.floor(Math.random() * recs.length);
                    const musicaSugerida = recs[index];
                    
                    const termo = musicaSugerida.full.toLowerCase();

                    // Se for Gênero, sempre queremos oficial
                    if (sugestaoTipoSelecionado === 'genero') {
                        queryParaYouTube = `${musicaSugerida.full} audio oficial -cover -remix`;
                        contextoOficial = true;
                    }
                    // Detecção de Contexto Disney/Filmes (mantida da versão anterior)
                    else if (termo.includes('disney') || termo.includes('moana') || termo.includes('frozen') || termo.includes('encanto') || termo.includes('soundtrack')) {
                        contextoOficial = true;
                        queryParaYouTube = `${musicaSugerida.full} Disney VEVO official video pt-br`;
                    } 
                    // Padrão
                    else {
                        queryParaYouTube = `${musicaSugerida.full} official audio`;
                    }
                }
            }
        } catch (err) {
            console.warn("[DJ Maestro] Falha no Spotify, usando fallback manual.", err);
        }

        // Fallback (se Spotify falhar)
        if (!queryParaYouTube) {
            if (sugestaoTipoSelecionado === 'genero') {
                queryParaYouTube = `${sugestaoGeneroSelecionado} melhores hits oficial`;
            } else {
                const currentTitle = player?.getVideoData?.()?.title || '';
                queryParaYouTube = `${currentTitle} official video VEVO`;
            }
        }

        // 2. Busca no YouTube
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(queryParaYouTube)}&maxResults=15`);
        if (!res.ok) return;
        const json = await res.json();
        if (!json.items || json.items.length === 0) return;

        // 3. FILTRAGEM E PONTUAÇÃO (O "Ouvido" do Maestro)
        const candidatos = json.items.map(item => {
            let score = 0;
            const t = item.snippet.title.toLowerCase();
            const c = item.snippet.channelTitle.toLowerCase();
            const d = item.snippet.description.toLowerCase();

            // Bônus para Oficial
            if (c.includes('vevo')) score += 100;
            if (c.includes('oficial') || c.includes('official')) score += 50;
            if (c.includes('topic') || c.includes('tópico')) score += 40;
            
            // Contexto Específico
            if (contextoOficial) {
                if (c.includes('disney')) score += 80;
                if (c.includes('dreamworks')) score += 80;
            }

            // Penalidades (Lixo)
            if (t.includes('paródia') || t.includes('parodia')) score -= 1000;
            if (t.includes('meme')) score -= 1000;
            if (t.includes('cover') && !t.includes('cover art')) score -= 500;
            if (t.includes('react') || t.includes('analise')) score -= 500;
            if (t.includes('karaoke') || t.includes('playback')) score -= 500;

            return { item, score };
        });

        // Ordena pelos melhores
        candidatos.sort((a, b) => b.score - a.score);

        // Escolhe o vencedor (que não foi tocado ainda)
        const vencedor = candidatos.find(cand => {
            if (cand.score < -100) return false; // Ignora lixo total
            const idNaoRepetido = typeof playedVideoHistory !== 'undefined' && !playedVideoHistory.has(cand.item.id.videoId);
            return idNaoRepetido;
        });

        if (vencedor) {
            const vid = vencedor.item;
            console.log(`[DJ Maestro] Adicionando (${sugestaoTipoSelecionado}): ${vid.snippet.title}`);
            
            await videoQueueRef.push({
                phone: '🤖 DJ Maestro', 
                videoUrl: `https://www.youtube.com/watch?v=${vid.id.videoId}`,
                title: vid.snippet.title,
                addedBy: 'DJ Maestro'
            });
            
            if (typeof playedVideoHistory !== 'undefined') playedVideoHistory.add(vid.id.videoId);
            if (force) showNotification(`Sugerido: ${vid.snippet.title}`, 'success');
        }

    } catch (e) {
        console.error("Erro DJ Maestro:", e);
    }
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