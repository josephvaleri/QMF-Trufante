# Auth System Test Suite

This directory contains comprehensive tests for the Question My Faith authentication system.

## Test Files

### 1. `auth.test.tsx`
**Component-level tests for the AuthPage**
- ✅ Component rendering and UI elements
- ✅ Form validation and user interactions
- ✅ Login/signup form toggling
- ✅ Error handling and loading states
- ✅ User state management

### 2. `auth-api.test.ts`
**API integration tests**
- ✅ Authentication context handling
- ✅ User profile creation
- ✅ Error handling for missing environment variables
- ✅ Supabase connection error handling

### 3. `supabase-client.test.ts`
**Supabase client configuration tests**
- ✅ Browser client setup
- ✅ Server client setup
- ✅ Environment variable handling
- ✅ Fallback configuration

### 4. `auth-integration-real.test.tsx`
**Real database integration tests with cleanup**
- ✅ Creates test account with "Test User" as preferred name
- ✅ Automatic cleanup after each test
- ✅ Handles account creation failures
- ✅ Handles profile creation failures
- ✅ Test account management and summary

## Running Tests

### Run All Auth Tests
```bash
npm run test:auth
```

### Run Auth Tests in Watch Mode
```bash
npm run test:auth:watch
```

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

## Test Coverage Areas

### ✅ Component Testing
- [x] AuthPage component rendering
- [x] Form field validation
- [x] Button interactions
- [x] Loading states
- [x] Error message display
- [x] Mode switching (login/signup)

### ✅ Authentication Flow Testing
- [x] User login process
- [x] User signup process
- [x] Profile creation
- [x] Authentication state changes
- [x] Redirect handling

### ✅ Form Validation Testing
- [x] Email format validation
- [x] Password strength requirements
- [x] Required field validation
- [x] Preferred name handling

### ✅ Error Handling Testing
- [x] Network errors
- [x] Authentication errors
- [x] Profile creation errors
- [x] Missing environment variables
- [x] Database connection errors

### ✅ Integration Testing
- [x] Supabase client integration
- [x] API endpoint integration
- [x] User profile management
- [x] State management
- [x] UI state synchronization

## Test Data

### Mock Users
```javascript
const mockUser = {
  id: 'user123',
  email: 'test@example.com',
  preferred_name: 'John Doe'
};
```

### Test Account Details
```javascript
// Real test account created during integration tests
const testAccount = {
  email: 'testuser@example.com',
  password: 'testpassword123',
  preferred_name: 'Test User',
  id: 'test-user-123'
};
```

### Mock Supabase Responses
```javascript
const mockAuthResponse = {
  data: { user: mockUser },
  error: null
};
```

## Environment Setup

Tests use mocked environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## Mocking Strategy

### Supabase Client
- Mocked at the module level
- Simulates real API responses
- Handles both success and error cases

### Next.js Router
- Mocked `useRouter` hook
- Simulates navigation behavior
- Tracks navigation calls

### React Components
- Mocked Next.js Image component
- Simulated user interactions
- Isolated component testing

## Test Scenarios

### Happy Path Scenarios
1. **Successful Login**
   - Valid credentials → Authentication success → Redirect to home

2. **Successful Signup**
   - Valid form data → Account creation → Profile creation → Success

3. **Form Validation**
   - Invalid data → Validation errors → No submission

### Error Scenarios
1. **Authentication Failures**
   - Invalid credentials → Error message display

2. **Network Errors**
   - Connection issues → Graceful error handling

3. **Profile Creation Failures**
   - Database errors → Logged but not blocking

### Edge Cases
1. **Already Authenticated**
   - User logged in → Immediate redirect

2. **Form State Management**
   - Mode switching → Field clearing

3. **Loading States**
   - Async operations → Loading indicators

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Mock external dependencies
- Clean up after each test

### Assertions
- Test both positive and negative cases
- Verify user interactions
- Check error handling
- Validate state changes

### Mocking
- Mock at the right level
- Use realistic mock data
- Test error conditions
- Verify mock calls

## Continuous Integration

These tests are designed to run in CI/CD pipelines:
- No external dependencies
- Deterministic results
- Fast execution
- Clear pass/fail status

## Debugging Tests

### Common Issues
1. **Mock not working**: Check mock implementation
2. **Async issues**: Use `waitFor` for async operations
3. **State not updating**: Verify state management
4. **Component not rendering**: Check component imports

### Debug Commands
```bash
# Run specific test file
npx jest __tests__/auth.test.tsx

# Run with verbose output
npx jest __tests__/auth.test.tsx --verbose

# Run with debug output
DEBUG=* npx jest __tests__/auth.test.tsx
```

## Contributing

When adding new auth features:
1. Add corresponding tests
2. Update this README
3. Ensure all tests pass
4. Add integration tests for complex flows

## Test Maintenance

- Update tests when changing auth logic
- Keep mocks in sync with real APIs
- Review test coverage regularly
- Remove obsolete tests
