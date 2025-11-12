// --- 전역 상수 및 키 ---
const TODO_STORAGE_KEY = 'customNewTabTodos';
const GOAL_STORAGE_KEY = 'customNewTabGoal';
const ACCESSIBLE_URLS_KEY = 'customNewTabAccessibleUrls'; 
const LAST_RESET_DATE_KEY = 'todoLastResetDate';
const FOCUS_MODE_KEY = 'isFocusModeOn';
const FOCUS_START_TIME_KEY = 'focusStartTime';
const FOCUS_END_TIME_KEY = 'focusEndTime';
const FOCUS_SCHEDULE_TOGGLE_KEY = 'isFocusScheduleOn'; 
const MAX_URLS = 10; // 💡 최대 URL 개수 제한
const MAX_TODOS = 10; // 💡 최대 할 일 개수 제한

// --- 시간 및 날짜 기능 (수정됨: 집중 모드 스케줄링 추가) ---
function updateTime() {
    const now = new Date();
    
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    
    const dateText = `${year}년 ${month}월 ${day}일`;
    document.getElementById('date').textContent = dateText;
    
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    document.getElementById('time').textContent = `${hours}:${minutes}:${seconds}`;

    if (hours === '00' && minutes === '00' && seconds === '00') {
        checkAndResetTodos(dateText);
    }
    // 매 초마다 스케줄 검사
    checkFocusModeSchedule(currentTimeStr); 
}

function parseTime(timeStr) {
    if (!timeStr) return -1;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function isTimeBetween(startTimeStr, endTimeStr, currentTimeStr) {
    const start = parseTime(startTimeStr);
    const end = parseTime(endTimeStr);
    const current = parseTime(currentTimeStr);
    
    if (start === -1 || end === -1 || start === end) return false; 
    
    if (start < end) {
        return current >= start && current < end; 
    } else {
        // 자정을 넘어가는 경우 (예: 23:00 시작, 02:00 종료)
        return current >= start || current < end;
    }
}

/**
 * 집중 모드 스케줄을 확인하고 상태를 업데이트합니다.
 * 스케줄이 활성화되어 있으면 수동 토글을 덮어씁니다.
 */
function checkFocusModeSchedule(currentTimeStr) {
    const manualToggle = document.getElementById('focus-mode-toggle');
    // 로컬 스토리지에서 상태를 읽어옵니다. (loadSettings에서 UI는 동기화됨)
    const isScheduleEnabled = localStorage.getItem(FOCUS_SCHEDULE_TOGGLE_KEY) === 'on'; 
    
    // chrome.storage 사용으로 변경 (background.js와 통일)
    chrome.storage.local.get([FOCUS_MODE_KEY], function(data) {
        const isFocusModeOn = data[FOCUS_MODE_KEY] === 'on';

        if (!manualToggle) return;

        if (isScheduleEnabled) {
            // --- 1. 자동 스케줄 모드 (Schedule ON) ---
            const start = localStorage.getItem(FOCUS_START_TIME_KEY);
            const end = localStorage.getItem(FOCUS_END_TIME_KEY);
            
            if (start && end) {
                const isActiveTime = isTimeBetween(start, end, currentTimeStr);
                
                // 현재 시간이 스케줄 구간이면 ON으로 설정
                if (isActiveTime) {
                    if (!isFocusModeOn) {
                        setFocusModeState(true, false); // 스케줄에 의한 ON
                    }
                } else {
                    // 현재 시간이 스케줄 구간이 아니면 OFF로 설정
                    if (isFocusModeOn) {
                        setFocusModeState(false, false); // 스케줄에 의한 OFF
                    }
                }
            }
        } 
        // Note: Schedule OFF일 때는 수동 토글 상태를 loadSettings나 saveFocusSettings에서 처리
    });
}


/**
 * 집중 모드 상태를 설정하고 UI를 업데이트합니다.
 * @param {boolean} state - ON/OFF 상태 (true: ON, false: OFF)
 * @param {boolean} updateManualToggle - 수동 토글 UI도 업데이트할지 여부 (스케줄 자동 작동 시 false)
 */
function setFocusModeState(state, updateManualToggle) {
    const body = document.body;
    const indicator = document.querySelector('.focus-mode-indicator');
    const manualToggle = document.getElementById('focus-mode-toggle');
    
    // 상태를 chrome.storage에 저장 (background.js에서 모니터링)
    chrome.storage.local.set({ [FOCUS_MODE_KEY]: state ? 'on' : 'off' });
    
    if (state) {
        body.classList.add('focus-mode');
        indicator.style.display = 'block';
    } else {
        body.classList.remove('focus-mode');
        indicator.style.display = 'none';
    }
    
    // 수동 토글 UI 업데이트: 
    if (manualToggle && updateManualToggle) {
        manualToggle.checked = state;
    }
}

// --- To-Do List 리셋 로직 ---
function checkAndResetTodos(currentDate) {
    const lastResetDate = localStorage.getItem(LAST_RESET_DATE_KEY);

    if (lastResetDate !== currentDate) {
        localStorage.removeItem(TODO_STORAGE_KEY);
        localStorage.setItem(LAST_RESET_DATE_KEY, currentDate);
        loadTodos();
        console.log(`To-Do List가 ${currentDate} 자정 기준으로 리셋되었습니다.`);
    }
}

setInterval(updateTime, 1000);
updateTime();

// 💡 스케줄 시간 입력 컨트롤의 상태를 업데이트합니다.
function updateTimeControlsState() {
    const scheduleToggle = document.getElementById('focus-schedule-toggle');
    const timeControls = document.getElementById('focus-time-controls');
    
    if (!scheduleToggle || !timeControls) return;

    if (scheduleToggle.checked) {
        timeControls.classList.remove('disabled-controls');
    } else {
        timeControls.classList.add('disabled-controls');
    }
}

// --- 설정 로드 및 저장 ---
function loadSettings() {
    // 1. Focus Mode Settings
    // chrome.storage에서 실제 집중 모드 상태를 가져옵니다.
    chrome.storage.local.get([FOCUS_MODE_KEY], function(data) {
        const isFocusOn = data[FOCUS_MODE_KEY] === 'on'; 
        
        const isScheduleOn = localStorage.getItem(FOCUS_SCHEDULE_TOGGLE_KEY) === 'on'; 
        const startTime = localStorage.getItem(FOCUS_START_TIME_KEY) || '09:00';
        const endTime = localStorage.getItem(FOCUS_END_TIME_KEY) || '17:00';
        
        const manualToggle = document.getElementById('focus-mode-toggle');
        const scheduleToggle = document.getElementById('focus-schedule-toggle'); 
        const startInput = document.getElementById('focus-start-time');
        const endInput = document.getElementById('focus-end-time');

        // 초기 로드 시 로컬 상태 반영
        if (manualToggle) manualToggle.checked = isFocusOn; 
        if (scheduleToggle) scheduleToggle.checked = isScheduleOn; 
        if (startInput) startInput.value = startTime;
        if (endInput) endInput.value = endTime;

        // UI 초기 상태 반영
        setFocusModeState(isFocusOn, true); 
        
        updateTimeControlsState(); 
    });
}

function saveFocusSettings() {
    const manualToggle = document.getElementById('focus-mode-toggle');
    const scheduleToggle = document.getElementById('focus-schedule-toggle'); 
    const startInput = document.getElementById('focus-start-time');
    const endInput = document.getElementById('focus-end-time');
    
    if (!manualToggle || !scheduleToggle || !startInput || !endInput) return; 

    const isManualOn = manualToggle.checked;
    const isScheduleOn = scheduleToggle.checked;
    
    localStorage.setItem(FOCUS_SCHEDULE_TOGGLE_KEY, isScheduleOn ? 'on' : 'off');
    localStorage.setItem(FOCUS_START_TIME_KEY, startInput.value);
    localStorage.setItem(FOCUS_END_TIME_KEY, endInput.value);
    
    if (!isScheduleOn) {
        // 스케줄이 꺼져 있다면, 수동 토글의 상태를 최종 상태로 저장하고 즉시 적용합니다.
        setFocusModeState(isManualOn, true); 
    } else {
        // 스케줄이 켜져 있다면, 수동 토글 상태만 저장하고, 실제 상태는 스케줄에 맡깁니다.
        // 스케줄 ON일 때 saveFocusSettings가 호출되면, 즉시 스케줄 검사를 다시 수행하여 반영
        const now = new Date();
        const hours = now.getHours().getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        checkFocusModeSchedule(`${hours}:${minutes}`);
    }

    updateTimeControlsState(); 
}

// --- Helper Functions ---
function debounce(func, delay) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}


// --- URL 차단 기능 (Focus Blocker) 제거됨 ---
/*
    **이 섹션은 background.js로 이동되었습니다.**
    (getHostname, isUrlAllowed, showBlocker, hideBlocker 관련 로직 제거)
*/


// --- 검색 기능 (자동 완성 포함) ---
function setupSearch() {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const autocompleteResults = document.getElementById('autocomplete-results');
    
    const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search?client=chrome&q=';
    let currentFocus = -1; 
    
    searchInput.focus(); 

    searchInput.addEventListener('input', debounce(async function() {
        const query = searchInput.value.trim();
        if (query.length < 1) {
            hideAutocomplete();
            return;
        }

        try {
            const response = await fetch(SUGGEST_URL + encodeURIComponent(query));
            const text = await response.text();
            
            // JSONP 스타일의 응답을 JSON으로 파싱
            const jsonText = text.substring(text.indexOf('[') - 1, text.lastIndexOf(']') + 1).trim();
            const data = JSON.parse(jsonText);
            
            const suggestions = data[1].slice(0, 8); 
            
            displayAutocomplete(suggestions);

        } catch (error) {
            console.error('Autocomplete fetch error:', error);
            hideAutocomplete();
        }
    }, 200)); 
    
    function displayAutocomplete(suggestions) {
        autocompleteResults.innerHTML = '';
        currentFocus = -1;

        if (suggestions.length === 0) {
            hideAutocomplete();
            return;
        }

        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.classList.add('autocomplete-item');
            item.textContent = suggestion;
            
            item.addEventListener('click', function() {
                searchInput.value = suggestion;
                // 바로 submit 대신, submit 이벤트 핸들러를 실행
                searchForm.dispatchEvent(new Event('submit', { cancelable: true })); 
                hideAutocomplete();
            });
            autocompleteResults.appendChild(item);
        });

        autocompleteResults.style.display = 'block';
    }

    function hideAutocomplete() {
        autocompleteResults.style.display = 'none';
        autocompleteResults.innerHTML = '';
        currentFocus = -1;
    }
    
    searchInput.addEventListener('keydown', function(e) {
        let items = autocompleteResults.querySelectorAll('.autocomplete-item');
        
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') { 
            e.preventDefault();
            currentFocus = (currentFocus + 1) % items.length;
            setActive(items);
        } else if (e.key === 'ArrowUp') { 
            e.preventDefault();
            currentFocus = (currentFocus - 1 + items.length) % items.length;
            setActive(items);
        } else if (e.key === 'Enter') { 
            if (currentFocus > -1) {
                // Enter key pressed while an item is highlighted
                e.preventDefault();
                items[currentFocus].click(); 
            } else {
                // Regular form submit
                // Enter key press should trigger the submit event to hit the handler below
                searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        }
    });

    searchForm.addEventListener('submit', function(event) {
        event.preventDefault(); 
        let query = searchInput.value.trim();
        if (query === "") return; 

        // Check if the query is a URL
        const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
        if (urlRegex.test(query)) {
            let targetUrl = query;
            if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                targetUrl = 'https://' + targetUrl;
            }
            
            // 💡 [수정] URL 차단 로직 제거: 이제 background.js가 웹 요청을 가로챕니다.
            window.location.href = targetUrl; 
        } else {
            // It's a search term, submit the form normally
            this.submit(); 
        }
    });
    
    document.addEventListener('click', function(e) {
        if (e.target.id !== 'search-input' && !e.target.classList.contains('autocomplete-item')) {
            hideAutocomplete();
        }
    });
    
    function setActive(items) {
        items.forEach(item => item.classList.remove('active'));
        if (currentFocus > -1 && currentFocus < items.length) {
            items[currentFocus].classList.add('active');
            searchInput.value = items[currentFocus].textContent;
        }
    }
}


// --- 목표 문구 기능 ---
function loadGoal() {
    const goalTextElement = document.getElementById('goal-text');
    const savedGoal = localStorage.getItem(GOAL_STORAGE_KEY);
    
    if (savedGoal) {
        goalTextElement.textContent = savedGoal;
    } else {
        goalTextElement.textContent = "🔥 만약 1년 안에 1억을 벌지 못했을 때 당신이 죽는다면 어떤 일을 시작할건가요? 🔥";
    }

    goalTextElement.addEventListener('click', () => {
        const currentText = goalTextElement.textContent;
        const input = document.createElement('input');
        
        input.type = 'text';
        input.value = (currentText === "🔥 만약 1년 안에 1억을 벌지 못했을 때 당신이 죽는다면 어떤 일을 시작할건가요? 🔥") ? "" : currentText;
        input.id = 'goal-input-editor';
        
        goalTextElement.parentNode.replaceChild(input, goalTextElement);
        input.focus();

        const saveGoal = () => {
            const newGoal = input.value.trim() || " 🔥만약 1년 안에 1억을 벌지 못했을 때 당신이 죽는다면 어떤 일을 시작할건가요? 🔥";
            localStorage.setItem(GOAL_STORAGE_KEY, newGoal);
            goalTextElement.textContent = newGoal;
            input.parentNode.replaceChild(goalTextElement, input);
        };
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveGoal();
            }
        });
        
        input.addEventListener('blur', saveGoal);
    });
}


// --- 사용자 정의 바로가기 렌더링 함수 ---
function renderUserShortcuts() {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    const userShortcutsList = document.getElementById('user-shortcuts-list');
    userShortcutsList.innerHTML = ''; 

    urls.forEach((url) => {
        const a = document.createElement('a');
        a.href = "#"; // Prevent immediate navigation
        a.classList.add('shortcut-icon', 'user-shortcut-icon');
        a.target = "_self";
        
        try {
            const domain = new URL(url).hostname;
            a.title = domain;
            
            // Google Favicon API를 사용하여 파비콘을 배경 이미지로 설정
            a.style.backgroundImage = `url("https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}")`;
            
        } catch (e) {
            a.title = url;
            a.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            a.innerHTML = '🔗';
        }
        
        // 💡 [수정] 바로가기 아이콘 클릭 시 URL 검사 로직 제거: 이제 background.js가 웹 요청을 가로챕니다.
        a.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = url;
        });

        userShortcutsList.appendChild(a);
    });
}


// --- 접근 가능 URL 기능 ---
// 💡 URL 제한 로직을 포함하도록 addAccessibleUrl을 수정
function addAccessibleUrl(newUrl) {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    const urlInput = document.getElementById('url-input');
    const urlWarning = document.getElementById('url-limit-warning');
    
    // 💡 제한 초과 시 경고 표시 
    if (urls.length >= MAX_URLS) {
        urlWarning.classList.add('active'); // 경고 문구 표시
        urlInput.classList.add('shake'); // 흔들림 애니메이션 시작
        setTimeout(() => urlInput.classList.remove('shake'), 500); // 애니메이션 후 클래스 제거
    }
    
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
        newUrl = 'https://' + newUrl;
    }
    
    if (urls.includes(newUrl)) {
        alert("이미 등록된 URL입니다.");
        return;
    }

    urls.push(newUrl);
    
    // chrome.storage와 localStorage 동기화 (Background.js가 chrome.storage를 감시)
    localStorage.setItem(ACCESSIBLE_URLS_KEY, JSON.stringify(urls));
    chrome.storage.local.set({ [ACCESSIBLE_URLS_KEY]: urls });
    
    loadAccessibleUrls();
    renderUserShortcuts(); 
}

function updateAccessibleUrl(oldUrl, newUrl) {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    
    // http/https 접두사 보장
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
        newUrl = 'https://' + newUrl;
    }
    
    if (newUrl === oldUrl) return; 

    if (urls.includes(newUrl)) {
        alert("이미 등록된 URL입니다.");
        return;
    }

    const index = urls.indexOf(oldUrl);
    if (index !== -1) {
        urls[index] = newUrl;
        
        // chrome.storage와 localStorage 동기화
        localStorage.setItem(ACCESSIBLE_URLS_KEY, JSON.stringify(urls));
        chrome.storage.local.set({ [ACCESSIBLE_URLS_KEY]: urls });
        
        loadAccessibleUrls();
        renderUserShortcuts();
    }
}


function loadAccessibleUrls() {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    const listContainer = document.getElementById('accessible-urls-list');
    const urlWarning = document.getElementById('url-limit-warning'); // 💡 경고 문구 참조
    listContainer.innerHTML = ''; 

    if (urls.length === 0) {
        listContainer.innerHTML = '<p class="setting-desc" style="color:#aaa;">등록된 웹사이트가 없습니다.</p>';
    }

    // 💡 로드 시 제한 초과 여부를 확인하고 경고 문구 상태 업데이트
    if (urls.length >= MAX_URLS) {
        if(urlWarning) urlWarning.classList.add('active');
    } else {
        if(urlWarning) urlWarning.classList.remove('active');
    }

    urls.forEach((urlItem) => {
        const item = document.createElement('div');
        item.classList.add('accessible-url-item');
        
        const urlText = document.createElement('span');
        urlText.classList.add('url-text');
        urlText.textContent = urlItem;
        
        const btnContainer = document.createElement('div');
        btnContainer.classList.add('url-btn-container');

        const editBtn = document.createElement('button');
        editBtn.classList.add('edit-url-btn');
        editBtn.innerHTML = '🔄'; 
        editBtn.title = '수정';
        editBtn.addEventListener('click', () => {
            const currentUrl = urlText.textContent;
            const input = document.createElement('input');
            input.type = 'url';
            input.value = currentUrl;
            input.classList.add('url-input-editor'); 
            input.style.width = '100%';
            input.style.textShadow = 'none';
            input.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            input.style.border = '1px solid #FFC107';
            input.style.color = 'white';
            input.style.padding = '5px';
            input.style.borderRadius = '3px';
            input.style.boxSizing = 'border-box';


            urlText.parentNode.replaceChild(input, urlText);
            input.focus();

            const saveUrl = () => {
                const newUrl = input.value.trim();
                if (newUrl) {
                    updateAccessibleUrl(currentUrl, newUrl);
                } else {
                    // Empty input or escape (blur) without change: restore original text span
                    input.parentNode.replaceChild(urlText, input);
                    urlText.textContent = currentUrl; 
                }
            };

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    saveUrl();
                    input.blur(); // Blur triggers saveUrl too, but this handles Enter press cleanly
                }
            });
            input.addEventListener('blur', saveUrl);
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('url-delete-btn');
        deleteBtn.innerHTML = '❌';
        deleteBtn.title = '삭제';
        deleteBtn.addEventListener('click', () => deleteAccessibleUrl(urlItem));

        btnContainer.appendChild(editBtn); 
        btnContainer.appendChild(deleteBtn);

        item.appendChild(urlText);
        item.appendChild(btnContainer); 
        listContainer.appendChild(item);
    });
}

function deleteAccessibleUrl(urlToDelete) {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    urls = urls.filter(url => url !== urlToDelete); 
    
    // chrome.storage와 localStorage 동기화
    localStorage.setItem(ACCESSIBLE_URLS_KEY, JSON.stringify(urls));
    chrome.storage.local.set({ [ACCESSIBLE_URLS_KEY]: urls });
    
    loadAccessibleUrls();
    renderUserShortcuts(); 
}


// --- 할 일 목록 기능 ---
function loadTodos() {
    let todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    const todoWarning = document.getElementById('todo-limit-warning'); // 💡 경고 문구 참조
    
    todos.sort((a, b) => a.completed - b.completed); 

    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = ''; 

    // 💡 로드 시 제한 초과 여부를 확인하고 경고 문구 상태 업데이트
    if (todos.length >= MAX_TODOS) {
        if(todoWarning) todoWarning.classList.add('active');
    } else {
        if(todoWarning) todoWarning.classList.remove('active');
    }

    todos.forEach((todoItem) => {
        const li = document.createElement('li');
        li.textContent = todoItem.text;

        if (todoItem.completed) {
            li.classList.add('completed');
        }

        const btnContainer = document.createElement('div');
        btnContainer.classList.add('todo-btn-container');

        const completeBtn = document.createElement('button');
        completeBtn.classList.add('complete-btn');
        completeBtn.innerHTML = todoItem.completed ? '🔄' : '✅'; 
        completeBtn.title = todoItem.completed ? '완료 취소' : '완료';
        completeBtn.addEventListener('click', () => toggleComplete(todoItem.text));

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '❌';
        deleteBtn.title = '삭제';
        deleteBtn.classList.add('delete-btn-icon');
        deleteBtn.addEventListener('click', () => deleteTodo(todoItem.text));

        btnContainer.appendChild(completeBtn);
        btnContainer.appendChild(deleteBtn);
        
        li.appendChild(btnContainer);
        todoList.appendChild(li);
    });
    
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
}

// 💡 할 일 제한 로직을 포함하도록 addTodo를 수정
function addTodo(todoText) {
    const todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    const todoWarning = document.getElementById('todo-limit-warning');
    
    // 💡 제한 초과 시 경고 표시 (제한은 해제)
    if (todos.length >= MAX_TODOS) {
        if(todoWarning) todoWarning.classList.add('active'); // 경고 문구 표시
    }
    
    todos.push({ text: todoText, completed: false });
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
    loadTodos(); 
}

function toggleComplete(todoText) {
    let todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    const index = todos.findIndex(todo => todo.text === todoText); 
    if (index !== -1) {
        todos[index].completed = !todos[index].completed;
        localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
        loadTodos(); 
    }
}

function deleteTodo(todoText) {
    let todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    todos = todos.filter(todo => todo.text !== todoText); 
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
    loadTodos(); 
}


// --- 페이지 로드 시 실행 및 버튼 기능 ---
document.addEventListener('DOMContentLoaded', () => {
    setupSearch(); 
    loadGoal(); 
    loadTodos(); 
    renderUserShortcuts(); 
    loadSettings(); 
    
    // 페이지 로드 시 현재 날짜를 확인하여 혹시 지나쳤을 자정 리셋을 처리
    const now = new Date();
    const dateText = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
    checkAndResetTodos(dateText);

    const addTodoForm = document.getElementById('add-todo-form');
    const todoInput = document.getElementById('todo-input');
    
    const todoContainer = document.getElementById('todo-list-container');
    const todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    if (todos.length > 0) {
        // [수정] 초기 로드 시 내용이 있으면 display: block 설정
        todoContainer.style.display = 'block'; 
        todoContainer.classList.add('open');
    }
    const todoToggleButton = document.getElementById('todo-toggle-btn');
    
    const settingsPanel = document.getElementById('settings-panel');
    const settingsButton = document.getElementById('settings-btn');
    const closeSettingsButton = document.getElementById('close-settings-btn');
    const closeTodoListButton = document.getElementById('close-todoList-btn');
    const addUrlForm = document.getElementById('add-url-form'); 
    const urlInput = document.getElementById('url-input');
    
    const focusToggle = document.getElementById('focus-mode-toggle');
    const scheduleToggle = document.getElementById('focus-schedule-toggle'); 
    const focusStart = document.getElementById('focus-start-time');
    const focusEnd = document.getElementById('focus-end-time');

    // 💡 [제거됨] Blocker Action Listeners는 warning.js로 이동했습니다.
    /*
    document.getElementById('blocker-confirm-yes').addEventListener('click', ...);
    document.getElementById('blocker-confirm-no').addEventListener('click', ...);
    */


    // --- 이벤트 리스너 ---

    // ToDo
    addTodoForm.addEventListener('submit', function(event) {
        event.preventDefault(); 
        const todoText = todoInput.value.trim();
        
        if (todoText) {
            addTodo(todoText);
            todoInput.value = ''; 
        }
    });

    // URL
    addUrlForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const newUrl = urlInput.value.trim();
        if (newUrl) {
            addAccessibleUrl(newUrl);
            urlInput.value = '';
        }
    });
    
    // ToDo Toggle
    todoToggleButton.addEventListener('click', () => {

        const todoContainer = document.getElementById('todo-list-container');
        const isOpen = todoContainer.classList.contains('open');
        
        if (!isOpen) {
            // 열기: display를 먼저 block으로 설정
            todoContainer.style.display = 'block'; 
            // 다음 틱에 open 클래스 추가하여 슬라이드 인 애니메이션 실행
            setTimeout(() => todoContainer.classList.add('open'), 10);
        } else {
            // 닫기: open 클래스 제거하여 슬라이드 아웃 애니메이션 실행
            todoContainer.classList.remove('open');
            // 애니메이션 완료(300ms) 후 display: none 처리
            setTimeout(() => todoContainer.style.display = 'none', 300);
        }
    });
    
    // ToDo List Close 버튼
    closeTodoListButton.addEventListener('click', () => {
        const todoContainer = document.getElementById('todo-list-container');
        // 닫기: open 클래스 제거하여 슬라이드 아웃 애니메이션 실행
        todoContainer.classList.remove('open');
        // 애니메이션 완료(300ms) 후 display: none 처리
        setTimeout(() => todoContainer.style.display = 'none', 300);
    });
    
    // Settings Panel Toggle
    settingsButton.addEventListener('click', () => {
        const isOpen = settingsPanel.classList.contains('open');
        
        if (!isOpen) {
            loadAccessibleUrls(); 
            settingsPanel.style.display = 'block'; // 먼저 보이게 설정
            // 다음 틱에 transform 적용
            setTimeout(() => settingsPanel.classList.add('open'), 10); 
            loadSettings(); 
        } else {
            settingsPanel.classList.remove('open');
            // 애니메이션 완료 후 display: none 처리
            setTimeout(() => settingsPanel.style.display = 'none', 300); 
        }
    });

    // Settings Panel Close
    closeSettingsButton.addEventListener('click', () => {
        settingsPanel.classList.remove('open');
        setTimeout(() => settingsPanel.style.display = 'none', 300);
    });
    
    // Focus Mode 이벤트 리스너: 설정 변경 시 저장
    if (focusToggle && scheduleToggle) {
        focusToggle.addEventListener('change', saveFocusSettings);
        scheduleToggle.addEventListener('change', saveFocusSettings); 
        focusStart.addEventListener('change', saveFocusSettings);
        focusEnd.addEventListener('change', saveFocusSettings);
    }
});