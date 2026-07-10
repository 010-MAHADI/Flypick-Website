"""
Re-check imported products against their source websites.

Schedule this every day; each source is only re-fetched when its own
interval has elapsed (default 3 days, clamped to 2–5), so a daily cron
gives every product a check every 2–5 days.

Examples:
    python manage.py sync_imported_products
    python manage.py sync_imported_products --interval-days 2 --limit 50
    python manage.py sync_imported_products --source-id 12   # force one

Linux cron:      15 4 * * *  cd /path/server && python manage.py sync_imported_products
Windows:         Task Scheduler daily task running the same command
Celery (option): importer.tasks.sync_imported_products_task via celery beat
"""
from django.core.management.base import BaseCommand

from importer.models import ProductSource
from importer.sync import sync_due_sources, sync_source


class Command(BaseCommand):
    help = 'Synchronize stock/availability of imported products from their source websites.'

    def add_arguments(self, parser):
        parser.add_argument('--interval-days', type=int, default=3,
                            help='Only sync sources not checked in this many days (2-5, default 3).')
        parser.add_argument('--limit', type=int, default=100,
                            help='Maximum number of sources to check in one run (default 100).')
        parser.add_argument('--source-id', type=int, default=None,
                            help='Force-sync one specific ProductSource id, ignoring the interval.')

    def handle(self, *args, **options):
        if options['source_id']:
            try:
                source = ProductSource.objects.select_related('product', 'product__shop').get(
                    id=options['source_id'])
            except ProductSource.DoesNotExist:
                self.stderr.write(self.style.ERROR(f'ProductSource {options["source_id"]} not found.'))
                return
            outcome = sync_source(source)
            self.stdout.write(self.style.SUCCESS(f'Source {source.id}: {outcome} — {source.last_result}'))
            return

        summary = sync_due_sources(interval_days=options['interval_days'], limit=options['limit'])
        self.stdout.write(self.style.SUCCESS(f'Sync complete: {summary}'))
