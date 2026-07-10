"""
Import engine orchestrator.

    detect -> (cache?) -> fetch -> parse -> normalize -> enrich

The engine is importer-agnostic: adding a website never requires changes
here, only a new importer registered in ``importers/__init__.py``.
"""
import hashlib
import logging
import time

from django.core.cache import cache

from .enrichment import enrich_product
from .exceptions import ImporterError, ParsingError
from .http_client import validate_public_url
from .importers import get_importer_for
from .models import ImportJob

logger = logging.getLogger('importer')

PREVIEW_CACHE_SECONDS = 15 * 60


def run_import(url, user=None, use_cache=True):
    """Run a full import for ``url`` and return the normalized product dict.

    Raises ImporterError subclasses with user-friendly messages; every attempt
    is recorded as an ImportJob.
    """
    job = ImportJob.objects.create(url=url[:2000], stage='preview', requested_by=user)
    started = time.monotonic()
    logger.info('Import started: %s (job %s)', url, job.id)

    try:
        validate_public_url(url)
        importer = get_importer_for(url)
        job.source_site = importer.site_key
        logger.info('Website detected: %s -> %s', url, importer.site_name)

        cache_key = _cache_key(url)
        if use_cache:
            cached = cache.get(cache_key)
            if cached:
                logger.info('Import served from cache: %s', url)
                _finish(job, started, 'success', summary=_summary(cached))
                return cached

        html, final_url = importer.fetch(url)
        try:
            raw = importer.parse(html, final_url)
            product = importer.normalize(raw, html, final_url)
        except ImporterError:
            raise
        except Exception as exc:
            logger.exception('Parsing error for %s', url)
            raise ParsingError(detail=str(exc)) from exc

        product = enrich_product(product, categories=_active_categories())
        result = product.to_dict()
        cache.set(cache_key, result, PREVIEW_CACHE_SECONDS)

        _finish(job, started, 'success', summary=_summary(result))
        logger.info('Import success: %s — "%s" (job %s)', url, result.get('title', '')[:80], job.id)
        return result

    except ImporterError as exc:
        _finish(job, started, 'failed', error=exc)
        logger.warning('Import failed: %s [%s] %s', url, exc.code, exc.message)
        raise
    except Exception as exc:
        wrapped = ImporterError(detail=str(exc))
        _finish(job, started, 'failed', error=wrapped)
        logger.exception('Unexpected import failure for %s', url)
        raise wrapped from exc


def _active_categories():
    from products.models import Category
    return list(Category.objects.filter(is_active=True).values_list('id', 'name'))


def _cache_key(url):
    return 'importer:preview:' + hashlib.sha256(url.encode('utf-8')).hexdigest()


def _summary(result):
    return {
        'title': result.get('title', '')[:120],
        'price': result.get('price', ''),
        'currency': result.get('currency', ''),
        'images': len(result.get('gallery', [])),
        'specs': len(result.get('specifications', [])),
        'warnings': result.get('warnings', []),
    }


def _finish(job, started, status, *, summary=None, error=None):
    job.status = status
    job.duration_ms = int((time.monotonic() - started) * 1000)
    if summary:
        job.result_summary = summary
    if error:
        job.error_code = error.code
        job.error_message = error.message
    job.save()
