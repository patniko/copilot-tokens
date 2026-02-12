import { useState, useRef, useCallback, useEffect } from 'react';

/* Minimal Web Speech API types (not in TS lib by default) */
interface SREvent extends Event {
  results: { length: number; [i: number]: { isFinal: boolean; [i: number]: { transcript: string } } };
  resultIndex: number;
}

export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [audioLevels, setAudioLevels] = useState<number[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const accumulatedRef = useRef('');

  const sampleLevels = useCallback(() => {
    if (!analyserRef.current) return;
    const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(buf);
    const bars = 40;
    const step = Math.max(1, Math.floor(buf.length / bars));
    const levels: number[] = [];
    for (let i = 0; i < bars; i++) levels.push(buf[i * step] / 255);
    setAudioLevels(levels);
    rafRef.current = requestAnimationFrame(sampleLevels);
  }, []);

  const cleanupAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setAudioLevels([]);
  }, []);

  const start = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
    accumulatedRef.current = '';
    setFinalTranscript('');
    setInterimTranscript('');

    recognition.onresult = (event: SREvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          accumulatedRef.current += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      setFinalTranscript(accumulatedRef.current);
      setInterimTranscript(interim);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    // Mic stream → analyser for waveform
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      src.connect(analyser);
      analyserRef.current = analyser;
      rafRef.current = requestAnimationFrame(sampleLevels);
    } catch { /* visualization won't work but speech still will */ }

    recognition.start();
    setIsListening(true);
  }, [sampleLevels]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    cleanupAudio();
    setIsListening(false);
  }, [cleanupAudio]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      cleanupAudio();
    };
  }, [cleanupAudio]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isSupported = !!(((window as any).SpeechRecognition) || ((window as any).webkitSpeechRecognition));

  return { isListening, interimTranscript, finalTranscript, audioLevels, isSupported, start, stop };
}
