chrome.runtime.sendMessage({ at: Date.now(), top: window.top === window }, () => { void chrome.runtime.lastError; });
