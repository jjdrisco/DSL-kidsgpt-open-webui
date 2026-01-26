// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/index.d.ts" />
import { adminUser } from '../support/e2e';

describe('Exit Survey New Features', () => {
	const EMAIL = Cypress.env('TEST_EMAIL') || adminUser.email;
	const PASSWORD = Cypress.env('TEST_PASSWORD') || adminUser.password;

	beforeEach(() => {
		cy.login(EMAIL, PASSWORD);
		cy.visit('/exit-survey');
		// Wait for page to load
		cy.contains('Exit Survey', { timeout: 10000 }).should('exist');
	});

	it('should display child information section with view/edit button', () => {
		// Check for child information section
		cy.contains('Child Information').should('exist');
		cy.contains('View/Edit Child Information').should('exist');
	});

	it('should open child information modal when clicking view/edit button', () => {
		// Click the view/edit button
		cy.contains('View/Edit Child Information').click();
		// Check that modal opens
		cy.contains('Child Information').should('be.visible');
		// Check for modal fields (name, age, gender)
		cy.get('input[id="modal-child-name"]').should('exist');
		cy.get('input[id="modal-child-age"]').should('exist');
		cy.get('input[id="modal-child-gender"]').should('exist');
		// Close modal
		cy.get('button').contains('Close').click();
	});

	it('should display personality traits selection section', () => {
		// Scroll to personality traits section
		cy.contains('Personality Traits Selection').scrollIntoView();
		cy.contains('Personality Traits Selection').should('exist');
		// Check for at least one trait
		cy.contains('Agreeableness').should('exist');
	});

	it('should expand and collapse personality traits', () => {
		cy.contains('Personality Traits Selection').scrollIntoView();
		// Click on first trait to expand
		cy.contains('Agreeableness').parent().parent().click();
		// Check that sub-characteristics are visible
		cy.contains('Is compassionate', { timeout: 2000 }).should('be.visible');
		// Collapse by clicking again
		cy.contains('Agreeableness').parent().parent().click();
	});

	it('should select personality trait sub-characteristics', () => {
		cy.contains('Personality Traits Selection').scrollIntoView();
		// Expand first trait
		cy.contains('Agreeableness').parent().parent().click();
		// Select a sub-characteristic
		cy.contains('Is compassionate').parent().find('input[type="checkbox"]').check();
		// Verify it's checked
		cy.contains('Is compassionate').parent().find('input[type="checkbox"]').should('be.checked');
	});

	it('should display additional characteristics field with 10 character minimum', () => {
		cy.contains('Please provide a description of your child').scrollIntoView();
		cy.contains('Please provide a description of your child').should('exist');
		// Check for character count indicator
		cy.contains('/10 minimum characters').should('exist');
		// Try to submit with less than 10 characters
		cy.get('textarea[id="childCharacteristics"]').type('short');
		cy.get('button').contains('Submit Survey').click();
		// Should show validation error
		cy.contains('at least 10 characters', { timeout: 2000 }).should('exist');
	});

	it('should display "is child only child" question', () => {
		cy.contains('Is this child an only child?').scrollIntoView();
		cy.contains('Is this child an only child?').should('exist');
		// Check for radio buttons
		cy.get('input[id="only-child-yes"]').should('exist');
		cy.get('input[id="only-child-no"]').should('exist');
	});

	it('should display "has this child used ChatGPT" question', () => {
		cy.contains('Has this child used ChatGPT or similar AI tools?').scrollIntoView();
		cy.contains('Has this child used ChatGPT or similar AI tools?').should('exist');
		// Check for radio buttons
		cy.get('input[id="child-ai-use-yes"]').should('exist');
		cy.get('input[id="child-ai-use-no"]').should('exist');
	});

	it('should show AI use contexts when "yes" is selected', () => {
		cy.contains('Has this child used ChatGPT or similar AI tools?').scrollIntoView();
		// Select "yes"
		cy.get('input[id="child-ai-use-yes"]').check();
		// Check that contexts appear
		cy.contains('In what contexts has your child used AI tools?').should('be.visible');
		cy.contains('Homework/Schoolwork').should('be.visible');
	});

	it('should display "have you monitored" question', () => {
		cy.contains('Have you monitored or adjusted your child').scrollIntoView();
		cy.contains('Have you monitored or adjusted your child').should('exist');
		// Check for radio buttons
		cy.get('input[id="monitoring-always"]').should('exist');
		cy.get('input[id="monitoring-never"]').should('exist');
	});

	it('should display attention check section with duplicate questions', () => {
		cy.contains('Attention Check Questions').scrollIntoView();
		cy.contains('Attention Check Questions').should('exist');
		// Check for duplicate questions
		cy.contains('Has this child used ChatGPT or similar AI tools? (Please answer again)').should(
			'exist'
		);
		cy.contains('Have you monitored or adjusted your child').should('exist');
		// Check for attention check radio buttons
		cy.get('input[id="child-ai-use-check-yes"]').should('exist');
		cy.get('input[id="monitoring-check-always"]').should('exist');
	});

	it('should validate all required fields before submission', () => {
		// Try to submit without filling required fields
		cy.get('button').contains('Submit Survey').click();
		// Should show validation errors
		cy.contains('Please select', { timeout: 2000 }).should('exist');
	});

	it('should successfully submit exit survey with all fields filled', () => {
		// Fill parent demographics
		cy.get('input[id="parenting-style-a"]').check();
		cy.get('input[value="regular_user"]').check();
		cy.get('input[value="daily"]').check();
		cy.get('input[id="gender-male"]').check();
		cy.get('input[id="age-25-34"]').check();
		cy.get('input[id="area-urban"]').check();
		cy.get('input[id="education-bachelors"]').check();
		cy.get('input[id="ethnicity-white"]').check();

		// Fill child information fields
		cy.get('textarea[id="childCharacteristics"]').type('This is a test description of my child that is longer than 10 characters');
		cy.get('input[id="only-child-no"]').check();
		cy.get('input[id="child-ai-use-yes"]').check();
		cy.get('input[value="homework"]').check();
		cy.get('input[id="monitoring-sometimes"]').check();

		// Fill attention check
		cy.get('input[id="child-ai-use-check-yes"]').check();
		cy.get('input[id="monitoring-check-sometimes"]').check();

		// Submit
		cy.get('button').contains('Submit Survey').click();
		// Should show success or redirect
		cy.contains('Task 3 Complete', { timeout: 5000 }).should('exist');
	});
});
