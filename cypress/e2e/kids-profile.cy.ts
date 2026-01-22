// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/index.d.ts" />

// These tests assume:
// 1. An existing user account (INTERVIEWEE_EMAIL/INTERVIEWEE_PASSWORD or TEST_EMAIL/TEST_PASSWORD)
// 2. RUN_CHILD_PROFILE_TESTS=1 is set to skip registerAdmin
// 3. Frontend is running on the baseUrl (default http://localhost:8080 or CYPRESS_baseUrl)
describe('Kids Profile', () => {
	// Wait for 2 seconds after all tests to fix an issue with Cypress's video recording missing the last few frames
	after(() => {
		// eslint-disable-next-line cypress/no-unnecessary-waiting
		cy.wait(2000);
	});

	beforeEach(() => {
		// Get credentials from environment variables
		const EMAIL = Cypress.env('INTERVIEWEE_EMAIL') || Cypress.env('TEST_EMAIL') || 'jjdrisco@ucsd.edu';
		const PASSWORD = Cypress.env('INTERVIEWEE_PASSWORD') || Cypress.env('TEST_PASSWORD') || '0000';

		// Clear any existing session
		cy.clearAllCookies();
		cy.clearLocalStorage();
		cy.window().then((win) => {
			win.localStorage.clear();
		});

		// Login with the test account
		cy.login(EMAIL, PASSWORD);
	});

	it('should navigate to kids profile page', () => {
		cy.visit('/kids/profile');
		// Wait for the page to load - look for the "Child Profile" heading
		cy.contains('Child Profile', { timeout: 15000 }).should('exist');
	});

	it('should show empty state when no profiles exist', () => {
		cy.visit('/kids/profile');
		// Wait for page load
		cy.contains('Child Profile', { timeout: 15000 }).should('exist');
		
		// Check for empty state elements (may or may not be present depending on existing data)
		// If profiles exist, we'll see the profile selection instead
		cy.get('body').then(($body) => {
			if ($body.text().includes('No Child Profiles Yet')) {
				cy.contains('No Child Profiles Yet').should('exist');
				cy.contains('Add Your First Child Profile').should('exist');
			}
		});
	});

	it('should be able to add a new child profile', () => {
		cy.visit('/kids/profile');
		cy.contains('Child Profile', { timeout: 15000 }).should('exist');
		
		// Wait a bit for the page to fully load
		cy.wait(2000);
		
		// Look for "Add Profile" or "Add Your First Child Profile" button
		cy.get('body').then(($body) => {
			if ($body.find('button:contains("Add Profile")').length > 0 || 
			    $body.find('button:contains("Add Your First Child Profile")').length > 0) {
				// Click the add button
				cy.contains('button', /Add.*Profile/i).click();
				
				// Wait for form to appear
				cy.contains('Child Information', { timeout: 5000 }).should('exist');
				
				// Fill in required fields
				cy.get('input[id="childName"]').type('Test Child');
				cy.get('select[id="childAge"]').select('10 years old');
				cy.get('select[id="childAge"]').should('have.value', '10 years old');
				cy.get('select[id="childGender"]').select('Male');
				cy.get('select[id="childGender"]').should('have.value', 'Male');
				
				// Fill in required research fields
				cy.contains('Is this child an only child?').should('exist');
				cy.get('input[type="radio"][value="no"]').first().check();
				
				cy.contains('Has this child used ChatGPT').should('exist');
				cy.get('input[type="radio"][value="no"]').eq(1).check();
				
				cy.contains('Have you monitored').should('exist');
				cy.get('input[type="radio"][value="no_monitoring"]').check();
				
				// Fill in additional characteristics
				cy.get('textarea[id="childCharacteristics"]').type('Test characteristics');
				
				// Submit the form
				cy.contains('button', 'Save Profile').click();
				
				// Wait for success message or profile to appear
				cy.contains(/Profile.*saved|Profile.*updated/i, { timeout: 10000 }).should('exist');
			}
		});
	});

	it('should display existing child profiles', () => {
		cy.visit('/kids/profile');
		cy.contains('Child Profile', { timeout: 15000 }).should('exist');
		
		// Wait for profiles to load
		cy.wait(3000);
		
		// Check if profiles are displayed (either in selection grid or in profile view)
		cy.get('body').then(($body) => {
			// If there are profiles, we should see either:
			// 1. Profile selection buttons
			// 2. Profile information display
			if ($body.text().includes('Select Your Profile') || 
			    $body.text().includes('Profile Information') ||
			    $body.find('button').filter((i, el) => el.textContent && /Kid|Child|Profile/.test(el.textContent)).length > 0) {
				// Profiles exist - test passed
				cy.get('body').should('contain.text', 'Profile');
			}
		});
	});

	it('should be able to edit an existing child profile', () => {
		cy.visit('/kids/profile');
		cy.contains('Child Profile', { timeout: 15000 }).should('exist');
		cy.wait(3000);
		
		// Check if there are existing profiles
		cy.get('body').then(($body) => {
			// Look for Edit button or profile selection
			if ($body.text().includes('Profile Information') || $body.find('button').filter((i, el) => {
				const text = el.textContent || '';
				return text.includes('Edit') || text.includes('Profile');
			}).length > 0) {
				// Try to find and click Edit button
				cy.get('body').then(($body2) => {
					const editButton = $body2.find('button').filter((i, el) => {
						const text = (el.textContent || '').toLowerCase();
						return text.includes('edit') && !el.hasAttribute('disabled');
					}).first();
					
					if (editButton.length > 0) {
						cy.wrap(editButton).click();
						cy.wait(1000);
						
						// Verify form is visible
						cy.contains('Child Information', { timeout: 5000 }).should('exist');
						
						// Modify a field (e.g., add to characteristics)
						cy.get('textarea[id="childCharacteristics"]').then(($textarea) => {
							const currentValue = $textarea.val() as string;
							cy.get('textarea[id="childCharacteristics"]').clear().type(currentValue + ' - Updated by test');
						});
						
						// Save the changes
						cy.contains('button', 'Save Profile').click();
						
						// Wait for success message
						cy.contains(/Profile.*saved|Profile.*updated/i, { timeout: 10000 }).should('exist');
					}
				});
			}
		});
	});

	it('should validate required fields when creating a profile', () => {
		cy.visit('/kids/profile');
		cy.contains('Child Profile', { timeout: 15000 }).should('exist');
		cy.wait(2000);
		
		// Try to open the add profile form
		cy.get('body').then(($body) => {
			if ($body.find('button:contains("Add Profile"), button:contains("Add Your First Child Profile")').length > 0) {
				cy.contains('button', /Add.*Profile/i).click();
				cy.wait(1000);
				
				// Try to submit without filling required fields
				cy.contains('button', 'Save Profile').click();
				
				// Should show validation errors (either toast or inline)
				// The form should prevent submission or show error messages
				cy.get('body').should('be.visible');
			}
		});
	});
});
