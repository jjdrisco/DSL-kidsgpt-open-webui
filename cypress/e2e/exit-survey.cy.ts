// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/index.d.ts" />

// Helpers copied from identifier-based-state.cy.ts
function getCredentials() {
    return {
        email: Cypress.env('INTERVIEWEE_EMAIL') || Cypress.env('TEST_EMAIL') || 'jjdrisco@ucsd.edu',
        password: Cypress.env('INTERVIEWEE_PASSWORD') || Cypress.env('TEST_PASSWORD') || '0000'
    };
}

function getApiBaseUrl(): string {
    return 'http://localhost:8080/api/v1';
}

function authenticate() {
    const credentials = getCredentials();
    const API_BASE_URL = getApiBaseUrl();
    const TOKEN_ENV_KEY = 'EXIT_SURVEY_AUTH_TOKEN';
    return cy.session(
        `exit-survey-auth-${credentials.email}`,
        () => {
            cy.request({
                method: 'POST',
                url: `${API_BASE_URL}/auths/signup`,
                body: {
                    name: 'Test User',
                    email: credentials.email,
                    password: credentials.password
                },
                failOnStatusCode: false
            });
            cy.wait(2000);
            const attemptSignin = (retryCount = 0) => {
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
                            Cypress.env(TOKEN_ENV_KEY, token);
                            return cy.wrap(token);
                        } else if (signinResponse.status === 429 && retryCount < 8) {
                            const waitTime = Math.min((retryCount + 1) * 10000, 60000);
                            return cy.wait(waitTime).then(() => attemptSignin(retryCount + 1));
                        } else {
                            throw new Error(`Authentication failed: ${signinResponse.status}`);
                        }
                    });
            };
            return attemptSignin();
        },
        {
            validate: () => {
                const token = Cypress.env(TOKEN_ENV_KEY) as string || '';
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
            }
        }
    );
}

function loginViaUI() {
    const credentials = getCredentials();
    cy.visit('/auth');
    cy.get('input#email', { timeout: 10000 }).type(credentials.email);
    cy.get('input#password').type(credentials.password);
    cy.get('button[type="submit"]').click();
    cy.wait(2000);
    cy.window().its('localStorage.token').should('exist');
}


describe('Exit survey persistence', () => {
    beforeEach(() => {
        authenticate();
        loginViaUI();
        cy.wait(1000);
    });

    it('should autosave and reload survey draft', () => {
        cy.visit('/exit-survey', { failOnStatusCode: false });
        // select a couple of fields
        cy.get('input[name="parentGender"][value="female"]').check();
        cy.get('input[name="parentAge"][value="25-34"]').check();
        // intercept draft save
        cy.intercept('POST', '/api/v1/workflow/draft').as('saveDraft');
        cy.wait('@saveDraft');
        // reload page
        cy.reload();
        cy.get('input[name="parentGender"][value="female"]').should('be.checked');
        cy.get('input[name="parentAge"][value="25-34"]').should('be.checked');
    });

    it('should persist submission across logout and attempt reset', () => {
        cy.visit('/exit-survey', { failOnStatusCode: false });
        // fill every required field quickly by directly manipulating values
        cy.get('input[name="parentingStyle"][value="A"]').check();
        cy.get('input[name="parentInternetUseFrequency"][value="1"]').check();
        cy.get('input[name="genaiFamiliarity"][value="regular_user"]').check();
        cy.get('input[name="genaiUsageFrequency"][value="daily"]').check();
        cy.get('input[name="parentGender"][value="female"]').check();
        cy.get('input[name="parentAge"][value="25-34"]').check();
        cy.get('input[name="areaOfResidency"][value="urban"]').check();
        cy.get('input[name="parentEducation"][value="bachelors"]').check();
        cy.get('input[name="parentEthnicity"][value="white"]').check();
        cy.get('input[name="childInternetUseFrequency"][value="1"]').check();
        // choose at least one personality trait
        cy.get('input[type="checkbox"][value="compassionate"]').check();
        cy.get('button[type="submit"]').click();
        // confirm modal
        cy.contains('Task 3 Complete').should('be.visible');
        cy.contains('Yes, Proceed to Completion').click();
        // go to completion page
        cy.url().should('include', '/completion');

        // logout by clearing token and visiting /auth
        cy.window().then((win) => win.localStorage.removeItem('token'));
        cy.visit('/auth');
        loginViaUI();

        // revisit exit survey, should show read-only
        cy.visit('/exit-survey', { failOnStatusCode: false });
        cy.contains('Exit Survey Responses').should('exist');
        cy.contains('female').should('exist');

        // use menu reset to bump attempt
        // open the user menu via profile image
        cy.get('img[aria-label*="User Profile"], img[aria-label*="User Menu"]').first().click();
        cy.wait(500);
        cy.contains('Reset survey').click({ force: true });
        // accept confirmation dialog
        cy.on('window:confirm', () => true);
        cy.wait(1000);
        // after reset should land on instructions or similar
        cy.url().should('include', '/assignment-instructions');

        // revisiting exit-survey now should show blank form
        cy.visit('/exit-survey', { failOnStatusCode: false });
        cy.get('input[name="parentGender"][value="female"]').should('not.be.checked');
    });

    it('reset button clears answers', () => {
        // assume survey already submitted from prior test; ensure we're on read-only view
        cy.visit('/exit-survey', { failOnStatusCode: false });
        cy.contains('Exit Survey Responses').should('exist');
        // click reset button we added
        cy.contains('Reset survey').click();
        cy.contains('Reset survey?').should('exist');
        cy.contains('Reset').click();
        // after reset expect form emptied
        cy.get('input[name="parentGender"][value="female"]').should('not.be.checked');
        // verify backend workflow state
        cy.request({
            method: 'GET',
            url: `${getApiBaseUrl()}/workflow/state`,
            headers: { Authorization: `Bearer ${Cypress.env('EXIT_SURVEY_AUTH_TOKEN')}` }
        }).its('body.progress_by_section.exit_survey_completed').should('be.false');
    });
});
