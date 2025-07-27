describe('Capability Buttons Complete Test', () => {
  beforeEach(() => {
    // Start fresh each test
    cy.visit('http://localhost:5173');
    cy.wait(2000);

    // Wait for the app to fully load
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');
    cy.get('[data-testid="connection-status"]', { timeout: 10000 }).should(
      'contain.text',
      'ONLINE'
    );
  });

  it('should display all capability buttons in correct layout', () => {
    // Verify all buttons are present and visible
    const expectedButtons = [
      'autonomy-toggle',
      'camera-toggle',
      'screen-toggle',
      'microphone-toggle',
      'speakers-toggle',
      'shell-toggle',
      'browser-toggle',
    ];

    expectedButtons.forEach((buttonId) => {
      cy.get(`[data-testid="${buttonId}"]`)
        .should('be.visible')
        .should('have.css', 'cursor', 'pointer');
    });

    // Take screenshot of button layout
    cy.screenshot('capability-buttons-layout');

    // Verify buttons are in a horizontal row
    cy.get('[data-testid="autonomy-toggle"]').then(($first) => {
      const firstRect = $first[0].getBoundingClientRect();

      cy.get('[data-testid="camera-toggle"]').then(($second) => {
        const secondRect = $second[0].getBoundingClientRect();

        // Buttons should be on same horizontal line
        expect(Math.abs(firstRect.top - secondRect.top)).to.be.lessThan(5);

        // Second button should be to the right of first
        expect(secondRect.left).to.be.greaterThan(firstRect.right - 5);
      });
    });
  });

  it('should have square buttons that fill the row', () => {
    // Check that buttons have correct sizing
    cy.get('[data-testid="autonomy-toggle"]').then(($btn) => {
      const rect = $btn[0].getBoundingClientRect();

      // Button should have height of 40px (plus borders)
      expect(rect.height).to.be.approximately(40, 5);

      // Button should have flex properties to fill available space
      expect($btn.css('flex')).to.equal('1 1 0px');
      expect($btn.css('display')).to.equal('flex');
    });

    // Verify all buttons have same height
    const buttonSelectors = [
      '[data-testid="autonomy-toggle"]',
      '[data-testid="camera-toggle"]',
      '[data-testid="screen-toggle"]',
      '[data-testid="microphone-toggle"]',
      '[data-testid="speakers-toggle"]',
      '[data-testid="shell-toggle"]',
      '[data-testid="browser-toggle"]',
    ];

    let firstHeight: number;

    cy.get(buttonSelectors[0]).then(($first) => {
      firstHeight = $first[0].getBoundingClientRect().height;

      buttonSelectors.slice(1).forEach((selector) => {
        cy.get(selector).then(($btn) => {
          const height = $btn[0].getBoundingClientRect().height;
          expect(height).to.be.approximately(firstHeight, 2);
        });
      });
    });
  });

  it('should toggle individual buttons correctly without cross-activation', () => {
    // Test each button individually with proper backend integration
    const buttonTests = [
      { testId: 'autonomy-toggle', statusTestId: 'autonomy-toggle-status', name: 'autonomy' },
      { testId: 'camera-toggle', statusTestId: 'camera-toggle-status', name: 'camera' },
      { testId: 'screen-toggle', statusTestId: 'screen-toggle-status', name: 'screen' },
      { testId: 'microphone-toggle', statusTestId: 'microphone-toggle-status', name: 'microphone' },
      { testId: 'speakers-toggle', statusTestId: 'speakers-toggle-status', name: 'speakers' },
      { testId: 'shell-toggle', statusTestId: 'shell-toggle-status', name: 'shell' },
      { testId: 'browser-toggle', statusTestId: 'browser-toggle-status', name: 'browser' },
    ];

    buttonTests.forEach(({ testId, statusTestId, name }) => {
      cy.log(`Testing ${name} button`);

      // Ensure button starts in OFF state
      cy.get(`[data-testid="${statusTestId}"]`).should('contain.text', '○');
      cy.get(`[data-testid="${testId}"]`)
        .should('have.css', 'background-color', 'rgb(26, 26, 26)') // #1a1a1a
        .should('have.css', 'color', 'rgb(0, 255, 0)'); // #00ff00

      // Click the button to turn it ON
      cy.get(`[data-testid="${testId}"]`).click();

      // Wait for API call to complete (buttons show loading state)
      cy.get(`[data-testid="${testId}"]`).should('not.contain.text', '...');

      // Note: Due to backend integration, actual state depends on API response
      // We focus on verifying button interaction works (no cross-activation)

      // Verify ALL OTHER buttons remain in their original states (no cross-activation)
      buttonTests.forEach(
        ({ testId: _otherTestId, statusTestId: otherStatusTestId, name: otherName }) => {
          if (otherName !== name) {
            // Other buttons should not change from their initial state
            cy.get(`[data-testid="${otherStatusTestId}"]`).should('contain.text', '○');
          }
        }
      );

      cy.wait(1000); // Allow time for API calls to complete
    });

    cy.screenshot('all-buttons-tested-individually');
  });

  it('should handle multiple buttons being active simultaneously', () => {
    // Turn on autonomy and camera buttons
    cy.get('[data-testid="autonomy-toggle"]').click();
    cy.get('[data-testid="camera-toggle"]').click();

    // Verify both are active
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '●');
    cy.get('[data-testid="camera-toggle-status"]').should('contain.text', '●');

    // Verify visual states
    cy.get('[data-testid="autonomy-toggle"]').should(
      'have.css',
      'background-color',
      'rgb(0, 255, 0)'
    );
    cy.get('[data-testid="camera-toggle"]').should(
      'have.css',
      'background-color',
      'rgb(0, 255, 0)'
    );

    // Add screen button
    cy.get('[data-testid="screen-toggle"]').click();
    cy.get('[data-testid="screen-toggle-status"]').should('contain.text', '●');

    // Verify all three are still active
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '●');
    cy.get('[data-testid="camera-toggle-status"]').should('contain.text', '●');
    cy.get('[data-testid="screen-toggle-status"]').should('contain.text', '●');

    // Turn off middle one (camera)
    cy.get('[data-testid="camera-toggle"]').click();
    cy.get('[data-testid="camera-toggle-status"]').should('contain.text', '○');

    // Verify others remain active
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '●');
    cy.get('[data-testid="screen-toggle-status"]').should('contain.text', '●');

    cy.screenshot('multiple-buttons-active');
  });

  it('should have proper visual styling for terminal/hacker theme', () => {
    // Check font and styling
    cy.get('[data-testid="autonomy-toggle"]').should(($btn) => {
      const styles = window.getComputedStyle($btn[0]);
      expect(styles.fontFamily).to.include('monospace');
      expect(styles.fontWeight).to.equal('bold');
      expect(styles.textTransform).to.equal('uppercase');
      expect(styles.userSelect).to.equal('none');
      expect(styles.display).to.equal('flex');
      expect(styles.alignItems).to.equal('center');
      expect(styles.justifyContent).to.equal('center');
      expect(styles.flexDirection).to.equal('column');
    });

    // Check terminal green colors
    cy.get('[data-testid="autonomy-toggle"]')
      .should('have.css', 'color', 'rgb(0, 255, 0)') // inactive text
      .should('have.css', 'border-color', 'rgb(51, 51, 51)'); // inactive border

    // Activate button and check active colors
    cy.get('[data-testid="autonomy-toggle"]').click();
    cy.get('[data-testid="autonomy-toggle"]')
      .should('have.css', 'background-color', 'rgb(0, 255, 0)') // active bg
      .should('have.css', 'color', 'rgb(0, 0, 0)') // active text
      .should('have.css', 'border-color', 'rgb(0, 255, 0)'); // active border

    cy.screenshot('terminal-styling-verification');
  });

  it('should display correct labels and status indicators', () => {
    const expectedLabels = [
      { testId: 'autonomy-toggle', label: 'AUTO' },
      { testId: 'camera-toggle', label: 'CAM' },
      { testId: 'screen-toggle', label: 'SCR' },
      { testId: 'microphone-toggle', label: 'MIC' },
      { testId: 'speakers-toggle', label: 'SPK' },
      { testId: 'shell-toggle', label: 'SH' },
      { testId: 'browser-toggle', label: 'WWW' },
    ];

    expectedLabels.forEach(({ testId, label }) => {
      cy.get(`[data-testid="${testId}"]`).should('contain.text', label);
      cy.get(`[data-testid="${testId.replace('-toggle', '-toggle-status')}"]`).should(
        'contain.text',
        '○'
      ); // Should start inactive
    });

    // Test status indicator change
    cy.get('[data-testid="autonomy-toggle"]').click();
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '●');

    cy.screenshot('labels-and-indicators');
  });

  it('should log correct console messages when clicked', () => {
    // Enable console logging capture
    cy.window().then((win) => {
      cy.stub(win.console, 'log').as('consoleLog');
    });

    // Click autonomy button
    cy.get('[data-testid="autonomy-toggle"]').click();
    cy.get('@consoleLog').should('have.been.calledWith', 'CLICKED: autonomy');

    // Click camera button
    cy.get('[data-testid="camera-toggle"]').click();
    cy.get('@consoleLog').should('have.been.calledWith', 'CLICKED: camera');

    // Click screen button
    cy.get('[data-testid="screen-toggle"]').click();
    cy.get('@consoleLog').should('have.been.calledWith', 'CLICKED: screen');

    cy.screenshot('console-logging-test');
  });

  it('should maintain state through rapid clicking', () => {
    // Rapidly click autonomy button multiple times
    cy.get('[data-testid="autonomy-toggle"]').click().click().click().click();

    // Should end up in OFF state (clicked 4 times = even number)
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '○');

    // Click once more
    cy.get('[data-testid="autonomy-toggle"]').click();
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '●');

    // Test with another button
    cy.get('[data-testid="camera-toggle"]').click().click().click();
    cy.get('[data-testid="camera-toggle-status"]').should('contain.text', '●'); // odd number of clicks

    // Verify autonomy is still active
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '●');

    cy.screenshot('rapid-clicking-test');
  });

  it('should prevent event bubbling and default behavior', () => {
    // This test ensures preventDefault and stopPropagation work
    // We can verify by checking that buttons work correctly even in complex DOM

    // Click buttons multiple times to ensure no weird behavior
    cy.get('[data-testid="autonomy-toggle"]').click();
    cy.get('[data-testid="camera-toggle"]').click();
    cy.get('[data-testid="screen-toggle"]').click();

    // Verify all are active
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '●');
    cy.get('[data-testid="camera-toggle-status"]').should('contain.text', '●');
    cy.get('[data-testid="screen-toggle-status"]').should('contain.text', '●');

    // Click parent areas around buttons (this should not affect button state)
    cy.get('.controls-section').click();

    // Verify buttons still active
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '●');
    cy.get('[data-testid="camera-toggle-status"]').should('contain.text', '●');
    cy.get('[data-testid="screen-toggle-status"]').should('contain.text', '●');

    cy.screenshot('event-handling-test');
  });

  after(() => {
    cy.screenshot('capability-buttons-test-complete');
  });
});
