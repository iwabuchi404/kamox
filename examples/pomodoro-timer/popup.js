// Pomodoro Timer - Popup UI Controller

const timerDisplay = document.getElementById('timerDisplay');
const statusText = document.getElementById('status');
const sessionsCount = document.getElementById('sessionsCount');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');

// Update UI on load
updateUI();

// Auto-refresh UI every second
setInterval(updateUI, 1000);

// Button event listeners
startBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'start' }, () => {
        updateUI();
    });
});

stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stop' }, () => {
        updateUI();
    });
});

resetBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'reset' }, () => {
        updateUI();
    });
});

function updateUI() {
    chrome.runtime.sendMessage({ action: 'getState' }, (state) => {
        if (!state) return;

        const { isRunning, remainingMinutes, totalSessions } = state;

        // Update timer display
        timerDisplay.textContent = `${remainingMinutes}:00`;

        // Update status
        if (isRunning) {
            statusText.textContent = '⏱️ Focus time!';
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } else {
            statusText.textContent = remainingMinutes === 25 ? 'Ready to focus' : 'Paused';
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }

        // Update sessions count
        sessionsCount.textContent = totalSessions || 0;
    });
}
