/// <reference types="cypress" />

describe('Hardware Detection and Model Selection', () => {
  let hardwareCapabilities: any;

  before(() => {
    // Clear any existing Ollama setup
    cy.task('cleanup-ollama');
  });

  it('should detect hardware capabilities correctly', () => {
    cy.task('test-hardware-detection').then((result: any) => {
      hardwareCapabilities = result;

      // Verify basic hardware detection
      expect(result).to.have.property('platform');
      expect(result).to.have.property('totalRAM');
      expect(result).to.have.property('availableRAM');
      expect(result).to.have.property('gpu');
      expect(result).to.have.property('isAppleSilicon');
      expect(result).to.have.property('recommendedSmallModel');
      expect(result).to.have.property('recommendedLargeModel');

      // Verify platform detection
      expect(['darwin', 'linux', 'win32']).to.include(result.platform);

      // Verify RAM detection (should have at least 1GB)
      expect(result.totalRAM).to.be.greaterThan(1024 * 1024 * 1024);
      expect(result.availableRAM).to.be.greaterThan(0);
      expect(result.availableRAM).to.be.lessThanOrEqual(result.totalRAM);

      // Verify GPU detection
      expect(result.gpu).to.have.property('type');
      expect(['nvidia', 'apple', 'amd', 'intel', 'none']).to.include(result.gpu.type);
      expect(result.gpu).to.have.property('hasCUDA');

      // Verify Apple Silicon detection on macOS
      if (result.platform === 'darwin' && result.gpu.type === 'apple') {
        expect(result.isAppleSilicon).to.be.true;
        expect(result.gpu.cores).to.be.greaterThan(0);
      }

      // Verify model recommendations are valid
      const validModels = [
        'gemma3:1b',
        'gemma3:4b',
        'gemma3:12b',
        'gemma3:27b',
        'deepseek-r1:1.5b',
        'deepseek-r1:7b',
        'deepseek-r1:14b',
        'deepseek-r1:32b',
      ];
      expect(validModels).to.include(result.recommendedSmallModel);
      expect(validModels).to.include(result.recommendedLargeModel);

      cy.log('Hardware Detection Results:', JSON.stringify(result, null, 2));
    });
  });

  it('should validate model selection logic based on hardware', () => {
    expect(hardwareCapabilities).to.exist;

    const totalRAMGB = hardwareCapabilities.totalRAM / (1024 * 1024 * 1024);

    // Test model selection logic
    if (totalRAMGB >= 128) {
      // High-end system should prefer deepseek models
      expect(hardwareCapabilities.recommendedLargeModel).to.include('deepseek-r1');
      expect(hardwareCapabilities.recommendedSmallModel).to.include('deepseek-r1');
    } else if (totalRAMGB >= 32) {
      // Mid-high end system
      expect(['gemma3:27b', 'deepseek-r1:32b', 'deepseek-r1:14b']).to.include(
        hardwareCapabilities.recommendedLargeModel
      );
    } else if (totalRAMGB >= 16) {
      // Mid-range system
      expect(['gemma3:12b', 'deepseek-r1:14b', 'deepseek-r1:7b']).to.include(
        hardwareCapabilities.recommendedLargeModel
      );
    } else if (totalRAMGB >= 8) {
      // Lower-end system
      expect(['gemma3:4b', 'deepseek-r1:7b']).to.include(
        hardwareCapabilities.recommendedLargeModel
      );
    }

    cy.log(`System RAM: ${totalRAMGB.toFixed(2)}GB`);
    cy.log(`Selected Small Model: ${hardwareCapabilities.recommendedSmallModel}`);
    cy.log(`Selected Large Model: ${hardwareCapabilities.recommendedLargeModel}`);
  });

  it('should integrate with ProviderSelectionService correctly', () => {
    cy.task('test-provider-selection').then((result: any) => {
      // Verify provider selection works
      expect(result).to.have.property('provider');
      expect(result).to.have.property('textProvider');
      expect(result).to.have.property('embeddingProvider');
      expect(result).to.have.property('textEmbeddingModel');
      expect(result).to.have.property('setupComplete');

      // If local provider was selected, verify it uses hardware-optimized models
      if (result.provider === 'local') {
        expect(result).to.have.property('ollamaModel');

        // Should use one of the hardware-recommended models
        const validModels = [
          hardwareCapabilities.recommendedSmallModel,
          hardwareCapabilities.recommendedLargeModel,
        ];
        expect(validModels).to.include(result.ollamaModel);
      }

      cy.log('Provider Selection Result:', JSON.stringify(result, null, 2));
    });
  });

  it('should handle error scenarios gracefully', () => {
    // Test with invalid hardware detection
    cy.task('test-hardware-detection-error').then((result: any) => {
      expect(result).to.have.property('recommendedSmallModel');
      expect(result).to.have.property('recommendedLargeModel');

      // Should fallback to safe defaults
      expect(['gemma3:1b', 'gemma3:4b']).to.include(result.recommendedSmallModel);
      expect(['gemma3:4b', 'gemma3:12b']).to.include(result.recommendedLargeModel);
    });
  });

  it('should start game backend with hardware-optimized Ollama setup', () => {
    // Start the game backend and verify it uses hardware detection
    cy.task('start-game-backend-with-ollama').then((result: any) => {
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('hardwareCapabilities');
      expect(result).to.have.property('selectedModel');

      // Verify the selected model matches hardware recommendations
      const validModels = [
        result.hardwareCapabilities.recommendedSmallModel,
        result.hardwareCapabilities.recommendedLargeModel,
      ];
      expect(validModels).to.include(result.selectedModel);

      cy.log('Game Backend Started Successfully');
      cy.log('Selected Model:', result.selectedModel);
      cy.log('Hardware Capabilities:', JSON.stringify(result.hardwareCapabilities, null, 2));
    });
  });

  it('should verify Ollama models are downloaded correctly', () => {
    // Check that the recommended models are actually available
    cy.task('check-ollama-models').then((models: string[]) => {
      expect(models).to.be.an('array');
      expect(models.length).to.be.greaterThan(0);

      // Should include at least one of the recommended models
      const hasRecommendedModel = models.some(
        (model) =>
          model === hardwareCapabilities.recommendedSmallModel ||
          model === hardwareCapabilities.recommendedLargeModel
      );
      expect(hasRecommendedModel).to.be.true;

      cy.log('Available Ollama Models:', models);
    });
  });

  after(() => {
    // Cleanup any test resources
    cy.task('cleanup-test-resources');
  });
});
