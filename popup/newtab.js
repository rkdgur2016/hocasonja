// --- 전역 상수 및 키 ---
const TODO_STORAGE_KEY = 'customNewTabTodos';
const GOAL_STORAGE_KEY = 'customNewTabGoal';
const ACCESSIBLE_URLS_KEY = 'customNewTabAccessibleUrls'; 
const LAST_RESET_DATE_KEY = 'todoLastResetDate';
const FOCUS_MODE_KEY = 'isFocusModeOn';
const FOCUS_START_TIME_KEY = 'focusStartTime';
const FOCUS_END_TIME_KEY = 'focusEndTime';

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
    
    // 유효성 검사
    if (start === -1 || end === -1) return false; 
    
    if (start === end) return false;

    if (start < end) {
        return current >= start && current < end; 
    } else {
        return current >= start || current < end;
    }
}

function checkFocusModeSchedule(currentTimeStr) {
    const start = localStorage.getItem(FOCUS_START_TIME_KEY);
    const end = localStorage.getItem(FOCUS_END_TIME_KEY);
    const toggle = document.getElementById('focus-mode-toggle');
    
    if (!toggle) return;

    // 1. 수동 모드 우선: 토글이 켜져 있으면 수동 상태를 유지합니다.
    if (toggle.checked && localStorage.getItem(FOCUS_MODE_KEY) === 'on') {
         setFocusModeState(true, true);
         return;
    }
    
    // 2. 스케줄 확인
    if (start && end) {
        const isActive = isTimeBetween(start, end, currentTimeStr);
        
        // 스케줄에 의해 강제로 상태를 덮어씁니다.
        if (isActive) {
             setFocusModeState(true, false); 
        } else {
             // 비활성화 시간이 되면 수동 토글 상태와 상관없이 'off'로 설정합니다.
             setFocusModeState(false, false); 
        }
    } else {
        // 스케줄이 설정되지 않은 경우, 수동 토글 상태만 따릅니다.
        setFocusModeState(toggle.checked, true);
    }
}

function setFocusModeState(state, isManual) {
    const body = document.body;
    const indicator = document.querySelector('.focus-mode-indicator');
    const toggle = document.getElementById('focus-mode-toggle');
    
    // 상태를 localStorage에 저장
    localStorage.setItem(FOCUS_MODE_KEY, state ? 'on' : 'off');
    
    if (state) {
        body.classList.add('focus-mode');
        indicator.style.display = 'block';
    } else {
        body.classList.remove('focus-mode');
        indicator.style.display = 'none';
    }
    
    // 토글 UI 업데이트
    if (toggle && isManual) {
        toggle.checked = state;
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

// --- 설정 로드 및 저장 ---
function loadSettings() {
    // 1. Focus Mode Settings
    const isFocusOn = localStorage.getItem(FOCUS_MODE_KEY) === 'on';
    const startTime = localStorage.getItem(FOCUS_START_TIME_KEY) || '09:00';
    const endTime = localStorage.getItem(FOCUS_END_TIME_KEY) || '17:00';
    
    const toggle = document.getElementById('focus-mode-toggle');
    const startInput = document.getElementById('focus-start-time');
    const endInput = document.getElementById('focus-end-time');

    if (toggle) toggle.checked = isFocusOn;
    if (startInput) startInput.value = startTime;
    if (endInput) endInput.value = endTime;

    // UI 초기 상태 반영
    setFocusModeState(isFocusOn, true);
}

function saveFocusSettings() {
    const toggle = document.getElementById('focus-mode-toggle');
    const startInput = document.getElementById('focus-start-time');
    const endInput = document.getElementById('focus-end-time');
    
    if (!toggle || !startInput || !endInput) return;

    // 수동 토글 상태 저장
    const isManualOn = toggle.checked;
    localStorage.setItem(FOCUS_MODE_KEY, isManualOn ? 'on' : 'off');
    
    // 시간 저장
    localStorage.setItem(FOCUS_START_TIME_KEY, startInput.value);
    localStorage.setItem(FOCUS_END_TIME_KEY, endInput.value);
    
    // 상태 즉시 적용
    setFocusModeState(isManualOn, true);
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
                searchForm.submit();
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
                searchForm.submit(); 
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
            if (!query.startsWith('http://') && !query.startsWith('https://')) {
                query = 'http://' + query;
            }
            window.location.href = query;
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
         goalTextElement.textContent = "🔥 오늘 당신의 목표 문구를 입력하세요. 🔥";
    }

    goalTextElement.addEventListener('click', () => {
        const currentText = goalTextElement.textContent;
        const input = document.createElement('input');
        
        input.type = 'text';
        input.value = (currentText === "🔥 오늘 당신의 목표 문구를 입력하세요. 🔥") ? "" : currentText;
        input.id = 'goal-input-editor';
        
        goalTextElement.parentNode.replaceChild(input, goalTextElement);
        input.focus();

        const saveGoal = () => {
            const newGoal = input.value.trim() || "🔥 오늘 당신의 목표 문구를 입력하세요. 🔥";
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
        a.href = url;
        a.classList.add('shortcut-icon', 'user-shortcut-icon');
        a.target = "_self"; // 현재 탭에서 열기
        
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

        userShortcutsList.appendChild(a);
    });
}


// --- 접근 가능 URL 기능 ---
function updateAccessibleUrl(oldUrl, newUrl) {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    
    // http/https 접두사 보장
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
        newUrl = 'https://' + newUrl;
    }
    
    if (newUrl === oldUrl) return; 

    if (urls.includes(newUrl)) {
        // 커스텀 알림/모달로 대체 권장
        alert("이미 등록된 URL입니다.");
        return;
    }

    const index = urls.indexOf(oldUrl);
    if (index !== -1) {
        urls[index] = newUrl;
        localStorage.setItem(ACCESSIBLE_URLS_KEY, JSON.stringify(urls));
        loadAccessibleUrls();
        renderUserShortcuts();
    }
}


function loadAccessibleUrls() {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    const listContainer = document.getElementById('accessible-urls-list');
    listContainer.innerHTML = ''; 

    if (urls.length === 0) {
        listContainer.innerHTML = '<p class="setting-desc" style="color:#aaa;">등록된 웹사이트가 없습니다.</p>';
        return;
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

function addAccessibleUrl(newUrl) {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
        newUrl = 'https://' + newUrl;
    }
    
    if (urls.includes(newUrl)) {
        alert("이미 등록된 URL입니다.");
        return;
    }

    urls.push(newUrl);
    localStorage.setItem(ACCESSIBLE_URLS_KEY, JSON.stringify(urls));
    loadAccessibleUrls();
    renderUserShortcuts(); 
}

function deleteAccessibleUrl(urlToDelete) {
    let urls = JSON.parse(localStorage.getItem(ACCESSIBLE_URLS_KEY) || '[]');
    urls = urls.filter(url => url !== urlToDelete);
    localStorage.setItem(ACCESSIBLE_URLS_KEY, JSON.stringify(urls));
    loadAccessibleUrls();
    renderUserShortcuts(); 
}


// --- 할 일 목록 기능 ---
function loadTodos() {
    let todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    
    todos.sort((a, b) => a.completed - b.completed); 

    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = ''; 

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

function addTodo(todoText) {
    const todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
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
    const todoToggleButton = document.getElementById('todo-toggle-btn');
    
    const settingsPanel = document.getElementById('settings-panel');
    const settingsButton = document.getElementById('settings-btn');
    const closeSettingsButton = document.getElementById('close-settings-btn');
    
    const addUrlForm = document.getElementById('add-url-form'); 
    const urlInput = document.getElementById('url-input');
    
    const focusToggle = document.getElementById('focus-mode-toggle');
    const focusStart = document.getElementById('focus-start-time');
    const focusEnd = document.getElementById('focus-end-time');

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
        const isHidden = window.getComputedStyle(todoContainer).display === 'none';
        todoContainer.style.display = isHidden ? 'block' : 'none'; 
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
    if (focusToggle) {
        focusToggle.addEventListener('change', saveFocusSettings);
        focusStart.addEventListener('change', saveFocusSettings);
        focusEnd.addEventListener('change', saveFocusSettings);
    }
});