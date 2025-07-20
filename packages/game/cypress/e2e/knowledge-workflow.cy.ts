import { KnowledgeTestHelper } from '../support/knowledge-helpers';

describe('Knowledge Base Workflow Tests', () => {
  let knowledgeHelper: KnowledgeTestHelper;
  const agentId = '00000000-0000-0000-0000-000000000001';

  before(() => {
    knowledgeHelper = new KnowledgeTestHelper(agentId);
    
    // Ensure the application and backend are running
    cy.visit('http://localhost:5173/', { timeout: 30000 });
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');
    
    // Wait for backend to be ready
    cy.wait(5000);
    
    // Clean up any existing test documents
    knowledgeHelper.cleanupTestDocuments(['test-', 'cypress-', 'workflow-']);
  });

  after(() => {
    // Clean up test documents after all tests
    knowledgeHelper.cleanupTestDocuments(['test-', 'cypress-', 'workflow-']);
  });

  describe('Complete Knowledge Management Workflow', () => {
    let documentIds: string[] = [];

    it('should complete a full document lifecycle workflow', () => {
      // Step 1: Upload multiple documents
      cy.log('=== Step 1: Upload Documents ===');
      
      const documents = [
        {
          name: 'workflow-doc-1.txt',
          content: 'This document discusses artificial intelligence and machine learning concepts. It covers neural networks, deep learning, and natural language processing.'
        },
        {
          name: 'workflow-doc-2.txt', 
          content: 'This document focuses on software development practices. It includes information about testing, deployment, and continuous integration.'
        }
      ];

      // Upload first document
      knowledgeHelper.uploadFile(documents[0].name, documents[0].content).then((response) => {
        expect(response.success).to.be.true;
        documentIds.push(response.data.id);
        cy.log(`Uploaded document 1: ${response.data.id}`);
      });

      // Upload second document
      knowledgeHelper.uploadFile(documents[1].name, documents[1].content).then((response) => {
        expect(response.success).to.be.true;
        documentIds.push(response.data.id);
        cy.log(`Uploaded document 2: ${response.data.id}`);
      });

      // Step 2: Verify documents appear in the list
      cy.log('=== Step 2: Verify Document List ===');
      knowledgeHelper.getDocuments().then((docs) => {
        expect(docs.length).to.be.greaterThan(0);
        
        const uploadedDocs = docs.filter(doc => 
          documentIds.includes(doc.id)
        );
        expect(uploadedDocs.length).to.eq(2);
        
        cy.log(`Found ${uploadedDocs.length} uploaded documents in the knowledge base`);
      });

      // Step 3: Wait for processing and verify chunks
      cy.log('=== Step 3: Verify Document Processing ===');
      documentIds.forEach((docId, index) => {
        knowledgeHelper.waitForDocumentProcessing(docId, 30000);
        knowledgeHelper.getDocumentChunks(docId).then((chunks) => {
          expect(chunks.length).to.be.greaterThan(0);
          cy.log(`Document ${index + 1} has ${chunks.length} chunks`);
          
          // Verify chunk content
          chunks.forEach(chunk => {
            expect(chunk).to.have.property('content');
            expect(chunk.content).to.have.property('text');
            expect(chunk.content.text.length).to.be.greaterThan(0);
          });
        });
      });

      // Step 4: Test search functionality
      cy.log('=== Step 4: Test Search Functionality ===');
      
      // Search for AI-related content
      knowledgeHelper.search('artificial intelligence', 5).then((results) => {
        expect(results.length).to.be.greaterThan(0);
        cy.log(`Found ${results.length} results for "artificial intelligence"`);
        
        // Verify search results contain relevant content
        const hasAiContent = results.some(result => 
          result.content.text.toLowerCase().includes('artificial') ||
          result.content.text.toLowerCase().includes('intelligence') ||
          result.content.text.toLowerCase().includes('machine learning')
        );
        expect(hasAiContent).to.be.true;
      });

      // Search for software development content
      knowledgeHelper.search('software development', 5).then((results) => {
        expect(results.length).to.be.greaterThan(0);
        cy.log(`Found ${results.length} results for "software development"`);
        
        const hasSoftwareContent = results.some(result =>
          result.content.text.toLowerCase().includes('software') ||
          result.content.text.toLowerCase().includes('development') ||
          result.content.text.toLowerCase().includes('testing')
        );
        expect(hasSoftwareContent).to.be.true;
      });

      // Step 5: Test document deletion
      cy.log('=== Step 5: Test Document Deletion ===');
      const firstDocId = documentIds[0];
      
      knowledgeHelper.deleteDocument(firstDocId);
      
      // Verify document is deleted
      knowledgeHelper.verifyDocumentExists(firstDocId).then((exists) => {
        expect(exists).to.be.false;
        cy.log(`Document ${firstDocId} successfully deleted`);
      });

      // Verify other document still exists
      const secondDocId = documentIds[1];
      knowledgeHelper.verifyDocumentExists(secondDocId).then((exists) => {
        expect(exists).to.be.true;
        cy.log(`Document ${secondDocId} still exists after deleting other document`);
      });

      // Step 6: Verify search still works with remaining document
      cy.log('=== Step 6: Verify Search After Deletion ===');
      knowledgeHelper.search('software development', 5).then((results) => {
        // Should still find results from the remaining document
        expect(results.length).to.be.greaterThan(0);
        cy.log(`Search still returns ${results.length} results after document deletion`);
      });

      // Clean up remaining document
      knowledgeHelper.deleteDocument(secondDocId);
    });

    it('should handle URL import workflow', () => {
      cy.log('=== URL Import Workflow Test ===');
      
      const testUrl = 'https://raw.githubusercontent.com/ai16z/eliza/main/README.md';
      let urlDocumentId: string;

      // Upload from URL
      knowledgeHelper.uploadFromUrl(testUrl).then((response) => {
        expect(response.success).to.be.true;
        urlDocumentId = response.data.id;
        cy.log(`Uploaded document from URL: ${urlDocumentId}`);
      });

      // Wait for processing
      cy.then(() => {
        knowledgeHelper.waitForDocumentProcessing(urlDocumentId, 30000);
      });

      // Verify chunks were created
      cy.then(() => {
        knowledgeHelper.getDocumentChunks(urlDocumentId).then((chunks) => {
          expect(chunks.length).to.be.greaterThan(0);
          cy.log(`URL document has ${chunks.length} chunks`);
          
          // Should contain typical README content
          const hasReadmeContent = chunks.some(chunk =>
            chunk.content.text.toLowerCase().includes('eliza') ||
            chunk.content.text.toLowerCase().includes('readme') ||
            chunk.content.text.toLowerCase().includes('install')
          );
          expect(hasReadmeContent).to.be.true;
        });
      });

      // Test search on URL content
      cy.then(() => {
        knowledgeHelper.search('eliza', 3).then((results) => {
          expect(results.length).to.be.greaterThan(0);
          cy.log(`Found ${results.length} results for "eliza" in URL document`);
        });
      });

      // Clean up
      cy.then(() => {
        knowledgeHelper.deleteDocument(urlDocumentId);
      });
    });

    it('should handle multiple file types correctly', () => {
      cy.log('=== Multiple File Types Test ===');
      
      const testFiles = [
        {
          name: 'workflow-text.txt',
          content: 'This is a plain text file for testing knowledge base functionality.',
          type: 'text/plain'
        },
        {
          name: 'workflow-markdown.md',
          content: '# Test Markdown\n\nThis is a **markdown** file with *formatting*.\n\n## Features\n\n- Lists\n- Code blocks\n- Headers',
          type: 'text/markdown'
        },
        {
          name: 'workflow-json.json',
          content: JSON.stringify({
            name: 'Test Configuration',
            version: '1.0.0',
            features: ['search', 'upload', 'delete'],
            settings: {
              enabled: true,
              maxSize: '10MB'
            }
          }, null, 2),
          type: 'application/json'
        }
      ];

      const uploadedIds: string[] = [];

      // Upload all file types
      testFiles.forEach((file, index) => {
        knowledgeHelper.uploadFile(file.name, file.content, file.type).then((response) => {
          expect(response.success).to.be.true;
          uploadedIds.push(response.data.id);
          cy.log(`Uploaded ${file.type} file: ${response.data.id}`);
        });
      });

      // Wait for all to process
      cy.then(() => {
        uploadedIds.forEach(docId => {
          knowledgeHelper.waitForDocumentProcessing(docId, 30000);
        });
      });

      // Verify all have chunks
      cy.then(() => {
        uploadedIds.forEach((docId, index) => {
          knowledgeHelper.getDocumentChunks(docId).then((chunks) => {
            expect(chunks.length).to.be.greaterThan(0);
            cy.log(`File type ${testFiles[index].type} has ${chunks.length} chunks`);
          });
        });
      });

      // Test search across different file types
      cy.then(() => {
        knowledgeHelper.search('test', 10).then((results) => {
          expect(results.length).to.be.greaterThan(0);
          cy.log(`Cross-file-type search returned ${results.length} results`);
        });
      });

      // Clean up all files
      cy.then(() => {
        uploadedIds.forEach(docId => {
          knowledgeHelper.deleteDocument(docId);
        });
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent operations gracefully', () => {
      cy.log('=== Concurrent Operations Test ===');
      
      const concurrentUploads = [
        { name: 'concurrent-1.txt', content: 'Concurrent upload test 1' },
        { name: 'concurrent-2.txt', content: 'Concurrent upload test 2' },
        { name: 'concurrent-3.txt', content: 'Concurrent upload test 3' }
      ];

      const uploadPromises: string[] = [];

      // Start all uploads simultaneously
      concurrentUploads.forEach(file => {
        knowledgeHelper.uploadFile(file.name, file.content).then((response) => {
          expect(response.success).to.be.true;
          uploadPromises.push(response.data.id);
        });
      });

      // Verify all uploads succeeded
      cy.then(() => {
        expect(uploadPromises.length).to.eq(3);
        cy.log(`All ${uploadPromises.length} concurrent uploads succeeded`);
        
        // Clean up
        uploadPromises.forEach(docId => {
          knowledgeHelper.deleteDocument(docId);
        });
      });
    });

    it('should handle invalid operations gracefully', () => {
      cy.log('=== Invalid Operations Test ===');
      
      // Test deletion of non-existent document
      const fakeId = '99999999-9999-9999-9999-999999999999';
      cy.request({
        method: 'DELETE',
        url: `http://localhost:7777/knowledge/documents/${fakeId}?agentId=${agentId}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([204, 404]);
        cy.log('Non-existent document deletion handled gracefully');
      });

      // Test search with empty query
      cy.request({
        method: 'POST',
        url: 'http://localhost:7777/knowledge/search',
        body: {
          query: '',
          agentId: agentId,
          count: 10
        },
        headers: {
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 400, 422]);
        cy.log('Empty search query handled gracefully');
      });

      // Test invalid agent ID
      cy.request({
        method: 'GET',
        url: 'http://localhost:7777/knowledge/documents?agentId=invalid-id',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 404, 422]);
        cy.log('Invalid agent ID handled gracefully');
      });
    });
  });
});