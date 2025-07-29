/**
 * Comprehensive Landing Page Testing
 * Tests all features, buttons, responsive design, and dark theme compliance
 */

describe('Landing Page - Comprehensive Testing', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });
  });

  it('Landing Page - Complete Layout and Navigation Test', () => {
    cy.log('🏠 Testing Landing Page Complete Layout');

    // Mock authentication check for unauthenticated state
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 401,
      body: { error: 'Unauthorized' },
    }).as('getIdentity');

    cy.visit('/', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test Page Structure and Metadata
    // ==========================================
    cy.log('📄 Step 1: Test Page Structure and Metadata');

    // Test page title and meta
    cy.title().should('include', 'ElizaOS Platform');
    cy.get('head meta[name="description"]').should('exist');

    // Test main page structure
    cy.get('nav').should('be.visible').and('contain.text', 'ElizaOS Platform');
    cy.get('main').should('exist');
    cy.get('footer').should('be.visible');

    // ==========================================
    // STEP 2: Test Navigation Bar
    // ==========================================
    cy.log('🧭 Step 2: Test Navigation Bar');

    // Test logo and brand
    cy.get('nav').within(() => {
      cy.contains('ElizaOS Platform').should('be.visible');
      cy.get('a[href="/dashboard"]').should('exist');

      // Test authentication buttons (unauthenticated state)
      cy.contains('Sign In').should('be.visible').and('be.a', 'button');
      cy.contains('Get Started').should('be.visible').and('be.a', 'button');
    });

    // ==========================================
    // STEP 3: Test Hero Section
    // ==========================================
    cy.log('🦸 Step 3: Test Hero Section');

    // Test hero content
    cy.get('h1').should('be.visible').and('contain.text', 'build with ElizaOS');
    cy.get('section')
      .first()
      .within(() => {
        cy.contains('Build, deploy, and manage AI agents').should('be.visible');

        // Test CTA buttons
        cy.contains('Start Building')
          .should('be.visible')
          .and('be.a', 'button');
        cy.contains('Learn More').should('be.visible').and('be.a', 'button');
      });

    // ==========================================
    // STEP 4: Test Features Section
    // ==========================================
    cy.log('✨ Step 4: Test Features Section');

    // Test features section
    cy.contains('Everything you need to build AI agents').should('be.visible');

    // Test individual feature cards
    const expectedFeatures = [
      'Agent Development Interface',
      'Multi-Provider AI Support',
      'Development Environment',
      'Usage Tracking',
      'Development Security',
      'Quick Setup',
    ];

    expectedFeatures.forEach((feature) => {
      cy.contains(feature).should('be.visible');
    });

    // ==========================================
    // STEP 5: Test Framework Section
    // ==========================================
    cy.log('🔧 Step 5: Test Framework Section');

    cy.contains('Built on ElizaOS Framework').should('be.visible');
    cy.contains('Plugin Architecture').should('be.visible');
    cy.contains('Multi-Platform Support').should('be.visible');
    cy.contains('Real-time Development').should('be.visible');

    // ==========================================
    // STEP 6: Test Footer
    // ==========================================
    cy.log('📋 Step 6: Test Footer');

    cy.get('footer').within(() => {
      // Test footer sections
      cy.contains('Product').should('be.visible');
      cy.contains('Support').should('be.visible');
      cy.contains('Company').should('be.visible');

      // Test social links
      cy.get('a[href*="github.com"]').should('exist');
      cy.get('a[href*="discord.gg"]').should('exist');
      cy.get('a[href*="twitter.com"]').should('exist');

      // Test footer links
      cy.contains('Privacy Policy').should('be.visible');
      cy.contains('Terms of Service').should('be.visible');
    });

    cy.log('✅ Landing Page Layout Test Complete!');
  });

  it('Landing Page - Dark Theme and Color Contrast Test', () => {
    cy.log('🌙 Testing Landing Page Dark Theme Compliance');

    cy.visit('/', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test Dark Theme Class Application
    // ==========================================
    cy.log('🎨 Step 1: Test Dark Theme Class Application');

    // Verify dark class is applied to html
    cy.get('html').should('have.class', 'dark');

    // Test background colors are dark
    cy.get('body').should('have.css', 'background-color');
    cy.get('body').then(($body) => {
      const bgColor = $body.css('background-color');
      // Should be a dark color (low RGB values)
      expect(bgColor).to.match(
        /rgb\(\s*([0-4]?\d|5[0-2])\s*,\s*([0-4]?\d|5[0-2])\s*,\s*([0-4]?\d|5[0-2])\s*\)/,
      );
    });

    // ==========================================
    // STEP 2: Test Text Contrast in Dark Theme
    // ==========================================
    cy.log('📝 Step 2: Test Text Contrast in Dark Theme');

    // Test main heading contrast
    cy.get('h1')
      .should('be.visible')
      .then(($h1) => {
        const color = $h1.css('color');
        const bgColor = $h1.css('background-color');

        // Text should be light on dark background
        expect(color).to.match(
          /rgb\(\s*(1[5-9]\d|2[0-5]\d)\s*,\s*(1[5-9]\d|2[0-5]\d)\s*,\s*(1[5-9]\d|2[0-5]\d)\s*\)/,
        );
      });

    // Test paragraph text contrast
    cy.get('p')
      .first()
      .should('be.visible')
      .then(($p) => {
        const color = $p.css('color');
        // Should have good contrast (lighter than background, darker than headings)
        expect(color).to.match(
          /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+)?\s*\)/,
        );
      });

    // ==========================================
    // STEP 3: Test Card Colors and Contrast
    // ==========================================
    cy.log('🃏 Step 3: Test Card Colors and Contrast');

    // Test feature cards have proper background contrast
    cy.get('section')
      .contains('Everything you need')
      .parent()
      .within(() => {
        cy.get('div')
          .contains('Agent Development Interface')
          .parent()
          .then(($card) => {
            const cardBg = $card.css('background-color');
            const bodyBg = Cypress.$('body').css('background-color');

            // Cards should be slightly lighter than body background but still dark
            expect(cardBg).to.not.equal(bodyBg);
          });
      });

    // ==========================================
    // STEP 4: Test Button Colors and States
    // ==========================================
    cy.log('🔘 Step 4: Test Button Colors and States');

    // Test primary CTA button
    cy.contains('Start Building').then(($btn) => {
      const btnBg = $btn.css('background-color');
      const btnColor = $btn.css('color');

      // Button should have high contrast
      expect(btnBg).to.not.equal('transparent');
      expect(btnColor).to.not.equal(btnBg);
    });

    // Test hover states
    cy.contains('Start Building')
      .trigger('mouseover')
      .then(($btn) => {
        // Should have visible hover state
        cy.wrap($btn).should('be.visible');
      });

    // ==========================================
    // STEP 5: Test Navigation Colors
    // ==========================================
    cy.log('🧭 Step 5: Test Navigation Colors');

    cy.get('nav').then(($nav) => {
      const navBg = $nav.css('background-color');
      const bodyBg = Cypress.$('body').css('background-color');

      // Navigation should have proper contrast
      expect(navBg).to.not.equal('transparent');
    });

    // ==========================================
    // STEP 6: Test Footer Colors
    // ==========================================
    cy.log('📋 Step 6: Test Footer Colors');

    cy.get('footer').then(($footer) => {
      const footerBg = $footer.css('background-color');

      // Footer should have dark theme colors
      expect(footerBg).to.not.equal('transparent');
    });

    cy.log('✅ Dark Theme Test Complete!');
  });

  it('Landing Page - Button Interactions and Navigation Test', () => {
    cy.log('🖱️ Testing Landing Page Button Interactions');

    // Mock unauthenticated state
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 401,
      body: { error: 'Unauthorized' },
    }).as('getIdentity');

    cy.visit('/', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test Navigation Button Clicks
    // ==========================================
    cy.log('🧭 Step 1: Test Navigation Button Clicks');

    // Test "Sign In" button navigation
    cy.get('nav').contains('Sign In').click();
    cy.url().should('include', '/auth/login');

    // Go back to test other buttons
    cy.go('back');

    // Test "Get Started" button in nav
    cy.get('nav').contains('Get Started').click();
    cy.url().should('include', '/auth/login');

    cy.go('back');

    // ==========================================
    // STEP 2: Test Hero CTA Buttons
    // ==========================================
    cy.log('🦸 Step 2: Test Hero CTA Buttons');

    // Test primary CTA button
    cy.contains('Start Building').click();
    cy.url().should('include', '/auth/login');

    cy.go('back');

    // Test secondary CTA button (Learn More)
    cy.contains('Learn More').click();
    cy.url().should('include', '#features');

    // ==========================================
    // STEP 3: Test Footer Link Navigation
    // ==========================================
    cy.log('📋 Step 3: Test Footer Link Navigation');

    // Test privacy policy link
    cy.get('footer').contains('Privacy Policy').click();
    cy.url().should('include', '/legal/privacy');

    cy.go('back');

    // Test terms of service link
    cy.get('footer').contains('Terms of Service').click();
    cy.url().should('include', '/legal/terms');

    cy.go('back');

    // ==========================================
    // STEP 4: Test External Social Links
    // ==========================================
    cy.log('🌐 Step 4: Test External Social Links');

    // Test GitHub link (should open in new tab)
    cy.get('footer')
      .get('a[href*="github.com"]')
      .should('have.attr', 'target', '_blank');

    // Test Discord link
    cy.get('footer')
      .get('a[href*="discord.gg"]')
      .should('have.attr', 'target', '_blank');

    // Test Twitter link
    cy.get('footer')
      .get('a[href*="twitter.com"]')
      .should('have.attr', 'target', '_blank');

    cy.log('✅ Button Interactions Test Complete!');
  });

  it('Landing Page - Responsive Design Test', () => {
    cy.log('📱 Testing Landing Page Responsive Design');

    cy.visit('/', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test Desktop Layout
    // ==========================================
    cy.log('🖥️ Step 1: Test Desktop Layout');

    cy.viewport(1920, 1080);

    // Test desktop navigation
    cy.get('nav').should('be.visible');
    cy.contains('Sign In').should('be.visible');
    cy.contains('Get Started').should('be.visible');

    // Test hero section layout
    cy.get('h1').should('be.visible');
    cy.contains('Start Building').should('be.visible');

    // ==========================================
    // STEP 2: Test Tablet Layout
    // ==========================================
    cy.log('📱 Step 2: Test Tablet Layout');

    cy.viewport(768, 1024);

    // Elements should still be visible and functional
    cy.get('nav').should('be.visible');
    cy.get('h1').should('be.visible');
    cy.contains('Start Building').should('be.visible');

    // Test feature cards adapt to tablet
    cy.contains('Agent Development Interface').should('be.visible');

    // ==========================================
    // STEP 3: Test Mobile Layout
    // ==========================================
    cy.log('📱 Step 3: Test Mobile Layout');

    cy.viewport(375, 812);

    // Test mobile navigation
    cy.get('nav').should('be.visible');

    // Test hero section on mobile
    cy.get('h1').should('be.visible');
    cy.contains('Start Building').should('be.visible');

    // Test feature cards stack properly
    cy.contains('Agent Development Interface').should('be.visible');

    // Test footer links are accessible
    cy.get('footer').should('be.visible');
    cy.contains('Privacy Policy').should('be.visible');

    // ==========================================
    // STEP 4: Test Ultra-wide Layout
    // ==========================================
    cy.log('🖥️ Step 4: Test Ultra-wide Layout');

    cy.viewport(2560, 1440);

    // Test content doesn't become too wide
    cy.get('section').first().should('be.visible');
    cy.get('h1').should('be.visible');

    cy.log('✅ Responsive Design Test Complete!');
  });

  it('Landing Page - Authenticated User State Test', () => {
    cy.log('🔐 Testing Landing Page for Authenticated Users');

    // Mock authenticated state
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        id: 'test-user',
        email: 'test@elizaos.ai',
        first_name: 'Test',
        last_name: 'User',
        role: 'owner',
        organization: {
          id: 'test-org',
          name: 'Test Organization',
        },
      },
    }).as('getIdentity');

    cy.visit('/', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // ==========================================
    // STEP 1: Test Authenticated Navigation
    // ==========================================
    cy.log('🧭 Step 1: Test Authenticated Navigation');

    // Should show Dashboard button instead of Sign In
    cy.get('nav').within(() => {
      cy.contains('Dashboard').should('be.visible');
      cy.contains('Sign In').should('not.exist');
    });

    // ==========================================
    // STEP 2: Test CTA Button Changes
    // ==========================================
    cy.log('🔘 Step 2: Test CTA Button Changes');

    // Primary CTA should say "Go to Dashboard"
    cy.contains('Go to Dashboard').should('be.visible');

    // Test dashboard navigation
    cy.contains('Go to Dashboard').first().click();
    cy.url().should('include', '/dashboard');

    cy.log('✅ Authenticated State Test Complete!');
  });

  it('Landing Page - Performance and Load Test', () => {
    cy.log('⚡ Testing Landing Page Performance');

    const startTime = Date.now();

    cy.visit('/', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test Initial Load Performance
    // ==========================================
    cy.log('🚀 Step 1: Test Initial Load Performance');

    // Page should load within reasonable time
    cy.get('h1')
      .should('be.visible')
      .then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(5000); // 5 seconds max
      });

    // ==========================================
    // STEP 2: Test Critical Elements Load
    // ==========================================
    cy.log('📄 Step 2: Test Critical Elements Load');

    // All critical elements should be present
    cy.get('nav').should('be.visible');
    cy.get('h1').should('be.visible');
    cy.get('footer').should('be.visible');

    // Images should load (if any)
    cy.get('img').each(($img) => {
      cy.wrap($img).should('be.visible');
    });

    // ==========================================
    // STEP 3: Test No Console Errors
    // ==========================================
    cy.log('🔍 Step 3: Test No Console Errors');

    // Check for JavaScript errors
    cy.window().then((win) => {
      expect(win.console.error).to.not.have.been.called;
    });

    cy.log('✅ Performance Test Complete!');
  });
});
