/**
 * Hardware Bridge Service
 *
 * Captures hardware (camera, microphone, screen) from the host system
 * and streams it to the containerized agent via WebSocket.
 * Also receives virtual desktop captures from the container.
 */

interface HardwareBridgeConfig {
  containerPort: number;
  containerHost: string;
  streamQuality: 'low' | 'medium' | 'high';
  audioSampleRate: number;
  cameraFPS: number;
  screenCaptureFPS: number;
  enableAutoPermissions: boolean;
  containerMode: boolean;
  sandboxManager?: any; // Reference to SandboxManager
}

interface HardwareCapabilities {
  camera: boolean;
  microphone: boolean;
  screen: boolean;
  speakers: boolean;
}

interface StreamFrame {
  type: 'CAMERA_FRAME' | 'AUDIO_INPUT' | 'SCREEN_CAPTURE' | 'REQUEST_VIRTUAL_SCREEN';
  data: string;
  timestamp: number;
  metadata?: any;
}

export class HardwareBridge {
  private config: HardwareBridgeConfig;
  private ws: WebSocket | null = null;
  private capabilities: HardwareCapabilities;
  private isStreaming = false;

  // Media streams
  private cameraStream: MediaStream | null = null;
  private microphoneStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private outputAudioContext: AudioContext | null = null;

  // Streaming intervals
  private cameraInterval: NodeJS.Timeout | null = null;
  private screenInterval: NodeJS.Timeout | null = null;

  // Canvas for frame processing
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Event handlers
  private onVirtualScreenHandler?: (imageData: string) => void;
  private onConnectionChangeHandler?: (connected: boolean) => void;

  constructor(config: Partial<HardwareBridgeConfig> = {}) {
    this.config = {
      containerPort: 8888,
      containerHost: 'localhost',
      streamQuality: 'medium',
      audioSampleRate: 16000,
      cameraFPS: 10,
      screenCaptureFPS: 5,
      enableAutoPermissions: true,
      containerMode: false,
      ...config,
    };

    this.capabilities = {
      camera: false,
      microphone: false,
      screen: false,
      speakers: false,
    };

    // Create canvas for frame processing
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;

    console.log('[BRIDGE] Hardware bridge initialized', this.config);
  }

  /**
   * Connect to the container's hardware bridge server
   */
  async connect(): Promise<boolean> {
    const wsUrl = `ws://${this.config.containerHost}:${this.config.containerPort}`;
    console.log('[BRIDGE] Connecting to container bridge:', wsUrl);

    this.ws = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws!.onopen = () => {
        clearTimeout(timeout);
        console.log('[BRIDGE] Connected to container bridge');
        this.onConnectionChangeHandler?.(true);
        resolve(true);
      };

      this.ws!.onerror = (error) => {
        clearTimeout(timeout);
        console.error('[BRIDGE] Connection error:', error);
        this.onConnectionChangeHandler?.(false);
        reject(error);
      };

      this.ws!.onclose = () => {
        console.log('[BRIDGE] Connection closed');
        this.onConnectionChangeHandler?.(false);
      };

      this.ws!.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  /**
   * Disconnect from container bridge
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopAllStreaming();
    this.cleanupAudioOutput();
    console.log('[BRIDGE] Disconnected');
  }

  /**
   * Check available hardware capabilities
   */
  async checkCapabilities(): Promise<HardwareCapabilities> {
    // Check camera access
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    this.capabilities.camera = true;
    stream.getTracks().forEach((track) => track.stop());

    // Check microphone access
    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.capabilities.microphone = true;
    audioStream.getTracks().forEach((track) => track.stop());

    // Check screen capture
    // @ts-ignore - getDisplayMedia is supported
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    this.capabilities.screen = true;
    screenStream.getTracks().forEach((track) => track.stop());

    // Check speaker support and initialize audio output
    this.capabilities.speakers = 'Audio' in window;

    // Initialize output audio context for playing sounds from agent
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    console.log('[BRIDGE] Capabilities checked:', this.capabilities);
    return this.capabilities;
  }

  /**
   * Start streaming camera to container
   */
  async startCameraStream(): Promise<boolean> {
    if (!this.capabilities.camera || !this.ws) {
      return false;
    }

    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: this.getVideoResolution().width,
        height: this.getVideoResolution().height,
        frameRate: this.config.cameraFPS,
      },
    });

    const video = document.createElement('video');
    video.srcObject = this.cameraStream;
    video.play();

    video.onloadedmetadata = () => {
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;

      this.cameraInterval = setInterval(() => {
        this.ctx.drawImage(video, 0, 0);
        const frameData = this.canvas.toDataURL('image/jpeg', this.getImageQuality());

        this.sendFrame({
          type: 'CAMERA_FRAME',
          data: frameData,
          timestamp: Date.now(),
          metadata: {
            width: video.videoWidth,
            height: video.videoHeight,
            fps: this.config.cameraFPS,
          },
        });
      }, 1000 / this.config.cameraFPS);
    };

    console.log('[BRIDGE] Camera streaming started');
    return true;
  }

  /**
   * Start streaming microphone to container
   */
  async startMicrophoneStream(): Promise<boolean> {
    if (!this.capabilities.microphone || !this.ws) {
      return false;
    }

    this.microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: this.config.audioSampleRate,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: this.config.audioSampleRate });
    this.mediaRecorder = new MediaRecorder(this.microphoneStream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        const reader = new FileReader();
        reader.onload = () => {
          this.sendFrame({
            type: 'AUDIO_INPUT',
            data: reader.result as string,
            timestamp: Date.now(),
            metadata: {
              sampleRate: this.config.audioSampleRate,
              duration: event.data.size,
            },
          });
        };
        reader.readAsDataURL(event.data);
      }
    };

    this.mediaRecorder.start(500); // Send audio chunks every 500ms

    console.log('[BRIDGE] Microphone streaming started');
    return true;
  }

  /**
   * Start streaming screen capture to container
   */
  async startScreenStream(): Promise<boolean> {
    if (!this.capabilities.screen || !this.ws) {
      return false;
    }

    // @ts-ignore - getDisplayMedia is supported
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: 1920,
        height: 1080,
        frameRate: this.config.screenCaptureFPS,
      },
    });

    const video = document.createElement('video');
    video.srcObject = displayStream;
    video.play();

    video.onloadedmetadata = () => {
      const screenCanvas = document.createElement('canvas');
      const screenCtx = screenCanvas.getContext('2d')!;

      screenCanvas.width = video.videoWidth;
      screenCanvas.height = video.videoHeight;

      this.screenInterval = setInterval(() => {
        screenCtx.drawImage(video, 0, 0);
        const screenData = screenCanvas.toDataURL('image/jpeg', this.getImageQuality());

        this.sendFrame({
          type: 'SCREEN_CAPTURE',
          data: screenData,
          timestamp: Date.now(),
          metadata: {
            width: video.videoWidth,
            height: video.videoHeight,
            fps: this.config.screenCaptureFPS,
          },
        });
      }, 1000 / this.config.screenCaptureFPS);
    };

    // Handle stream ending
    displayStream.getVideoTracks()[0].onended = () => {
      this.stopScreenStream();
    };

    console.log('[BRIDGE] Screen streaming started');
    return true;
  }

  /**
   * Request virtual screen capture from container
   */
  requestVirtualScreen(): void {
    if (this.ws) {
      this.sendFrame({
        type: 'REQUEST_VIRTUAL_SCREEN',
        data: '',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Stop camera streaming
   */
  stopCameraStream(): void {
    if (this.cameraInterval) {
      clearInterval(this.cameraInterval);
      this.cameraInterval = null;
    }

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }

    console.log('[BRIDGE] Camera streaming stopped');
  }

  /**
   * Stop microphone streaming
   */
  stopMicrophoneStream(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log('[BRIDGE] Microphone streaming stopped');
  }

  /**
   * Stop screen streaming
   */
  stopScreenStream(): void {
    if (this.screenInterval) {
      clearInterval(this.screenInterval);
      this.screenInterval = null;
    }

    console.log('[BRIDGE] Screen streaming stopped');
  }

  /**
   * Stop all streaming
   */
  stopAllStreaming(): void {
    this.stopCameraStream();
    this.stopMicrophoneStream();
    this.stopScreenStream();
    this.isStreaming = false;
  }

  /**
   * Event handlers
   */
  onVirtualScreen(handler: (imageData: string) => void): void {
    this.onVirtualScreenHandler = handler;
  }

  onConnectionChange(handler: (connected: boolean) => void): void {
    this.onConnectionChangeHandler = handler;
  }

  // Private methods

  private sendFrame(frame: StreamFrame): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  private handleMessage(data: string): void {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'VIRTUAL_SCREEN_CAPTURE':
        this.onVirtualScreenHandler?.(message.data);
        break;
      case 'BRIDGE_STATUS':
        console.log('[BRIDGE] Container bridge status:', message.data);
        break;
      case 'AUDIO_OUTPUT':
        this.handleAudioOutput(message);
        break;
      case 'SPEAK_TEXT':
        this.handleTextToSpeech(message);
        break;
      case 'NOTIFICATION_SOUND':
        this.handleNotificationSound(message);
        break;
      default:
        console.log('[BRIDGE] Unknown message type:', message.type);
    }
  }

  private getVideoResolution(): { width: number; height: number } {
    switch (this.config.streamQuality) {
      case 'low':
        return { width: 640, height: 480 };
      case 'medium':
        return { width: 1280, height: 720 };
      case 'high':
        return { width: 1920, height: 1080 };
      default:
        return { width: 1280, height: 720 };
    }
  }

  private getImageQuality(): number {
    switch (this.config.streamQuality) {
      case 'low':
        return 0.6;
      case 'medium':
        return 0.8;
      case 'high':
        return 0.9;
      default:
        return 0.8;
    }
  }

  // Getters
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get streamingStatus(): HardwareCapabilities {
    return {
      camera: this.cameraInterval !== null,
      microphone: this.mediaRecorder?.state === 'recording',
      screen: this.screenInterval !== null,
      speakers: this.outputAudioContext !== null,
    };
  }

  // Container Integration Methods

  /**
   * Initialize bridge for container mode
   */
  async initializeForContainer(sandboxManager: any): Promise<boolean> {
    console.log('[BRIDGE] Initializing bridge for container mode...');

    this.config.containerMode = true;
    this.config.sandboxManager = sandboxManager;

    // Setup automatic permission requests if enabled
    if (this.config.enableAutoPermissions) {
      await this.requestAllPermissions();
    }

    // Check hardware capabilities
    await this.checkCapabilities();

    // Wait for container to be ready before connecting
    if (sandboxManager) {
      console.log('[BRIDGE] Waiting for container services to be ready...');
      let retries = 0;
      const maxRetries = 60; // 5 minutes

      while (retries < maxRetries) {
        const status = await sandboxManager.getStatus();
        if (status.services.agent?.status === 'running') {
          console.log('[BRIDGE] Container agent is ready, attempting bridge connection...');
          break;
        }

        console.log(`[BRIDGE] Waiting for container agent... (${retries + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        retries++;
      }

      if (retries >= maxRetries) {
        throw new Error('Container agent failed to start within expected time');
      }
    }

    // Attempt to connect to container bridge
    const connected = await this.connect();
    if (connected) {
      console.log('[BRIDGE] ✅ Container bridge initialized successfully');
      return true;
    } else {
      console.warn('[BRIDGE] ⚠️ Failed to connect to container bridge, but bridge initialized');
      return true; // Still return true as bridge is ready for later connection
    }
  }

  /**
   * Request all hardware permissions automatically
   */
  async requestAllPermissions(): Promise<void> {
    console.log('[BRIDGE] Requesting hardware permissions...');

    // Request camera and microphone together
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    console.log('[BRIDGE] ✅ Camera and microphone permissions granted');

    // Stop the stream immediately - we just needed permissions
    stream.getTracks().forEach((track) => track.stop());

    this.capabilities.camera = true;
    this.capabilities.microphone = true;

    // Request screen capture permission
    const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
      video: true,
    });

    console.log('[BRIDGE] ✅ Screen capture permission granted');

    // Stop the stream immediately
    screenStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());

    this.capabilities.screen = true;
  }

  /**
   * Connect with container lifecycle awareness
   */
  async connectToContainer(): Promise<boolean> {
    if (!this.config.containerMode) {
      console.error('[BRIDGE] Not in container mode, use connect() instead');
      return false;
    }

    const sandboxManager = this.config.sandboxManager;
    if (!sandboxManager) {
      console.error('[BRIDGE] No sandbox manager available');
      return false;
    }

    // Check if containers are running
    const status = await sandboxManager.getStatus();
    if (!status.services.agent || status.services.agent.status !== 'running') {
      console.log('[BRIDGE] Agent container not running, starting containers...');
      const started = await sandboxManager.startContainers();
      if (!started) {
        throw new Error('Failed to start containers');
      }
    }

    // Now attempt connection
    return await this.connect();
  }

  /**
   * Start streaming with container readiness check
   */
  async startStreamingToContainer(): Promise<boolean> {
    if (!this.config.containerMode) {
      return this.startStreaming();
    }

    // Ensure we're connected first
    if (!this.isConnected) {
      const connected = await this.connectToContainer();
      if (!connected) {
        console.error('[BRIDGE] Cannot start streaming - not connected to container');
        return false;
      }
    }

    // Check capabilities before streaming
    const caps = await this.checkCapabilities();

    // Start streaming based on available capabilities
    let streamStarted = false;

    if (caps.camera) {
      await this.startCameraStream();
      streamStarted = true;
      console.log('[BRIDGE] ✅ Camera streaming to container started');
    }

    if (caps.microphone) {
      await this.startMicrophoneStream();
      streamStarted = true;
      console.log('[BRIDGE] ✅ Microphone streaming to container started');
    }

    if (caps.screen) {
      await this.startScreenStream();
      streamStarted = true;
      console.log('[BRIDGE] ✅ Screen streaming to container started');
    }

    if (streamStarted) {
      this.isStreaming = true;
      console.log('[BRIDGE] ✅ Hardware streaming to container active');
    } else {
      console.warn('[BRIDGE] ⚠️ No hardware streams could be started');
    }

    return streamStarted;
  }

  /**
   * Shutdown bridge with container cleanup
   */
  async shutdown(): Promise<void> {
    console.log('[BRIDGE] Shutting down hardware bridge...');

    // Stop all streaming
    this.stopAllStreaming();

    // Disconnect from container
    this.disconnect();

    // If we have a sandbox manager and we're in container mode, register shutdown handler
    if (this.config.containerMode && this.config.sandboxManager) {
      this.config.sandboxManager.addShutdownHandler(async () => {
        console.log('[BRIDGE] Container shutdown detected, cleaning up bridge...');
        this.stopAllStreaming();
        this.disconnect();
      });
    }

    console.log('[BRIDGE] ✅ Hardware bridge shutdown complete');
  }

  /**
   * Get bridge status including container information
   */
  async getStatus(): Promise<any> {
    const status: any = {
      connected: this.isConnected,
      streaming: this.isStreaming,
      capabilities: this.capabilities,
      streamingStatus: this.streamingStatus,
      containerMode: this.config.containerMode,
      config: {
        containerHost: this.config.containerHost,
        containerPort: this.config.containerPort,
        streamQuality: this.config.streamQuality,
      },
    };

    // Add container status if available
    if (this.config.containerMode && this.config.sandboxManager) {
      const containerStatus = await this.config.sandboxManager.getStatus();
      status.containerStatus = {
        agentRunning: containerStatus.services.agent?.status === 'running',
        postgresRunning: containerStatus.services.postgres?.status === 'running',
        overallHealth: containerStatus.health,
      };
    }

    return status;
  }

  // Audio Output Methods

  /**
   * Handle audio output from agent (binary audio data)
   */
  private async handleAudioOutput(message: any): Promise<void> {
    if (!this.capabilities.speakers || !this.outputAudioContext) {
      console.warn('[BRIDGE] Audio output not available');
      return;
    }

    const { data, format: _format, sampleRate: _sampleRate } = message;

    // Decode base64 audio data
    const audioData = new Uint8Array(
      atob(data.replace(/^data:audio\/[^;]+;base64,/, ''))
        .split('')
        .map((char) => char.charCodeAt(0))
    );

    // Decode audio buffer
    const audioBuffer = await this.outputAudioContext.decodeAudioData(audioData.buffer);

    // Create source and play
    const source = this.outputAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputAudioContext.destination);

    console.log('[BRIDGE] Playing audio from agent');
    source.start(0);

    source.onended = () => {
      console.log('[BRIDGE] Audio playback completed');
    };
  }

  /**
   * Handle text-to-speech from agent
   */
  private async handleTextToSpeech(message: any): Promise<void> {
    if (!this.capabilities.speakers) {
      console.warn('[BRIDGE] Speech synthesis not available');
      return;
    }

    const { text, voice, rate, pitch } = message.data || {};

    if (!text) {
      console.warn('[BRIDGE] No text provided for TTS');
      return;
    }

    // Use Web Speech API for text-to-speech
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);

      // Configure voice settings
      if (voice) {
        const voices = speechSynthesis.getVoices();
        const selectedVoice = voices.find(
          (v) =>
            v.name.toLowerCase().includes(voice.toLowerCase()) ||
            v.lang.toLowerCase().includes(voice.toLowerCase())
        );
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      if (rate !== undefined) {
        utterance.rate = Math.max(0.1, Math.min(10, rate));
      }
      if (pitch !== undefined) {
        utterance.pitch = Math.max(0, Math.min(2, pitch));
      }

      console.log('[BRIDGE] Speaking text from agent:', `${text.substring(0, 50)}...`);

      utterance.onstart = () => console.log('[BRIDGE] Speech started');
      utterance.onend = () => console.log('[BRIDGE] Speech ended');
      utterance.onerror = (error) => console.error('[BRIDGE] Speech error:', error);

      speechSynthesis.speak(utterance);
    } else {
      console.warn('[BRIDGE] Speech synthesis not supported in this browser');
    }
  }

  /**
   * Play a simple beep or notification sound
   */
  public async playNotificationSound(
    frequency: number = 800,
    duration: number = 200
  ): Promise<void> {
    if (!this.capabilities.speakers || !this.outputAudioContext) {
      console.warn('[BRIDGE] Audio output not available for notification');
      return;
    }

    // Resume context if suspended (required for user interaction)
    if (this.outputAudioContext.state === 'suspended') {
      await this.outputAudioContext.resume();
    }

    const oscillator = this.outputAudioContext.createOscillator();
    const gainNode = this.outputAudioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.outputAudioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.outputAudioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, this.outputAudioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.outputAudioContext.currentTime + duration / 1000
    );

    oscillator.start(this.outputAudioContext.currentTime);
    oscillator.stop(this.outputAudioContext.currentTime + duration / 1000);

    console.log('[BRIDGE] Played notification sound');
  }

  /**
   * Handle notification sound from agent
   */
  private async handleNotificationSound(message: any): Promise<void> {
    const { data } = message;
    const { frequency, duration } = data || {};

    await this.playNotificationSound(frequency, duration);
  }

  /**
   * Clean up audio output resources
   */
  private cleanupAudioOutput(): void {
    if (this.outputAudioContext) {
      this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
  }

  /**
   * Start all streaming (missing method referenced in startStreamingToContainer)
   */
  private async startStreaming(): Promise<boolean> {
    // Start all available streams
    let streamStarted = false;

    if (this.capabilities.camera) {
      await this.startCameraStream();
      streamStarted = true;
    }

    if (this.capabilities.microphone) {
      await this.startMicrophoneStream();
      streamStarted = true;
    }

    if (this.capabilities.screen) {
      await this.startScreenStream();
      streamStarted = true;
    }

    this.isStreaming = streamStarted;
    return streamStarted;
  }
}
