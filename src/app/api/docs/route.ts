import { getApiDocsHandlers } from '@/server/composition-root';

// Swagger UI for docs/openapi.yaml. Development only: 404 in production (D-115).
export async function GET(): Promise<Response> {
  return getApiDocsHandlers().page();
}
