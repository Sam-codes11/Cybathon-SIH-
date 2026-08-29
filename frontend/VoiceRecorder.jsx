import React, { useState, useRef, useCallback, useEffect } from 'react';

const WEBSOCKET_URL = 'ws://localhost:8080/audio-stream';
const TIMESLICE_MS = 250; // How often MediaRecorder emits chunks

const RECORDING_STATES = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  RECORDING: 'recording',
  STOPPING: 'stopping',
  ERROR: 'error',
};

function VoiceRecorder({
  websocketUrl = WEBSOCKET_URL,
  mimeType = 'audio/webm;codecs=opus',
  timeslice = TIMESLICE_MS,
  onError,
  onStateChange,
}) {
  const [recordingState, setRecordingState] = useState(RECORDING_STATES.IDLE);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);

  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const chunkQueueRef = useRef([]); // buffer chunks if socket isn't open yet

  const updateState = useCallback((newState) => {
    setRecordingState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  const handleError = useCallback((message, err) => {
    console.error(message, err);
    setErrorMessage(message);
    updateState(RECORDING_STATES.ERROR);
    onError?.(message, err);
  }, [onError, updateState]);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const cleanupSocket = useCallback(() => {
    if (socketRef.current) {
      // Only close if not already closing/closed
      if (
        socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING
      ) {
        socketRef.current.close(1000, 'Recording stopped');
      }
      socketRef.current = null;
    }
    chunkQueueRef.current = [];
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flushQueuedChunks = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    while (chunkQueueRef.current.length > 0) {
      const chunk = chunkQueueRef.current.shift();
      socket.send(chunk);
    }
  }, []);

  const sendChunk = useCallback((blob) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Send raw binary data (ArrayBuffer) rather than the Blob directly
      // for broader backend compatibility.
      blob.arrayBuffer().then((buffer) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(buffer);
        }
      }).catch((err) => {
        console.warn('Failed to convert chunk to ArrayBuffer', err);
      });
    } else {
      // Socket not ready yet — queue it (bounded, to avoid unbounded memory growth)
      chunkQueueRef.current.push(blob);
      if (chunkQueueRef.current.length > 200) {
        chunkQueueRef.current.shift(); // drop oldest
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    updateState(RECORDING_STATES.CONNECTING);

    // 1. Get microphone access
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err) {
      handleError('Microphone access denied or unavailable.', err);
      return;
    }

    // 2. Verify MediaRecorder supports the requested mimeType
    const supportedMimeType = MediaRecorder.isTypeSupported(mimeType)
      ? mimeType
      : ''; // let browser pick a default if unsupported

    // 3. Open WebSocket connection
    const socket = new WebSocket(websocketUrl);
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.onopen = () => {
      flushQueuedChunks();
    };

    socket.onerror = (err) => {
      handleError('WebSocket connection error.', err);
    };

    socket.onclose = (event) => {
      if (!event.wasClean && recordingState === RECORDING_STATES.RECORDING) {
        handleError(`WebSocket closed unexpectedly (code ${event.code}).`);
      }
    };

    // 4. Set up MediaRecorder
    let recorder;
    try {
      recorder = new MediaRecorder(
        stream,
        supportedMimeType ? { mimeType: supportedMimeType } : undefined
      );
    } catch (err) {
      handleError('Failed to initialize MediaRecorder.', err);
      cleanupStream();
      cleanupSocket();
      return;
    }
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        sendChunk(event.data);
      }
    };

    recorder.onerror = (event) => {
      handleError('MediaRecorder encountered an error.', event.error);
    };

    recorder.onstop = () => {
      cleanupStream();
      cleanupSocket();
      stopTimer();
      updateState(RECORDING_STATES.IDLE);
    };

    // 5. Start recording once socket connects (or immediately — chunks queue if needed)
    recorder.start(timeslice);
    updateState(RECORDING_STATES.RECORDING);

    setElapsedTime(0);
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
  }, [
    websocketUrl,
    mimeType,
    timeslice,
    updateState,
    handleError,
