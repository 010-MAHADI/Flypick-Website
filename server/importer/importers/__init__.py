"""
Importer registry.

Resolution order for a URL:

1. Dedicated importer classes (sites that need custom JS-blob parsing)
2. Domain profiles (known stores handled by GenericImporter + selector hints)
3. GenericImporter — the universal fallback that attempts JSON-LD,
   OpenGraph, microdata and common e-commerce selectors on ANY website

Adding support for a new website therefore costs either one profile entry
(profiles.py) or, for tricky sites, one importer class registered here.
The core engine never changes.
"""
from urllib.parse import urlparse

from .aliexpress import AliExpressImporter
from .daraz import DarazImporter
from .electronicsbd import ElectronicsBDImporter
from .generic import GenericImporter
from .profiles import DOMAIN_PROFILES, profile_for_hostname
from .roboticsbd import RoboticsBDImporter

DEDICATED_IMPORTERS = [
    AliExpressImporter,
    DarazImporter,
    ElectronicsBDImporter,
    RoboticsBDImporter,
]


def get_importer_for(url):
    """Return the best importer for the URL. Never raises: every http(s)
    URL falls back to the universal GenericImporter."""
    for importer_class in DEDICATED_IMPORTERS:
        if importer_class.detect(url):
            return importer_class()

    try:
        hostname = (urlparse(url).hostname or '').lower()
    except ValueError:
        hostname = ''
    profile = profile_for_hostname(hostname)
    if profile:
        return GenericImporter(profile=profile)
    return GenericImporter()


def supported_sites():
    """Everything with first-class support, plus the universal fallback."""
    sites = [
        {
            'key': cls.site_key,
            'name': cls.site_name,
            'domains': list(cls.domains),
            'example': cls.example_url,
            'level': 'dedicated',
        }
        for cls in DEDICATED_IMPORTERS
    ]
    sites.extend(
        {
            'key': profile.key,
            'name': profile.name,
            'domains': list(profile.domains),
            'example': profile.example_url,
            'level': 'profile',
        }
        for profile in DOMAIN_PROFILES
    )
    sites.append({
        'key': 'generic',
        'name': 'Any other website (best effort)',
        'domains': [],
        'example': '',
        'level': 'generic',
    })
    return sites
