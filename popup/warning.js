document.addEventListener('DOMContentLoaded', () => {
    // 1. URL 쿼리 매개변수 파싱
    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = urlParams.get('target');
    
    // 💡 [ID 재확인] warning.html의 버튼 ID가 'confirm-yes'와 'confirm-no'인지 확인
    const blockedUrlDisplay = document.getElementById('blocked-url-display');
    const confirmYes = document.getElementById('confirm-yes'); 
    const confirmNo = document.getElementById('confirm-no'); 

    if (targetUrl) {
        blockedUrlDisplay.textContent = decodeURIComponent(targetUrl);
    } else {
        blockedUrlDisplay.textContent = '알 수 없는 URL';
    }

    // --- 이벤트 리스너 ---
    
    // [예, 접근합니다] 버튼 클릭 시: 원래 목표 URL로 이동
    confirmYes.addEventListener('click', () => {
        if (targetUrl) {
            // window.location.href 사용: 이 요청은 background.js가 차단하지 않습니다.
            window.location.href = decodeURIComponent(targetUrl);
        } else {
            // 💡 [경로 수정] 새 탭 페이지로 이동
            window.location.href = chrome.runtime.getURL('newtab.html');
        }
    });

    // [아니오, 돌아갑니다] 버튼 클릭 시: 이전 페이지로 복귀
    confirmNo.addEventListener('click', () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // 💡 [경로 수정] 새 탭 페이지로 이동
            window.location.href = chrome.runtime.getURL('newtab.html');
        }
    });
});