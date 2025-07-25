import {
  type PluginRequirements,
  type PluginCapabilities,
  type ActionCapability,
  type ProviderCapability,
  type ServiceCapability,
  type EvaluatorCapability,
  type APIIntegration,
  type EnvironmentVariable,
} from '../types/index';

/**
 * RequirementParser - Extracts plugin requirements from natural language
 */
export class RequirementParser {
  /**
   * Parse natural language description into structured requirements
   */
  static parseFromDescription(description: string): PluginRequirements {
    const text = description.toLowerCase();

    // Extract plugin name
    const name = this.extractPluginName(text);

    // Extract capabilities
    const capabilities = this.extractCapabilities(text, description);

    return {
      name,
      description: description.trim(),
      capabilities,
      complexity: this.assessComplexity(capabilities),
      estimatedDevelopmentTime: this.estimateDevelopmentTime(capabilities),
    };
  }

  /**
   * Extract plugin name from description
   */
  private static extractPluginName(text: string): string {
    // Look for explicit plugin name patterns
    const namePatterns = [
      /create\s+(?:a\s+)?(\w+)\s+plugin/i,
      /build\s+(?:a\s+)?(\w+)\s+plugin/i,
      /make\s+(?:a\s+)?(\w+)\s+plugin/i,
      /(\w+)\s+plugin/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return this.capitalize(match[1]);
      }
    }

    // Fallback: extract from common keywords
    if (text.includes('weather')) return 'Weather';
    if (text.includes('todo') || text.includes('task')) return 'Todo';
    if (text.includes('crypto') || text.includes('bitcoin') || text.includes('ethereum'))
      return 'Crypto';
    if (text.includes('email') || text.includes('mail')) return 'Email';
    if (text.includes('calendar') || text.includes('schedule')) return 'Calendar';
    if (text.includes('news')) return 'News';
    if (text.includes('translate') || text.includes('translation')) return 'Translator';
    if (text.includes('image') || text.includes('photo')) return 'Image';
    if (text.includes('music') || text.includes('song')) return 'Music';
    if (text.includes('database') || text.includes('db')) return 'Database';
    if (text.includes('web') || text.includes('browser')) return 'Web';
    if (text.includes('file') || text.includes('document')) return 'File';

    return 'Custom';
  }

  /**
   * Extract capabilities from description
   */
  private static extractCapabilities(
    text: string,
    originalDescription: string
  ): PluginCapabilities {
    return {
      actions: this.extractActions(text, originalDescription),
      providers: this.extractProviders(text, originalDescription),
      services: this.extractServices(text, originalDescription),
      evaluators: this.extractEvaluators(text, originalDescription),
      apiIntegrations: this.extractAPIIntegrations(text, originalDescription),
      envVars: this.extractEnvironmentVariables(text, originalDescription),
    };
  }

  /**
   * Extract action capabilities
   */
  private static extractActions(text: string, description: string): ActionCapability[] {
    const actions: ActionCapability[] = [];

    // Common action patterns
    const actionPatterns = [
      {
        pattern: /get\s+weather|fetch\s+weather|weather\s+data/,
        name: 'GET_WEATHER',
        desc: 'Get current weather information',
        triggers: ['weather', 'get weather', 'current weather'],
      },
      {
        pattern: /create\s+todo|add\s+task|new\s+todo/,
        name: 'CREATE_TODO',
        desc: 'Create a new todo item',
        triggers: ['create todo', 'add task', 'new todo'],
      },
      {
        pattern: /search|find|lookup/,
        name: 'SEARCH',
        desc: 'Search for information',
        triggers: ['search', 'find', 'lookup'],
      },
      {
        pattern: /send\s+email|email/,
        name: 'SEND_EMAIL',
        desc: 'Send an email message',
        triggers: ['send email', 'email'],
      },
      {
        pattern: /translate|translation/,
        name: 'TRANSLATE',
        desc: 'Translate text between languages',
        triggers: ['translate', 'translation'],
      },
      {
        pattern: /calculate|compute|math/,
        name: 'CALCULATE',
        desc: 'Perform calculations',
        triggers: ['calculate', 'compute', 'math'],
      },
      {
        pattern: /crypto|bitcoin|ethereum|price/,
        name: 'GET_CRYPTO_PRICE',
        desc: 'Get cryptocurrency prices',
        triggers: ['crypto price', 'bitcoin', 'ethereum'],
      },
      {
        pattern: /news|headlines/,
        name: 'GET_NEWS',
        desc: 'Get latest news',
        triggers: ['news', 'headlines'],
      },
      {
        pattern: /generate\s+image|create\s+image/,
        name: 'GENERATE_IMAGE',
        desc: 'Generate or create images',
        triggers: ['generate image', 'create image'],
      },
      {
        pattern: /upload\s+file|save\s+file/,
        name: 'UPLOAD_FILE',
        desc: 'Upload or save files',
        triggers: ['upload file', 'save file'],
      },
    ];

    for (const actionDef of actionPatterns) {
      if (actionDef.pattern.test(text)) {
        actions.push({
          name: actionDef.name,
          description: actionDef.desc,
          triggers: actionDef.triggers,
        });
      }
    }

    // If no specific actions found, create a generic one
    if (actions.length === 0) {
      const pluginName = this.extractPluginName(text);
      actions.push({
        name: `${pluginName.toUpperCase()}_ACTION`,
        description: `Perform ${pluginName.toLowerCase()} operations`,
        triggers: [pluginName.toLowerCase(), `use ${pluginName.toLowerCase()}`],
      });
    }

    return actions;
  }

  /**
   * Extract provider capabilities
   */
  private static extractProviders(text: string, description: string): ProviderCapability[] {
    const providers: ProviderCapability[] = [];

    // Common provider patterns
    const providerPatterns = [
      {
        pattern: /weather|temperature|forecast/,
        name: 'WEATHER_INFO',
        desc: 'Provide weather information',
        dataType: 'weather_data',
      },
      {
        pattern: /location|gps|coordinates/,
        name: 'LOCATION_INFO',
        desc: 'Provide location information',
        dataType: 'location_data',
      },
      {
        pattern: /time|date|timestamp/,
        name: 'TIME_INFO',
        desc: 'Provide time and date information',
        dataType: 'time_data',
      },
      {
        pattern: /user\s+profile|user\s+info/,
        name: 'USER_PROFILE',
        desc: 'Provide user profile information',
        dataType: 'user_data',
      },
      {
        pattern: /system\s+info|system\s+status/,
        name: 'SYSTEM_INFO',
        desc: 'Provide system information',
        dataType: 'system_data',
      },
      {
        pattern: /market|price|stock/,
        name: 'MARKET_DATA',
        desc: 'Provide market data',
        dataType: 'market_data',
      },
    ];

    for (const providerDef of providerPatterns) {
      if (providerDef.pattern.test(text)) {
        providers.push({
          name: providerDef.name,
          description: providerDef.desc,
          dataType: providerDef.dataType,
          updateFrequency: 'on-demand',
        });
      }
    }

    return providers;
  }

  /**
   * Extract service capabilities
   */
  private static extractServices(text: string, description: string): ServiceCapability[] {
    const services: ServiceCapability[] = [];

    // Common service patterns
    const servicePatterns = [
      {
        pattern: /api|http|rest|endpoint/,
        name: 'APIClient',
        desc: 'Handle API communications',
        type: 'api-client' as const,
      },
      {
        pattern: /database|db|storage/,
        name: 'DatabaseManager',
        desc: 'Manage database operations',
        type: 'database' as const,
      },
      {
        pattern: /websocket|socket|realtime/,
        name: 'WebSocketService',
        desc: 'Handle WebSocket connections',
        type: 'websocket' as const,
      },
      {
        pattern: /background|monitor|watch|schedule/,
        name: 'BackgroundProcessor',
        desc: 'Handle background processing',
        type: 'background' as const,
      },
    ];

    for (const serviceDef of servicePatterns) {
      if (serviceDef.pattern.test(text)) {
        services.push({
          name: serviceDef.name,
          description: serviceDef.desc,
          type: serviceDef.type,
        });
      }
    }

    return services;
  }

  /**
   * Extract evaluator capabilities
   */
  private static extractEvaluators(text: string, description: string): EvaluatorCapability[] {
    const evaluators: EvaluatorCapability[] = [];

    // Common evaluator patterns
    if (text.includes('sentiment') || text.includes('mood')) {
      evaluators.push({
        name: 'SENTIMENT_EVALUATOR',
        description: 'Evaluate sentiment and mood',
        trigger: 'always',
      });
    }

    if (text.includes('quality') || text.includes('score')) {
      evaluators.push({
        name: 'QUALITY_EVALUATOR',
        description: 'Evaluate response quality',
        trigger: 'conditional',
        condition: 'response_generated',
      });
    }

    return evaluators;
  }

  /**
   * Extract API integration requirements
   */
  private static extractAPIIntegrations(text: string, description: string): APIIntegration[] {
    const integrations: APIIntegration[] = [];

    // Common API patterns
    const apiPatterns = [
      {
        pattern: /openweather|weather\s+api|weather.*api/,
        name: 'OpenWeatherMap',
        baseUrl: 'https://api.openweathermap.org/data/2.5',
        requiresAuth: true,
        authType: 'api-key' as const,
        endpoints: [
          { path: '/weather', method: 'GET' as const, description: 'Get current weather' },
          { path: '/forecast', method: 'GET' as const, description: 'Get weather forecast' },
        ],
      },
      {
        pattern: /coinbase|crypto.*api|cryptocurrency/,
        name: 'CoinbaseAPI',
        baseUrl: 'https://api.coinbase.com/v2',
        requiresAuth: true,
        authType: 'api-key' as const,
        endpoints: [
          { path: '/exchange-rates', method: 'GET' as const, description: 'Get exchange rates' },
          {
            path: '/prices/{currency_pair}/spot',
            method: 'GET' as const,
            description: 'Get spot price',
          },
        ],
      },
      {
        pattern: /news.*api|newsapi/,
        name: 'NewsAPI',
        baseUrl: 'https://newsapi.org/v2',
        requiresAuth: true,
        authType: 'api-key' as const,
        endpoints: [
          { path: '/top-headlines', method: 'GET' as const, description: 'Get top headlines' },
          { path: '/everything', method: 'GET' as const, description: 'Search news articles' },
        ],
      },
    ];

    for (const apiDef of apiPatterns) {
      if (apiDef.pattern.test(text)) {
        integrations.push({
          name: apiDef.name,
          baseUrl: apiDef.baseUrl,
          requiresAuth: apiDef.requiresAuth,
          authType: apiDef.authType,
          endpoints: apiDef.endpoints,
        });
      }
    }

    return integrations;
  }

  /**
   * Extract environment variable requirements
   */
  private static extractEnvironmentVariables(
    text: string,
    description: string
  ): EnvironmentVariable[] {
    const envVars: EnvironmentVariable[] = [];

    // API key requirements based on integrations
    if (text.includes('weather') || text.includes('openweather')) {
      envVars.push({
        name: 'OPENWEATHER_API_KEY',
        description: 'API key for OpenWeatherMap service',
        required: true,
        sensitive: true,
      });
    }

    if (text.includes('crypto') || text.includes('coinbase')) {
      envVars.push({
        name: 'COINBASE_API_KEY',
        description: 'API key for Coinbase service',
        required: true,
        sensitive: true,
      });
    }

    if (text.includes('news') || text.includes('newsapi')) {
      envVars.push({
        name: 'NEWS_API_KEY',
        description: 'API key for News API service',
        required: true,
        sensitive: true,
      });
    }

    if (text.includes('email') || text.includes('smtp')) {
      envVars.push(
        {
          name: 'SMTP_HOST',
          description: 'SMTP server hostname',
          required: true,
          sensitive: false,
        },
        {
          name: 'SMTP_USER',
          description: 'SMTP username',
          required: true,
          sensitive: false,
        },
        {
          name: 'SMTP_PASS',
          description: 'SMTP password',
          required: true,
          sensitive: true,
        }
      );
    }

    if (text.includes('database') || text.includes('db')) {
      envVars.push({
        name: 'DATABASE_URL',
        description: 'Database connection URL',
        required: true,
        sensitive: true,
      });
    }

    return envVars;
  }

  /**
   * Assess complexity based on capabilities
   */
  private static assessComplexity(
    capabilities: PluginCapabilities
  ): 'simple' | 'medium' | 'complex' {
    let complexityScore = 0;

    complexityScore += capabilities.actions.length * 2;
    complexityScore += capabilities.providers.length * 1;
    complexityScore += capabilities.services.length * 3;
    complexityScore += capabilities.evaluators.length * 2;
    complexityScore += capabilities.apiIntegrations.length * 4;
    complexityScore += capabilities.envVars.length * 1;

    if (complexityScore <= 5) return 'simple';
    if (complexityScore <= 15) return 'medium';
    return 'complex';
  }

  /**
   * Estimate development time
   */
  private static estimateDevelopmentTime(capabilities: PluginCapabilities): string {
    const complexity = this.assessComplexity(capabilities);

    switch (complexity) {
      case 'simple':
        return '5-10 minutes';
      case 'medium':
        return '10-20 minutes';
      case 'complex':
        return '20-30 minutes';
      default:
        return '10-15 minutes';
    }
  }

  /**
   * Capitalize first letter
   */
  private static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}
