// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/index.d.ts" />
import { adminUser } from '../support/e2e';

describe('Moderation Scenario New Features', () => {
	const EMAIL = Cypress.env('TEST_EMAIL') || adminUser.email;
	const PASSWORD = Cypress.env('TEST_PASSWORD') || adminUser.password;

	beforeEach(() => {
		cy.login(EMAIL, PASSWORD);
		// Ensure we have a child profile first
		cy.visit('/kids/profile');
		cy.wait(2000);
		// Create a child profile if needed
		cy.get('body').then(($body) => {
			if ($body.find('button:contains("+")').length > 0) {
				cy.get('button:contains("+")').first().click();
				cy.wait(1000);
				cy.get('input[id="childName"]').type('Test Child');
				cy.get('select[id="childAge"]').select('10 years old');
				cy.get('select[id="childGender"]').select('Male');
				cy.get('button').contains('Save Profile').click();
				cy.wait(2000);
			}
		});
	});

	it('should show loading screen while scenarios populate', () => {
		cy.visit('/moderation-scenario');
		// Check for loading screen
		cy.contains('Loading Scenarios', { timeout: 5000 }).should('exist');
		cy.contains('Please wait while we prepare your moderation scenarios').should('exist');
		// Wait for scenarios to load (loading screen should disappear)
		cy.contains('Loading Scenarios', { timeout: 30000 }).should('not.exist');
	});

	it('should display two sections in Step 1: concerns in prompt and response', () => {
		cy.visit('/moderation-scenario');
		// Wait for scenarios to load
		cy.contains('Loading Scenarios', { timeout: 30000 }).should('not.exist');
		cy.wait(3000);

		// Check for Step 1
		cy.contains('Step 1: Highlight the content that concerns you', { timeout: 10000 }).should(
			'exist'
		);

		// Check for two sections
		cy.contains('Concerns in Prompt').should('exist');
		cy.contains('Concerns in Response').should('exist');
	});

	it('should display "View All Highlights" buttons in both sections', () => {
		cy.visit('/moderation-scenario');
		cy.contains('Loading Scenarios', { timeout: 30000 }).should('not.exist');
		cy.wait(3000);

		cy.contains('Step 1: Highlight the content that concerns you', { timeout: 10000 }).should(
			'exist'
		);

		// Check for view buttons
		cy.contains('View All Highlights').should('have.length.at.least', 2);
	});

	it('should open highlighted concerns modal when clicking view button', () => {
		cy.visit('/moderation-scenario');
		cy.contains('Loading Scenarios', { timeout: 30000 }).should('not.exist');
		cy.wait(3000);

		cy.contains('Step 1: Highlight the content that concerns you', { timeout: 10000 }).should(
			'exist'
		);

		// Click first "View All Highlights" button
		cy.contains('View All Highlights').first().click();
		// Check that modal opens
		cy.contains('Highlighted Concerns', { timeout: 2000 }).should('be.visible');
		// Check for both sections in modal
		cy.contains('Concerns in Prompt').should('be.visible');
		cy.contains('Concerns in Response').should('be.visible');
		// Close modal
		cy.get('button').contains('Close').click();
	});

	it('should display Likert scale for level of concern in Step 2', () => {
		cy.visit('/moderation-scenario');
		cy.contains('Loading Scenarios', { timeout: 30000 }).should('not.exist');
		cy.wait(3000);

		// First, complete Step 1 by highlighting text
		cy.contains('Step 1: Highlight the content that concerns you', { timeout: 10000 }).should(
			'exist'
		);

		// Try to highlight some text in the response (if available)
		cy.get('body').then(($body) => {
			if ($body.find('.response-content, [class*="response"]').length > 0) {
				// Select text to highlight
				cy.get('.response-content, [class*="response"]')
					.first()
					.then(($el) => {
						const text = $el.text();
						if (text.length > 10) {
							// Try to select and highlight
							cy.wrap($el).trigger('mousedown', { which: 1 }).trigger('mousemove');
						}
					});
			}
		});

		// If we can't highlight, we'll need to skip to Step 2 manually
		// For now, let's check if Step 2 exists when we navigate to it
		// This test might need adjustment based on actual UI behavior
		cy.contains('Step 2: Explain why this content concerns you', { timeout: 5000 }).then(
			($step2) => {
				if ($step2.length > 0) {
					// Check for Likert scale
					cy.contains('Level of Concern').should('exist');
					cy.contains('1 - Not concerned at all').should('exist');
					cy.contains('5 - Extremely concerned').should('exist');
				}
			}
		);
	});

	it('should require level of concern selection in Step 2', () => {
		cy.visit('/moderation-scenario');
		cy.contains('Loading Scenarios', { timeout: 30000 }).should('not.exist');
		cy.wait(3000);

		// Navigate to Step 2 if possible
		cy.contains('Step 2: Explain why this content concerns you', { timeout: 10000 }).then(
			($step2) => {
				if ($step2.length > 0) {
					// Fill explanation but don't select concern level
					cy.get('textarea').first().type('This is a test explanation that is longer than 10 characters');
					// Try to submit
					cy.get('button').contains('Submit').click();
					// Should require concern level (button should be disabled or show error)
					cy.get('button').contains('Submit').should('be.disabled');
				}
			}
		);
	});

	it('should allow selecting concern level and submitting Step 2', () => {
		cy.visit('/moderation-scenario');
		cy.contains('Loading Scenarios', { timeout: 30000 }).should('not.exist');
		cy.wait(3000);

		// Navigate to Step 2 if possible
		cy.contains('Step 2: Explain why this content concerns you', { timeout: 10000 }).then(
			($step2) => {
				if ($step2.length > 0) {
					// Fill explanation
					cy.get('textarea').first().type('This is a test explanation that is longer than 10 characters');
					// Select concern level
					cy.contains('3 - Moderately concerned').click();
					// Submit should be enabled
					cy.get('button').contains('Submit').should('not.be.disabled');
				}
			}
		);
	});

	it('should show continue button disabled when no highlights in Step 1', () => {
		cy.visit('/moderation-scenario');
		cy.contains('Loading Scenarios', { timeout: 30000 }).should('not.exist');
		cy.wait(3000);

		cy.contains('Step 1: Highlight the content that concerns you', { timeout: 10000 }).should(
			'exist'
		);

		// Check that continue button is disabled
		cy.get('button').contains('Continue').should('be.disabled');
		cy.contains('(highlight required)').should('exist');
	});
});
