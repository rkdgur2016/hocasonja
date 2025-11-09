const MOTTO_KEY = 'focus_goal_motto';

        document.addEventListener('DOMContentLoaded', () => {
            const mottoTextElement = document.getElementById('goal-motto-text');
            const accessBtn = document.getElementById('access-btn');
            const backBtn = document.getElementById('back-btn');
            
            // 1. localStorage에서 문구 로드 및 표시
            const savedMotto = localStorage.getItem(MOTTO_KEY);
            if (savedMotto) {
                mottoTextElement.textContent = savedMotto;
            } else {
                mottoTextElement.textContent = "목표가 설정되지 않았습니다. 대시보드로 돌아가 설정하세요.";
                mottoTextElement.style.color = '#f87171'; // red-400
            }
            
            // 2. '돌아갈까요?' 버튼 이벤트
            backBtn.addEventListener('click', () => {
                // 메인 대시보드 페이지로 리디렉션
                window.location.href = './index.html';
            });
            
            // 3. '접근할까요?' 버튼 이벤트
            accessBtn.addEventListener('click', () => {
                // 경고를 무시하고 원래 가려던 페이지로 돌아가는 것을 시뮬레이션합니다.
                // 실제 확장 프로그램에서는 원래 URL로 리디렉션해야 하지만, 
                // 여기서는 시뮬레이션이므로 간단히 history back을 사용합니다.
                history.back(); 
            });

            // 참고: 실제 사용 시, 메인 대시보드(index.html)에서 
            // 목표 문구를 Firestore에 저장하는 것 외에 아래와 같이 localStorage에도 저장해야 이 페이지가 작동합니다.
            // localStorage.setItem(MOTTO_KEY, '사용자의 목표 문구');
        });