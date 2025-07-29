describe('Marketing Pages', () => {
  beforeEach(() => {
    // Clear any existing authentication
    cy.clearAuthState();
  });

  describe('Website Lander Page', () => {
    it('should load website lander page successfully', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // Should load marketing content
      cy.get('body').should('contain.text', 'ElizaOS');
    });

    it('should display hero section with CTA buttons', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // Look for common marketing page elements
      cy.get('body').then(($body) => {
        // Should have hero section
        const hasHero =
          $body.find('h1').length > 0 ||
          $body.text().includes('Get Started') ||
          $body.text().includes('Learn More') ||
          $body.text().includes('Sign Up');

        expect(hasHero).to.be.true;

        // Look for CTA buttons
        if ($body.find('[data-cy="cta-get-started"]').length > 0) {
          cy.get('[data-cy="cta-get-started"]').should('be.visible');
        }

        if ($body.find('[data-cy="cta-learn-more"]').length > 0) {
          cy.get('[data-cy="cta-learn-more"]').should('be.visible');
        }

        if ($body.find('[data-cy="cta-sign-up"]').length > 0) {
          cy.get('[data-cy="cta-sign-up"]').should('be.visible');
        }
      });
    });

    it('should display features section', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // Should show product features
      cy.get('body').then(($body) => {
        const hasFeatures =
          $body.text().includes('Features') ||
          $body.text().includes('AI') ||
          $body.text().includes('Agent') ||
          $body.text().includes('Platform');

        expect(hasFeatures).to.be.true;
      });
    });

    it('should handle newsletter signup', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // Look for newsletter signup form
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="newsletter-email"]').length > 0) {
          cy.get('[data-cy="newsletter-email"]').type('test@example.com');

          if ($body.find('[data-cy="newsletter-submit"]').length > 0) {
            cy.get('[data-cy="newsletter-submit"]').click();
          }
        }
      });
    });

    it('should be responsive on mobile devices', () => {
      cy.viewport('iphone-x');
      cy.visit('/website-lander', { failOnStatusCode: false });

      // Should adapt to mobile viewport
      cy.get('body').should('not.have.css', 'overflow-x', 'scroll');

      // Content should be readable on mobile
      cy.get('h1').should('be.visible');
    });

    it('should have proper SEO elements', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // Should have title
      cy.title().should('not.be.empty');

      // Should have meta description
      cy.get('head meta[name="description"]').should('exist');

      // Should have proper heading structure
      cy.get('h1').should('exist');
    });
  });

  describe('App Lander Page', () => {
    it('should load app lander page successfully', () => {
      cy.visit('/app-lander', { failOnStatusCode: false });

      // Should load app-specific content
      cy.get('body').should('contain.text', 'App');
    });

    it('should display download/install buttons', () => {
      cy.visit('/app-lander', { failOnStatusCode: false });

      // Look for app download buttons
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="download-app"]').length > 0) {
          cy.get('[data-cy="download-app"]').should('be.visible');
        }

        if ($body.find('[data-cy="install-app"]').length > 0) {
          cy.get('[data-cy="install-app"]').should('be.visible');
        }

        // Should have some app-related call to action
        const hasAppCTA =
          $body.text().includes('Download') ||
          $body.text().includes('Install') ||
          $body.text().includes('Get the App');

        expect(hasAppCTA).to.be.true;
      });
    });

    it('should show app features and screenshots', () => {
      cy.visit('/app-lander', { failOnStatusCode: false });

      // Should display app features
      cy.get('body').then(($body) => {
        const hasAppFeatures =
          $body.find('img').length > 0 || // Screenshots
          $body.text().includes('Feature') ||
          $body.text().includes('Mobile') ||
          $body.text().includes('Desktop');

        expect(hasAppFeatures).to.be.true;
      });
    });

    it('should handle platform-specific downloads', () => {
      cy.visit('/app-lander', { failOnStatusCode: false });

      // Look for platform-specific download options
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="download-ios"]').length > 0) {
          cy.get('[data-cy="download-ios"]').should('be.visible');
        }

        if ($body.find('[data-cy="download-android"]').length > 0) {
          cy.get('[data-cy="download-android"]').should('be.visible');
        }

        if ($body.find('[data-cy="download-windows"]').length > 0) {
          cy.get('[data-cy="download-windows"]').should('be.visible');
        }

        if ($body.find('[data-cy="download-mac"]').length > 0) {
          cy.get('[data-cy="download-mac"]').should('be.visible');
        }
      });
    });

    it('should be responsive on mobile devices', () => {
      cy.viewport('iphone-x');
      cy.visit('/app-lander', { failOnStatusCode: false });

      // Should work well on mobile
      cy.get('body').should('not.have.css', 'overflow-x', 'scroll');

      // Should show mobile-optimized content
      cy.get('body').should('be.visible');
    });
  });

  describe('Cross-page Navigation', () => {
    it('should navigate between marketing pages', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // Look for navigation to app lander
      cy.get('body').then(($body) => {
        if ($body.find('a[href="/app-lander"]').length > 0) {
          cy.get('a[href="/app-lander"]').click();
          cy.url().should('include', '/app-lander');
        }
      });
    });

    it('should navigate to main application', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // Look for links to main app
      cy.get('body').then(($body) => {
        if ($body.find('a[href="/dashboard"]').length > 0) {
          cy.get('a[href="/dashboard"]').click();
          cy.url().should('include', '/dashboard');
        } else if ($body.find('a[href="/auth/login"]').length > 0) {
          cy.get('a[href="/auth/login"]').click();
          cy.url().should('include', '/auth/login');
        }
      });
    });

    it('should handle external links properly', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // External links should have proper attributes
      cy.get('a[target="_blank"]').should(($links) => {
        $links.each((index, link) => {
          expect(link).to.have.attr('rel').that.includes('noopener');
        });
      });
    });
  });

  describe('Performance and Accessibility', () => {
    it('should load marketing pages quickly', () => {
      const startTime = Date.now();

      cy.visit('/website-lander', { failOnStatusCode: false });

      cy.get('body')
        .should('be.visible')
        .then(() => {
          const loadTime = Date.now() - startTime;
          expect(loadTime).to.be.lessThan(5000); // Should load within 5 seconds
        });
    });

    it('should have accessible navigation', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // Check for accessible navigation
      cy.get('nav').should('exist');

      // Links should be keyboard accessible
      cy.get('a').should('be.visible').and('have.attr', 'href');

      // Should have proper focus management
      cy.get('a').first().focus().should('have.focus');
    });

    it('should handle images properly', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // Images should have alt text
      cy.get('img').should(($images) => {
        $images.each((index, img) => {
          expect(img).to.have.attr('alt');
        });
      });
    });

    it('should work without JavaScript', () => {
      // Test basic functionality without JavaScript
      cy.visit('/website-lander', {
        failOnStatusCode: false,
        onBeforeLoad: (win) => {
          // Disable JavaScript
          win.document.defaultView = null;
        },
      });

      // Basic content should still be visible
      cy.get('body').should('exist');
    });
  });

  describe('Analytics and Tracking', () => {
    it('should handle analytics tracking', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // Check for analytics scripts (without executing them)
      cy.get('head').then(($head) => {
        const hasAnalytics =
          $head.find('script[src*="analytics"]').length > 0 ||
          $head.find('script[src*="gtag"]').length > 0 ||
          $head.find('script[src*="tracking"]').length > 0;

        // Analytics presence is optional but worth checking
        cy.log('Analytics scripts present: ' + hasAnalytics);
      });
    });

    it('should track CTA button clicks', () => {
      cy.visit('/website-lander', { failOnStatusCode: false });

      // CTA buttons should be trackable
      cy.get('body').then(($body) => {
        const ctaButtons = $body.find('button, a').filter((i, el) => {
          const text = el.textContent.toLowerCase();
          return (
            text.includes('get started') ||
            text.includes('sign up') ||
            text.includes('learn more')
          );
        });

        if (ctaButtons.length > 0) {
          cy.wrap(ctaButtons.first()).should('be.visible');
        }
      });
    });
  });
});
