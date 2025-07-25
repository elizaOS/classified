/// <reference types="cypress" />

describe('UI Improvements Test', () => {
  beforeEach(() => {
    // Skip boot sequence for faster testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });

    cy.visit('http://localhost:5173');

    // Wait for the game interface to load
    cy.get('.terminal-layout', { timeout: 10000 }).should('be.visible');
  });

  it('should display simplified terminal header without agent console text', () => {
    // Check that the panel header shows "TERMINAL" instead of "AGENT CONSOLE"
    cy.get('.panel-left .panel-header')
      .should('be.visible')
      .and('contain', 'TERMINAL')
      .and('not.contain', 'AGENT CONSOLE')
      .and('not.contain', 'Tokens')
      .and('not.contain', 'Cost');

    // Take screenshot of the header area
    cy.get('.panel-left .panel-header').screenshot('terminal-header-simplified');
  });

  it('should have clean terminal-style input without underline or focus effects', () => {
    // Check input field styling
    cy.get('.chat-input')
      .should('be.visible')
      .and('have.css', 'background-color', 'rgba(0, 0, 0, 0)')
      .and('have.css', 'border-bottom-width', '0px')
      .and('not.have.attr', 'placeholder', 'Enter command or message...');

    // Focus the input and check it doesn't have highlight effects
    cy.get('.chat-input').click({ force: true });
    cy.get('.chat-input')
      .should('have.focus')
      .and('have.css', 'background-color', 'rgba(0, 0, 0, 0)');

    // Take screenshot of the input area
    cy.get('.chat-input-form').screenshot('terminal-input-clean');
  });

  it('should have capabilities and tabs properly positioned in right panel', () => {
    // Verify the right panel contains both capabilities and tabs
    cy.get('.panel-right').within(() => {
      // Check capabilities section exists
      cy.get('.controls-section').should('be.visible');
      cy.get('.controls-header').should('contain', 'CAPABILITIES')
        .and('not.contain', 'AGENT'); // Should be shortened

      // Check tabs exist
      cy.get('.status-tabs').should('be.visible');
      cy.get('.tab-btn').should('have.length.at.least', 4);
    });

    // Verify there are only 2 panels (not 3 columns)
    cy.get('.terminal-layout > .panel').should('have.length', 2);

    // Take screenshot of the full layout
    cy.screenshot('terminal-layout-two-columns');
  });

  it('should have minimal send button styling', () => {
    // Check send button has minimal styling
    cy.get('.send-btn')
      .should('be.visible')
      .and('have.css', 'background-color', 'rgba(0, 0, 0, 0)')
      .and('have.css', 'border-style', 'solid');

    // Take screenshot of send button
    cy.get('.send-btn').screenshot('terminal-send-button-minimal');
  });

  it('should display all capability buttons in a single row', () => {
    // Get all control buttons
    cy.get('.control-btn').then(($buttons) => {
      expect($buttons).to.have.length.at.least(7); // Should have at least 7 buttons

      // Check all buttons have the same top position (indicating single row)
      const firstButtonTop = $buttons[0].getBoundingClientRect().top;

      for (let i = 1; i < $buttons.length; i++) {
        const buttonTop = $buttons[i].getBoundingClientRect().top;
        expect(buttonTop).to.equal(firstButtonTop, `Button ${i} should be on the same row as the first button`);
      }

      // Verify the controls grid is using flex display
      cy.get('.controls-grid')
        .should('have.css', 'display', 'flex')
        .and('have.css', 'flex-wrap', 'nowrap')
        .and('have.css', 'justify-content', 'space-between');

      // Verify buttons stretch evenly
      cy.get('.control-btn').first()
        .should('have.css', 'flex', '1 1 0%');
    });

    // Take screenshot of the single row controls
    cy.get('.controls-section').screenshot('terminal-capabilities-single-row');
  });

  it('should show proper button states with full background color when enabled', () => {
    // Check enabled button style (autonomy is on by default)
    cy.get('.control-btn').contains('AUTONOMY').parent()
      .should('have.class', 'enabled')
      .and('have.css', 'background-color', 'rgb(0, 255, 65)') // terminal-green
      .and('have.css', 'color', 'rgb(0, 17, 0)'); // terminal-bg

    // Take screenshot of enabled button
    cy.get('.control-btn').contains('AUTONOMY').parent()
      .screenshot('terminal-button-enabled-state');
  });

  it('should use shortened section headers', () => {
    // Check goals header
    cy.get('.tab-btn').contains('GOALS').click();
    cy.get('.status-header').should('contain', 'GOALS')
      .and('not.contain', 'OBJECTIVES');

    // Check tasks header
    cy.get('.tab-btn').contains('TODOS').click();
    cy.get('.status-header').should('contain', 'TASKS')
      .and('not.contain', 'QUEUE');

    // Check thoughts header
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    cy.get('.status-header').should('contain', 'THOUGHTS')
      .and('not.contain', 'AGENT');

    // Take screenshot of shortened headers
    cy.get('.panel-right').screenshot('terminal-shortened-headers');
  });

  it('should capture full interface screenshot', () => {
    // Wait a moment for everything to render
    cy.wait(1000);

    // Take a full page screenshot to show all improvements
    cy.screenshot('terminal-ui-improvements-complete', {
      capture: 'fullPage',
      overwrite: true
    });
  });

  it('should use full viewport width without empty space', () => {
    // Get viewport dimensions
    cy.window().then((win) => {
      const viewportWidth = win.innerWidth;

      // Check terminal container uses full viewport width
      cy.get('.terminal-container')
        .should('be.visible')
        .then(($container) => {
          const containerWidth = $container[0].getBoundingClientRect().width;
          // Allow for small differences due to scrollbars
          expect(containerWidth).to.be.at.least(viewportWidth - 20);
        });

      // Check terminal layout uses full container width
      cy.get('.terminal-layout')
        .should('be.visible')
        .then(($layout) => {
          const layoutWidth = $layout[0].getBoundingClientRect().width;
          cy.get('.terminal-container').then(($container) => {
            const containerWidth = $container[0].getBoundingClientRect().width;
            expect(layoutWidth).to.be.at.least(containerWidth - 10);
          });
        });

      // Verify panels together use full width
      cy.get('.panel-left').then(($left) => {
        cy.get('.panel-right').then(($right) => {
          const leftWidth = $left[0].getBoundingClientRect().width;
          const rightWidth = $right[0].getBoundingClientRect().width;
          const totalWidth = leftWidth + rightWidth;

          cy.get('.terminal-layout').then(($layout) => {
            const layoutWidth = $layout[0].getBoundingClientRect().width;
            // Allow for borders
            expect(totalWidth).to.be.at.least(layoutWidth - 10);
          });
        });
      });
    });

    // Take screenshot to verify no empty space
    cy.screenshot('terminal-full-width-layout', {
      capture: 'fullPage',
      overwrite: true
    });
  });
});
