/**
 * Audio Context and Microphone Noise Detection Service
 * Designed to work reliably across Mobile (iOS Safari / Android Chrome) and Desktop.
 */

type NoiseCallback = (data: {
  level: number;
  peak: number;
  frequencies: number[];
  history: number[];
}) => void;

type ErrorCallback = (error: string) => void;

class AudioNoiseDetector {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private peakLevel: number = 0;
  private history: number[] = new Array(30).fill(15);
  private callbacks: Set<NoiseCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private lastUpdate: number = 0;

  public subscribe(cb: NoiseCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  public onError(cb: ErrorCallback): () => void {
    this.errorCallbacks.add(cb);
    return () => this.errorCallbacks.delete(cb);
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public async start(): Promise<boolean> {
    if (this.isRunning) return true;

    // Check mediaDevices support
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.notifyError('NOT_SUPPORTED');
      return false;
    }

    try {
      // 1. Initialize or resume AudioContext (handling mobile WebKitAudioContext & auto-play policy)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        this.notifyError('NOT_SUPPORTED');
        return false;
      }

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // 2. Request user microphone with optimal mobile constraints
      // Disabling echoCancellation / noiseSuppression gives true room ambient acoustic readings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.micStream = stream;

      // Handle stream track ends (e.g. user revoked permission or OS closed mic)
      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          this.stop();
        };
      });

      // 3. Connect nodes: Microphone -> AnalyserNode
      const source = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 64; // Gives 32 frequency bins, ideal for fast 60fps mobile analysis
      analyser.smoothingTimeConstant = 0.7; // Smooth transitions without jitter
      source.connect(analyser);

      this.analyser = analyser;
      this.isRunning = true;
      this.peakLevel = 15;
      this.history = new Array(30).fill(15);

      // 4. Start analysis loop
      this.tick();
      return true;
    } catch (err: any) {
      console.warn('Microphone start error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('denied')) {
        this.notifyError('PERMISSION_DENIED');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        this.notifyError('NO_DEVICE');
      } else {
        this.notifyError('GENERIC_ERROR');
      }
      this.stop();
      return false;
    }
  }

  public stop() {
    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      this.micStream = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.suspend();
      } catch {}
    }

    this.analyser = null;

    // Notify zero/reset state
    this.notify({
      level: 0,
      peak: 0,
      frequencies: new Array(16).fill(0),
      history: new Array(30).fill(0),
    });
  }

  private tick = () => {
    if (!this.isRunning || !this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const timeDomainData = new Uint8Array(bufferLength);
    const frequencyData = new Uint8Array(bufferLength);

    this.analyser.getByteTimeDomainData(timeDomainData);
    this.analyser.getByteFrequencyData(frequencyData);

    // Calculate RMS from time domain data
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (timeDomainData[i] - 128) / 128; // -1 to 1
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    // Convert RMS to estimated clinical dB SPL (Ambient sound level calibrated 15 dB to 85 dB)
    // 0 RMS -> ~12-15 dB (ambient baseline noise floor)
    // Log scale mapping
    let db = 15;
    if (rms > 0.0001) {
      // 20 * log10(rms) usually ranges from -60 to 0
      const dbRms = 20 * Math.log10(rms);
      // Map [-55, 0] to [15, 85] dB SPL
      db = Math.round(((dbRms + 55) / 55) * 70 + 15);
      db = Math.max(12, Math.min(95, db));
    }

    if (db > this.peakLevel) {
      this.peakLevel = db;
    }

    // Downsample 32 frequency bins into 16 bars for UI spectrum
    const freqBars: number[] = [];
    const step = Math.max(1, Math.floor(bufferLength / 16));
    for (let i = 0; i < 16; i++) {
      const val = frequencyData[i * step] || 0;
      // percentage 0 to 100
      freqBars.push(Math.round((val / 255) * 100));
    }

    // Update history every ~100ms
    const now = Date.now();
    if (now - this.lastUpdate > 100) {
      this.lastUpdate = now;
      this.history.push(db);
      if (this.history.length > 30) {
        this.history.shift();
      }
    }

    this.notify({
      level: db,
      peak: this.peakLevel,
      frequencies: freqBars,
      history: [...this.history],
    });

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  private notify(data: { level: number; peak: number; frequencies: number[]; history: number[] }) {
    this.callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(e);
      }
    });
  }

  private notifyError(error: string) {
    this.errorCallbacks.forEach(cb => {
      try {
        cb(error);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export const noiseDetector = new AudioNoiseDetector();
