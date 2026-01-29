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
		// Visit the home page
		cy.visit('/');
	});

	context('User Menu Navigation', () => {
		it('should have Survey View button in user dropdown that navigates to exit-survey page', () => {
			// Click on the user menu
			cy.get('button[aria-label="User Menu"]').click();
			
			// Verify Survey View item exists
			cy.contains('Survey View').should('exist');
			
			// Click on Survey View item
			cy.contains('Survey View').click();
			
			// Verify navigation to exit-survey page
			cy.url().should('include', '/exit-survey');
		});
	});

	context('Settings Navigation', () => {
		it('should have Open WebUI button in About settings that navigates to home page', () => {
			// Click on the user menu
			cy.get('button[aria-label="User Menu"]').click();
			
			// Click on the settings link
			cy.get('button').contains('Settings').click();
			
			// Click on About tab
			cy.get('button').contains('About').click();
			
			// Verify Open WebUI button exists
			cy.get('button').contains('Open WebUI').should('exist');
			
			// Click on Open WebUI button
			cy.get('button').contains('Open WebUI').click();
			
			// Verify navigation to home page
			cy.url().should('not.include', '/exit-survey');
			cy.url().should('not.include', '/settings');
			// Should be on home page or redirected appropriately
			cy.url().should('match', /\/(?:$|\?|#)/);
		});
	});

	context('Regular Chat Page Access', () => {
		it('should be able to access regular chat page from home', () => {
			// Verify we're on a page that allows chat access
			// The home page should have chat interface elements
			cy.get('body').should('exist');
			
			// After navigating away, should be able to return to chat
			// Navigate to settings first
			cy.get('button[aria-label="User Menu"]').click();
			cy.get('button').contains('Settings').click();
			
			// Then navigate back using Open WebUI button
			cy.get('button').contains('About').click();
			cy.get('button').contains('Open WebUI').click();
			
			// Should be back on home/chat page
			cy.url().should('not.include', '/settings');
		});
	});
});
