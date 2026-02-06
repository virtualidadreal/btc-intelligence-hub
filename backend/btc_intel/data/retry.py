"""Retry utility — Exponential backoff for HTTP requests."""

import asyncio
import time

import httpx
from rich.console import Console

console = Console()

MAX_RETRIES = 3
BASE_DELAY = 1  # seconds — delays: 1s, 2s, 4s


async def async_get_with_retry(
    client: httpx.AsyncClient,
    url: str,
    *,
    max_retries: int = MAX_RETRIES,
    base_delay: float = BASE_DELAY,
) -> httpx.Response:
    """Async HTTP GET with exponential backoff retry.

    Retries on connection errors and 5xx status codes.
    Delays: 1s, 2s, 4s (exponential backoff).
    """
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            resp = await client.get(url)

            # Retry on server errors (5xx)
            if resp.status_code >= 500 and attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                console.print(
                    f"  [yellow]HTTP {resp.status_code} — reintentando en {delay}s "
                    f"(intento {attempt + 1}/{max_retries})[/yellow]"
                )
                await asyncio.sleep(delay)
                continue

            resp.raise_for_status()
            return resp

        except (httpx.ConnectError, httpx.TimeoutException, httpx.ReadTimeout) as e:
            last_exception = e
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                console.print(
                    f"  [yellow]{type(e).__name__} — reintentando en {delay}s "
                    f"(intento {attempt + 1}/{max_retries})[/yellow]"
                )
                await asyncio.sleep(delay)
            else:
                raise

        except httpx.HTTPStatusError:
            # Non-5xx errors (4xx) should not be retried
            raise

    # Should not reach here, but just in case
    if last_exception:
        raise last_exception
    raise httpx.RequestError(f"Failed after {max_retries} retries", request=None)


def sync_get_with_retry(
    url: str,
    *,
    timeout: float = 30,
    max_retries: int = MAX_RETRIES,
    base_delay: float = BASE_DELAY,
) -> httpx.Response:
    """Sync HTTP GET with exponential backoff retry.

    For use in non-async contexts.
    """
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            resp = httpx.get(url, timeout=timeout)

            if resp.status_code >= 500 and attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                console.print(
                    f"  [yellow]HTTP {resp.status_code} — reintentando en {delay}s "
                    f"(intento {attempt + 1}/{max_retries})[/yellow]"
                )
                time.sleep(delay)
                continue

            resp.raise_for_status()
            return resp

        except (httpx.ConnectError, httpx.TimeoutException, httpx.ReadTimeout) as e:
            last_exception = e
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                console.print(
                    f"  [yellow]{type(e).__name__} — reintentando en {delay}s "
                    f"(intento {attempt + 1}/{max_retries})[/yellow]"
                )
                time.sleep(delay)
            else:
                raise

        except httpx.HTTPStatusError:
            raise

    if last_exception:
        raise last_exception
    raise httpx.RequestError(f"Failed after {max_retries} retries", request=None)
