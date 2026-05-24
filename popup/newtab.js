// --- 전역 상수 및 키 ---
const TODO_STORAGE_KEY = 'customNewTabTodos';
const GOAL_STORAGE_KEY = 'customNewTabGoal';
const ACCESSIBLE_URLS_KEY = 'customNewTabAccessibleUrls';
const LAST_RESET_DATE_KEY = 'todoLastResetDate';
const FOCUS_MODE_KEY = 'isFocusModeOn';
const FOCUS_START_TIME_KEY = 'focusStartTime';
const FOCUS_END_TIME_KEY = 'focusEndTime';
const FOCUS_SCHEDULE_TOGGLE_KEY = 'isFocusScheduleOn';
const SEARCH_ENGINE_KEY = 'preferredSearchEngine';
const STOCK_SYMBOLS_KEY = 'customStockSymbols';
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
    
    // 언어 변경 시에도 목표 문구 업데이트 (기본값인 경우)
    await loadGoal();
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

// --- 시간 및 날짜 기능 ---
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

    // [추가] 초기화 진행률 업데이트
    updateTodoResetProgress();
}

// [수정] 초기화 진행률 계산 및 업데이트 (100% -> 0%)
function updateTodoResetProgress() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const elapsedMs = now - startOfDay;
    const totalDayMs = 24 * 60 * 60 * 1000;
    
    // 남은 비율 계산: 100% - (경과 비율)
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
    const timeControls = document.getElementById('focus-time-controls');
    if (!scheduleToggle || !timeControls) return;
    if (scheduleToggle.checked) timeControls.classList.remove('disabled-controls');
    else timeControls.classList.add('disabled-controls');
}

// --- 실시간 정보 기능 ---

async function fetchExchangeRate() {
    try {
        const rate = 1519;
        const exchangeRateEl = document.getElementById('exchange-rate');
        if (exchangeRateEl) {
            exchangeRateEl.innerHTML = `
                <div class="info-label">환율 (USD/KRW)</div>
                <div class="info-value"><i class="fas fa-minus trend-neutral"></i> <span>${rate.toLocaleString()}원</span></div>
            `;
        }
    } catch (error) { console.error('환율 오류:', error); }
}

async function fetchWeather() {
    try {
        const location = localStorage.getItem(WEATHER_LOCATION_KEY) || '37.5665, 126.9780';
        const [lat, lon] = location.split(',').map(s => s.trim());
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
                    <div class="info-label">기온(최저/최고)</div>
                    <div class="info-value">${icon} <span>${minTemp}° / ${maxTemp}°</span></div>
                </div>
                <div class="weather-slide">
                    <div class="info-label">현재 기온</div>
                    <div class="info-value">${icon} <span>${temp}°C</span></div>
                </div>
                <div class="weather-slide">
                    <div class="info-label">강수 확률</div>
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
                <div class="info-label">국내 유가 (휘/경)</div>
                <div class="info-value"><i class="fas fa-gas-pump" style="color: #10b981;"></i> <span>${gasPrice} / ${dieselPrice}</span></div>
            `;
        }
    } catch (error) { console.error('유가 오류:', error); }
}

async function fetchStockPrices() {
    let stocks = [];
    try { 
        const saved = localStorage.getItem(STOCK_SYMBOLS_KEY);
        stocks = JSON.parse(saved) || []; 
        if (typeof stocks === 'string') {
            stocks = stocks.split(',').map(s => ({ symbol: s.trim(), purchasePrice: null }));
        }
    } catch(e) { stocks = [{ symbol: 'AAPL', purchasePrice: null }]; }
    
    const container = document.getElementById('stock-prices');
    if (!container) return;
    container.innerHTML = '';

    if (stocks.length === 0) return;

    for (const stock of stocks) {
        try {
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}?interval=1d&range=1d`);
            if (!response.ok) continue;
            const data = await response.json();
            if (!data.chart || !data.chart.result || data.chart.result.length === 0) continue;

            const result = data.chart.result[0];
            const meta = result.meta;
            const currentPrice = meta.regularMarketPrice;
            const previousClose = meta.previousClose || meta.chartPreviousClose;

            let changeDisplay = '0.00';
            let trendClass = 'trend-neutral';
            let icon = '-';

            if (currentPrice !== undefined && previousClose !== undefined && previousClose !== 0) {
                const change = ((currentPrice - previousClose) / previousClose * 100);
                changeDisplay = Math.abs(change).toFixed(2);
                if (change > 0) { trendClass = 'trend-up'; icon = '▲'; }
                else if (change < 0) { trendClass = 'trend-down'; icon = '▼'; }
            }
            
            let yieldHtml = '';
            if (stock.purchasePrice && stock.purchasePrice > 0) {
                const yVal = ((currentPrice - stock.purchasePrice) / stock.purchasePrice * 100);
                yieldHtml = `<span class="${yVal >= 0 ? 'trend-up' : 'trend-down'}" style="font-size: 0.8em; margin-left: 10px; font-weight: 600;">${yVal >= 0 ? '+' : ''}${yVal.toFixed(2)}%</span>`;
            }

            const stockItem = document.createElement('div');
            stockItem.classList.add('stock-list-item');
            stockItem.dataset.symbol = stock.symbol;
            
            let domainSymbol = stock.symbol.split('.')[0].toLowerCase();
            const iconUrl = `https://www.google.com/s2/favicons?sz=64&domain_url=${domainSymbol}.com`;
            
            stockItem.innerHTML = `
                <div class="stock-main-info" style="cursor: grab;">
                    <img src="${iconUrl}" class="stock-icon-small" onerror="this.onerror=null; this.src='../images/pacemaker 48x48.png';">
                    <span class="symbol">${stock.symbol}</span>
                    <span class="price">${(currentPrice || 0).toLocaleString()}원</span>
                    ${yieldHtml}
                </div>
                <div class="change ${trendClass}">${icon} ${changeDisplay}%</div>
            `;
            container.appendChild(stockItem);
        } catch (error) { console.error(`주식(${stock.symbol}) 오류:`, error); }
    }
}

function refreshAllInfo() {
    fetchExchangeRate(); fetchWeather(); fetchOilPrices(); fetchStockPrices();
}

// --- 최근 검색 기록 ---
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

// --- 검색 기능 ---

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
        searchInput.name = 'query'; searchInput.placeholder = '네이버 검색 또는 URL 입력';
    } else if (engine === 'yahoo') {
        yahooBtn.classList.add('active'); googleBtn.classList.remove('active'); naverBtn.classList.remove('active');
        searchForm.action = 'https://search.yahoo.com/search';
        searchInput.name = 'p'; searchInput.placeholder = 'Yahoo 검색 또는 URL 입력';
    } else {
        googleBtn.classList.add('active'); naverBtn.classList.remove('active'); yahooBtn.classList.remove('active');
        searchForm.action = 'https://www.google.com/search';
        searchInput.name = 'q'; searchInput.placeholder = '구글 검색 또는 URL 입력';
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
        let items = autocompleteResults.querySelectorAll('.autocomplete-item');
        if (items.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); currentFocus = (currentFocus + 1) % items.length; setActive(items); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); currentFocus = (currentFocus - 1 + items.length) % items.length; setActive(items); }
        else if (e.key === 'Enter') { 
            if (currentFocus > -1) { e.preventDefault(); items[currentFocus].click(); }
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

// --- 사용자 정의 바로가기 렌더링 ---
function renderUserShortcuts() {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    const userShortcutsList = document.getElementById('user-shortcuts-list');
    if (!userShortcutsList) return;
    userShortcutsList.innerHTML = ''; 

    urls.forEach((url) => {
        const a = document.createElement('a');
        a.href = "#"; a.classList.add('shortcut-icon', 'user-shortcut-icon');
        try {
            a.style.backgroundImage = `url("https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}")`;
        } catch (e) {
            a.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'; a.innerHTML = '🔗';
        }
        a.onclick = (e) => { e.preventDefault(); window.location.href = url; };
        userShortcutsList.appendChild(a);
    });
}

function loadAccessibleUrls() {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    const listContainer = document.getElementById('accessible-urls-list');
    if (!listContainer) return;
    listContainer.innerHTML = ''; 
    if (urls.length === 0) listContainer.innerHTML = '<p class="setting-desc" style="color:#aaa;">등록된 웹사이트가 없습니다.</p>';

    urls.forEach((urlItem, index) => {
        const item = document.createElement('div'); item.classList.add('accessible-url-item');
        item.innerHTML = `
            <div class="url-text" style="display:flex; align-items:center; gap:8px;">
                <div class="move-btns" style="display:flex; flex-direction:column; gap:2px;">
                    <button class="move-up" style="font-size:10px; padding:0; background:none; border:none; cursor:pointer; opacity:0.5;">▲</button>
                    <button class="move-down" style="font-size:10px; padding:0; background:none; border:none; cursor:pointer; opacity:0.5;">▼</button>
                </div>
                <span>${urlItem}</span>
            </div>
            <button class="url-delete-btn">❌</button>
        `;

        item.querySelector('.move-up').onclick = () => {
            if (index > 0) {
                [urls[index], urls[index-1]] = [urls[index-1], urls[index]];
                saveUrls(urls);
            }
        };
        item.querySelector('.move-down').onclick = () => {
            if (index < urls.length - 1) {
                [urls[index], urls[index+1]] = [urls[index+1], urls[index]];
                saveUrls(urls);
            }
        };
        item.querySelector('.url-delete-btn').onclick = () => {
            urls = urls.filter(u => u !== urlItem);
            saveUrls(urls);
        };
        listContainer.appendChild(item);
    });
}

function saveUrls(urls) {
    localStorage.setItem(ACCESSIBLE_URLS_KEY, JSON.stringify(urls));
    chrome.storage.local.set({ [ACCESSIBLE_URLS_KEY]: urls });
    loadAccessibleUrls(); renderUserShortcuts();
}

function addAccessibleUrl(url) {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    const processed = processUrl(url);
    if (!urls.includes(processed) && urls.length < MAX_URLS) {
        urls.push(processed); 
        saveUrls(urls);
    }
}

// --- 목표 문구 기능 ---
async function loadGoal() {
    const goalTextElement = document.getElementById('goal-text');
    
    // 번역된 기본 목표 문구 가져오기
    const defaultGoal = (currentTranslations['goal_placeholder'] && currentTranslations['goal_placeholder'].message) 
        ? currentTranslations['goal_placeholder'].message 
        : "🔥 만약 1년 안에 1억을 벌지 못했을 때 당신이 죽는다면 어떤 일을 시작할건가요? 🔥";
    
    const savedGoal = localStorage.getItem(GOAL_STORAGE_KEY);
    
    // 사용자 정의 목표가 없거나, 이전 언어의 기본 목표와 일치하는 경우 새 언어의 기본 목표로 업데이트
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
        // 입력창에는 기본 목표일 경우 비워둠
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
                // 사용자가 비워두면 다시 새 언어의 기본 목표로 설정
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

// 기본 목표 문구인지 확인하는 헬퍼 함수
function isDefaultGoal(text) {
    // 모든 언어의 기본 문구 리스트 (필요시 확장)
    const defaults = [
        "🔥 만약 1년 안에 1억을 벌지 못했을 때 당신이 죽는다면 어떤 일을 시작할건가요? 🔥",
        "🔥 Set your goal and be reminded every day 🔥",
        "🔥 目標を設定して、毎日思い出しましょう 🔥"
    ];
    return defaults.includes(text);
}

// --- 주식 관리 ---
function loadCustomStocks() {
    let stocks = [];
    try {
        const saved = localStorage.getItem(STOCK_SYMBOLS_KEY);
        stocks = JSON.parse(saved) || [];
        if (typeof stocks === 'string') {
            stocks = stocks.split(',').map(s => ({ symbol: s.trim(), purchasePrice: null }));
        }
    } catch (e) { stocks = [{ symbol: 'AAPL', purchasePrice: null }]; }

    const container = document.getElementById('custom-stocks-list');
    if (!container) return;
    container.innerHTML = '';

    stocks.forEach((stock, i) => {
        const item = document.createElement('div'); 
        item.classList.add('accessible-url-item');
        
        const priceDisplay = stock.purchasePrice ? stock.purchasePrice.toLocaleString() : '미입력';
        
        item.innerHTML = `
            <div class="url-text" style="display:flex; align-items:center; gap:8px;">
                <div class="move-btns" style="display:flex; flex-direction:column; gap:2px;">
                    <button class="move-up" style="font-size:10px; padding:0; background:none; border:none; cursor:pointer; opacity:0.5;">▲</button>
                    <button class="move-down" style="font-size:10px; padding:0; background:none; border:none; cursor:pointer; opacity:0.5;">▼</button>
                </div>
                <strong>${stock.symbol}</strong> 
                <span class="stock-buy-price" title="클릭하여 매수가 수정" style="cursor:pointer; margin-left:4px; font-size:0.85em; color:var(--accent-color);">
                    매수: ${priceDisplay}
                </span>
            </div>
            <button class="url-delete-btn">❌</button>
        `;

        item.querySelector('.move-up').onclick = () => {
            if (i > 0) {
                [stocks[i], stocks[i-1]] = [stocks[i-1], stocks[i]];
                saveStocks(stocks);
            }
        };
        item.querySelector('.move-down').onclick = () => {
            if (i < stocks.length - 1) {
                [stocks[i], stocks[i+1]] = [stocks[i+1], stocks[i]];
                saveStocks(stocks);
            }
        };

        const priceSpan = item.querySelector('.stock-buy-price');
        priceSpan.onclick = () => {
            const input = document.createElement('input');
            input.type = 'number'; input.value = stock.purchasePrice || '';
            input.step = 'any'; input.classList.add('input-field-dark');
            input.style.width = '80px'; input.style.padding = '4px 8px'; input.style.fontSize = '0.85em';
            priceSpan.parentNode.replaceChild(input, priceSpan);
            input.focus();
            const save = () => {
                stock.purchasePrice = input.value.trim() !== '' ? parseFloat(input.value) : null;
                saveStocks(stocks);
            };
            input.onblur = save; input.onkeypress = (e) => { if (e.key === 'Enter') input.blur(); };
        };

        item.querySelector('.url-delete-btn').onclick = () => {
            stocks.splice(i, 1); 
            saveStocks(stocks);
        };
        container.appendChild(item);
    });
    localStorage.setItem(STOCK_SYMBOLS_KEY, JSON.stringify(stocks));
}

function saveStocks(stocks) {
    localStorage.setItem(STOCK_SYMBOLS_KEY, JSON.stringify(stocks));
    loadCustomStocks(); 
    fetchStockPrices();
}

// --- 초기화 및 이벤트 리스너 ---
document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    updateTime(); setInterval(updateTime, 1000);
    setupSearch(); 
    const savedEngine = localStorage.getItem(SEARCH_ENGINE_KEY) || 'google';
    updateSearchEngineUI(savedEngine);
    refreshAllInfo(); setInterval(refreshAllInfo, 1000 * 60 * 30);
    loadGoal(); loadTodos(); renderUserShortcuts(); loadSettings(); renderRecentSearches();

    // [수정] Todo 리스트 초기 가시성 설정
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

    const addStockForm = document.getElementById('add-stock-form');
    if (addStockForm) addStockForm.onsubmit = (e) => {
        e.preventDefault();
        const symbolInput = document.getElementById('stock-symbol-input');
        const symbol = symbolInput.value.trim();
        if (symbol) {
            let stocks = JSON.parse(localStorage.getItem(STOCK_SYMBOLS_KEY) || '[]');
            stocks.push({ symbol: symbol.toUpperCase(), purchasePrice: null });
            localStorage.setItem(STOCK_SYMBOLS_KEY, JSON.stringify(stocks));
            loadCustomStocks(); 
            fetchStockPrices();
            symbolInput.value = '';
        }
    };

    const saveWeatherBtn = document.getElementById('save-weather-btn');
    if (saveWeatherBtn) saveWeatherBtn.onclick = () => {
        const val = document.getElementById('weather-location-input').value.trim();
        if (val) { localStorage.setItem(WEATHER_LOCATION_KEY, val); alert('날씨 설정 저장됨'); fetchWeather(); }
    };

    document.getElementById('add-todo-form').onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById('todo-input');
        if (input.value.trim()) { addTodo(input.value.trim()); input.value = ''; }
    };

    document.getElementById('add-url-form').onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById('url-input');
        if (input.value.trim()) { addAccessibleUrl(input.value.trim()); input.value = ''; }
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

    const settingsPanel = document.getElementById('settings-panel');
    const openSettings = () => {
        loadAccessibleUrls(); settingsPanel.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setTimeout(() => settingsPanel.classList.add('open'), 10);
    };
    const closeSettings = () => {
        settingsPanel.classList.remove('open'); document.body.style.overflow = '';
        setTimeout(() => settingsPanel.style.display = 'none', 300);
    };
    document.getElementById('settings-btn').onclick = openSettings;
    document.getElementById('close-settings-btn').onclick = closeSettings;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.activeElement.tagName !== 'INPUT') {
            if (settingsPanel.classList.contains('open')) closeSettings();
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
});

function loadTodos() {
    let todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    
    // 완료 여부를 기준으로 정렬 (false: 미완료, true: 완료)
    todos.sort((a, b) => a.completed - b.completed);
    
    const list = document.getElementById('todo-list');
    if (!list) return;
    list.innerHTML = '';
    todos.forEach(t => {
        const li = document.createElement('li'); if (t.completed) li.classList.add('completed');
        li.innerHTML = `<span class="todo-text">${t.text}</span><div class="todo-btn-container">
            <button class="complete-btn">${t.completed ? '🔄' : '✅'}</button><button class="delete-btn-icon">❌</button></div>`;
        li.querySelector('.complete-btn').onclick = () => { t.completed = !t.completed; localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos)); loadTodos(); };
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
    document.getElementById('weather-location-input').value = localStorage.getItem(WEATHER_LOCATION_KEY) || '37.5665, 126.9780';
    loadCustomStocks();
}