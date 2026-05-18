"""Job status + result download endpoints.

Pair with ``backend/app/jobs.py`` (queue helpers) and
``backend/app/worker.py`` (worker process). Routes here are sync, hit
Redis directly to read job state, and stream result bytes back.

Auth: callers must be logged in. The current implementation does NOT
check that the job_id was created by the caller — assumes the
opaque uuid4 is unguessable enough to serve as the access control
mechanism. Tighten by namespacing keys with `user_id` if this becomes
a concern.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from ..auth import get_current_user
from ..jobs import JobQueueUnavailable, fetch_result_bytes, get_status
from ..models.user import User

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/{job_id}/status")
def job_status(job_id: str, _current_user: User = Depends(get_current_user)):
    """Poll for job completion. Returns:

    - ``{"status": "queued"}``
    - ``{"status": "running"}``
    - ``{"status": "done", "result_url": "/api/jobs/{id}/download"}``
    - ``{"status": "failed", "error": "..."}``
    - ``{"status": "unknown"}`` if the job_id is unrecognised (expired
      after 1h TTL, or never existed).

    Frontend polls every 2 s; on "done", redirect to ``result_url`` to
    fetch the artifact.
    """
    try:
        return get_status(job_id)
    except JobQueueUnavailable:
        # Queue isn't configured on this deploy — surface 503 so the
        # frontend can fall back to the legacy synchronous endpoint.
        raise HTTPException(
            status_code=503, detail="Job queue is not configured on this server."
        )


@router.get("/{job_id}/download")
def job_download(job_id: str, _current_user: User = Depends(get_current_user)):
    """Stream the artifact bytes (PDF, CSV, etc.) for a completed job.

    404 if the job hasn't finished yet, expired, or doesn't exist.
    The response carries the right ``Content-Type`` + ``Content-Disposition``
    so the browser saves the file with its original name.
    """
    try:
        result = fetch_result_bytes(job_id)
    except JobQueueUnavailable:
        raise HTTPException(status_code=503, detail="Job queue is not configured.")

    if result is None:
        raise HTTPException(status_code=404, detail="Job result not found or expired.")

    payload, content_type, filename = result
    return Response(
        content=payload,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
