from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from .models import Category
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os
import uuid

@api_view(['POST'])
@permission_classes([IsAdminUser])
def upload_category_image(request):
    """
    Upload an image for a category
    """
    if 'image' not in request.FILES:
        return Response(
            {'error': 'No image file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    category_id = request.data.get('category_id')
    if not category_id:
        return Response(
            {'error': 'category_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        category = Category.objects.get(id=category_id)
    except Category.DoesNotExist:
        return Response(
            {'error': 'Category not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    image_file = request.FILES['image']
    
    # Validate file size (2MB max)
    if image_file.size > 2 * 1024 * 1024:
        return Response(
            {'error': 'Image size must be less than 2MB'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate file type
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    ext = os.path.splitext(image_file.name)[1].lower()
    if ext not in allowed_extensions:
        return Response(
            {'error': f'Invalid file type. Allowed: {", ".join(allowed_extensions)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Generate unique filename
    filename = f"categories/category_{category_id}_{uuid.uuid4().hex[:8]}{ext}"
    
    # Delete old image if exists
    if category.image:
        try:
            default_storage.delete(category.image.name)
        except Exception as e:
            print(f"Failed to delete old image: {e}")
    
    # Save new image
    path = default_storage.save(filename, ContentFile(image_file.read()))
    category.image = path
    category.save()
    
    # Return full URL
    image_url = request.build_absolute_uri(category.image.url)
    
    return Response({
        'success': True,
        'image': path,
        'image_url': image_url,
        'category_id': category.id,
        'message': 'Image uploaded successfully'
    }, status=status.HTTP_200_OK)
