import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from products.models import Shop, Product
from users.models import SellerProfile

User = get_user_model()

def seed():
    print("Clearing old data...")
    Product.objects.all().delete()
    Shop.objects.all().delete()
    User.objects.all().delete()

    print("Creating users...")
    admin = User.objects.create_superuser('admin', 'admin@flypick.com', 'admin_pass')
    seller1 = User.objects.create_user(username='seller1', email='seller1@flypick.com', password='password', role='Seller')
    SellerProfile.objects.create(user=seller1, status='active', verified=True)

    print("Creating shops...")
    shop1 = Shop.objects.create(seller=seller1, name="TechZone Electronics", category="Electronics", description="Premium electronics")

    print("Creating products...")
    Product.objects.create(
        shop=shop1,
        title="46Pcs Family Tools 1/4 Set Socket Wrench Mechanic Tool Kit",
        price=946.28,
        originalPrice=1892.56,
        discount=50,
        rating=4.4,
        reviews_count=476,
        sold_count=10000,
        image="https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=300&h=300&fit=crop",
        badges=["Choice", "Sale"],
        freeShipping=False,
        welcomeDeal=False
    )
    
    Product.objects.create(
        shop=shop1,
        title="60W 80W Electric Soldering Iron Kit Adjustable Temperature",
        price=948.84,
        originalPrice=1221.50,
        discount=22,
        rating=4.6,
        reviews_count=328,
        sold_count=10000,
        image="https://images.unsplash.com/photo-1588783323287-4c0bcd3f0bc6?w=300&h=300&fit=crop",
        badges=["Choice", "Sale"],
        freeShipping=True,
        welcomeDeal=True
    )
    
    Product.objects.create(
        shop=shop1,
        title="Wireless Bluetooth Earphones Neckband Sport Headset 12D",
        price=143.70,
        originalPrice=531.94,
        discount=72,
        rating=4.2,
        reviews_count=421,
        sold_count=5000,
        image="https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=300&h=300&fit=crop",
        badges=["Welcome Deal"],
        freeShipping=True,
        welcomeDeal=True
    )

    print("Seeding complete! Admin: admin/admin_pass")

if __name__ == '__main__':
    seed()
