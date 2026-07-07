let activeTags = [];
let savedMapState = null; 
let mapFilterApresActive = false;
let map, markerGroup;

// Prüfen welche Seite geladen wurde und Initialisieren
document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    setTimeout(() => {
        if (document.getElementById('map')) {
            initMap();
        }
        if (document.getElementById('filter-view')) {
            renderFilterView();
        }
        if (document.getElementById('compare-view')) {
            initCompareView();
        }
        if (document.getElementById('matchmaker-view')) {
            updateProgress(20);
        }
    }, 50);
});

// Hilfsfunktion: Von einer Liste zur Karte springen via URL Parameter
function jumpToResortFromList(resortId) {
    window.location.href = 'karte.html?resort=' + resortId;
}

// === REGION DETAIL VIEW LOGIK ===
function renderRegion(regionId) {
    if (typeof regionData === 'undefined' || !regionData[regionId]) return;
    
    const data = regionData[regionId];
    const heroImgEl = document.getElementById('rd-hero-img');
    if (heroImgEl) {
        heroImgEl.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url('${data.heroImg}')`;
    }
    
    document.getElementById('rd-title').innerText = data.name.toUpperCase();
    document.getElementById('rd-subtitle').innerText = data.subtitle;
    document.getElementById('rd-description').innerHTML = data.description;
    
    const costsHtml = data.costs.map(c => `
        <div class="cost-item">
            <span class="cost-label">${c.label}</span>
            <span class="cost-value">${c.value}</span>
        </div>
    `).join('');
    document.getElementById('rd-costs').innerHTML = costsHtml;

    const galleryContainer = document.getElementById('rd-gallery');
    let galleryHtml = '';

    if (data.galleryResorts) {
        data.galleryResorts.forEach(resortId => {
            const r = resorts.find(x => x.id === resortId);
            if (r) {
                galleryHtml += `
                    <div class="list-card" style="cursor: pointer;" onclick="jumpToResortFromList(${r.id})">
                        <div class="card-img-wrapper"><div class="card-img" style="background-image: url('${r.img}')"></div></div>
                        <div class="card-body">
                            <h3>${r.name}</h3>
                            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px; font-weight: 300; display:flex; align-items:center; gap:8px;"><i data-lucide="layers" size="14"></i> ${r.pisteKm} KM</div>
                            <div>${r.tags.slice(0, 2).map(t => `<span class="tag">${t}</span>`).join('')}</div>
                        </div>
                    </div>
                `;
            }
        });
    }
    galleryContainer.innerHTML = galleryHtml;
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// === LEAFLET SETUP (Für karte.html) ===
function initMap() {
    if (map) return; 
    
    map = L.map('map', { zoomControl: false }).setView([46.8, 10.8], 7);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18, attribution: '&copy; Esri'
    }).addTo(map);

    L.tileLayer('https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png', {
        maxZoom: 18, opacity: 0.6, attribution: '&copy; OpenSnowMap & OSM'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    markerGroup = L.layerGroup().addTo(map);

    map.on('zoom', updateZoomClasses);
    map.on('zoomend', updateZoomClasses);
    updateZoomClasses();
    
    map.on('click', closeSidebar);
    renderMarkers();

    const urlParams = new URLSearchParams(window.location.search);
    const resortId = urlParams.get('resort');
    if (resortId) {
        const resort = resorts.find(r => r.id == resortId);
        if (resort) {
            savedMapState = getRegionCenterZoom(resort);
            setTimeout(() => focusOnResort(resort, false), 500); 
        }
    }
}

function updateZoomClasses() {
    if(!map) return;
    const z = Math.floor(map.getZoom());
    const mapView = document.getElementById('map-view');
    if (mapView) {
        mapView.className = mapView.className.replace(/\bmin-z-\d+\b/g, '').trim();
        for(let i = 0; i <= z; i++) { mapView.classList.add(`min-z-${i}`); }
    }
}

function flyToRegion(region) {
    if(!map) return;
    if (region === 'alpen') map.flyTo([46.8, 10.8], 6, { duration: 1.5, easeLinearity: 0.25 });
    if (region === 'usa') map.flyTo([40.0, -109.0], 5, { duration: 1.5, easeLinearity: 0.25 });
    if (region === 'kanada') map.flyTo([50.8, -119.0], 7, { duration: 1.5, easeLinearity: 0.25 });
    if (region === 'japan') map.flyTo([39.0, 139.0], 5, { duration: 1.5, easeLinearity: 0.25 });
    if (region === 'ozeanien') map.flyTo([-40.0, 155.0], 4, { duration: 1.5, easeLinearity: 0.25 });
    if (region === 'skandinavien') map.flyTo([63.0, 15.0], 5, { duration: 1.5, easeLinearity: 0.25 });
}

function toggleApresFilter() {
    mapFilterApresActive = !mapFilterApresActive;
    const btn = document.getElementById('map-filter-apres');
    if (btn) btn.classList.toggle('active', mapFilterApresActive);
    applyMapFilters();
}

function applyMapFilters() { renderMarkers(); }

function getCountryFlag(tags) {
    if (tags.includes("Österreich")) return "🇦🇹"; if (tags.includes("Schweiz")) return "🇨🇭";
    if (tags.includes("Frankreich")) return "🇫🇷"; if (tags.includes("Italien")) return "🇮🇹";
    if (tags.includes("Deutschland")) return "🇩🇪"; if (tags.includes("Japan")) return "🇯🇵";
    if (tags.includes("USA")) return "🇺🇸"; if (tags.includes("Kanada")) return "🇨🇦";
    if (tags.includes("Australien")) return "🇦🇺"; if (tags.includes("Neuseeland")) return "🇳🇿";
    if (tags.includes("Schweden")) return "🇸🇪"; if (tags.includes("Norwegen")) return "🇳🇴";
    if (tags.includes("Finnland")) return "🇫🇮"; return "📍";
}

function getUltraShortName(resort) {
    if (!resort || (!resort.tags.includes("Großes Skigebiet") && resort.pisteKm < 150)) return ""; 
    const overrides = {
        "St. Anton am Arlberg": "St.A", "Ischgl": "Isch", "Zermatt": "Zerm", "Serfaus-Fiss-Ladis": "SFL",
        "Les 3 Vallées (Val Thorens/Courchevel)": "3Val", "Kitzbühel": "Kitz", "Zillertal Arena": "Zill",
        "Skiwelt Wilder Kaiser": "Skiw", "Montafon (Silvretta)": "Mont", "Davos Klosters": "Davs",
        "Dolomiti Superski": "Dolo", "Arosa Lenzerheide": "Aros", "Grindelwald (Jungfrau)": "Grin",
        "Verbier (4 Vallées)": "Verb", "Avoriaz (Portes du Soleil)": "Avor", "Tignes (Espace Killy)": "Tign",
        "Les Deux Alpes": "2Alp", "Alpe d'Huez": "Huez", "Hakuba Valley": "Haku",
        "Whistler Blackcomb": "Whis", "Vail": "Vail", "Park City": "Park", "Aspen Snowmass": "Aspn", "Perisher": "Peri"
    };
    const abbr = overrides[resort.name] || resort.name.substring(0, 4);
    return " " + abbr;
}

function getShortName(name) {
    const overrides = {
        "St. Anton am Arlberg": "St. Anton", "Serfaus-Fiss-Ladis": "SFL", "Les 3 Vallées (Val Thorens/Courchevel)": "3 Vallées",
        "Cortina d'Ampezzo": "Cortina", "Schladming (4-Berge)": "Schladming", "Wagrain (Snow Space)": "Wagrain",
        "Kitzsteinhorn (Kaprun)": "Kitzsteinhorn", "Saalbach-Hinterglemm": "Saalbach", "Skiwelt Wilder Kaiser": "Skiwelt",
        "Stubaier Gletscher": "Stubaier Gl.", "Pitztaler Gletscher": "Pitztal", "Oberstdorf-Kleinwalsertal": "Oberstdorf",
        "Damüls-Mellau": "Damüls", "Montafon (Silvretta)": "Montafon", "Davos Klosters": "Davos",
        "Engelberg-Titlis": "Engelberg", "St. Moritz (Corviglia)": "St. Moritz", "Dolomiti Superski": "Dolomiti",
        "Arosa Lenzerheide": "Arosa", "Grindelwald (Jungfrau)": "Grindelwald", "Crans-Montana": "Crans-M.",
        "Verbier (4 Vallées)": "Verbier", "Avoriaz (Portes du Soleil)": "Avoriaz", "Chamonix-Mont-Blanc": "Chamonix",
        "Tignes (Espace Killy)": "Tignes", "Les Deux Alpes": "2 Alpes", "Obergurgl-Hochgurgl": "Obergurgl",
        "Niseko United": "Niseko", "Hakuba Valley": "Hakuba", "Nozawa Onsen": "Nozawa",
        "Whistler Blackcomb": "Whistler", "Banff Sunshine": "Banff", "Skiliftkarussell Winterberg": "Winterberg",
        "Feldberg (Schwarzwald)": "Feldberg", "Aspen Snowmass": "Aspen", "Coronet Peak": "Coronet P.", "Treble Cone": "Treble C."
    };
    if (overrides[name]) return overrides[name];
    let short = name.split(' (')[0];
    if (short.length > 14) short = short.substring(0, 12) + '.';
    return short;
}

function renderMarkers() {
    if (!markerGroup) return;
    markerGroup.clearLayers();
    const sizeFilterEl = document.getElementById('map-filter-size');
    const priceFilterEl = document.getElementById('map-filter-price');
    const sizeFilter = sizeFilterEl ? parseInt(sizeFilterEl.value) : 0;
    const priceFilter = priceFilterEl ? parseInt(priceFilterEl.value) : 0;

    const filteredResorts = resorts.filter(r => {
        if (sizeFilter > 0 && r.pisteKm < sizeFilter) return false;
        if (priceFilter > 0 && r.priceLevel !== priceFilter) return false;
        if (mapFilterApresActive && !r.tags.includes('Après-Ski')) return false;
        return true;
    });

    filteredResorts.forEach(resort => {
        // Größenzuweisung für die Zoom-Logik
        let sizeClass = 'marker-large'; // Standardmäßig immer sichtbar
        
        // Wir prüfen, ob das Gebiet in den stark besiedelten Alpen liegt
        const isAlpine = resort.tags.some(tag => 
            ['Österreich', 'Schweiz', 'Frankreich', 'Italien', 'Deutschland'].includes(tag)
        );
        
        // Nur wenn es in den Alpen liegt, blenden wir kleine Gebiete bei weitem Zoom aus
        if (isAlpine) {
            if (resort.pisteKm < 50) {
                sizeClass = 'marker-small';
            } else if (resort.pisteKm < 120) {
                sizeClass = 'marker-medium';
            }
        }

        // Icon erstellen
        const customIcon = L.divIcon({ 
            className: `custom-icon-wrapper ${sizeClass}`, 
            html: `<div class="marker-pin"></div>`, 
            iconSize: [26, 26], 
            iconAnchor: [13, 13] 
        });
        
        const marker = L.marker(resort.coords, { icon: customIcon }).addTo(markerGroup);
        
        // Labels für Übersee und Skandinavien schon bei weitem Zoom (Stufe 5) anzeigen
        let thresholdClass = isAlpine ? 'label-t9' : 'label-t5';

        const flag = getCountryFlag(resort.tags);
        let tooltipHtml = '';

        // USA und Japan immer mit vollem Namen anzeigen
        if (resort.tags.includes('USA') || resort.tags.includes('Japan')) {
            tooltipHtml = `<span style="display:inline;">${flag} ${resort.name.toUpperCase()}</span>`;
        } else {
            const ultraShortName = getUltraShortName(resort);
            const shortName = getShortName(resort.name);
            tooltipHtml = `
                <span class="lbl-ultra-short">${flag}${ultraShortName.toUpperCase()}</span>
                <span class="lbl-short">${flag} ${shortName.toUpperCase()}</span>
                <span class="lbl-full">${flag} ${resort.name.toUpperCase()}</span>
            `;
        }

        marker.bindTooltip(tooltipHtml, { permanent: true, direction: 'right', className: `resort-label ${thresholdClass}`, offset: [15, 0] });
        
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            focusOnResort(resort, true);
        });
    });
}

function getRegionCenterZoom(resort) {
    if (resort.tags.includes('USA')) return { center: [40.0, -109.0], zoom: 5 };
    if (resort.tags.includes('Kanada')) return { center: [50.8, -119.0], zoom: 7 };
    if (resort.tags.includes('Japan')) return { center: [39.0, 139.0], zoom: 5 };
    if (resort.tags.includes('Australien') || resort.tags.includes('Neuseeland')) return { center: [-40.0, 155.0], zoom: 4 };
    if (resort.tags.includes('Skandinavien') || resort.tags.includes('Schweden') || resort.tags.includes('Norwegen') || resort.tags.includes('Finnland')) return { center: [63.0, 15.0], zoom: 5 };
    return { center: [46.8, 10.8], zoom: 6 }; 
}

function focusOnResort(resort, saveState=true) {
    if(!map) return;
    if (saveState && !document.getElementById('sidebar').classList.contains('open')) {
        savedMapState = { center: map.getCenter(), zoom: map.getZoom() };
    }
    openSidebar(resort);
    map.flyTo(resort.coords, 12, { duration: 1.5, easeLinearity: 0.25 });
}

function openSidebar(resort) {
    document.getElementById('sb-title').innerText = resort.name.toUpperCase();
    document.getElementById('sb-piste').innerText = resort.pisteKm;
    document.getElementById('sb-lifts').innerText = resort.lifts;
    document.getElementById('sb-elev').innerText = resort.elevation;
    
    let skipassText = resort.skipass || "k.A.";
    if (resort.skipass && !resort.skipass.includes('€')) {
        const exchangeRates = { 'CHF': 1.05, '¥': 0.0062, 'CAD': 0.69, 'USD': 0.93, 'AUD': 0.61, 'NZD': 0.55, 'SEK': 0.087, 'NOK': 0.085 };
        const match = resort.skipass.match(/(\d+)\s*([A-Za-z¥]+)/);
        if (match && exchangeRates[match[2]]) {
            const inEuro = Math.round(parseFloat(match[1]) * exchangeRates[match[2]]);
            skipassText = `${resort.skipass} (~${inEuro} €)`;
        }
    }
    document.getElementById('sb-price').innerText = skipassText;

    let bestTime = "DEZ - APR";
    if (resort.tags.includes("Gletscher") || resort.tags.includes("Ganzjahresski")) bestTime = "OKT - JUN";
    else if (resort.elevation >= 2500) bestTime = "NOV - MAI";
    if (resort.tags.includes("Australien") || resort.tags.includes("Neuseeland")) bestTime = "JUN - OKT";
    document.getElementById('sb-best-time').innerText = bestTime;

    let blue = 35, red = 45, black = 20; 
    if (resort.tags.includes("Familien")) { blue = 55; red = 35; black = 10; }
    else if (resort.tags.includes("Off-Piste")) { blue = 20; red = 40; black = 40; }
    else if (resort.tags.includes("Großes Skigebiet")) { blue = 40; red = 40; black = 20; }
    
    document.getElementById('sb-diff-blue').style.width = blue + '%';
    document.getElementById('sb-diff-red').style.width = red + '%';
    document.getElementById('sb-diff-black').style.width = black + '%';

    document.getElementById('sb-desc').innerText = resort.highlights;
    document.getElementById('sb-img').style.backgroundImage = `url('${resort.img}')`;
    
    const priceLabels = { 1: "PREISWERT", 2: "MITTEL", 3: "PREMIUM" };
    const priceTagHtml = `<span class="tag" style="background: var(--primary); color: var(--text-light); border-color: var(--primary);"><i data-lucide="tag" size="10" style="margin-right: 4px;"></i> ${priceLabels[resort.priceLevel] || "UNBEKANNT"}</span>`;
    
    document.getElementById('sb-tags').innerHTML = priceTagHtml + resort.tags.map(t => `<span class="tag">${t}</span>`).join('');

    const mapContainer = document.getElementById('sb-piste-map-container');
    const mapThumb = document.getElementById('sb-piste-map');
    if (resort.pisteMap) {
        mapThumb.style.backgroundImage = `url('${resort.pisteMap}')`;
        mapThumb.dataset.fullSrc = resort.pisteMap;
        mapContainer.style.display = 'block';
    } else { mapContainer.style.display = 'none'; }

    const webBtn = document.getElementById('sb-website');
    if (resort.website) { webBtn.href = resort.website; webBtn.style.display = 'flex'; } 
    else { webBtn.style.display = 'none'; }
    
    const sbContent = document.querySelector('#sidebar .sidebar-content');
    if (sbContent) sbContent.scrollTop = 0;
    document.getElementById('sidebar').classList.add('open');
    if (typeof lucide !== 'undefined') lucide.createIcons(); 
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    if (savedMapState && map) {
        map.flyTo(savedMapState.center, savedMapState.zoom, { duration: 1.5 });
        savedMapState = null;
    }
}

// === FILTER LOGIK (Für entdecken.html) ===
function renderFilterView() {
    const searchInputObj = document.getElementById('search-input');
    if (!searchInputObj) return; 

    const clearBtn = document.getElementById('clear-search-btn');
    const searchTerm = searchInputObj.value.toLowerCase();
    
    if (clearBtn) clearBtn.style.display = searchTerm.length > 0 ? 'block' : 'none';
    
    const btnContainer = document.getElementById('filter-buttons');
    if (btnContainer) {
        btnContainer.innerHTML = allTags.map(tag => `
            <button class="filter-btn ${activeTags.includes(tag) ? 'active' : ''}" onclick="toggleTag('${tag}')">${tag}</button>
        `).join('');
    }

    const listContainer = document.getElementById('resort-list');
    if (!listContainer) return;
    
    const filtered = resorts.filter(resort => {
        const matchesTags = activeTags.length === 0 || activeTags.every(t => resort.tags.includes(t));
        const matchesSearch = resort.name.toLowerCase().includes(searchTerm) || 
                              (resort.searchTerms && resort.searchTerms.toLowerCase().includes(searchTerm));
        return matchesTags && matchesSearch;
    });

    if(filtered.length === 0) {
        listContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 100px; color: var(--text-muted);">
                <i data-lucide="search" size="48" style="margin-bottom: 20px; opacity: 0.5"></i>
                <p style="font-size: 1.1rem; letter-spacing: 0.1em; text-transform: uppercase;">Keine Ergebnisse gefunden.</p>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    listContainer.innerHTML = filtered.map(resort => `
        <div class="list-card">
            <div class="card-img-wrapper"><div class="card-img" style="background-image: url('${resort.img}')"></div></div>
            <div class="card-body">
                <h3>${resort.name}</h3>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 20px; display: flex; align-items:center; gap:10px; font-weight: 300; letter-spacing: 0.1em; text-transform: uppercase;">
                    <i data-lucide="layers" size="14"></i> ${resort.pisteKm} KM <span style="opacity: 0.3;">|</span> <i data-lucide="mountain" size="14"></i> ${resort.elevation} M
                </div>
                <div>${resort.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
                <div class="card-actions">
                    <button class="btn-show-map" onclick="jumpToResortFromList(${resort.id})">KARTE <i data-lucide="arrow-right" size="14"></i></button>
                    ${resort.website ? `<a href="${resort.website}" target="_blank" class="btn-website" title="Offizielle Website">INFO <i data-lucide="external-link" size="14"></i></a>` : ''}
                </div>
            </div>
        </div>
    `).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleTag(tag) {
    if (activeTags.includes(tag)) activeTags = activeTags.filter(t => t !== tag);
    else activeTags.push(tag);
    renderFilterView();
}

function clearSearch() { 
    const input = document.getElementById('search-input');
    if(input) { input.value = ''; renderFilterView(); }
}

// === LIGHTBOX LOGIK (Jetzt dynamisch für alle Ansichten) ===
let lbZoom = 1, lbPanX = 0, lbPanY = 0, isLbDragging = false, lbStartX = 0, lbStartY = 0;
function updateLightboxTransform() { 
    const img = document.getElementById('lightbox-img');
    if(img) img.style.transform = `translate(${lbPanX}px, ${lbPanY}px) scale(${lbZoom})`; 
}

function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    const thumb = document.getElementById('sb-piste-map'); // Fallback Sidebar
    
    let imgSrc = (typeof src === 'string') ? src : (thumb ? thumb.dataset.fullSrc : null);
    
    if(imgSrc && lightbox) {
        document.getElementById('lightbox-img').src = imgSrc;
        lightbox.classList.add('active');
        lbZoom = 1; lbPanX = 0; lbPanY = 0; updateLightboxTransform();
    }
}

function closeLightbox(e) {
    if (e && e.target && e.target.id === 'lightbox-img') return; 
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        setTimeout(() => { document.getElementById('lightbox-img').src = ''; }, 300);
    }
}

const lbImg = document.getElementById('lightbox-img');
if(lbImg) {
    lbImg.addEventListener('wheel', (e) => { e.preventDefault(); lbZoom += e.deltaY * -0.002; lbZoom = Math.min(Math.max(0.5, lbZoom), 6); updateLightboxTransform(); }, { passive: false });
    lbImg.addEventListener('mousedown', (e) => { e.preventDefault(); isLbDragging = true; lbStartX = e.clientX - lbPanX; lbStartY = e.clientY - lbPanY; });
    lbImg.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { isLbDragging = true; lbStartX = e.touches[0].clientX - lbPanX; lbStartY = e.touches[0].clientY - lbPanY; } }, { passive: true });
    document.addEventListener('touchmove', (e) => { if(!isLbDragging) return; if (e.touches && e.touches.length === 1) { lbPanX = e.touches[0].clientX - lbStartX; lbPanY = e.touches[0].clientY - lbStartY; updateLightboxTransform(); } }, { passive: true });
    document.addEventListener('touchend', () => { isLbDragging = false; });
    document.addEventListener('mousemove', (e) => { if(!isLbDragging) return; lbPanX = e.clientX - lbStartX; lbPanY = e.clientY - lbStartY; updateLightboxTransform(); });
    document.addEventListener('mouseup', () => { isLbDragging = false; });
    document.addEventListener('keydown', function(event) { if (event.key === "Escape" && document.getElementById('lightbox') && document.getElementById('lightbox').classList.contains('active')) closeLightbox(); });
}

// === DIREKT-VERGLEICH LOGIK (Für vergleich.html) ===
let compareSelection = [null, null, null];
let compareSelectsInitialized = false;

function initCompareView() {
    if (!compareSelectsInitialized) { renderCompareSelects(); compareSelectsInitialized = true; }
    renderCompareTable();
}

function renderCompareSelects() {
    const sortedResorts = [...resorts].sort((a,b) => a.name.localeCompare(b.name));
    const optionsHtml = '<option value="">-- WÄHLEN --</option>' + sortedResorts.map(r => `<option value="${r.id}">${r.name.toUpperCase()}</option>`).join('');
    for(let i=0; i<3; i++) {
        const selectEl = document.getElementById(`compare-select-${i}`);
        if(selectEl) { selectEl.innerHTML = optionsHtml; if(compareSelection[i]) selectEl.value = compareSelection[i].id; }
    }
}

function onCompareChange(index) {
    const val = document.getElementById(`compare-select-${index}`).value;
    compareSelection[index] = val ? resorts.find(r => r.id == val) : null;
    renderCompareTable();
}

function renderCompareTable() {
    const tbody = document.getElementById('compare-table-body');
    if (!tbody) return;
    
    // Die PISTENPLAN Kategorie wurde hier in das Array eingefügt
    const criteria = [
        { key: 'img', label: 'IMPRESSION', type: 'img' }, 
        { key: 'pisteKm', label: 'PISTENNETZ', suffix: ' KM' },
        { key: 'difficulty', label: 'AUFTEILUNG', type: 'difficulty' }, 
        { key: 'lifts', label: 'LIFTANLAGEN', suffix: '' },
        { key: 'elevation', label: 'GIPFELHÖHE', suffix: ' M' }, 
        { key: 'bestTime', label: 'REISEZEIT', type: 'bestTime' },
        { key: 'skipass', label: 'TAGESPASS', suffix: '' }, 
        { key: 'tags', label: 'HIGHLIGHTS', type: 'tags' },
        { key: 'pisteMap', label: 'PISTENPLAN', type: 'pisteMap' },
        { key: 'action', label: '', type: 'action' }
    ];

    let html = '';
    criteria.forEach((crit) => {
        html += `<div class="compare-row"><div class="compare-cell label">${crit.label}</div>`;
        for(let i=0; i<3; i++) {
            const resort = compareSelection[i];
            if(!resort) { 
                html += `<div class="compare-cell empty">AUSSTEHEND</div>`; 
            } else {
                if(crit.type === 'img') { 
                    html += `<div class="compare-cell" style="padding: 10px;"><div class="compare-img" style="background-image: url('${resort.img}');"></div><strong style="font-size: 0.95rem; margin-top: 15px; letter-spacing: 0.1em; text-transform: uppercase;">${resort.name}</strong></div>`; 
                } 
                else if(crit.type === 'tags') { 
                    html += `<div class="compare-cell compare-tags">${resort.tags.map(t => `<span class="tag" style="margin:0;">${t}</span>`).join('')}</div>`; 
                } 
                else if(crit.type === 'action') { 
                    html += `<div class="compare-cell" style="background: transparent; border: none; padding-top: 0;"><button class="btn-show-map" onclick="jumpToResortFromList(${resort.id})" style="width: 100%; margin-top: 0;">KARTE <i data-lucide="arrow-right" size="14"></i></button></div>`; 
                } 
                else if(crit.type === 'bestTime') {
                    let bestTime = "DEZ - APR";
                    if (resort.tags.includes("Gletscher") || resort.tags.includes("Ganzjahresski")) bestTime = "OKT - JUN";
                    else if (resort.elevation >= 2500) bestTime = "NOV - MAI";
                    if (resort.tags.includes("Australien") || resort.tags.includes("Neuseeland")) bestTime = "JUN - OKT";
                    html += `<div class="compare-cell"><strong style="font-size: 0.95rem;">${bestTime}</strong></div>`;
                } 
                else if(crit.type === 'difficulty') {
                    let blue = 35, red = 45, black = 20; 
                    if (resort.tags.includes("Familien")) { blue = 55; red = 35; black = 10; }
                    else if (resort.tags.includes("Off-Piste")) { blue = 20; red = 40; black = 40; }
                    else if (resort.tags.includes("Großes Skigebiet")) { blue = 40; red = 40; black = 20; }
                    html += `<div class="compare-cell" style="padding: 15px 25px;"><div class="diff-bar-container" style="margin-bottom: 12px; height: 3px;"><div class="diff-segment diff-blue" style="width: ${blue}%;"></div><div class="diff-segment diff-red" style="width: ${red}%;"></div><div class="diff-segment diff-black" style="width: ${black}%;"></div></div><div class="diff-legend" style="width: 100%; justify-content: space-between;"><span style="font-size:0.6rem; color:var(--text-muted);"><div class="dot diff-blue"></div>${blue}%</span><span style="font-size:0.6rem; color:var(--text-muted);"><div class="dot diff-red"></div>${red}%</span><span style="font-size:0.6rem; color:var(--text-muted);"><div class="dot diff-black"></div>${black}%</span></div></div>`;
                } 
                // NEU: Pistenplan Logik
                else if(crit.type === 'pisteMap') {
                    if(resort.pisteMap) {
                        html += `<div class="compare-cell" style="padding: 10px;">
                                    <div class="piste-map-thumb" style="background-image: url('${resort.pisteMap}'); margin-top: 0; height: 120px; width: 100%;" onclick="openLightbox('${resort.pisteMap}')"></div>
                                 </div>`;
                    } else {
                        html += `<div class="compare-cell empty" style="font-size: 0.8rem;">KEIN PLAN</div>`;
                    }
                } 
                else {
                    let val = resort[crit.key] || 'k.A.';
                    if (crit.key === 'skipass' && val !== 'k.A.' && !val.includes('€')) {
                        const exchangeRates = { 'CHF': 1.05, '¥': 0.0062, 'CAD': 0.69, 'USD': 0.93, 'AUD': 0.61, 'NZD': 0.55, 'SEK': 0.087, 'NOK': 0.085 };
                        const match = val.match(/(\d+)\s*([A-Za-z¥]+)/);
                        if (match && exchangeRates[match[2]]) {
                            const inEuro = Math.round(parseFloat(match[1]) * exchangeRates[match[2]]);
                            val = `${val} <br><span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">~${inEuro} €</span>`;
                        }
                    }
                    html += `<div class="compare-cell"><strong>${val}</strong><span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.1em;">${crit.suffix}</span></div>`;
                }
            }
        }
        html += `</div>`;
    });
    tbody.innerHTML = html; 
    if (typeof lucide !== 'undefined') lucide.createIcons(); 
}

// === MATCHMAKER LOGIK ===
let matchAnswers = { regions: [], alpenCountries: [], group: '', budget: 3, focus: '' };
function updateProgress(percentage) { 
    const bar = document.getElementById('quiz-progress-bar');
    if (bar) bar.style.width = percentage + '%'; 
}
function toggleRegion(btn, region) { document.querySelectorAll('.toggle-btn-quiz').forEach(b => b.classList.remove('active-toggle')); btn.classList.add('active-toggle'); document.getElementById('region-error').style.display = 'none'; matchAnswers.regions = [region]; }
function submitStep1() {
    if (matchAnswers.regions.length === 0) { document.getElementById('region-error').style.display = 'block'; return; }
    document.getElementById('step-1').classList.remove('active');
    const navBack2 = document.getElementById('nav-back-2');
    if (matchAnswers.regions.includes('alpen')) {
        document.getElementById('step-alpen').classList.add('active'); updateProgress(40);
        navBack2.innerHTML = `<button class="btn-back-quiz" onclick="prevMatchStep('step-2', 'step-alpen', 40)"><i data-lucide="arrow-left" size="14"></i> ZURÜCK</button>`;
    } else {
        document.getElementById('step-2').classList.add('active'); updateProgress(50);
        navBack2.innerHTML = `<button class="btn-back-quiz" onclick="prevMatchStep('step-2', 'step-1', 20)"><i data-lucide="arrow-left" size="14"></i> ZURÜCK</button>`;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
function toggleAlpenCountry(btn, country) { btn.classList.toggle('active-toggle'); document.getElementById('alpen-error').style.display = 'none'; if (matchAnswers.alpenCountries.includes(country)) matchAnswers.alpenCountries = matchAnswers.alpenCountries.filter(c => c !== country); else matchAnswers.alpenCountries.push(country); }
function submitStepAlpen() { if (matchAnswers.alpenCountries.length === 0) { document.getElementById('alpen-error').style.display = 'block'; return; } document.getElementById('step-alpen').classList.remove('active'); document.getElementById('step-2').classList.add('active'); updateProgress(50); }
function answerMatch(step, answer) {
    if (step === 2) { matchAnswers.group = answer; updateProgress(75); } if (step === 3) { matchAnswers.budget = answer; updateProgress(95); }
    if (step === 4) { matchAnswers.focus = answer; updateProgress(100); setTimeout(() => calculateMatch(), 400); return; }
    document.getElementById(`step-${step}`).classList.remove('active'); document.getElementById(`step-${step + 1}`).classList.add('active');
}
function prevMatchStep(currentId, prevId, progressVal) { document.getElementById(currentId).classList.remove('active'); document.getElementById(prevId).classList.add('active'); updateProgress(progressVal); }
function resetMatchmaker() {
    matchAnswers = { regions: [], alpenCountries: [], group: '', budget: 3, focus: '' };
    document.getElementById('match-results').classList.remove('active'); document.getElementById('matchmaker-intro').style.display = 'block'; document.getElementById('matchmaker-restart').style.display = 'none';
    document.querySelectorAll('.toggle-btn-quiz, .toggle-btn-alpen').forEach(b => b.classList.remove('active-toggle')); document.getElementById('region-error').style.display = 'none'; document.getElementById('alpen-error').style.display = 'none';
    document.querySelectorAll('.quiz-step').forEach(s => s.classList.remove('active')); document.getElementById('step-1').classList.add('active'); document.querySelector('.matchmaker-header').style.display = 'block'; document.getElementById('quiz-container').style.display = 'block'; updateProgress(20);
}
function calculateMatch() {
    const regionMap = { 'skandinavien': ["Skandinavien", "Schweden", "Norwegen", "Finnland"], 'nordamerika': ["USA", "Kanada"], 'asien': ["Japan"], 'ozeanien': ["Australien", "Neuseeland"] };
    let allowedTags = [];
    matchAnswers.regions.forEach(reg => { if (reg === 'alpen') allowedTags.push(...matchAnswers.alpenCountries); else if (regionMap[reg]) allowedTags.push(...regionMap[reg]); });
    let scoredResorts = resorts.map(resort => {
        let score = 0;
        if (!resort.tags.some(t => allowedTags.includes(t))) return { ...resort, matchScore: -999 }; 
        if (resort.priceLevel > matchAnswers.budget) score -= (resort.priceLevel - matchAnswers.budget) * 5; else if (resort.priceLevel < matchAnswers.budget) score += 2; 
        if (matchAnswers.group === 'familie' && resort.tags.includes('Familien')) score += 10;
        if (matchAnswers.group === 'freunde' && resort.tags.includes('Après-Ski')) score += 10;
        if (matchAnswers.group === 'sportlich' && (resort.tags.includes('Off-Piste') || resort.tags.includes('Weltcup'))) score += 10;
        if (matchAnswers.focus === 'schnee' && (resort.tags.includes('Schneesicher') || resort.tags.includes('Gletscher') || resort.elevation > 2500)) score += 12;
        if (matchAnswers.focus === 'riesig' && resort.tags.includes('Großes Skigebiet') && resort.pisteKm > 150) score += 12;
        if (matchAnswers.focus === 'klein') { if (resort.pisteKm <= 90) score += 12; if (resort.tags.includes('Familien')) score += 5; if (resort.tags.includes('Off-Piste') || resort.tags.includes('Weltcup')) score -= 5; }
	if (matchAnswers.focus === 'freestyle' && resort.tags.includes('Snowpark')) score += 15;
                return { ...resort, matchScore: score };
    });
    scoredResorts.sort((a, b) => b.matchScore - a.matchScore);
    const resultLimit = matchAnswers.regions.includes('alpen') ? 5 : 3;
    const topResults = scoredResorts.filter(r => r.matchScore > -500).slice(0, resultLimit); 

    document.getElementById('matchmaker-intro').style.display = 'none';
    const resultsContainer = document.getElementById('match-results'); resultsContainer.innerHTML = '';
    if (topResults.length === 0) {
        resultsContainer.innerHTML = `<div style="text-align:center; padding: 80px; background:var(--surface); border:1px solid var(--border);"><h3><i data-lucide="x-circle" size="40" style="color: var(--text-muted); margin-bottom: 20px; stroke-width: 1;"></i><br>KEINE EXAKTE ÜBEREINSTIMMUNG</h3><p style="color: var(--text-muted); font-weight: 300;">Bitte erweitern Sie Ihre Länderauswahl, um entsprechende Ergebnisse zu erhalten.</p></div>`;
    } else {
        topResults.forEach((resort, index) => {
            let badgeText = "WEITERE EMPFEHLUNG"; if (index === 0) badgeText = "PREMIUM MATCH"; else if (index === 1) badgeText = "HERVORRAGENDE ALTERNATIVE"; else if (index === 2) badgeText = "GEHEIMTIPP";
            const cardClass = index === 0 ? "match-result-card first-place" : "match-result-card second";
            resultsContainer.innerHTML += `
                <div class="${cardClass}">
                    <div class="match-badge">${badgeText}</div><div class="card-img-wrapper"><div class="card-img" style="background-image: url('${resort.img}'); height: 250px;"></div></div>
                    <div class="card-body">
                        <h3 style="margin-top: 10px; font-weight: 400; font-size: 1.3rem;">${resort.name}</h3><p style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 25px; line-height: 1.8;">${resort.highlights}</p>
                        <div style="display:flex; gap: 15px; margin-bottom: 25px;"><span style="font-size:0.75rem; border:1px solid var(--border); padding:6px 12px; letter-spacing:0.1em;"><i data-lucide="layers" size="12"></i> ${resort.pisteKm} KM</span><span style="font-size:0.75rem; border:1px solid var(--border); padding:6px 12px; letter-spacing:0.1em;"><i data-lucide="mountain" size="12"></i> ${resort.elevation} M</span></div>
                        <button class="btn-show-map" onclick="jumpToResortFromList(${resort.id})" style="width: 100%;">KARTE <i data-lucide="arrow-right" size="14"></i></button>
                    </div>
                </div>`;
        });
    }
    resultsContainer.classList.add('active'); document.getElementById('matchmaker-intro').style.display = 'block'; document.getElementById('quiz-container').style.display = 'none'; document.querySelector('.matchmaker-header').style.display = 'none'; document.getElementById('matchmaker-restart').style.display = 'block'; 
    if (typeof lucide !== 'undefined') lucide.createIcons();
}