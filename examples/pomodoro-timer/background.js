// KamoX Pomodoro Timer - Service Worker
// This Service Worker demonstrates:
// - chrome.alarms API for background timers
// - chrome.notifications for user alerts
// - chrome.storage for state persistence
// - Logging for KamoX dashboard monitoring

const POMODORO_DURATION = 25; // minutes
const ALARM_NAME = 'pomodoroTick';

// Service Worker lifecycle logging
console.log('[Pomodoro SW] Service Worker installed');

chrome.runtime.onInstalled.addListener((details) => {
    console.log('[Pomodoro SW] Extension installed/updated:', details.reason);

    // Initialize storage
    chrome.storage.local.set({
        isRunning: false,
        remainingMinutes: POMODORO_DURATION,
        totalSessions: 0
    });

    console.log('[Pomodoro SW] Storage initialized');
});

// Listen for messages from popup or KamoX wake-up
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Pomodoro SW] Message received:', message);

    if (message.type === 'KAMOX_WAKE_UP') {
        console.log('[Pomodoro SW] 🎯 Woke up by KamoX!');
        sendResponse({ success: true, message: 'Pomodoro SW is awake!' });
        return true;
    }

    if (message.action === 'start') {
        startTimer();
        sendResponse({ success: true });
    } else if (message.action === 'stop') {
        stopTimer();
        sendResponse({ success: true });
    } else if (message.action === 'reset') {
        resetTimer();
        sendResponse({ success: true });
    } else if (message.action === 'getState') {
        chrome.storage.local.get(['isRunning', 'remainingMinutes', 'totalSessions'], (data) => {
            sendResponse(data);
        });
        return true; // Keep channel open for async response
    }

    return true;
});

// Alarm listener - fires every minute when timer is running
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        console.log('[Pomodoro SW] ⏰ Alarm tick');
        handleTick();
    }
});

function startTimer() {
    console.log('[Pomodoro SW] ▶️ Starting timer');

    chrome.storage.local.get(['remainingMinutes'], (data) => {
        const remaining = data.remainingMinutes || POMODORO_DURATION;

        chrome.storage.local.set({ isRunning: true, remainingMinutes: remaining });

        // Create alarm that fires every minute
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });

        updateBadge(remaining);
        console.log(`[Pomodoro SW] Timer started with ${remaining} minutes remaining`);
    });
}

function stopTimer() {
    console.log('[Pomodoro SW] ⏸️ Stopping timer');

    chrome.alarms.clear(ALARM_NAME);
    chrome.storage.local.set({ isRunning: false });

    chrome.storage.local.get(['remainingMinutes'], (data) => {
        updateBadge(data.remainingMinutes);
    });
}

function resetTimer() {
    console.log('[Pomodoro SW] 🔄 Resetting timer');

    chrome.alarms.clear(ALARM_NAME);
    chrome.storage.local.set({
        isRunning: false,
        remainingMinutes: POMODORO_DURATION
    });

    updateBadge(POMODORO_DURATION);
}

function handleTick() {
    chrome.storage.local.get(['remainingMinutes', 'totalSessions'], (data) => {
        let remaining = data.remainingMinutes - 1;

        console.log(`[Pomodoro SW] Tick: ${remaining} minutes remaining`);

        if (remaining <= 0) {
            // Timer completed!
            console.log('[Pomodoro SW] 🎉 Pomodoro session completed!');

            chrome.alarms.clear(ALARM_NAME);

            const totalSessions = (data.totalSessions || 0) + 1;
            chrome.storage.local.set({
                isRunning: false,
                remainingMinutes: POMODORO_DURATION,
                totalSessions: totalSessions
            });

            // Show notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Pomodoro Complete! 🍅',
                message: `Great work! You've completed ${totalSessions} session(s). Time for a break!`,
                priority: 2
            });

            updateBadge('✓');

            // Clear badge after 3 seconds
            setTimeout(() => {
                updateBadge(POMODORO_DURATION);
            }, 3000);

        } else {
            chrome.storage.local.set({ remainingMinutes: remaining });
            updateBadge(remaining);
        }
    });
}

function updateBadge(text) {
    const badgeText = typeof text === 'number' ? `${text}m` : String(text);
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: '#FF6347' }); // Tomato red
    console.log(`[Pomodoro SW] Badge updated: ${badgeText}`);
}

// Log when Service Worker starts
console.log('[Pomodoro SW] Service Worker started and ready');

// Test error logging (commented out by default)
// setTimeout(() => {
//   console.error('[Pomodoro SW] Test error for KamoX dashboard');
//   throw new Error('Test exception from Service Worker');
// }, 5000);
