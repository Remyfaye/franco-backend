import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth-token");

  console.log("🔍 [debug] All cookies:", cookieStore.getAll());
  console.log("🔍 [debug] Auth token cookie:", authToken);
  console.log(
    "🔍 [debug] Authorization header:",
    request.headers.get("authorization")
  );

  return NextResponse.json({
    cookies: cookieStore.getAll(),
    authToken: authToken ? "***" + authToken.value.slice(-10) : "none",
    authorizationHeader: request.headers.get("authorization"),
    url: request.url,
  });
}
