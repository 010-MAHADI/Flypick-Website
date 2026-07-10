"""
SSRF-safe HTTP client used for every outbound request the import engine makes.

Guarantees:
- only http/https URLs are fetched
- hostnames resolving to private / loopback / link-local / reserved ranges are
  rejected, and every redirect hop is re-validated
- responses are size-capped and time-limited
- transient failures are retried with backoff
"""
import ipaddress
import logging
import socket
import time
from urllib.parse import urlparse, urljoin

import requests

from .exceptions import (
    BlockedRequestError,
    BlockedUrlError,
    ConnectionTimeoutError,
    FetchError,
    InvalidUrlError,
    ProductNotFoundError,
)

logger = logging.getLogger('importer')

DEFAULT_TIMEOUT = (10, 20)          # (connect, read) seconds
MAX_REDIRECTS = 5
MAX_HTML_BYTES = 5 * 1024 * 1024    # 5 MB page cap
MAX_IMAGE_BYTES = 15 * 1024 * 1024  # 15 MB image cap
RETRY_ATTEMPTS = 3
RETRY_BACKOFF = 1.5
RETRYABLE_STATUSES = {429, 500, 502, 503, 504}

BROWSER_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
    'Cache-Control': 'no-cache',
}


def validate_public_url(url):
    """Validate scheme/host and ensure the host resolves only to public IPs.

    Returns the parsed URL. Raises InvalidUrlError / BlockedUrlError.
    """
    if not url or not isinstance(url, str):
        raise InvalidUrlError()
    url = url.strip()
    if len(url) > 2000:
        raise InvalidUrlError('The URL is too long.')

    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        raise InvalidUrlError()
    if not parsed.hostname:
        raise InvalidUrlError()
    if parsed.username or parsed.password:
        raise BlockedUrlError('URLs with embedded credentials are not allowed.')
    if parsed.port and parsed.port not in (80, 443, 8080, 8443):
        raise BlockedUrlError('Only standard web ports are allowed.')

    hostname = parsed.hostname
    if hostname.lower() in ('localhost',):
        raise BlockedUrlError()

    try:
        addr_info = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == 'https' else 80),
                                       proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise InvalidUrlError('The website address could not be resolved.')

    for info in addr_info:
        ip = ipaddress.ip_address(info[4][0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast
                or ip.is_reserved or ip.is_unspecified):
            raise BlockedUrlError()
    return parsed


def _request(method, url, *, stream=False, timeout=DEFAULT_TIMEOUT, headers=None):
    """Single validated request following redirects manually with re-validation."""
    current_url = url
    merged_headers = dict(BROWSER_HEADERS)
    if headers:
        merged_headers.update(headers)

    for _ in range(MAX_REDIRECTS + 1):
        validate_public_url(current_url)
        response = requests.request(
            method,
            current_url,
            headers=merged_headers,
            timeout=timeout,
            stream=stream,
            allow_redirects=False,
        )
        if response.status_code in (301, 302, 303, 307, 308):
            location = response.headers.get('Location')
            response.close()
            if not location:
                raise FetchError('The website returned a broken redirect.')
            current_url = urljoin(current_url, location)
            continue
        return response, current_url
    raise BlockedUrlError('Too many redirects.')


def _read_capped(response, max_bytes):
    chunks = []
    total = 0
    for chunk in response.iter_content(chunk_size=64 * 1024):
        total += len(chunk)
        if total > max_bytes:
            response.close()
            raise FetchError('The response is too large to import.')
        chunks.append(chunk)
    return b''.join(chunks)


def _fetch_with_retries(url, *, max_bytes, accept=None, extra_headers=None):
    last_error = None
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            headers = dict(extra_headers or {})
            if accept:
                headers['Accept'] = accept
            response, final_url = _request('GET', url, stream=True, headers=headers or None)
            if response.status_code in RETRYABLE_STATUSES:
                response.close()
                last_error = BlockedRequestError(
                    f'The website responded with HTTP {response.status_code}.'
                )
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(RETRY_BACKOFF ** attempt)
                continue
            if response.status_code == 404:
                response.close()
                raise ProductNotFoundError()
            if response.status_code in (401, 403):
                response.close()
                raise BlockedRequestError()
            if response.status_code >= 400:
                response.close()
                raise FetchError(f'The website responded with HTTP {response.status_code}.')
            body = _read_capped(response, max_bytes)
            content_type = response.headers.get('Content-Type', '')
            response.close()
            return body, content_type, final_url
        except (requests.Timeout,):
            last_error = ConnectionTimeoutError()
        except requests.ConnectionError:
            last_error = FetchError('Could not connect to the website.')
        if attempt < RETRY_ATTEMPTS:
            time.sleep(RETRY_BACKOFF ** attempt)
    raise last_error or FetchError()


def fetch_html(url, extra_headers=None):
    """Fetch a product page. Returns (html_text, final_url)."""
    body, content_type, final_url = _fetch_with_retries(
        url, max_bytes=MAX_HTML_BYTES, extra_headers=extra_headers)
    if 'text/html' not in content_type and 'application/xhtml' not in content_type and content_type:
        # Some stores omit or mislabel content type; only hard-fail on obvious non-pages
        if content_type.split(';')[0].strip() in ('application/pdf', 'application/octet-stream'):
            raise FetchError('The URL does not point to a web page.')
    encoding = 'utf-8'
    if 'charset=' in content_type:
        encoding = content_type.split('charset=')[-1].split(';')[0].strip() or 'utf-8'
    try:
        return body.decode(encoding, errors='replace'), final_url
    except LookupError:
        return body.decode('utf-8', errors='replace'), final_url


def fetch_image(url):
    """Fetch an image. Returns (bytes, content_type). Size and type capped."""
    headers_accept = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
    body, content_type, _ = _fetch_with_retries(url, max_bytes=MAX_IMAGE_BYTES, accept=headers_accept)
    return body, content_type
