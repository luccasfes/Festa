// ====================================================================
// SISTEMA DE BUSCA FLOWLINK (SEGURO, OTIMIZADO & SMART DJ)
// - Proteção XSS (Métodos DOM)
// - AbortController + Debounce Inteligente (Otimização de Rede)
// - Auto DJ Avançado (Ranking, DNA, Contexto, Anti-Repetição Híbrido)
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

// Limpa título para análise de DNA (Remove parênteses, feats, etc)
function cleanTitle(title) {
    const t0 = decodeHtmlEntities(title);
    let t = normalizeText(t0);

    return t
        .replace(/\s&\s/g, " e ")
        .replace(/&/g, " e ")
        .replace(/(\sft\.|\sfeat\.|\sfeaturing|\sparticipation).*/g, "")
        .replace(/\(.*?\)|\[.*?\]/g, " ")
        .replace(/official video|video oficial|clipe oficial|videoclipe|lyric|audio|visualizer|mv/g, " ")
        .replace(/ao vivo|live|performance|session|dvd|acustico|acústico/g, " ")
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

    // Verifica sessão do utilizador
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
    
    if (!name) return alert("Por favor, digite o seu nome.");
    
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
    if (typeof addVideo === 'function') {
        addVideo(`https://www.youtube.com/watch?v=${vidId}`, title);
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-check"></i> Adicionado!';
    btn.style.background = "var(--color-background-success)";
    btn.style.color = "var(--color-text-success)";

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = 'Adicionar';
        btn.style.background = "";
        btn.style.color = "";
    }, 1500);
});

    // Montagem
    wrap.appendChild(h4);
    wrap.appendChild(btn);
    el.appendChild(img);
    el.appendChild(wrap);

    return el;
}

/**
 * Realiza a busca no YouTube de forma otimizada.
 * Utiliza AbortController para cancelar requisições anteriores e proteger contra XSS.
 * @async
 * @returns {Promise<void>}
 */
async function searchYouTube() {
    const queryInput = document.getElementById("ytSearchQuery");
    const resultsDiv = document.getElementById("ytSearchResults");
    const q = queryInput?.value?.trim() || "";

    if (!resultsDiv) return;

    if (q.length < 2) {
        resultsDiv.innerHTML = '<div style="padding:16px; text-align:center; opacity:.8;">Digite pelo menos 2 letras...</div>';
        return;
    }

    if (ytSearchAbort) ytSearchAbort.abort();
    ytSearchAbort = new AbortController();

    resultsDiv.innerHTML = `<div class="loading-yt" style="text-align:center; padding:20px;">
        <i class="fas fa-spinner fa-spin"></i> Buscando...
    </div>`;

    try {
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}&maxResults=20`, {
            signal: ytSearchAbort.signal
        });

        if (!res.ok) throw new Error("Erro de API");

        const json = await res.json();
        const items = json.items || [];

        resultsDiv.innerHTML = ""; 

        if (items.length === 0) {
            resultsDiv.innerHTML = `<div style="padding:20px; text-align:center;">Nada encontrado.</div>`;
            return;
        }

        items.forEach(item => {
            const el = createVideoElement(item);
            if (el) resultsDiv.appendChild(el);
        });

    } catch (e) {
        if (e.name === "AbortError") return; 
        resultsDiv.innerHTML = `<div style="color:#ff6b6b; padding:10px;">
            Erro ao buscar. O servidor está rodando?
        </div>`;
    }
}

// ====================================================================
// 4. SMART AUTO DJ (LÓGICA HÍBRIDA)
// ====================================================================

let selectedGenre = "pop";
let selectedType = "genre"; 
let isAutoDjActive = false;
let autoDjCount = 5;
let autoDjInterval = null;

/**
 * Variável de controle de concorrência (Mutex) para evitar chamadas simultâneas à API.
 * @type {boolean}
 */
let isAutoDjRunning = false;

// Anti-repetição por artista/termo
const RECENT_ARTISTS_MAX = 10;
const recentArtists = [];
const recentVideoIds = new Set(); 
const recentVideoTitles = []; 

const SIMILARITY_THRESHOLD = 0.40; 

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

function addToRecentIds(id) {
    if (!id) return;
    recentVideoIds.add(id);
    if (recentVideoIds.size > 50) {
        const first = recentVideoIds.values().next().value;
        recentVideoIds.delete(first);
    }
}

function normalizeForRepetition(title) {
    return normalizeText(title)
      .replace(/(versao|version|official|oficial|audio|video|hd|8d|ao vivo|live|lyric|clipe)/g, "")
      .replace(/\d+x?d?/g, "")
      .trim();
}

function passesRepetitionFilters(candidateItem) {
    const vidId = candidateItem?.id?.videoId;
    const rawTitle = candidateItem?.snippet?.title || "";

    if (!vidId) return false;

    if (typeof player !== 'undefined' && player?.getVideoData?.()?.video_id === vidId) return false;
    if (typeof playedVideoHistory !== 'undefined' && playedVideoHistory?.has(vidId)) return false;
    if (recentVideoIds.has(vidId)) return false;

    const queueIds = window.roomData?.queue
        ? Object.values(window.roomData.queue)
            .map(x => x?.videoUrl?.split("v=")[1]?.split("&")[0]).filter(Boolean)
        : [];
    if (queueIds.includes(vidId)) return false;

    const compareList = [
        ...Object.values(window.roomData?.history || {}),
        ...Object.values(window.roomData?.queue || {})
    ].map(m => m?.title || "").concat(recentVideoTitles); 

    const candNorm = normalizeForRepetition(rawTitle);
    const candTokens = tokenizeForDNA(candNorm);
    const cleanCand = cleanTitle(rawTitle); 

    if (candTokens.length < 2 && cleanCand.length < 5) return true;

    const isTooSimilar = compareList.some(t => {
        if (!t) return false;
        const existNorm = normalizeForRepetition(t);
        const cleanExist = cleanTitle(t);

        if (cleanCand.length > 8 && cleanExist.length > 8) {
            if (cleanCand === cleanExist || cleanCand.includes(cleanExist) || cleanExist.includes(cleanCand)) {
                return true; 
            }
        }

        const tokensExist = tokenizeForDNA(existNorm);
        if (tokensExist.length < 2) return false;
        
        return jaccard(candTokens, tokensExist) >= SIMILARITY_THRESHOLD;
    });

    if (isTooSimilar) return false;

    return true;
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

// === AUXILIARES DE UI AUTO DJ ===
function renderGenres() {
    const container = document.querySelector(".generos-container");
    if (!container) return;
    
    container.innerHTML = "";
    MUSIC_GENRES.forEach(g => {
        const btn = document.createElement("button");
        btn.className = "genero-btn";
        if(g.id === selectedGenre) btn.classList.add("active");
        btn.setAttribute("data-genre", g.id);
        
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

    if (e && e.type !== 'change') {
        toggle.checked = !toggle.checked;
    }

    isAutoDjActive = toggle.checked;
    
    const btnPrincipal = document.getElementById("btn-auto-sugestao"); 
    const btnModal = document.querySelector(".btn-auto"); 

    if (isAutoDjActive) {
        if(typeof showNotification === 'function') showNotification("Auto DJ Ligado", "success");
        
        if (autoDjInterval) clearInterval(autoDjInterval);
        runAutoDJCycle(); 
        autoDjInterval = setInterval(() => runAutoDJCycle(), 150000); 

        if(btnPrincipal) {
            btnPrincipal.classList.add("auto-dj-on");
            btnPrincipal.innerHTML = '<i class="fas fa-robot"></i> Auto DJ On';
        }
        if (btnModal) {
            btnModal.classList.add("active");
            btnModal.innerHTML = '<i class="fas fa-stop-circle"></i> Auto (Ligado)';
        }

    } else {
        if (autoDjInterval) clearInterval(autoDjInterval);
        if(typeof showNotification === 'function') showNotification("Auto DJ Desligado", "info");
        
        if(btnPrincipal) {
            btnPrincipal.classList.remove("auto-dj-on");
            btnPrincipal.innerHTML = '<i class="fas fa-magic"></i> Sugerir Música';
        }
        if (btnModal) {
            btnModal.classList.remove("active");
            btnModal.innerHTML = '<i class="fas fa-play-circle"></i> Auto (Ligar/Desligar)';
        }
    }
}

function detectCurrentGenre() {
    if (typeof player === 'undefined' || typeof player.getVideoData !== "function") return;
    try {
        const title = normalizeText(player.getVideoData().title || "");
        
        const map = {
            sertanejo: ["sertanejo", "mateus", "jorge", "marilia", "gusttavo", "ze neto", "henrique", "juliano", "maiara"],
            funk: ["funk", "mc", "dj", "kevin", "ryan sp", "cabelinho", "hariel", "ig"],
            pagode: ["pagode", "samba", "menos e mais", "thiaguinho", "ferrugem", "sorriso maroto", "dilsinho", "pericles", "mumuzinho", "revelacao"],
            rock: ["rock", "banda", "charlie brown", "skank", "o rappa", "titas", "cbjr"],
            electronic: ["remix", "alok", "edm", "vintage culture", "dubdogz", "kvsh", "cat dealers"],
            rap: ["rap", "trap", "hip hop", "teto", "matue", "xama", "filipe ret", "racionais", "tz da coronel", "veigh"],
            reggaeton: ["reggaeton", "bad bunny", "j balvin", "karol g"]
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

function extractBaseArtistFromTitle(currentTitle) {
    let t = decodeHtmlEntities(currentTitle || "");
    if (t.includes("-")) t = t.split("-")[0];
    if (t.includes(":")) t = t.split(":")[0];
    t = t.split(",")[0];
    t = t.replace(/ft\..*|feat\..*|\(.*\)/gi, "").trim();
    return t;
}

/**
 * Executa o ciclo principal do Auto DJ, buscando e adicionando recomendações musicais à fila.
 * Implementa controle de concorrência e preenchimento em cascata para proteção de cota de API.
 * @async
 * @param {boolean} [force=false] - Força a execução ignorando o estado de ativação do Auto DJ.
 * @returns {Promise<void>}
 */
async function runAutoDJCycle(force = false) {
    if (!force && !isAutoDjActive) return;
    if (isAutoDjRunning) return;

    const autoCountEl = document.getElementById("autoCount");
    const limit = autoCountEl ? parseInt(autoCountEl.textContent || "5", 10) : 5;
    
    if (!force && typeof videoQueue !== "undefined" && videoQueue.length >= limit) return;

    isAutoDjRunning = true;
    detectCurrentGenre();

    try {
        let isOfficialContext = false;
        let apiEndpoint = "";

        if (selectedType === "genre") {
            apiEndpoint = `/api/spotify-recommendations?genre=${encodeURIComponent(selectedGenre)}`;
        } else if (selectedType === "trending") {
            apiEndpoint = `/api/spotify-recommendations?genre=pop`;
        } else {
            const currentTitle = typeof player !== 'undefined' ? player?.getVideoData?.()?.title || "" : "";
            if (!currentTitle) return;

            const titleLower = normalizeText(currentTitle);
            const cartoonTerms = ["disney", "pixar", "soundtrack", "frozen", "encanto"];
            const isCartoon = cartoonTerms.some(t => titleLower.includes(t));

            let base = isCartoon ? "Disney" : extractBaseArtistFromTitle(currentTitle);

            if (!isCartoon && isRecentArtist(base)) {
                apiEndpoint = `/api/spotify-recommendations?genre=${selectedGenre || "pop"}`;
            } else {
                apiEndpoint = `/api/spotify-recommendations?q=${encodeURIComponent(base)}`;
            }
        }

        let possibleQueries = [];
        try {
            const spotifyRes = await fetch(apiEndpoint);
            if (spotifyRes.ok) {
                const recs = await spotifyRes.json();
                if (recs?.length) {
                    const shuffledRecs = recs.sort(() => 0.5 - Math.random());
                    
                    for (let i = 0; i < Math.min(3, shuffledRecs.length); i++) {
                        const term = normalizeText(shuffledRecs[i].full);
                        if (term.includes("disney") || term.includes("soundtrack")) {
                            isOfficialContext = true;
                        }
                        possibleQueries.push(`${shuffledRecs[i].full} official audio`);
                        
                        if (i === 0) pushRecentArtist(extractBaseArtistFromTitle(shuffledRecs[i].full));
                    }
                }
            }
        } catch (err) {
            // Tratamento de falha silenciosa para manter fluxo
        }

        if (possibleQueries.length === 0) {
            possibleQueries.push(`${selectedGenre || "pop"} hits brasil official audio`);
        }

        let winner = null;

        for (let i = 0; i < possibleQueries.length; i++) {
            const youtubeQuery = possibleQueries[i];
            const queryNorm = normalizeText(youtubeQuery);
            
            const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(youtubeQuery)}&maxResults=15`);
            if (!res.ok) continue; 

            const json = await res.json();
            let items = dedupeItemsById(json.items || []);
            if (!items.length) continue;

            const candidates = items
                .map(item => ({ item, score: scoreCandidate(item, { isOfficialContext, queryNorm }) }))
                .sort((a, b) => b.score - a.score);

            winner = candidates.find(c => c.score > -150 && passesRepetitionFilters(c.item));

            if (winner) break; 
        }

        if (winner) {
            const vid = winner.item;
            
            addToRecentIds(vid.id.videoId);
            recentVideoTitles.push(vid.snippet.title); 
            if (recentVideoTitles.length > 30) recentVideoTitles.shift();

            if (typeof videoQueueRef !== 'undefined') {
                await videoQueueRef.push({
                    phone: "🤖 DJ Maestro",
                    videoUrl: `https://www.youtube.com/watch?v=${vid.id.videoId}`,
                    title: vid.snippet.title,
                    addedBy: "DJ Maestro"
                });

                if (typeof playedVideoHistory !== 'undefined') {
                    playedVideoHistory.add(vid.id.videoId);
                }
            }
        }

    } catch (e) {
        // Exceção tratada no escopo principal
    } finally {
        isAutoDjRunning = false;

        if (!force && typeof videoQueue !== "undefined" && videoQueue.length < limit) {
            setTimeout(() => runAutoDJCycle(), 3000);
        }
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

    let autoSearchTimeout = null;

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            if (autoSearchTimeout) clearTimeout(autoSearchTimeout);

            const q = searchInput.value.trim();

            if (q.length >= 5) {
                autoSearchTimeout = setTimeout(() => {
                    searchYouTube();
                }, 3000); 
            }
        });

        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (autoSearchTimeout) clearTimeout(autoSearchTimeout);
                searchYouTube();
            }
        });
    }

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

    window.switchTab = function(tabName) {
        document.querySelectorAll(".suggestion-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
        
        const btn = document.querySelector(`.suggestion-tab[onclick*="${tabName}"]`);
        if(btn) btn.classList.add("active");
        
        const content = document.getElementById(`${tabName}Content`);
        if(content) content.style.display = "block";
        
        selectedType = tabName;
    };
    
    if(typeof switchTab === 'function') switchTab('genre'); 
});

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
    if(v >= 1 && v <= 5) el.textContent = v;
};