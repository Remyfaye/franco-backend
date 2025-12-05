export const runtime = "nodejs";

import argon2 from "argon2";
import { NextResponse } from "next/server";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function handleResponse(
  status: number,
  msg: string | unknown,
  data?: unknown
) {
  console.log("result:", msg);
  return NextResponse.json({ status, message: msg, data }, { status: status });
}

export function getEnvVariable(variable: string) {
  if (!variable) {
    throw new Error(`${variable} does not exist`);
  }
  return variable;
}

export function handleCatch(error: unknown) {
  console.log("An error occurred:", error);

  if (error instanceof Error) {
    return handleResponse(500, error.message);
  }

  return handleResponse(500, String(error));
}
