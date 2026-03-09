# FaceShare Reusable Prompts

This file contains reusable prompt snippets for common development tasks. Copy and customize as needed.

---

## Backend Development

### Add New API Endpoint

```
Add a new API endpoint to [describe functionality].

Requirements:
- Endpoint: [METHOD] /api/v1/[resource]/[action]
- Authentication: [Required/Not Required]
- Authorization: [e.g., "Only event owners can perform this action"]
- Request body: [describe expected fields]
- Response: [describe response structure]
- Error cases: [list expected errors]

Please:
1. Create Pydantic schemas in backend/app/schemas/
2. Implement the endpoint in backend/app/api/[appropriate file]
3. Add DynamoDB operations if needed in backend/app/core/dynamodb.py
4. Follow the patterns in existing endpoints
5. Add proper error handling and validation
6. Update the frontend ApiClient in src/lib/api.ts
7. Add TypeScript types to src/lib/types.ts if needed
```

### Add DynamoDB Access Pattern

```
Add a new DynamoDB access pattern for [describe use case].

Query requirements:
- Input: [what data is available to query with]
- Output: [what data needs to be retrieved]
- Performance: [any specific requirements]

Example: "Get all photos where a specific user appears"

Please:
1. Design the access pattern (PK/SK or GSI)
2. Implement the query method in backend/app/core/dynamodb.py
3. Add error handling for empty results
4. Document the access pattern in the DynamoDBService class
5. Write a test case to verify the query works
```

### Fix Backend Bug

```
There's a bug in [describe where/what]:

Symptoms:
- [what's happening]
- [expected behavior]
- [actual behavior]

Error message (if any):
[paste error message]

Steps to reproduce:
1. [step 1]
2. [step 2]
3. [observe error]

Please:
1. Investigate the root cause
2. Fix the issue following our coding standards
3. Add validation/checks to prevent recurrence
4. Test the fix manually
5. Add a test case if appropriate
```

### Add Backend Tests

```
Add test coverage for [describe feature/module].

Please write tests for:
- [scenario 1]
- [scenario 2]
- [edge case 1]
- [error case 1]

Use pytest and follow these guidelines:
1. Create test file in backend/tests/test_[module].py
2. Use clear test names: test_[function]_[scenario]_[expected_outcome]
3. Follow arrange-act-assert pattern
4. Mock external services (AWS, etc.)
5. Use fixtures for common test data
6. Ensure tests are independent and can run in any order
```

### Refactor Backend Code

```
Refactor [describe code/module] to improve [readability/performance/maintainability].

Current issues:
- [issue 1]
- [issue 2]

Goals:
- [goal 1]
- [goal 2]

Please:
1. Review the current implementation
2. Propose a refactoring approach
3. Maintain backward compatibility for API endpoints
4. Ensure all existing tests still pass
5. Update documentation if the interface changes
6. Follow coding standards in .claude/rules.md
```

---

## Frontend Development

### Add New Page

```
Add a new page for [describe purpose].

Route: /[route/path]
Layout: [use dashboard layout / standalone]
Authentication: [required / public]

Features needed:
- [feature 1]
- [feature 2]

UI Components:
- [component 1]
- [component 2]

Please:
1. Create page at src/app/[route]/page.tsx
2. Use TypeScript with proper types
3. Implement loading and error states
4. Use the ApiClient for backend calls
5. Follow Tailwind CSS patterns from existing pages
6. Make it responsive (mobile-first)
7. Add proper accessibility attributes
```

### Add React Component

```
Create a new React component for [describe purpose].

Requirements:
- Component name: [PascalCase name]
- Props: [list expected props with types]
- Behavior: [describe interactions]
- Styling: [describe visual requirements]

Please:
1. Create component in src/components/[name].tsx
2. Use TypeScript interface for props
3. Follow our component patterns (see existing components)
4. Use shadcn/ui components where appropriate
5. Make it accessible (ARIA labels, keyboard navigation)
6. Add loading/error states if it fetches data
7. Use 'use client' directive only if needed (state/effects)
```

### Connect Page to Backend

```
Wire up the [page name] page to use real backend data instead of mock data.

Current state:
- Uses mock data from src/lib/data.ts
- [describe current behavior]

Target state:
- Fetch data from [API endpoint]
- [describe desired behavior]

Please:
1. Remove mock data imports
2. Add API calls using apiClient.[method]
3. Handle loading state with a skeleton or spinner
4. Handle error states with user-friendly messages
5. Update TypeScript types to match backend response
6. Test with actual backend running
7. Ensure proper authentication token is sent
```

### Fix Frontend Bug

```
There's a UI bug in [describe where]:

Symptoms:
- [what's wrong visually/functionally]
- [expected behavior]
- [actual behavior]

Browser/Device: [if relevant]
Console errors: [paste any errors]

Steps to reproduce:
1. [step 1]
2. [step 2]
3. [observe bug]

Please:
1. Investigate the root cause
2. Fix the issue
3. Test on different screen sizes if layout-related
4. Verify no console errors remain
5. Check browser DevTools for any warnings
```

### Improve UI/UX

```
Improve the UI/UX of [describe component/page].

Current issues:
- [issue 1: e.g., "unclear call-to-action"]
- [issue 2: e.g., "too much scrolling"]

Goals:
- [goal 1: e.g., "make primary action more prominent"]
- [goal 2: e.g., "reduce cognitive load"]

Please:
1. Review the current implementation
2. Suggest improvements (you can propose before implementing)
3. Implement changes using Tailwind CSS
4. Maintain consistency with existing design patterns
5. Ensure accessibility isn't compromised
6. Test on mobile and desktop
```

---

## Full-Stack Features

### Implement End-to-End Feature

```
Implement [feature name] end-to-end (frontend + backend).

Feature description:
[Detailed description of what this feature does]

User flow:
1. [step 1]
2. [step 2]
3. [step 3]

Backend requirements:
- API endpoints: [list endpoints]
- DynamoDB: [describe data to store]
- AWS services: [S3/Rekognition if needed]

Frontend requirements:
- Pages: [list pages to add/modify]
- Components: [list components needed]
- User interactions: [describe interactions]

Please:
1. Start with backend (API + DynamoDB)
2. Add backend tests
3. Then implement frontend
4. Wire frontend to backend
5. Test the complete user flow
6. Document any new environment variables
7. Update API documentation if needed
```

### Add Integration

```
Integrate [external service/API] into FaceShare.

Service: [name of service]
Purpose: [what it will be used for]
Documentation: [link if available]

Requirements:
- [requirement 1]
- [requirement 2]

Please:
1. Research the service API/SDK
2. Add necessary credentials to .env.example (with placeholder values)
3. Implement integration in backend/app/services/
4. Add error handling for API failures
5. Create endpoints to expose functionality if needed
6. Update frontend to use new functionality
7. Document configuration in docs/ or .claude/context.md
```

---

## Database & Schema

### Modify DynamoDB Schema

```
Update the DynamoDB schema for [entity/table].

Current structure:
- [describe current PK/SK/GSI]

Proposed changes:
- [change 1]
- [change 2]

Reason:
[Explain why this change is needed]

Please:
1. Review current access patterns
2. Design new PK/SK/GSI structure
3. Consider impact on existing queries
4. Implement changes in backend/app/core/dynamodb.py
5. Update all affected endpoints
6. Plan data migration if needed (describe approach)
7. Update .claude/context.md with new schema
```

### Add Data Validation

```
Add validation for [field/entity] in DynamoDB operations.

Validation rules:
- [rule 1: e.g., "email must be valid format"]
- [rule 2: e.g., "name must be 2-50 characters"]

Please:
1. Add Pydantic validators in schema classes
2. Add database-level checks in DynamoDB service
3. Return clear error messages on validation failure
4. Update API documentation with validation rules
5. Add test cases for validation edge cases
```

---

## Testing & Quality

### Write Integration Tests

```
Write integration tests for [feature/flow].

Test scenarios:
1. [happy path scenario]
2. [error scenario 1]
3. [edge case 1]

Please:
1. Create test file: backend/tests/test_integration_[feature].py
2. Set up test fixtures (test users, events, etc.)
3. Test the complete flow (multiple API calls)
4. Clean up test data after each test
5. Mock AWS services appropriately
6. Ensure tests can run independently
```

### Debug Performance Issue

```
There's a performance issue with [describe where].

Symptoms:
- [what's slow]
- [how slow: e.g., "takes 5 seconds, should be <1s"]

Please:
1. Profile the code to identify bottleneck
2. Check DynamoDB query efficiency (avoid scans)
3. Check for N+1 query problems
4. Consider caching if appropriate
5. Implement optimization
6. Measure improvement
7. Document findings
```

### Code Review

```
Review [describe code/PR] for:
- Code quality and adherence to .claude/rules.md
- Potential bugs or edge cases
- Security concerns
- Performance issues
- Test coverage

Please provide:
1. Summary of what the code does
2. List of issues found (critical/important/nice-to-have)
3. Specific suggestions for improvement
4. Positive feedback on good practices
```

---

## DevOps & Deployment

### Setup Environment

```
Set up [environment: development/qa/production].

Requirements:
- AWS services: [DynamoDB/S3/Lambda/etc.]
- Environment variables: [list critical vars]
- Infrastructure: [describe needed resources]

Please:
1. Document AWS resource setup steps
2. Create .env.[environment] template
3. Update serverless.yml if needed
4. Document deployment process
5. Set up monitoring/logging if applicable
6. Test the complete setup
```

### Deploy to [Environment]

```
Deploy the latest changes to [environment].

Checklist:
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready (if any)
- [ ] No secrets in code

Please:
1. Run backend tests: pytest
2. Build frontend: npm run build
3. Deploy backend: serverless deploy --stage [env]
4. Deploy frontend: [your deployment method]
5. Verify deployment (smoke test)
6. Monitor for errors in first 30 minutes
7. Report any issues
```

### Debug Deployment Issue

```
There's an issue with the [environment] deployment.

Symptoms:
- [what's not working]
- [error messages if any]

Please:
1. Check CloudWatch logs (Lambda)
2. Verify environment variables are set
3. Check AWS service permissions
4. Verify DynamoDB table exists and is accessible
5. Check S3 bucket permissions
6. Identify root cause
7. Propose fix
```

---

## Documentation

### Update Documentation

```
Update documentation for [feature/change].

What changed:
- [change 1]
- [change 2]

Please update:
1. .claude/context.md if architecture/data model changed
2. .claude/CLAUDE.md if commands/setup changed
3. backend/README.md if backend-specific
4. docs/[relevant file] if detailed docs exist
5. API endpoint documentation (docstrings)
6. Environment variable documentation (.env.example)
```

### Create Tutorial

```
Create a tutorial for [task/feature].

Target audience: [developers/users/both]
Goal: [what they should be able to do after]

Please create:
1. Step-by-step guide with code examples
2. Screenshots if UI-related
3. Common pitfalls and how to avoid them
4. Troubleshooting section
5. Links to related documentation

Format: [Markdown/README/separate doc]
Location: docs/tutorials/[name].md
```

---

## Face Recognition Specific

### Tune Face Matching

```
Adjust face matching algorithm for [better accuracy/fewer false positives/performance].

Current settings:
- Model: [SFace/VGG-Face/Rekognition]
- Threshold: [current value]

Issues:
- [issue 1: e.g., "too many false matches"]
- [issue 2: e.g., "missing obvious matches"]

Please:
1. Review current matching logic in backend/app/api/deepface.py
2. Test with sample images (provide examples if needed)
3. Adjust threshold or model
4. Document the changes
5. Test with real-world event photos
6. Update configuration in code or make it configurable
```

### Debug Face Recognition

```
Face recognition is not working for [scenario].

Details:
- User ID: [if applicable]
- Image: [describe or provide path]
- Expected: [should be recognized/not recognized]
- Actual: [what happened]

Please:
1. Check if face profile is registered (dataset folder)
2. Verify face detection works on the image
3. Check embedding extraction
4. Verify similarity calculation
5. Check threshold settings
6. Identify root cause
7. Fix and test
```

### Batch Process Event Photos

```
Set up batch processing for event photos.

Requirements:
- Event ID: [event id or "all pending"]
- Number of photos: [approximate]
- Priority: [high/normal/low]

Please:
1. Use the /deepface/trigger-batch-scan endpoint
2. Process photos in background (consider async task)
3. Update match records in DynamoDB
4. Handle errors gracefully (retry logic)
5. Log progress
6. Notify when complete (if notification system exists)
```

---

## AI/Genkit Integration

### Create Genkit Flow

```
Create a new Genkit AI flow for [purpose].

Input: [describe input data]
Output: [describe expected output]
Model: [Gemini 2.5 Flash or other]

Use case:
[Describe when and how this flow will be used]

Please:
1. Create flow in src/ai/flows/[name].ts
2. Define input/output schemas
3. Implement the prompt and logic
4. Test the flow with sample inputs
5. Export from src/ai/flows/index.ts
6. Document usage in comments
```

### Improve AI Prompt

```
Improve the prompt for [Genkit flow name].

Current issues:
- [issue 1: e.g., "responses are too generic"]
- [issue 2: e.g., "doesn't follow format"]

Please:
1. Review current prompt in src/ai/flows/[name].ts
2. Test with various inputs
3. Refine prompt for better results
4. Add examples if needed
5. Test again
6. Document prompt strategy in comments
```

---

## Quick Fixes

### Add Error Handling

```
Add proper error handling to [function/endpoint].

Current: [describe current behavior]
Needed:
- Handle [error type 1]
- Handle [error type 2]
- Return user-friendly messages

Please:
1. Identify possible error cases
2. Add try-catch blocks or error checks
3. Return appropriate HTTP status codes (backend)
4. Display user-friendly messages (frontend)
5. Log technical details for debugging
```

### Add Loading State

```
Add loading state to [component/page].

Currently: [describe what happens during loading]
Needed: [describe desired loading UX]

Please:
1. Add useState for loading state
2. Set loading=true before async operation
3. Set loading=false in finally block
4. Show spinner/skeleton during loading
5. Disable buttons during loading to prevent double-submission
```

### Add TypeScript Types

```
Add proper TypeScript types to [file/component].

Current issues:
- [list any/unknown types]
- [missing interfaces]

Please:
1. Define interfaces for all props
2. Type all function parameters and returns
3. Remove any 'any' types
4. Add types to src/lib/types.ts if reusable
5. Ensure strict type checking passes
```

---

## Migration & Refactoring

### Migrate from Mock Data

```
Migrate [page/component] from using mock data to real API.

Current: Uses data from src/lib/data.ts
Target: Use apiClient.[method]

Please:
1. Identify which API endpoints to use
2. Replace mock data with API calls
3. Add loading/error states
4. Update types to match API response
5. Test with backend running
6. Remove unused mock data from data.ts
```

### Remove Deprecated Code

```
Remove deprecated code from [file/module].

Code to remove:
- [item 1]
- [item 2]

Please:
1. Verify code is truly unused (search references)
2. Check if it's used in any tests
3. Remove the code
4. Run all tests to ensure nothing breaks
5. Clean up related imports
6. Update documentation if needed
```

---

## Security & Compliance

### Add Authentication Check

```
Add authentication to [endpoint/page].

Currently: [public/partially protected]
Should be: [accessible only by authenticated users/specific roles]

Please:
1. Backend: Add Depends(get_current_user) to endpoint
2. Frontend: Add auth check in page/component
3. Redirect unauthenticated users to /login
4. Test with and without valid token
5. Ensure proper error messages
```

### Security Audit

```
Perform security audit on [feature/module].

Check for:
- [ ] Input validation
- [ ] SQL/NoSQL injection risks
- [ ] Authentication bypasses
- [ ] Authorization checks
- [ ] Sensitive data exposure
- [ ] CORS misconfiguration
- [ ] Secrets in code

Please:
1. Review code for security issues
2. List findings with severity (critical/high/medium/low)
3. Suggest fixes for each issue
4. Prioritize critical issues
```

---

## Custom Prompts

### Template for Custom Prompt

```
[Describe the task in detail]

Context:
- [relevant context 1]
- [relevant context 2]

Requirements:
- [requirement 1]
- [requirement 2]

Constraints:
- [constraint 1]
- [constraint 2]

Please:
1. [step 1]
2. [step 2]
3. [step 3]

Expected outcome:
[Describe what success looks like]
```

---

## Tips for Using These Prompts

1. **Customize**: Replace bracketed placeholders with actual values
2. **Be Specific**: Add more details relevant to your specific task
3. **Reference Docs**: Point to .claude/rules.md, context.md, or CLAUDE.md as needed
4. **Iterate**: Start with a prompt, refine based on results
5. **Combine**: Mix and match sections from different prompts
6. **Save Custom**: Add your own frequently-used prompts to this file

## Examples of Customization

### Before (Template)
```
Add a new API endpoint to [describe functionality].
Endpoint: [METHOD] /api/v1/[resource]/[action]
```

### After (Customized)
```
Add a new API endpoint to allow users to delete their event photos.
Endpoint: DELETE /api/v1/events/{event_id}/photos/{photo_id}
Authentication: Required (must be photo uploader or event owner)
```

---

**Last Updated**: 2026-03-02
**Related Docs**: [CLAUDE.md](./CLAUDE.md), [rules.md](./rules.md), [context.md](./context.md)
