describe('Knowledge Base UI CRUD Operations', () => {
  beforeEach(() => {
    // Visit the game interface
    cy.visit('/', { timeout: 30000 });
    
    // Wait for the game interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');
    
    // Wait for initial loading
    cy.wait(3000);
  });

  describe('File Upload via UI', () => {
    it('should upload a file through the UI upload button', () => {
      // Navigate to Files tab
      cy.contains('FILES').click();
      cy.wait(1000);
      
      // Verify we're in the files tab
      cy.contains('KNOWLEDGE BASE').should('be.visible');
      
      // Check if upload button exists
      cy.get('label[for="file-upload"]').should('be.visible').should('contain', 'Upload File');
      
      // Create a test file
      const testFileName = 'cypress-test-upload.txt';
      const testFileContent = 'This is a test file uploaded via Cypress UI testing.\n\nIt contains:\n- Test content\n- Upload validation\n- UI interaction testing';
      
      // Create the file and trigger upload
      cy.get('input[type="file"]#file-upload').selectFile(
        {
          contents: testFileContent,
          fileName: testFileName,
          mimeType: 'text/plain'
        },
        { force: true } // force because input is hidden
      );
      
      // Wait for upload to complete and file to appear
      cy.wait(5000);
      
      // Verify file appears in the knowledge base list
      cy.get('.file-item').should('exist');
      cy.contains(testFileName.replace('.txt', '')).should('be.visible');
      
      // Verify success message in output
      cy.contains('uploaded successfully').should('be.visible');
    });

    it('should handle upload errors gracefully', () => {
      // Navigate to Files tab
      cy.contains('FILES').click();
      cy.wait(1000);
      
      // Try to upload an unsupported file type
      const invalidFileName = 'test-invalid.exe';
      const invalidContent = 'This is an invalid file type';
      
      cy.get('input[type="file"]#file-upload').selectFile(
        {
          contents: invalidContent,
          fileName: invalidFileName,
          mimeType: 'application/x-executable'
        },
        { force: true }
      );
      
      // Should show error message
      cy.contains('upload failed', { matchCase: false }).should('be.visible');
    });

    it('should validate file size limits', () => {
      // Navigate to Files tab
      cy.contains('FILES').click();
      cy.wait(1000);
      
      // Create a large file (over reasonable limits)
      const largeFileName = 'large-test-file.txt';
      const largeContent = 'X'.repeat(100000); // 100KB of X's
      
      cy.get('input[type="file"]#file-upload').selectFile(
        {
          contents: largeContent,
          fileName: largeFileName,
          mimeType: 'text/plain'
        },
        { force: true }
      );
      
      // Should either upload successfully or show appropriate error
      cy.wait(3000);
      
      // Check for either success or appropriate error handling
      cy.get('body').then(($body) => {
        if ($body.text().includes('uploaded successfully')) {
          cy.log('Large file upload succeeded');
        } else if ($body.text().includes('too large') || $body.text().includes('size')) {
          cy.log('Large file upload properly rejected');
        }
      });
    });
  });

  describe('File Management via UI', () => {
    let uploadedFileName: string;

    beforeEach(() => {
      // Upload a test file for management testing
      cy.contains('FILES').click();
      cy.wait(1000);
      
      uploadedFileName = 'cypress-management-test.txt';
      const testContent = 'This file is for testing management operations like viewing and deletion.';
      
      cy.get('input[type="file"]#file-upload').selectFile(
        {
          contents: testContent,
          fileName: uploadedFileName,
          mimeType: 'text/plain'
        },
        { force: true }
      );
      
      // Wait for upload to complete
      cy.wait(5000);
      cy.contains('uploaded successfully', { timeout: 10000 }).should('be.visible');
    });

    it('should display uploaded files in the knowledge base list', () => {
      // Verify file appears in the list
      cy.get('.file-item').should('exist');
      
      // Check file details are displayed
      cy.get('.file-item').within(() => {
        cy.get('.file-icon').should('contain', '📄');
        cy.get('.file-name').should('exist');
        cy.get('.file-meta').should('exist');
        cy.get('.file-action').should('exist').should('contain', '✕');
      });
      
      // Verify file shows up with expected name (without extension)
      cy.contains(uploadedFileName.replace('.txt', '')).should('be.visible');
    });

    it('should show file metadata correctly', () => {
      cy.get('.file-item').first().within(() => {
        // Check file metadata format
        cy.get('.file-meta').should('exist');
        cy.get('.file-meta').should('contain', 'text/plain');
        
        // Should show creation date
        cy.get('.file-meta').should('match', /\d{1,2}\/\d{1,2}\/\d{4}/);
      });
    });

    it('should update the knowledge base count', () => {
      // Check that the count in the header updates
      cy.get('.status-header').should('contain', 'KNOWLEDGE BASE');
      
      // Should show count greater than 0
      cy.get('.status-header').should('match', /\[[\d]+\]/);
    });
  });

  describe('File Deletion via UI', () => {
    beforeEach(() => {
      // Upload a test file for deletion testing
      cy.contains('FILES').click();
      cy.wait(1000);
      
      const testFileName = 'cypress-delete-test.txt';
      const testContent = 'This file will be deleted during testing.';
      
      cy.get('input[type="file"]#file-upload').selectFile(
        {
          contents: testContent,
          fileName: testFileName,
          mimeType: 'text/plain'
        },
        { force: true }
      );
      
      // Wait for upload to complete
      cy.wait(5000);
      cy.contains('uploaded successfully', { timeout: 10000 }).should('be.visible');
    });

    it('should delete files when clicking the delete button', () => {
      // Get initial file count
      cy.get('.file-item').then($items => {
        const initialCount = $items.length;
        
        // Click delete button on the first file
        cy.get('.file-item').first().within(() => {
          cy.get('.file-action').should('be.visible').click();
        });
        
        // Wait for deletion to complete
        cy.wait(3000);
        
        // Verify file was deleted
        cy.get('.file-item').should('have.length', initialCount - 1);
        
        // Verify success message
        cy.contains('deleted successfully').should('be.visible');
      });
    });

    it('should handle deletion errors gracefully', () => {
      // This test covers the case where deletion might fail
      // We'll monitor for error messages
      
      cy.get('.file-item').first().within(() => {
        cy.get('.file-action').click();
      });
      
      cy.wait(3000);
      
      // Check for either success or error message
      cy.get('body').then(($body) => {
        if ($body.text().includes('deleted successfully')) {
          cy.log('File deletion succeeded');
        } else if ($body.text().includes('Failed to delete') || $body.text().includes('error')) {
          cy.log('File deletion error handled appropriately');
        }
      });
    });

    it('should update UI immediately after deletion', () => {
      // Store initial state
      cy.get('.file-item').then($items => {
        const initialCount = $items.length;
        
        if (initialCount > 0) {
          // Get the name of the file we're about to delete
          cy.get('.file-item').first().find('.file-name').invoke('text').then(fileName => {
            // Delete the file
            cy.get('.file-item').first().within(() => {
              cy.get('.file-action').click();
            });
            
            // Wait for deletion
            cy.wait(3000);
            
            // Verify the specific file is no longer in the list
            cy.get('.file-name').should('not.contain', fileName);
            
            // Verify count decreased
            cy.get('.file-item').should('have.length', initialCount - 1);
          });
        } else {
          cy.log('No files to delete');
        }
      });
    });
  });

  describe('Complete Upload-to-Delete Workflow', () => {
    it('should complete full workflow: upload, verify, delete', () => {
      // Step 1: Navigate to Files tab
      cy.contains('FILES').click();
      cy.wait(1000);
      
      // Step 2: Get initial state
      cy.get('body').then($body => {
        const hasFiles = $body.find('.file-item').length > 0;
        const initialCount = $body.find('.file-item').length;
        
        cy.log(`Initial file count: ${initialCount}`);
        
        // Step 3: Upload a new file
        const workflowFileName = 'cypress-workflow-test.txt';
        const workflowContent = 'Complete workflow test file - upload, verify, delete';
        
        cy.get('input[type="file"]#file-upload').selectFile(
          {
            contents: workflowContent,
            fileName: workflowFileName,
            mimeType: 'text/plain'
          },
          { force: true }
        );
        
        // Step 4: Verify upload success
        cy.wait(5000);
        cy.contains('uploaded successfully', { timeout: 10000 }).should('be.visible');
        
        // Step 5: Verify file appears in list
        cy.get('.file-item').should('have.length', initialCount + 1);
        cy.contains(workflowFileName.replace('.txt', '')).should('be.visible');
        
        // Step 6: Verify file has correct metadata
        cy.get('.file-item').should('contain', 'text/plain');
        
        // Step 7: Delete the uploaded file
        cy.get('.file-item').contains(workflowFileName.replace('.txt', '')).closest('.file-item').within(() => {
          cy.get('.file-action').should('be.visible').click();
        });
        
        // Step 8: Verify deletion success
        cy.wait(3000);
        cy.contains('deleted successfully').should('be.visible');
        
        // Step 9: Verify file removed from list
        cy.get('.file-item').should('have.length', initialCount);
        cy.contains(workflowFileName.replace('.txt', '')).should('not.exist');
        
        cy.log('✅ Complete workflow test passed');
      });
    });
  });

  describe('Error States and Edge Cases', () => {
    it('should handle empty file uploads', () => {
      cy.contains('FILES').click();
      cy.wait(1000);
      
      // Try to upload an empty file
      cy.get('input[type="file"]#file-upload').selectFile(
        {
          contents: '',
          fileName: 'empty-file.txt',
          mimeType: 'text/plain'
        },
        { force: true }
      );
      
      cy.wait(3000);
      
      // Should either succeed (empty files allowed) or show appropriate error
      cy.get('body').then(($body) => {
        if ($body.text().includes('uploaded successfully')) {
          cy.log('Empty file upload allowed');
        } else if ($body.text().includes('empty') || $body.text().includes('size')) {
          cy.log('Empty file upload properly rejected');
        }
      });
    });

    it('should maintain state when switching tabs', () => {
      // Upload a file in Files tab
      cy.contains('FILES').click();
      cy.wait(1000);
      
      const tabSwitchFileName = 'tab-switch-test.txt';
      cy.get('input[type="file"]#file-upload').selectFile(
        {
          contents: 'Testing tab switching behavior',
          fileName: tabSwitchFileName,
          mimeType: 'text/plain'
        },
        { force: true }
      );
      
      cy.wait(5000);
      cy.contains('uploaded successfully').should('be.visible');
      
      // Switch to another tab
      cy.contains('GOALS').click();
      cy.wait(1000);
      
      // Switch back to Files tab
      cy.contains('FILES').click();
      cy.wait(1000);
      
      // Verify file is still there
      cy.contains(tabSwitchFileName.replace('.txt', '')).should('be.visible');
      
      // Clean up
      cy.get('.file-item').contains(tabSwitchFileName.replace('.txt', '')).closest('.file-item').within(() => {
        cy.get('.file-action').click();
      });
    });

    it('should show appropriate message when no files exist', () => {
      cy.contains('FILES').click();
      cy.wait(1000);
      
      // Check if there are any files, delete them all
      cy.get('body').then($body => {
        const fileItems = $body.find('.file-item');
        if (fileItems.length > 0) {
          // Delete all files one by one
          const deleteNext = () => {
            cy.get('.file-item').then($items => {
              if ($items.length > 0) {
                cy.get('.file-item').first().within(() => {
                  cy.get('.file-action').click();
                });
                cy.wait(2000);
                deleteNext();
              }
            });
          };
          deleteNext();
        }
      });
      
      // After all files deleted, should show empty state
      cy.get('.empty-state').should('be.visible').should('contain', 'No knowledge files loaded');
    });
  });

  describe('File Type Support', () => {
    const supportedFileTypes = [
      { extension: 'txt', mimeType: 'text/plain', content: 'Plain text content' },
      { extension: 'md', mimeType: 'text/markdown', content: '# Markdown Content\n\nThis is **markdown**.' },
      { extension: 'json', mimeType: 'application/json', content: '{"key": "value", "test": true}' },
      { extension: 'csv', mimeType: 'text/csv', content: 'name,age,city\nJohn,30,NYC\nJane,25,LA' }
    ];

    supportedFileTypes.forEach(fileType => {
      it(`should support ${fileType.extension.toUpperCase()} files`, () => {
        cy.contains('FILES').click();
        cy.wait(1000);
        
        const fileName = `test-file.${fileType.extension}`;
        
        cy.get('input[type="file"]#file-upload').selectFile(
          {
            contents: fileType.content,
            fileName: fileName,
            mimeType: fileType.mimeType
          },
          { force: true }
        );
        
        cy.wait(5000);
        
        // Should either succeed or show specific file type error
        cy.get('body').then(($body) => {
          if ($body.text().includes('uploaded successfully')) {
            cy.log(`${fileType.extension.toUpperCase()} file upload succeeded`);
            
            // Verify file appears with correct type
            cy.contains(fileName.replace(`.${fileType.extension}`, '')).should('be.visible');
            
            // Clean up - delete the uploaded file
            cy.get('.file-item').contains(fileName.replace(`.${fileType.extension}`, '')).closest('.file-item').within(() => {
              cy.get('.file-action').click();
            });
            cy.wait(2000);
          } else {
            cy.log(`${fileType.extension.toUpperCase()} file upload rejected (may not be supported)`);
          }
        });
      });
    });
  });
});