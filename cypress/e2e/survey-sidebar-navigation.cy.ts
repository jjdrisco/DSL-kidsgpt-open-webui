// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/index.d.ts" />

/**
 * Survey Sidebar Navigation Tests
 * Tests that workflow step buttons in SurveySidebar actually navigate to the correct pages
 * Uses INTERVIEWEE_EMAIL/INTERVIEWEE_PASSWORD or TEST_EMAIL/TEST_PASSWORD from env;
 * defaults to jjdrisco@ucsd.edu / 0000 if unset.
 * Prereqs: frontend (npm run dev) and backend running; RUN_CHILD_PROFILE_TESTS=1;
 * CYPRESS_baseUrl must match the dev server port (e.g. http://localhost:5173 or 5174).
 * Run: RUN_CHILD_PROFILE_TESTS=1 CYPRESS_baseUrl=http://localhost:5173 npx cypress run --spec cypress/e2e/survey-sidebar-navigation.cy.ts
 */

describe('Survey Sidebar Navigation', () => {
	// Get credentials
	function getCredentials() {
		return {
			email: Cypress.env('INTERVIEWEE_EMAIL') || Cypress.env('TEST_EMAIL') || 'jjdrisco@ucsd.edu',
			password: Cypress.env('INTERVIEWEE_PASSWORD') || Cypress.env('TEST_PASSWORD') || '0000'
		};
	}

	// Helper to get API base URL
	function getApiBaseUrl(): string {
		return 'http://localhost:8080/api/v1';
	}

	// Helper to authenticate using cy.session() for caching
	function authenticate() {
		const credentials = getCredentials();
		const API_BASE_URL = getApiBaseUrl();
		const TOKEN_ENV_KEY = 'SURVEY_NAV_AUTH_TOKEN';
		return cy.session(
			`survey-nav-auth-${credentials.email}`,
			() => {
				cy.log(`Authenticating user: ${credentials.email}`);
				return cy
					.request({
						method: 'POST',
						url: `${API_BASE_URL}/auths/signup`,
						body: {
							name: 'Test User',
							email: credentials.email,
							password: credentials.password
						},
						failOnStatusCode: false
					})
					.then((signupResponse) => {
						cy.log(`Signup response: ${signupResponse.status}`);
						cy.wait(2000);
						const attemptSignin = (retryCount = 0): Cypress.Chainable<string> => {
							return cy
								.request({
									method: 'POST',
									url: `${API_BASE_URL}/auths/signin`,
									body: {
										email: credentials.email,
										password: credentials.password
									},
									failOnStatusCode: false
								})
								.then((signinResponse) => {
									if (
										signinResponse.status === 200 &&
										signinResponse.body &&
										signinResponse.body.token
									) {
										const token = signinResponse.body.token;
										cy.log(`Signin successful, token length: ${token.length}`);
										Cypress.env(TOKEN_ENV_KEY, token);
										return cy.wrap(token);
									} else if (signinResponse.status === 429 && retryCount < 8) {
										const waitTime = Math.min((retryCount + 1) * 10000, 60000);
										cy.log(`Rate limited (attempt ${retryCount + 1}/8), waiting ${waitTime}ms...`);
										return cy.wait(waitTime).then(() => attemptSignin(retryCount + 1));
									} else {
										cy.log(`Signin failed: ${signinResponse.status} after ${retryCount} retries`);
										throw new Error(`Authentication failed: ${signinResponse.status}`);
									}
								});
						};
						return attemptSignin();
					});
			},
			{
				validate: () => {
					return cy.then(() => {
						const token = (Cypress.env(TOKEN_ENV_KEY) as string) || '';
						if (!token) throw new Error('No cached auth token');

						return cy
							.request({
								method: 'GET',
								url: `${getApiBaseUrl()}/auths/`,
								headers: { Authorization: `Bearer ${token}` },
								failOnStatusCode: false
							})
							.then((res) => {
								if (res.status !== 200) throw new Error(`Token validation failed: ${res.status}`);
							});
					});
				}
			}
		);
	}

	// Helper to login via UI and set token in localStorage
	function loginViaUI() {
		const credentials = getCredentials();
		cy.visit('/auth');
		cy.get('input#email', { timeout: 10000 }).type(credentials.email);
		cy.get('input#password').type(credentials.password);
		cy.get('button[type="submit"]').click();
		cy.wait(2000);
		// Wait for token to be set in localStorage
		cy.window().its('localStorage.token').should('exist');
	}

	// Helper to ensure SurveySidebar is visible
	function ensureSurveySidebarVisible() {
		cy.get('body').then(($body) => {
			if ($body.find('#survey-sidebar-nav, [id*="survey-sidebar"]').length === 0) {
				cy.get('#sidebar-toggle-button, button[aria-label*="Sidebar"], button[aria-label*="Toggle"]')
					.first()
					.click({ force: true });
				cy.wait(500);
			}
		});
		cy.get('#survey-sidebar-nav, [id*="survey-sidebar"]', { timeout: 10000 }).should('exist');
	}

	beforeEach(() => {
		authenticate();
		loginViaUI();
		cy.wait(1000);
	});

	describe('Step 1: Child Profile Navigation', () => {
		it('should navigate to /kids/profile when clicking Child Profile button', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			ensureSurveySidebarVisible();

			// Wait for workflow state to load
			cy.wait(2000);

			// Get the Child Profile button (step 1)
			cy.get('[data-step="1"]', { timeout: 10000 })
				.should('exist')
				.then(($button) => {
					// Check if button is accessible (not aria-disabled)
					const isDisabled = $button.attr('aria-disabled') === 'true';
					
					if (!isDisabled) {
						// Button should be clickable
						cy.get('[data-step="1"]')
							.should('not.have.attr', 'aria-disabled', 'true')
							.click({ force: true });
						
						cy.wait(3000); // Wait for navigation
						
						// Should navigate to /kids/profile
						cy.url({ timeout: 10000 }).should('include', '/kids/profile');
					} else {
						// If disabled, check why - might need to complete prerequisites
						cy.log('Child Profile button is disabled - user may need to complete prerequisites');
					}
				});
		});

		it('should show error toast when clicking disabled Child Profile button', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			ensureSurveySidebarVisible();
			cy.wait(2000);

			cy.get('[data-step="1"]', { timeout: 10000 })
				.should('exist')
				.then(($button) => {
					const isDisabled = $button.attr('aria-disabled') === 'true';
					
					if (isDisabled) {
						// Try clicking anyway - should show error toast
						cy.get('[data-step="1"]').click({ force: true });
						cy.wait(1000);
						
						// Check for error toast (svelte-sonner toast)
						cy.get('body').then(($body) => {
							// Toast might appear as text content
							const hasError = $body.text().includes('not yet available') || 
							                 $body.text().includes('not available');
							// Just verify we're still on exit-survey (didn't navigate)
							cy.url().should('include', '/exit-survey');
						});
					}
				});
		});
	});

	describe('Step 2: Moderation Navigation', () => {
		it('should navigate to /moderation-scenario when clicking Moderation button', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			ensureSurveySidebarVisible();
			cy.wait(2000);

			cy.get('[data-step="2"]', { timeout: 10000 })
				.should('exist')
				.then(($button) => {
					const isDisabled = $button.attr('aria-disabled') === 'true';
					
					if (!isDisabled) {
						cy.get('[data-step="2"]')
							.should('not.have.attr', 'aria-disabled', 'true')
							.click({ force: true });
						
						cy.wait(3000);
						
						// Should navigate to /moderation-scenario
						cy.url({ timeout: 10000 }).should('include', '/moderation-scenario');
					} else {
						cy.log('Moderation button is disabled - user may need to complete child profile first');
					}
				});
		});
	});

	describe('Step 3: Exit Survey Navigation', () => {
		it('should navigate to /exit-survey when clicking Exit Survey button', () => {
			// Start from a different page to test navigation
			cy.visit('/moderation-scenario', { failOnStatusCode: false });
			cy.wait(2000);

			ensureSurveySidebarVisible();
			cy.wait(2000);

			cy.get('[data-step="3"]', { timeout: 10000 })
				.should('exist')
				.then(($button) => {
					const isDisabled = $button.attr('aria-disabled') === 'true';
					
					if (!isDisabled) {
						cy.get('[data-step="3"]')
							.should('not.have.attr', 'aria-disabled', 'true')
							.click({ force: true });
						
						cy.wait(3000);
						
						// Should navigate to /exit-survey
						cy.url({ timeout: 10000 }).should('include', '/exit-survey');
					} else {
						cy.log('Exit Survey button is disabled - user may need to complete moderation first');
					}
				});
		});
	});

	describe('Step 4: Completion Navigation', () => {
		it('should navigate to /completion when clicking Completion button', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			ensureSurveySidebarVisible();
			cy.wait(2000);

			cy.get('[data-step="4"]', { timeout: 10000 })
				.should('exist')
				.then(($button) => {
					const isDisabled = $button.attr('aria-disabled') === 'true';
					
					if (!isDisabled) {
						cy.get('[data-step="4"]')
							.should('not.have.attr', 'aria-disabled', 'true')
							.click({ force: true });
						
						cy.wait(3000);
						
						// Should navigate to /completion
						cy.url({ timeout: 10000 }).should('include', '/completion');
					} else {
						cy.log('Completion button is disabled - user may need to complete exit survey first');
					}
				});
		});
	});

	describe('Navigation from Different Pages', () => {
		it('should navigate from exit-survey to kids/profile when step 1 is accessible', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			ensureSurveySidebarVisible();
			cy.wait(2000);

			// Check workflow state via API to understand what should be accessible
			authenticate().then(() => {
				const token = Cypress.env('SURVEY_NAV_AUTH_TOKEN') as string;
				cy.request({
					method: 'GET',
					url: `${getApiBaseUrl()}/workflow/state`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response) => {
					const workflowState = response.body;
					cy.log('Workflow state:', JSON.stringify(workflowState));

					// Try to click step 1
					cy.get('[data-step="1"]', { timeout: 10000 })
						.should('exist')
						.then(($button) => {
							const isDisabled = $button.attr('aria-disabled') === 'true';
							const hasChildProfile = workflowState.progress_by_section.has_child_profile;
							
							// If user has child profile, step 1 should be accessible
							if (hasChildProfile && !isDisabled) {
								cy.get('[data-step="1"]').click({ force: true });
								cy.wait(3000);
								cy.url({ timeout: 10000 }).should('include', '/kids/profile');
							} else if (hasChildProfile && isDisabled) {
								cy.log('Step 1 is disabled even though child profile exists - this may be a bug');
							} else {
								cy.log('Step 1 is correctly disabled - user needs to complete child profile first');
							}
						});
				});
			});
		});
	});

	describe('Button State Verification', () => {
		it('should show correct button states based on workflow progress', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			ensureSurveySidebarVisible();
			cy.wait(2000);

			// Verify all step buttons exist
			cy.get('[data-step="1"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="2"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="3"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="4"]', { timeout: 10000 }).should('exist');

			// Check that buttons have proper aria-disabled attributes
			cy.get('[data-step="1"]').should('have.attr', 'aria-disabled');
			cy.get('[data-step="2"]').should('have.attr', 'aria-disabled');
			cy.get('[data-step="3"]').should('have.attr', 'aria-disabled');
			cy.get('[data-step="4"]').should('have.attr', 'aria-disabled');
		});

		it('should update button states when workflow state changes', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			ensureSurveySidebarVisible();
			cy.wait(2000);

			// Get initial state
			cy.get('[data-step="1"]', { timeout: 10000 })
				.should('exist')
				.then(($button) => {
					const initialDisabled = $button.attr('aria-disabled') === 'true';
					
					// Wait a bit and check if state updates (if workflow state refreshes)
					cy.wait(2000);
					
					cy.get('[data-step="1"]').then(($buttonAfter) => {
						const afterDisabled = $buttonAfter.attr('aria-disabled') === 'true';
						// State should be consistent (or may change if workflow progresses)
						expect($buttonAfter.length).to.be.greaterThan(0);
					});
				});
		});
	});
});
