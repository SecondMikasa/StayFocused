chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateSettings") {
        // Update the session and break lengths
        chrome.storage.local.set({
            sessionLength: request.sessionLength,
            breakLength: request.breakLength
        }, () => {
            sendResponse({ success: true });
        });
    }
    return true; // Required for async sendResponse
});

chrome.storage.local.get(['sessionLength', 'breakLength'], (result) => {
    let secondsInput = result.sessionLength || 25; // Default to 25 minutes if not set
    let breaksInput = result.breakLength || 5; // Default to 5 minutes if not set

    let seconds = secondsInput * 60;
    let breaks = (secondsInput + breaksInput) * 60;
    let timerIsRunning = false

    function createAlarm(name) {
        chrome.alarms.create(
            name,
            {
                periodInMinutes: 1 / 60
            },
            (alarm) => {
                console.log(alarm)
            }
        )
    }

    function clearAlarm(name) {
        chrome.alarms.clear(
            name,
            (wasCleared) => {
                console.log(wasCleared)
            }
        )
    }

    function createNotif(message) {
        const opt = {
            type: 'list',
            title: 'Pomodoro Timer',
            message: message,
            items: [{ title: 'Pomodoro Timer', message: message }],
            iconUrl: "icons/timer-48.png"
        }

        chrome.notifications.create(opt)
    }

    chrome.contextMenus.create(
        {
            id: "start_timer",
            title: "Start Timer",
            contexts: ["all"]
        }
    )

    chrome.contextMenus.create(
        {
            id: "reset_timer",
            title: "Reset Timer",
            contexts: ["all"]
        }
    )


    chrome.contextMenus.onClicked.addListener(function (info, tab) {
        switch (info.menuItemId) {
            case "start_timer":
                seconds = seconds <= 0 ? 25 * 60 : seconds;
                breaks = breaks <= 0 ? 30 * 60 : breaks;
                if (timerIsRunning) {
                    clearAlarm("pomodoro_timer")
                    clearAlarm("breaks_timer")
                    createNotif("Your Timer has stopped")
                    chrome.contextMenus.update("start_timer", {
                        title: "Start Timer",
                        contexts: ["all"]
                    })
                    chrome.action.setBadgeBackgroundColor({
                        color: "green"
                    })
                    chrome.action.setBadgeText({
                        text: "▶"
                    })
                    timerIsRunning = !timerIsRunning
                    return
                }

                createNotif("Your Timer has started")
                createAlarm("pomodoro_timer");
                createAlarm("breaks_timer")
                timerIsRunning = true
                chrome.contextMenus.update("start_timer", {
                    title: "Stop Timer",
                    contexts: ["all"]
                })
                break;

            case "reset_timer":
                seconds = 0
                breaks = 0
                if (timerIsRunning) {
                    chrome.action.setBadgeText({
                        text: "X"
                    })
                    chrome.action.setBadgeBackgroundColor({
                        color: "red"
                    })
                    clearAlarm("pomodoro_timer")
                    createNotif("Your Timer Has Been Reset")
                    timerIsRunning = false
                    chrome.contextMenus.update("start_timer", {
                        title: "Start Timer",
                        contexts: ["all"]
                    })
                }
        }
    })

    chrome.alarms.onAlarm.addListener((alarm) => {
    })

    chrome.alarms.onAlarm.addListener((alarm) => {
        if (!timerIsRunning) {
            return
        }

        seconds--
        breaks--

        const minLeft = Math.floor(seconds / 60) + "M"

        const breakLeft = Math.floor(breaks / 60) + "M"

        chrome.action.setBadgeText({
            text: minLeft
        })

        chrome.action.setBadgeBackgroundColor({
            color: "blue"
        })

        if (seconds <= 0) {
            clearAlarm("pomodoro_timer")
            createNotif("Your Timer has finished. Time to grab a break")
            chrome.action.setBadgeBackgroundColor({
                color: "green"
            })
            chrome.action.setBadgeText({
                text: breakLeft
            })
            if (breaks <= 0) {
                clearAlarm("breaks_timer")
                createNotif("Your Break Time has finished. Your session has ended")
                chrome.action.setBadgeBackgroundColor({
                    color: "yellow"
                })
                chrome.action.setBadgeText({
                    text: "-"
                })
            }
        }
    })
});