import { defineConfig } from 'cypress';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

export default defineConfig({
	e2e: {
		// Allow baseUrl to be overridden by CYPRESS_baseUrl environment variable
		baseUrl: process.env.CYPRESS_baseUrl || 'http://localhost:5173',
		setupNodeEvents(on, config) {
			// Forward RUN_CHILD_PROFILE_TESTS from process.env to Cypress env
			if (process.env.RUN_CHILD_PROFILE_TESTS || process.env.CYPRESS_RUN_CHILD_PROFILE_TESTS) {
				config.env.RUN_CHILD_PROFILE_TESTS =
					process.env.CYPRESS_RUN_CHILD_PROFILE_TESTS ?? process.env.RUN_CHILD_PROFILE_TESTS;
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

			// Task to upload scenario files using curl (simpler and more reliable)
			on('task', {
				uploadScenarioFile({ token, filePath, setName, source, baseUrl }) {
					const url = baseUrl || 'http://localhost:8080';
					const absolutePath = path.isAbsolute(filePath)
						? filePath
						: path.join(process.cwd(), filePath);

					// Check if file exists
					if (!fs.existsSync(absolutePath)) {
						throw new Error(`Scenario file not found: ${absolutePath}`);
					}

					try {
						// Use curl to upload
						const command =
							`curl -X POST "${url}/api/v1/admin/scenarios/upload" ` +
							`-H "Authorization: Bearer ${token}" ` +
							`-F "file=@${absolutePath}" ` +
							`-F "set_name=${setName || 'test'}" ` +
							`-F "source=${source || 'cypress_test'}" ` +
							`-F "deactivate_previous=false" ` +
							`-s -w "\\n%{http_code}"`;

						const result = execSync(command, {
							encoding: 'utf8',
							maxBuffer: 10 * 1024 * 1024
						});
						const lines = result.trim().split('\n');
						const statusCode = parseInt(lines[lines.length - 1], 10);
						const body = lines.slice(0, -1).join('\n');

						return { status: statusCode, body };
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						throw new Error(`Failed to upload scenario file: ${errorMessage}`);
					}
				}
			});

			return config;
		}
	},
	video: true,
	env: {
		// So RUN_CHILD_PROFILE_TESTS=1 or CYPRESS_RUN_CHILD_PROFILE_TESTS=1 skips registerAdmin in e2e.ts
		RUN_CHILD_PROFILE_TESTS:
			process.env.CYPRESS_RUN_CHILD_PROFILE_TESTS ?? process.env.RUN_CHILD_PROFILE_TESTS ?? false
	}
});
