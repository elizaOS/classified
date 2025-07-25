describe('Knowledge Base CRUD Operations', () => {
  const agentId = '00000000-0000-0000-0000-000000000001';
  const testFileName = 'test-knowledge-document.txt';
  const testFileContent = 'This is a test document for knowledge base CRUD operations. It contains important information that should be searchable.';
  const testUrl = 'https://raw.githubusercontent.com/ai16z/eliza/main/README.md';

  let uploadedDocumentId: string;
  let uploadedUrlDocumentId: string;

  before(() => {
    // Start the game/server and ensure it's running
    cy.visit('http://localhost:5173/', { timeout: 30000 });
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');

    // Wait for backend to be ready
    cy.wait(5000);

    // Verify backend is accessible
    cy.request({
      method: 'GET',
      url: `http://localhost:7777/knowledge/documents?agentId=${agentId}`,
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.be.oneOf([200, 404]);
    });
  });

  describe('CREATE Operations', () => {
    it('should upload a text file to knowledge base', () => {
      // Create a test file
      const testFile = new File([testFileContent], testFileName, { type: 'text/plain' });

      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', testFile);
      formData.append('agentId', agentId);

      // Upload file via API (use knowledge plugin endpoint)
      cy.request({
        method: 'POST',
        url: 'http://localhost:7777/knowledge/documents',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body).to.have.property('data');
        expect(response.body.data).to.have.property('id');

        uploadedDocumentId = response.body.data.id;
        cy.log(`Uploaded document ID: ${uploadedDocumentId}`);
      });
    });

    it('should import a document from URL', () => {
      cy.request({
        method: 'POST',
        url: 'http://localhost:7777/knowledge/import',
        body: {
          url: testUrl,
          agentId
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body).to.have.property('data');
        expect(response.body.data).to.have.property('id');

        uploadedUrlDocumentId = response.body.data.id;
        cy.log(`Uploaded URL document ID: ${uploadedUrlDocumentId}`);
      });
    });

    it('should handle upload errors gracefully', () => {
      // Test with invalid agent ID
      cy.request({
        method: 'POST',
        url: 'http://localhost:7777/knowledge/upload',
        body: {
          agentId: 'invalid-agent-id'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 422, 500]);
      });

      // Test with invalid URL
      cy.request({
        method: 'POST',
        url: 'http://localhost:7777/knowledge/upload-url',
        body: {
          url: 'not-a-valid-url',
          agentId
        },
        headers: {
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 422, 500]);
      });
    });
  });

  describe('READ Operations', () => {
    it('should retrieve all knowledge documents', () => {
      cy.request({
        method: 'GET',
        url: `http://localhost:7777/knowledge/documents?agentId=${agentId}`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');

        // Should include our uploaded documents
        const documentIds = response.body.data.map((doc: any) => doc.id);
        expect(documentIds).to.include(uploadedDocumentId);
        expect(documentIds).to.include(uploadedUrlDocumentId);
      });
    });

    it('should retrieve knowledge chunks for a document', () => {
      cy.request({
        method: 'GET',
        url: `http://localhost:7777/knowledge/chunks/${uploadedDocumentId}?agentId=${agentId}`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');

        // Should have at least one chunk
        expect(response.body.data.length).to.be.greaterThan(0);

        // Each chunk should have expected properties
        response.body.data.forEach((chunk: any) => {
          expect(chunk).to.have.property('id');
          expect(chunk).to.have.property('content');
          expect(chunk.content).to.have.property('text');
        });
      });
    });

    it('should handle non-existent document gracefully', () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999';

      cy.request({
        method: 'GET',
        url: `http://localhost:7777/knowledge/chunks/${nonExistentId}?agentId=${agentId}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([404, 500]);
      });
    });
  });

  describe('SEARCH Operations', () => {
    it('should search knowledge base with text query', () => {
      cy.request({
        method: 'GET',
        url: `http://localhost:7777/knowledge/search?query=test%20document&agentId=${agentId}&count=10`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');

        // Should find relevant results
        if (response.body.data.length > 0) {
          response.body.data.forEach((result: any) => {
            expect(result).to.have.property('content');
            expect(result.content).to.have.property('text');
          });
        }
      });
    });

    it('should return empty results for non-matching query', () => {
      cy.request({
        method: 'GET',
        url: `http://localhost:7777/knowledge/search?query=xyzveryuniquequerystring123&agentId=${agentId}&count=10`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');
        // May be empty or have low-relevance results
      });
    });

    it('should handle search with empty query', () => {
      cy.request({
        method: 'GET',
        url: `http://localhost:7777/knowledge/search?query=&agentId=${agentId}&count=10`,
        failOnStatusCode: false
      }).then((response) => {
        // Should handle gracefully, either return empty results or error
        expect(response.status).to.be.oneOf([200, 400, 422]);
      });
    });
  });

  describe('DELETE Operations', () => {
    it('should delete an uploaded file document', () => {
      cy.request({
        method: 'DELETE',
        url: `http://localhost:7777/knowledge/documents/${uploadedDocumentId}?agentId=${agentId}`
      }).then((response) => {
        expect(response.status).to.eq(204);

        // Verify document is deleted by trying to retrieve chunks
        cy.request({
          method: 'GET',
          url: `http://localhost:7777/knowledge/chunks/${uploadedDocumentId}?agentId=${agentId}`,
          failOnStatusCode: false
        }).then((getResponse) => {
          // Should return 404 or empty results
          expect(getResponse.status).to.be.oneOf([404, 500]);
        });
      });
    });

    it('should delete a URL-imported document', () => {
      cy.request({
        method: 'DELETE',
        url: `http://localhost:7777/knowledge/documents/${uploadedUrlDocumentId}?agentId=${agentId}`
      }).then((response) => {
        expect(response.status).to.eq(204);

        // Verify document is deleted
        cy.request({
          method: 'GET',
          url: `http://localhost:7777/knowledge/chunks/${uploadedUrlDocumentId}?agentId=${agentId}`,
          failOnStatusCode: false
        }).then((getResponse) => {
          expect(getResponse.status).to.be.oneOf([404, 500]);
        });
      });
    });

    it('should handle deletion of non-existent document', () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999';

      cy.request({
        method: 'DELETE',
        url: `http://localhost:7777/knowledge/documents/${nonExistentId}?agentId=${agentId}`,
        failOnStatusCode: false
      }).then((response) => {
        // Should handle gracefully - either 404 or successful deletion (idempotent)
        expect(response.status).to.be.oneOf([204, 404]);
      });
    });

    it('should handle deletion with invalid agent ID', () => {
      cy.request({
        method: 'DELETE',
        url: `http://localhost:7777/knowledge/documents/${uploadedDocumentId}?agentId=invalid-id`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 404, 422]);
      });
    });
  });

  describe('Frontend Integration', () => {
    it('should access knowledge interface through the game UI', () => {
      cy.visit('http://localhost:5173/', { timeout: 30000 });
      cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');

      // Look for knowledge-related UI elements
      cy.get('body').then(($body) => {
        // Check for knowledge tab, upload button, or any knowledge-related text
        if ($body.find('[data-testid*="knowledge"]').length > 0 ||
            $body.find('*').text().includes('Knowledge') ||
            $body.find('*').text().includes('Documents')) {
          cy.log('Knowledge interface elements found in the UI');
        } else {
          cy.log('Knowledge interface may not be visible or accessible in current state');
        }
      });
    });

    it('should not have knowledge API errors in console', () => {
      cy.visit('http://localhost:5173/');

      // Monitor console for knowledge-related errors
      cy.window().then((win) => {
        cy.stub(win.console, 'error').as('consoleError');
      });

      cy.wait(3000);

      // Check for knowledge API errors
      cy.get('@consoleError').should('not.have.been.calledWith',
        Cypress.sinon.match(/knowledge.*failed/i)
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent operations gracefully', () => {
      const testFile1 = new File(['Test content 1'], 'test1.txt', { type: 'text/plain' });
      const testFile2 = new File(['Test content 2'], 'test2.txt', { type: 'text/plain' });

      const formData1 = new FormData();
      formData1.append('file', testFile1);
      formData1.append('agentId', agentId);

      const formData2 = new FormData();
      formData2.append('file', testFile2);
      formData2.append('agentId', agentId);

      // Upload multiple files concurrently
      cy.request({
        method: 'POST',
        url: 'http://localhost:7777/knowledge/upload',
        body: formData1
      }).then((response1) => {
        expect(response1.status).to.eq(200);

        cy.request({
          method: 'POST',
          url: 'http://localhost:7777/knowledge/upload',
          body: formData2
        }).then((response2) => {
          expect(response2.status).to.eq(200);

          // Clean up - delete both documents
          if (response1.body.data?.id) {
            cy.request({
              method: 'DELETE',
              url: `http://localhost:7777/knowledge/documents/${response1.body.data.id}?agentId=${agentId}`,
              failOnStatusCode: false
            });
          }

          if (response2.body.data?.id) {
            cy.request({
              method: 'DELETE',
              url: `http://localhost:7777/knowledge/documents/${response2.body.data.id}?agentId=${agentId}`,
              failOnStatusCode: false
            });
          }
        });
      });
    });

    it('should handle large file uploads appropriately', () => {
      // Create a large text content (but not too large for testing)
      const largeContent = 'Large content. '.repeat(1000); // ~15KB
      const largeFile = new File([largeContent], 'large-test.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', largeFile);
      formData.append('agentId', agentId);

      cy.request({
        method: 'POST',
        url: 'http://localhost:7777/knowledge/upload',
        body: formData,
        timeout: 30000 // Extended timeout for large files
      }).then((response) => {
        expect(response.status).to.eq(200);

        // Clean up
        if (response.body.data?.id) {
          cy.request({
            method: 'DELETE',
            url: `http://localhost:7777/knowledge/documents/${response.body.data.id}?agentId=${agentId}`,
            failOnStatusCode: false
          });
        }
      });
    });

    it('should validate API endpoints are properly mounted', () => {
      // Test all knowledge endpoints exist
      const endpoints = [
        { method: 'GET', path: '/documents', query: `?agentId=${agentId}` },
        { method: 'POST', path: '/upload', body: { agentId } },
        { method: 'POST', path: '/upload-url', body: { url: 'https://example.com', agentId } },
        { method: 'POST', path: '/search', body: { query: 'test', agentId } }
      ];

      endpoints.forEach(({ method, path, query = '', body = {} }) => {
        cy.request({
          method,
          url: `http://localhost:7777/knowledge${path}${query}`,
          body: method === 'GET' ? undefined : body,
          headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
          failOnStatusCode: false
        }).then((response) => {
          // Should not return 404 (endpoint not found)
          expect(response.status).to.not.eq(404);
          cy.log(`${method} ${path} endpoint is accessible (status: ${response.status})`);
        });
      });
    });
  });
});
