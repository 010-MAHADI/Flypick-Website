"""
Email notifications for imported-product changes.

Sent to the product owner (the shop's seller) and every administrator when
a synchronization run detects a significant change: out of stock, product
removed, source unavailable, or a dramatic price change.
Uses the existing EmailService so every send is logged in EmailLog.
"""
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger('importer')


def notify_product_change(source, changes):
    """``changes`` is a list of human-readable strings describing what
    changed. Never raises — notification failure must not break a sync run."""
    if not changes:
        return
    try:
        product = source.product
        recipients = _collect_recipients(product)
        if not recipients:
            logger.warning('Sync notification skipped: no recipient emails for product %s', product.id)
            return

        detected_at = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %H:%M %Z')
        subject = f'[{getattr(settings, "SITE_NAME", "Flypick")}] Imported product update: {product.title[:60]}'
        html = _render_html(product, source, changes, detected_at)
        text = _render_text(product, source, changes, detected_at)

        from emails.services import EmailService
        service = EmailService()
        for email, user in recipients:
            service.send_email(
                recipient_email=email,
                subject=subject,
                html_content=html,
                text_content=text,
                template_type='custom',
                recipient_user=user,
                product=product,
            )
        logger.info('Sync notification sent for product %s to %s', product.id, [r[0] for r in recipients])
    except Exception:
        logger.exception('Failed to send sync notification for source %s', source.id)


def _collect_recipients(product):
    """Product owner (seller) + all administrators, de-duplicated."""
    User = get_user_model()
    recipients = []
    seen = set()

    seller = getattr(product.shop, 'seller', None)
    if seller and seller.email:
        recipients.append((seller.email, seller))
        seen.add(seller.email.lower())

    admin_users = User.objects.filter(is_active=True).filter(Q(is_superuser=True) | Q(role='Admin'))
    for admin in admin_users:
        if admin.email and admin.email.lower() not in seen:
            recipients.append((admin.email, admin))
            seen.add(admin.email.lower())
    return recipients


def _render_text(product, source, changes, detected_at):
    lines = [
        'An imported product on your store changed at its source website.',
        '',
        f'Product : {product.title} (ID {product.id})',
        f'Shop    : {product.shop.name}',
        f'Source  : {source.url}',
        f'Website : {source.source_site or "unknown"}',
        f'Detected: {detected_at}',
        '',
        'Changes:',
    ]
    lines += [f'  - {c}' for c in changes]
    lines += ['', 'Review the product in the seller dashboard.']
    return '\n'.join(lines)


def _render_html(product, source, changes, detected_at):
    items = ''.join(f'<li style="margin:4px 0;">{c}</li>' for c in changes)
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1d4ed8;">Imported product update</h2>
      <p>A product imported from an external website has changed at its source.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <tr><td style="padding:6px 8px;color:#666;">Product</td><td style="padding:6px 8px;"><b>{product.title}</b> (ID {product.id})</td></tr>
        <tr><td style="padding:6px 8px;color:#666;">Shop</td><td style="padding:6px 8px;">{product.shop.name}</td></tr>
        <tr><td style="padding:6px 8px;color:#666;">Source URL</td><td style="padding:6px 8px;"><a href="{source.url}">{source.url[:80]}</a></td></tr>
        <tr><td style="padding:6px 8px;color:#666;">Website</td><td style="padding:6px 8px;">{source.source_site or 'unknown'}</td></tr>
        <tr><td style="padding:6px 8px;color:#666;">Detected</td><td style="padding:6px 8px;">{detected_at}</td></tr>
      </table>
      <h3 style="margin-top:16px;">What changed</h3>
      <ul style="font-size:14px;">{items}</ul>
      <p style="color:#888;font-size:12px;margin-top:24px;">
        This is an automated message from the product import synchronization system.
      </p>
    </div>
    """
