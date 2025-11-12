// background.js (이전 코드를 기반으로 경로 불일치 문제 해결을 위해 재구성)

const FOCUS_MODE_KEY = 'isFocusModeOn';
const ACCESSIBLE_URLS_KEY = 'customNewTabAccessibleUrls';

// 웹 요청을 감시하고 처리하는 함수
function handleWebRequest(details) {
    // onBeforeRequest는 동기적으로 작동해야 하므로, Promise 대신 동기적인 캐싱을 사용했으나,
    // 현재 코드는 Promise를 사용하고 있으므로 비동기 코드를 유지하고 권한 문제를 해결합니다.

    return new Promise((resolve) => {
        chrome.storage.local.get([FOCUS_MODE_KEY], function(data) {
            const isFocusModeOn = data[FOCUS_MODE_KEY] === 'on';

            // 1. 집중 모드가 꺼져 있거나, 크롬 내부 페이지, 이미 경고 페이지인 경우 통과
            if (!isFocusModeOn || details.tabId === -1 || details.url.startsWith('chrome://') || details.url.includes(chrome.runtime.getURL('warning.html'))) {
                return resolve({ cancel: false });
            }

            // 2. 허용 목록을 가져와 URL을 검사합니다.
            chrome.storage.local.get([ACCESSIBLE_URLS_KEY], function(data) {
                const allowedUrls = JSON.parse(data[ACCESSIBLE_URLS_KEY] || '[]');
                const targetUrl = details.url;

                // 3. URL 검사 로직
                const isAllowed = allowedUrls.some(allowedUrl => {
                    const allowedHostname = getHostname(allowedUrl);
                    const targetHostname = getHostname(targetUrl);
                    return allowedHostname && targetHostname === allowedHostname;
                });
                
                // 4. 요청 처리
                if (isAllowed) {
                    resolve({ cancel: false }); // 허용된 URL이면 통과
                } else {
                    // 💡 [경로 수정] warning.html로 리다이렉트
                    // newtab.html이 루트 폴더에 있다고 가정합니다.
                    const redirectUrl = chrome.runtime.getURL(`warning.html?target=${encodeURIComponent(targetUrl)}&tabId=${details.tabId}`);
                    
                    // 요청 차단 및 리다이렉트
                    resolve({ redirectUrl: redirectUrl });
                }
            });
        });
    });
}

// URL에서 호스트네임을 가져오는 헬퍼 함수
function getHostname(url) {
    try {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
        return null; 
    }
}

// 웹 요청 리스너 등록
chrome.webRequest.onBeforeRequest.addListener(
    handleWebRequest,
    { urls: ["<all_urls>"], types: ["main_frame"] },
    ["blocking", "requestBody"] // requestBody는 POST 요청을 가로챌 때 필요할 수 있습니다.
);