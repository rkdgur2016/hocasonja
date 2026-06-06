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
            let data = JSON.parse(storedValue) || [];
            
            // [마이그레이션] 이전 단순 URL 문자열 배열을 구조화된 단축키 객체 배열로 호환
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
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            }
            return data;
        } catch (e) {
            console.error("Failed to parse URLs from localStorage:", e);
            return [];
        }
    }

    function saveUrlsToStorage(shortcuts) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
            
            // 평탄화 작업 후 chrome.storage.local 에 동기화하여 백그라운드 스크립트와의 호환성 유지
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
            chrome.storage.local.set({ [STORAGE_KEY]: flatUrls }); 
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

        // 중복 검사 (루트 및 폴더 내부 전체 검사)
        let exists = false;
        allowedUrls.forEach(item => {
            if (item.type === 'link' && item.url === normalizedUrl) exists = true;
            else if (item.type === 'folder' && item.children) {
                if (item.children.some(c => c.url === normalizedUrl)) exists = true;
            }
        });

        if (exists) {
            showMessage('🚫 이 URL은 이미 허용 목록에 있습니다.', 'error');
            addButton.disabled = false;
            return;
        }

        let name = '';
        try {
            const u = new URL(normalizedUrl);
            name = u.hostname.replace('www.', '').split('.')[0];
            name = name.charAt(0).toUpperCase() + name.slice(1);
        } catch(e) {
            name = 'Link';
        }

        allowedUrls.push({
            id: 'link_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            type: 'link',
            name: name,
            url: normalizedUrl
        });

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