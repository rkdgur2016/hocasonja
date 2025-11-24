// warning.js

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = urlParams.get('target');
    
    const blockedUrlDisplay = document.getElementById('blocked-url-display');
    const confirmYes = document.getElementById('confirm-yes'); 
    const confirmNo = document.getElementById('confirm-no'); 

    // 화면에 차단된 URL 표시
    if (targetUrl) {
        blockedUrlDisplay.textContent = decodeURIComponent(targetUrl);
    } else {
        blockedUrlDisplay.textContent = '알 수 없는 URL';
    }

    // [예, 접근합니다] 버튼 클릭 시
    confirmYes.addEventListener('click', () => {
        if (targetUrl) {
            const decodedUrl = decodeURIComponent(targetUrl);
            
            // 1. background.js에 "이 URL 잠시만 허용해줘"라고 메시지 보냄
            chrome.runtime.sendMessage({ 
                action: "allowTempUrl", 
                targetUrl: decodedUrl 
            }, (response) => {
                // 2. 허용 처리가 완료되면 이동
                if (response && response.status === "success") {
                    window.location.href = decodedUrl;
                }
            });
        } else {
            window.location.href = chrome.runtime.getURL('newtab.html');
        }
    });

    // [아니오, 돌아갑니다] 버튼 클릭 시
    confirmNo.addEventListener('click', () => {
        // 이전 페이지 기록이 있으면 뒤로가기 (원래 페이지로 복귀)
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // 기록이 없으면(새 탭에서 바로 친 경우 등) 안전한 새 탭으로 이동
            window.location.href = chrome.runtime.getURL('newtab.html');
        }
    });
});