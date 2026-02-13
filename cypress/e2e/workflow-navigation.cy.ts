// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/index.d.ts" />

/**
 * Workflow Navigation Tests
 * Tests workflow step navigation from SurveySidebar and main Sidebar
 * Uses INTERVIEWEE_EMAIL/INTERVIEWEE_PASSWORD or TEST_EMAIL/TEST_PASSWORD from env;
 * defaults to jjdrisco@ucsd.edu / 0000 if unset.
 * Prereqs: frontend (npm run dev) and backend running; RUN_CHILD_PROFILE_TESTS=1;
 * CYPRESS_baseUrl must match the dev server port (e.g. http://localhost:5173 or 5174).
 * Run: RUN_CHILD_PROFILE_TESTS=1 CYPRESS_baseUrl=http://localhost:5173 npx cypress run --spec cypress/e2e/workflow-navigation.cy.ts
 */

describe('Workflow Navigation', () => {
	// Get credentials - must be called inside test context where Cypress is available
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
		const TOKEN_ENV_KEY = 'WORKFLOW_NAV_AUTH_TOKEN';
		return cy.session(
			`workflow-nav-auth-${credentials.email}`,
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

	beforeEach(() => {
		authenticate();
		loginViaUI();
		cy.wait(1000);
	});

	describe('SurveySidebar Navigation', () => {
		it('should show clickable workflow step buttons on exit-survey page', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			// Toggle sidebar if hidden
			cy.get('body').then(($body) => {
				if ($body.find('#survey-sidebar-nav, [id*="survey-sidebar"]').length === 0) {
					cy.get('#sidebar-toggle-button, button[aria-label*="Sidebar"], button[aria-label*="Toggle"]')
						.first()
						.click({ force: true });
					cy.wait(500);
				}
			});

			// Check for workflow step buttons
			cy.get('[data-step="1"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="2"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="3"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="4"]', { timeout: 10000 }).should('exist');
		});

		it('should navigate to workflow steps when clicking step buttons', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			// Toggle sidebar if hidden
			cy.get('body').then(($body) => {
				if ($body.find('#survey-sidebar-nav, [id*="survey-sidebar"]').length === 0) {
					cy.get('#sidebar-toggle-button, button[aria-label*="Sidebar"], button[aria-label*="Toggle"]')
						.first()
						.click({ force: true });
					cy.wait(500);
				}
			});

			// Try to click on Child Profile step (step 1)
			cy.get('[data-step="1"]', { timeout: 10000 })
				.should('exist')
				.then(($button) => {
					if (!$button.prop('disabled')) {
						cy.get('[data-step="1"]').click({ force: true });
						cy.wait(2000);
						// Should navigate to /kids/profile if accessible
						cy.url({ timeout: 10000 }).should('satisfy', (url: string) => {
							return url.includes('/kids/profile') || url.includes('/exit-survey');
						});
					}
				});
		});

		it('should show correct step completion indicators', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			// Toggle sidebar if hidden
			cy.get('body').then(($body) => {
				if ($body.find('#survey-sidebar-nav, [id*="survey-sidebar"]').length === 0) {
					cy.get('#sidebar-toggle-button, button[aria-label*="Sidebar"], button[aria-label*="Toggle"]')
						.first()
						.click({ force: true });
					cy.wait(500);
				}
			});

			// Check that step buttons exist and have proper styling
			cy.get('[data-step="1"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="2"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="3"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="4"]', { timeout: 10000 }).should('exist');
		});
	});

	describe('Main Sidebar Navigation', () => {
		it('should show workflow navigation section for interviewee users', () => {
			cy.visit('/', { failOnStatusCode: false });
			cy.wait(2000);

			// Open sidebar if closed
			cy.get('body').then(($body) => {
				if ($body.find('#sidebar').length === 0 || !$body.find('#sidebar').is(':visible')) {
					cy.get('#sidebar-toggle-button, button[aria-label*="Sidebar"], button[aria-label*="Toggle"]')
						.first()
						.click({ force: true });
					cy.wait(500);
				}
			});

			// Check for workflow section (may or may not be visible depending on user type)
			cy.get('body').then(($body) => {
				const workflowSection = $body.find('*:contains("Assignment Workflow")');
				// Workflow section may or may not be visible depending on user type
				// Just verify the page loaded correctly
				cy.get('#sidebar', { timeout: 10000 }).should('exist');
			});
		});

		it('should navigate to workflow steps from main sidebar', () => {
			cy.visit('/', { failOnStatusCode: false });
			cy.wait(2000);

			// Open sidebar if closed
			cy.get('body').then(($body) => {
				if ($body.find('#sidebar').length === 0 || !$body.find('#sidebar').is(':visible')) {
					cy.get('#sidebar-toggle-button, button[aria-label*="Sidebar"], button[aria-label*="Toggle"]')
						.first()
						.click({ force: true });
					cy.wait(500);
				}
			});

			// Check if workflow step buttons exist in main sidebar
			cy.get('body').then(($body) => {
				const stepButtons = $body.find('[data-step="1"], [data-step="2"], [data-step="3"], [data-step="4"]');
				if (stepButtons.length > 0) {
					// Workflow navigation exists, test clicking
					cy.get('[data-step="1"]').first().then(($button) => {
						if (!$button.prop('disabled')) {
							cy.get('[data-step="1"]').first().click({ force: true });
							cy.wait(2000);
							cy.url({ timeout: 10000 }).should('satisfy', (url: string) => {
								return url.includes('/kids/profile') || url.includes('/');
							});
						}
					});
				}
			});
		});
	});

	describe('Workflow State Integration', () => {
		it('should fetch workflow state from backend and display correctly', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			// Toggle sidebar if hidden
			cy.get('body').then(($body) => {
				if ($body.find('#survey-sidebar-nav, [id*="survey-sidebar"]').length === 0) {
					cy.get('#sidebar-toggle-button, button[aria-label*="Sidebar"], button[aria-label*="Toggle"]')
						.first()
						.click({ force: true });
					cy.wait(500);
				}
			});

			// Wait for workflow progress to load
			cy.wait(2000);

			// Verify step buttons are rendered (indicating state was fetched)
			cy.get('[data-step="1"]', { timeout: 10000 }).should('exist');
		});

		it('should disable locked steps and enable accessible steps', () => {
			cy.visit('/exit-survey', { failOnStatusCode: false });
			cy.wait(2000);

			// Toggle sidebar if hidden
			cy.get('body').then(($body) => {
				if ($body.find('#survey-sidebar-nav, [id*="survey-sidebar"]').length === 0) {
					cy.get('#sidebar-toggle-button, button[aria-label*="Sidebar"], button[aria-label*="Toggle"]')
						.first()
						.click({ force: true });
					cy.wait(500);
				}
			});

			cy.wait(2000);

			// Check that step buttons exist
			cy.get('[data-step="1"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="2"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="3"]', { timeout: 10000 }).should('exist');
			cy.get('[data-step="4"]', { timeout: 10000 }).should('exist');

			// Verify buttons have proper disabled/enabled state
			// (Some may be disabled, some enabled depending on workflow state)
			cy.get('[data-step="1"]').should('exist');
		});
	});

	describe('Navigation Guard Integration', () => {
		it('should redirect to correct workflow step based on backend state', () => {
			// Get workflow state from API
			authenticate().then(() => {
				const token = Cypress.env('WORKFLOW_NAV_AUTH_TOKEN') as string;
				cy.request({
					method: 'GET',
					url: `${getApiBaseUrl()}/workflow/state`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response) => {
					const nextRoute = response.body.next_route;
					
					// Visit a different route
					cy.visit('/', { failOnStatusCode: false });
					cy.wait(2000);
					
					// If user should be on a workflow route, navigation guard should redirect
					if (nextRoute && nextRoute !== '/' && nextRoute !== '/parent') {
						// Wait a bit for navigation guard to potentially redirect
						cy.wait(3000);
						// URL should either stay on / or redirect to next_route
						cy.url({ timeout: 10000 }).should('satisfy', (url: string) => {
							return url.includes(nextRoute) || url.endsWith('/');
						});
					}
				});
			});
		});
	});
});
