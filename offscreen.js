'use strict';

let capturedTab = { captured: false };

const utils = {
  handleError(message = 'An error occurred', error = null) {
    console.error(message, error);
  },
};

const userMedia = {
  async get(streamId) {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
    });
  },
};

const stream = {
  async get(streamId) {
    try {
      const stream = userMedia.get(streamId);
      return stream;
    } catch (error) {
      utils.handleError('Error getting audio stream: ' + error.message);
    }
  },
};

const tab = {
  async capture(streamId, tabId) {
    const audioStream = await stream.get(streamId);

    capturedTab = new CapturedAudioObject({
      tabId,
      stream: audioStream,
    });
  },
};

const power = {
  off() {
    capturedTab.stopAudio();
    initCapturedTab();
  },
};

const initCapturedTab = () => {
  capturedTab = { captured: false };
};

class CapturedAudioObject {
  constructor({ tabId, stream }) {
    this.captured = true;

    this.tabId = tabId;

    this.audioCtx = new AudioContext({ latencyHint: 'interactive' });

    this.streamOutput = this.audioCtx.createMediaStreamSource(stream);

    this.streamOutput.connect(this.audioCtx.destination);
  }

  stopAudio() {
    const { streamOutput, audioCtx } = this;
    const audioTracks = streamOutput.mediaStream.getAudioTracks();

    if (audioTracks.length > 0) audioTracks[0].stop();

    audioCtx.close();

    return true;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { target } = message;

  if (target !== 'offscreen') return;

  const { type, tabId } = message;

  switch (type) {
    case 'captureTab':
      tab.capture(message.streamId, tabId);
      sendResponse('on');
      break;

    case 'releaseTab':
      power.off();
      sendResponse('off');
      break;

    case 'tabRemoved':
      if (capturedTab.tabId === tabId) {
        power.off();
        sendResponse('off');
      }
      return true;

    case 'getCapturedState':
      sendResponse(capturedTab.captured);
      return true;
  }
});
