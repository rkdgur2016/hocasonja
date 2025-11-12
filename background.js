// background.js

const FOCUS_MODE_KEY = 'isFocusModeOn'; 
const ACCESSIBLE_URLS_KEY = 'customNewTabAccessibleUrls';

// 스토리지 상태를 캐싱하여 onBeforeRequest에서 동기적으로 접근 가능하게 합니다.
let focusCache = { isFocusOn: false, urls: [] };

// 1. 초기 로드 및 상태 변경 리스너 설정
function loadFocusSettings() {
    chrome.storage.local.get([FOCUS_MODE_KEY, ACCESSIBLE_URLS_KEY], function(data) {
        focusCache.isFocusOn = data[FOCUS_MODE_KEY] === 'on';
        focusCache.urls = data[ACCESSIBLE_URLS_KEY] || [];
    });
}
// 확장 프로그램 시작 시 초기 상태 로드
loadFocusSettings();

// newtab.js 등에서 상태가 변경될 때마다 캐시를 업데이트합니다.
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local') {
        if (changes[FOCUS_MODE_KEY]) {
            focusCache.isFocusOn = changes[FOCUS_MODE_KEY].newValue === 'on';
        }
        if (changes[ACCESSIBLE_URLS_KEY]) {
            focusCache.urls = changes[ACCESSIBLE_URLS_KEY].newValue || [];
        }
    }
});

// 2. 웹 요청 리스너: 요청을 가로채서 리다이렉션합니다.
chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        const targetUrl = details.url;
        
        // 1. 집중 모드 OFF 확인
        if (!focusCache.isFocusOn) {
            return { cancel: false };
        }
        
        // 2. 내부 크롬 페이지, 데이터 URL, 파일 등은 무시
        if (targetUrl.startsWith('chrome://') || targetUrl.startsWith('data:') || details.tabId === -1) {
            return { cancel: false };
        }
        
        // 3. 현재 탭이 이미 경고 페이지라면 무시 (무한 루프 방지)
        if (targetUrl.includes(chrome.runtime.getURL('warning.html'))) {
            return { cancel: false };
        }

        // 4. 호스트네임 추출 및 허용 목록 확인
        let urlHostname;
        try {
            // 호스트네임만 추출하여 'www.' 제거 후 비교
            urlHostname = new URL(targetUrl).hostname.replace(/^www\./, '');
        } catch (e) {
            return { cancel: false }; // 유효하지 않은 URL은 무시
        }

        const isAllowed = focusCache.urls.some(allowedUrl => {
            // 저장된 호스트네임과 비교
            return urlHostname === allowedUrl.replace(/^www\./, '');
        });

        if (isAllowed) {
            return { cancel: false }; // 허용 목록에 있음: 접근 허용
        } 
        
        // 5. 허용 목록에 없음: 경고 페이지로 리다이렉션
        
        // 인코딩된 URL을 경고 페이지로 전달
        const encodedUrl = encodeURIComponent(targetUrl);
        const warningPageUrl = chrome.runtime.getURL(`warning.html?target=${encodedUrl}`);
        
        // 💡 리다이렉션
        return { redirectUrl: warningPageUrl };
    },
    // 필터링: 모든 http/https 요청을 감시
    { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
    // 옵션: blocking을 사용해야 redirectUrl이 작동합니다.
    ["blocking"]
);