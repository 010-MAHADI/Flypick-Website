from django.db import migrations


def promote_superusers_to_admin(apps, schema_editor):
    User = apps.get_model("users", "CustomUser")
    User.objects.filter(is_superuser=True).update(role="Admin")


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0005_add_admin_note_last_login_to_customer_profile"),
    ]

    operations = [
        migrations.RunPython(promote_superusers_to_admin, noop_reverse),
    ]
