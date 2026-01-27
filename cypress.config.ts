import { defineConfig } from 'cypress';
import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';

export default defineConfig({
	e2e: {
		baseUrl: 'http://localhost:8080',
		setupNodeEvents(on, config) {
			// Forward RUN_CHILD_PROFILE_TESTS from process.env to Cypress env
			if (process.env.RUN_CHILD_PROFILE_TESTS || process.env.CYPRESS_RUN_CHILD_PROFILE_TESTS) {
				config.env.RUN_CHILD_PROFILE_TESTS =
					process.env.RUN_CHILD_PROFILE_TESTS || process.env.CYPRESS_RUN_CHILD_PROFILE_TESTS;
			}

			// Forward email/password vars from process.env when CYPRESS_* is not set
			const emailVars = ['INTERVIEWEE_EMAIL', 'PARENT_EMAIL', 'TEST_EMAIL'];
			const passwordVars = ['INTERVIEWEE_PASSWORD', 'PARENT_PASSWORD', 'TEST_PASSWORD'];

			[...emailVars, ...passwordVars].forEach((varName) => {
				const cypressVarName = `CYPRESS_${varName}`;
				if (process.env[varName] && !process.env[cypressVarName]) {
					config.env[varName] = process.env[varName];
				}
			});

			// Forward baseUrl if set
			if (process.env.CYPRESS_baseUrl) {
				config.baseUrl = process.env.CYPRESS_baseUrl;
			}

			// Task to upload scenario file using curl (simpler and more reliable)
			on('task', {
				uploadScenario({ token, scenarioData, baseUrl }) {
					// Create temp file
					const tempDir = os.tmpdir();
					const tempFile = path.join(tempDir, `cypress-scenario-${Date.now()}.json`);
					
					try {
						// Write scenario data to temp file
						fs.writeFileSync(tempFile, JSON.stringify(scenarioData));
						
						// Use curl to upload
						const url = baseUrl || 'http://localhost:8080';
						const command = `curl -X POST "${url}/api/v1/admin/scenarios/upload" ` +
							`-H "Authorization: Bearer ${token}" ` +
							`-F "file=@${tempFile}" ` +
							`-F "set_name=test" ` +
							`-F "source=cypress_test" ` +
							`-F "deactivate_previous=false" ` +
							`-s -w "\\n%{http_code}"`;
						
						const result = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
						const lines = result.trim().split('\n');
						const statusCode = parseInt(lines[lines.length - 1], 10);
						const body = lines.slice(0, -1).join('\n');
						
						// Clean up temp file
						try {
							fs.unlinkSync(tempFile);
						} catch (e) {
							// Ignore cleanup errors
						}
						
						return { status: statusCode, body: body };
					} catch (error) {
						// Clean up temp file on error
						try {
							fs.unlinkSync(tempFile);
						} catch (e) {
							// Ignore cleanup errors
						}
						throw error;
					}
				}
			});

			return config;
		}
	},
	video: true
});
