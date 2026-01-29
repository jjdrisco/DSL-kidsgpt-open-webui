// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/index.d.ts" />
import { adminUser } from '../support/e2e';

describe('Navigation', () => {
	// Wait for 2 seconds after all tests to fix an issue with Cypress's video recording missing the last few frames
	after(() => {
		// eslint-disable-next-line cypress/no-unnecessary-waiting
		cy.wait(2000);
	});

	beforeEach(() => {
		// Login as the admin user
		cy.loginAdmin();
		// Admin users are redirected to /admin/users, but User Menu is in the layout
		// Visit a page that has the User Menu - try the chat route or parent route
		// The User Menu should be available in the layout on most pages
		cy.visit('/parent', { failOnStatusCode: false });
		// Wait for page to load
		cy.get('body').should('exist');
		cy.wait(1000);
	});

	context('User Menu Navigation', () => {
		it('should have Survey View button in user dropdown that navigates to exit-survey page', () => {
			// Click on the user menu - use the profile image which has the aria-label
			cy.get('img[aria-label*="User Profile"], img[aria-label*="User Menu"]').first().click();
			
			// Wait for dropdown to open
			cy.wait(500);
			
			// Verify Survey View item exists
			cy.contains('Survey View').should('be.visible');
			
			// Click on Survey View item - use force if needed since it's in a dropdown
			cy.contains('Survey View').click({ force: true });
			
			// Wait for navigation
			cy.wait(1000);
			
			// Verify navigation to exit-survey page
			cy.url({ timeout: 10000 }).should('include', '/exit-survey');
		});
	});

	context('Settings Navigation', () => {
		it('should have Open WebUI button in About settings that navigates to home page', () => {
			// Click on the user menu
			cy.get('img[aria-label*="User Profile"], img[aria-label*="User Menu"]').first().click();
			
			// Wait for dropdown
			cy.wait(500);
			
			// Click on the settings link - find it in the dropdown
			cy.contains('Settings').should('be.visible').click({ force: true });
			
			// Wait for settings modal to open - look for the modal or settings title
			cy.contains('Settings', { timeout: 10000 }).should('exist'); // Modal title
			cy.wait(1000);
			
			// Find and click About tab - it's in the settings tabs container
			// Try scrolling the tabs container if it exists, otherwise just find About
			cy.get('body').then(($body) => {
				const tabsContainer = $body.find('#settings-tabs-container, [role="tablist"]');
				if (tabsContainer.length > 0) {
					cy.wrap(tabsContainer).scrollTo('bottom', { ensureScrollable: false });
				}
			});
			cy.wait(500);
			
			// Find and click About tab
			cy.contains('About', { timeout: 10000 }).should('be.visible').click({ force: true });
			
			// Wait for About tab content to load
			cy.wait(1500);
			
			// Verify Open WebUI button exists - it's in the About tab content
			cy.contains('Open WebUI', { timeout: 10000 }).should('be.visible');
			
			// Click on Open WebUI button
			cy.contains('Open WebUI').click({ force: true });
			
			// Wait for navigation
			cy.wait(1000);
			
			// Verify navigation away from settings
			cy.url({ timeout: 10000 }).should('not.include', '/exit-survey');
			cy.url().should('not.include', '/settings');
		});
	});

	context('Regular Chat Page Access', () => {
		it('should be able to access regular chat page from home', () => {
			// Verify we're on a page that allows chat access
			cy.get('body').should('exist');
			
			// After navigating away, should be able to return to chat
			// Navigate to settings first
			cy.get('img[aria-label*="User Profile"], img[aria-label*="User Menu"]').first().click();
			cy.wait(500);
			cy.contains('Settings').should('be.visible').click({ force: true });
			cy.wait(1500);
			
			// Then navigate back using Open WebUI button
			cy.get('body').then(($body) => {
				const tabsContainer = $body.find('#settings-tabs-container, [role="tablist"]');
				if (tabsContainer.length > 0) {
					cy.wrap(tabsContainer).scrollTo('bottom', { ensureScrollable: false });
				}
			});
			cy.wait(500);
			cy.contains('About', { timeout: 10000 }).should('be.visible').click({ force: true });
			cy.wait(1000);
			cy.contains('Open WebUI', { timeout: 10000 }).should('be.visible').click({ force: true });
			cy.wait(1000);
			
			// Should be back on home/chat page (not on settings)
			cy.url({ timeout: 10000 }).should('not.include', '/settings');
		});
	});
});
