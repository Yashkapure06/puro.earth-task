import type { Express } from "express";
import request from "supertest";

export type InjectOptions = {
  method: "GET" | "POST" | "PATCH";
  url: string;
  cookies?: Record<string, string>;
  payload?: unknown;
};

export type InjectCookie = {
  name: string;
  value: string;
};

export type InjectResponse = {
  statusCode: number;
  json: () => Record<string, unknown>;
  cookies: InjectCookie[];
};

function parseSetCookie(
  header: string | string[] | undefined,
): InjectCookie[] {
  const list = header == null ? [] : Array.isArray(header) ? header : [header];
  return list.map((entry) => {
    const pair = entry.split(";", 1)[0] ?? "";
    const separator = pair.indexOf("=");
    if (separator < 0) {
      return { name: pair.trim(), value: "" };
    }
    const rawValue = pair.slice(separator + 1).trim();
    let value = rawValue;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      value = rawValue;
    }
    return {
      name: pair.slice(0, separator).trim(),
      value,
    };
  });
}

function dispatch(app: Express, method: InjectOptions["method"], url: string) {
  const agent = request(app);
  switch (method) {
    case "GET":
      return agent.get(url);
    case "POST":
      return agent.post(url);
    case "PATCH":
      return agent.patch(url);
    default: {
      const _exhaustive: never = method;
      throw new Error(`Unsupported test HTTP method: ${_exhaustive}`);
    }
  }
}

/**
 * Hit `buildApp()` with SuperTest. Tests never call `listen()`.
 * Cookie header is set from a plain map so login can be reused.
 */
export async function inject(
  app: Express,
  options: InjectOptions,
): Promise<InjectResponse> {
  let req = dispatch(app, options.method, options.url);

  if (options.cookies) {
    const header = Object.entries(options.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    req = req.set("Cookie", header);
  }

  if (options.payload !== undefined) {
    req = req.send(options.payload);
  }

  const response = await req;
  const body = response.body as Record<string, unknown> | string;
  return {
    statusCode: response.status,
    json: () => (body && typeof body === "object" ? body : {}),
    cookies: parseSetCookie(response.headers["set-cookie"]),
  };
}
