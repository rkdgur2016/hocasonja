// --- 전역 변수 및 상수 ---
const TODO_STORAGE_KEY = 'customNewTabTodos';
const GOAL_STORAGE_KEY = 'customNewTabGoal';
const ACCESSIBLE_URLS_KEY = 'customNewTabAccessibleUrls';
const NOTES_STORAGE_KEY = 'customNewTabNotes';
const LAST_RESET_DATE_KEY = 'todoLastResetDate';
const FOCUS_MODE_KEY = 'isFocusModeOn';
const FOCUS_START_TIME_KEY = 'focusStartTime';
const FOCUS_END_TIME_KEY = 'focusEndTime';
const FOCUS_SCHEDULE_TOGGLE_KEY = 'isFocusScheduleOn';
const SEARCH_ENGINE_KEY = 'preferredSearchEngine';
const WEATHER_LOCATION_KEY = 'customWeatherLocation';
const RECENT_SEARCHES_KEY = 'recentSearches';
const MAX_URLS = 10; 
const MAX_TODOS = 10; 
const MAX_RECENT_SEARCHES = 5; 

let lastKnownTimeStr = ''; 
let currentTranslations = {};

// --- Helper Functions ---
async function loadTranslations(lang) {
    try {
        const response = await fetch(`../_locales/${lang}/messages.json`);
        currentTranslations = await response.json();
    } catch (e) {
        console.error("번역 파일을 로드하는 데 실패했습니다:", e);
    }
}

function t(key, fallback = '') {
    return (currentTranslations[key] && currentTranslations[key].message) || fallback;
}

async function applyTranslations() {
    const lang = localStorage.getItem('preferredLanguage') || 'ko';
    await loadTranslations(lang);
    
    // Handle textContent
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const messageKey = element.getAttribute('data-i18n');
        if (currentTranslations[messageKey] && currentTranslations[messageKey].message) {
            element.textContent = currentTranslations[messageKey].message;
        }
    });

    // Handle placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const messageKey = element.getAttribute('data-i18n-placeholder');
        if (currentTranslations[messageKey] && currentTranslations[messageKey].message) {
            element.placeholder = currentTranslations[messageKey].message;
        }
    });

    // Handle titles
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const messageKey = element.getAttribute('data-i18n-title');
        if (currentTranslations[messageKey] && currentTranslations[messageKey].message) {
            element.title = currentTranslations[messageKey].message;
        }
    });
    
    // 언어 변경 시에 목표 문구, 실시간 정보 및 바로가기 목록 동적 업데이트
    await loadGoal();
    loadNotes();
    refreshAllInfo();
    renderUserShortcuts();
}


function debounce(func, delay) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

function processUrl(urlString) {
    try {
        if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
            urlString = 'https://' + urlString;
        }
        const url = new URL(urlString);
        let base = `${url.protocol}//${url.host}`;
        if (!base.endsWith('/')) base += '/';
        return base; 
    } catch (e) {
        let simpleBase = urlString.split(/[?#]/)[0];
        if (!simpleBase.endsWith('/')) simpleBase += '/';
        return simpleBase;
    }
}

// --- ?쒓컙 諛??좎쭨 湲곕뒫 ---
function updateTime() {
    const now = new Date();
    
    // Format Date using system locale
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const dateText = new Intl.DateTimeFormat('ko-KR', dateOptions).format(now);
    
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.textContent = dateText;
    
    // Format Time using system locale
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const timeText = new Intl.DateTimeFormat('ko-KR', timeOptions).format(now);
    
    const timeEl = document.getElementById('time');
    if (timeEl) timeEl.textContent = timeText;
    
    // Update schedule checker
    const timeParts = timeText.split(':');
    lastKnownTimeStr = `${timeParts[0]}:${timeParts[1]}`;
    
    checkFocusModeSchedule(lastKnownTimeStr); 

    // [異붽?] 珥덇린??吏꾪뻾瑜??낅뜲?댄듃
    updateTodoResetProgress();
}

// [?섏젙] 珥덇린??吏꾪뻾瑜?怨꾩궛 諛??낅뜲?댄듃 (100% -> 0%)
function updateTodoResetProgress() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const elapsedMs = now - startOfDay;
    const totalDayMs = 24 * 60 * 60 * 1000;
    
    // ?⑥? 鍮꾩쑉 怨꾩궛: 100% - (寃쎄낵 鍮꾩쑉)
    const remainingPercentage = 100 - (elapsedMs / totalDayMs) * 100;
    
    const progressBar = document.getElementById('todo-reset-progress');
    if (progressBar) {
        progressBar.style.width = `${remainingPercentage}%`;
    }
}

function parseTime(timeStr) {
    if (!timeStr) return -1;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function isTimeBetween(startStr, endStr, currentStr) {
    const start = parseTime(startStr);
    const end = parseTime(endStr);
    const current = parseTime(currentStr);
    if (start === -1 || end === -1 || start === end) return false; 
    return start < end ? (current >= start && current < end) : (current >= start || current < end);
}

function checkFocusModeSchedule(currentTimeStr) {
    const isScheduleEnabled = localStorage.getItem(FOCUS_SCHEDULE_TOGGLE_KEY) === 'on'; 
    if (!isScheduleEnabled || !currentTimeStr) return;

    chrome.storage.local.get([FOCUS_MODE_KEY], function(data) {
        const isFocusModeOn = data[FOCUS_MODE_KEY] === 'on';
        const start = localStorage.getItem(FOCUS_START_TIME_KEY);
        const end = localStorage.getItem(FOCUS_END_TIME_KEY);
        
        if (start && end) {
            const isActiveTime = isTimeBetween(start, end, currentTimeStr);
            if (isActiveTime && !isFocusModeOn) setFocusModeState(true, false);
            else if (!isActiveTime && isFocusModeOn) setFocusModeState(false, false);
        }
    });
}

function setFocusModeState(state, updateManualToggle) {
    const body = document.body;
    const manualToggle = document.getElementById('focus-mode-toggle');
    
    chrome.storage.local.set({ [FOCUS_MODE_KEY]: state ? 'on' : 'off' });
    
    if (state) {
        body.classList.add('focus-mode-active');
    } else {
        body.classList.remove('focus-mode-active');
    }
    
    if (manualToggle && updateManualToggle) {
        manualToggle.checked = state;
    }
}

function updateTimeControlsState() {
    const scheduleToggle = document.getElementById('focus-schedule-toggle');
    const startTime = document.getElementById('focus-start-time');
    const endTime = document.getElementById('focus-end-time');
    const timeControls = document.getElementById('focus-time-controls');
    
    if (!scheduleToggle || !startTime || !endTime || !timeControls) return;
    
    if (scheduleToggle.checked) {
        startTime.disabled = false;
        endTime.disabled = false;
        timeControls.classList.remove('disabled-controls');
    } else {
        startTime.disabled = true;
        endTime.disabled = true;
        timeControls.classList.add('disabled-controls');
    }
}

// --- 실시간 정보 기능 ---

async function fetchExchangeRate() {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        const rate = Math.round(data.rates.KRW);
        const exchangeRateEl = document.getElementById('exchange-rate');
        if (exchangeRateEl) {
            exchangeRateEl.innerHTML = `
                <div class="info-label">${t('realtime_exchange_rate', '실시간 환율 (USD/KRW)')}</div>
                <div class="info-value"><i class="fas fa-arrow-trend-up" style="color: #10b981; margin-right: 4px;"></i> <span>${rate.toLocaleString()}${t('won_suffix', '원')}</span></div>
            `;
        }
    } catch (error) {
        console.error('환율 오류:', error);
        const exchangeRateEl = document.getElementById('exchange-rate');
        if (exchangeRateEl) {
            exchangeRateEl.innerHTML = `
                <div class="info-label">${t('exchange_rate', '환율 (USD/KRW)')}</div>
                <div class="info-value"><i class="fas fa-minus trend-neutral"></i> <span>1,410${t('won_suffix', '원')}</span></div>
            `;
        }
    }
}

async function fetchWeather() {
    try {
        const lang = localStorage.getItem('preferredLanguage') || 'ko';
        let lat = '37.5665';
        let lon = '126.9780'; // Default Seoul
        
        if (lang === 'ja') {
            lat = '35.6762';
            lon = '139.6503'; // Tokyo
        } else if (lang === 'en') {
            lat = '38.9072';
            lon = '-77.0369'; // Washington D.C.
        }
        
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=precipitation_probability&daily=temperature_2m_max,temperature_2m_min&forecast_days=1`);
        const data = await response.json();
        
        if (data.timezone) {
            localStorage.setItem('userTimezone', data.timezone);
        }
        
        const temp = data.current.temperature_2m;
        const maxTemp = data.daily.temperature_2m_max[0];
        const minTemp = data.daily.temperature_2m_min[0];
        const now = new Date();
        const rainProb = data.hourly.precipitation_probability[now.getHours()];
        
        const weatherEl = document.getElementById('weather-info');
        if (weatherEl) {
            let icon = '<i class="fas fa-cloud-sun"></i>';
            const code = data.current.weather_code;
            if (code === 0) icon = '<i class="fas fa-sun" style="color: #f59e0b;"></i>';
            else if (code >= 1 && code <= 3) icon = '<i class="fas fa-cloud-sun" style="color: #60a5fa;"></i>';
            else if (code >= 45) icon = '<i class="fas fa-smog" style="color: #94a3b8;"></i>';
            else if (code >= 51) icon = '<i class="fas fa-cloud-showers-heavy" style="color: #3b82f6;"></i>';

            weatherEl.innerHTML = `
                <div class="weather-slide active">
                    <div class="info-label">${t('temp_min_max', '기온(최저/최고)')}</div>
                    <div class="info-value">${icon} <span>${minTemp}° / ${maxTemp}°</span></div>
                </div>
                <div class="weather-slide">
                    <div class="info-label">${t('temp_current', '현재 기온')}</div>
                    <div class="info-value">${icon} <span>${temp}°C</span></div>
                </div>
                <div class="weather-slide">
                    <div class="info-label">${t('precipitation_probability', '강수 확률')}</div>
                    <div class="info-value"><i class="fas fa-umbrella" style="color: #3b82f6;"></i> <span>${rainProb}%</span></div>
                </div>
            `;
            startWeatherSlider();
        }
    } catch (error) { console.error('날씨 fetch 오류:', error); }
}

function startWeatherSlider() {
    const slides = document.querySelectorAll('.weather-slide');
    if (slides.length === 0) return;
    let currentSlide = 0;

    if (window.weatherInterval) clearInterval(window.weatherInterval);
    
    window.weatherInterval = setInterval(() => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }, 4000);
}

async function fetchOilPrices() {
    try {
        const gasPrice = 2019;
        const dieselPrice = 2008;
        const oilEl = document.getElementById('oil-prices');
        if (oilEl) {
            oilEl.innerHTML = `
                <div class="info-label">${t('oil_price_title', '국내 유가 (휘/경)')}</div>
                <div class="info-value"><i class="fas fa-gas-pump" style="color: #10b981;"></i> <span>${gasPrice} / ${dieselPrice}</span></div>
            `;
        }
    } catch (error) { console.error('유가 오류:', error); }
}

function refreshAllInfo() {
    fetchExchangeRate(); fetchWeather(); fetchOilPrices();
}

// --- 理쒓렐 寃??湲곕줉 ---
function saveRecentSearch(query) {
    let recent = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    recent = recent.filter(q => q !== query);
    recent.unshift(query);
    if (recent.length > MAX_RECENT_SEARCHES) recent.pop();
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
    renderRecentSearches();
}

function renderRecentSearches() {
    const container = document.getElementById('recent-searches-container');
    if (!container) return;
    const recent = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    container.innerHTML = '';
    recent.forEach(q => {
        const item = document.createElement('span');
        item.classList.add('recent-search-item');
        item.textContent = q;
        item.onclick = () => {
            const searchInput = document.getElementById('search-input');
            const searchForm = document.getElementById('search-form');
            if (searchInput && searchForm) {
                searchInput.value = q;
                searchForm.dispatchEvent(new Event('submit'));
            }
        };
        container.appendChild(item);
    });
}

// --- 寃??湲곕뒫 ---

function updateSearchEngineUI(engine) {
    const googleBtn = document.getElementById('google-engine-btn');
    const naverBtn = document.getElementById('naver-engine-btn');
    const yahooBtn = document.getElementById('yahoo-engine-btn');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    if (!googleBtn || !naverBtn || !yahooBtn || !searchForm || !searchInput) return;

    if (engine === 'naver') {
        naverBtn.classList.add('active'); googleBtn.classList.remove('active'); yahooBtn.classList.remove('active');
        searchForm.action = 'https://search.naver.com/search.naver';
        searchInput.name = 'query'; searchInput.placeholder = '?ㅼ씠踰?寃???먮뒗 URL ?낅젰';
    } else if (engine === 'yahoo') {
        yahooBtn.classList.add('active'); googleBtn.classList.remove('active'); naverBtn.classList.remove('active');
        searchForm.action = 'https://search.yahoo.com/search';
        searchInput.name = 'p'; searchInput.placeholder = 'Yahoo 寃???먮뒗 URL ?낅젰';
    } else {
        googleBtn.classList.add('active'); naverBtn.classList.remove('active'); yahooBtn.classList.remove('active');
        searchForm.action = 'https://www.google.com/search';
        searchInput.name = 'q'; searchInput.placeholder = '援ш? 寃???먮뒗 URL ?낅젰';
    }
}

function setupSearch() {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const autocompleteResults = document.getElementById('autocomplete-results');
    const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search?client=chrome&q=';
    let currentFocus = -1; 

    searchInput.addEventListener('input', debounce(async function() {
        const query = searchInput.value.trim();
        if (query.length < 1) { hideAutocomplete(); return; }
        try {
            const response = await fetch(SUGGEST_URL + encodeURIComponent(query));
            const text = await response.text();
            const jsonText = text.substring(text.indexOf('[') - 1, text.lastIndexOf(']') + 1).trim();
            const data = JSON.parse(jsonText);
            displayAutocomplete(data[1].slice(0, 8));
        } catch (e) { hideAutocomplete(); }
    }, 200));

    function displayAutocomplete(suggestions) {
        autocompleteResults.innerHTML = ''; currentFocus = -1;
        if (suggestions.length === 0) { hideAutocomplete(); return; }
        const shortcutsList = document.getElementById('user-shortcuts-list');
        if (shortcutsList) shortcutsList.style.display = 'none';
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.classList.add('autocomplete-item');
            item.textContent = suggestion;
            item.addEventListener('click', () => {
                searchInput.value = suggestion;
                searchForm.dispatchEvent(new Event('submit'));
                hideAutocomplete();
            });
            autocompleteResults.appendChild(item);
        });
        autocompleteResults.style.display = 'block';
    }

    function hideAutocomplete() {
        autocompleteResults.style.display = 'none';
        const shortcutsList = document.getElementById('user-shortcuts-list');
        if (shortcutsList) shortcutsList.style.display = 'flex';
    }

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideAutocomplete();
            return;
        }
        let items = autocompleteResults.querySelectorAll('.autocomplete-item');
        if (items.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); currentFocus = (currentFocus + 1) % items.length; setActive(items); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); currentFocus = (currentFocus - 1 + items.length) % items.length; setActive(items); }
        else if (e.key === 'Enter') { 
            if (currentFocus > -1) { e.preventDefault(); items[currentFocus].click(); }
        }
    });

    searchInput.addEventListener('focus', () => {
        const query = searchInput.value.trim();
        if (query.length >= 1 && autocompleteResults.children.length > 0) {
            autocompleteResults.style.display = 'block';
            const shortcutsList = document.getElementById('user-shortcuts-list');
            if (shortcutsList) shortcutsList.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
            hideAutocomplete();
        }
    });

    function setActive(items) {
        items.forEach(item => item.classList.remove('active'));
        if (currentFocus > -1) {
            items[currentFocus].classList.add('active');
            searchInput.value = items[currentFocus].textContent;
        }
    }

    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;
        saveRecentSearch(query);
        const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
        if (urlRegex.test(query)) {
            window.location.href = query.startsWith('http') ? query : 'https://' + query;
        } else { this.submit(); }
    });
}

// --- ?ъ슜???뺤쓽 諛붾줈媛湲??곗씠??紐⑤뜽 & 留덉씠洹몃젅?댁뀡 ---
let activeFolderId = null; // ?꾩옱 ?쒖꽦?붾맂 ?대뜑 ?쒕∼?ㅼ슫 ID
let draggedElementId = null;
let draggedElementFolderId = null;

function getShortcuts() {
    let raw = localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]';
    let data = [];
    try {
        data = JSON.parse(raw);
    } catch(e) {
        data = [];
    }

    // [留덉씠洹몃젅?댁뀡] ?댁쟾 ?⑥닚 URL 臾몄옄??諛곗뿴??援ъ“?붾맂 ?⑥텞??媛앹껜 諛곗뿴濡??먮룞 留덉씠洹몃젅?댁뀡
    if (data.length > 0 && typeof data[0] === 'string') {
        data = data.map((url, index) => {
            let name = '';
            try {
                const u = new URL(url);
                name = u.hostname.replace('www.', '').split('.')[0];
                name = name.charAt(0).toUpperCase() + name.slice(1);
            } catch(e) {
                name = 'Link';
            }
            return {
                id: 'link_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 4),
                type: 'link',
                name: name,
                url: url
            };
        });
        localStorage.setItem(ACCESSIBLE_URLS_KEY, JSON.stringify(data));
    }
    // ?좏슚???⑥텞???대뜑 ?곗씠?곕쭔 ?꾪꽣留곹븯??諛섑솚 (null, undefined, 源⑥쭊 ?곗씠??諛⑹?)
    data = data.filter(item => item && item.id && (item.type === 'link' || item.type === 'folder'));
    return data;
}

function saveShortcuts(shortcuts) {
    localStorage.setItem(ACCESSIBLE_URLS_KEY, JSON.stringify(shortcuts));
    
    // chrome.storage.local ?먮뒗 ?됲깂?붾맂 (紐⑤뱺 ?대뜑 ?댁쇅) ?덉슜 URL 由ъ뒪?몃쭔 ?숆린?뷀븯??諛깃렇?쇱슫???ㅽ겕由쏀듃 湲곕뒫 ?좎?
    const flatUrls = [];
    shortcuts.forEach(item => {
        if (item.type === 'link') {
            flatUrls.push(item.url);
        } else if (item.type === 'folder' && item.children) {
            item.children.forEach(child => {
                flatUrls.push(child.url);
            });
        }
    });
    chrome.storage.local.set({ [ACCESSIBLE_URLS_KEY]: flatUrls });
    
    renderUserShortcuts();
}

function addFolder(folderName) {
    let shortcuts = getShortcuts();
    if (shortcuts.length < MAX_URLS) {
        shortcuts.push({
            id: 'folder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            type: 'folder',
            name: folderName,
            children: []
        });
        saveShortcuts(shortcuts);
        return true;
    } else {
        const errorMsg = (currentTranslations['max_shortcuts_exceeded'] && currentTranslations['max_shortcuts_exceeded'].message) || '바로가기 개수가 초과되었습니다 (최대 10개)';
        alert(errorMsg);
        return false;
    }
}

function addAccessibleUrlFromModal(url, customName) {
    let shortcuts = getShortcuts();
    const processed = processUrl(url);
    
    let exists = false;
    shortcuts.forEach(item => {
        if (item.type === 'link' && item.url === processed) exists = true;
        else if (item.type === 'folder' && item.children) {
            if (item.children.some(c => c.url === processed)) exists = true;
        }
    });

    if (exists) {
        const dupMsg = (currentTranslations['already_registered_shortcut'] && currentTranslations['already_registered_shortcut'].message) || '이미 등록된 바로가기입니다.';
        alert(dupMsg);
        return false;
    }

    if (shortcuts.length >= MAX_URLS) {
        const errorMsg = (currentTranslations['max_shortcuts_exceeded'] && currentTranslations['max_shortcuts_exceeded'].message) || '바로가기 개수가 초과되었습니다 (최대 10개)';
        alert(errorMsg);
        return false;
    }

    let name = customName.trim();
    if (!name) {
        try {
            const u = new URL(processed);
            name = u.hostname.replace('www.', '').split('.')[0];
            name = name.charAt(0).toUpperCase() + name.slice(1);
        } catch(e) {
            name = 'Link';
        }
    }

    shortcuts.push({
        id: 'link_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'link',
        name: name,
        url: processed
    }); 
    saveShortcuts(shortcuts);
    return true;
}

function openAddShortcutModal() {
    const modal = document.getElementById('add-shortcut-modal');
    if (modal) {
        modal.style.display = 'flex';
        switchModalTab('link');
    }
}

function closeAddShortcutModal() {
    const modal = document.getElementById('add-shortcut-modal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('modal-link-name').value = '';
        document.getElementById('modal-link-url').value = '';
        document.getElementById('modal-folder-name').value = '';
    }
}

function switchModalTab(tabType) {
    const tabLink = document.getElementById('tab-add-link');
    const tabFolder = document.getElementById('tab-add-folder');
    const formLink = document.getElementById('modal-link-form');
    const formFolder = document.getElementById('modal-folder-form');

    if (tabType === 'link') {
        tabLink.classList.add('active');
        tabFolder.classList.remove('active');
        formLink.style.display = 'flex';
        formFolder.style.display = 'none';
    } else {
        tabLink.classList.remove('active');
        tabFolder.classList.add('active');
        formLink.style.display = 'none';
        formFolder.style.display = 'flex';
    }
}

// --- ?ъ슜???뺤쓽 諛붾줈媛湲??뚮뜑留?---
function renderUserShortcuts() {
    const shortcuts = getShortcuts();
    const userShortcutsList = document.getElementById('user-shortcuts-list');
    if (!userShortcutsList) return;
    userShortcutsList.innerHTML = ''; 

    shortcuts.forEach((item) => {
        if (!item || !item.type) return; // ?좏슚?섏? ?딆? ?곗씠???덉쇅 諛⑹뼱
        
        const wrapper = document.createElement('div');
        wrapper.className = 'shortcut-item-wrapper';
        wrapper.dataset.id = item.id;
        wrapper.draggable = true;

        if (item.type === 'link') {
            const a = document.createElement('a');
            a.href = "#"; 
            a.className = 'shortcut-icon user-shortcut-icon';
            a.title = item.name;
            try {
                a.style.backgroundImage = `url("https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(item.url)}")`;
            } catch (e) {
                a.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'; a.innerHTML = '?뵕';
            }
            a.onclick = (e) => { e.preventDefault(); window.location.href = item.url; };
            wrapper.appendChild(a);
            
            const label = document.createElement('span');
            label.className = 'shortcut-label';
            label.textContent = item.name;
            wrapper.appendChild(label);
            
        } else if (item.type === 'folder') {
            const folderDiv = document.createElement('div');
            folderDiv.className = 'shortcut-icon folder-icon';
            folderDiv.title = item.name;
            folderDiv.innerHTML = '<i class="fa-solid fa-folder"></i>';
            wrapper.appendChild(folderDiv);
            
            const label = document.createElement('span');
            label.className = 'shortcut-label';
            label.textContent = item.name;
            wrapper.appendChild(label);

            const badge = document.createElement('span');
            badge.className = 'folder-badge';
            badge.textContent = item.children ? item.children.length : 0;
            folderDiv.appendChild(badge);

            // ?대뜑 ?대? ?쒕∼?ㅼ슫 ?앹뾽 ?앹꽦
            const dropdown = document.createElement('div');
            dropdown.className = 'folder-dropdown';
            if (activeFolderId === item.id) {
                dropdown.classList.add('open');
            }

            const header = document.createElement('div');
            header.className = 'folder-dropdown-header';
            header.textContent = item.name;
            dropdown.appendChild(header);

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'folder-dropdown-items';

            if (item.children && item.children.length > 0) {
                item.children.forEach(child => {
                    const childWrapper = document.createElement('div');
                    childWrapper.className = 'folder-child-wrapper';
                    childWrapper.dataset.id = child.id;
                    childWrapper.dataset.folderId = item.id;
                    childWrapper.draggable = true;

                    const childA = document.createElement('a');
                    childA.href = "#"; 
                    childA.className = 'shortcut-icon user-shortcut-icon';
                    childA.title = child.name;
                    try {
                        childA.style.backgroundImage = `url("https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(child.url)}")`;
                    } catch (e) {
                        childA.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'; childA.innerHTML = '?뵕';
                    }
                    childA.onclick = (e) => { e.preventDefault(); window.location.href = child.url; };
                    childWrapper.appendChild(childA);

                    const childLabel = document.createElement('span');
                    childLabel.className = 'shortcut-label';
                    childLabel.textContent = child.name;
                    childWrapper.appendChild(childLabel);

                    itemsContainer.appendChild(childWrapper);
                    setupDragAndDropEvents(childWrapper); // ?대뜑 ?대? ?꾩씠???뺣젹 吏??
                });
            } else {
                const empty = document.createElement('div');
                empty.className = 'folder-empty-text';
                const emptyText = (currentTranslations['drag_here_to_folder'] && currentTranslations['drag_here_to_folder'].message) || '여기로 아이콘을<br>드래그하세요';
                empty.innerHTML = emptyText;
                itemsContainer.appendChild(empty);
            }
            dropdown.appendChild(itemsContainer);
            wrapper.appendChild(dropdown);

            folderDiv.onclick = (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.contains('open');
                document.querySelectorAll('.folder-dropdown').forEach(d => d.classList.remove('open'));
                if (!isOpen) {
                    dropdown.classList.add('open');
                    activeFolderId = item.id;
                } else {
                    activeFolderId = null;
                }
            };
        }

        userShortcutsList.appendChild(wrapper);
        setupDragAndDropEvents(wrapper);
    });

    // 異붽?/??젣 ?꾪솚 ?몃━嫄??앹꽦 (??긽 ?뚮뜑留곹븯??媛쒖닔 ?쒗븳???곕씪 媛?쒖꽦 議곗젅)
    const addTooltip = (currentTranslations['add_shortcut_or_folder'] && currentTranslations['add_shortcut_or_folder'].message) || '바로가기 / 폴더 추가';
    const addLabelText = (currentTranslations['add'] && currentTranslations['add'].message) || '추가';
    
    const trigger = document.createElement('div');
    trigger.id = 'add-delete-trigger';
    trigger.className = 'add-shortcut-trigger';
    trigger.innerHTML = `
        <div class="shortcut-icon" title="${addTooltip}"><i class="fa-solid fa-plus"></i></div>
        <span class="shortcut-label">${addLabelText}</span>
    `;
    
    if (shortcuts.length >= MAX_URLS) {
        trigger.style.display = 'none';
    }
    
    trigger.onclick = () => {
        if (trigger.classList.contains('trash-mode')) return;
        openAddShortcutModal();
    };

    trigger.addEventListener('dragover', (e) => {
        if (trigger.classList.contains('trash-mode')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            trigger.classList.add('drag-hover');
        }
    });

    trigger.addEventListener('dragleave', () => {
        trigger.classList.remove('drag-hover');
    });

    trigger.addEventListener('drop', (e) => {
        e.preventDefault();
        trigger.classList.remove('drag-hover');

        if (trigger.classList.contains('trash-mode') && draggedElementId) {
            let shortcuts = getShortcuts();
            let srcIdx = shortcuts.findIndex(item => item.id === draggedElementId);
            if (srcIdx !== -1) {
                shortcuts.splice(srcIdx, 1);
            } else {
                shortcuts.forEach(item => {
                    if (item.type === 'folder' && item.children) {
                        item.children = item.children.filter(c => c.id !== draggedElementId);
                    }
                });
            }
            saveShortcuts(shortcuts);
        }
    });
    
    userShortcutsList.appendChild(trigger);
}

// --- ?쒕옒洹????쒕∼ ?뺣젹 & ?대뜑 ?⑹껜 ?대깽???몃뱾??---
function setupDragAndDropEvents(el) {
    el.addEventListener('dragstart', (e) => {
        // ?대뜑 ?앹뾽 ?대??먯꽌 ?쒕옒洹멸? ?쒖옉??寃쎌슦, 遺紐??대뜑 ?먯껜媛 ?쒕옒洹몃릺??踰꾧렇 諛⑹?
        if (el.classList.contains('shortcut-item-wrapper') && e.target.closest('.folder-dropdown')) {
            e.preventDefault();
            return;
        }
        // ?대깽??踰꾨툝留곸쓣 李⑤떒?섏뿬 ?먯떇 ?쒕옒洹???遺紐⑤룄 媛숈씠 ?뚮젮?ㅻ뒗 ?꾩긽 諛⑹?
        e.stopPropagation();

        draggedElementId = el.dataset.id;
        draggedElementFolderId = el.dataset.folderId || null;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedElementId);

        // 異붽? 踰꾪듉???곕젅湲고넻 紐⑤뱶濡??꾪솚
        const trigger = document.getElementById('add-delete-trigger');
        if (trigger) {
            trigger.style.display = 'flex'; // 苑?李⑥꽌 ?④꺼吏?寃쎌슦???몄텧
            trigger.classList.add('trash-mode');
            
            const delTooltip = (currentTranslations['drag_here_to_delete'] && currentTranslations['drag_here_to_delete'].message) || '여기로 드래그하여 삭제';
            const delLabel = (currentTranslations['delete'] && currentTranslations['delete'].message) || '삭제';
            
            const iconDiv = trigger.querySelector('.shortcut-icon');
            const labelSpan = trigger.querySelector('.shortcut-label');
            if (iconDiv) {
                iconDiv.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                iconDiv.title = delTooltip;
            }
            if (labelSpan) {
                labelSpan.textContent = delLabel;
            }
        }
    });

    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (el.dataset.id === draggedElementId) return;

        const fIcon = el.querySelector('.folder-icon');
        if (fIcon) {
            // ?대뜑 ?꾩뿉 ?ㅻ쾭 以묒씤 寃쎌슦 ?섏씠?쇱씠??
            fIcon.classList.add('drag-over-folder');
        } else {
            // ?쇰컲 留곹겕 ??ぉ ?꾩뿉 ?ㅻ쾭 以묒씤 寃쎌슦
            const rect = el.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            if (e.clientX < midpoint) {
                el.classList.add('drag-left');
                el.classList.remove('drag-right');
            } else {
                el.classList.add('drag-right');
                el.classList.remove('drag-left');
            }
        }
    });

    el.addEventListener('dragleave', () => {
        el.classList.remove('drag-left', 'drag-right');
        const fIcon = el.querySelector('.folder-icon');
        if (fIcon) fIcon.classList.remove('drag-over-folder');
    });

    el.addEventListener('drop', (e) => {
        e.preventDefault();
        
        // ?대옒??紐낆묶 ?쒓굅 ?? 留덉슦???ъ씤?곗쓽 X醫뚰몴瑜??寃?以묒떖?먭낵 ?ㅼ떆媛?鍮꾧탳?섏뿬 ?쇳렪/?ㅻⅨ???먯젙
        const rect = el.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        const isBefore = e.clientX < midpoint;

        el.classList.remove('drag-left', 'drag-right');
        const fIcon = el.querySelector('.folder-icon');
        if (fIcon) fIcon.classList.remove('drag-over-folder');

        const dropTargetId = el.dataset.id;
        const dropTargetFolderId = el.dataset.folderId || null;

        if (draggedElementId === dropTargetId) return;

        let shortcuts = getShortcuts();
        let draggedItem = null;

        // 1. ?쒕옒洹??뚯뒪 媛앹껜 李얘린
        let srcIdx = shortcuts.findIndex(item => item.id === draggedElementId);
        if (srcIdx !== -1) {
            draggedItem = shortcuts[srcIdx];
        } else {
            shortcuts.forEach(item => {
                if (item.type === 'folder' && item.children) {
                    const childIdx = item.children.findIndex(c => c.id === draggedElementId);
                    if (childIdx !== -1) {
                        draggedItem = item.children[childIdx];
                    }
                }
            });
        }

        if (!draggedItem) return;

        // 2. ?쒕옒洹??뚯뒪 湲곗〈 ?꾩튂?먯꽌 ?쒓굅
        if (srcIdx !== -1) {
            shortcuts.splice(srcIdx, 1);
        } else {
            shortcuts.forEach(item => {
                if (item.type === 'folder' && item.children) {
                    item.children = item.children.filter(c => c.id !== draggedElementId);
                }
            });
        }

        // 3. 紐⑹쟻吏 諛곗튂 ?곗궛
        // A. ?대뜑濡?蹂묓빀?섎뒗 寃쎌슦 (留곹겕 -> ?대뜑 ?쒕∼)
        let targetFolderIdx = shortcuts.findIndex(item => item.id === dropTargetId && item.type === 'folder');
        if (targetFolderIdx !== -1) {
            if (draggedItem.type === 'link') {
                if (!shortcuts[targetFolderIdx].children) shortcuts[targetFolderIdx].children = [];
                shortcuts[targetFolderIdx].children.push(draggedItem);
                saveShortcuts(shortcuts);
                return;
            }
        }

        // B. ?ㅻⅨ ?대뜑 ?대????꾩씠???놁쑝濡??쒕∼??寃쎌슦
        if (dropTargetFolderId) {
            const folder = shortcuts.find(item => item.id === dropTargetFolderId && item.type === 'folder');
            if (folder && folder.children) {
                const targetIdx = folder.children.findIndex(c => c.id === dropTargetId);
                if (targetIdx !== -1) {
                    folder.children.splice(isBefore ? targetIdx : targetIdx + 1, 0, draggedItem);
                    saveShortcuts(shortcuts);
                    return;
                }
            }
        }

        // C. 猷⑦듃(?쇰컲 留곹겕) ?놁쑝濡??쒕∼??寃쎌슦
        let targetIdx = shortcuts.findIndex(item => item.id === dropTargetId);
        if (targetIdx !== -1) {
            shortcuts.splice(isBefore ? targetIdx : targetIdx + 1, 0, draggedItem);
            saveShortcuts(shortcuts);
            return;
        } else {
            shortcuts.push(draggedItem);
            saveShortcuts(shortcuts);
        }
    });

    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        document.querySelectorAll('.shortcut-item-wrapper, .folder-child-wrapper').forEach(item => {
            item.classList.remove('drag-left', 'drag-right');
            const fIcon = item.querySelector('.folder-icon');
            if (fIcon) fIcon.classList.remove('drag-over-folder');
        });
        draggedElementId = null;
        draggedElementFolderId = null;

        // 異붽?/??젣 踰꾪듉 ?먮옒?濡?蹂듦뎄
        const trigger = document.getElementById('add-delete-trigger');
        if (trigger) {
            trigger.classList.remove('trash-mode', 'drag-hover');
            
            const shortcuts = getShortcuts();
            if (shortcuts.length >= MAX_URLS) {
                trigger.style.display = 'none'; // 10媛쒕㈃ ?ㅼ떆 ?④?
            } else {
                trigger.style.display = 'flex';
            }
            
            const addTooltip = (currentTranslations['add_shortcut_or_folder'] && currentTranslations['add_shortcut_or_folder'].message) || '바로가기 / 폴더 추가';
            const addLabelText = (currentTranslations['add'] && currentTranslations['add'].message) || '추가';
            
            const iconDiv = trigger.querySelector('.shortcut-icon');
            const labelSpan = trigger.querySelector('.shortcut-label');
            if (iconDiv) {
                iconDiv.innerHTML = '<i class="fa-solid fa-plus"></i>';
                iconDiv.title = addTooltip;
            }
            if (labelSpan) {
                labelSpan.textContent = addLabelText;
            }
        }
    });
}

// --- 紐⑺몴 臾멸뎄 湲곕뒫 ---
async function loadGoal() {
    const goalTextElement = document.getElementById('goal-text');
    
    // 踰덉뿭??湲곕낯 紐⑺몴 臾멸뎄 媛?몄삤湲?
    const defaultGoal = (currentTranslations['goal_placeholder'] && currentTranslations['goal_placeholder'].message) 
        ? currentTranslations['goal_placeholder'].message 
        : "🔥 만약 1년 안에 1억을 벌지 못했을 때 당신이 죽는다면 어떤 일을 시작할건가요? 🔥";
    
    const savedGoal = localStorage.getItem(GOAL_STORAGE_KEY);
    
    // ?ъ슜???뺤쓽 紐⑺몴媛 ?녾굅?? ?댁쟾 ?몄뼱??湲곕낯 紐⑺몴? ?쇱튂?섎뒗 寃쎌슦 ???몄뼱??湲곕낯 紐⑺몴濡??낅뜲?댄듃
    const isDefault = !savedGoal || isDefaultGoal(savedGoal);
    
    if (isDefault) {
        goalTextElement.textContent = defaultGoal;
    } else {
        goalTextElement.textContent = savedGoal;
    }

    goalTextElement.addEventListener('click', () => {
        const currentText = goalTextElement.textContent;
        const input = document.createElement('input');
        input.type = 'text'; 
        // ?낅젰李쎌뿉??湲곕낯 紐⑺몴??寃쎌슦 鍮꾩썙??
        input.value = (isDefaultGoal(currentText)) ? "" : currentText;
        input.classList.add('input-field-dark'); input.style.width = "100%"; input.style.textAlign = "center";
        goalTextElement.parentNode.replaceChild(input, goalTextElement);
        input.focus();

        let isReverted = false;
        const revert = () => {
            if (isReverted) return;
            isReverted = true;
            
            const newGoal = input.value.trim();
            if (newGoal === "") {
                // ?ъ슜?먭? 鍮꾩썙?먮㈃ ?ㅼ떆 ???몄뼱??湲곕낯 紐⑺몴濡??ㅼ젙
                localStorage.removeItem(GOAL_STORAGE_KEY);
                goalTextElement.textContent = (currentTranslations['goal_placeholder'] && currentTranslations['goal_placeholder'].message) ? currentTranslations['goal_placeholder'].message : defaultGoal;
            } else {
                localStorage.setItem(GOAL_STORAGE_KEY, newGoal);
                goalTextElement.textContent = newGoal;
            }
            if (input.parentNode) input.parentNode.replaceChild(goalTextElement, input);
        };
        input.onkeypress = (e) => { if (e.key === 'Enter') revert(); };
        input.onblur = revert;
    });
}

// 湲곕낯 紐⑺몴 臾멸뎄?몄? ?뺤씤?섎뒗 ?ы띁 ?⑥닔
function isDefaultGoal(text) {
    // 紐⑤뱺 ?몄뼱??湲곕낯 臾멸뎄 由ъ뒪??(?꾩슂???뺤옣)
    const defaults = [
        "🔥 만약 1년 안에 1억을 벌지 못했을 때 당신이 죽는다면 어떤 일을 시작할건가요? 🔥",
        "🔥 Set your goal and be reminded every day 🔥",
        "🔥 目標を設定して、毎日思い出しましょう 🔥"
    ];
    return defaults.includes(text);
}



// --- 珥덇린??諛??대깽??由ъ뒪??---
document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    updateTime(); setInterval(updateTime, 1000);
    setupSearch(); 
    setupNotes();
    const savedEngine = localStorage.getItem(SEARCH_ENGINE_KEY) || 'google';
    updateSearchEngineUI(savedEngine);
    refreshAllInfo(); setInterval(refreshAllInfo, 1000 * 60 * 30);
    loadGoal(); loadTodos(); renderUserShortcuts(); loadSettings(); renderRecentSearches();

    // [?섏젙] Todo 由ъ뒪??珥덇린 媛?쒖꽦 ?ㅼ젙
    const todoContainer = document.getElementById('todo-list-container');
    const todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    if (todoContainer && todos.length > 0) {
        todoContainer.style.display = 'flex'; 
        todoContainer.classList.add('open');
    }

    const googleBtn = document.getElementById('google-engine-btn');
    const naverBtn = document.getElementById('naver-engine-btn');
    const yahooBtn = document.getElementById('yahoo-engine-btn');
    if (googleBtn) googleBtn.onclick = () => { updateSearchEngineUI('google'); localStorage.setItem(SEARCH_ENGINE_KEY, 'google'); };
    if (naverBtn) naverBtn.onclick = () => { updateSearchEngineUI('naver'); localStorage.setItem(SEARCH_ENGINE_KEY, 'naver'); };
    if (yahooBtn) yahooBtn.onclick = () => { updateSearchEngineUI('yahoo'); localStorage.setItem(SEARCH_ENGINE_KEY, 'yahoo'); };





    document.getElementById('add-todo-form').onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById('todo-input');
        if (input.value.trim()) { addTodo(input.value.trim()); input.value = ''; }
    };

    document.getElementById('todo-toggle-btn').onclick = () => {
        if (todoContainer.classList.contains('open')) {
            todoContainer.classList.remove('open'); setTimeout(() => todoContainer.style.display = 'none', 300);
        } else {
            todoContainer.style.display = 'block'; setTimeout(() => todoContainer.classList.add('open'), 10);
        }
    };
    document.getElementById('close-todoList-btn').onclick = () => {
        todoContainer.classList.remove('open'); setTimeout(() => todoContainer.style.display = 'none', 300);
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('add-shortcut-modal');
            if (modal && modal.style.display !== 'none') {
                closeAddShortcutModal();
                return;
            }
        }
    });

    document.getElementById('focus-mode-toggle').onchange = saveFocusSettings;
    document.getElementById('focus-schedule-toggle').onchange = saveFocusSettings;
    document.getElementById('focus-start-time').onchange = saveFocusSettings;
    document.getElementById('focus-end-time').onchange = saveFocusSettings;

    const langSelect = document.getElementById('language-select');
    langSelect.value = localStorage.getItem('preferredLanguage') || 'ko';
    langSelect.onchange = () => {
        localStorage.setItem('preferredLanguage', langSelect.value);
        applyTranslations();
    };

    // 諛붾줈 寃?됰컮??focus媛 湲곕낯?쇰줈 ?ㅼ뼱媛?덈룄濡?異붽?
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.focus();
    }

    // ?대뜑 ?앹뾽 ?몃? ?대┃ ???リ린
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.folder-icon') && !e.target.closest('.folder-dropdown')) {
            document.querySelectorAll('.folder-dropdown').forEach(d => d.classList.remove('open'));
            activeFolderId = null;
        }
    });

    // ?대뜑 ?대???留곹겕瑜?諛?猷⑦듃)?쇰줈 ?쒕옒洹????쒕∼?댁꽌 ?덉텧?섎뒗 湲곕뒫 諛붿씤??
    const shortcutsList = document.getElementById('user-shortcuts-list');
    if (shortcutsList) {
        shortcutsList.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        shortcutsList.addEventListener('drop', (e) => {
            if (draggedElementId && draggedElementFolderId) {
                // ?대뜑 ?꾨굹 ?대? ?쒕∼?ㅼ슫 ?앹뾽 ?꾩뿉 ?쒕∼??寃껋씠 ?꾨땶 寃쎌슦 (利?諛붽묑 ?щ갚 ?곸뿭)
                if (!e.target.closest('.folder-icon') && !e.target.closest('.folder-dropdown')) {
                    e.preventDefault();
                    let shortcuts = getShortcuts();
                    let draggedItem = null;
                    
                    // ?대뜑 ?덉뿉???먯떇??李얘퀬 ?쒓굅
                    shortcuts.forEach(item => {
                        if (item.id === draggedElementFolderId && item.type === 'folder' && item.children) {
                            const childIdx = item.children.findIndex(c => c.id === draggedElementId);
                            if (childIdx !== -1) {
                                draggedItem = item.children[childIdx];
                                item.children.splice(childIdx, 1);
                            }
                        }
                    });

                    if (draggedItem) {
                        // ?쒕∼??留덉슦??醫뚰몴 遺洹쇱쓽 猷⑦듃 諛붾줈媛湲??놁뿉 ?쎌엯?섍린 ?꾪빐 ?寃잛쓣 李얠쓬
                        const targetWrapper = e.target.closest('.shortcut-item-wrapper');
                        if (targetWrapper && targetWrapper.dataset.id) {
                            const targetId = targetWrapper.dataset.id;
                            const targetIdx = shortcuts.findIndex(item => item.id === targetId);
                            if (targetIdx !== -1) {
                                const rect = targetWrapper.getBoundingClientRect();
                                const midpoint = rect.left + rect.width / 2;
                                const isBefore = e.clientX < midpoint;
                                shortcuts.splice(isBefore ? targetIdx : targetIdx + 1, 0, draggedItem);
                            } else {
                                shortcuts.push(draggedItem);
                            }
                        } else {
                            // ?쇰컲 ?щ갚 怨듦컙???볦? 寃쎌슦 猷⑦듃 留??ㅻ줈 諛?대꽔??
                            shortcuts.push(draggedItem);
                        }
                        saveShortcuts(shortcuts);
                    }
                }
            }
        });
    }

    // --- 吏곸젒 異붽? 紐⑤떖 ?대깽??諛붿씤??---
    const tabLink = document.getElementById('tab-add-link');
    const tabFolder = document.getElementById('tab-add-folder');
    if (tabLink) tabLink.onclick = () => switchModalTab('link');
    if (tabFolder) tabFolder.onclick = () => switchModalTab('folder');

    const modal = document.getElementById('add-shortcut-modal');
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeAddShortcutModal();
            }
        };
    }

    const modalCloseBtn = document.getElementById('close-shortcutModal-btn');
    if (modalCloseBtn) modalCloseBtn.onclick = closeAddShortcutModal;
    
    const cancelLinkBtn = document.getElementById('cancel-link-btn');
    const cancelFolderBtn = document.getElementById('cancel-folder-btn');
    if (cancelLinkBtn) cancelLinkBtn.onclick = closeAddShortcutModal;
    if (cancelFolderBtn) cancelFolderBtn.onclick = closeAddShortcutModal;

    // 留곹겕 吏곸젒 異붽? ??submit
    const modalLinkForm = document.getElementById('modal-link-form');
    if (modalLinkForm) {
        modalLinkForm.onsubmit = (e) => {
            e.preventDefault();
            const urlInput = document.getElementById('modal-link-url');
            const nameInput = document.getElementById('modal-link-name');
            
            if (urlInput.value.trim()) {
                const success = addAccessibleUrlFromModal(urlInput.value.trim(), nameInput.value.trim());
                if (success) {
                    closeAddShortcutModal();
                }
            }
        };
    }

    // ?대뜑 吏곸젒 異붽? ??submit
    const modalFolderForm = document.getElementById('modal-folder-form');
    if (modalFolderForm) {
        modalFolderForm.onsubmit = (e) => {
            e.preventDefault();
            const folderNameInput = document.getElementById('modal-folder-name');
            
            if (folderNameInput.value.trim()) {
                const success = addFolder(folderNameInput.value.trim());
                if (success) {
                    closeAddShortcutModal();
                }
            }
        };
    }
});

function loadTodos() {
    let todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    
    // ?꾨즺 ?щ?瑜?湲곗??쇰줈 ?뺣젹 (false: 誘몄셿猷? true: ?꾨즺)
    todos.sort((a, b) => a.completed - b.completed);
    
    const list = document.getElementById('todo-list');
    if (!list) return;
    list.innerHTML = '';
    
    // ?ㅺ뎅???댄똻 ?띿뒪??媛?몄삤湲?
    const moveTooltip = (currentTranslations['move_to_notes'] && currentTranslations['move_to_notes'].message) || '장기 메모로 이동';

    todos.forEach(t => {
        const li = document.createElement('li'); if (t.completed) li.classList.add('completed');
        li.innerHTML = `<span class="todo-text">${t.text}</span><div class="todo-btn-container">
            <button class="complete-btn" title="${t.completed ? '재시작' : '완료'}">${t.completed ? '🔄' : '✅'}</button>
            <button class="move-to-notes-btn" title="${moveTooltip}">📌</button>
            <button class="delete-btn-icon" title="삭제">❌</button></div>`;
        
        li.querySelector('.complete-btn').onclick = () => { 
            t.completed = !t.completed; 
            localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos)); 
            loadTodos(); 
        };
        
        li.querySelector('.move-to-notes-btn').onclick = () => {
            const notes = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '[]');
            const newNote = {
                id: Date.now(),
                content: t.text,
                theme: 'yellow'
            };
            notes.unshift(newNote); // ??硫붾え瑜?媛???꾩뿉 異붽?
            localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
            loadNotes();
            
            todos = todos.filter(x => x.text !== t.text); 
            localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos)); 
            loadTodos(); 
        };
        
        li.querySelector('.delete-btn-icon').onclick = () => { 
            todos = todos.filter(x => x.text !== t.text); localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos)); loadTodos(); 
        };
        list.appendChild(li);
    });
}

function addTodo(text) {
    let todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    if (todos.length < MAX_TODOS) {
        todos.push({ text, completed: false }); localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos)); loadTodos();
    }
}

function saveFocusSettings() {
    const isSchedule = document.getElementById('focus-schedule-toggle').checked;
    localStorage.setItem(FOCUS_SCHEDULE_TOGGLE_KEY, isSchedule ? 'on' : 'off');
    localStorage.setItem(FOCUS_START_TIME_KEY, document.getElementById('focus-start-time').value);
    localStorage.setItem(FOCUS_END_TIME_KEY, document.getElementById('focus-end-time').value);
    if (!isSchedule) setFocusModeState(document.getElementById('focus-mode-toggle').checked, true);
    else checkFocusModeSchedule(lastKnownTimeStr);
    updateTimeControlsState();
}

function loadSettings() {
    chrome.storage.local.get([FOCUS_MODE_KEY], (data) => {
        const isFocus = data[FOCUS_MODE_KEY] === 'on';
        const isSchedule = localStorage.getItem(FOCUS_SCHEDULE_TOGGLE_KEY) === 'on';
        document.getElementById('focus-mode-toggle').checked = isFocus;
        document.getElementById('focus-schedule-toggle').checked = isSchedule;
        document.getElementById('focus-start-time').value = localStorage.getItem(FOCUS_START_TIME_KEY) || '09:00';
        document.getElementById('focus-end-time').value = localStorage.getItem(FOCUS_END_TIME_KEY) || '17:00';
        setFocusModeState(isFocus, true); updateTimeControlsState();
        if (isSchedule) checkFocusModeSchedule(lastKnownTimeStr);
    });

}

// --- ?κ린 硫붾え & ?쒖뒪??(Sticky Notes) 湲곕뒫 ---
function setupNotes() {
    const notesContainer = document.getElementById('notes-list-container');
    const addNoteBtn = document.getElementById('add-note-btn');

    if (!notesContainer || !addNoteBtn) return;

    addNoteBtn.onclick = () => {
        addNote();
    };

    loadNotes();
}

function loadNotes() {
    const notes = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '[]');
    renderNotes(notes);
}

function saveNotes(notes) {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    renderNotes(notes);
}

function addNote() {
    const notes = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '[]');
    const newNote = {
        id: Date.now(),
        content: '',
        theme: 'yellow'
    };
    notes.unshift(newNote); // 理쒖떊 硫붾え媛 留??꾩뿉 ?꾩튂?섎룄濡?異붽?
    saveNotes(notes);
}

function renderNotes(notes) {
    const wrapper = document.getElementById('notes-items-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    if (notes.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.style.textAlign = 'center';
        placeholder.style.color = '#9ca3af';
        placeholder.style.fontSize = '0.85em';
        placeholder.style.padding = '40px 10px';
        placeholder.textContent = currentTranslations['notes_placeholder'] ? currentTranslations['notes_placeholder'].message : '메모 내용을 입력하세요..';
        wrapper.appendChild(placeholder);
        return;
    }

    notes.forEach(note => {
        const item = document.createElement('div');
        item.className = `note-item note-theme-${note.theme}`;
        item.dataset.id = note.id;

        const textarea = document.createElement('textarea');
        textarea.className = 'note-textarea';
        textarea.placeholder = currentTranslations['notes_placeholder'] ? currentTranslations['notes_placeholder'].message : '메모 내용을 입력하세요..';
        textarea.value = note.content;

        // 湲 ?댁슜 蹂寃????먮룞 ???(?붾컮?댁뒪 ?곸슜)
        textarea.addEventListener('input', debounce(() => {
            const currentNotes = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '[]');
            const target = currentNotes.find(n => n.id === note.id);
            if (target) {
                target.content = textarea.value;
                localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(currentNotes));
            }
        }, 300));

        const footer = document.createElement('div');
        footer.className = 'note-footer';

        const colorPicker = document.createElement('div');
        colorPicker.className = 'note-color-picker';

        const themes = ['yellow', 'green', 'blue', 'pink', 'purple', 'gray'];
        themes.forEach(theme => {
            const dot = document.createElement('div');
            dot.className = `color-dot color-dot-${theme}`;
            dot.title = theme;
            dot.onclick = () => {
                const currentNotes = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '[]');
                const target = currentNotes.find(n => n.id === note.id);
                if (target) {
                    target.theme = theme;
                    saveNotes(currentNotes);
                }
            };
            colorPicker.appendChild(dot);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'note-delete-btn';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteBtn.title = '삭제';
        deleteBtn.onclick = () => {
            const currentNotes = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '[]');
            const updated = currentNotes.filter(n => n.id !== note.id);
            saveNotes(updated);
        };

        footer.appendChild(colorPicker);
        footer.appendChild(deleteBtn);

        item.appendChild(textarea);
        item.appendChild(footer);
        wrapper.appendChild(item);
    });


}