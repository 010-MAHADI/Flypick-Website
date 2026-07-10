"""
Allowlist-based HTML sanitizer for imported product descriptions.

Strips scripts, styles, event handlers, iframes, forms and tracking pixels
while preserving the useful formatting (headings, lists, tables, images).
"""
import re

from bs4 import BeautifulSoup, Comment, NavigableString

ALLOWED_TAGS = {
    'p', 'br', 'hr', 'b', 'strong', 'i', 'em', 'u', 's', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'a', 'blockquote', 'pre', 'code', 'figure', 'figcaption',
}

ALLOWED_ATTRS = {
    'a': {'href', 'title'},
    'img': {'src', 'alt', 'width', 'height'},
    'td': {'colspan', 'rowspan'},
    'th': {'colspan', 'rowspan'},
}

REMOVE_WITH_CONTENT = {'script', 'style', 'noscript', 'iframe', 'form', 'svg', 'video', 'audio', 'button', 'input', 'select', 'template', 'link', 'meta'}


def sanitize_html(html):
    """Return cleaned HTML safe to store and render in the storefront."""
    if not html:
        return ''
    soup = BeautifulSoup(html, 'html.parser')

    for element in soup.find_all(REMOVE_WITH_CONTENT):
        element.decompose()
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()

    for tag in soup.find_all(True):
        if tag.name not in ALLOWED_TAGS:
            tag.unwrap()
            continue
        allowed = ALLOWED_ATTRS.get(tag.name, set())
        for attr in list(tag.attrs):
            if attr not in allowed:
                del tag.attrs[attr]
        # Never allow javascript: or data: URLs
        for url_attr in ('href', 'src'):
            value = tag.attrs.get(url_attr, '')
            if value and not value.lower().startswith(('http://', 'https://', '/')):
                del tag.attrs[url_attr]

    _drop_empty_containers(soup)
    return _normalize_whitespace(str(soup))


def html_to_text(html):
    """Plain-text version of an HTML fragment with sensible line breaks."""
    if not html:
        return ''
    soup = BeautifulSoup(html, 'html.parser')
    for element in soup.find_all(REMOVE_WITH_CONTENT):
        element.decompose()
    text = soup.get_text(separator='\n')
    lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in text.splitlines()]
    deduped = []
    for line in lines:
        if line and (not deduped or deduped[-1] != line):
            deduped.append(line)
        elif not line and deduped and deduped[-1] != '':
            deduped.append('')
    return '\n'.join(deduped).strip()


def _drop_empty_containers(soup):
    changed = True
    while changed:
        changed = False
        for tag in soup.find_all(['p', 'div', 'span', 'li', 'figure']):
            if not tag.find('img') and not tag.get_text(strip=True):
                tag.decompose()
                changed = True


def _normalize_whitespace(html):
    html = re.sub(r'\n{3,}', '\n\n', html)
    html = re.sub(r'(<br\s*/?>\s*){3,}', '<br/><br/>', html)
    return html.strip()
