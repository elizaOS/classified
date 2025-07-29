/**
 * ElevenLabs Generation Provider
 * Handles high-quality speech synthesis and voice generation
 */

import {
  GenerationRequest,
  GenerationType,
  GenerationProvider,
  AudioGenerationRequest,
  SpeechGenerationRequest,
} from '../../types';
import {
  BaseGenerationProvider,
  ProviderGenerationResult,
  ProviderConfig,
  ProviderCapabilities,
} from './BaseGenerationProvider';

interface ElevenLabsConfig extends ProviderConfig {
  model?: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  samples?: any[];
  category: string;
  fine_tuning: {
    language: string;
    is_allowed_to_fine_tune: boolean;
    fine_tuning_requested: boolean;
    finetuning_state: string;
    verification_attempts: any[];
    verification_failures: string[];
    verification_attempts_count: number;
  };
  labels: Record<string, string>;
  description: string;
  preview_url: string;
  available_for_tiers: string[];
  settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  sharing?: {
    status: string;
    history_item_sample_id: string;
    original_voice_id: string;
    public_owner_id: string;
    liked_by_count: number;
    cloned_by_count: number;
    name: string;
    description: string;
    labels: Record<string, string>;
    category: string;
    created_at: string;
    notice_period: number;
  };
  high_quality_base_model_ids: string[];
}

export class ElevenLabsProvider extends BaseGenerationProvider {
  private apiClient: any;
  private voices: Map<string, ElevenLabsVoice> = new Map();

  constructor(config?: ElevenLabsConfig) {
    super(
      {
        apiKey: config?.apiKey || process.env.ELEVENLABS_API_KEY || '',
        baseUrl: config?.baseUrl || 'https://api.elevenlabs.io/v1',
        timeout: config?.timeout || 30000,
        retryAttempts: config?.retryAttempts || 3,
        rateLimitPerSecond: config?.rateLimitPerSecond || 2,
      },
      GenerationProvider.ELEVENLABS,
    );

    this.initializeClient(config);
  }

  private initializeClient(config?: ElevenLabsConfig): void {
    // Initialize HTTP client for ElevenLabs API
    this.apiClient = {
      baseURL: this.config.baseUrl,
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.config.apiKey,
      },
      timeout: this.config.timeout,
    };

    // Load available voices
    this.loadVoices().catch((error) => {
      console.warn('Failed to load ElevenLabs voices:', error);
    });
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportedTypes: [GenerationType.AUDIO, GenerationType.SPEECH],
      maxPromptLength: 5000,
      maxOutputs: 1,
      supportsBatch: false,
      supportsCancel: false,
      supportsProgress: false,
      qualityLevels: [
        'turbo_v2',
        'eleven_monolingual_v1',
        'eleven_multilingual_v2',
      ],
      outputFormats: {
        [GenerationType.AUDIO]: ['mp3', 'wav', 'flac', 'ogg'],
        [GenerationType.SPEECH]: ['mp3', 'wav', 'flac', 'ogg'],
        [GenerationType.TEXT]: [],
        [GenerationType.IMAGE]: [],
        [GenerationType.VIDEO]: [],
        [GenerationType.THREE_D]: [],
        [GenerationType.AVATAR]: [],
        [GenerationType.MUSIC]: [],
        [GenerationType.CODE]: [],
        [GenerationType.DOCUMENT]: [],
      },
    };
  }

  async generate(
    request: GenerationRequest,
  ): Promise<ProviderGenerationResult> {
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
    }

    await this.rateLimitDelay();

    if (request.type === GenerationType.SPEECH) {
      return this.generateSpeech(request as SpeechGenerationRequest);
    }

    throw new Error(
      `Generation type ${request.type} not supported by ElevenLabs provider`,
    );
  }

  private async generateSpeech(
    request: SpeechGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    try {
      const voiceId = request.voice_id || (await this.getDefaultVoice());
      const voiceSettings = this.normalizeVoiceSettings(request.voice_settings);

      const response = await this.withRetry(async () => {
        return await this.makeRequest(`/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.config.apiKey,
          },
          body: JSON.stringify({
            text: request.prompt,
            model_id: this.selectModel(request),
            voice_settings: voiceSettings,
            pronunciation_dictionary_locators: [],
            seed: request.metadata?.seed,
            previous_text: request.metadata?.previous_text,
            next_text: request.metadata?.next_text,
            previous_request_ids: request.metadata?.previous_request_ids,
            next_request_ids: request.metadata?.next_request_ids,
          }),
        });
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `ElevenLabs API error: ${response.status} ${errorData.detail || response.statusText}`,
        );
      }

      const audioBuffer = await response.arrayBuffer();
      const format = this.getOutputFormat(request.output_format);

      const output = {
        id: this.generateOutputId(),
        url: '', // Will be set after upload to storage
        format,
        size: audioBuffer.byteLength,
        metadata: {
          voice_id: voiceId,
          voice_name: this.voices.get(voiceId)?.name || 'Unknown',
          model_id: this.selectModel(request),
          voice_settings: voiceSettings,
          text_length: request.prompt.length,
          estimated_duration: this.estimateDuration(request.prompt),
          buffer: audioBuffer, // Temporary, will be uploaded to storage
        },
      };

      const charactersUsed = request.prompt.length;
      const cost = this.calculateSpeechCost(charactersUsed);
      const creditsUsed = Math.ceil(charactersUsed / 100);

      return {
        outputs: [output],
        cost,
        credits_used: creditsUsed,
        metadata: {
          voice_id: voiceId,
          model_id: this.selectModel(request),
          characters_used: charactersUsed,
          estimated_duration: output.metadata.estimated_duration,
        },
      };
    } catch (error) {
      throw this.handleProviderError(error);
    }
  }

  async getVoices(): Promise<ElevenLabsVoice[]> {
    try {
      const response = await this.makeRequest('/voices');
      const data = await response.json();

      if (data.voices) {
        // Update internal voices cache
        data.voices.forEach((voice: ElevenLabsVoice) => {
          this.voices.set(voice.voice_id, voice);
        });

        return data.voices;
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      return [];
    }
  }

  async getVoiceSettings(voiceId: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/voices/${voiceId}/settings`);
      return await response.json();
    } catch (error) {
      console.error(`Failed to get voice settings for ${voiceId}:`, error);
      return null;
    }
  }

  async estimateCost(request: GenerationRequest): Promise<number> {
    if (
      request.type === GenerationType.AUDIO ||
      request.type === GenerationType.SPEECH
    ) {
      return this.calculateSpeechCost(request.prompt.length);
    }
    return 0;
  }

  protected async performHealthCheck(): Promise<void> {
    try {
      const response = await this.makeRequest('/user');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`ElevenLabs health check failed: ${error}`);
    }
  }

  protected validateTypeSpecificRequest(
    request: GenerationRequest,
    errors: string[],
  ): void {
    if (
      request.type === GenerationType.AUDIO ||
      request.type === GenerationType.SPEECH
    ) {
      const audioRequest = request as AudioGenerationRequest;

      // Validate voice settings
      if (audioRequest.voice_settings) {
        const settings = audioRequest.voice_settings;

        if (
          settings.stability !== undefined &&
          (settings.stability < 0 || settings.stability > 1)
        ) {
          errors.push('Voice stability must be between 0 and 1');
        }

        if (
          settings.similarity_boost !== undefined &&
          (settings.similarity_boost < 0 || settings.similarity_boost > 1)
        ) {
          errors.push('Voice similarity_boost must be between 0 and 1');
        }

        if (
          settings.style !== undefined &&
          (settings.style < 0 || settings.style > 1)
        ) {
          errors.push('Voice style must be between 0 and 1');
        }
      }

      // Validate output format
      const supportedFormats = ['mp3', 'wav', 'flac', 'ogg'];
      if (
        audioRequest.output_format &&
        !supportedFormats.includes(audioRequest.output_format)
      ) {
        errors.push(
          `Output format must be one of: ${supportedFormats.join(', ')}`,
        );
      }

      // Validate text length for turbo model
      if (request.prompt.length > 2500) {
        errors.push(
          'Text length exceeds maximum of 2500 characters for turbo model',
        );
      }
    }
  }

  // Helper methods

  private async loadVoices(): Promise<void> {
    const voices = await this.getVoices();
    voices.forEach((voice) => {
      this.voices.set(voice.voice_id, voice);
    });
  }

  private async getDefaultVoice(): Promise<string> {
    if (this.voices.size === 0) {
      await this.loadVoices();
    }

    // Return first available voice or a well-known default
    const defaultVoices = [
      'pNInz6obpgDQGcFmaJgB', // Adam
      '21m00Tcm4TlvDq8ikWAM', // Rachel
      'AZnzlk1XvdvUeBnXmlld', // Domi
      'EXAVITQu4vr4xnSDxMaL', // Bella
    ];

    for (const voiceId of defaultVoices) {
      if (this.voices.has(voiceId)) {
        return voiceId;
      }
    }

    // Return first available voice
    const firstVoice = Array.from(this.voices.keys())[0];
    if (firstVoice) {
      return firstVoice;
    }

    throw new Error('No voices available');
  }

  private normalizeVoiceSettings(settings?: any): any {
    const defaults = {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
    };

    return { ...defaults, ...settings };
  }

  private selectModel(
    request: AudioGenerationRequest | SpeechGenerationRequest,
  ): string {
    // Select model based on text length and quality requirements
    if (request.prompt.length > 2500) {
      return 'eleven_multilingual_v2'; // Better for longer texts
    }

    if (request.voice_settings?.style !== undefined) {
      return 'eleven_multilingual_v2'; // Supports style parameter
    }

    return 'eleven_turbo_v2'; // Fastest for short texts
  }

  private getOutputFormat(requestedFormat?: string): string {
    const formatMap: Record<string, string> = {
      mp3: 'mp3',
      wav: 'wav',
      flac: 'flac',
      ogg: 'ogg_opus',
    };

    return formatMap[requestedFormat || 'mp3'] || 'mp3';
  }

  private estimateDuration(text: string): number {
    // Rough estimate: ~150 words per minute
    const words = text.split(/\s+/).length;
    const minutes = words / 150;
    return Math.ceil(minutes * 60); // Return seconds
  }

  private calculateSpeechCost(characters: number): number {
    // ElevenLabs pricing tiers (example)
    if (characters <= 10000) {
      return characters * 0.0003; // $0.30 per 1k characters
    } else if (characters <= 100000) {
      return characters * 0.00025; // $0.25 per 1k characters
    } else {
      return characters * 0.0002; // $0.20 per 1k characters
    }
  }

  private async makeRequest(
    endpoint: string,
    options: any = {},
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const requestOptions = {
      ...options,
      headers: {
        'xi-api-key': this.config.apiKey,
        'User-Agent': 'ElizaOS-Platform/1.0',
        ...options.headers,
      },
    };

    const response = await fetch(url, requestOptions);

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;

      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.makeRequest(endpoint, options);
    }

    return response;
  }
}
