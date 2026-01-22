/// <reference path="../support/e2e.ts" />

/**
 * Workflow API tests: /workflow/*
 * Tests all workflow endpoints for managing user progress through the study workflow.
 * Uses INTERVIEWEE_EMAIL/INTERVIEWEE_PASSWORD or TEST_EMAIL/TEST_PASSWORD from env;
 * defaults to jjdrisco@ucsd.edu / 0000 if unset.
 * Prereqs: frontend (npm run dev) and backend running; RUN_CHILD_PROFILE_TESTS=1;
 * CYPRESS_baseUrl must match the dev server port (e.g. http://localhost:5173 or 5174).
 * Run: RUN_CHILD_PROFILE_TESTS=1 CYPRESS_baseUrl=http://localhost:5173 npx cypress run --spec cypress/e2e/workflow.cy.ts
 */
const EMAIL = Cypress.env('INTERVIEWEE_EMAIL') || Cypress.env('TEST_EMAIL') || 'jjdrisco@ucsd.edu';
const PASSWORD = Cypress.env('INTERVIEWEE_PASSWORD') || Cypress.env('TEST_PASSWORD') || '0000';
const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173';
const API_BASE_URL = `${BASE_URL}/api/v1`;

describe('Workflow API Endpoints', () => {
	let authToken: string;

	beforeEach(() => {
		if (!EMAIL || !PASSWORD) {
			cy.log('INTERVIEWEE_EMAIL/PASSWORD or TEST_EMAIL/TEST_PASSWORD not set; skipping');
			return;
		}
		// Login and get token
		cy.visit('/auth', {
			onBeforeLoad(win) {
				win.localStorage.removeItem('token');
			}
		});
		cy.get('input#email, input[autocomplete="email"]', { timeout: 15000 })
			.first()
			.clear()
			.type(EMAIL);
		cy.get('input[type="password"]').first().clear().type(PASSWORD);
		cy.get('button').contains(/sign in/i).click();
		cy.url({ timeout: 15000 }).should('satisfy', (u: string) =>
			['/kids/profile', '/', '/moderation-scenario', '/assignment-instructions', '/parent'].some((p) =>
				u.includes(p)
			)
		);
		// Get token from localStorage
		cy.window().then((win) => {
			const token = win.localStorage.getItem('token');
			if (token) {
				authToken = token;
			}
		});
	});

	describe('GET /workflow/state', () => {
		it('should return workflow state with next route and progress', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/state`,
				headers: {
					Authorization: `Bearer ${authToken}`,
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

		it('should return workflow state for new user (no child profile)', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/state`,
				headers: {
					Authorization: `Bearer ${authToken}`,
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

	describe('GET /workflow/current-attempt', () => {
		it('should return current attempt number', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/current-attempt`,
				headers: {
					Authorization: `Bearer ${authToken}`,
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

	describe('GET /workflow/session-info', () => {
		it('should return session information', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/session-info`,
				headers: {
					Authorization: `Bearer ${authToken}`,
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

	describe('GET /workflow/completed-scenarios', () => {
		it('should return completed scenario indices', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/completed-scenarios`,
				headers: {
					Authorization: `Bearer ${authToken}`,
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

	describe('GET /workflow/study-status', () => {
		it('should return study completion status', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/study-status`,
				headers: {
					Authorization: `Bearer ${authToken}`,
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

	describe('POST /workflow/reset', () => {
		it('should reset entire user workflow and increment attempt number', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			// Get current attempt before reset
			let attemptBefore: number;
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/current-attempt`,
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				}
			}).then((response) => {
				attemptBefore = response.body.current_attempt;
				// Now reset workflow
				return cy.request({
					method: 'POST',
					url: `${API_BASE_URL}/workflow/reset`,
					headers: {
						Authorization: `Bearer ${authToken}`,
						'Content-Type': 'application/json'
					}
				});
			}).then((response) => {
				expect(response.status).to.eq(200);
				expect(response.body).to.have.property('status', 'success');
				expect(response.body).to.have.property('new_attempt');
				expect(response.body).to.have.property('message');
				expect(response.body.new_attempt).to.be.a('number');
				expect(response.body.new_attempt).to.be.greaterThan(attemptBefore);
			});
		});
	});

	describe('POST /workflow/reset-moderation', () => {
		it('should reset only moderation workflow and increment attempt', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			// Get current moderation attempt before reset
			let moderationAttemptBefore: number;
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/current-attempt`,
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				}
			}).then((response) => {
				moderationAttemptBefore = response.body.moderation_attempt;
				// Now reset moderation workflow
				return cy.request({
					method: 'POST',
					url: `${API_BASE_URL}/workflow/reset-moderation`,
					headers: {
						Authorization: `Bearer ${authToken}`,
						'Content-Type': 'application/json'
					}
				});
			}).then((response) => {
				expect(response.status).to.eq(200);
				expect(response.body).to.have.property('status', 'success');
				expect(response.body).to.have.property('new_attempt');
				expect(response.body).to.have.property('completed_scenario_indices');
				expect(response.body).to.have.property('message');
				expect(response.body.new_attempt).to.be.a('number');
				expect(response.body.new_attempt).to.be.greaterThan(moderationAttemptBefore);
				expect(response.body.completed_scenario_indices).to.be.an('array');
			});
		});
	});

	describe('POST /workflow/moderation/finalize', () => {
		it('should finalize moderation without filters', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			cy.request({
				method: 'POST',
				url: `${API_BASE_URL}/workflow/moderation/finalize`,
				headers: {
					Authorization: `Bearer ${authToken}`,
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

		it('should finalize moderation with child_id filter', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			// First get child profiles to use a valid child_id
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/child-profiles`,
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				failOnStatusCode: false
			}).then((childResponse) => {
				if (childResponse.status === 200 && childResponse.body.length > 0) {
					const childId = childResponse.body[0].id;
					return cy.request({
						method: 'POST',
						url: `${API_BASE_URL}/workflow/moderation/finalize`,
						headers: {
							Authorization: `Bearer ${authToken}`,
							'Content-Type': 'application/json'
						},
						body: {
							child_id: childId
						}
					});
				} else {
					// Skip if no child profiles
					cy.log('No child profiles found, skipping child_id filter test');
					return cy.wrap({ status: 200, body: { updated: 0 } });
				}
			}).then((response) => {
				expect(response.status).to.eq(200);
				expect(response.body).to.have.property('updated');
				expect(response.body.updated).to.be.a('number');
			});
		});

		it('should finalize moderation with session_number filter', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			cy.request({
				method: 'POST',
				url: `${API_BASE_URL}/workflow/moderation/finalize`,
				headers: {
					Authorization: `Bearer ${authToken}`,
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

	describe('Workflow State Transitions', () => {
		it('should progress through workflow states correctly', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			// Test workflow state progression
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/state`,
				headers: {
					Authorization: `Bearer ${authToken}`,
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

		it('should maintain consistent state across multiple requests', function () {
			if (!EMAIL || !PASSWORD) {
				this.skip();
				return;
			}
			// Make multiple requests and verify consistency
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/state`,
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				}
			}).then((response1) => {
				cy.request({
					method: 'GET',
					url: `${API_BASE_URL}/workflow/state`,
					headers: {
						Authorization: `Bearer ${authToken}`,
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

	describe('Error Handling', () => {
		it('should return 401 for unauthenticated requests', function () {
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/state`,
				headers: {
					'Content-Type': 'application/json'
				},
				failOnStatusCode: false
			}).then((response) => {
				expect(response.status).to.be.oneOf([401, 403]);
			});
		});

		it('should return 401 for invalid token', function () {
			cy.request({
				method: 'GET',
				url: `${API_BASE_URL}/workflow/state`,
				headers: {
					Authorization: 'Bearer invalid_token',
					'Content-Type': 'application/json'
				},
				failOnStatusCode: false
			}).then((response) => {
				expect(response.status).to.be.oneOf([401, 403]);
			});
		});
	});
});
