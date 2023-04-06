chrome.runtime.onInstalled.addListener(({ reason, version }) => {
    if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
      showIndex();
    }
  });
  
  chrome.action.onClicked.addListener((tab) => {
    showIndex();
  });
  
  const showIndex = (info, tab) => {
    let url = chrome.runtime.getURL('home.html');
    chrome.tabs.create({ url });
  };
