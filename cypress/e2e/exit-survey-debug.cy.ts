// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/index.d.ts" />
import { adminUser } from '../support/e2e';

describe('Exit Survey Debug', () => {
	const EMAIL = Cypress.env('TEST_EMAIL') || adminUser.email;
	const PASSWORD = Cypress.env('TEST_PASSWORD') || adminUser.password;

	it('should load exit survey page and show page content', () => {
		cy.login(EMAIL, PASSWORD);
		cy.visit('/exit-survey');
		
		// Wait for page
		cy.contains('Exit Survey', { timeout: 15000 }).should('exist');
		
		// Take a screenshot to see what's on the page
		cy.screenshot('exit-survey-page');
		
		// Log page content
		cy.get('body').then(($body) => {
			cy.log('Page text: ' + $body.text().substring(0, 500));
			cy.log('Has form: ' + ($body.find('form').length > 0));
			cy.log('Has Edit button: ' + ($body.find('button:contains("Edit")').length > 0));
			cy.log('Has Child Information: ' + ($body.text().includes('Child Information')));
		});
	});
});
