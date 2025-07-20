/// <reference types="cypress" />

describe('Knowledge Base - Real File Upload & Deletion Test', () => {
  beforeEach(() => {
    // Skip boot sequence for direct testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });
    
    cy.visit('/', { timeout: 30000 });
    
    // Wait for the main interface to load using the updated test-id
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');
    
    // Navigate to Files tab using updated test-id
    cy.get('[data-testid="files-tab"]', { timeout: 10000 }).should('be.visible').click();
    
    // Wait for Files content to be visible
    cy.get('[data-testid="files-content"]', { timeout: 10000 }).should('be.visible');
    cy.contains('KNOWLEDGE BASE', { timeout: 10000 }).should('be.visible');
    
    // Wait for API calls to settle
    cy.wait(3000);
  });

  it('should successfully upload a text file, verify it appears, and then delete it', () => {
    // Step 1: Intercept API calls to verify they're actually made
    cy.intercept('POST', '**/knowledge/documents').as('uploadFile');
    cy.intercept('GET', '**/knowledge/documents').as('getDocuments');
    cy.intercept('DELETE', '**/knowledge/documents/*').as('deleteFile');
    
    // Step 2: Record initial state
    cy.screenshot('01-initial-files-tab-state');
    
    // Step 3: Count initial files
    cy.get('body').then($body => {
      let initialFileCount = 0;
      
      if ($body.find('.file-item').length > 0) {
        initialFileCount = $body.find('.file-item').length;
        cy.log(`Initial files found: ${initialFileCount}`);
      } else {
        cy.log('No initial files found');
        // Verify empty state message
        cy.contains('No knowledge files loaded').should('be.visible');
      }
      
      // Step 4: Verify upload elements exist
      cy.get('input[type="file"]').should('exist').and('not.be.disabled');
      cy.contains('Upload File').should('be.visible');
      cy.screenshot('02-upload-interface-ready');
      
      // Step 5: Upload test file
      cy.fixture('test-knowledge.txt').then(fileContent => {
        cy.get('input[type="file"]').selectFile({
          contents: Cypress.Buffer.from(fileContent),
          fileName: 'cypress-test.txt',
          mimeType: 'text/plain'
        }, { force: true });
        
        cy.log('File upload initiated');
      });
      
      // Step 6: Wait for upload API call and verify it succeeds
      cy.wait('@uploadFile', { timeout: 15000 }).then((interception) => {
        expect(interception.response.statusCode).to.be.oneOf([200, 201]);
        cy.log('✅ Upload API call successful');
        cy.screenshot('03-upload-api-success');
      });
      
      // Step 7: Wait for documents refresh API call
      cy.wait('@getDocuments', { timeout: 10000 }).then((interception) => {
        expect(interception.response.statusCode).to.equal(200);
        cy.log('✅ Documents refresh API call successful');
      });
      
      // Step 8: Wait for UI to update and verify file appears
      cy.wait(3000);
      
      // Verify success message in chat
      cy.get('[data-testid="chat-messages"]').within(() => {
        cy.get('.chat-line').should('contain.text', 'uploaded successfully')
          .or('contain.text', 'File')
          .or('contain.text', 'success');
      });
      
      cy.screenshot('04-upload-success-message');
      
      // Step 9: Verify the uploaded file appears in the file list
      cy.get('.file-item').should('have.length.greaterThan', initialFileCount);
      
      // Find the specific uploaded file
      cy.get('.file-item').contains('cypress-test').should('exist').parents('.file-item').within(() => {
        // Verify file structure
        cy.get('.file-icon').should('contain', '📄');
        cy.get('.file-name').should('contain', 'cypress-test');
        cy.get('.file-meta').should('contain', 'text');
        cy.get('.file-action').should('contain', '✕').and('be.visible');
        
        cy.log('✅ Uploaded file verified in UI');
      });
      
      cy.screenshot('05-file-verified-in-list');
      
      // Step 10: Test file deletion
      cy.get('.file-item').contains('cypress-test').parents('.file-item').within(() => {
        cy.get('.file-action').click();
        cy.log('Delete button clicked');
      });
      
      // Step 11: Wait for delete API call and verify it succeeds
      cy.wait('@deleteFile', { timeout: 10000 }).then((interception) => {
        expect(interception.response.statusCode).to.be.oneOf([200, 204]);
        cy.log('✅ Delete API call successful');
        cy.screenshot('06-delete-api-success');
      });
      
      // Step 12: Wait for UI to update after deletion
      cy.wait(3000);
      
      // Verify deletion success message in chat
      cy.get('[data-testid="chat-messages"]').within(() => {
        cy.get('.chat-line').should('contain.text', 'deleted successfully')
          .or('contain.text', 'deleted')
          .or('contain.text', 'removed');
      });
      
      cy.screenshot('07-delete-success-message');
      
      // Step 13: Verify file is removed from the list
      cy.get('.file-item').should('have.length', initialFileCount);
      cy.get('.file-item').should('not.contain', 'cypress-test');
      
      cy.screenshot('08-file-deleted-verified');
      
      // Step 14: If back to zero files, verify empty state
      if (initialFileCount === 0) {
        cy.contains('No knowledge files loaded').should('be.visible');
      }
      
      cy.log('✅ Complete upload and deletion workflow verified');
    });
  });

  it('should handle multiple file operations correctly', () => {
    // Intercept API calls
    cy.intercept('POST', '**/knowledge/documents').as('uploadMultiple');
    cy.intercept('DELETE', '**/knowledge/documents/*').as('deleteMultiple');
    
    const testFiles = [
      { name: 'test-file-1.txt', content: 'First test file content for upload testing.' },
      { name: 'test-file-2.txt', content: 'Second test file with different content for verification.' }
    ];
    
    // Upload multiple files
    testFiles.forEach((testFile, index) => {
      cy.log(`Uploading file ${index + 1}: ${testFile.name}`);
      
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from(testFile.content),
        fileName: testFile.name,
        mimeType: 'text/plain'
      }, { force: true });
      
      // Wait for upload to complete
      cy.wait('@uploadMultiple', { timeout: 15000 });
      cy.wait(2000);
      
      // Verify file appears
      cy.get('.file-item').should('contain', testFile.name.replace('.txt', ''));
      
      cy.screenshot(`09-multiple-upload-${index + 1}`);
    });
    
    // Verify both files are present
    cy.get('.file-item').should('contain', 'test-file-1');
    cy.get('.file-item').should('contain', 'test-file-2');
    
    cy.screenshot('10-multiple-files-uploaded');
    
    // Delete all test files
    testFiles.forEach((testFile, index) => {
      cy.get('.file-item').contains(testFile.name.replace('.txt', '')).parents('.file-item').within(() => {
        cy.get('.file-action').click();
      });
      
      cy.wait('@deleteMultiple', { timeout: 10000 });
      cy.wait(1000);
      
      cy.log(`✅ File ${index + 1} deleted: ${testFile.name}`);
    });
    
    cy.screenshot('11-multiple-files-cleaned-up');
  });

  it('should verify API endpoints are working with real data', () => {
    // Test the actual API endpoints directly
    cy.request('GET', 'http://127.0.0.1:7777/knowledge/documents').then((response) => {
      expect(response.status).to.equal(200);
      cy.log('✅ Health endpoint working');
    });
    
    cy.request('GET', 'http://127.0.0.1:7777/knowledge/documents').then((response) => {
      expect(response.status).to.equal(200);
      cy.log('✅ Documents endpoint working');
      cy.log(`Current documents: ${JSON.stringify(response.body)}`);
    });
    
    // Upload via API and verify it appears in UI
    cy.fixture('test-knowledge.txt').then(fileContent => {
      const formData = new FormData();
      const file = new File([fileContent], 'api-direct-test.txt', { type: 'text/plain' });
      formData.append('files', file);
      formData.append('agentId', 'test-user-123');
      
      cy.request({
        method: 'POST',
        url: 'http://127.0.0.1:7777/knowledge/documents',
        body: formData,
        timeout: 15000
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 201]);
        cy.log('✅ Direct API upload successful');
        
        // Refresh the page to see the uploaded file
        cy.reload();
        cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');
        cy.get('[data-testid="files-tab"]').click();
        cy.wait(3000);
        
        // Verify file appears in UI
        cy.get('.file-item').should('contain', 'api-direct-test');
        cy.screenshot('12-api-direct-upload-verified');
        
        // Clean up by deleting the file via UI
        cy.get('.file-item').contains('api-direct-test').parents('.file-item').within(() => {
          cy.get('.file-action').click();
        });
        
        cy.wait(3000);
        cy.screenshot('13-api-direct-upload-cleaned');
      });
    });
  });

  afterEach(() => {
    // Cleanup any remaining test files
    cy.get('body').then($body => {
      if ($body.find('.file-item').length > 0) {
        cy.get('.file-item').each($item => {
          const fileText = $item.text();
          if (fileText.includes('cypress-test') || 
              fileText.includes('test-file') || 
              fileText.includes('api-direct-test')) {
            cy.wrap($item).find('.file-action').click();
            cy.wait(1000);
          }
        });
      }
    });
    
    cy.screenshot('99-cleanup-complete');
  });
});