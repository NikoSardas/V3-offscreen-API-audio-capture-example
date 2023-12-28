'use strict';

const { sendMessage } = chrome.runtime;

const streamId = {
  async get(tabId) {
    try {
      const streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: tabId,
      });

      if (streamId && typeof streamId === 'string') {
        return streamId;
      } else {
        utils.handleError('Invalid streamId:', streamId);
        return false;
      }
    } catch (error) {
      utils.handleError('Error in getStreamId:', error);
    }
  },
};

const offscreenDoc = {
  async verify() {
    const allContexts = await chrome.runtime.getContexts({});

    const offscreenDocument = allContexts.find(
      (c) => c.contextType === 'OFFSCREEN_DOCUMENT'
    );

    if (!offscreenDocument) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Recording from chrome.tabCapture API',
      });
    }
  },
};

const utils = {
  handleError(message = 'An error occurred', error = null) {
    console.error(message, error);
  },
};

const capturedTab = {
  async getState() {
    return await sendMessage({
      target: 'offscreen',
      type: 'getCapturedState',
    });
  },
};

async function init(tabId) {
  await offscreenDoc.verify();

  const tabIsCaptured = await capturedTab.getState();

  sendMessage({
    target: 'offscreen',
    type: tabIsCaptured ? 'releaseTab' : 'captureTab',
    streamId: !tabIsCaptured && (await streamId.get(tabId)),
    tabId,
  });
}

chrome.runtime.onMessage.addListener((message) => {
  const { target, type } = message;

  if (target !== 'worker') return;

  switch (type) {
    case 'popupReady':
      const { tabId } = message;
      init(tabId);
      break;

    default:
      utils.handleError('Unknown message type:', type);
      break;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  sendMessage(
    {
      target: 'offscreen',
      type: 'tabRemoved',
      tabId,
    },
    () => {
      return true;
    }
  );
});

chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  if (reason === 'chrome_update') return;

  await offscreenDoc.verify();

  if (reason === 'update') {
    console.log(`Updated ${previousVersion}`);
  }
});

chrome.action.onClicked.addListener((tab) => {
  const { id } = tab;
  init(id);
});
