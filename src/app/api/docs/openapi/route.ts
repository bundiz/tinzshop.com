import { getApiDocsHandlers } from '@/server/composition-root';

// docs/openapi.yaml as served to Swagger UI. Development only (D-115).
export async function GET(): Promise<Response> {
  return getApiDocsHandlers().spec();
}
