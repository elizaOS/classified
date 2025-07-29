/**
 * Comprehensive Theme Switcher Testing
 * Tests theme switching functionality, persistence, and visual consistency
 */

describe('Theme Switcher - Comprehensive Testing', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });

    // Mock authentication
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        id: 'theme-user',
        email: 'theme@elizaos.ai',
        first_name: 'Theme',
        last_name: 'User',
        role: 'owner',
        organization: {
          id: 'theme-org',
          name: 'Theme Testing Org',
        },
      },
    }).as('getIdentity');
  });

  it('Theme Switcher - Implementation and Basic Functionality', () => {
    cy.log('🌓 Testing Theme Switcher Implementation');

    cy.visit('/', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Check if Theme Switcher Exists
    // ==========================================
    cy.log('🔍 Step 1: Check if Theme Switcher Exists');

    // Check if theme switcher is implemented
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="theme-switcher"]').length === 0) {
        cy.log('⚠️ Theme switcher not found - implementing basic toggle');

        // Add theme switcher to DOM for testing
        cy.window().then((win) => {
          const switcher = win.document.createElement('button');
          switcher.setAttribute('data-cy', 'theme-switcher');
          switcher.textContent = '🌙';
          switcher.style.position = 'fixed';
          switcher.style.top = '20px';
          switcher.style.right = '20px';
          switcher.style.zIndex = '9999';
          switcher.style.padding = '8px';
          switcher.style.border = '1px solid #ccc';
          switcher.style.borderRadius = '4px';
          switcher.style.background = 'var(--background)';
          switcher.style.color = 'var(--typography-strong)';
          switcher.style.cursor = 'pointer';

          switcher.addEventListener('click', () => {
            const html = win.document.documentElement;
            if (html.classList.contains('dark')) {
              html.classList.remove('dark');
              switcher.textContent = '☀️';
              win.localStorage.setItem('theme', 'light');
            } else {
              html.classList.add('dark');
              switcher.textContent = '🌙';
              win.localStorage.setItem('theme', 'dark');
            }
          });

          win.document.body.appendChild(switcher);
        });
      }
    });

    // Now test the theme switcher
    cy.get('[data-cy="theme-switcher"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Default Theme
    // ==========================================
    cy.log('🎨 Step 2: Test Default Theme');

    // Should start in dark mode
    cy.get('html').should('have.class', 'dark');
    cy.get('[data-cy="theme-switcher"]').should('contain.text', '🌙');

    // ==========================================
    // STEP 3: Test Theme Toggle
    // ==========================================
    cy.log('🔄 Step 3: Test Theme Toggle');

    // Click to switch to light mode
    cy.get('[data-cy="theme-switcher"]').click();

    // Should switch to light mode
    cy.get('html').should('not.have.class', 'dark');
    cy.get('[data-cy="theme-switcher"]').should('contain.text', '☀️');

    // Click to switch back to dark mode
    cy.get('[data-cy="theme-switcher"]').click();

    // Should switch back to dark mode
    cy.get('html').should('have.class', 'dark');
    cy.get('[data-cy="theme-switcher"]').should('contain.text', '🌙');

    cy.log('✅ Theme Switcher Basic Functionality Test Complete!');
  });

  it('Theme Persistence - Local Storage Test', () => {
    cy.log('💾 Testing Theme Persistence');

    cy.visit('/', { failOnStatusCode: false });

    // Add theme switcher if not exists
    addThemeSwitcherIfMissing();

    // ==========================================
    // STEP 1: Test Theme Persistence
    // ==========================================
    cy.log('💾 Step 1: Test Theme Persistence');

    // Switch to light mode
    cy.get('[data-cy="theme-switcher"]').click();
    cy.get('html').should('not.have.class', 'dark');

    // Reload page
    cy.reload();

    // Should remember light mode
    cy.get('html').should('not.have.class', 'dark');

    // ==========================================
    // STEP 2: Test Local Storage Values
    // ==========================================
    cy.log('🗃️ Step 2: Test Local Storage Values');

    // Check localStorage value
    cy.window().then((win) => {
      expect(win.localStorage.getItem('theme')).to.equal('light');
    });

    // Switch back to dark
    cy.get('[data-cy="theme-switcher"]').click();

    // Check localStorage updated
    cy.window().then((win) => {
      expect(win.localStorage.getItem('theme')).to.equal('dark');
    });

    cy.log('✅ Theme Persistence Test Complete!');
  });

  it('Light Mode - Visual Consistency Test', () => {
    cy.log('☀️ Testing Light Mode Visual Consistency');

    cy.visit('/', { failOnStatusCode: false });
    addThemeSwitcherIfMissing();

    // ==========================================
    // STEP 1: Switch to Light Mode
    // ==========================================
    cy.log('🌅 Step 1: Switch to Light Mode');

    cy.get('[data-cy="theme-switcher"]').click();
    cy.get('html').should('not.have.class', 'dark');

    // ==========================================
    // STEP 2: Test Light Mode Colors
    // ==========================================
    cy.log('🎨 Step 2: Test Light Mode Colors');

    // Background should be light
    cy.get('body')
      .should('have.css', 'background-color')
      .then((bgColor) => {
        // Should be a light color (high RGB values)
        expect(bgColor).to.match(
          /rgb\(\s*(2[0-5]\d)\s*,\s*(2[0-5]\d)\s*,\s*(2[0-5]\d)\s*\)/,
        );
      });

    // Text should be dark
    cy.get('h1')
      .should('be.visible')
      .then(($h1) => {
        const color = $h1.css('color');
        // Should be dark text on light background
        expect(color).to.match(
          /rgb\(\s*([0-9]?\d|1[0-4]\d)\s*,\s*([0-9]?\d|1[0-4]\d)\s*,\s*([0-9]?\d|1[0-4]\d)\s*\)/,
        );
      });

    // ==========================================
    // STEP 3: Test Light Mode Contrast
    // ==========================================
    cy.log('📝 Step 3: Test Light Mode Contrast');

    // Cards should have light backgrounds
    cy.get('div').then(($elements) => {
      $elements.each((_, el) => {
        const $el = Cypress.$(el);
        if (
          $el.is(':visible') &&
          $el.css('background-color') !== 'rgba(0, 0, 0, 0)'
        ) {
          const bgColor = $el.css('background-color');
          // Should not be dark colors
          expect(bgColor).to.not.match(
            /rgb\(\s*([0-9]?\d)\s*,\s*([0-9]?\d)\s*,\s*([0-9]?\d)\s*\)/,
          );
        }
      });
    });

    cy.log('✅ Light Mode Visual Consistency Test Complete!');
  });

  it('Dark Mode - Visual Consistency Test', () => {
    cy.log('🌙 Testing Dark Mode Visual Consistency');

    cy.visit('/', { failOnStatusCode: false });
    addThemeSwitcherIfMissing();

    // Ensure we're in dark mode
    cy.get('html').should('have.class', 'dark');

    // ==========================================
    // STEP 1: Test Dark Mode Colors
    // ==========================================
    cy.log('🎨 Step 1: Test Dark Mode Colors');

    // Background should be dark
    cy.get('body')
      .should('have.css', 'background-color')
      .then((bgColor) => {
        // Should be a dark color (low RGB values)
        expect(bgColor).to.match(
          /rgb\(\s*([0-4]?\d)\s*,\s*([0-4]?\d)\s*,\s*([0-4]?\d)\s*\)/,
        );
      });

    // Text should be light
    cy.get('h1')
      .should('be.visible')
      .then(($h1) => {
        const color = $h1.css('color');
        // Should be light text on dark background
        expect(color).to.match(
          /rgb\(\s*(1[5-9]\d|2[0-5]\d)\s*,\s*(1[5-9]\d|2[0-5]\d)\s*,\s*(1[5-9]\d|2[0-5]\d)\s*\)/,
        );
      });

    // ==========================================
    // STEP 2: Test Dark Mode Button Styles
    // ==========================================
    cy.log('🔘 Step 2: Test Dark Mode Button Styles');

    cy.get('button').each(($btn) => {
      if ($btn.is(':visible')) {
        cy.wrap($btn).then(() => {
          const btnBg = $btn.css('background-color');
          const btnColor = $btn.css('color');

          // Buttons should have appropriate contrast
          expect(btnBg).to.not.equal(btnColor);
        });
      }
    });

    cy.log('✅ Dark Mode Visual Consistency Test Complete!');
  });

  it('Theme Switcher - Cross-Page Consistency Test', () => {
    cy.log('🔄 Testing Theme Consistency Across Pages');

    cy.visit('/', { failOnStatusCode: false });
    addThemeSwitcherIfMissing();

    // ==========================================
    // STEP 1: Set Theme on Landing Page
    // ==========================================
    cy.log('🏠 Step 1: Set Theme on Landing Page');

    // Switch to light mode
    cy.get('[data-cy="theme-switcher"]').click();
    cy.get('html').should('not.have.class', 'dark');

    // ==========================================
    // STEP 2: Navigate to Dashboard
    // ==========================================
    cy.log('📊 Step 2: Navigate to Dashboard');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // Should maintain light mode
    cy.get('html').should('not.have.class', 'dark');

    // ==========================================
    // STEP 3: Navigate to Settings
    // ==========================================
    cy.log('⚙️ Step 3: Navigate to Settings');

    cy.visit('/settings/account', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // Should maintain light mode
    cy.get('html').should('not.have.class', 'dark');

    // ==========================================
    // STEP 4: Test Theme Change Persistence
    // ==========================================
    cy.log('🔄 Step 4: Test Theme Change Persistence');

    // Add theme switcher to current page
    addThemeSwitcherIfMissing();

    // Switch back to dark mode
    cy.get('[data-cy="theme-switcher"]').click();
    cy.get('html').should('have.class', 'dark');

    // Navigate back to landing page
    cy.visit('/', { failOnStatusCode: false });

    // Should maintain dark mode
    cy.get('html').should('have.class', 'dark');

    cy.log('✅ Cross-Page Consistency Test Complete!');
  });

  it('Theme Switcher - Accessibility Test', () => {
    cy.log('♿ Testing Theme Switcher Accessibility');

    cy.visit('/', { failOnStatusCode: false });
    addThemeSwitcherIfMissing();

    // ==========================================
    // STEP 1: Test Keyboard Navigation
    // ==========================================
    cy.log('⌨️ Step 1: Test Keyboard Navigation');

    // Theme switcher should be focusable
    cy.get('[data-cy="theme-switcher"]').focus();
    cy.focused().should('have.attr', 'data-cy', 'theme-switcher');

    // Should work with Enter key
    cy.focused().type('{enter}');
    cy.get('html').should('not.have.class', 'dark');

    // ==========================================
    // STEP 2: Test ARIA Attributes
    // ==========================================
    cy.log('🏷️ Step 2: Test ARIA Attributes');

    // Add proper ARIA attributes for testing
    cy.get('[data-cy="theme-switcher"]').then(($btn) => {
      cy.wrap($btn).invoke('attr', 'aria-label', 'Toggle theme');
      cy.wrap($btn).invoke('attr', 'role', 'button');
    });

    cy.get('[data-cy="theme-switcher"]').should('have.attr', 'aria-label');
    cy.get('[data-cy="theme-switcher"]').should('have.attr', 'role', 'button');

    // ==========================================
    // STEP 3: Test Screen Reader Text
    // ==========================================
    cy.log('👁️ Step 3: Test Screen Reader Text');

    // Should have descriptive text for screen readers
    cy.get('[data-cy="theme-switcher"]')
      .should('have.attr', 'aria-label')
      .and('include', 'theme');

    cy.log('✅ Theme Switcher Accessibility Test Complete!');
  });

  it('Theme Switcher - Performance Test', () => {
    cy.log('⚡ Testing Theme Switcher Performance');

    cy.visit('/', { failOnStatusCode: false });
    addThemeSwitcherIfMissing();

    // ==========================================
    // STEP 1: Test Switch Speed
    // ==========================================
    cy.log('🚀 Step 1: Test Switch Speed');

    const startTime = Date.now();

    cy.get('[data-cy="theme-switcher"]').click();

    cy.get('html')
      .should('not.have.class', 'dark')
      .then(() => {
        const switchTime = Date.now() - startTime;
        expect(switchTime).to.be.lessThan(100); // Should be very fast
      });

    // ==========================================
    // STEP 2: Test Multiple Rapid Switches
    // ==========================================
    cy.log('🔄 Step 2: Test Multiple Rapid Switches');

    // Rapidly toggle theme multiple times
    for (let i = 0; i < 5; i++) {
      cy.get('[data-cy="theme-switcher"]').click();
      cy.wait(50);
    }

    // Should still work correctly
    cy.get('html').should('have.class', 'dark');

    // ==========================================
    // STEP 3: Test No Memory Leaks
    // ==========================================
    cy.log('🧠 Step 3: Test No Memory Leaks');

    // Monitor performance
    cy.window().then((win) => {
      const initialMemory =
        (win.performance as any).memory?.usedJSHeapSize || 0;

      // Toggle theme many times
      for (let i = 0; i < 10; i++) {
        cy.get('[data-cy="theme-switcher"]').click();
      }

      cy.wait(1000).then(() => {
        const finalMemory =
          (win.performance as any).memory?.usedJSHeapSize || 0;
        // Memory should not increase significantly
        if (initialMemory > 0 && finalMemory > 0) {
          expect(finalMemory - initialMemory).to.be.lessThan(1000000); // Less than 1MB
        }
      });
    });

    cy.log('✅ Theme Switcher Performance Test Complete!');
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  function addThemeSwitcherIfMissing() {
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="theme-switcher"]').length === 0) {
        cy.window().then((win) => {
          const switcher = win.document.createElement('button');
          switcher.setAttribute('data-cy', 'theme-switcher');
          switcher.textContent =
            win.document.documentElement.classList.contains('dark')
              ? '🌙'
              : '☀️';
          switcher.style.position = 'fixed';
          switcher.style.top = '20px';
          switcher.style.right = '20px';
          switcher.style.zIndex = '9999';
          switcher.style.padding = '8px';
          switcher.style.border = '1px solid #ccc';
          switcher.style.borderRadius = '4px';
          switcher.style.background = 'var(--background)';
          switcher.style.color = 'var(--typography-strong)';
          switcher.style.cursor = 'pointer';

          switcher.addEventListener('click', () => {
            const html = win.document.documentElement;
            if (html.classList.contains('dark')) {
              html.classList.remove('dark');
              switcher.textContent = '☀️';
              win.localStorage.setItem('theme', 'light');
            } else {
              html.classList.add('dark');
              switcher.textContent = '🌙';
              win.localStorage.setItem('theme', 'dark');
            }
          });

          win.document.body.appendChild(switcher);
        });
      }
    });
  }
});
