// background.js

// '예'를 눌렀을 때 잠시 허용해줄 URL을 저장하는 메모리 (탭 ID 기준)
let tempAllowedTargets = {}; 

// URL 허용 여부 검사 함수
function isUrlAllowed(url, allowList) {
    try {
        const hostname = new URL(url).hostname;
        return allowList.some(allowedUrl => {
            // www 제거 및 프로토콜 제거 후 포함 여부 확인
            const cleanAllowed = allowedUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
            return hostname.includes(cleanAllowed);
        });
    } catch (e) {
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

        // 3. 허용 목록에 있는 URL이면 통과
        if (isUrlAllowed(targetUrl, allowList)) return;

        // 4. 방금 '예'를 눌러서 임시 허용된 URL인지 확인
        if (tempAllowedTargets[tabId] === targetUrl) {
            delete tempAllowedTargets[tabId]; // 티켓 사용 완료 (1회용)
            return; 
        }

        // 5. 위 조건에 해당 안 되면 -> 경고 페이지로 리다이렉트
        // 🚨 경로 주의: popup 폴더 안의 파일을 가리킴
        const warningUrl = chrome.runtime.getURL('popup/warning.html') + `?target=${encodeURIComponent(targetUrl)}`;
        
        // 현재 탭을 경고 페이지로 변경
        chrome.tabs.update(tabId, { url: warningUrl });
    });
}

// warning.js에서 보내는 메시지 수신 ('예' 버튼 클릭 시)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "allowTempUrl") {
        const tabId = sender.tab.id; // 메시지를 보낸 탭의 ID
        const targetUrl = request.targetUrl;

        // 해당 탭에 대해서만 이 URL을 임시 허용 목록에 등록
        tempAllowedTargets[tabId] = targetUrl;
        
        sendResponse({ status: "success" });
    }
    return true; // 비동기 응답을 위해 true 반환
});

/**
 * // 1회성 임시 허용 티켓 (탭 ID 기준)
let tempAllowedTargets = {};

// URL 검사 함수
function isUrlAllowed(url, allowList) {
    try {
        const hostname = new URL(url).hostname;
        // 등록된 도메인이 포함되어 있는지 확인 (예: 'google.com'이 있으면 'www.google.com' 허용)
        return allowList.some(allowed => hostname.includes(allowed));
    } catch (e) {
        return false;
    }
}

// 탭 이동 감지
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && changeInfo.url) {
        checkAndBlock(tabId, changeInfo.url);
    }
});

function checkAndBlock(tabId, targetUrl) {
    // 크롬 내부 페이지는 무시
    if (targetUrl.startsWith('chrome://') || targetUrl.startsWith('edge://')) return;

    // 설정값 불러오기
    chrome.storage.local.get(['focusMode', 'allowList'], (data) => {
        const isFocusMode = data.focusMode === true;
        const allowList = data.allowList || [];

        // 1. 집중모드 꺼져있으면 통과
        if (!isFocusMode) return;

        // 2. 허용 목록에 있으면 통과
        if (isUrlAllowed(targetUrl, allowList)) return;

        // 3. 방금 '예'를 눌러서 허용된 탭인지 확인
        if (tempAllowedTargets[tabId] === targetUrl) {
            delete tempAllowedTargets[tabId]; // 티켓 사용 후 삭제
            return;
        }

        // 4. 차단 -> 경고 페이지로 이동
        const warningUrl = chrome.runtime.getURL('warning.html') + `?target=${encodeURIComponent(targetUrl)}`;
        chrome.tabs.update(tabId, { url: warningUrl });
    });
}

// 경고창에서 온 메시지 수신 ('예' 눌렀을 때)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "allowTemp") {
        const tabId = sender.tab.id;
        tempAllowedTargets[tabId] = request.url; // 티켓 발급
        sendResponse({ status: "ok" });
    }
    return true;
});
 */