// ====================================================================
// SISTEMA DE BUSCA FLOWLINK (SEGURO, OTIMIZADO & SMART DJ)
// - Proteção XSS (Métodos DOM)
// - AbortController + Debounce Inteligente (Otimização de Rede)
// - Auto DJ Avançado (Ranking, DNA, Contexto)
// ====================================================================

/* GLOSSÁRIO DE GÊNEROS */
const MUSIC_GENRES = [
    { id: "sertanejo", name: "Sertanejo", icon: "fa-guitar" },
    { id: "funk", name: "Funk", icon: "fa-music" },
    { id: "pop", name: "Pop", icon: "fa-star" },
    { id: "rock", name: "Rock", icon: "fa-hand-rock" },
    { id: "electronic", name: "Eletrônica", icon: "fa-bolt" },
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
// 1. AUXILIARES E SEGURANÇA (ESCUDO XSS & DNA)
// ====================================================================

function decodeHtmlEntities(str) {
    if (!str) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
}

// Normaliza texto para comparação de DNA
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
function cleanTitle(title) {
    const t0 = decodeHtmlEntities(title);
    let t = normalizeText(t0);

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

// Cria tokens para Comparação Fuzzy (Jaccard)
function tokenizeForDNA(title) {
    const clean = cleanTitle(title);
    return clean.split(" ")
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
    if (resultsDiv) resultsDiv.innerHTML = ""; 

    // Verifica sessão do usuário
    if (typeof currentSessionUser !== 'undefined' && currentSessionUser) {
        const si = document.querySelector(".session-info");
        if (si) si.style.display = "flex";
        
        const g = document.getElementById("userNameInputGroup");
        if (g) g.style.display = "none";
        
        const cs = document.getElementById("currentSessionUser");
        if (cs) cs.textContent = currentSessionUser;
        
        setTimeout(() => document.getElementById("ytSearchQuery")?.focus(), 100);
    } else {
        const si = document.querySelector(".session-info");
        if (si) si.style.display = "none";
        
        const g = document.getElementById("userNameInputGroup");
        if (g) g.style.display = "block";
    }
}

function closeYTSearchModal() {
    const modal = document.getElementById("ytSearchModal");
    if (modal) modal.style.display = "none";
}

function setSessionUser() {
    const nameInput = document.getElementById("ytSearchName");
    const name = nameInput?.value?.trim(); 
    
    if (!name) return alert("Por favor, digite seu nome.");
    
    // Sanitização Básica
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

// Função segura para criar elementos (PROTEÇÃO XSS)
function createVideoElement(item) {
    const vidId = item?.id?.videoId;
    const title = item?.snippet?.title || "Sem título";
    const thumb = item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url;

    if (!vidId) return null;

    // Container
    const el = document.createElement("div");
    el.className = "yt-video-result";

    // Imagem
    const img = document.createElement("img");
    img.src = thumb; 
    img.style.cssText = "width:120px; height:90px; object-fit:cover; border-radius:4px;";
    img.alt = title;
    img.loading = "lazy";

    // Wrapper de Conteúdo
    const wrap = document.createElement("div");
    wrap.style.flex = "1";

    // Título (USANDO TEXTCONTENT - SEGURO)
    const h4 = document.createElement("h4");
    h4.style.cssText = "margin:0 0 5px 0; font-size:0.9rem; line-height:1.2;";
    h4.textContent = title; 

    // Botão Adicionar
    const btn = document.createElement("button");
    btn.className = "btn primary small";
    btn.textContent = "Adicionar"; 
    
    // Event Listener (Evita string eval/onclick)
    btn.addEventListener("click", () => {
        addVideo(`https://www.youtube.com/watch?v=${vidId}`, title);
        
        // Feedback Visual
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => closeYTSearchModal(), 300);
    });

    // Montagem
    wrap.appendChild(h4);
    wrap.appendChild(btn);
    el.appendChild(img);
    el.appendChild(wrap);

    return el;
}

async function searchYouTube() {
    const queryInput = document.getElementById("ytSearchQuery");
    const resultsDiv = document.getElementById("ytSearchResults");
    const q = queryInput?.value?.trim() || "";

    if (!resultsDiv) return;

    if (q.length < 2) {
        resultsDiv.innerHTML = '<div style="padding:16px; text-align:center; opacity:.8;">Digite pelo menos 2 letras...</div>';
        return;
    }

    // 1. Abortar requisição anterior
    if (ytSearchAbort) ytSearchAbort.abort();
    ytSearchAbort = new AbortController();

    // 2. Estado de Carregamento
    resultsDiv.innerHTML = `<div class="loading-yt" style="text-align:center; padding:20px;">
        <i class="fas fa-spinner fa-spin"></i> Buscando...
    </div>`;

    try {
        // 3. Busca na API segura
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}&maxResults=20`, {
            signal: ytSearchAbort.signal
        });

        if (!res.ok) throw new Error("Erro de API");

        const json = await res.json();
        const items = json.items || [];

        resultsDiv.innerHTML = ""; // Limpa carregamento

        if (items.length === 0) {
            resultsDiv.innerHTML = `<div style="padding:20px; text-align:center;">Nada encontrado.</div>`;
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
        resultsDiv.innerHTML = `<div style="color:#ff6b6b; padding:10px;">
            Erro ao buscar. O servidor está rodando?
        </div>`;
    }
}

// ====================================================================
// 4. SMART AUTO DJ (LÓGICA)
// ====================================================================

let selectedGenre = "pop";
let selectedType = "genre"; // 'genre' | 'similar' | 'trending'
let isAutoDjActive = false;
let autoDjCount = 5;
let autoDjInterval = null;

// Anti-repetição por artista/termo
const RECENT_ARTISTS_MAX = 10;
const recentArtists = []; 

function pushRecentArtist(name) {
    const n = normalizeText(name);
    if (!n) return;
    const idx = recentArtists.indexOf(n);
    if (idx >= 0) recentArtists.splice(idx, 1);
    recentArtists.push(n);
    if (recentArtists.length > RECENT_ARTISTS_MAX) recentArtists.shift();
}

function isRecentArtist(name) {
    const n = normalizeText(name);
    return n && recentArtists.includes(n);
}

// Gerenciamento da UI do Auto DJ
function renderGenres() {
    const container = document.querySelector(".generos-container");
    if (!container) return;
    
    container.innerHTML = "";
    MUSIC_GENRES.forEach(g => {
        const btn = document.createElement("button");
        btn.className = "genero-btn";
        if(g.id === selectedGenre) btn.classList.add("active");
        btn.setAttribute("data-genre", g.id);
        
        // InnerHTML Seguro
        btn.innerHTML = `<i class="fas ${g.icon}"></i><span>${g.name}</span>`;
        
        btn.onclick = () => {
            document.querySelectorAll(".genero-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectGenre(g.id);
        };
        
        container.appendChild(btn);
    });
}

function selectGenre(genre) {
    selectedGenre = genre;
}

function openSuggestionModal() {
    const m = document.getElementById("suggestionModal");
    if (m) m.style.display = "flex";
    detectCurrentGenre();
}

function closeSuggestionModal() {
    const m = document.getElementById("suggestionModal");
    if (m) m.style.display = "none";
}

function toggleAutoDj(e) {
    const toggle = document.getElementById("autoAddToggle");
    if (!toggle) return;

    // 1. DETECÇÃO INTELIGENTE: Quem clicou?
    if (e && e.type !== 'change') {
        toggle.checked = !toggle.checked;
    }

    // 2. ATUALIZA ESTADO GLOBAL
    isAutoDjActive = toggle.checked;
    
    // Elementos Visuais
    const btnPrincipal = document.getElementById("btn-auto-sugestao"); 
    const btnModal = document.querySelector(".btn-auto"); 

    if (isAutoDjActive) {
        // === LIGANDO ===
        showNotification("Auto DJ Ligado 🤖", "success");
        
        // Reiniciar ciclo
        if (autoDjInterval) clearInterval(autoDjInterval);
        runAutoDJCycle(); // Executa um agora
        autoDjInterval = setInterval(() => runAutoDJCycle(), 150000); // 2.5 min

        // Atualizar Botões
        if(btnPrincipal) {
            btnPrincipal.classList.add("auto-dj-on");
            btnPrincipal.innerHTML = '<i class="fas fa-robot"></i> Auto DJ On';
        }
        if (btnModal) {
            btnModal.classList.add("active");
            btnModal.innerHTML = '<i class="fas fa-stop-circle"></i> Auto (Ligado)';
        }

    } else {
        // === DESLIGANDO ===
        if (autoDjInterval) clearInterval(autoDjInterval);
        showNotification("Auto DJ Desligado", "info");
        
        // Atualizar Botões
        if(btnPrincipal) {
            btnPrincipal.classList.remove("auto-dj-on");
            btnPrincipal.innerHTML = '<i class="fas fa-magic"></i> Sugerir';
        }
        if (btnModal) {
            btnModal.classList.remove("active");
            btnModal.innerHTML = '<i class="fas fa-play-circle"></i> Auto (Ligar/Desligar)';
        }
    }
}

function detectCurrentGenre() {
    if (!player || typeof player.getVideoData !== "function") return;
    try {
        const title = normalizeText(player.getVideoData().title || "");
        const map = {
            sertanejo: ["sertanejo", "mateus", "jorge"],
            funk: ["funk", "mc", "proibidao", "proibid"],
            pagode: ["pagode", "samba"],
            rock: ["rock", "banda"],
            electronic: ["remix", "alok", "edm", "dj"],
            rap: ["rap", "trap", "hip hop", "hiphop"]
        };
        for (const g in map) {
            if (map[g].some(k => title.includes(k))) {
                document.querySelectorAll(".genero-btn").forEach(b => b.classList.remove("active"));
                const btn = document.querySelector(`.genero-btn[data-genre="${g}"]`);
                if(btn) btn.classList.add("active");
                selectGenre(g);
                return;
            }
        }
    } catch (e) {}
}

// Auxiliares do AutoDJ
function extractBaseArtistFromTitle(currentTitle) {
    let t = decodeHtmlEntities(currentTitle || "");
    if (t.includes("-")) t = t.split("-")[0];
    if (t.includes(":")) t = t.split(":")[0];
    t = t.split(",")[0];
    t = t.replace(/ft\..*|feat\..*|\(.*\)/gi, "").trim();
    return t;
}

function buildYouTubeQueryFromSpotify(fullTitle, mode, isOfficialContext) {
    const base = fullTitle?.trim();
    if (!base) return "";
    if (mode === "genre") return `${base} official audio`;
    if (isOfficialContext) return `${base} official video`;
    return `${base} official audio`;
}

function dedupeItemsById(items) {
    const seen = new Set();
    const out = [];
    for (const it of items || []) {
        const id = it?.id?.videoId;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(it);
    }
    return out;
}

function scoreCandidate(item, { isOfficialContext, queryNorm }) {
    const title = normalizeText(item?.snippet?.title || "");
    const channel = normalizeText(item?.snippet?.channelTitle || "");
    let score = 0;

    if (queryNorm && title.includes(queryNorm)) score += 20;
    if (channel.includes("vevo")) score += 120;
    if (channel.includes("official") || channel.includes("oficial")) score += 70;
    if (title.includes("official audio")) score += 60;
    if (title.includes("official video") || title.includes("video oficial")) score += 40;
    if (title.includes("audio")) score += 10;
    if (isOfficialContext && (channel.includes("disney") || channel.includes("dreamworks"))) score += 80;

    const bad = ["parodia", "paródia", "meme", "tiktok", "speed up", "slowed", "nightcore", "karaoke"];
    if (bad.some(b => title.includes(b))) score -= 1000;
    if (title.includes("cover") && !title.includes("cover art")) score -= 500;
    if (isOfficialContext && title.includes("remix")) score -= 120;

    return score;
}

function passesRepetitionFilters(candidateItem) {
    const vidId = candidateItem?.id?.videoId;
    const vidTitle = candidateItem?.snippet?.title || "";

    if (!vidId) return false;

    // 1. Já está tocando?
    const playingNow = (typeof player !== 'undefined' && player.getVideoData) ? player.getVideoData() : null;
    if (playingNow && playingNow.video_id === vidId) return false;

    // 2. Histórico da Sessão
    if (typeof playedVideoHistory !== "undefined" && playedVideoHistory.has(vidId)) return false;

    // 3. Fila Atual
    const queueIds = window.roomData?.queue
        ? Object.values(window.roomData.queue).map(x => x?.videoUrl?.split("v=")[1]).filter(Boolean)
        : [];
    if (queueIds.includes(vidId)) return false;

    // 4. Verificação de DNA
    const roomData = window.roomData || {};
    const history = roomData.history ? Object.values(roomData.history) : [];
    const queue = roomData.queue ? Object.values(roomData.queue) : [];

    let compareList = [...history, ...queue];
    if (playingNow?.title) compareList.push({ title: playingNow.title });
    compareList = compareList.slice(-20);

    const tokensCand = tokenizeForDNA(vidTitle);
    if (tokensCand.length < 2) return true;

    const isRepeated = compareList.some(m => {
        const tokensExist = tokenizeForDNA(m?.title || "");
        if (tokensExist.length < 2) return false;
        const sim = jaccard(tokensCand, tokensExist);
        return sim >= 0.72;
    });

    if (isRepeated) {
        console.log(`🚫 [AutoDJ] Recusado por DNA: "${vidTitle}"`);
        return false;
    }

    return true;
}

// Executar Ciclo AutoDJ
async function runAutoDJCycle(force = false) {
    if (!force && !isAutoDjActive) return;
    
    // Verifica limite da fila
    const autoCountEl = document.getElementById("autoCount");
    const limit = autoCountEl ? parseInt(autoCountEl.textContent || "5") : 5;
    
    if (!force && typeof videoQueue !== "undefined" && videoQueue.length >= limit) return;

    console.log("🚀 [AutoDJ] Iniciando ciclo...");
    if(force) showNotification("DJ Maestro pensando... 🎵", "info");

    try {
        let youtubeQuery = "";
        let isOfficialContext = false;
        let apiEndpoint = "";

        // ===== A) MODO GÊNERO =====
        if (selectedType === "genre" && selectedGenre) {
            console.log(`[AutoDJ] Modo Gênero: ${selectedGenre}`);
            apiEndpoint = `/api/spotify-recommendations?genre=${encodeURIComponent(selectedGenre)}`;
        }

        // ===== B) MODO TENDÊNCIAS =====
        else if (selectedType === "trending") {
             console.log(`[AutoDJ] Modo Tendências`);
             // Pop é um bom proxy para tendências no Spotify
             apiEndpoint = `/api/spotify-recommendations?genre=pop`; 
        }

        // ===== C) MODO CONTEXTO / SIMILAR =====
        else {
            const currentTitle = player?.getVideoData?.()?.title || "";
            
            // Avisa se tentar buscar similar sem nada tocando
            if (!currentTitle) {
                if(force) showNotification("Toque algo para buscar similares! 🎵", "warning");
                console.warn("[AutoDJ] Não é possível encontrar similares: Nenhum vídeo tocando.");
                return;
            }

            const titleLower = normalizeText(currentTitle);
            const cartoonTerms = ["disney","pixar","rei leao","rei leão","moana","frozen","encanto","mulan","tarzan","hercules","aladdin","pequena sereia","bela e a fera","cinderela","pocahontas","shrek","toy story","monstros","procurando nemo","incriveis","enrolados","valente","divertida mente","zootopia","trilha sonora","soundtrack","animacao","animação"];

            const isCartoon = cartoonTerms.some(t => titleLower.includes(t));
            let base = isCartoon ? "Disney" : extractBaseArtistFromTitle(currentTitle);

            if (!isCartoon && isRecentArtist(base)) {
                console.log(`⏳ [AutoDJ] Artista repetido, fallback para gênero.`);
                apiEndpoint = `/api/spotify-recommendations?genre=${selectedGenre || "pop"}`;
            } else {
                console.log(`👤 [AutoDJ] Contexto: "${base}"`);
                apiEndpoint = `/api/spotify-recommendations?q=${encodeURIComponent(base)}`;
            }
        }

        // 1) Spotify
        try {
            const spotifyRes = await fetch(apiEndpoint);
            if (spotifyRes.ok) {
                const recs = await spotifyRes.json();
                if (recs?.length) {
                    const suggestedSong = recs[Math.floor(Math.random() * recs.length)];
                    const term = normalizeText(suggestedSong.full);

                    if (term.includes("disney") || term.includes("soundtrack") || term.includes("frozen") || term.includes("encanto")) {
                        isOfficialContext = true;
                    }

                    youtubeQuery = buildYouTubeQueryFromSpotify(suggestedSong.full, selectedType, isOfficialContext);
                    pushRecentArtist(extractBaseArtistFromTitle(suggestedSong.full));
                    console.log(`🎵 [AutoDJ] Spotify: "${suggestedSong.full}"`);
                }
            }
        } catch (err) { console.warn("[AutoDJ] Falha no Spotify", err); }

        // Lógica de Fallback 
        if (!youtubeQuery) {
            if (selectedType === "genre") youtubeQuery = `${selectedGenre} hits brasil official audio`;
            else if (selectedType === "trending") youtubeQuery = `top hits brasil 2026 official audio`; // Fallback específico
            else youtubeQuery = `${player?.getVideoData?.()?.title || ""} official audio`;
        }

        const queryNorm = normalizeText(youtubeQuery);

        // 2) YouTube
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(youtubeQuery)}&maxResults=15`);
        if (!res.ok) return;

        const json = await res.json();
        let items = dedupeItemsById(json.items || []);
        if (!items.length) return;

        // 3) Pontuação + filtros
        const candidates = items
            .map(item => ({ item, score: scoreCandidate(item, { isOfficialContext, queryNorm }) }))
            .sort((a, b) => b.score - a.score);

        const winner = candidates.find(c => {
            return c.score > -150 && passesRepetitionFilters(c.item);
        });

        if (winner) {
            const vid = winner.item;
            console.log(`✅ [AutoDJ] Adicionando: ${vid.snippet.title}`);

            if (typeof videoQueueRef !== 'undefined') {
                await videoQueueRef.push({
                    phone: "🤖 DJ Maestro",
                    videoUrl: `https://www.youtube.com/watch?v=${vid.id.videoId}`,
                    title: vid.snippet.title,
                    addedBy: "DJ Maestro"
                });
                
                if (typeof playedVideoHistory !== "undefined") playedVideoHistory.add(vid.id.videoId);
                if (force) showNotification(`Sugerido: ${vid.snippet.title}`, "success");
            }
        } else {
            console.warn("⚠️ [AutoDJ] Filtros bloquearam todos os candidatos.");
        }

    } catch (e) {
        console.error("❌ Erro AutoDJ:", e);
    }
}

async function suggestNow() {
    const btn = document.querySelector(".btn-now");
    if (btn) { btn.disabled = true; btn.textContent = "Buscando..."; }
    
    await runAutoDJCycle(true);
    
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus-circle"></i> Adicionar Agora';
        closeSuggestionModal();
    }
}

// ====================================================================
// 5. INICIALIZAÇÃO E EVENTOS (COM BUSCA AUTOMÁTICA INTELIGENTE)
// ====================================================================

document.addEventListener("DOMContentLoaded", () => {
    renderGenres();
    
    const searchInput = document.getElementById("ytSearchQuery");
    const searchBtn = document.getElementById("btnSearchYoutube");
    const nameInput = document.getElementById("ytSearchName");

    // Controle de Timer
    let autoSearchTimeout = null;

    if (searchInput) {
        // 1. EVENTO DE INPUT (Busca automática com longo atraso)
        searchInput.addEventListener("input", () => {
            if (autoSearchTimeout) clearTimeout(autoSearchTimeout);

            const q = searchInput.value.trim();

            if (q.length >= 5) {
                autoSearchTimeout = setTimeout(() => {
                    console.log("⏰ Busca automática acionada (3s)");
                    searchYouTube();
                }, 3000); // 3 segundos de silêncio
            }
        });

        // 2. EVENTO DE ENTER (Busca Imediata)
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (autoSearchTimeout) clearTimeout(autoSearchTimeout);
                searchYouTube();
            }
        });
    }

    // 3. EVENTO DE CLIQUE (Busca Imediata)
    if (searchBtn) {
        searchBtn.addEventListener("click", () => {
            if (autoSearchTimeout) clearTimeout(autoSearchTimeout);
            searchYouTube();
        });
    }

    if (nameInput) {
        nameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") setSessionUser();
        });
    }

    // Configuração das Abas do Modal de Sugestão
    window.switchTab = function(tabName) {
        document.querySelectorAll(".suggestion-tab").forEach(t => t.classList.remove("active"));
        
        document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
        
        const btn = document.querySelector(`.suggestion-tab[onclick*="${tabName}"]`);
        if(btn) btn.classList.add("active");
        
        const content = document.getElementById(`${tabName}Content`);
        if(content) content.style.display = "block";
        
        selectedType = tabName;
    };
    
    // Iniciar na aba 'genre'
    if(typeof switchTab === 'function') switchTab('genre'); 
});

// Exportar Funções Globais
window.openYTSearchModal = openYTSearchModal;
window.closeYTSearchModal = closeYTSearchModal;
window.setSessionUser = setSessionUser;
window.changeUserName = changeUserName;
window.openSuggestionModal = openSuggestionModal;
window.closeSuggestionModal = closeSuggestionModal;
window.toggleAutoDj = toggleAutoDj; 
window.suggestNow = suggestNow;
window.changeAutoCount = (val) => {
    const el = document.getElementById("autoCount");
    if(!el) return;
    let v = parseInt(el.textContent) + val;
    if(v >= 1 && v <= 10) el.textContent = v;
};