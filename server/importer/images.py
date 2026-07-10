"""
Safe image download + processing pipeline.

Every selected image is downloaded through the SSRF-safe client, verified
with Pillow (actual decode, not just extension/content-type), then stored in
our own media storage in three renditions:

    original  products/images/<name>.<ext>
    medium    products/images/<name>_medium.jpg   (max 800px)
    thumbnail products/images/<name>_thumb.jpg    (max 300px)

The original keeps its source format/quality; renditions are high-quality
JPEG resizes.
"""
import io
import logging
import os
import uuid
from datetime import datetime

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, UnidentifiedImageError

from .exceptions import ImageDownloadError
from .http_client import fetch_image, validate_public_url

logger = logging.getLogger('importer')

UPLOAD_FOLDER = 'products/images'
MEDIUM_MAX = 800
THUMB_MAX = 300
ALLOWED_FORMATS = {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp', 'GIF': '.gif'}
MAX_PIXELS = 40_000_000  # decompression-bomb guard


def download_product_images(urls, max_images=10):
    """Download and store up to ``max_images`` images.

    Returns (stored, errors) where stored is a list of dicts:
    {source_url, path, medium_path, thumb_path} — paths relative to MEDIA_ROOT.
    Never raises for individual failures; callers decide what is fatal.
    """
    stored = []
    errors = []
    for url in urls[:max_images]:
        try:
            stored.append(_download_single(url))
        except Exception as exc:
            logger.warning('Image download failed for %s: %s', url, exc)
            errors.append({'url': url, 'error': _friendly(exc)})
    return stored, errors


def _download_single(source_url):
    validate_public_url(source_url)
    body, content_type = fetch_image(source_url)
    if content_type and not content_type.split(';')[0].strip().startswith('image/'):
        raise ImageDownloadError(f'URL did not return an image ({content_type}).')

    try:
        probe = Image.open(io.BytesIO(body))
        probe.verify()  # detect truncated/corrupt files
        image = Image.open(io.BytesIO(body))  # verify() invalidates the object
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageDownloadError('The downloaded file is not a valid image.') from exc

    if image.format not in ALLOWED_FORMATS:
        raise ImageDownloadError(f'Unsupported image format: {image.format}.')
    if image.width * image.height > MAX_PIXELS:
        raise ImageDownloadError('The image is too large to process.')

    base_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    ext = ALLOWED_FORMATS[image.format]

    original_path = default_storage.save(
        os.path.join(UPLOAD_FOLDER, f'{base_name}{ext}').replace('\\', '/'),
        ContentFile(body),
    )
    medium_path = _save_rendition(image, base_name, 'medium', MEDIUM_MAX)
    thumb_path = _save_rendition(image, base_name, 'thumb', THUMB_MAX)

    return {
        'source_url': source_url,
        'path': original_path,
        'medium_path': medium_path,
        'thumb_path': thumb_path,
    }


def _save_rendition(image, base_name, suffix, max_side):
    rendition = image.copy()
    if rendition.mode not in ('RGB', 'L'):
        rendition = rendition.convert('RGB')
    rendition.thumbnail((max_side, max_side), Image.LANCZOS)
    buffer = io.BytesIO()
    rendition.save(buffer, format='JPEG', quality=88, optimize=True)
    path = os.path.join(UPLOAD_FOLDER, f'{base_name}_{suffix}.jpg').replace('\\', '/')
    return default_storage.save(path, ContentFile(buffer.getvalue()))


def _friendly(exc):
    from .exceptions import ImporterError
    if isinstance(exc, ImporterError):
        return exc.message
    return 'Download failed.'
