/// <reference types="cypress" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/index.d.ts" />

export const adminUser = {
	name: 'Admin User',
	email: 'admin@example.com',
	password: 'password'
};

const login = (email: string, password: string) => {
	return cy.session(
		email,
		() => {
			// Make sure to test against us english to have stable tests,
			// regardless on local language preferences
			localStorage.setItem('locale', 'en-US');
			// Visit auth page
			cy.visit('/auth');
			// Wait for form to be ready
			cy.get('input[autocomplete="email"], input#email, input[type="email"]', {
				timeout: 15000
			}).should('exist');
			// Fill out the form
			cy.get('input[autocomplete="email"], input#email, input[type="email"]')
				.first()
				.clear()
				.type(email);
			cy.get('input[type="password"]').first().clear().type(password);
			// Submit the form
			cy.get('button[type="submit"]').click();
			// Wait until the user is redirected - could be home page, kids/profile, or other pages
			cy.location('pathname', { timeout: 15000 }).should((path) => {
				// Accept various redirect paths
				expect([
					'/kids/profile',
					'/moderation-scenario',
					'/exit-survey',
					'/completion',
					'/',
					'/assignment-instructions'
				]).to.include(path);
			});
			// If redirected to home page, check for chat-search
			cy.get('body').then(($body) => {
				if ($body.find('#chat-search').length > 0) {
					cy.get('#chat-search').should('exist');
					// Get the current version to skip the changelog dialog
					cy.window().then((win) => {
						if (win.localStorage.getItem('version') === null) {
							cy.get('button').contains("Okay, Let's Go!").click();
						}
					});
				}
			});
		},
		{
			validate: () => {
				cy.request({
					method: 'GET',
					url: '/api/v1/auths/',
					headers: {
						Authorization: 'Bearer ' + localStorage.getItem('token')
					}
				});
			}
		}
	);
};

const register = (name: string, email: string, password: string) => {
	return cy
		.request({
			method: 'POST',
			url: '/api/v1/auths/signup',
			body: {
				name: name,
				email: email,
				password: password
			},
			failOnStatusCode: false
		})
		.then((response) => {
			expect(response.status).to.be.oneOf([200, 400]);
		});
};

const registerAdmin = () => {
	return register(adminUser.name, adminUser.email, adminUser.password);
};

const loginAdmin = () => {
	return login(adminUser.email, adminUser.password);
};

Cypress.Commands.add('login', (email, password) => login(email, password));
Cypress.Commands.add('register', (name, email, password) => register(name, email, password));
Cypress.Commands.add('registerAdmin', () => registerAdmin());
Cypress.Commands.add('loginAdmin', () => loginAdmin());

before(() => {
	// Skip registerAdmin if RUN_CHILD_PROFILE_TESTS is set
	// These tests use existing accounts and don't need the admin user
	const runChildProfileTests =
		Cypress.env('RUN_CHILD_PROFILE_TESTS') === '1' ||
		Cypress.env('RUN_CHILD_PROFILE_TESTS') === 1 ||
		Cypress.env('CYPRESS_RUN_CHILD_PROFILE_TESTS') === '1' ||
		Cypress.env('CYPRESS_RUN_CHILD_PROFILE_TESTS') === 1;

	if (!runChildProfileTests) {
		cy.registerAdmin();
	}
});
