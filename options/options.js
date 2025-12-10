// options.js 파일 내용 (완전하고 통합된 로직)

const STORAGE_KEY = 'customNewTabAccessibleUrls';
const MAX_URLS = 10; 

document.addEventListener('DOMContentLoaded', () => {
    const urlDisplay = document.getElementById('url_display');
    const addButton = document.getElementById('add_url_button');
    const messageBox = document.getElementById('message_box');

    let currentUrl = null;

    // --- localStorage 헬퍼 함수 ---
    function getUrlsFromStorage() {
        try {
            const storedValue = localStorage.getItem(STORAGE_KEY);
            return JSON.parse(storedValue) || [];
        } catch (e) {
            console.error("Failed to parse URLs from localStorage:", e);
            return [];
        }
    }

    function saveUrlsToStorage(urls) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
            // newtab.js와 동기화를 위해 chrome.storage.local에도 저장합니다.
            chrome.storage.local.set({ [STORAGE_KEY]: urls }); 
            return true;
        } catch (e) {
            console.error("Failed to save URLs to localStorage:", e);
            return false;
        }
    }
    // ---------------------------------------------
    
    /**
     * 메시지를 표시하고 클래스를 적용하며 애니메이션을 실행하는 함수 (누락된 함수 1/2)
     */
    function showMessage(text, type, duration = 3000) {
        messageBox.textContent = text;
        messageBox.className = ''; 
        messageBox.style.color = ''; 
        
        if (type === 'success') {
            messageBox.classList.add('message-success', 'animate-pop');
        } else if (type === 'error') {
            messageBox.classList.add('message-error', 'animate-shake');
        } else {
            messageBox.classList.add('message-default');
        }

        if (duration > 0) {
            setTimeout(() => {
                messageBox.textContent = '';
                messageBox.className = '';
                messageBox.style.color = '';
            }, duration);
        }
    }

    /**
     * URL을 가공하여 프로토콜과 도메인까지만 남기고 저장합니다.
     */
    function processUrl(urlString) {
        try {
            const url = new URL(urlString);
            let base = `${url.protocol}//${url.host}`;
            
            if (!base.endsWith('/')) {
                base += '/';
            }
            return base; 
        } catch (e) {
            console.warn("URL 파싱 실패. 기본 처리 적용.", e);
            let simpleBase = urlString.split(/[?#]/)[0];
            
            if (!simpleBase.endsWith('/')) {
                simpleBase += '/';
            }
            return simpleBase;
        }
    }
    
    /**
     * 현재 탭의 URL을 가져와서 화면에 표시하는 함수 (누락된 함수 2/2)
     */
    function fetchAndDisplayUrl() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0 || !tabs[0].url) {
                urlDisplay.textContent = '❌ 활성 탭 정보를 가져올 수 없습니다.';
                addButton.disabled = true;
                return;
            }

            const tab = tabs[0];
            
            // 확장 프로그램 내부 페이지나 시스템 페이지는 차단
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('file://')) {
                urlDisplay.textContent = '❌ 확장 프로그램/내부 페이지는 추가할 수 없습니다.';
                addButton.disabled = true;
                return;
            }

            currentUrl = tab.url;
            urlDisplay.textContent = currentUrl;
            showMessage('URL을 목록에 추가하려면 버튼을 클릭하세요.', null, 0); 
        });
    }

    // 2. 버튼 클릭 이벤트 리스너
    addButton.addEventListener('click', () => {
        if (!currentUrl) {
            showMessage('추가할 유효한 URL이 없습니다.', 'error');
            return;
        }
        addButton.disabled = true;

        const normalizedUrl = processUrl(currentUrl); 
        const allowedUrls = getUrlsFromStorage();

        if (allowedUrls.length >= MAX_URLS) {
            showMessage(`🚫 허용 목록은 최대 ${MAX_URLS}개까지만 등록 가능합니다.`, 'error', 5000);
            addButton.disabled = false;
            return;
        }

        if (allowedUrls.includes(normalizedUrl)) {
            showMessage('🚫 이 URL은 이미 허용 목록에 있습니다.', 'error');
            addButton.disabled = false;
            return;
        }

        allowedUrls.push(normalizedUrl);
        const isSaved = saveUrlsToStorage(allowedUrls);
        
        if (isSaved) {
            showMessage(`✅ 다음 도메인이 성공적으로 허용 목록에 추가되었습니다: ${normalizedUrl}`, 'success', 5000); 
        } else {
            showMessage(`❌ 저장 오류가 발생했습니다.`, 'error', 5000);
        }

        addButton.disabled = false; 
    });
    
    // 1. 페이지 로드 시 URL 가져오기
    fetchAndDisplayUrl();
});