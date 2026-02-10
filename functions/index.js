// ====================================================================
// FLOWLINK SEARCH SYSTEM (SECURE & OPTIMIZED)
// - Proteção XSS (DOM Methods)
// - AbortController (Network optim)
// - Auto DJ com DNA Anti-Repetição
// ====================================================================

/* GLOSSÁRIO DE GÊNEROS */
const generosMusicais = [
    { id: "sertanejo", name: "Sertanejo", icon: "fa-guitar" },
    { id: "funk", name: "Funk", icon: "fa-music" },
    { id: "pop", name: "Pop", icon: "fa-star" },
    { id: "rock", name: "Rock", icon: "fa-hand-rock" },
    { id: "eletronica", name: "Eletrônica", icon: "fa-bolt" },
    { id: "rap", name: "Rap/Hip-Hop", icon: "fa-microphone" },
    { id: "reggaeton", name: "Reggaeton", icon: "fa-fire" },
    { id: "pagode", name: "Pagode/Samba", icon: "fa-drum" }
];

const STOPWORDS = new Set([
    "official", "oficial", "video", "clipe", "lyric", "audio", "ao", "vivo", "live",
    "remix", "mix", "set", "full", "album", "karaoke", "cover", "parodia", "paródia",
    "feat", "ft", "featuring", "prod", "original", "extended", "version", "versao",
    "hd", "4k", "vevo", "mv", "visualizer", "performance", "session"
]);

// ====================================================================
// 1. HELPERS & SEGURANÇA (XSS SHIELD)
// ====================================================================

// Normaliza texto para comparação (DNA)
function normalizeText(str) {
    return (str || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

// Limpa título para análise de DNA
function limparTitulo(titulo) {
    let t = normalizeText(titulo);
    return t
        .replace(/\s&\s/g, " e ")
        .replace(/&/g, " e ")
        .replace(/(\sft\.|\sfeat\.|\sfeaturing|\sparticipation).*/g, "")
        .replace(/\(.*?\)|\[.*?\]/g, " ")
        .replace(/official video|video oficial|clipe oficial|videoclipe|lyric|audio|visualizer|mv/g, " ")
        .replace(/ao vivo|live|performance|session|dvd|acustico|acustico/g, " ")
        .replace(/[^a-z0-9à-ú\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Cria tokens para comparação Fuzzy (Jaccard)
function tokenizarParaDNA(titulo) {
    const limpo = limparTitulo(titulo);
    return limpo.split(" ")
        .map(w => w.trim())
        .filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

// Calcula similaridade entre dois conjuntos de tokens
function jaccard(aTokens, bTokens) {
    const A = new Set(aTokens);
    const B = new Set(bTokens);
    if (A.size === 0 || B.size === 0) return 0;
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    const uni = A.size + B.size - inter;
    return uni ? inter / uni : 0;
}

// ====================================================================
// 2. MODAL & UI
// ====================================================================

function openYTSearchModal() {
    const modal = document.getElementById("ytSearchModal");
    if (!modal) return;
    
    modal.style.display = "flex";
    
    // Limpa resultados anteriores
    const resultsDiv = document.getElementById("ytSearchResults");
    if (resultsDiv) resultsDiv.innerHTML = ""; // Seguro pois estamos limpando

    // Verifica sessão do usuário
    if (typeof currentSessionUser !== 'undefined' && currentSessionUser) {
        document.querySelector(".session-info").style.display = "flex";
        document.getElementById("userNameInputGroup").style.display = "none";
        document.getElementById("currentSessionUser").textContent = currentSessionUser;
        
        setTimeout(() => document.getElementById("ytSearchQuery")?.focus(), 100);
    } else {
        document.querySelector(".session-info").style.display = "none";
        document.getElementById("userNameInputGroup").style.display = "block";
    }
}

function closeYTSearchModal() {
    const modal = document.getElementById("ytSearchModal");
    if (modal) modal.style.display = "none";
}

function setSessionUser() {
    const nameInput = document.getElementById("ytSearchName");
    const name = nameInput?.value?.trim(); // .value é seguro (string pura)
    
    if (!name) return alert("Por favor, digite seu nome.");
    
    // Sanitização básica extra (opcional, já que vamos usar textContent depois)
    const safeName = name.replace(/[<>]/g, ""); 
    
    currentSessionUser = safeName;
    sessionStorage.setItem("ytSessionUser", safeName);
    openYTSearchModal();
}

function changeUserName() {
    sessionStorage.removeItem("ytSessionUser");
    currentSessionUser = null;
    openYTSearchModal();
}

// ====================================================================
// 3. BUSCA SEGURA (RENDERIZAÇÃO DOM)
// ====================================================================

let ytSearchAbort = null;

// Função segura para criar elementos (XSS PROOF)
function createVideoElement(item) {
    const vidId = item?.id?.videoId;
    const title = item?.snippet?.title || "Sem título";
    const thumb = item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url;
    const channel = item?.snippet?.channelTitle || "";

    if (!vidId) return null;

    // Container
    const el = document.createElement("div");
    el.className = "yt-video-result";

    // Imagem
    const img = document.createElement("img");
    img.src = thumb; 
    img.alt = title;
    img.loading = "lazy";

    // Conteúdo (Texto)
    const content = document.createElement("div");
    content.className = "yt-result-content";

    // Título (USANDO TEXTCONTENT - SEGURO)
    const h4 = document.createElement("h4");
    h4.textContent = title; // <script> vira texto puro aqui

    // Canal
    const p = document.createElement("p");
    p.textContent = channel;
    p.style.fontSize = "0.8rem";
    p.style.color = "#aaa";

    // Botão
    const btn = document.createElement("button");
    btn.className = "btn primary small";
    btn.innerHTML = '<i class="fas fa-plus"></i> Adicionar'; // HTML estático seguro
    
    // Event Listener (Evita eval/onclick string)
    btn.addEventListener("click", () => {
        addVideo(`https://www.youtube.com/watch?v=${vidId}`, title);
        
        // Feedback visual simples
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => closeYTSearchModal(), 300);
    });

    // Montagem
    content.appendChild(h4);
    content.appendChild(p);
    content.appendChild(btn);
    el.appendChild(img);
    el.appendChild(content);

    return el;
}

async function searchYouTube() {
    const queryInput = document.getElementById("ytSearchQuery");
    const resultsDiv = document.getElementById("ytSearchResults");
    const q = queryInput?.value?.trim() || "";

    if (!resultsDiv) return;

    if (q.length < 2) {
        resultsDiv.innerHTML = '<div class="msg-box">Digite pelo menos 2 letras...</div>';
        return;
    }

    // 1. Abortar requisição anterior se houver
    if (ytSearchAbort) ytSearchAbort.abort();
    ytSearchAbort = new AbortController();

    // 2. Loading State
    resultsDiv.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Buscando...</div>';

    try {
        // 3. Fetch na API segura do Index.js
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}&maxResults=20`, {
            signal: ytSearchAbort.signal
        });

        if (!res.ok) throw new Error(`Erro: ${res.status}`);

        const json = await res.json();
        const items = json.items || [];

        resultsDiv.innerHTML = ""; // Limpa loading

        if (items.length === 0) {
            resultsDiv.innerHTML = '<div class="msg-box">Nenhum vídeo encontrado.</div>';
            return;
        }

        // 4. Renderização Segura via DOM
        items.forEach(item => {
            const el = createVideoElement(item);
            if (el) resultsDiv.appendChild(el);
        });

    } catch (e) {
        if (e.name === "AbortError") return; // Ignora abortos intencionais
        console.error(e);
        resultsDiv.innerHTML = '<div class="msg-error">Erro na busca. Tente novamente.</div>';
    }
}

// ====================================================================
// 4. AUTO DJ INTELIGENTE (LOGIC)
// ====================================================================

let sugestaoGeneroSelecionado = "pop";
let sugestaoTipoSelecionado = "genero";
let autoSugestaoAtiva = false;
let autoSugestaoInterval = null;
const RECENT_ARTISTS_MAX = 10;
const recentArtists = [];

// Gerenciamento de UI do Auto DJ
function renderizarGeneros() {
    const container = document.querySelector(".generos-container");
    if (!container) return;
    
    container.innerHTML = "";
    generosMusicais.forEach(g => {
        const btn = document.createElement("button");
        btn.className = "genero-btn";
        if(g.id === sugestaoGeneroSelecionado) btn.classList.add("active");
        
        // InnerHTML seguro (ícones e nomes controlados pela constante)
        btn.innerHTML = `<i class="fas ${g.icon}"></i><span>${g.name}</span>`;
        
        btn.addEventListener("click", () => {
            document.querySelectorAll(".genero-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            sugestaoGeneroSelecionado = g.id;
        });
        
        container.appendChild(btn);
    });
}

function toggleAutoDjBtn() {
    const toggle = document.getElementById("autoAddToggle");
    if (!toggle) return;
    
    autoSugestaoAtiva = toggle.checked;
    const btnPrincipal = document.getElementById("btn-auto-sugestao");

    if (autoSugestaoAtiva) {
        showNotification("Auto DJ Ligado 🤖", "success");
        if (autoSugestaoInterval) clearInterval(autoSugestaoInterval);
        
        // Tenta rodar imediatamente se a fila estiver vazia
        if (typeof videoQueue !== 'undefined' && videoQueue.length === 0) {
            rodarCicloAutoDJ();
        }
        
        autoSugestaoInterval = setInterval(rodarCicloAutoDJ, 240000); // 4 minutos
        
        if(btnPrincipal) {
            btnPrincipal.classList.add("auto-dj-on");
            btnPrincipal.innerHTML = '<i class="fas fa-robot"></i> Auto DJ On';
        }
    } else {
        if (autoSugestaoInterval) clearInterval(autoSugestaoInterval);
        showNotification("Auto DJ Desligado", "info");
        
        if(btnPrincipal) {
            btnPrincipal.classList.remove("auto-dj-on");
            btnPrincipal.innerHTML = '<i class="fas fa-magic"></i> Sugerir';
        }
    }
}

// Lógica de DNA e Anti-Repetição
function passesRepetitionFilters(candidateItem) {
    const vidId = candidateItem?.id?.videoId;
    const vidTitle = candidateItem?.snippet?.title || "";

    if (!vidId) return false;

    // 1. Já está tocando?
    const playingNow = (typeof player !== 'undefined' && player.getVideoData) ? player.getVideoData() : null;
    if (playingNow && playingNow.video_id === vidId) return false;

    // 2. Está na fila?
    const filaIds = window.roomData?.queue
        ? Object.values(window.roomData.queue).map(x => x?.videoUrl?.split("v=")[1])
        : [];
    if (filaIds.includes(vidId)) return false;

    // 3. Verificação de DNA (Similaridade de texto)
    const dadosSala = window.roomData || {};
    const historico = dadosSala.history ? Object.values(dadosSala.history) : [];
    const fila = dadosSala.queue ? Object.values(dadosSala.queue) : [];

    let listaComparacao = [...historico, ...fila];
    if (playingNow?.title) listaComparacao.push({ title: playingNow.title });
    
    // Pega as últimas 30 músicas para comparar
    listaComparacao = listaComparacao.slice(-30);

    const tokensCand = tokenizarParaDNA(vidTitle);
    if (tokensCand.length < 2) return true; // Título muito curto, deixa passar mas é arriscado

    const repetiu = listaComparacao.some(m => {
        const tokensExist = tokenizarParaDNA(m?.title || "");
        if (tokensExist.length < 2) return false;
        const sim = jaccard(tokensCand, tokensExist);
        return sim >= 0.70; // 70% de similaridade bloqueia
    });

    if (repetiu) {
        console.log(`🚫 [AutoDJ] Block por DNA: "${vidTitle}"`);
        return false;
    }

    return true;
}

// Score para escolher o melhor vídeo
function scoreCandidate(item, queryNorm) {
    const title = normalizeText(item?.snippet?.title || "");
    const channel = normalizeText(item?.snippet?.channelTitle || "");
    let score = 0;

    if (queryNorm && title.includes(queryNorm)) score += 20;
    if (channel.includes("vevo")) score += 100;
    if (channel.includes("official") || channel.includes("oficial")) score += 50;
    if (title.includes("official audio")) score += 40;
    
    const bad = ["parodia", "paródia", "meme", "tiktok", "speed up", "karaoke", "cover"];
    if (bad.some(b => title.includes(b))) score -= 500;

    return score;
}

async function rodarCicloAutoDJ(force = false) {
    if (!force && !autoSugestaoAtiva) return;
    
    // Não sugere se a fila já estiver cheia (economiza API)
    const autoCount = parseInt(document.getElementById("autoCount")?.textContent || "5");
    if (!force && typeof videoQueue !== "undefined" && videoQueue.length >= autoCount) return;

    console.log("🚀 [AutoDJ] Iniciando ciclo...");
    showNotification("DJ Maestro pensando... 🎵", "info");

    try {
        let spotifyQuery = "";
        let endpoint = "";

        // Define estratégia (Gênero ou Contexto)
        if (sugestaoTipoSelecionado === "genero" || !player?.getVideoData) {
            endpoint = `/api/spotify-recommendations?genre=${sugestaoGeneroSelecionado}`;
        } else {
            // Contexto baseado na música atual
            let currentTitle = player.getVideoData().title || "";
            // Extrai artista antes do hífen (ex: "Linkin Park - Numb" -> "Linkin Park")
            let artistBase = currentTitle.split("-")[0].replace(/\(.*\)|ft\..*/gi, "").trim();
            endpoint = `/api/spotify-recommendations?q=${encodeURIComponent(artistBase)}`;
        }

        // 1. Pede sugestão ao Spotify (via Server)
        const spRes = await fetch(endpoint);
        const spTracks = spRes.ok ? await spRes.json() : [];
        
        let queryYoutube = "";
        
        if (spTracks && spTracks.length > 0) {
            // Pega uma aleatória das sugestões
            const track = spTracks[Math.floor(Math.random() * spTracks.length)];
            queryYoutube = `${track.full} official audio`;
            console.log(`💡 [AutoDJ] Sugestão Spotify: ${track.full}`);
        } else {
            // Fallback se Spotify falhar
            queryYoutube = `${sugestaoGeneroSelecionado} hits brasil official audio`;
        }

        // 2. Busca no YouTube (via Server)
        const ytRes = await fetch(`/api/youtube-search?q=${encodeURIComponent(queryYoutube)}&maxResults=10`);
        const ytJson = await ytRes.json();
        const items = ytJson.items || [];

        // 3. Escolhe o melhor vídeo (Score + Filtros)
        const queryNorm = normalizeText(queryYoutube);
        
        const candidatos = items
            .map(item => ({ item, score: scoreCandidate(item, queryNorm) }))
            .sort((a, b) => b.score - a.score);

        const vencedor = candidatos.find(c => {
            return c.score > -100 && passesRepetitionFilters(c.item);
        });

        if (vencedor) {
            const vid = vencedor.item;
            console.log(`✅ [AutoDJ] Escolhido: ${vid.snippet.title}`);
            
            // Adiciona à fila
            if (typeof videoQueueRef !== 'undefined') {
                await videoQueueRef.push({
                    phone: "🤖 DJ Maestro",
                    videoUrl: `https://www.youtube.com/watch?v=${vid.id.videoId}`,
                    title: vid.snippet.title,
                    addedBy: "DJ Maestro"
                });
                
                showNotification(`DJ adicionou: ${vid.snippet.title}`, "success");
            }
        } else {
            console.warn("⚠️ [AutoDJ] Nenhum vídeo passou nos filtros.");
        }

    } catch (e) {
        console.error("❌ Erro AutoDJ:", e);
    }
}

// Botão "Adicionar Agora" do modal
async function sugerirAgora() {
    const btn = document.querySelector(".btn-now");
    if (btn) { btn.disabled = true; btn.textContent = "Buscando..."; }
    
    await rodarCicloAutoDJ(true);
    
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus-circle"></i> Adicionar Agora';
        closeSugestaoModal();
    }
}

// ====================================================================
// 5. INICIALIZAÇÃO E EVENTOS (COM AUTO-BUSCA INTELIGENTE)
// ====================================================================

document.addEventListener("DOMContentLoaded", () => {
    renderizarGeneros();
    
    const searchInput = document.getElementById("ytSearchQuery");
    const searchBtn = document.getElementById("btnSearchYoutube");
    const nameInput = document.getElementById("ytSearchName");

    // Variável de controle do Timer
    let autoSearchTimeout = null;

    if (searchInput) {
        // 1. EVENTO DE INPUT (Auto-busca com delay longo)
        searchInput.addEventListener("input", () => {
            // Limpa qualquer busca que estivesse agendada
            if (autoSearchTimeout) clearTimeout(autoSearchTimeout);

            const q = searchInput.value.trim();

            // Só agenda se tiver 5+ caracteres
            if (q.length >= 8) {
                autoSearchTimeout = setTimeout(() => {
                    console.log("⏰ Auto-busca disparada por inatividade (2s)");
                    searchYouTube();
                }, 5000); // 2 segundos de silêncio
            }
        });

        // 2. EVENTO DE ENTER (Busca Imediata)
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                // IMPORTANTE: Cancela a auto-busca para não gastar API 2x
                if (autoSearchTimeout) clearTimeout(autoSearchTimeout);
                searchYouTube();
            }
        });
    }

    // 3. EVENTO DE CLIQUE (Busca Imediata)
    if (searchBtn) {
        searchBtn.addEventListener("click", () => {
            // IMPORTANTE: Cancela a auto-busca para não gastar API 2x
            if (autoSearchTimeout) clearTimeout(autoSearchTimeout);
            searchYouTube();
        });
    }

    if (nameInput) {
        nameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") setSessionUser();
        });
    }

    // ... restante do código das abas ...
    window.switchTab = function(tabName) {
        // (código das abas igual ao anterior)
        document.querySelectorAll(".sugestao-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
        
        const btn = document.querySelector(`.sugestao-tab[onclick*="${tabName}"]`);
        if(btn) btn.classList.add("active");
        
        const content = document.getElementById(`${tabName}Content`);
        if(content) content.style.display = "block";
        
        sugestaoTipoSelecionado = tabName;
    };
    
    if(typeof switchTab === 'function') switchTab('genero');
});

// Exporta funções para uso global (HTML onclick)
window.openYTSearchModal = openYTSearchModal;
window.closeYTSearchModal = closeYTSearchModal;
window.setSessionUser = setSessionUser;
window.changeUserName = changeUserName;
window.openSugestaoModal = () => { document.getElementById("sugestaoModal").style.display = "flex"; };
window.closeSugestaoModal = () => { document.getElementById("sugestaoModal").style.display = "none"; };
window.toggleAutoDjBtn = toggleAutoDjBtn;
window.sugerirAgora = sugerirAgora;
window.changeAutoCount = (val) => {
    const el = document.getElementById("autoCount");
    if(!el) return;
    let v = parseInt(el.textContent) + val;
    if(v >= 1 && v <= 10) el.textContent = v;
};