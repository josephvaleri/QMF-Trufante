# Playwright E2E Testing Setup

This directory contains end-to-end tests for the Question My Faith application using Playwright.

## Configuration

The Playwright configuration is set up to emit fix-friendly artifacts:

- **Screenshots**: Taken on failure and at key test steps
- **Videos**: Recorded on failure for debugging
- **Traces**: Captured on first retry for detailed debugging
- **Console Logs**: Captured throughout test execution
- **Multiple Reporters**: HTML, JSON, JUnit, and list reporters

## Test Structure

### Main Test File
- `auth-flow.spec.ts` - Complete authentication flow testing

### Utilities
- `test-utils.ts` - Helper functions for common test operations
- `global-setup.ts` - Global test setup
- `global-teardown.ts` - Global test cleanup

## Running Tests

### Basic Commands
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run with debug mode
npm run test:e2e:debug

# Run with trace recording
npm run test:e2e:trace
```

### Auth-Specific Commands
```bash
# Run only auth flow tests
npm run test:e2e:auth

# Debug auth flow tests
npm run test:e2e:auth:debug

# Run auth tests in headed mode
npm run test:e2e:auth:headed
```

### Viewing Reports
```bash
# Show HTML report
npm run test:e2e:report
```

## Test Artifacts

All test artifacts are saved to the `test-results/` directory:

- **Screenshots**: `test-results/debug-*.png`
- **Videos**: `test-results/video-*.webm`
- **Traces**: `test-results/trace-*.zip`
- **JSON Report**: `test-results/results.json`
- **JUnit Report**: `test-results/results.xml`

## Debugging Features

### Screenshot Debugging
Tests automatically take screenshots at key points:
- Initial state
- After form filling
- After submissions
- On failures
- After navigation

### Console Log Capture
All console messages are captured and logged during test execution.

### Network Monitoring
Tests wait for network idle and capture any unhandled errors.

### Test Reports
Each test generates a detailed report including:
- Test name and timestamp
- Current URL and page title
- Local storage data
- Cookie information
- Console errors

## Fix-Friendly Features

1. **Detailed Error Messages**: Tests include comprehensive error logging
2. **Visual Debugging**: Screenshots at every step
3. **State Capture**: Full page state captured on failures
4. **Network Analysis**: Network activity monitoring
5. **Console Debugging**: All console output captured
6. **Retry Logic**: Automatic retries with trace capture
7. **Multiple Formats**: Reports in HTML, JSON, and JUnit formats

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase timeout in `playwright.config.ts`
2. **Element Not Found**: Check selectors and add wait conditions
3. **Auth Issues**: Verify test user setup and database state
4. **Network Errors**: Check if dev server is running

### Debug Steps

1. Run tests in headed mode to see what's happening
2. Check screenshots in `test-results/` directory
3. Use trace viewer for detailed step-by-step analysis
4. Review console logs for JavaScript errors
5. Check test reports for detailed state information

## Best Practices

1. **Use Utilities**: Leverage helper functions in `test-utils.ts`
2. **Take Screenshots**: Use `debugScreenshot()` at key points
3. **Wait for State**: Use `waitForAuth()` and `waitForNetworkIdle()`
4. **Handle Errors**: Wrap tests in try-catch blocks
5. **Generate Reports**: Use `generateTestReport()` for detailed analysis
