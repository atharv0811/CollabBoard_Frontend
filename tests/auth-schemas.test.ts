import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginSchema, registerSchema } from "../src/features/auth/schemas/authSchemas.ts";

function issuesByField(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const out: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) out[String(issue.path[0])] ??= issue.message;
  return out;
}

describe("loginSchema", () => {
  it("accepts a valid login and trims the email", () => {
    const result = loginSchema.safeParse({ email: "  ada@example.com ", password: " pw " });
    assert.ok(result.success);
    assert.equal(result.data.email, "ada@example.com");
    assert.equal(result.data.password, " pw ", "passwords are never trimmed");
  });

  it("requires email and password", () => {
    const errors = issuesByField(loginSchema.safeParse({ email: "", password: "" }));
    assert.equal(errors.email, "Enter your email.");
    assert.equal(errors.password, "Enter your password.");
  });

  it("rejects a malformed email", () => {
    const errors = issuesByField(loginSchema.safeParse({ email: "not-an-email", password: "x" }));
    assert.equal(errors.email, "Enter a valid email address.");
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "analytical",
    confirmPassword: "analytical",
  };

  it("accepts a valid registration", () => {
    assert.ok(registerSchema.safeParse(valid).success);
  });

  it("requires a non-blank name", () => {
    assert.equal(issuesByField(registerSchema.safeParse({ ...valid, name: "   " })).name, "Enter your full name.");
  });

  it("enforces the minimum password length", () => {
    const errors = issuesByField(registerSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" }));
    assert.equal(errors.password, "Use at least 8 characters.");
  });

  it("reports mismatched passwords on confirmPassword", () => {
    const errors = issuesByField(registerSchema.safeParse({ ...valid, confirmPassword: "different" }));
    assert.deepEqual(Object.keys(errors), ["confirmPassword"]);
    assert.equal(errors.confirmPassword, "Passwords don't match.");
  });

  it("requires the confirmation", () => {
    const errors = issuesByField(registerSchema.safeParse({ ...valid, confirmPassword: "" }));
    assert.equal(errors.confirmPassword, "Confirm your password.");
  });
});
