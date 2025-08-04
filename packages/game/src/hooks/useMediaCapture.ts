import { useState, useCallback, useRef } from 'react';

export type MediaType = 'camera' | 'screen' | 'microphone';

interface MediaConstraints {
  camera: {
    video?: MediaTrackConstraints | boolean;
    audio?: MediaTrackConstraints | boolean;
  };
  screen: {
    video?: MediaTrackConstraints | boolean;
    audio?: MediaTrackConstraints | boolean;
  };
  microphone: {
    video?: MediaTrackConstraints | boolean;
    audio?: MediaTrackConstraints | boolean;
  };
}

interface MediaStreamState {
  camera?: MediaStream;
  screen?: MediaStream;
  microphone?: MediaStream;
}

interface StreamingState {
  camera: boolean;
  screen: boolean;
  microphone: boolean;
}

interface UseMediaCaptureReturn {
  mediaStreams: MediaStreamState;
  streamingState: StreamingState;
  startMediaCapture: (type: MediaType) => Promise<MediaStream | null>;
  stopMediaStream: (type: MediaType) => void;
  stopAllStreams: () => void;
}

const MEDIA_CONSTRAINTS: MediaConstraints = {
  camera: {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
    audio: false,
  },
  screen: {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    },
    audio: false,
  },
  microphone: {
    video: false,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100,
    },
  },
};

const ERROR_MESSAGES: Record<MediaType, string> = {
  camera: 'Failed to capture camera',
  screen: 'Failed to capture screen',
  microphone: 'Failed to capture microphone',
};

/**
 * Custom hook for managing media capture operations (camera, screen, microphone)
 * Consolidates duplicated media capture logic and provides a unified interface
 */
export function useMediaCapture(): UseMediaCaptureReturn {
  const [mediaStreams, setMediaStreams] = useState<MediaStreamState>({});
  const [streamingState, setStreamingState] = useState<StreamingState>({
    camera: false,
    screen: false,
    microphone: false,
  });

  const cleanupRef = useRef<Map<MediaType, () => void>>(new Map());

  const startMediaCapture = useCallback(async (type: MediaType): Promise<MediaStream | null> => {
    try {
      let stream: MediaStream;

      if (type === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia(MEDIA_CONSTRAINTS.screen);
      } else {
        stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS[type]);
      }

      // Store cleanup function for the stream
      const cleanup = () => {
        stream.getTracks().forEach((track) => track.stop());

        // Clean up audio processor if exists (for microphone streams)
        if (type === 'microphone' && (stream as any).audioProcessor) {
          const { audioContext, source, processor } = (stream as any).audioProcessor;
          source.disconnect();
          processor.disconnect();
          audioContext.close();
        }
      };

      cleanupRef.current.set(type, cleanup);

      // Update state
      setMediaStreams((prev) => ({ ...prev, [type]: stream }));
      setStreamingState((prev) => ({ ...prev, [type]: true }));

      return stream;
    } catch (error) {
      console.error(`${ERROR_MESSAGES[type]}:`, error);
      return null;
    }
  }, []);

  const stopMediaStream = useCallback((type: MediaType) => {
    const cleanup = cleanupRef.current.get(type);
    if (cleanup) {
      cleanup();
      cleanupRef.current.delete(type);
    }

    setMediaStreams((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });

    setStreamingState((prev) => ({ ...prev, [type]: false }));
  }, []);

  const stopAllStreams = useCallback(() => {
    for (const type of cleanupRef.current.keys()) {
      stopMediaStream(type);
    }
  }, [stopMediaStream]);

  return {
    mediaStreams,
    streamingState,
    startMediaCapture,
    stopMediaStream,
    stopAllStreams,
  };
}
