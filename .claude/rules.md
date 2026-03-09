# FaceShare Coding Standards & Guardrails

This file defines the coding standards, best practices, and guardrails for the FaceShare project.

## General Principles

### Code Quality
- **Readability First**: Code should be self-documenting. Use clear variable/function names.
- **DRY Principle**: Don't Repeat Yourself. Extract common logic into reusable functions.
- **KISS Principle**: Keep It Simple, Stupid. Prefer simple solutions over clever ones.
- **YAGNI**: You Aren't Gonna Need It. Don't add functionality until it's needed.
- **Single Responsibility**: Each function/class should do one thing well.
Follow the project formatter. Do not change file style.
- Use logging instead of print. Include error context.
- Add type hints and docstrings for public functions.
- Keep functions small; prefer composition over long scripts.
- Write safe defaults. Handle timeouts and retries where external calls exist.

### Error Handling
- **Always handle errors explicitly** - No silent failures
- **User-facing errors** must be clear and actionable
- **Backend**: Use proper HTTP status codes (400 for client errors, 500 for server errors)
- **Frontend**: Display user-friendly error messages, log technical details to console
- **Validation**: Validate all user inputs on both frontend and backend

### Security
- **Never commit secrets** - Use environment variables for all sensitive data
- **Authentication**: Always verify JWT tokens on protected routes
- **Authorization**: Check user permissions before allowing actions
- **Input Sanitization**: Sanitize all user inputs to prevent injection attacks
- **CORS**: Only allow trusted origins in production
- **Rate Limiting**: Consider implementing rate limits on sensitive endpoints

## Backend (Python/FastAPI)

### Code Style
- **PEP 8**: Follow Python's official style guide
- **Type Hints**: Always use type hints for function parameters and return values
- **Docstrings**: Use Google-style docstrings for all public functions/classes
- **Line Length**: Max 88 characters (Black formatter default)
- **Imports**: Group into stdlib, third-party, local. Sort alphabetically within groups.

### Architecture Patterns

#### API Endpoints
```python
# ✅ GOOD: Clear naming, type hints, proper response models
@router.post("/events", response_model=EventResponse, status_code=201)
async def create_event(
    event: EventCreate,
    current_user: DynamoDBUser = Depends(get_current_user)
) -> EventResponse:
    """
    Create a new event.

    Args:
        event: Event creation data
        current_user: Authenticated user from JWT token

    Returns:
        Created event with ID and metadata

    Raises:
        HTTPException: 400 if validation fails
    """
    # Implementation
    pass

# ❌ BAD: No type hints, unclear naming, missing docs
@router.post("/events")
async def create(data, user):
    # Implementation
    pass
```

#### Error Responses
```python
# ✅ GOOD: Structured error with clear message
from fastapi import HTTPException

raise HTTPException(
    status_code=404,
    detail={
        "message": "Event not found",
        "event_id": event_id,
        "code": "EVENT_NOT_FOUND"
    }
)

# ❌ BAD: Generic string error
raise HTTPException(status_code=404, detail="Not found")
```

#### DynamoDB Operations
```python
# ✅ GOOD: Check for None, handle errors
user_item = dynamodb_service.get_user_by_id(user_id)
if not user_item:
    raise HTTPException(status_code=404, detail="User not found")

# ❌ BAD: No None check, will crash on missing user
user_name = dynamodb_service.get_user_by_id(user_id)['name']
```

### File Organization
```
backend/
├── app/
│   ├── api/              # API route handlers
│   │   ├── auth.py       # Authentication endpoints
│   │   ├── events.py     # Event CRUD
│   │   ├── users.py      # User management
│   │   └── deps.py       # Shared dependencies (get_current_user)
│   ├── core/             # Core functionality
│   │   ├── config.py     # Settings/environment
│   │   ├── security.py   # JWT, password hashing
│   │   └── dynamodb.py   # DynamoDB service
│   ├── schemas/          # Pydantic models
│   │   ├── user.py       # User request/response models
│   │   └── event.py      # Event request/response models
│   └── services/         # Business logic
│       └── dynamodb_auth_service.py
```

### Testing
- **Test File Naming**: `test_*.py` (pytest convention)
- **Test Organization**: Mirror the app structure
- **Mock External Services**: Mock AWS services (DynamoDB, S3, Rekognition)
- **Coverage**: Aim for >80% coverage on critical paths
- **Fixtures**: Use pytest fixtures for common test data

```python
# ✅ GOOD: Clear test name, arrange-act-assert pattern
def test_create_user_success():
    # Arrange
    user_data = {"email": "test@example.com", "name": "Test", "password": "pass123"}

    # Act
    user = create_user(**user_data)

    # Assert
    assert user is not None
    assert user.email == user_data["email"]
    assert user.hashed_password != user_data["password"]  # Should be hashed
```

### Environment Variables
- **Required Variables**: Must fail startup if missing (AWS credentials, SECRET_KEY)
- **Optional Variables**: Provide sensible defaults
- **Documentation**: Document all variables in `.env.example`
- **Never Use Defaults in Production**: Especially for secrets

## Frontend (Next.js/React/TypeScript)

### Code Style
- **TypeScript Strict**: Enable strict mode in `tsconfig.json`
- **ESLint**: Follow Next.js recommended rules
- **Prettier**: Use for consistent formatting
- **Line Length**: Max 100 characters
- **File Naming**:
  - Components: `PascalCase.tsx` (e.g., `UserNav.tsx`)
  - Utilities: `kebab-case.ts` (e.g., `format-date.ts`)
  - Pages: Next.js convention (e.g., `page.tsx`, `[id]/page.tsx`)

### Component Patterns

#### Server vs Client Components
```tsx
// ✅ GOOD: Use Server Components by default (no 'use client')
// app/dashboard/events/page.tsx
export default async function EventsPage() {
  // Can fetch data directly
  return <EventsList />
}

// ✅ GOOD: Only use 'use client' when needed (state, effects, event handlers)
// components/create-event-dialog.tsx
'use client'

import { useState } from 'react'

export function CreateEventDialog() {
  const [open, setOpen] = useState(false)
  // Component with interactivity
}
```

#### Type Safety
```tsx
// ✅ GOOD: Explicit types, interfaces for props
interface UserNavProps {
  user: User
  onLogout?: () => void
}

export function UserNav({ user, onLogout }: UserNavProps) {
  return (
    <div>
      <span>{user.name}</span>
      {onLogout && <button onClick={onLogout}>Logout</button>}
    </div>
  )
}

// ❌ BAD: Implicit any types
export function UserNav({ user, onLogout }) {
  return <div>{user.name}</div>
}
```

#### API Calls
```tsx
// ✅ GOOD: Use the ApiClient, handle errors, show loading states
'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import type { Event } from '@/lib/types'

export function EventsList() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEvents() {
      try {
        const data = await apiClient.getEvents()
        setEvents(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events')
        console.error('Error fetching events:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return <div>{/* Render events */}</div>
}

// ❌ BAD: Direct fetch, no error handling, no loading state
export function EventsList() {
  const [events, setEvents] = useState([])

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(setEvents)
  }, [])

  return <div>{events.map(e => <div key={e.id}>{e.name}</div>)}</div>
}
```

#### State Management
```tsx
// ✅ GOOD: Keep state close to where it's used
function EventForm() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  // Form state stays in form component
}

// ✅ GOOD: Lift state only when needed by multiple components
function EventPage() {
  const [event, setEvent] = useState<Event | null>(null)

  return (
    <>
      <EventHeader event={event} />
      <EventDetails event={event} />
      <EventParticipants event={event} />
    </>
  )
}
```

### File Organization
```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth route group
│   │   ├── login/
│   │   └── signup/
│   ├── dashboard/         # Protected dashboard routes
│   │   ├── events/
│   │   │   └── [id]/     # Dynamic event pages
│   │   └── profile/
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── *.tsx             # App-specific components
├── lib/                   # Utilities
│   ├── api.ts            # API client
│   ├── types.ts          # TypeScript types
│   └── utils.ts          # Helper functions
├── hooks/                 # Custom React hooks
└── ai/                    # Genkit AI flows
    └── flows/
```

### Styling
- **Tailwind CSS**: Use utility classes, avoid custom CSS when possible
- **Component Variants**: Use `class-variance-authority` for component variations
- **Responsive**: Mobile-first approach (`sm:`, `md:`, `lg:` breakpoints)
- **Dark Mode**: Support via shadcn/ui theming

```tsx
// ✅ GOOD: Tailwind utilities, responsive
<button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white sm:w-auto">
  Create Event
</button>

// ❌ BAD: Inline styles, not responsive
<button style={{width: '100%', padding: '8px 16px', backgroundColor: '#2563eb'}}>
  Create Event
</button>
```

## Data & API Design

### REST API Conventions
- **Use proper HTTP methods**: GET (read), POST (create), PATCH (update), DELETE (delete)
- **Plural nouns for collections**: `/api/v1/events`, `/api/v1/users`
- **Singular for single resource**: `/api/v1/events/{id}`
- **Nested resources**: `/api/v1/events/{id}/participants`
- **Query params for filtering**: `/api/v1/events?status=active&limit=10`

### Response Format
```json
// ✅ GOOD: Consistent structure
{
  "id": "uuid",
  "name": "Event Name",
  "created_at": "2025-03-02T10:00:00Z",
  "updated_at": "2025-03-02T10:00:00Z"
}

// ✅ GOOD: Error response
{
  "detail": {
    "message": "Event not found",
    "code": "EVENT_NOT_FOUND",
    "event_id": "invalid-id"
  }
}
```

### DynamoDB Access Patterns
- **Single Table Design**: All entities in `FaceShareData` table
- **Composite Keys**: Use meaningful PK/SK patterns (`USER#{id}`, `EVENT#{id}`)
- **GSIs for Queries**: Use GSI1 for alternate access patterns (email lookup, user's events)
- **Avoid Scans**: Always query with PK or GSI, never full table scans
- **Batch Operations**: Use batch_get/batch_write for multiple items

```python
# ✅ GOOD: Query with PK
participants = dynamodb_service.get_event_participants(event_id)

# ❌ BAD: Scan entire table
# Don't do full table scans in production!
```

## AWS Services

### S3 (Image Storage)
- **Presigned URLs**: Use for direct upload/download from client
- **Short expiration**: 1 hour for presigned URLs
- **Organized structure**: `users/{user_id}/face-profiles/{image_id}.jpg`
- **Lifecycle policies**: Consider auto-deletion of old temp files

### DynamoDB
- **Provisioned vs On-Demand**: Use on-demand for development, provisioned for production
- **Error Handling**: Handle `ConditionalCheckFailedException`, `ResourceNotFoundException`
- **Pagination**: Use `LastEvaluatedKey` for large result sets
- **Consistent Reads**: Use only when necessary (costs 2x)

### Rekognition / DeepFace
- **Face Detection**: Verify at least one face before processing
- **Similarity Threshold**: Current: 0.55 cosine distance (tune as needed)
- **Performance**: Use cached embeddings (SFace) for real-time matching
- **Privacy**: Delete face data when user requests account deletion

## Git & Version Control

### Commit Messages
```bash
# ✅ GOOD: Clear, imperative mood, describes what and why
git commit -m "Add event participant approval endpoint

Allows event owners to approve/reject join requests.
Uses PATCH /events/{id}/participants/{user_id}/approve"

# ❌ BAD: Vague, past tense
git commit -m "fixed stuff"
git commit -m "updated files"
```

### Branch Naming
- **Feature**: `feature/user-authentication`
- **Bug Fix**: `fix/event-date-validation`
- **Hotfix**: `hotfix/security-jwt-expiry`
- **Refactor**: `refactor/dynamodb-service`

### Pull Requests
- **Small PRs**: Keep under 400 lines when possible
- **Description**: What, why, how, testing steps
- **Link Issues**: Reference related issues/tickets
- **Tests**: Include tests for new features
- **Screenshots**: For UI changes

## Performance

### Backend
- **Database**: Minimize DynamoDB queries, use batch operations
- **Caching**: Consider caching frequently accessed data (Redis, in-memory)
- **Async**: Use `async/await` for I/O operations (DynamoDB, S3)
- **Background Jobs**: For long-running tasks (batch face scanning)

### Frontend
- **Code Splitting**: Use dynamic imports for large components
- **Image Optimization**: Use Next.js `<Image>` component
- **Lazy Loading**: Load images/components as needed
- **Bundle Size**: Monitor with `npm run build`, keep under 200KB for main bundle

```tsx
// ✅ GOOD: Lazy load heavy components
import dynamic from 'next/dynamic'

const FaceRecognitionViewer = dynamic(
  () => import('@/components/face-recognition-viewer'),
  { loading: () => <div>Loading...</div> }
)
```

## Accessibility (a11y)

- **Semantic HTML**: Use proper elements (`<button>`, `<nav>`, `<main>`)
- **ARIA Labels**: Add labels for screen readers
- **Keyboard Navigation**: All interactive elements accessible via keyboard
- **Color Contrast**: Minimum 4.5:1 for text
- **Alt Text**: Descriptive alt text for all images

```tsx
// ✅ GOOD: Accessible button
<button
  type="button"
  aria-label="Delete event"
  onClick={handleDelete}
  className="p-2 hover:bg-gray-100 rounded"
>
  <TrashIcon aria-hidden="true" />
</button>

// ❌ BAD: Icon-only button without label
<button onClick={handleDelete}>
  <TrashIcon />
</button>
```

## Documentation

### Code Comments
- **Why, not what**: Explain reasoning, not obvious code
- **Complex Logic**: Document algorithms, business rules
- **TODOs**: Use `// TODO:` for planned improvements
- **Warnings**: Use `// WARNING:` for gotchas

```python
# ✅ GOOD: Explains why
# We use cosine distance (not Euclidean) because it's scale-invariant
# and works better for high-dimensional face embeddings
similarity = cosine_distance(embedding1, embedding2)

# ❌ BAD: States the obvious
# Calculate similarity
similarity = cosine_distance(embedding1, embedding2)
```

### README Updates
- Update docs when adding major features
- Keep setup instructions current
- Document breaking changes
- Include troubleshooting section

## Deployment & DevOps

### Environment Separation
- **Development**: Local `.env`, permissive CORS
- **QA/Staging**: `.env.qa`, mirrors production config
- **Production**: `.env.prod`, strict security, monitoring

### Serverless Deployment
- **Lambda**: Package size < 50MB uncompressed
- **Cold Starts**: Use provisioned concurrency for critical endpoints
- **Timeout**: Set appropriate timeouts (max 900s for Lambda)
- **Environment Variables**: Inject via serverless.yml

### Monitoring
- **Logs**: CloudWatch for Lambda logs
- **Errors**: Track error rates, set up alerts
- **Performance**: Monitor response times, DynamoDB throttles
- **Costs**: Track AWS costs by service

## Common Pitfalls to Avoid

### Backend
- ❌ **Don't** store sensitive data in logs
- ❌ **Don't** use `SELECT *` equivalent (fetch all attributes) unless needed
- ❌ **Don't** hardcode file paths (use config/env variables)
- ❌ **Don't** return raw database errors to client
- ❌ **Don't** skip input validation ("trust the client")

### Frontend
- ❌ **Don't** store sensitive data in localStorage (except tokens)
- ❌ **Don't** mutate state directly (use setState/useState)
- ❌ **Don't** forget error boundaries for error handling
- ❌ **Don't** use `any` type (defeats TypeScript's purpose)
- ❌ **Don't** fetch data in loops (causes waterfalls)

### General
- ❌ **Don't** commit `.env` files
- ❌ **Don't** use `console.log` in production (use proper logging)
- ❌ **Don't** skip testing before deploying
- ❌ **Don't** ignore TypeScript/ESLint warnings
- ❌ **Don't** mix spaces and tabs

## Decision Making

### When to Add a Dependency
Ask yourself:
1. Does it solve a real problem we have?
2. Is it actively maintained?
3. What's the bundle size impact?
4. Can we implement it simply ourselves?
5. Is it widely used/trusted?

### When to Refactor
Refactor when:
- Code is duplicated 3+ times
- Function is >50 lines
- Logic is hard to understand/test
- Performance is measurably poor

Don't refactor:
- Just because it "looks better"
- Before understanding the code
- Without tests in place
- When under tight deadline

### When to Optimize
- **Premature optimization is the root of all evil** - Donald Knuth
- Measure first, optimize second
- Focus on bottlenecks, not everything
- Keep code readable > clever

## Resources

- [FastAPI Best Practices](https://github.com/zhanymkanov/fastapi-best-practices)
- [React Best Practices](https://react.dev/learn)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [AWS DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
