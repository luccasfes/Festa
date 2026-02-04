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

// ====================================================================
// 1. FUNÇÃO DE LIMPEZA DE TÍTULO (IMPORTANTE PARA O DNA)
// ====================================================================
function limparTitulo(titulo) {
    if (!titulo) return "";
    
    // Decodifica HTML entities (ex: &amp; -> &)
    const txt = document.createElement("textarea");
    txt.innerHTML = titulo;
    let t = txt.value.toLowerCase();

    return t
        // 1. Padroniza duplas (Jorge & Mateus -> Jorge e Mateus)
        .replace(/\s&\s/g, ' e ') 
        .replace(/&/g, 'e') 
        
        // 2. Remove participações (Corta tudo depois do ft.)
        // Ex: "Musica ft. Fulano" -> "Musica"
        .replace(/(\sft\.|\sfeat\.|\sfeaturing|\sparticipation).*/g, '')

        // 3. Remove coisas entre parênteses e colchetes
        .replace(/\(.*\)|\[.*\]/g, '') 

        // 4. Remove termos técnicos de vídeo
        .replace(/official video|video oficial|clipe oficial|videoclipe|lyric|audio|visualizer/g, '')
        
        // 5. Remove termos de show
        .replace(/ao vivo|live|no ar|performance|session|em brasília|dvd|amazon original|acústico/g, '')
        
        // 6. Limpeza final de caracteres (apenas letras, números e espaços)
        .replace(/[^a-z0-9à-ú\s]/g, '') 
        .replace(/\s+/g, ' ') 
        .trim();
}

// ====================================================================
// 2. FUNÇÕES DE INTERFACE (MODAL E BUSCA MANUAL)
// ====================================================================
function openYTSearchModal() {
    const modal = document.getElementById('ytSearchModal');
    if(modal) modal.style.display = 'flex';
    
    const resultsDiv = document.getElementById('ytSearchResults');
    if (resultsDiv) resultsDiv.innerHTML = '';

    if (currentSessionUser) {
        if(document.querySelector('.session-info')) document.querySelector('.session-info').style.display = 'flex';
        if(document.getElementById('userNameInputGroup')) document.getElementById('userNameInputGroup').style.display = 'none';
        if(document.getElementById('currentSessionUser')) document.getElementById('currentSessionUser').textContent = currentSessionUser;
        setTimeout(() => {
            const input = document.getElementById('ytSearchQuery');
            if(input) input.focus();
        }, 100);
    } else {
        if(document.querySelector('.session-info')) document.querySelector('.session-info').style.display = 'none';
        if(document.getElementById('userNameInputGroup')) document.getElementById('userNameInputGroup').style.display = 'block';
    }
}

function closeYTSearchModal() {
    const modal = document.getElementById('ytSearchModal');
    if(modal) modal.style.display = 'none';
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

// Event Listeners seguros
const searchInput = document.getElementById('ytSearchQuery');
if (searchInput) {
    searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchYouTube() });
}

const nameInput = document.getElementById('ytSearchName');
if (nameInput) {
    nameInput.addEventListener('keypress', e => { if (e.key === 'Enter') setSessionUser() });
}

// ====================================================================
// 3. AUTO DJ - CONFIGURAÇÃO E UI
// ====================================================================
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
        autoSugestaoInterval = setInterval(rodarCicloAutoDJ, 240000); // 4 minutos
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

// ====================================================================
// 4. LÓGICA PRINCIPAL DO AUTO DJ (CORRIGIDA)
// ====================================================================

async function rodarCicloAutoDJ(force = false) {
    // Verifica se deve rodar
    if (!force && !autoSugestaoAtiva) return;
    if (typeof videoQueue !== 'undefined' && videoQueue.length >= autoSugestaoCount && !force) return;

    console.log("🚀 [DJ Maestro] Iniciando ciclo..."); 

    try {
        let queryParaYouTube = '';
        let contextoOficial = false; 
        let apiEndpoint = '';

        // === A. MODO GÊNERO ===
        if (sugestaoTipoSelecionado === 'genero' && sugestaoGeneroSelecionado) {
            console.log(`[DJ Maestro] Modo Gênero Ativo: ${sugestaoGeneroSelecionado}`);
            apiEndpoint = `/api/spotify-recommendations?genre=${sugestaoGeneroSelecionado}`;
        } 
        
        // === B. MODO CONTEXTO (Baseado na música atual) ===
        else {
            let currentTitle = player?.getVideoData?.()?.title || '';
            if (!currentTitle) {
                console.log("⚠️ [DJ Maestro] Nenhuma música tocando para basear contexto.");
                return; 
            }

            const titleLower = currentTitle.toLowerCase();

            // --- LISTA MÁGICA DE DESENHOS ---
            // Se encontrar qualquer um desses, força o modo Disney
            const termosDesenho = [
                'disney', 'pixar', 'princesa e o sapo', 'o rei leão', 'rei leao', 
                'moana', 'frozen', 'encanto', 'mulan', 'tarzan', 'hercules', 
                'aladdin', 'a pequena sereia', 'bela e a fera', 'cinderela', 
                'pocahontas', 'corcunda de notre dame', 'shrek', 'toy story', 
                'monstros s.a', 'procurando nemo', 'os incriveis', 'enrolados', 
                'valente', 'divertida mente', 'viva - a vida', 'wish', 'elementos', 
                'zootopia', 'trilha sonora', 'soundtrack', 'animação'
            ];

            const ehDesenho = termosDesenho.some(termo => titleLower.includes(termo));

            if (ehDesenho) {
                console.log(`🏰 [DJ Maestro] Detectado tema DESENHO/DISNEY no título.`);
                // Força "Disney" para o servidor buscar playlists de desenho
                currentTitle = "Disney"; 
            } else {
                // --- LÓGICA PADRÃO (LIMPEZA DE ARTISTA) ---
                if (currentTitle.includes('-')) currentTitle = currentTitle.split('-')[0];
                if (currentTitle.includes(':')) currentTitle = currentTitle.split(':')[0];
                currentTitle = currentTitle.split(',')[0];
                currentTitle = currentTitle.replace(/ft\..*|feat\..*|\(.*\)/gi, '').trim();
                
                console.log(`👤 [DJ Maestro] Modo Contexto: Baseado no Artista "${currentTitle}"`);
            }
            
            apiEndpoint = `/api/spotify-recommendations?q=${encodeURIComponent(currentTitle)}`;
        }

        // 1. Busca recomendação no Servidor/Spotify
        console.log(`📡 [DJ Maestro] Consultando API: ${apiEndpoint}`);
        try {
            const spotifyRes = await fetch(apiEndpoint);
            
            if (spotifyRes.ok) {
                const recs = await spotifyRes.json();
                console.log(`✅ [DJ Maestro] Spotify retornou ${recs ? recs.length : 0} sugestões.`);
                
                if (recs && recs.length > 0) {
                    const index = Math.floor(Math.random() * recs.length);
                    const musicaSugerida = recs[index];
                    const termo = musicaSugerida.full.toLowerCase();

                    // Definições de busca no YouTube
                    if (sugestaoTipoSelecionado === 'genero') {
                        queryParaYouTube = `${musicaSugerida.full} audio oficial -cover -remix`;
                        contextoOficial = true;
                    }
                    else if (termo.includes('disney') || termo.includes('moana') || termo.includes('frozen') || termo.includes('encanto') || termo.includes('soundtrack')) {
                        contextoOficial = true;
                        queryParaYouTube = `${musicaSugerida.full} Disney VEVO official video pt-br`;
                    } 
                    else {
                        queryParaYouTube = `${musicaSugerida.full} official audio`;
                    }
                    console.log(`🎵 [DJ Maestro] Escolha do Spotify: "${musicaSugerida.full}"`);
                }
            } else {
                console.warn(`⚠️ [DJ Maestro] Erro na API Spotify: ${spotifyRes.status}`);
            }
        } catch (err) {
            console.warn("[DJ Maestro] Falha na conexão com Spotify (usando fallback).", err);
        }

        // Fallback (se Spotify falhar)
        if (!queryParaYouTube) {
            console.log("🛡️ [DJ Maestro] Ativando Fallback (Modo Busca Manual)...");
            if (sugestaoTipoSelecionado === 'genero') {
                queryParaYouTube = `${sugestaoGeneroSelecionado} hits brasil oficial`;
            } else {
                const rawTitle = player?.getVideoData?.()?.title || '';
                queryParaYouTube = `${rawTitle} mix oficial`;
            }
        }

        console.log(`🔍 [DJ Maestro] Buscando no YouTube: "${queryParaYouTube}"`);

        // 2. Busca no YouTube
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(queryParaYouTube)}&maxResults=15`);
        
        if (!res.ok) {
            console.error(`❌ [DJ Maestro] Erro na busca do YouTube! Status: ${res.status}`);
            return;
        }

        const json = await res.json();
        if (!json.items || json.items.length === 0) {
            console.warn("⚠️ [DJ Maestro] YouTube retornou 0 vídeos.");
            return;
        }

        // 3. FILTRAGEM E PONTUAÇÃO
        const candidatos = json.items.map(item => {
            let score = 0;
            const t = item.snippet.title.toLowerCase();
            const c = item.snippet.channelTitle.toLowerCase();

            if (c.includes('vevo')) score += 100;
            if (c.includes('oficial') || c.includes('official')) score += 50;
            if (contextoOficial && (c.includes('disney') || c.includes('dreamworks'))) score += 80;

            if (t.includes('paródia') || t.includes('parodia') || t.includes('meme')) score -= 1000;
            if ((t.includes('cover') || t.includes('karaoke')) && !t.includes('cover art')) score -= 500;

            return { item, score };
        });

        candidatos.sort((a, b) => b.score - a.score);

        const vencedor = candidatos.find(cand => {
            if (cand.score < -100) return false; 
            
            const vidId = cand.item.id.videoId;
            const vidTitle = cand.item.snippet.title;

            // Filtros de Repetição
            const playingNow = player?.getVideoData?.();
            if (playingNow && playingNow.video_id === vidId) return false;
            
            const idRepetido = typeof playedVideoHistory !== 'undefined' && playedVideoHistory.has(vidId);
            if (idRepetido) return false;

            const filaIds = window.roomData && window.roomData.queue ? Object.values(window.roomData.queue).map(x => x.videoUrl.split('v=')[1]) : [];
            if (filaIds.includes(vidId)) return false;

            // DNA
            const dadosSala = window.roomData || {}; 
            const historico = dadosSala.history ? Object.values(dadosSala.history) : [];
            const fila = dadosSala.queue ? Object.values(dadosSala.queue) : [];
            
            let listaComparacao = [...historico, ...fila];
            if (playingNow && playingNow.title) listaComparacao.push({ title: playingNow.title });
            listaComparacao = listaComparacao.slice(-20); 

            const gerarTokens = (t) => limparTitulo(t).split(' ').filter(w => w.length >= 2);
            const tokensCandidato = gerarTokens(vidTitle);
            
            if (tokensCandidato.length < 2) return true;

            const temRepeticao = listaComparacao.some(musica => {
                const tokensExistente = gerarTokens(musica.title);
                if (tokensExistente.length < 2) return false;

                let matches = 0;
                tokensCandidato.forEach(token => {
                    if (tokensExistente.includes(token)) matches++;
                });

                const matchCandidato = matches / tokensCandidato.length;
                const matchExistente = matches / tokensExistente.length;

                return matchCandidato > 0.7 || matchExistente > 0.7; 
            });

            if (temRepeticao) {
                console.log(`🚫 [DJ Maestro] Recusou: "${vidTitle}" (Repetição detectada)`);
                return false; 
            }

            return true; 
        });

        if (vencedor) {
            const vid = vencedor.item;
            console.log(`✅ [DJ Maestro] Adicionando: ${vid.snippet.title}`);
            
            await videoQueueRef.push({
                phone: '🤖 DJ Maestro', 
                videoUrl: `https://www.youtube.com/watch?v=${vid.id.videoId}`,
                title: vid.snippet.title,
                addedBy: 'DJ Maestro'
            });
            
            if (typeof playedVideoHistory !== 'undefined') playedVideoHistory.add(vid.id.videoId);
            if (force) showNotification(`Sugerido: ${vid.snippet.title}`, 'success');
        } else {
            console.warn("⚠️ [DJ Maestro] Nenhum vídeo passou nos filtros.");
        }

    } catch (e) {
        console.error("❌ Erro FATAL DJ Maestro:", e);
    }
}

async function sugerirAgora() {
    const btn = document.querySelector('.btn-now');
    if(btn) { btn.disabled = true; btn.innerHTML = '...'; }
    
    // Passamos 'true' para forçar a adição
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