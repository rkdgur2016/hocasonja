// warning.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. URL 파라미터에서 원래 가려던 URL (target)을 가져옴
    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = urlParams.get('target');
    
    // 2. HTML 요소 가져오기
    const blockedUrlDisplay = document.getElementById('blocked-url-display');
    const confirmYes = document.getElementById('confirm-yes'); // '예, 접근합니다' 버튼 ID
    const confirmNo = document.getElementById('confirm-no');  // '아니오, 돌아갑니다' 버튼 ID

    // 필수 요소가 없으면 오류 로그를 남기고 종료 (디버깅 목적)
    if (!confirmYes || !confirmNo) {
        console.error("Critical Error: 'confirm-yes' or 'confirm-no' button ID not found in warning.html.");
        return; 
    }

    // 3. 화면에 차단된 URL 표시
    if (targetUrl && blockedUrlDisplay) {
        blockedUrlDisplay.textContent = decodeURIComponent(targetUrl);
    } else if (blockedUrlDisplay) {
        blockedUrlDisplay.textContent = '알 수 없는 URL';
    }

    // 4. [예, 접근합니다] 버튼 클릭 시 (브라우저 종료 시까지 도메인 허용)
    confirmYes.addEventListener('click', () => {
        if (targetUrl) {
            const decodedUrl = decodeURIComponent(targetUrl);
            let urlToAllow;
            
            try {
                // 1. URL 객체 생성 시도
                const urlObj = new URL(decodedUrl);
                urlToAllow = urlObj.origin + '/'; 
            } catch (e) {
                // 2. 파싱 실패 시 (예: 'google.com'만 입력된 경우)
                console.warn("URL parsing failed, attempting simple host extraction:", e);
                
                // 임시로 http://를 붙여서 호스트네임만 추출하여 임시 허용 요청
                try {
                    const tempUrl = decodedUrl.startsWith('http') ? decodedUrl : `http://${decodedUrl}`;
                    const tempObj = new URL(tempUrl);
                    urlToAllow = tempObj.origin + '/'; 
                } catch (e2) {
                    console.error("Simple host extraction failed:", e2);
                    return; // 완전히 실패하면 함수 종료
                }
            }

            // 3. background.js에 메시지 전송
            chrome.runtime.sendMessage({ 
                action: "allowAndRedirect", 
                targetUrl: urlToAllow,      // 임시 허용할 도메인 (Origin 포함)
                originalUrl: decodedUrl     // 실제로 이동할 최종 URL
            }, (response) => {
                
                // 4. background.js에서 응답이 오면
                if (chrome.runtime.lastError) {
                    console.error("Runtime Error:", chrome.runtime.lastError.message);
                    alert("통신 오류: 백그라운드 스크립트가 응답하지 않습니다.");
                    return;
                }
                
                if (response && response.status === "redirected") {
                    console.log("페이지 이동 요청 성공.");
                } else {
                    alert('임시 허용 처리 중 오류가 발생했습니다. (백그라운드 오류)');
                    console.error("Background failed to redirect:", response);
                }
            });
        }
    });

    // 5. [아니오, 돌아갑니다] 버튼 클릭 시 (무한 루프 방지)
    confirmNo.addEventListener('click', () => {
        // 무한 루프를 막기 위해, history.back() 대신 안전한 새 탭으로 이동
        window.location.href = chrome.runtime.getURL('popup/newtab.html');
    });
});