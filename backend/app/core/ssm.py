"""
SSM Parameter Store utility with an in-process TTL cache.

Parameters are refreshed at most every TTL_SECONDS (default 300 s / 5 min).
This means a change you make in the AWS Console takes effect on the next
Lambda invocation after the cache expires — no redeploy needed.

Usage:
    from app.core.ssm import get_parameter
    value = get_parameter("/faceshare/image_quality", default="optimized")
"""
import logging
import os
import time

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

TTL_SECONDS = 300  # 5 minutes

# Module-level cache: { param_name: {"value": str, "expires_at": float} }
_cache: dict[str, dict] = {}


def _ssm_client():
    region = os.environ.get("AWS_REGION", "us-east-1")
    session_token = os.environ.get("AWS_SESSION_TOKEN")
    if session_token:
        # Lambda STS credentials — use default chain so session token is included
        return boto3.client("ssm", region_name=region)
    # Local dev — explicit credentials from environment
    return boto3.client(
        "ssm",
        region_name=region,
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    )


def get_parameter(name: str, default: str = "") -> str:
    """
    Fetch an SSM SecureString or String parameter, with a 5-minute local cache.
    Returns *default* if the parameter does not exist or SSM is unreachable.
    """
    now = time.monotonic()
    cached = _cache.get(name)
    if cached and now < cached["expires_at"]:
        return cached["value"]

    try:
        client = _ssm_client()
        response = client.get_parameter(Name=name, WithDecryption=True)
        value = response["Parameter"]["Value"]
        logger.debug("[ssm] fetched %s = %r", name, value)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "ParameterNotFound":
            logger.warning("[ssm] parameter %s not found — using default %r", name, default)
        else:
            logger.error("[ssm] error fetching %s (%s) — using default %r", name, code, default)
        value = default
    except Exception as e:
        logger.error("[ssm] unexpected error fetching %s: %s — using default %r", name, e, default)
        value = default

    _cache[name] = {"value": value, "expires_at": now + TTL_SECONDS}
    return value
