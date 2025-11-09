// --- 전역 상수 및 키 ---
const TODO_STORAGE_KEY = 'customNewTabTodos';
const GOAL_STORAGE_KEY = 'customNewTabGoal';
const BACKGROUND_STORAGE_KEY = 'customNewTabBackgroundUrl'; 


// --- 시간 및 날짜 기능 ---
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
    
    document.getElementById('time').textContent = `${hours}:${minutes}:${seconds}`;
}
setInterval(updateTime, 1000);
updateTime();


// --- Helper Functions ---
// 디바운스 함수 (입력 속도가 빨라도 API 호출 빈도를 낮춤)
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

    // --- 1. 자동 완성 API 호출 로직 ---
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
    
    
    // --- 2. 목록 표시 및 항목 클릭 처리 ---
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
    
    // --- 3. 키보드 네비게이션 (방향키, Enter) ---
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
                e.preventDefault();
                items[currentFocus].click(); 
            } else {
                searchForm.submit(); 
            }
        }
    });

    // --- 4. 검색 폼 제출 (기존 로직 유지) ---
    searchForm.addEventListener('submit', function(event) {
        event.preventDefault(); 
        let query = searchInput.value.trim();
        if (query === "") return; 

        // URL 형식 검사 및 이동
        const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
        if (urlRegex.test(query)) {
            if (!query.startsWith('http://') && !query.startsWith('https://')) {
                query = 'http://' + query;
            }
            window.location.href = query;
        } else {
            this.submit(); 
        }
    });
    
    // 포커스 아웃 시 자동 완성 숨기기
    document.addEventListener('click', function(e) {
        if (e.target.id !== 'search-input' && !e.target.classList.contains('autocomplete-item')) {
            hideAutocomplete();
        }
    });
    
    // --- Helper Functions for Autocomplete ---
    function setActive(items) {
        items.forEach(item => item.classList.remove('active'));
        if (currentFocus > -1 && currentFocus < items.length) {
            items[currentFocus].classList.add('active');
            searchInput.value = items[currentFocus].textContent;
        }
    }
}


// --- 목표 문구 기능 (수정 없음) ---
function loadGoal() {
    const goalTextElement = document.getElementById('goal-text');
    const savedGoal = localStorage.getItem(GOAL_STORAGE_KEY);
    
    if (savedGoal) {
        goalTextElement.textContent = savedGoal;
    } 

    goalTextElement.addEventListener('click', () => {
        const currentText = goalTextElement.textContent;
        const input = document.createElement('input');
        
        input.type = 'text';
        input.value = currentText;
        input.id = 'goal-input-editor'; // ⭐️ CSS가 이 ID를 사용하여 스타일을 확대 적용합니다. ⭐️
        
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


// --- 배경 이미지 설정 기능 ---
function applyBackground(url) {
    if (url) {
        document.documentElement.style.setProperty('--bg-image', `url("${url}")`);
        localStorage.setItem(BACKGROUND_STORAGE_KEY, url);
    } else {
        document.documentElement.style.removeProperty('--bg-image');
        localStorage.removeItem(BACKGROUND_STORAGE_KEY);
    }
}

function loadBackground() {
    const savedUrl = localStorage.getItem(BACKGROUND_STORAGE_KEY);
    if (savedUrl) {
        applyBackground(savedUrl);
    }
}


// --- 할 일 목록 기능 ---

function loadTodos() {
    let todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    
    const todoContainer = document.getElementById('todo-list-container');
    
    if (todos.length > 0) {
        todoContainer.style.display = 'block'; 
    } else {
        todoContainer.style.display = 'none';
    }
    
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
    loadBackground(); 
    setupSearch(); 
    loadGoal(); 
    loadTodos(); 

    const addTodoForm = document.getElementById('add-todo-form');
    const todoInput = document.getElementById('todo-input');
    
    const todoContainer = document.getElementById('todo-list-container');
    const closeTodoBtn = document.getElementById('close-todo-btn');
    const todoToggleButton = document.getElementById('todo-toggle-btn');
    
    const settingsPanel = document.getElementById('settings-panel');
    const settingsButton = document.getElementById('settings-btn');
    const closeSettingsButton = document.getElementById('close-settings-btn');
    const backgroundUrlInput = document.getElementById('background-url-input');
    const saveBackgroundButton = document.getElementById('save-background-btn');


    // 할 일 추가 폼 제출 이벤트
    addTodoForm.addEventListener('submit', function(event) {
        event.preventDefault(); 
        const todoText = todoInput.value.trim();
        
        if (todoText) {
            addTodo(todoText);
            todoInput.value = ''; 
        }
    });
    
    // 할 일 목록 닫기 버튼 기능
    closeTodoBtn.addEventListener('click', () => {
        todoContainer.style.display = 'none';
    });
    
    // 할 일 토글 버튼 기능
    todoToggleButton.addEventListener('click', () => {
        const isHidden = window.getComputedStyle(todoContainer).display === 'none';
        todoContainer.style.display = isHidden ? 'block' : 'none'; 
    });
    
    // 설정 버튼 클릭 시: 패널 보이기
    settingsButton.addEventListener('click', () => {
        backgroundUrlInput.value = localStorage.getItem(BACKGROUND_STORAGE_KEY) || '';
        settingsPanel.style.display = 'block';
    });

    // 설정 패널 닫기 버튼
    closeSettingsButton.addEventListener('click', () => {
        settingsPanel.style.display = 'none';
    });
    
    // 배경 적용 버튼 클릭 시
    saveBackgroundButton.addEventListener('click', () => {
        const url = backgroundUrlInput.value.trim();
        if (url) {
            applyBackground(url);
            settingsPanel.style.display = 'none';
        } else {
            applyBackground(null);
            settingsPanel.style.display = 'none';
            alert("배경이 기본 이미지로 초기화되었습니다.");
        }
    });
});