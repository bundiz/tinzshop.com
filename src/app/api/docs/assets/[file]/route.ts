import { getApiDocsHandlers } from '@/server/composition-root';

// The two allow-listed Swagger UI files from the pinned swagger-ui-dist. Development only (D-115).
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await context.params;
  return getApiDocsHandlers().asset(file);
}
