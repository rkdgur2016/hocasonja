// background.js

// '예'를 눌렀을 때 브라우저 세션 동안 임시로 허용할 URL의 Hostname(도메인) 목록
// 예: ['youtube.com', 'google.com']
let tempSessionAllowList = []; 

// URL 허용 여부 검사 함수 (정식 허용 목록 + 임시 허용 목록 모두 검사)
function isUrlAllowed(targetUrl, allowList) {
    try {
        const urlObj = new URL(targetUrl);
        // www. 제거 후 호스트네임 추출
        const targetHost = urlObj.hostname.replace(/^www\./, ''); 
        const targetPath = urlObj.pathname.replace(/^\//, ''); // 첫 슬래시 제거

        // 1. 임시 세션 허용 목록 검사 (브라우저 종료 시까지 유지되는 허용)
        if (tempSessionAllowList.includes(targetHost)) {
            return true;
        }
        
        // 2. ✨ Google 검색 페이지 기본 허용 ✨
        // targetHost가 google 도메인이고, targetPath가 search로 시작하면 허용
        if (targetHost.includes('google.')) {
            return true;
        }

        // 3. 정식 허용 목록 (customNewTabAccessibleUrls) 검사
        return allowList.some(allowedUrl => {
            // 허용 목록 항목에서 프로토콜과 www.를 제거
            const cleanAllowed = allowedUrl
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/\/$/, ''); // 마지막 '/' 제거
            
            const allowedParts = cleanAllowed.split('/');
            const allowedHost = allowedParts[0];

            // 호스트네임 불일치 시 다음 항목 검사
            if (targetHost !== allowedHost) {
                return false;
            }

            // 4. 허용 항목이 도메인만 있는 경우 (예: "naver.com") 또는 복잡 경로 방지
            if (allowedParts.length === 1 || allowedParts.length === 2 && allowedParts[1] === '') { 
                
                // 도메인만 허용한 경우, 첫 번째 경로(path segment)까지만 허용
                const firstPathSegment = targetPath.split('/')[0];
                
                // 첫 경로가 비어있거나 ('/'), 'search', 'query', 'results' 등을 포함하는 경우 허용
                if (firstPathSegment === '' || firstPathSegment.includes('search') || firstPathSegment.includes('query') || firstPathSegment.includes('results')) {
                    return true;
                }
                
                // 그 외 일반적인 복잡 경로는 차단 (예: /videos/watch... )
                return targetPath === '';

            } 
            
            // 5. 허용 항목에 경로가 명시된 경우 (예: "youtube.com/channel")
            else {
                const allowedPath = allowedParts.slice(1).join('/'); // 호스트 이후의 경로
                
                // 허용된 경로가 타겟 URL 경로의 시작 부분과 일치하는지 확인
                return targetPath.startsWith(allowedPath);
            }
        });

    } catch (e) {
        // URL 형식이 이상하면 안전하게 차단
        return false;
    }
}

// 탭이 업데이트(이동)될 때마다 실행
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // URL이 변경되었을 때만 검사 (로딩 시작 시점)
    if (changeInfo.status === 'loading' && changeInfo.url) {
        checkAndBlockUrl(tabId, changeInfo.url);
    }
});

function checkAndBlockUrl(tabId, targetUrl) {
    // 1. 시스템 페이지 및 확장프로그램 내부 페이지는 검사 제외
    if (targetUrl.startsWith('chrome://') || targetUrl.startsWith('chrome-extension://') || targetUrl.startsWith('edge://')) {
        return;
    }

    // 2. 설정값 가져오기 (집중모드 여부, 허용 목록)
    chrome.storage.local.get(['isFocusModeOn', 'customNewTabAccessibleUrls'], (data) => {
        const isFocusMode = data.isFocusModeOn === 'on';
        const allowList = data.customNewTabAccessibleUrls || [];

        // 집중 모드가 꺼져있으면 통과
        if (!isFocusMode) return;

        // 3. 허용 목록 (정식 또는 임시)에 있는 URL이면 통과
        if (isUrlAllowed(targetUrl, allowList)) return;

        // 4. 위 조건에 해당 안 되면 -> 경고 페이지로 리다이렉트
        const warningUrl = chrome.runtime.getURL('popup/warning.html') + `?target=${encodeURIComponent(targetUrl)}`;
        
        // 현재 탭을 경고 페이지로 변경
        chrome.tabs.update(tabId, { url: warningUrl });
    });
}

// warning.js에서 보내는 메시지 수신 ('예' 버튼 클릭 시)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "allowAndRedirect") { 
        const tabId = sender.tab.id;
        const hostToAllowUrl = request.targetUrl;
        const originalUrl = request.originalUrl;
        
        let hostToAllow = '';

        try {
            // 🚨 수정된 안정화 로직: 프로토콜이 누락된 경우를 대비하여 http:// 를 붙여 안전하게 파싱 시도
            let safeUrl = hostToAllowUrl.startsWith('http') ? hostToAllowUrl : `http://${hostToAllowUrl}`;
            
            const urlObj = new URL(safeUrl);
            hostToAllow = urlObj.hostname.replace(/^www\./, '');
            
            // 1. 임시 허용 목록에 Hostname 추가
            if (hostToAllow && !tempSessionAllowList.includes(hostToAllow)) {
                tempSessionAllowList.push(hostToAllow);
                console.log(`[Focus Mode] Temporarily allowed host: ${hostToAllow}`);
            } else if (!hostToAllow) {
                throw new Error("Invalid host parsed.");
            }
            
            // 2. 임시 허용 처리가 완료된 후, 즉시 탭을 원래 URL로 업데이트 (리디렉션)
            chrome.tabs.update(tabId, { url: originalUrl }, (updatedTab) => {
                // 🚨 탭 업데이트 실패 시 chrome.runtime.lastError 확인 및 응답
                if (chrome.runtime.lastError || !updatedTab) {
                    console.error("Tab update failed:", chrome.runtime.lastError ? chrome.runtime.lastError.message : "Unknown error.");
                    sendResponse({ status: "error", message: "Tab update failed." }); 
                    return;
                }
                
                sendResponse({ status: "redirected" }); 
            });
            
        } catch (e) {
            console.error("Error in background listener (URL or Hostname issue):", e);
            sendResponse({ status: "error", message: "Internal URL parsing error." });
        }
        
        // 🚨 중요: 비동기 응답 처리를 명시
        return true; 
    }
    return false;
});