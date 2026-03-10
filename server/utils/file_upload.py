"""
File upload utilities for handling media files
"""
import os
import uuid
from datetime import datetime
from django.conf import settings
from django.core.exceptions import ValidationError
from pathlib import Path


def get_upload_path(instance, filename, folder):
    """
    Generate upload path for files
    Args:
        instance: Model instance
        filename: Original filename
        folder: Target folder (e.g., 'products/images', 'categories', 'users')
    Returns:
        str: Upload path relative to MEDIA_ROOT
    """
    # Get file extension
    ext = os.path.splitext(filename)[1].lower()
    
    # Generate unique filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_id = uuid.uuid4().hex[:8]
    safe_filename = f"{timestamp}_{unique_id}{ext}"
    
    # Return path relative to MEDIA_ROOT
    return os.path.join(folder, safe_filename)


def product_image_path(instance, filename):
    """Upload path for product images"""
    return get_upload_path(instance, filename, 'products/images')


def product_video_path(instance, filename):
    """Upload path for product videos"""
    return get_upload_path(instance, filename, 'products/videos')


def category_image_path(instance, filename):
    """Upload path for category images"""
    return get_upload_path(instance, filename, 'categories')


def user_image_path(instance, filename):
    """Upload path for user profile pictures"""
    return get_upload_path(instance, filename, 'users')


def shop_image_path(instance, filename):
    """Upload path for shop images"""
    return get_upload_path(instance, filename, 'shops')


def banner_image_path(instance, filename):
    """Upload path for banner images"""
    return get_upload_path(instance, filename, 'banners')


def validate_image_file(file):
    """
    Validate uploaded image file
    Args:
        file: UploadedFile object
    Raises:
        ValidationError: If file is invalid
    """
    # Check file extension
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in settings.ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            f'Unsupported file extension. Allowed: {", ".join(settings.ALLOWED_IMAGE_EXTENSIONS)}'
        )
    
    # Check file size
    if file.size > settings.MAX_IMAGE_SIZE:
        max_size_mb = settings.MAX_IMAGE_SIZE / (1024 * 1024)
        raise ValidationError(f'File size exceeds {max_size_mb}MB limit')
    
    # Check content type
    if not file.content_type.startswith('image/'):
        raise ValidationError('File must be an image')


def validate_video_file(file):
    """
    Validate uploaded video file
    Args:
        file: UploadedFile object
    Raises:
        ValidationError: If file is invalid
    """
    # Check file extension
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in settings.ALLOWED_VIDEO_EXTENSIONS:
        raise ValidationError(
            f'Unsupported file extension. Allowed: {", ".join(settings.ALLOWED_VIDEO_EXTENSIONS)}'
        )
    
    # Check file size
    if file.size > settings.MAX_VIDEO_SIZE:
        max_size_mb = settings.MAX_VIDEO_SIZE / (1024 * 1024)
        raise ValidationError(f'File size exceeds {max_size_mb}MB limit')
    
    # Check content type
    if not file.content_type.startswith('video/'):
        raise ValidationError('File must be a video')


def validate_category_image(file):
    """Validate category image with specific size limit"""
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in settings.ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            f'Unsupported file extension. Allowed: {", ".join(settings.ALLOWED_IMAGE_EXTENSIONS)}'
        )
    
    if file.size > settings.MAX_CATEGORY_IMAGE_SIZE:
        max_size_mb = settings.MAX_CATEGORY_IMAGE_SIZE / (1024 * 1024)
        raise ValidationError(f'File size exceeds {max_size_mb}MB limit')
    
    if not file.content_type.startswith('image/'):
        raise ValidationError('File must be an image')


def validate_user_image(file):
    """Validate user profile image with specific size limit"""
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in settings.ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            f'Unsupported file extension. Allowed: {", ".join(settings.ALLOWED_IMAGE_EXTENSIONS)}'
        )
    
    if file.size > settings.MAX_USER_IMAGE_SIZE:
        max_size_mb = settings.MAX_USER_IMAGE_SIZE / (1024 * 1024)
        raise ValidationError(f'File size exceeds {max_size_mb}MB limit')
    
    if not file.content_type.startswith('image/'):
        raise ValidationError('File must be an image')


def delete_file_if_exists(file_path):
    """
    Delete a file if it exists
    Args:
        file_path: Path to file relative to MEDIA_ROOT or absolute path
    """
    if not file_path:
        return
    
    # Handle both relative and absolute paths
    if os.path.isabs(file_path):
        full_path = file_path
    else:
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
    
    try:
        if os.path.exists(full_path):
            os.remove(full_path)
    except Exception as e:
        # Log error but don't raise exception
        print(f"Error deleting file {full_path}: {e}")


def get_file_url(file_path):
    """
    Get full URL for a file
    Args:
        file_path: Path to file relative to MEDIA_ROOT
    Returns:
        str: Full URL to access the file
    """
    if not file_path:
        return None
    
    # Remove leading slash if present
    file_path = file_path.lstrip('/')
    
    return f"{settings.MEDIA_URL}{file_path}"
