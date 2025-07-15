class PomodoroServiceWorker {
    constructor() {
        this.setupMessageListener();
        this.setupAlarmListener();
        this.initializeTimer();
    }

    initializeTimer() {
        chrome.storage.local.get([
            'focusTime', 'breakTime', 'longBreakTime', 'sessionsCount',
            'currentSession', 'totalSessions', 'timeLeft', 'currentPhase',
            'isRunning', 'isPaused', 'autoStart'
        ], (result) => {
            this.settings = {
                focusTime: result.focusTime || 25,
                breakTime: result.breakTime || 5,
                longBreakTime: result.longBreakTime || 15,
                sessionsCount: result.sessionsCount || 4,
                autoStart: result.autoStart || false
            };

            this.state = {
                currentSession: result.currentSession || 1,
                totalSessions: result.totalSessions || this.settings.sessionsCount,
                timeLeft: result.timeLeft || (this.settings.focusTime * 60),
                currentPhase: result.currentPhase || 'focus',
                isRunning: result.isRunning || false,
                isPaused: result.isPaused || false
            };

            this.saveState();
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'startTimer':
                    this.startTimer();
                    sendResponse({ success: true });
                    break;
                case 'pauseTimer':
                    this.pauseTimer();
                    sendResponse({ success: true });
                    break;
                case 'resetTimer':
                    this.resetTimer();
                    sendResponse({ success: true });
                    break;
                case 'updateSettings':
                    this.updateSettings(request.settings);
                    sendResponse({ success: true });
                    break;
            }
            return true;
        });
    }

    setupAlarmListener() {
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'pomodoroTick') {
                this.tick();
            }
        });
    }

    startTimer() {
        if (!this.state.isRunning) {
            this.state.isRunning = true;
            this.state.isPaused = false;
            
            // Create alarm that fires every second
            chrome.alarms.create('pomodoroTick', { periodInMinutes: 1/60 });
            
            this.updateBadge();
            this.saveState();
            
            const phaseText = this.state.currentPhase === 'focus' ? 'Focus session' : 'Break time';
            this.showNotification(`${phaseText} started!`, `Session ${this.state.currentSession} of ${this.state.totalSessions}`);
        }
    }

    pauseTimer() {
        if (this.state.isRunning) {
            this.state.isRunning = false;
            this.state.isPaused = true;
            
            chrome.alarms.clear('pomodoroTick');
            this.updateBadge();
            this.saveState();
            
            this.showNotification('Timer paused', 'Click to resume when ready');
        }
    }

    resetTimer() {
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.state.currentSession = 1;
        this.state.currentPhase = 'focus';
        this.state.timeLeft = this.settings.focusTime * 60;
        
        chrome.alarms.clear('pomodoroTick');
        this.updateBadge();
        this.saveState();
        
        this.showNotification('Timer reset', 'Ready for a new session');
    }

    tick() {
        if (!this.state.isRunning) return;

        this.state.timeLeft--;
        this.updateBadge();
        this.saveState();

        if (this.state.timeLeft <= 0) {
            this.handlePhaseComplete();
        }
    }

    handlePhaseComplete() {
        chrome.alarms.clear('pomodoroTick');

        if (this.state.currentPhase === 'focus') {
            // Focus session completed
            this.showNotification(
                '🎉 Focus session completed!', 
                `Great job! Session ${this.state.currentSession} done.`
            );

            // Determine break type
            const isLongBreak = this.state.currentSession % 4 === 0;
            this.state.currentPhase = isLongBreak ? 'longBreak' : 'shortBreak';
            this.state.timeLeft = isLongBreak ? 
                this.settings.longBreakTime * 60 : 
                this.settings.breakTime * 60;

            if (this.settings.autoStart) {
                this.state.isRunning = true;
                chrome.alarms.create('pomodoroTick', { periodInMinutes: 1/60 });
                
                const breakType = isLongBreak ? 'Long break' : 'Short break';
                this.showNotification(`${breakType} started automatically`, 'Time to relax!');
            } else {
                this.state.isRunning = false;
                const breakType = isLongBreak ? 'long break' : 'short break';
                this.showNotification(`Time for a ${breakType}!`, 'Click start when ready');
            }

        } else {
            // Break completed
            const breakType = this.state.currentPhase === 'longBreak' ? 'Long break' : 'Short break';
            this.showNotification(`${breakType} finished!`, 'Ready for the next session?');

            this.state.currentSession++;
            
            if (this.state.currentSession > this.state.totalSessions) {
                // All sessions completed
                this.showNotification(
                    '🏆 All sessions completed!', 
                    `Congratulations! You completed ${this.state.totalSessions} focus sessions.`
                );
                this.resetTimer();
                return;
            }

            // Prepare next focus session
            this.state.currentPhase = 'focus';
            this.state.timeLeft = this.settings.focusTime * 60;

            if (this.settings.autoStart) {
                this.state.isRunning = true;
                chrome.alarms.create('pomodoroTick', { periodInMinutes: 1/60 });
                this.showNotification(
                    'Next focus session started!', 
                    `Session ${this.state.currentSession} of ${this.state.totalSessions}`
                );
            } else {
                this.state.isRunning = false;
                this.showNotification(
                    'Ready for next session', 
                    `Session ${this.state.currentSession} of ${this.state.totalSessions}`
                );
            }
        }

        this.updateBadge();
        this.saveState();
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.state.totalSessions = this.settings.sessionsCount;
        
        // Update current timer state based on current phase
        if (this.state.currentPhase === 'focus') {
            // If we're in a focus session, update the time left if timer isn't running
            // or if the new focus time is longer than current time left
            if (!this.state.isRunning || (newSettings.focusTime * 60) > this.state.timeLeft) {
                this.state.timeLeft = newSettings.focusTime * 60;
            }
        } else if (this.state.currentPhase === 'shortBreak') {
            // Update short break time
            if (!this.state.isRunning || (newSettings.breakTime * 60) > this.state.timeLeft) {
                this.state.timeLeft = newSettings.breakTime * 60;
            }
        } else if (this.state.currentPhase === 'longBreak') {
            // Update long break time
            if (!this.state.isRunning || (newSettings.longBreakTime * 60) > this.state.timeLeft) {
                this.state.timeLeft = newSettings.longBreakTime * 60;
            }
        }
        
        // If current session exceeds new total sessions, adjust it
        if (this.state.currentSession > this.settings.sessionsCount) {
            this.state.currentSession = this.settings.sessionsCount;
        }
        
        chrome.storage.local.set({
            ...this.settings,
            totalSessions: this.state.totalSessions
        });
        
        this.updateBadge();
        this.saveState();
        
        // Notify that settings were applied
        this.showNotification('Settings updated!', 'Timer has been updated with new settings');
    }

    updateBadge() {
        const minutes = Math.floor(this.state.timeLeft / 60);
        const seconds = this.state.timeLeft % 60;
        const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        let badgeColor = '#3498db'; // Default blue
        let badgeText = timeText;

        if (this.state.isRunning) {
            if (this.state.currentPhase === 'focus') {
                badgeColor = '#e74c3c'; // Red for focus
            } else {
                badgeColor = '#27ae60'; // Green for break
            }
        } else if (this.state.isPaused) {
            badgeColor = '#f39c12'; // Orange for paused
            badgeText = '⏸️';
        } else {
            badgeText = '▶️';
        }

        chrome.action.setBadgeText({ text: badgeText });
        chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    }

    showNotification(title, message) {
        const options = {
            type: 'basic',
            iconUrl: 'icons/timer-48.png',
            title: title,
            message: message
        };

        chrome.notifications.create(options);
    }

    saveState() {
        chrome.storage.local.set({
            ...this.state,
            ...this.settings
        });
    }
}

// Initialize the service worker
new PomodoroServiceWorker();