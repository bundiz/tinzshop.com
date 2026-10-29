import { describe, expect, it, vi } from "vitest";

import { createCatalogueCategoriseJobHandler } from "./catalogue-categorise-controller";

const SECRET = "test-job-secret-0123456789abcdef-xyz";
const URL = "http://localhost:3000/api/jobs/catalogue-categorise";

function setup(isProduction = false) {
  const categorise = vi.fn(async () => ({ categorised: 4, skipped: 2 }));
  const handler = createCatalogueCategoriseJobHandler({
    isProduction,
    jobSecret: () => SECRET,
    categorise,
  });
  return {
    categorise,
    call: (authorization?: string) =>
      handler(
        new Request(URL, {
          method: "POST",
          headers:
            authorization === undefined ? {} : { Authorization: authorization },
        }),
      ),
  };
}

describe("createCatalogueCategoriseJobHandler", () => {
  it("answers 404 in production, even with the right secret, without categorising", async () => {
    const { categorise, call } = setup(true);
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(categorise).not.toHaveBeenCalled();
  });

  it("refuses a missing or wrong secret", async () => {
    const { categorise, call } = setup();

    const missing = await call();
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({
      error: {
        code: "auth.unauthorized",
        messageKey: "error.auth.unauthorized",
      },
    });
    expect((await call("Bearer short")).status).toBe(401);
    expect((await call(`Bearer ${"x".repeat(SECRET.length)}`)).status).toBe(
      401,
    );
    expect(categorise).not.toHaveBeenCalled();
  });

  it("categorises and answers the counts", async () => {
    const { categorise, call } = setup();
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ categorised: 4, skipped: 2 });
    expect(categorise).toHaveBeenCalledOnce();
  });
});
