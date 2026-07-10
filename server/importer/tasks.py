"""
Optional Celery integration for the sync job.

Celery is listed in requirements but the project may run without a worker;
this module degrades to a no-op import when Celery is absent. If you use
Celery beat, schedule ``importer.tasks.sync_imported_products_task`` daily.
Otherwise use the ``sync_imported_products`` management command from cron
or Windows Task Scheduler.
"""
try:
    from celery import shared_task
except ImportError:  # pragma: no cover - celery not installed/configured
    shared_task = None

if shared_task:

    @shared_task(name='importer.sync_imported_products')
    def sync_imported_products_task(interval_days=3, limit=100):
        from .sync import sync_due_sources
        return sync_due_sources(interval_days=interval_days, limit=limit)
