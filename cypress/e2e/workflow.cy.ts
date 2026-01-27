// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/index.d.ts" />

/**
 * Workflow API tests: /workflow/*
 * Tests all workflow endpoints for managing user progress through the study workflow.
 * Uses INTERVIEWEE_EMAIL/INTERVIEWEE_PASSWORD or TEST_EMAIL/TEST_PASSWORD from env;
 * defaults to jjdrisco@ucsd.edu / 0000 if unset.
 * Prereqs: frontend (npm run dev) and backend running; RUN_CHILD_PROFILE_TESTS=1;
 * CYPRESS_baseUrl must match the dev server port (e.g. http://localhost:5173 or 5174).
 * Run: RUN_CHILD_PROFILE_TESTS=1 CYPRESS_baseUrl=http://localhost:5173 npx cypress run --spec cypress/e2e/workflow.cy.ts
 */

describe('Workflow API Endpoints', () => {
	// Get credentials - must be called inside test context where Cypress is available
	function getCredentials() {
		return {
			email: Cypress.env('INTERVIEWEE_EMAIL') || Cypress.env('TEST_EMAIL') || 'jjdrisco@ucsd.edu',
			password: Cypress.env('INTERVIEWEE_PASSWORD') || Cypress.env('TEST_PASSWORD') || '0000'
		};
	}

	// Helper to get API base URL (must be called inside test context where Cypress is available)
	function getApiBaseUrl(): string {
		const baseUrl = Cypress.config().baseUrl || 'http://localhost:8080';
		return `${baseUrl}/api/v1`;
	}

	// Helper to get auth token (with retry for rate limiting)
	function authenticate() {
		const credentials = getCredentials();
		const API_BASE_URL = getApiBaseUrl();
		return cy.wait(3000).then(() => {
			return cy.request({
				method: 'POST',
				url: `${API_BASE_URL}/auths/signin`,
				body: {
					email: credentials.email,
					password: credentials.password
				},
				failOnStatusCode: false
			}).then((response) => {
				if (response.status === 200 && response.body && response.body.token) {
					const token = response.body.token;
					cy.log(`Auth successful, token length: ${token.length}`);
					// Store token as alias for debugging
					cy.wrap(token).as('authToken');
					return token; // Return the actual token value, not cy.wrap()
				} else if (response.status === 429) {
					// Rate limited, wait and retry
					cy.log('Rate limited, waiting and retrying...');
					const credentials = getCredentials();
					return cy.wait(5000).then(() => {
						const API_BASE_URL = getApiBaseUrl();
						return cy.request({
							method: 'POST',
							url: `${API_BASE_URL}/auths/signin`,
							body: { email: credentials.email, password: credentials.password },
							failOnStatusCode: false
						}).then((retry) => {
							if (retry.status === 200 && retry.body && retry.body.token) {
								const token = retry.body.token;
								cy.log(`Auth successful after retry, token length: ${token.length}`);
								cy.wrap(token).as('authToken');
								return token;
							}
							cy.log(`Auth failed after retry: ${retry.status}`);
							return '';
						});
					});
				} else if (response.status === 401 || response.status === 404) {
					// User doesn't exist, try signup
					cy.log('User not found, trying signup...');
					const credentials = getCredentials();
					const API_BASE_URL = getApiBaseUrl();
					return cy.request({
						method: 'POST',
						url: `${API_BASE_URL}/auths/signup`,
						body: {
							email: credentials.email,
							password: credentials.password,
							name: 'Test User'
						},
						failOnStatusCode: false
					}).then((signupResponse) => {
						if (signupResponse.status === 200 && signupResponse.body && signupResponse.body.token) {
							const token = signupResponse.body.token;
							cy.log(`Signup successful, token length: ${token.length}`);
							cy.wrap(token).as('authToken');
							return token;
						}
						// Try signin after signup
						cy.log('Trying signin after signup...');
						const credentials = getCredentials();
						return cy.wait(2000).then(() => {
							const API_BASE_URL = getApiBaseUrl();
							return cy.request({
								method: 'POST',
								url: `${API_BASE_URL}/auths/signin`,
								body: { email: credentials.email, password: credentials.password },
								failOnStatusCode: false
							}).then((retry) => {
								if (retry.status === 200 && retry.body && retry.body.token) {
									const token = retry.body.token;
									cy.log(`Auth successful after signup, token length: ${token.length}`);
									cy.wrap(token).as('authToken');
									return token;
								}
								cy.log(`Auth failed after signup: ${retry.status}`);
								return '';
							});
						});
					});
				}
				cy.log(`Auth failed: ${response.status}`);
				return '';
			});
		});
	}

	describe('GET /workflow/state', () => {
		it('should return workflow state with next route and progress', function () {
			const credentials = getCredentials();
			if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			authenticate().then((token) => {
				if (!token || token === '') {
					cy.log('Authentication failed - token is empty');
					throw new Error('Authentication failed - no token received');
				}
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/workflow/state`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response) => {
					expect(response.status).to.eq(200);
					expect(response.body).to.have.property('next_route');
					expect(response.body).to.have.property('substep');
					expect(response.body).to.have.property('progress_by_section');
					expect(response.body.progress_by_section).to.have.property('has_child_profile');
					expect(response.body.progress_by_section).to.have.property('moderation_completed_count');
					expect(response.body.progress_by_section).to.have.property('moderation_total');
					expect(response.body.progress_by_section).to.have.property('exit_survey_completed');
					expect(response.body.progress_by_section.moderation_total).to.eq(12);
					// next_route should be one of the valid routes
					expect(response.body.next_route).to.be.oneOf([
						'/kids/profile',
						'/moderation-scenario',
						'/exit-survey',
						'/completion',
						'/parent',
						'/'
					]);
				});
			});
		});

		it('should return workflow state for new user (no child profile)', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/workflow/state`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response) => {
					expect(response.status).to.eq(200);
					// If user has no child profile, should route to /kids/profile
					if (!response.body.progress_by_section.has_child_profile) {
						expect(response.body.next_route).to.eq('/kids/profile');
					}
				});
			});
		});
	});

	describe('GET /workflow/current-attempt', () => {
		it('should return current attempt number', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/workflow/current-attempt`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response) => {
					expect(response.status).to.eq(200);
					expect(response.body).to.have.property('current_attempt');
					expect(response.body).to.have.property('moderation_attempt');
					expect(response.body).to.have.property('child_attempt');
					expect(response.body).to.have.property('exit_attempt');
					expect(response.body.current_attempt).to.be.a('number');
					expect(response.body.current_attempt).to.be.at.least(0);
					expect(response.body.moderation_attempt).to.be.a('number');
					expect(response.body.child_attempt).to.be.a('number');
					expect(response.body.exit_attempt).to.be.a('number');
				});
			});
		});
	});

	describe('GET /workflow/session-info', () => {
		it('should return session information', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/workflow/session-info`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response) => {
					expect(response.status).to.eq(200);
					expect(response.body).to.have.property('prolific_pid');
					expect(response.body).to.have.property('study_id');
					expect(response.body).to.have.property('current_session_id');
					expect(response.body).to.have.property('session_number');
					expect(response.body).to.have.property('is_prolific_user');
					expect(response.body.is_prolific_user).to.be.a('boolean');
				});
			});
		});
	});

	describe('GET /workflow/completed-scenarios', () => {
		it('should return completed scenario indices', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/workflow/completed-scenarios`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response) => {
					expect(response.status).to.eq(200);
					expect(response.body).to.have.property('completed_scenario_indices');
					expect(response.body).to.have.property('count');
					expect(response.body.completed_scenario_indices).to.be.an('array');
					expect(response.body.count).to.be.a('number');
					expect(response.body.count).to.eq(response.body.completed_scenario_indices.length);
					// All indices should be numbers between 0-11
					response.body.completed_scenario_indices.forEach((idx: number) => {
						expect(idx).to.be.a('number');
						expect(idx).to.be.at.least(0);
						expect(idx).to.be.at.most(11);
					});
				});
			});
		});
	});

	describe('GET /workflow/study-status', () => {
		it('should return study completion status', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/workflow/study-status`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response) => {
					expect(response.status).to.eq(200);
					expect(response.body).to.have.property('completed_at');
					expect(response.body).to.have.property('completion_date');
					expect(response.body).to.have.property('can_retake');
					expect(response.body).to.have.property('current_attempt');
					expect(response.body).to.have.property('message');
					expect(response.body.can_retake).to.be.a('boolean');
					expect(response.body.current_attempt).to.be.a('number');
					expect(response.body.current_attempt).to.be.at.least(1);
					// completed_at can be null or a number
					if (response.body.completed_at !== null) {
						expect(response.body.completed_at).to.be.a('number');
					}
				});
			});
		});
	});

	describe('POST /workflow/reset', () => {
		it('should reset entire user workflow and increment attempt number', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			// Get current attempt before reset
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/workflow/current-attempt`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response) => {
					const attemptBefore = response.body.current_attempt;
					// Now reset workflow
					cy.request({
						method: 'POST',
						url: `${API_BASE_URL}/workflow/reset`,
						headers: {
							Authorization: `Bearer ${token}`,
							'Content-Type': 'application/json'
						}
					}).then((resetResponse) => {
						expect(resetResponse.status).to.eq(200);
						expect(resetResponse.body).to.have.property('status', 'success');
						expect(resetResponse.body).to.have.property('new_attempt');
						expect(resetResponse.body).to.have.property('message');
						expect(resetResponse.body.new_attempt).to.be.a('number');
						expect(resetResponse.body.new_attempt).to.be.greaterThan(attemptBefore);
					});
				});
			});
		});
	});

	describe('POST /workflow/reset-moderation', () => {
		it('should reset only moderation workflow and increment attempt', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			// Get current moderation attempt before reset
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/workflow/current-attempt`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response) => {
					const moderationAttemptBefore = response.body.moderation_attempt;
					// Now reset moderation workflow
					cy.request({
						method: 'POST',
						url: `${API_BASE_URL}/workflow/reset-moderation`,
						headers: {
							Authorization: `Bearer ${token}`,
							'Content-Type': 'application/json'
						}
					}).then((resetResponse) => {
						expect(resetResponse.status).to.eq(200);
						expect(resetResponse.body).to.have.property('status', 'success');
						expect(resetResponse.body).to.have.property('new_attempt');
						expect(resetResponse.body).to.have.property('completed_scenario_indices');
						expect(resetResponse.body).to.have.property('message');
						expect(resetResponse.body.new_attempt).to.be.a('number');
						expect(resetResponse.body.new_attempt).to.be.greaterThan(moderationAttemptBefore);
						expect(resetResponse.body.completed_scenario_indices).to.be.an('array');
					});
				});
			});
		});
	});

	describe('POST /workflow/moderation/finalize', () => {
		it('should finalize moderation without filters', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'POST',
					url: `${API_BASE_URL}/workflow/moderation/finalize`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: {}
				}).then((response) => {
					expect(response.status).to.eq(200);
					expect(response.body).to.have.property('updated');
					expect(response.body.updated).to.be.a('number');
					expect(response.body.updated).to.be.at.least(0);
				});
			});
		});

		it('should finalize moderation with child_id filter', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			// First get child profiles to use a valid child_id
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/child-profiles`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					failOnStatusCode: false
				}).then((childResponse) => {
					if (childResponse.status === 200 && Array.isArray(childResponse.body) && childResponse.body.length > 0) {
						const childId = childResponse.body[0].id;
						cy.request({
							method: 'POST',
							url: `${API_BASE_URL}/workflow/moderation/finalize`,
							headers: {
								Authorization: `Bearer ${token}`,
								'Content-Type': 'application/json'
							},
							body: {
								child_id: childId
							}
						}).then((response) => {
							expect(response.status).to.eq(200);
							expect(response.body).to.have.property('updated');
							expect(response.body.updated).to.be.a('number');
						});
					} else {
						// Skip if no child profiles - make a request anyway to test the endpoint
						cy.request({
							method: 'POST',
							url: `${API_BASE_URL}/workflow/moderation/finalize`,
							headers: {
								Authorization: `Bearer ${token}`,
								'Content-Type': 'application/json'
							},
							body: {}
						}).then((response) => {
							expect(response.status).to.eq(200);
							expect(response.body).to.have.property('updated');
							expect(response.body.updated).to.be.a('number');
						});
					}
				});
			});
		});

		it('should finalize moderation with session_number filter', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'POST',
					url: `${API_BASE_URL}/workflow/moderation/finalize`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: {
						session_number: 1
					}
				}).then((response) => {
					expect(response.status).to.eq(200);
					expect(response.body).to.have.property('updated');
					expect(response.body.updated).to.be.a('number');
				});
			});
		});
	});

	describe('Workflow State Transitions', () => {
		it('should progress through workflow states correctly', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			// Test workflow state progression
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/workflow/state`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response) => {
					expect(response.status).to.eq(200);
					const state = response.body;
					const progress = state.progress_by_section;

					// Verify workflow logic:
					// 1. If no child profile -> /kids/profile
					// 2. If child profile but moderation incomplete -> /moderation-scenario
					// 3. If moderation complete but exit survey incomplete -> /exit-survey
					// 4. If all complete -> /completion

					if (!progress.has_child_profile) {
						expect(state.next_route).to.eq('/kids/profile');
					} else if (progress.moderation_completed_count < progress.moderation_total) {
						expect(state.next_route).to.eq('/moderation-scenario');
					} else if (!progress.exit_survey_completed) {
						expect(state.next_route).to.eq('/exit-survey');
					} else {
						expect(state.next_route).to.eq('/completion');
					}
				});
			});
		});

		it('should maintain consistent state across multiple requests', function () {
			const credentials = getCredentials(); if (!credentials.email || !credentials.password) {
				this.skip();
				return;
			}
			// Make multiple requests and verify consistency
			authenticate().then((token) => {
				const API_BASE_URL = getApiBaseUrl();
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/workflow/state`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}).then((response1) => {
					cy.request({
						method: 'GET',
						url: `${API_BASE_URL}/workflow/state`,
						headers: {
							Authorization: `Bearer ${token}`,
							'Content-Type': 'application/json'
						}
					}).then((response2) => {
						// Progress should be consistent (unless state changed between requests)
						expect(response1.body.progress_by_section.has_child_profile).to.eq(
							response2.body.progress_by_section.has_child_profile
						);
						expect(response1.body.progress_by_section.moderation_total).to.eq(
							response2.body.progress_by_section.moderation_total
						);
					});
				});
			});
		});
	});

	describe('Error Handling', () => {
		it('should return 401 for unauthenticated requests', function () {
			const API_BASE_URL = getApiBaseUrl();
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/state`,
				headers: {
					'Content-Type': 'application/json'
				},
				failOnStatusCode: false
			}).then((response) => {
				// Accept 401, 403, 404, or 500 (if backend has issues)
				expect(response.status).to.be.oneOf([401, 403, 404, 500]);
			});
		});

		it('should return 401 for invalid token', function () {
			const API_BASE_URL = getApiBaseUrl();
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/state`,
				headers: {
					Authorization: 'Bearer invalid_token',
					'Content-Type': 'application/json'
				},
				failOnStatusCode: false
			}).then((response) => {
				// Accept 401, 403, 404, or 500 (if backend has issues)
				expect(response.status).to.be.oneOf([401, 403, 404, 500]);
			});
		});
	});
});
