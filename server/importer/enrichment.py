"""
Post-extraction processing ("AI layer").

Deterministic pipeline that cleans and enriches the normalized product:
SEO metadata, URL slug, auto tags, category suggestion, spec de-duplication,
highlight detection and a short summary. ``AIEnhancer`` is the extension
point for plugging an LLM in later (Bangla descriptions, FAQ, etc.) without
touching the engine.
"""
import re

from django.utils.text import slugify

from .schema import NormalizedProduct

STOPWORDS = {
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'you',
    'your', 'has', 'have', 'not', 'but', 'all', 'can', 'will', 'new', 'hot',
    'sale', 'free', 'shipping', 'pcs', 'set', 'high', 'quality', 'original',
    'per', 'pack', 'piece', 'pieces', 'item', 'items', 'product', 'products',
}


class AIEnhancer:
    """Override ``enhance(product)`` to plug an LLM into the pipeline."""

    def enhance(self, product: NormalizedProduct) -> NormalizedProduct:
        return product


def enrich_product(product: NormalizedProduct, categories=None, enhancer: AIEnhancer = None) -> NormalizedProduct:
    """Run the full enrichment pipeline. ``categories`` is an iterable of
    (id, name) tuples used for category suggestion."""
    product.title = clean_title(product.title)
    product.short_description = product.short_description or make_summary(product)
    product.specifications = dedupe_specifications(product.specifications)
    product.highlights = product.highlights or detect_highlights(product)
    product.tags = product.tags or generate_tags(product)

    product.seo_title = product.seo_title or make_seo_title(product)
    product.seo_description = product.seo_description or make_seo_description(product)
    product.slug = product.slug or slugify(product.title)[:80]

    if categories:
        suggestion = suggest_category(product, categories)
        if suggestion:
            product.suggested_category_id, product.suggested_category = suggestion

    if enhancer:
        product = enhancer.enhance(product)
    return product


def clean_title(title):
    """Collapse whitespace and strip marketplace noise from titles."""
    title = re.sub(r'\s+', ' ', title or '').strip()
    title = re.sub(r'^\s*(hot sale|new arrival|free shipping)[!\s:-]*', '', title, flags=re.I)
    return title[:255]


def make_summary(product):
    text = product.description_text or ''
    for paragraph in text.split('\n'):
        paragraph = paragraph.strip()
        if len(paragraph) >= 40:
            return _truncate_sentence(paragraph, 300)
    if product.highlights:
        return _truncate_sentence('. '.join(product.highlights[:3]), 300)
    return _truncate_sentence(text, 300)


def dedupe_specifications(specs):
    seen = {}
    for spec in specs or []:
        key = str(spec.get('key', '')).strip()
        value = str(spec.get('value', '')).strip()
        if not key or not value:
            continue
        fingerprint = key.lower()
        if fingerprint not in seen:
            seen[fingerprint] = {'key': key, 'value': value}
    return list(seen.values())


def detect_highlights(product):
    """Pull bullet-like lines out of the description as selling points."""
    highlights = []
    for line in (product.description_text or '').split('\n'):
        line = line.strip().lstrip('•-*✓ ').strip()
        if 20 <= len(line) <= 120 and not line.endswith(':'):
            highlights.append(line)
        if len(highlights) >= 6:
            break
    return highlights


def generate_tags(product):
    """Keyword tags from title + brand + category trail."""
    corpus = ' '.join([product.title, product.brand] + product.category_path)
    words = re.findall(r'[A-Za-z][A-Za-z0-9+-]{2,}', corpus)
    tags = []
    for word in words:
        lowered = word.lower()
        if lowered in STOPWORDS or lowered in (t.lower() for t in tags):
            continue
        tags.append(word if word.isupper() else word.capitalize())
        if len(tags) >= 10:
            break
    return tags


def make_seo_title(product):
    parts = [product.title[:50]]
    if product.brand and product.brand.lower() not in product.title.lower():
        parts.append(product.brand)
    return _truncate_sentence(' | '.join(parts), 60)


def make_seo_description(product):
    base = product.short_description or product.description_text or product.title
    base = re.sub(r'\s+', ' ', base).strip()
    if product.price:
        suffix = f' Buy now at {product.currency} {product.price}.'
        if len(base) + len(suffix) <= 160:
            return base[:160 - len(suffix)] + suffix
    return _truncate_sentence(base, 160)


def suggest_category(product, categories):
    """Score our own categories against the source breadcrumb, title and specs."""
    haystack = ' '.join(
        [product.title] + product.category_path + [s['key'] + ' ' + s['value'] for s in product.specifications[:10]]
    ).lower()
    best = None
    best_score = 0
    for cat_id, name in categories:
        tokens = [t for t in re.findall(r'[a-z0-9]+', str(name).lower()) if len(t) > 2]
        if not tokens:
            continue
        score = sum(2 if t in (product.title or '').lower() else 1 for t in tokens if t in haystack)
        if score > best_score:
            best_score = score
            best = (cat_id, str(name))
    return best if best_score > 0 else None


def _truncate_sentence(text, limit):
    text = (text or '').strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    for boundary in ('. ', '! ', '? '):
        idx = cut.rfind(boundary)
        if idx > limit * 0.5:
            return cut[:idx + 1].strip()
    idx = cut.rfind(' ')
    return (cut[:idx] if idx > 0 else cut).strip()
