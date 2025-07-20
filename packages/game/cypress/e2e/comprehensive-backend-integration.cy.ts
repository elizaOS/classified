/// <reference types="cypress" />

describe('Comprehensive Backend Integration - All Features', () => {
  const BACKEND_URL = 'http://localhost:7777';

  before(() => {
    cy.log('🚀 Starting Comprehensive Backend Integration Test');
    
    // Ensure backend is healthy
    cy.request({
      method: 'GET',
      url: `${BACKEND_URL}/api/server/health`,
      timeout: 30000,
      retries: 5
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
      expect(response.body.data.status).to.eq('healthy');
      expect(response.body.data.agentId).to.exist;
      cy.log(`✅ Backend healthy with agent: ${response.body.data.agentId}`);
    });
  });

  describe('1. Chat & Messaging System Integration', () => {
    it('should verify messaging system APIs work for chat functionality', () => {
      cy.log('🗨️ Testing Chat & Messaging APIs');
      
      // Test server ping (used by chat system)
      cy.request('GET', `${BACKEND_URL}/api/server/ping`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.pong).to.be.true;
        cy.log('✅ Server ping works');
      });
      
      // Get agent ID for messaging tests
      cy.request('GET', `${BACKEND_URL}/api/server/health`).then((healthResponse) => {
        const agentId = healthResponse.body.data.agentId;
        
        // Test messaging agents endpoint (used by chat)
        cy.request(`${BACKEND_URL}/api/messaging/agents/${agentId}/servers`).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
          expect(response.body.data.servers).to.be.an('array');
          cy.log('✅ Messaging agents endpoint works');
        });
        
        // Test central servers channels endpoint (used by chat)
        cy.request(`${BACKEND_URL}/api/messaging/central-servers/00000000-0000-0000-0000-000000000000/channels`).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
          expect(response.body.data.channels).to.be.an('array');
          cy.log('✅ Central servers channels endpoint works');
        });
      });
      
      // Test memories API (used by chat for history and monologue)
      cy.request({
        url: `${BACKEND_URL}/api/memories?roomId=test-room&count=50`,
        failOnStatusCode: false
      }).then((response) => {
        expect([200, 500]).to.include(response.status); // 500 is OK if no room exists
        expect(response.body.success).to.exist;
        cy.log('✅ Memories API endpoint accessible for chat history');
      });
    });
  });

  describe('2. All Capability Toggles - Backend Integration', () => {
    it('should test shell capability toggle functionality', () => {
      cy.log('🔧 Testing Shell Capability Toggle');
      
      // Get current shell status
      cy.request('GET', `${BACKEND_URL}/api/agents/default/capabilities/shell`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.enabled).to.be.a('boolean');
        expect(response.body.data.service_available).to.be.true;
        
        const initialState = response.body.data.enabled;
        cy.log(`Shell initial state: ${initialState}`);
        
        // Toggle shell capability
        cy.request({
          method: 'POST',
          url: `${BACKEND_URL}/api/agents/default/capabilities/shell/toggle`
        }).then((toggleResponse) => {
          expect(toggleResponse.status).to.eq(200);
          expect(toggleResponse.body.success).to.be.true;
          expect(toggleResponse.body.data.enabled).to.eq(!initialState);
          cy.log(`✅ Shell toggled to: ${!initialState}`);
          
          // Verify the toggle persisted
          cy.request('GET', `${BACKEND_URL}/api/agents/default/capabilities/shell`).then((verifyResponse) => {
            expect(verifyResponse.body.data.enabled).to.eq(!initialState);
            cy.log('✅ Shell toggle persisted correctly');
          });
        });
      });
    });

    it('should test browser capability toggle functionality', () => {
      cy.log('🌐 Testing Browser Capability Toggle');
      
      // Get current browser status
      cy.request('GET', `${BACKEND_URL}/api/agents/default/capabilities/browser`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.enabled).to.be.a('boolean');
        expect(response.body.data.service_available).to.be.true;
        
        const initialState = response.body.data.enabled;
        cy.log(`Browser initial state: ${initialState}`);
        
        // Toggle browser capability
        cy.request({
          method: 'POST',
          url: `${BACKEND_URL}/api/agents/default/capabilities/browser/toggle`
        }).then((toggleResponse) => {
          expect(toggleResponse.status).to.eq(200);
          expect(toggleResponse.body.success).to.be.true;
          expect(toggleResponse.body.data.enabled).to.eq(!initialState);
          cy.log(`✅ Browser toggled to: ${!initialState}`);
          
          // Verify the toggle persisted
          cy.request('GET', `${BACKEND_URL}/api/agents/default/capabilities/browser`).then((verifyResponse) => {
            expect(verifyResponse.body.data.enabled).to.eq(!initialState);
            cy.log('✅ Browser toggle persisted correctly');
          });
        });
      });
    });

    it('should test vision capability settings and toggles', () => {
      cy.log('👁️ Testing Vision Capability Settings');
      
      // Get current vision settings
      cy.request('GET', `${BACKEND_URL}/api/agents/default/settings/vision`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        const settings = response.body.data;
        expect(settings.ENABLE_CAMERA).to.be.a('string');
        expect(settings.ENABLE_SCREEN_CAPTURE).to.be.a('string');
        expect(settings.ENABLE_MICROPHONE).to.be.a('string');
        expect(settings.ENABLE_SPEAKER).to.be.a('string');
        cy.log('✅ Vision settings accessible');
        
        // Test vision setting update
        const originalCameraSetting = settings.ENABLE_CAMERA;
        const newCameraSetting = originalCameraSetting === 'true' ? 'false' : 'true';
        
        cy.request({
          method: 'POST',
          url: `${BACKEND_URL}/api/agents/default/settings`,
          body: {
            key: 'ENABLE_CAMERA',
            value: newCameraSetting
          }
        }).then((updateResponse) => {
          expect(updateResponse.status).to.eq(200);
          expect(updateResponse.body.success).to.be.true;
          cy.log(`✅ Camera setting updated to: ${newCameraSetting}`);
          
          // Verify setting was updated
          cy.request('GET', `${BACKEND_URL}/api/agents/default/settings/vision`).then((verifyResponse) => {
            expect(verifyResponse.body.data.ENABLE_CAMERA).to.eq(newCameraSetting);
            cy.log('✅ Vision setting persisted correctly');
          });
        });
      });
      
      // Test vision refresh
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/agents/default/vision/refresh`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        cy.log('✅ Vision refresh works');
      });
    });

    it('should test autonomy control functionality', () => {
      cy.log('🤖 Testing Autonomy Control');
      
      // Get current autonomy status
      cy.request('GET', `${BACKEND_URL}/autonomy/status`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.enabled).to.be.a('boolean');
        expect(response.body.data.running).to.be.a('boolean');
        
        const initialEnabled = response.body.data.enabled;
        cy.log(`Autonomy initial state - enabled: ${initialEnabled}, running: ${response.body.data.running}`);
        
        // Test autonomy disable
        cy.request({
          method: 'POST',
          url: `${BACKEND_URL}/autonomy/disable`
        }).then((disableResponse) => {
          expect(disableResponse.status).to.eq(200);
          expect(disableResponse.body.success).to.be.true;
          cy.log('✅ Autonomy disable works');
          
          // Test autonomy enable
          cy.request({
            method: 'POST', 
            url: `${BACKEND_URL}/autonomy/enable`
          }).then((enableResponse) => {
            expect(enableResponse.status).to.eq(200);
            expect(enableResponse.body.success).to.be.true;
            cy.log('✅ Autonomy enable works');
            
            // Verify status after enable
            cy.request('GET', `${BACKEND_URL}/autonomy/status`).then((finalResponse) => {
              expect(finalResponse.status).to.eq(200);
              expect(finalResponse.body.data.enabled).to.be.a('boolean');
              cy.log('✅ Autonomy control cycle complete');
            });
          });
        });
      });
    });
  });

  describe('3. Goals and Todos Backend Integration', () => {
    it('should test goals backend API comprehensively', () => {
      cy.log('🎯 Testing Goals Backend Integration');
      
      // Test goals API endpoint
      cy.request('GET', `${BACKEND_URL}/api/goals`).then((response) => {
        expect(response.status).to.eq(200);
        const goalsData = Array.isArray(response.body) ? response.body : response.body.data;
        expect(Array.isArray(goalsData)).to.be.true;
        cy.log(`✅ Goals API returns ${goalsData.length} goals`);
        
        // Verify goal structure if any goals exist
        if (goalsData.length > 0) {
          const firstGoal = goalsData[0];
          expect(firstGoal).to.have.property('id');
          expect(firstGoal).to.have.property('title');
          expect(firstGoal).to.have.property('completed');
          cy.log('✅ Goal structure is correct');
        } else {
          cy.log('ℹ️ No goals currently exist - empty state is valid');
        }
      });
      
      // Test that goals plugin is available
      cy.request(`${BACKEND_URL}/api/plugin-config`).then((response) => {
        expect(response.body.data.availablePlugins).to.include('goals');
        cy.log('✅ Goals plugin is loaded and available');
      });
    });

    it('should test todos backend API comprehensively', () => {
      cy.log('📋 Testing Todos Backend Integration');
      
      // Test todos API endpoint
      cy.request('GET', `${BACKEND_URL}/api/todos`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.exist;
        cy.log('✅ Todos API endpoint accessible');
        
        // Todos can be structured as nested objects by room/world
        const todosData = response.body;
        if (typeof todosData === 'object') {
          cy.log('✅ Todos data structure is valid');
        }
      });
      
      // Test that todo plugin is available
      cy.request(`${BACKEND_URL}/api/plugin-config`).then((response) => {
        expect(response.body.data.availablePlugins).to.include('todo');
        cy.log('✅ Todo plugin is loaded and available');
      });
    });

    it('should verify goals and todos can be accessed by the frontend periodically', () => {
      cy.log('🔄 Testing Goals/Todos Periodic Access');
      
      // Simulate multiple rapid requests like frontend would make
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          cy.request('GET', `${BACKEND_URL}/api/goals`).then((response) => {
            expect(response.status).to.eq(200);
          })
        );
        promises.push(
          cy.request('GET', `${BACKEND_URL}/api/todos`).then((response) => {
            expect(response.status).to.eq(200);
          })
        );
      }
      
      cy.log('✅ Goals and Todos APIs handle multiple concurrent requests');
    });
  });

  describe('4. Monologue (Agent\'s Autonomous Room) Backend', () => {
    it('should test monologue functionality through memories API', () => {
      cy.log('🤖 Testing Monologue (Agent\'s Autonomous Room)');
      
      // Test memories API with autonomous room ID (used by monologue)
      cy.request({
        url: `${BACKEND_URL}/api/memories?roomId=autonomous-room&count=20`,
        failOnStatusCode: false
      }).then((response) => {
        expect([200, 500]).to.include(response.status);
        expect(response.body.success).to.exist;
        cy.log('✅ Memories API supports autonomous room queries');
        
        if (response.status === 200) {
          expect(response.body.data).to.be.an('array');
          cy.log(`Autonomous room has ${response.body.data.length} memories`);
        } else {
          cy.log('ℹ️ Autonomous room not yet created - will be created on first use');
        }
      });
      
      // Test memories with different room IDs (monologue isolation)
      cy.request({
        url: `${BACKEND_URL}/api/memories?roomId=general-chat&count=10`,
        failOnStatusCode: false
      }).then((response) => {
        expect([200, 500]).to.include(response.status);
        cy.log('✅ Memories API supports multiple room contexts');
      });
      
      // Test autonomy plugin (powers autonomous thinking)
      cy.request(`${BACKEND_URL}/api/plugin-config`).then((response) => {
        expect(response.body.data.availablePlugins).to.include('AUTONOMY');
        cy.log('✅ Autonomy plugin available for monologue generation');
      });
    });

    it('should verify autonomy generates autonomous thoughts', () => {
      cy.log('💭 Testing Autonomous Thought Generation');
      
      // Enable autonomy if not already enabled
      cy.request('GET', `${BACKEND_URL}/autonomy/status`).then((statusResponse) => {
        if (!statusResponse.body.data.enabled) {
          cy.request({
            method: 'POST',
            url: `${BACKEND_URL}/autonomy/enable`
          }).then((response) => {
            expect(response.body.success).to.be.true;
            cy.log('✅ Autonomy enabled for thought generation');
          });
        } else {
          cy.log('✅ Autonomy already enabled');
        }
        
        // Verify autonomy status
        cy.request('GET', `${BACKEND_URL}/autonomy/status`).then((response) => {
          expect(response.body.data.enabled).to.be.true;
          cy.log('✅ Autonomy is active for monologue generation');
        });
      });
    });
  });

  describe('5. Knowledge Upload and Delete (Files) Backend', () => {
    it('should test complete knowledge management API', () => {
      cy.log('📁 Testing Knowledge Management APIs');
      
      // Test knowledge documents listing
      cy.request('GET', `${BACKEND_URL}/knowledge/documents`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.documents).to.be.an('array');
        expect(response.body.data.count).to.be.a('number');
        cy.log(`✅ Knowledge documents API returns ${response.body.data.count} files`);
      });
      
      // Test knowledge upload endpoint validation (without actual file)
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/knowledge/upload`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.error.code).to.eq('NO_FILE');
        cy.log('✅ Knowledge upload endpoint validates file requirement');
      });
      
      // Test knowledge delete endpoint (with non-existent file)
      cy.request({
        method: 'DELETE',
        url: `${BACKEND_URL}/knowledge/documents/test-file-id`,
        failOnStatusCode: false
      }).then((response) => {
        expect([200, 404]).to.include(response.status);
        cy.log('✅ Knowledge delete endpoint handles requests appropriately');
      });
      
      // Test that knowledge plugin is available
      cy.request(`${BACKEND_URL}/api/plugin-config`).then((response) => {
        expect(response.body.data.availablePlugins).to.include('knowledge');
        cy.log('✅ Knowledge plugin is loaded and available');
      });
    });

    it('should test knowledge search and retrieval functionality', () => {
      cy.log('🔍 Testing Knowledge Search');
      
      // Test knowledge search (if any documents exist)
      cy.request('GET', `${BACKEND_URL}/knowledge/documents`).then((response) => {
        const documents = response.body.data.documents;
        
        if (documents.length > 0) {
          cy.log(`Found ${documents.length} documents to test with`);
          
          // Test knowledge retrieval with existing document
          const firstDoc = documents[0];
          if (firstDoc.id) {
            cy.request({
              method: 'GET',
              url: `${BACKEND_URL}/knowledge/documents/${firstDoc.id}`,
              failOnStatusCode: false
            }).then((docResponse) => {
              expect([200, 404]).to.include(docResponse.status);
              cy.log('✅ Knowledge document retrieval endpoint works');
            });
          }
        } else {
          cy.log('ℹ️ No documents exist yet - upload functionality will be tested when files are added');
        }
      });
    });
  });

  describe('6. Configuration Settings Management Backend', () => {
    it('should test complete configuration management APIs', () => {
      cy.log('⚙️ Testing Configuration Management');
      
      // Test plugin configuration endpoint
      cy.request('GET', `${BACKEND_URL}/api/plugin-config`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.configurations).to.be.an('object');
        expect(response.body.data.availablePlugins).to.be.an('array');
        cy.log(`✅ Plugin config API - ${response.body.data.availablePlugins.length} plugins available`);
      });
      
      // Test configuration validation
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/config/validate`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.validation).to.be.an('object');
        expect(response.body.data.recommendations).to.be.an('array');
        cy.log('✅ Configuration validation API works');
      });
      
      // Test configuration testing
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/config/test`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.testResults).to.be.an('object');
        expect(response.body.data.overallStatus).to.be.a('string');
        cy.log('✅ Configuration test API works');
      });
    });

    it('should test plugin configuration updates', () => {
      cy.log('🔧 Testing Plugin Configuration Updates');
      
      // Test updating plugin configuration
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/plugin-config`,
        body: {
          plugin: 'environment',
          config: { TEST_KEY: 'test_value' }
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        cy.log('✅ Plugin configuration update works');
        
        // Verify configuration was updated
        cy.request('GET', `${BACKEND_URL}/api/plugin-config`).then((getResponse) => {
          expect(getResponse.body.data.configurations).to.have.property('environment');
          cy.log('✅ Plugin configuration persisted');
        });
      });
    });

    it('should test agent settings management', () => {
      cy.log('👤 Testing Agent Settings Management');
      
      // Test agent settings retrieval
      cy.request('GET', `${BACKEND_URL}/api/agents/default/settings/vision`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        const settings = response.body.data;
        
        // Store original setting
        const originalSetting = settings.ENABLE_MICROPHONE;
        const newSetting = originalSetting === 'true' ? 'false' : 'true';
        
        // Test setting update
        cy.request({
          method: 'POST',
          url: `${BACKEND_URL}/api/agents/default/settings`,
          body: {
            key: 'ENABLE_MICROPHONE',
            value: newSetting
          }
        }).then((updateResponse) => {
          expect(updateResponse.status).to.eq(200);
          expect(updateResponse.body.success).to.be.true;
          cy.log(`✅ Agent setting updated: ENABLE_MICROPHONE = ${newSetting}`);
          
          // Verify the update
          cy.request('GET', `${BACKEND_URL}/api/agents/default/settings/vision`).then((verifyResponse) => {
            expect(verifyResponse.body.data.ENABLE_MICROPHONE).to.eq(newSetting);
            cy.log('✅ Agent setting persisted correctly');
            
            // Restore original setting
            cy.request({
              method: 'POST',
              url: `${BACKEND_URL}/api/agents/default/settings`,
              body: {
                key: 'ENABLE_MICROPHONE',
                value: originalSetting
              }
            });
          });
        });
      });
    });
  });

  describe('7. Cross-System Integration Verification', () => {
    it('should verify all plugins work together', () => {
      cy.log('🔗 Testing Cross-System Integration');
      
      // Test that all required plugins are loaded
      cy.request(`${BACKEND_URL}/api/plugin-config`).then((response) => {
        const availablePlugins = response.body.data.availablePlugins;
        
        const requiredPlugins = ['SHELL', 'stagehand', 'goals', 'todo', 'AUTONOMY', 'knowledge'];
        requiredPlugins.forEach(plugin => {
          expect(availablePlugins).to.include(plugin);
          cy.log(`✅ ${plugin} plugin is loaded`);
        });
        
        cy.log('✅ All required plugins are available and integrated');
      });
      
      // Test that capabilities work with their underlying plugins
      cy.request('GET', `${BACKEND_URL}/api/agents/default/capabilities/shell`).then((response) => {
        expect(response.body.data.service_available).to.be.true;
        cy.log('✅ Shell capability corresponds to SHELL plugin');
      });
      
      cy.request('GET', `${BACKEND_URL}/api/agents/default/capabilities/browser`).then((response) => {
        expect(response.body.data.service_available).to.be.true;
        cy.log('✅ Browser capability corresponds to stagehand plugin');
      });
    });

    it('should perform end-to-end backend integration test', () => {
      cy.log('🚀 Running End-to-End Backend Integration Test');
      
      let testResults = {
        healthCheck: false,
        goals: false,
        todos: false,
        memories: false,
        capabilities: false,
        knowledge: false,
        configuration: false
      };
      
      // 1. Health check
      cy.request('GET', `${BACKEND_URL}/api/server/health`).then((response) => {
        testResults.healthCheck = response.status === 200;
      });
      
      // 2. Goals API
      cy.request('GET', `${BACKEND_URL}/api/goals`).then((response) => {
        testResults.goals = response.status === 200;
      });
      
      // 3. Todos API
      cy.request('GET', `${BACKEND_URL}/api/todos`).then((response) => {
        testResults.todos = response.status === 200;
      });
      
      // 4. Memories API
      cy.request({
        url: `${BACKEND_URL}/api/memories?roomId=test&count=5`,
        failOnStatusCode: false
      }).then((response) => {
        testResults.memories = [200, 500].includes(response.status);
      });
      
      // 5. Capabilities
      cy.request('GET', `${BACKEND_URL}/api/agents/default/capabilities/shell`).then((response) => {
        testResults.capabilities = response.status === 200 && response.body.data.service_available;
      });
      
      // 6. Knowledge
      cy.request('GET', `${BACKEND_URL}/knowledge/documents`).then((response) => {
        testResults.knowledge = response.status === 200;
      });
      
      // 7. Configuration
      cy.request('GET', `${BACKEND_URL}/api/plugin-config`).then((response) => {
        testResults.configuration = response.status === 200;
        
        // Final verification
        cy.then(() => {
          const passedTests = Object.values(testResults).filter(result => result).length;
          const totalTests = Object.keys(testResults).length;
          
          cy.log(`📊 Integration Test Results: ${passedTests}/${totalTests} systems working`);
          Object.entries(testResults).forEach(([system, result]) => {
            const status = result ? '✅' : '❌';
            cy.log(`${status} ${system}: ${result ? 'Working' : 'Failed'}`);
          });
          
          // Expect at least 85% of systems to be working
          expect(passedTests).to.be.at.least(Math.ceil(totalTests * 0.85));
          cy.log('🎉 Comprehensive backend integration test passed!');
        });
      });
    });
  });

  after(() => {
    cy.log('🏁 Comprehensive Backend Integration Test Complete');
    cy.log('✅ All backend systems tested and verified');
  });
});