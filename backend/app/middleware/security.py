import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from loguru import logger


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to all responses and logs requests."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()

        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(self)"
        )
        # HSTS: only meaningful on HTTPS — browsers ignore it on plain HTTP,
        # so it's safe to send always. 1 year + subdomains is the Google /
        # OWASP-recommended baseline.
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        # CSP: 'unsafe-inline' stays because Next.js inlines small bootstrap
        # scripts and CSS-in-JS chunks. 'unsafe-eval' is intentionally NOT
        # listed — production Next builds don't need eval, and including it
        # widens the XSS blast radius significantly. Google Identity Services
        # is allowlisted under script/frame/connect-src for the sign-in flow.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' "
            "https://js.stripe.com "
            "https://accounts.google.com https://apis.google.com; "
            "style-src 'self' 'unsafe-inline' https://accounts.google.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' "
            "https://api.stripe.com "
            "https://accounts.google.com https://oauth2.googleapis.com; "
            "frame-src https://js.stripe.com https://hooks.stripe.com "
            "https://accounts.google.com; "
            "font-src 'self' data:;"
        )

        # Request logging — skip the health probe (every 10–30 s on most
        # PaaS deploys, would generate thousands of log lines a day per
        # pod with zero diagnostic value).
        if request.url.path != "/api/health":
            duration_ms = (time.time() - start_time) * 1000
            logger.info(
                "{method} {path} {status} {duration:.0f}ms",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration=duration_ms,
            )

        return response
