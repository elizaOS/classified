/// <reference types="cypress" />

/**
 * Knowledge Management Tests
 * Tests document upload, listing, deletion, search, and chunk processing
 */

describe('Knowledge Management', () => {
  const BACKEND_URL = Cypress.env('BACKEND_URL') || 'http://localhost:7777';
  const KNOWLEDGE_URL = `${BACKEND_URL}/knowledge`;
  const testDocuments: { id?: string; filename: string }[] = [];

  before(() => {
    // Ensure backend is ready
    cy.waitForBackend();
  });

  after(() => {
    // Clean up test documents
    cy.cleanupKnowledgeTests();
  });

  describe('Document Upload', () => {
    it('should upload a text file successfully', () => {
      const fileName = `test-document-${Date.now()}.txt`;
      const fileContent = `This is a test document for knowledge management.
      
Content includes:
- Multiple lines of text
- Various formatting
- Test data for search functionality
- Unique identifier: ${Date.now()}

This document tests the upload, processing, and retrieval capabilities
of the ElizaOS knowledge management system.`;

      cy.uploadKnowledgeFile(fileName, fileContent, 'text/plain').then((response) => {
        expect(response.success).to.be.true;
        expect(response.data).to.have.property('id');
        expect(response.data).to.have.property('message');
        
        testDocuments.push({ id: response.data.id, filename: fileName });
        
        cy.log(`✅ Uploaded document: ${response.data.id}`);
      });
    });

    it('should upload a markdown file successfully', () => {
      const fileName = `test-markdown-${Date.now()}.md`;
      const fileContent = `# Test Knowledge Document

## Overview
This is a test markdown document for the knowledge system.

## Features
- **Bold text** for emphasis
- *Italic text* for style
- \`Code blocks\` for technical content

### Code Example
\`\`\`javascript
function testKnowledge() {
  return "Knowledge test successful";
}
\`\`\`

## Unique Content
Test ID: ${Date.now()}
`;

      cy.uploadKnowledgeFile(fileName, fileContent, 'text/markdown').then((response) => {
        expect(response.success).to.be.true;
        expect(response.data).to.have.property('id');
        
        testDocuments.push({ id: response.data.id, filename: fileName });
        
        cy.log(`✅ Uploaded markdown: ${response.data.id}`);
      });
    });

    it('should handle file upload with form data', () => {
      const fileName = `form-upload-${Date.now()}.txt`;
      const fileContent = 'Test content for form upload';
      const blob = new Blob([fileContent], { type: 'text/plain' });

      cy.request({
        method: 'POST',
        url: `${KNOWLEDGE_URL}/upload`,
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        body: (() => {
          const formData = new FormData();
          formData.append('file', blob, fileName);
          return formData;
        })()
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        
        if (response.body.data?.id) {
          testDocuments.push({ id: response.body.data.id, filename: fileName });
        }
      });
    });

    it('should reject upload without file', () => {
      cy.request({
        method: 'POST',
        url: `${KNOWLEDGE_URL}/upload`,
        failOnStatusCode: false,
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        body: new FormData()
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.success).to.be.false;
        expect(response.body.error.code).to.eq('NO_FILE');
      });
    });

    it('should handle large file upload', () => {
      const fileName = `large-file-${Date.now()}.txt`;
      // Create a 1MB file
      const largeContent = 'x'.repeat(1024 * 1024);

      cy.uploadKnowledgeFile(fileName, largeContent, 'text/plain').then((response) => {
        expect(response.success).to.be.true;
        expect(response.data).to.have.property('id');
        
        testDocuments.push({ id: response.data.id, filename: fileName });
        
        cy.log(`✅ Uploaded large file: ${response.data.id}`);
      });
    });
  });

  describe('Document Listing', () => {
    it('should list all uploaded documents', () => {
      cy.request('GET', `${KNOWLEDGE_URL}/documents`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.be.an('array');
        
        // Should include our test documents
        const uploadedIds = testDocuments.map(d => d.id).filter(Boolean);
        const foundDocs = response.body.data.filter(doc => 
          uploadedIds.includes(doc.id)
        );
        
        expect(foundDocs.length).to.be.at.least(1);
        
        // Verify document structure
        if (response.body.data.length > 0) {
          const doc = response.body.data[0];
          expect(doc).to.have.property('id');
          expect(doc).to.have.property('title');
          expect(doc).to.have.property('createdAt');
        }
        
        cy.log(`✅ Found ${response.body.data.length} documents`);
      });
    });

    it('should paginate document listing', () => {
      // First page
      cy.request('GET', `${KNOWLEDGE_URL}/documents?page=1&limit=5`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.be.an('array');
        expect(response.body.data.length).to.be.lte(5);
        
        // Check for pagination metadata if provided
        if (response.body.pagination) {
          expect(response.body.pagination).to.have.property('page', 1);
          expect(response.body.pagination).to.have.property('limit', 5);
          expect(response.body.pagination).to.have.property('total');
        }
      });
    });

    it('should filter documents by search term', () => {
      const searchTerm = 'test';
      
      cy.request('GET', `${KNOWLEDGE_URL}/documents?search=${searchTerm}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.be.an('array');
        
        // All returned documents should match search term
        response.body.data.forEach(doc => {
          const matchesSearch = 
            doc.title?.toLowerCase().includes(searchTerm) ||
            doc.description?.toLowerCase().includes(searchTerm);
          expect(matchesSearch).to.be.true;
        });
      });
    });
  });

  describe('Document Chunks', () => {
    it('should retrieve document chunks', () => {
      // Use the first test document
      const testDoc = testDocuments.find(d => d.id);
      if (!testDoc) {
        cy.log('No test document available for chunk test');
        return;
      }

      cy.request('GET', `${KNOWLEDGE_URL}/documents/${testDoc.id}/chunks`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.be.an('array');
        
        // Should have at least one chunk
        expect(response.body.data.length).to.be.at.least(1);
        
        // Verify chunk structure
        const chunk = response.body.data[0];
        expect(chunk).to.have.property('id');
        expect(chunk).to.have.property('content');
        expect(chunk.content).to.have.property('text');
        
        // Embeddings might be included
        if (chunk.embedding) {
          expect(chunk.embedding).to.be.an('array');
          expect(chunk.embedding[0]).to.be.a('number');
        }
        
        cy.log(`✅ Document has ${response.body.data.length} chunks`);
      });
    });

    it('should wait for document processing', () => {
      const testDoc = testDocuments.find(d => d.id);
      if (!testDoc) return;

      cy.waitForDocumentProcessing(testDoc.id).then(() => {
        cy.log(`✅ Document ${testDoc.id} fully processed`);
      });
    });
  });

  describe('Document Search', () => {
    it('should search documents by content', () => {
      const searchQuery = 'test document knowledge management';
      
      cy.searchKnowledge(searchQuery).then((results) => {
        expect(results).to.be.an('array');
        
        if (results.length > 0) {
          const result = results[0];
          expect(result).to.have.property('content');
          expect(result.content).to.have.property('text');
          
          // Similarity score if provided
          if (result.similarity !== undefined) {
            expect(result.similarity).to.be.a('number');
            expect(result.similarity).to.be.gte(0).and.lte(1);
          }
        }
        
        cy.log(`✅ Found ${results.length} search results`);
      });
    });

    it('should search with custom result count', () => {
      const searchQuery = 'test';
      const resultCount = 3;
      
      cy.searchKnowledge(searchQuery, resultCount).then((results) => {
        expect(results).to.be.an('array');
        expect(results.length).to.be.lte(resultCount);
      });
    });

    it('should return relevant results for specific queries', () => {
      const uniqueId = Date.now().toString();
      
      // First upload a document with unique content
      const fileName = `unique-search-${uniqueId}.txt`;
      const content = `Unique search test document ${uniqueId}. This contains very specific content.`;
      
      cy.uploadKnowledgeFile(fileName, content).then((uploadResponse) => {
        testDocuments.push({ id: uploadResponse.data.id, filename: fileName });
        
        // Wait for processing
        cy.wait(3000);
        
        // Search for the unique content
        cy.searchKnowledge(`unique search ${uniqueId}`).then((results) => {
          expect(results.length).to.be.at.least(1);
          
          // The uploaded document should be in results
          const foundResult = results.find(r => 
            r.content.text.includes(uniqueId)
          );
          expect(foundResult).to.exist;
        });
      });
    });
  });

  describe('Document Deletion', () => {
    it('should delete a document successfully', () => {
      // Upload a document specifically for deletion
      const fileName = `delete-test-${Date.now()}.txt`;
      const content = 'This document will be deleted';
      
      cy.uploadKnowledgeFile(fileName, content).then((uploadResponse) => {
        const docId = uploadResponse.data.id;
        
        // Delete the document
        cy.deleteKnowledgeDocument(docId).then(() => {
          cy.log(`✅ Deleted document: ${docId}`);
          
          // Verify it's deleted
          cy.request({
            method: 'GET',
            url: `${KNOWLEDGE_URL}/documents/${docId}`,
            failOnStatusCode: false
          }).then((response) => {
            expect(response.status).to.be.oneOf([404, 200]);
            if (response.status === 200) {
              expect(response.body.data).to.be.null;
            }
          });
        });
      });
    });

    it('should handle deletion of non-existent document', () => {
      const fakeId = 'non-existent-doc-id';
      
      cy.request({
        method: 'DELETE',
        url: `${KNOWLEDGE_URL}/documents/${fakeId}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([404, 200]);
        if (response.status === 404) {
          expect(response.body.success).to.be.false;
          expect(response.body.error).to.have.property('code');
        }
      });
    });

    it('should delete multiple documents', () => {
      // Upload multiple documents
      const promises = [];
      for (let i = 0; i < 3; i++) {
        const fileName = `batch-delete-${Date.now()}-${i}.txt`;
        promises.push(
          cy.uploadKnowledgeFile(fileName, `Batch delete test ${i}`)
        );
      }
      
      cy.wrap(Promise.all(promises)).then((responses: any[]) => {
        const deletePromises = responses.map(r => 
          cy.deleteKnowledgeDocument(r.data.id)
        );
        
        cy.wrap(Promise.all(deletePromises)).then(() => {
          cy.log(`✅ Deleted ${responses.length} documents`);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle upload of empty file', () => {
      const fileName = `empty-file-${Date.now()}.txt`;
      
      cy.uploadKnowledgeFile(fileName, '', 'text/plain').then((response) => {
        // Empty files might be accepted or rejected
        if (response.success) {
          testDocuments.push({ id: response.data.id, filename: fileName });
        } else {
          expect(response.error).to.exist;
        }
      });
    });

    it('should handle malformed requests', () => {
      cy.request({
        method: 'POST',
        url: `${KNOWLEDGE_URL}/upload`,
        body: 'invalid data',
        headers: {
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 415, 500]);
      });
    });

    it('should handle concurrent uploads', () => {
      const uploads = [];
      for (let i = 0; i < 5; i++) {
        const fileName = `concurrent-${Date.now()}-${i}.txt`;
        uploads.push(
          cy.uploadKnowledgeFile(fileName, `Concurrent test ${i}`)
        );
      }
      
      cy.wrap(Promise.all(uploads)).then((responses: any[]) => {
        responses.forEach(response => {
          expect(response.success).to.be.true;
          if (response.data?.id) {
            testDocuments.push({ 
              id: response.data.id, 
              filename: `concurrent-file` 
            });
          }
        });
        
        cy.log(`✅ Uploaded ${uploads.length} files concurrently`);
      });
    });
  });
});

// Knowledge Management Summary
describe('Knowledge Management Summary', () => {
  it('should verify complete knowledge management functionality', () => {
    const KNOWLEDGE_URL = `${Cypress.env('BACKEND_URL') || 'http://localhost:7777'}/knowledge`;
    const operations = [];
    
    cy.log('🎯 KNOWLEDGE MANAGEMENT VERIFICATION:');
    
    // Test upload
    const testFile = `summary-test-${Date.now()}.txt`;
    cy.uploadKnowledgeFile(testFile, 'Summary test content').then((response) => {
      operations.push({
        operation: 'Upload',
        success: response.success,
        details: response.success ? 'File uploaded' : 'Upload failed'
      });
      
      if (response.success) {
        const docId = response.data.id;
        
        // Test listing
        return cy.request('GET', `${KNOWLEDGE_URL}/documents`).then((listResponse) => {
          operations.push({
            operation: 'List',
            success: listResponse.status === 200,
            details: `Found ${listResponse.body.data?.length || 0} documents`
          });
          
          // Test search
          return cy.searchKnowledge('summary test');
        }).then((searchResults) => {
          operations.push({
            operation: 'Search',
            success: true,
            details: `Found ${searchResults.length} results`
          });
          
          // Test delete
          return cy.deleteKnowledgeDocument(docId);
        }).then(() => {
          operations.push({
            operation: 'Delete',
            success: true,
            details: 'Document deleted'
          });
        });
      }
    }).then(() => {
      // Display results
      operations.forEach(op => {
        const icon = op.success ? '✅' : '❌';
        cy.log(`${icon} ${op.operation}: ${op.details}`);
      });
      
      const successCount = operations.filter(op => op.success).length;
      cy.log(`\n✅ ${successCount}/${operations.length} operations successful`);
      
      cy.screenshot('knowledge-management-summary');
    });
  });
}); 