// warning.js

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = urlParams.get('target');
    
    if (!targetUrl) {
        // target URL이 없으면 새 탭 페이지로 이동
        chrome.tabs.update({ url: chrome.runtime.getURL('popup/newtab.html') }); 
        return;
    }

    const decodedUrl = decodeURIComponent(targetUrl);
    const urlDisplay = document.getElementById('blocked-url-display');
    
    if (urlDisplay) {
        urlDisplay.textContent = decodedUrl;
    }

    const confirmYesButton = document.getElementById('blocker-confirm-yes');
    const cancelButton = document.getElementById('blocker-cancel-no');

    // '예, 접근하겠습니다' 클릭 시: 원래 URL로 이동
    if (confirmYesButton) {
        confirmYesButton.addEventListener('click', () => {
            // 현재 탭의 URL을 원래 목표 URL로 변경
            chrome.tabs.update({ url: decodedUrl }); 
        });
    }

    // '아니요, 집중하겠습니다' 클릭 시: 새 탭 페이지로 리다이렉션
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            // 새 탭 페이지로 이동
            chrome.tabs.update({ url: chrome.runtime.getURL('popup/newtab.html') });
        });
    }
});