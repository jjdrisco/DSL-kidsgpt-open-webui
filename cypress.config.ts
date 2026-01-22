import { defineConfig } from 'cypress';

export default defineConfig({
	e2e: {
		baseUrl: 'http://localhost:8080',
		setupNodeEvents(on, config) {
			// Forward RUN_CHILD_PROFILE_TESTS from process.env to Cypress env
			if (process.env.RUN_CHILD_PROFILE_TESTS || process.env.CYPRESS_RUN_CHILD_PROFILE_TESTS) {
				config.env.RUN_CHILD_PROFILE_TESTS = process.env.RUN_CHILD_PROFILE_TESTS || process.env.CYPRESS_RUN_CHILD_PROFILE_TESTS;
			}
			
			// Forward email/password vars from process.env when CYPRESS_* is not set
			const emailVars = ['INTERVIEWEE_EMAIL', 'PARENT_EMAIL', 'TEST_EMAIL'];
			const passwordVars = ['INTERVIEWEE_PASSWORD', 'PARENT_PASSWORD', 'TEST_PASSWORD'];
			
			[...emailVars, ...passwordVars].forEach(varName => {
				const cypressVarName = `CYPRESS_${varName}`;
				if (process.env[varName] && !process.env[cypressVarName]) {
					config.env[varName] = process.env[varName];
				}
			});
			
			// Forward baseUrl if set
			if (process.env.CYPRESS_baseUrl) {
				config.baseUrl = process.env.CYPRESS_baseUrl;
			}
			
			return config;
		}
	},
	video: true
});
