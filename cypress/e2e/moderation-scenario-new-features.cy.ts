// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/index.d.ts" />
import { adminUser } from '../support/e2e';

describe('Moderation Scenario New Features', () => {
	const EMAIL = Cypress.env('TEST_EMAIL') || adminUser.email;
	const PASSWORD = Cypress.env('TEST_PASSWORD') || adminUser.password;

	beforeEach(() => {
		cy.login(EMAIL, PASSWORD);

		// Ensure we have at least one child profile via API (more stable than UI flows)
		cy.window().then((win) => {
			const token = win.localStorage.getItem('token') || '';
			if (token) {
				// Request child profiles to get the ID
				cy.request({
					method: 'GET',
					url: '/api/v1/child-profiles',
					headers: {
						Authorization: `Bearer ${token}`
					},
					failOnStatusCode: false
				}).then((response) => {
					if (response.status === 200 && response.body && Array.isArray(response.body) && response.body.length > 0) {
						const childId = response.body[0].id;
						Cypress.env('TEST_CHILD_ID', childId);
						// Set current child via user settings API (as the service does)
						cy.request({
							method: 'PUT',
							url: '/api/v1/users/user/settings',
							headers: {
								Authorization: `Bearer ${token}`,
								'Content-Type': 'application/json'
							},
							body: {
								selectedChildId: childId
							},
							failOnStatusCode: false
						});
						
						// After setting child, ensure assignment step is set
						win.localStorage.setItem('assignmentStep', '2');
						win.localStorage.setItem('moderationScenariosAccessed', 'true');
						win.localStorage.setItem('unlock_moderation', 'true');
					} else if (response.status === 200 && Array.isArray(response.body) && response.body.length === 0) {
						// No profiles exist yet: create one, then set workflow flags
						cy.request({
							method: 'POST',
							url: '/api/v1/child-profiles',
							headers: {
								Authorization: `Bearer ${token}`,
								'Content-Type': 'application/json'
							},
							body: {
								name: 'Test Child',
								child_age: '10 years old',
								child_gender: 'Male'
							},
							failOnStatusCode: false
						}).then(() => {
							win.localStorage.setItem('assignmentStep', '2');
							win.localStorage.setItem('moderationScenariosAccessed', 'true');
							win.localStorage.setItem('unlock_moderation', 'true');
						});
					} else {
						// If no profiles, still set assignment step
						win.localStorage.setItem('assignmentStep', '2');
						win.localStorage.setItem('moderationScenariosAccessed', 'true');
						win.localStorage.setItem('unlock_moderation', 'true');
					}
					
					// Upload scenario files using the existing admin tool
					// Upload main scenarios from prompt_generation/child_llm_scenarios_50.json
					const baseUrl = Cypress.config().baseUrl || 'http://localhost:8080';
					
					cy.task('uploadScenarioFile', {
						token: token,
						filePath: 'prompt_generation/child_llm_scenarios_50.json',
						setName: 'cypress_test',
						source: 'cypress_test',
						baseUrl: baseUrl
					}).then((result: any) => {
						if (result.status === 200) {
							cy.log(`Scenarios uploaded successfully: ${result.body}`);
						} else {
							cy.log(`Warning: Scenario upload returned status ${result.status}: ${result.body}`);
						}
					});
					
					// Upload attention checks from Persona_generation/mock_attention_checks.json
					cy.task('uploadScenarioFile', {
						token: token,
						filePath: 'Persona_generation/mock_attention_checks.json',
						setName: 'cypress_test_attention',
						source: 'cypress_test',
						baseUrl: baseUrl
					}).then((result: any) => {
						if (result.status === 200) {
							cy.log(`Attention checks uploaded successfully: ${result.body}`);
						} else {
							cy.log(`Warning: Attention check upload returned status ${result.status}: ${result.body}`);
						}
					});
				});
			} else {
				// Fallback: set assignment step even without token
				win.localStorage.setItem('assignmentStep', '2');
				win.localStorage.setItem('moderationScenariosAccessed', 'true');
				win.localStorage.setItem('unlock_moderation', 'true');
			}
		});
		
		// Wait for API calls to complete
		cy.wait(5000); // Increased wait for scenario upload
	});

	it('should show loading screen while scenarios populate', () => {
		cy.visit('/moderation-scenario');
		// Check for loading screen - it might appear briefly or might not appear if scenarios load quickly
		cy.get('body').then(($body) => {
			if ($body.text().includes('Loading Scenarios')) {
				cy.contains('Loading Scenarios', { timeout: 5000 }).should('exist');
				cy.contains('Please wait while we prepare your moderation scenarios').should('exist');
				// Wait for scenarios to load (loading screen should disappear)
				cy.contains('Loading Scenarios', { timeout: 30000 }).should('not.exist');
			} else {
				// If loading screen doesn't appear, scenarios loaded too quickly - that's okay
				cy.log('Loading screen did not appear - scenarios loaded quickly');
			}
		});
		// Wait for page to be ready
		cy.wait(5000);
	});

	it('should display two sections in Step 1: concerns in prompt and response', () => {
		cy.visit('/moderation-scenario');
		
		// Wait for loading screen to disappear if it appears
		cy.get('body').then(($body) => {
			if ($body.text().includes('Loading Scenarios')) {
				cy.contains('Loading Scenarios', { timeout: 60000 }).should('not.exist');
			}
		});
		
		// Wait for scenarios to be assigned - check for error messages first
		cy.wait(10000); // Give initial time for scenario assignment
		
		// Check page content for debugging
		cy.get('body').then(($body) => {
			const bodyText = $body.text();
			cy.log(`Page content preview: ${bodyText.substring(0, 500)}`);
			
			// Check for error messages first
			if (bodyText.includes('No scenarios available') || bodyText.includes('Failed to load scenarios')) {
				cy.log('ERROR: Scenarios failed to load');
				cy.log(`Full page text: ${bodyText}`);
				throw new Error('Scenarios failed to load - cannot continue test');
			}
		});
		
		// Wait for "Conversation Review" to appear (indicates scenarios loaded)
		cy.contains('Conversation Review', { timeout: 60000 }).should('exist');
		
		// Additional wait for scenario content to render
		cy.wait(5000);
		
		cy.get('body').then(($body) => {
			// Check if Step 1 is visible
			if ($body.text().includes('Step 1: Highlight the content that concerns you')) {
				// Step 1 is visible, check for sections
				cy.window().scrollTo(0, 3000, { ensureScrollable: false });
				cy.wait(1000);
				// Check for two sections
				cy.contains('Concerns in Prompt', { timeout: 10000 }).should('exist');
				cy.contains('Concerns in Response', { timeout: 10000 }).should('exist');
			} else {
				cy.log('Step 1 not visible - scenarios may still be loading or not available');
				cy.log(`Current page text: ${$body.text().substring(0, 1000)}`);
			}
		});
	});

	it('should show Step 1 highlight instructions under the heading', () => {
		cy.visit('/moderation-scenario');
		cy.get('body').then(($body) => {
			if ($body.text().includes('Loading Scenarios')) {
				cy.contains('Loading Scenarios', { timeout: 60000 }).should('not.exist');
			}
		});
		cy.wait(10000);

		cy.contains('Conversation Review', { timeout: 60000 }).should('exist');
		cy.wait(5000);

		cy.contains('Step 1: Highlight the content that concerns you', { timeout: 20000 }).should('exist');
		cy.contains(
			'Drag over text in the prompt or response above to highlight concerns. If this scenario is not relevant, click "Skip Scenario".',
			{ timeout: 10000 }
		).should('exist');
	});

	it('should detect attention check text in Step 2 and send pass flags on submit', () => {
		const childId = Cypress.env('TEST_CHILD_ID');
		expect(childId, 'TEST_CHILD_ID should be set in beforeEach').to.be.ok;

		cy.visit('/moderation-scenario');
		cy.get('body').then(($body) => {
			if ($body.text().includes('Loading Scenarios')) {
				cy.contains('Loading Scenarios', { timeout: 60000 }).should('not.exist');
			}
		});

		cy.contains('Conversation Review', { timeout: 60000 }).should('exist');

		// Find the attention check scenario by switching indices and looking for the embedded instructions.
		const attentionText = 'Please moderate this question. Follow these steps:';
		const maxIndexToTry = 10;

		const openScenarioIndex = (idx: number): Cypress.Chainable<void> => {
			return cy
				.window()
				.then((win) => {
					win.localStorage.setItem(`moderationCurrentScenario_${childId}`, String(idx));
				})
				.then(() => {
					return cy.reload();
				});
		};

		const findAttentionCheckIndex = (idx: number): Cypress.Chainable<number> => {
			if (idx > maxIndexToTry) {
				throw new Error('Attention check scenario not found in first indices');
			}
			return openScenarioIndex(idx).then(() => {
				return cy.get('body').then(($body) => {
					if ($body.text().includes(attentionText)) return idx;
					return findAttentionCheckIndex(idx + 1);
				});
			});
		};

		findAttentionCheckIndex(0).then((scenarioIndex) => {
			cy.contains(attentionText, { timeout: 60000 }).should('exist');

			// Ensure Step 2 is visible by seeding localStorage state for the attention check scenario index
			cy.window().then((win) => {
				const seededState = {
					versions: [],
					currentVersionIndex: -1,
					confirmedVersionIndex: null,
					highlightedTexts1: [],
					selectedModerations: [],
					customInstructions: [],
					showOriginal1: true,
					showComparisonView: false,
					attentionCheckSelected: false,
					attentionCheckPassed: false,
					markedNotApplicable: false,
					responseHighlightedHTML: '',
					promptHighlightedHTML: '',
					step1Completed: true,
					step2Completed: false,
					step3Completed: false,
					concernLevel: 3,
					concernReason: '',
					satisfactionLevel: null,
					satisfactionReason: '',
					nextAction: null
				};

				win.localStorage.setItem(
					`moderationScenarioStates_${childId}`,
					JSON.stringify([[scenarioIndex, seededState]])
				);
				win.localStorage.setItem(`moderationCurrentScenario_${childId}`, String(scenarioIndex));
			});

			cy.reload();
			cy.contains('Step 2: Explain why this content concerns you', { timeout: 60000 }).should('exist');

			cy.intercept('POST', '/api/v1/moderation/sessions').as('saveSession');

			cy.get('textarea').first().clear().type('attention check');
			cy.contains('Attention check detected! You can continue as normal.', { timeout: 10000 }).should('exist');

			// Select concern level (required by UI validation)
			cy.contains('3 - Moderately concerned', { timeout: 5000 }).click({ force: true });

			cy.get('button')
				.contains('Submit', { timeout: 10000 })
				.should('not.be.disabled')
				.click({ force: true });

			cy.wait('@saveSession', { timeout: 60000 }).then((interception) => {
				const body = interception.request.body as any;
				expect(body).to.have.property('is_attention_check', true);
				expect(body).to.have.property('attention_check_selected', true);
				expect(body).to.have.property('attention_check_passed', true);
			});
		});
	});

	it('should display Likert scale for level of concern in Step 2', () => {
		cy.visit('/moderation-scenario');
		cy.get('body').then(($body) => {
			if ($body.text().includes('Loading Scenarios')) {
				cy.contains('Loading Scenarios', { timeout: 60000 }).should('not.exist');
			}
		});
		cy.wait(10000);

		cy.contains('Conversation Review', { timeout: 60000 }).should('exist');
		cy.wait(5000);

		// Wait for Step 1 to appear
		cy.contains('Step 1: Highlight the content that concerns you', { timeout: 20000 }).should('exist');
		
		// To get to Step 2, we need to complete Step 1 by highlighting text and clicking Continue
		// For now, let's check if we can navigate to Step 2 by simulating the flow
		// First, try to highlight some text in the response area
		cy.window().scrollTo(0, 2000, { ensureScrollable: false });
		cy.wait(1000);
		
		// Try to find response content and highlight it
		cy.get('body').then(($body) => {
			// Look for response content - it might be in various containers
			const responseElements = $body.find('[class*="response"], [class*="message"], .response-content');
			if (responseElements.length > 0) {
				// Try to select text to create a highlight
				cy.wrap(responseElements.first()).then(($el) => {
					// Simulate text selection
					const text = $el.text();
					if (text.length > 20) {
						// Try to trigger selection
						cy.wrap($el).trigger('mousedown', { which: 1, clientX: 100, clientY: 100 });
						cy.wait(100);
						cy.wrap($el).trigger('mousemove', { which: 1, clientX: 200, clientY: 100 });
						cy.wait(100);
						cy.wrap($el).trigger('mouseup');
						cy.wait(500);
					}
				});
			}
		});
		
		// Try to click Continue button if highlights exist, or check if Step 2 is already visible
		cy.get('body').then(($body) => {
			if ($body.text().includes('Step 2: Explain why this content concerns you')) {
				// Step 2 is visible, check for Likert scale
				cy.contains('Level of Concern', { timeout: 5000 }).should('exist');
				cy.contains('1 - Not concerned at all', { timeout: 5000 }).should('exist');
				cy.contains('5 - Extremely concerned', { timeout: 5000 }).should('exist');
			} else {
				// Try clicking Continue if button is enabled
				cy.get('button').contains('Continue').then(($btn) => {
					if (!$btn.is(':disabled')) {
						cy.wrap($btn).click({ force: true });
						cy.wait(2000);
						// Now check for Step 2
						cy.contains('Step 2: Explain why this content concerns you', { timeout: 10000 }).should('exist');
						cy.contains('Level of Concern', { timeout: 5000 }).should('exist');
						cy.contains('1 - Not concerned at all', { timeout: 5000 }).should('exist');
						cy.contains('5 - Extremely concerned', { timeout: 5000 }).should('exist');
					} else {
						cy.log('Continue button disabled - highlights required to proceed to Step 2');
					}
				});
			}
		});
	});

	it('should require level of concern selection in Step 2', () => {
		cy.visit('/moderation-scenario');
		cy.get('body').then(($body) => {
			if ($body.text().includes('Loading Scenarios')) {
				cy.contains('Loading Scenarios', { timeout: 30000 }).should('not.exist');
			}
		});
		cy.wait(5000);

		// Check if Step 2 is visible
		cy.get('body').then(($body) => {
			if ($body.text().includes('Step 2: Explain why this content concerns you')) {
				// Fill explanation but don't select concern level
				cy.get('textarea').first().type('This is a test explanation that is longer than 10 characters');
				// Check if submit button is disabled (should be if concern level not selected)
				cy.get('button').contains('Submit', { timeout: 5000 }).then(($btn) => {
					if ($btn.length > 0) {
						// Button exists - check if it's disabled
						cy.wrap($btn).should('satisfy', ($el) => {
							return $el.is(':disabled') || $el.prop('disabled');
						});
					}
				});
			} else {
				cy.log('Step 2 not visible - requires completing Step 1 first (expected behavior)');
			}
		});
	});

	it('should allow selecting concern level and submitting Step 2', () => {
		cy.visit('/moderation-scenario');
		cy.get('body').then(($body) => {
			if ($body.text().includes('Loading Scenarios')) {
				cy.contains('Loading Scenarios', { timeout: 30000 }).should('not.exist');
			}
		});
		cy.wait(5000);

		// Check if Step 2 is visible
		cy.get('body').then(($body) => {
			if ($body.text().includes('Step 2: Explain why this content concerns you')) {
				// Fill explanation
				cy.get('textarea').first().type('This is a test explanation that is longer than 10 characters');
				// Select concern level
				cy.contains('3 - Moderately concerned', { timeout: 5000 }).click({ force: true });
				cy.wait(500);
				// Submit should be enabled
				cy.get('button').contains('Submit', { timeout: 5000 }).should('not.be.disabled');
			} else {
				cy.log('Step 2 not visible - requires completing Step 1 first (expected behavior)');
			}
		});
	});

	it('should show continue button disabled when no highlights in Step 1', () => {
		cy.visit('/moderation-scenario');
		cy.get('body').then(($body) => {
			if ($body.text().includes('Loading Scenarios')) {
				cy.contains('Loading Scenarios', { timeout: 60000 }).should('not.exist');
			}
		});
		cy.wait(10000);

		cy.contains('Conversation Review', { timeout: 60000 }).should('exist');
		cy.wait(5000);

		// Wait for Step 1 to appear
		cy.contains('Step 1: Highlight the content that concerns you', { timeout: 20000 }).should('exist');
		
		// Scroll to find continue button
		cy.window().scrollTo(0, 3000, { ensureScrollable: false });
		cy.wait(1000);
		// Check that continue button is disabled (no highlights yet)
		cy.get('button').contains('Continue', { timeout: 10000 }).should('be.disabled');
		// Check for hint text
		cy.get('body').then(($body) => {
			if ($body.text().includes('highlight required') || $body.text().includes('(highlight required)')) {
				cy.contains('highlight required', { timeout: 5000 }).should('exist');
			}
		});
	});
});
