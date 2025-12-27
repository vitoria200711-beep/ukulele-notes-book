import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioDetectorState {
  isListening: boolean;
  frequency: number;
  volume: number;
  error: string | null;
}

interface UseAudioDetectorReturn extends AudioDetectorState {
  startListening: (opts?: {
    minFreq?: number;
    maxFreq?: number;
    threshold?: number;
    minRms?: number;
    minQuality?: number;
    softQuality?: number;
    allowSoftStart?: boolean; // para afinador: começar a mostrar mesmo longe do alvo
  }) => Promise<void>;
  stopListening: () => void;
  hasPermission: boolean | null;
}

function hannWindow(n: number, N: number): number {
  // Janela de Hann para reduzir vazamento e estabilizar o YIN em microfones ruidosos.
  return 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
}

function preprocessBuffer(input: Float32Array, out: Float32Array): number {
  // Remove DC offset e aplica janela (Hann). Retorna RMS do sinal processado.
  const N = input.length;
  if (out.length !== N) return 0;

  // DC offset
  let mean = 0;
  for (let i = 0; i < N; i++) mean += input[i];
  mean /= N;

  // Window + RMS
  let sumSq = 0;
  for (let i = 0; i < N; i++) {
    const w = hannWindow(i, N);
    const v = (input[i] - mean) * w;
    out[i] = v;
    sumSq += v * v;
  }
  return Math.sqrt(sumSq / N);
}

// Pitch detection (YIN) — mais estável/preciso que autocorrelação simples para instrumentos reais.
// Referência: A. de Cheveigné, H. Kawahara (2002)
function yinPitchDetailed(
  buffer: Float32Array,
  sampleRate: number,
  opts?: { threshold?: number; minFreq?: number; maxFreq?: number }
): { freq: number; quality: number } {
  const threshold = opts?.threshold ?? 0.12;
  const minFreq = opts?.minFreq ?? 80;   // cobre ukulele e evita ruído grave
  const maxFreq = opts?.maxFreq ?? 1200; // permitir uso no afinador; caller pode band-limitar

  const bufferSize = buffer.length;
  const half = Math.floor(bufferSize / 2);
  if (half < 2) return { freq: -1, quality: 0 };

  // Limitar o tau (lag) para faixa de frequência desejada
  const maxTau = Math.min(half - 1, Math.floor(sampleRate / minFreq));
  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));

  const diff = new Float32Array(maxTau + 1);
  const cmnd = new Float32Array(maxTau + 1);

  // Difference function d(tau)
  for (let tau = minTau; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Cumulative mean normalized difference (CMND)
  let runningSum = 0;
  for (let tau = minTau; tau <= maxTau; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
  }
  cmnd[minTau] = 1; // por definição

  // Absolute threshold
  let tauEstimate = -1;
  for (let tau = minTau + 1; tau <= maxTau; tau++) {
    if (cmnd[tau] < threshold) {
      // localizar mínimo local
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) return { freq: -1, quality: 0 };

  // Parabolic interpolation para refinar tau
  const x0 = tauEstimate > minTau ? tauEstimate - 1 : tauEstimate;
  const x2 = tauEstimate < maxTau ? tauEstimate + 1 : tauEstimate;
  const s0 = cmnd[x0];
  const s1 = cmnd[tauEstimate];
  const s2 = cmnd[x2];
  const denom = (2 * s1) - s2 - s0;
  const betterTau = denom !== 0 ? tauEstimate + (s2 - s0) / (2 * denom) : tauEstimate;

  const freq = sampleRate / betterTau;
  if (!Number.isFinite(freq) || freq < minFreq || freq > maxFreq) return { freq: -1, quality: 0 };

  // Qualidade: quanto mais perto de 0 no CMND, mais “confiante”
  const quality = Math.max(0, Math.min(1, 1 - s1));
  return { freq, quality };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
  const bufferRef = useRef<Float32Array | null>(null);
  const processedRef = useRef<Float32Array | null>(null);
  const freqDataRef = useRef<Float32Array | null>(null);
  const smoothedFreqRef = useRef<number>(0);
  const lastFreqsRef = useRef<number[]>([]);
  const missesRef = useRef<number>(0);
  const pitchOptsRef = useRef<{
    minFreq: number;
    maxFreq: number;
    threshold: number;
    minRms: number;
    minQuality: number;
    softQuality: number;
    allowSoftStart: boolean;
  }>({
    minFreq: 120,
    maxFreq: 900,
    threshold: 0.12,
    minRms: 0.011,
    minQuality: 0.68,
    softQuality: 0.55,
    allowSoftStart: false,
  });

  const fftPeakFrequency = useCallback((minFreq: number, maxFreq: number): number => {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;
    const data = freqDataRef.current;
    if (!analyser || !audioContext || !data) return -1;

    analyser.getFloatFrequencyData(data); // dBFS
    const nyquist = audioContext.sampleRate / 2;
    const binCount = analyser.frequencyBinCount;
    const binHz = nyquist / binCount; // Hz por bin

    const startBin = Math.max(1, Math.floor(minFreq / binHz));
    const endBin = Math.min(binCount - 2, Math.ceil(maxFreq / binHz));

    let bestIdx = -1;
    let bestDb = -Infinity;
    for (let i = startBin; i <= endBin; i++) {
      const db = data[i];
      if (db > bestDb) {
        bestDb = db;
        bestIdx = i;
      }
    }

    // Se estiver muito baixo, provavelmente é ruído
    if (bestIdx === -1 || bestDb < -75) return -1;

    // Interpolação parabólica em magnitude linear (melhora o pico)
    const mag = (db: number) => Math.pow(10, db / 20);
    const a = mag(data[bestIdx - 1]);
    const b = mag(data[bestIdx]);
    const c = mag(data[bestIdx + 1]);
    const denom = a - 2 * b + c;
    const p = denom !== 0 ? 0.5 * (a - c) / denom : 0;

    const peakBin = bestIdx + p;
    const freq = peakBin * binHz;
    if (!Number.isFinite(freq) || freq < minFreq || freq > maxFreq) return -1;
    return freq;
  }, []);

  const processAudio = useCallback(() => {
    if (!analyserRef.current || !bufferRef.current || !processedRef.current || !audioContextRef.current) return;

    analyserRef.current.getFloatTimeDomainData(bufferRef.current);

    // Pré-processar (DC + janela) e obter RMS mais “limpo”
    const volume = preprocessBuffer(bufferRef.current, processedRef.current);

    // Gate mais firme para reduzir falsos positivos
    const { minRms, minQuality, softQuality, allowSoftStart } = pitchOptsRef.current;

    // Detect pitch (YIN) na faixa do ukulele (GCEA ~ 200–1000 Hz com harmônicos)
    const { minFreq, maxFreq, threshold } = pitchOptsRef.current;
    let { freq: rawFreq, quality } =
      volume >= minRms
        ? yinPitchDetailed(processedRef.current, audioContextRef.current.sampleRate, {
            threshold,
            minFreq,
            maxFreq,
          })
        : { freq: -1, quality: 0 };

    // Fallback: quando o YIN falhar (muito comum em acorde/mais de uma corda),
    // pegue o pico dominante no espectro. Isso deixa o comportamento mais parecido com afinadores comuns.
    if ((rawFreq <= 0 || quality < softQuality) && volume >= minRms * 1.3) {
      const fftFreq = fftPeakFrequency(minFreq, maxFreq);
      if (fftFreq > 0) {
        rawFreq = fftFreq;
        // Qualidade “fraca”, mas suficiente pra mostrar direção (grave/agudo)
        quality = Math.max(quality, softQuality);
      }
    }

    // Rejeitar resultados de baixa confiança (evita ruído/harmônicos dominantes),
    // mas sem “matar” o afinador em microfones de notebook (onde a fundamental pode vir fraca).
    let detected = -1;

    if (rawFreq > 0 && quality >= minQuality) {
      detected = rawFreq;
    } else if (rawFreq > 0 && quality >= softQuality) {
      // Aceita apenas se estiver “perto” do que já estava sendo detectado (continuidade),
      // incluindo correção de oitava (x2 / /2).
      const prev = smoothedFreqRef.current;
      if (prev > 0) {
        const candidates = [rawFreq, rawFreq / 2, rawFreq * 2];
        candidates.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
        const best = candidates[0];
        const ratio = best / prev;
        if (ratio > 0.86 && ratio < 1.16) detected = best;
      } else if (allowSoftStart && volume >= minRms * 1.4) {
        // Modo afinador: permita começar a mostrar mesmo sem histórico,
        // desde que haja sinal suficiente.
        detected = rawFreq;
      }
    }

    // Suavização (EMA) para reduzir "puladas" de frequência
    let nextFreq = 0;
    if (detected > 0) {
      missesRef.current = 0;
      // Estabilidade: usa mediana dos últimos N valores antes do EMA
      const buf = lastFreqsRef.current;
      buf.push(detected);
      if (buf.length > 5) buf.shift();
      let stable = median(buf);

      // Corrigir “saltos de oitava”: escolhe a variante mais próxima do suavizado atual
      const prevSmooth = smoothedFreqRef.current;
      if (prevSmooth > 0) {
        const candidates = [stable, stable / 2, stable * 2];
        candidates.sort((a, b) => Math.abs(a - prevSmooth) - Math.abs(b - prevSmooth));
        stable = candidates[0];
      }

      const prev = smoothedFreqRef.current || stable;

      // Outlier reject: se “pular” demais, segura um pouco (com microfone de notebook isso ajuda muito)
      const jumpRatio = prev > 0 ? stable / prev : 1;
      const isBigJump = prev > 0 && (jumpRatio > 1.18 || jumpRatio < 0.85);
      const alpha = isBigJump ? 0.08 : 0.18;
      nextFreq = prev * (1 - alpha) + stable * alpha;
      smoothedFreqRef.current = nextFreq;
    } else {
      // Evitar “sumir” a detecção a cada oscilação (muito comum em mic de notebook).
      // Para o afinador/prática (allowSoftStart), seguramos por alguns frames e decaímos.
      missesRef.current += 1;

      if (pitchOptsRef.current.allowSoftStart && smoothedFreqRef.current > 0 && volume >= minRms * 0.7) {
        const holdFrames = 10; // ~ 10 frames (≈160ms) antes de zerar
        if (missesRef.current <= holdFrames) {
          smoothedFreqRef.current *= 0.995; // decay suave
          nextFreq = smoothedFreqRef.current;
        } else {
          smoothedFreqRef.current = 0;
          lastFreqsRef.current = [];
          nextFreq = 0;
        }
      } else {
        // Sem soft-start, manter o comportamento de zerar (mais seguro para validação “rígida”)
        smoothedFreqRef.current = 0;
        lastFreqsRef.current = [];
        nextFreq = 0;
      }
    }

    setState(prev => ({
      ...prev,
      frequency: nextFreq,
      volume,
    }));

    animationFrameRef.current = requestAnimationFrame(processAudio);
  }, []);

  const startListening = useCallback(async (opts?: {
    minFreq?: number;
    maxFreq?: number;
    threshold?: number;
    minRms?: number;
    minQuality?: number;
    softQuality?: number;
    allowSoftStart?: boolean;
  }) => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Atualizar opções de detecção (faixa/threshold) para melhorar precisão.
      pitchOptsRef.current = {
        minFreq: opts?.minFreq ?? pitchOptsRef.current.minFreq,
        maxFreq: opts?.maxFreq ?? pitchOptsRef.current.maxFreq,
        threshold: opts?.threshold ?? pitchOptsRef.current.threshold,
        minRms: opts?.minRms ?? pitchOptsRef.current.minRms,
        minQuality: opts?.minQuality ?? pitchOptsRef.current.minQuality,
        softQuality: opts?.softQuality ?? pitchOptsRef.current.softQuality,
        allowSoftStart: opts?.allowSoftStart ?? pitchOptsRef.current.allowSoftStart,
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });

      setHasPermission(true);
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      // Mais amostras => melhor estabilidade (com um pouco mais de latência)
      analyser.fftSize = 8192;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      bufferRef.current = new Float32Array(analyser.fftSize);
      processedRef.current = new Float32Array(analyser.fftSize);
      freqDataRef.current = new Float32Array(analyser.frequencyBinCount);
      missesRef.current = 0;

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
    processedRef.current = null;
    freqDataRef.current = null;
    smoothedFreqRef.current = 0;
    lastFreqsRef.current = [];
    missesRef.current = 0;

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
