import { NextResponse } from "next/server";

// Keep old showcase bookmarks useful without serving a public logo page.
// This route matches only /brand; /brand/* continues to serve app assets.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/landing", request.url), 308);
}
