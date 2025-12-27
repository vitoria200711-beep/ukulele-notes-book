import { useState, useRef, useCallback, useEffect } from 'react';

type AudioBuffer = Float32Array<ArrayBuffer>;

interface AudioDetectorState {
  isListening: boolean;
  frequency: number;
  volume: number;
  error: string | null;
}

interface UseAudioDetectorReturn extends AudioDetectorState {
  startListening: () => Promise<void>;
  stopListening: () => void;
  hasPermission: boolean | null;
}

// Autocorrelation-based pitch detection
function autoCorrelate(buffer: AudioBuffer, sampleRate: number): number {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;
  const correlations = new Float32Array(MAX_SAMPLES);

  // Calculate RMS to check if there's enough signal
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / SIZE);
  
  if (rms < 0.01) return -1; // Not enough signal

  let lastCorrelation = 1;
  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;

    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }
    
    correlation = 1 - correlation / MAX_SAMPLES;
    correlations[offset] = correlation;

    if (correlation > 0.9 && correlation > lastCorrelation) {
      foundGoodCorrelation = true;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    } else if (foundGoodCorrelation) {
      const shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) / correlations[bestOffset];
      return sampleRate / (bestOffset + 8 * shift);
    }
    
    lastCorrelation = correlation;
  }

  if (bestCorrelation > 0.01) {
    return sampleRate / bestOffset;
  }
  
  return -1;
}

export function useAudioDetector(): UseAudioDetectorReturn {
  const [state, setState] = useState<AudioDetectorState>({
    isListening: false,
    frequency: 0,
    volume: 0,
    error: null,
  });
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);

  const processAudio = useCallback(() => {
    if (!analyserRef.current || !bufferRef.current || !audioContextRef.current) return;

    analyserRef.current.getFloatTimeDomainData(bufferRef.current);
    
    // Calculate volume (RMS)
    let sum = 0;
    for (let i = 0; i < bufferRef.current.length; i++) {
      sum += bufferRef.current[i] * bufferRef.current[i];
    }
    const volume = Math.sqrt(sum / bufferRef.current.length);

    // Detect pitch
    const frequency = autoCorrelate(bufferRef.current, audioContextRef.current.sampleRate);

    setState(prev => ({
      ...prev,
      frequency: frequency > 0 ? frequency : prev.frequency,
      volume,
    }));

    animationFrameRef.current = requestAnimationFrame(processAudio);
  }, []);

  const startListening = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      setHasPermission(true);
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      bufferRef.current = new Float32Array(analyser.fftSize) as AudioBuffer;

      setState(prev => ({ ...prev, isListening: true }));
      processAudio();
    } catch (err) {
      setHasPermission(false);
      setState(prev => ({
        ...prev,
        error: 'Não foi possível acessar o microfone. Verifique as permissões.',
        isListening: false,
      }));
    }
  }, [processAudio]);

  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    bufferRef.current = null;

    setState({
      isListening: false,
      frequency: 0,
      volume: 0,
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    ...state,
    startListening,
    stopListening,
    hasPermission,
  };
}
