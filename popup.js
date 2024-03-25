document.getElementById('saveSettings').addEventListener('click', () => {
    const sessionLength = document.getElementById('sessionLength').value;
    const breakLength = document.getElementById('breakLength').value;

    chrome.runtime.sendMessage({
        action: "updateSettings",
        sessionLength: sessionLength,
        breakLength: breakLength
    })
})