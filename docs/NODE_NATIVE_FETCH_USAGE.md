# Native Fetch API in Node.js

## Overview

The Fetch API is a modern, promise-based interface for making HTTP requests. Originally introduced in web browsers, it has been natively supported in Node.js since version 18.0.0 (released in April 2022). The implementation is provided by **Undici**, a high-performance HTTP/1.1 and HTTP/2 client written in JavaScript and maintained as part of the Node.js core project.

Native `fetch` exposes the global `fetch` function as well as the full WHATWG Fetch standard types: `Request`, `Response`, `Headers`, `AbortController`, etc. It is stable, enabled by default, and requires no experimental flags in Node.js 18 and later.

## Supported Versions

- **Stable and default**: Node.js ≥ 18.0.0
- As of January 2026, the current LTS versions (20.x, 22.x) and active releases all include mature, production-ready native fetch.

## Why Use Native Fetch

- Zero additional dependencies
- Significantly better performance than older polyfills
- Close alignment with the browser Fetch standard
- Built-in support for HTTP/2, connection pooling, and modern TLS
- Actively maintained and secured by the Node.js core team

## Critical Remarks

**NEVER** install or use `node-fetch` or any other third-party fetch polyfill/library (axios, got, ky, etc.) in projects running on Node.js 18 or higher. The native implementation outperforms all of them, has fewer bugs, receives security updates directly from Node.js core, and eliminates unnecessary package bloat.

**NEVER** fall back to the low-level `node:http` or `node:https` modules for routine HTTP requests. Those modules are intended for advanced use cases (e.g., implementing servers or custom protocols). For standard client-side requests, `fetch` provides a cleaner, more ergonomic, and less error-prone API.

Using third-party libraries or the http module defeats the purpose of having a modern standard built into the runtime.

## Using Native Fetch with TypeScript

### TypeScript Configuration

To get proper type definitions for `fetch`, `Request`, `Response`, etc.:

1. Use a recent version of `@types/node` (≥ 18).
2. In your `tsconfig.json`, ensure you are targeting a modern ECMAScript version and include the DOM library (which contains the Fetch types).

Recommended minimal `compilerOptions`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2022", "dom"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Including `"dom"` in `lib` provides the full WHATWG Fetch typings without conflicts in Node.js projects.

### Basic Examples

#### Simple GET Request

```typescript
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// Usage
interface User {
  id: number;
  name: string;
  email: string;
}

async function example() {
  try {
    const user = await getJson<User>('https://api.example.com/users/123');
    console.log(user);
  } catch (err) {
    console.error('Request failed:', err);
  }
}

example();
```

#### POST Request with JSON Body

```typescript
interface CreatePostPayload {
  title: string;
  body: string;
}

interface PostResponse {
  id: number;
  title: string;
  body: string;
}

async function createPost(payload: CreatePostPayload): Promise<PostResponse> {
  const response = await fetch('https://api.example.com/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Add authorization headers if needed
      // 'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create post: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<PostResponse>;
}

// Usage
createPost({ title: 'Hello', body: 'World' })
  .then(post => console.log('Created:', post))
  .catch(err => console.error(err));
```

#### Request with Timeout (AbortController)

```typescript
async function fetchWithTimeout(url: string, timeoutMs: number = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
```

#### Streaming Response (for large payloads)

```typescript
async function downloadLargeFile(url: string, destinationPath: string) {
  const response = await fetch(url);

  if (!response.ok || !response.body) {
    throw new Error('Failed to get readable stream');
  }

  const fs = require('node:fs');
  const writer = fs.createWriteStream(destinationPath);

  // response.body is a Node.js ReadableStream
  await require('node:stream').pipeline(response.body, writer);
}
```

## Key Differences from Browser Fetch

- No `Blob` type (use `ArrayBuffer` or convert to `Buffer`)
- No automatic cookie jar
- `response.body` is a Node.js `ReadableStream` (can be piped directly)
- Full support for HTTP/2 when the server supports it

## Conclusion

In modern Node.js (18+), the native Fetch API is the canonical, recommended way to perform HTTP client requests. It is fast, standards-compliant, and requires no extra dependencies. Always prefer it over any third-party alternative or the legacy `http` module.
