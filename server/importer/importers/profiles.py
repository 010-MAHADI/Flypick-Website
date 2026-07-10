"""
Domain profiles: zero-code support for known stores.

A profile gives a store a proper display name and (optionally) CSS selector
hints that take priority over the generic heuristics. Adding support for a
new store is one entry in ``DOMAIN_PROFILES`` — no importer class needed.
Selector keys understood by GenericImporter:

    title, price, regular_price, description, short_description,
    gallery, specs, availability

All hints are optional; the generic strategy chain covers whatever a
profile does not specify.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class DomainProfile:
    key: str
    name: str
    domains: tuple
    example_url: str = ''
    selectors: dict = field(default_factory=dict)


DOMAIN_PROFILES = (
    DomainProfile(
        key='startech',
        name='Star Tech',
        domains=('startech.com.bd',),
        example_url='https://www.startech.com.bd/some-product',
        selectors={
            'title': 'h1.product-name',
            'price': '.product-price',
            'regular_price': '.product-regular-price',
            'short_description': '.short-description',
            'specs': 'section#specification',
            'availability': '.product-status, .stock-status',
        },
    ),
    DomainProfile(
        key='ryans',
        name='Ryans Computers',
        domains=('ryans.com', 'ryanscomputers.com'),
        example_url='https://www.ryans.com/some-product',
        selectors={
            'price': '.new-sp-text, .sp-text',
            'regular_price': '.old-sp-text, .rp-text',
        },
    ),
    DomainProfile(
        key='techlandbd',
        name='TechLand BD',
        domains=('techlandbd.com',),
        example_url='https://www.techlandbd.com/some-product',
    ),
    DomainProfile(
        key='computermania',
        name='Computer Mania BD',
        domains=('computermaniabd.com',),
        example_url='https://computermaniabd.com/product/some-product/',
    ),
    DomainProfile(
        key='pchouse',
        name='PC House',
        domains=('pchouse.com.bd',),
        example_url='https://www.pchouse.com.bd/some-product',
    ),
    DomainProfile(
        key='pcbuilderbd',
        name='PC Builder Bangladesh',
        domains=('pcbuilderbd.com',),
        example_url='https://www.pcbuilderbd.com/product/some-product/',
    ),
    DomainProfile(
        key='computersource',
        name='Computer Source',
        domains=('computersourcebd.com',),
        example_url='https://www.computersourcebd.com/some-product',
    ),
    DomainProfile(
        key='ucc',
        name='UCC (Unique Computers)',
        domains=('ucc.com.bd', 'ucc-bd.com'),
        example_url='https://www.ucc.com.bd/some-product',
    ),
    DomainProfile(
        key='globalbrand',
        name='Global Brand PLC',
        domains=('globalbrand.com.bd',),
        example_url='https://www.globalbrand.com.bd/some-product',
    ),
    DomainProfile(
        key='binarylogic',
        name='Binary Logic',
        domains=('binarylogic.com.bd',),
        example_url='https://www.binarylogic.com.bd/some-product',
    ),
    DomainProfile(
        key='ultratech',
        name='Ultra Technology',
        domains=('ultratech.com.bd',),
        example_url='https://www.ultratech.com.bd/some-product',
    ),
    DomainProfile(
        key='skyland',
        name='Skyland BD',
        domains=('skyland.com.bd',),
        example_url='https://www.skyland.com.bd/some-product',
    ),
)


def profile_for_hostname(hostname):
    hostname = (hostname or '').lower()
    for profile in DOMAIN_PROFILES:
        if any(hostname == d or hostname.endswith('.' + d) for d in profile.domains):
            return profile
    return None
