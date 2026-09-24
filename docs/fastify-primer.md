# Fastify primer

Fastify is the Node.js web framework that turns FinPilot's TypeScript functions
into an HTTP API. It receives each request, routes it to the right handler,
validates input, runs the handler and serialises the JSON response.

## A route in FinPilot

From `apps/api/src/routes/health.ts`:

```ts
app.get(
  '/health',
  {
    schema: {
      response: { 200: healthResponseSchema }, // shape the reply must have
    },
  },
  async () => {
    const dbUp = await pingDb(app.db);
    return { status: dbUp ? 'ok' : 'degraded' /* ... */ };
  },
);
```

"When a request arrives on this URL, run this function and send back what it
returns."

## How a request flows

```
browser ──HTTP──▶ Fastify
                   1. assign request ID (x-request-id), log the request
                   2. match URL to a route
                   3. validate params/query/body against the Zod schema
                        └─ invalid → 400 with details, handler never runs
                   4. run the handler (queries PostgreSQL via Kysely)
                   5. serialise the result against the response schema
                   6. log status + response time, return JSON
```

## Why it suits this project

| Assignment requirement | Fastify feature used                                        |
| ---------------------- | ----------------------------------------------------------- |
| Input validation       | Zod schema per route (`fastify-type-provider-zod`)          |
| OpenAPI / Swagger      | `@fastify/swagger` generates the spec from the same schemas |
| Structured logging     | Built-in pino logger, JSON in production, pretty in dev     |
| Request correlation    | `requestIdHeader` / `genReqId`, echoed as `x-request-id`    |
| Versioned API          | Routes registered under the `/api/v1` prefix                |
| Testability            | `app.inject()` runs requests in-process without a real port |

Comparison with Express: see `DECISIONS.md` (D1).
