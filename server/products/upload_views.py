"""
Views for handling file uploads
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.exceptions import ValidationError

from utils.file_upload import (
    validate_image_file,
    validate_video_file,
    get_file_url
)
from .models import Product, ProductImage, ProductVideo
import os
from django.conf import settings


def _absolute_media_url(request, media_url):
    if not media_url:
        return None
    return request.build_absolute_uri(media_url)


def _existing_image_slots(product):
    count = product.gallery_images.count()
    if product.image and not product.gallery_images.filter(image=product.image.name).exists():
        count += 1
    return count


def _existing_video_slots(product):
    count = product.gallery_videos.count()
    if product.video and not product.gallery_videos.filter(video=product.video.name).exists():
        count += 1
    return count


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_product_image(request):
    """
    Upload a product image
    POST /api/products/upload-image/
    Body: multipart/form-data with 'image' file
    Optional: 'product_id' to associate with existing product
    """
    if 'image' not in request.FILES:
        return Response(
            {'error': 'No image file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    image_file = request.FILES['image']
    
    try:
        # Validate the image
        validate_image_file(image_file)
        
        # Get product ID if provided
        product_id = request.data.get('product_id')
        
        if product_id:
            # Associate with existing product
            try:
                product = Product.objects.get(id=product_id, shop__seller=request.user)

                # Save new image
                product.image = image_file
                product.save()

                # Keep gallery data in sync with main image changes
                if not product.gallery_images.filter(image=product.image.name).exists():
                    ProductImage.objects.create(
                        product=product,
                        image=product.image.name,
                        sort_order=product.gallery_images.count()
                    )
                
                return Response({
                    'message': 'Image uploaded successfully',
                    'image_url': _absolute_media_url(request, product.image.url),
                    'product_id': product.id
                }, status=status.HTTP_200_OK)
                
            except Product.DoesNotExist:
                return Response(
                    {'error': 'Product not found or you don\'t own it'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Just upload the file without associating to a product
            # Generate filename
            from utils.file_upload import get_upload_path
            file_path = get_upload_path(None, image_file.name, 'products/images')
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            # Save file
            with open(full_path, 'wb+') as destination:
                for chunk in image_file.chunks():
                    destination.write(chunk)
            
            # Return URL
            image_url = get_file_url(file_path)
            
            return Response({
                'message': 'Image uploaded successfully',
                'image_url': _absolute_media_url(request, image_url),
                'file_path': file_path
            }, status=status.HTTP_201_CREATED)
            
    except ValidationError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Upload failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_product_video(request):
    """
    Upload a product video
    POST /api/products/upload-video/
    Body: multipart/form-data with 'video' file
    Optional: 'product_id' to associate with existing product
    """
    if 'video' not in request.FILES:
        return Response(
            {'error': 'No video file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    video_file = request.FILES['video']
    
    try:
        # Validate the video
        validate_video_file(video_file)
        
        # Get product ID if provided
        product_id = request.data.get('product_id')

        if product_id:
            try:
                product = Product.objects.get(id=product_id, shop__seller=request.user)

                # Respect maximum 5 videos per product
                if _existing_video_slots(product) >= 5:
                    return Response(
                        {'error': 'Maximum 5 videos allowed per product'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                media = ProductVideo.objects.create(
                    product=product,
                    video=video_file,
                    sort_order=product.gallery_videos.count()
                )

                # Keep backward compatibility with single main video field
                if not product.video:
                    product.video = media.video.name
                    product.save(update_fields=['video', 'updated_at'])

                return Response({
                    'message': 'Video uploaded successfully',
                    'video_url': _absolute_media_url(request, media.video.url),
                    'video_id': media.id,
                    'product_id': product.id
                }, status=status.HTTP_200_OK)
            except Product.DoesNotExist:
                return Response(
                    {'error': 'Product not found or you don\'t own it'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Keep standalone upload behavior for compatibility
            from utils.file_upload import get_upload_path
            file_path = get_upload_path(None, video_file.name, 'products/videos')
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)

            # Ensure directory exists
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            # Save file
            with open(full_path, 'wb+') as destination:
                for chunk in video_file.chunks():
                    destination.write(chunk)

            # Return URL
            video_url = get_file_url(file_path)

            return Response({
                'message': 'Video uploaded successfully',
                'video_url': _absolute_media_url(request, video_url),
                'file_path': file_path
            }, status=status.HTTP_201_CREATED)
        
    except ValidationError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Upload failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_multiple_images(request):
    """
    Upload multiple product images at once
    POST /api/products/upload-images/
    Body: multipart/form-data with multiple 'images' files
    """
    if 'images' not in request.FILES:
        return Response(
            {'error': 'No image files provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    images = request.FILES.getlist('images')
    product_id = request.data.get('product_id')
    
    if len(images) > 10:
        return Response(
            {'error': 'Maximum 10 images allowed'},
            status=status.HTTP_400_BAD_REQUEST
        )

    product = None
    if product_id:
        try:
            product = Product.objects.get(id=product_id, shop__seller=request.user)
        except Product.DoesNotExist:
            return Response(
                {'error': 'Product not found or you don\'t own it'},
                status=status.HTTP_404_NOT_FOUND
            )

        if _existing_image_slots(product) + len(images) > 10:
            return Response(
                {'error': 'Maximum 10 images allowed per product'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    uploaded_images = []
    errors = []
    
    for idx, image_file in enumerate(images):
        try:
            # Validate the image
            validate_image_file(image_file)
            
            if product:
                media = ProductImage.objects.create(
                    product=product,
                    image=image_file,
                    sort_order=product.gallery_images.count()
                )
                # Keep backward compatibility with single main image field
                if not product.image:
                    product.image = media.image.name
                    product.save(update_fields=['image', 'updated_at'])

                uploaded_images.append({
                    'index': idx,
                    'filename': image_file.name,
                    'id': media.id,
                    'url': _absolute_media_url(request, media.image.url),
                    'path': media.image.name
                })
            else:
                # Generate filename
                from utils.file_upload import get_upload_path
                file_path = get_upload_path(None, image_file.name, 'products/images')
                full_path = os.path.join(settings.MEDIA_ROOT, file_path)
                
                # Ensure directory exists
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                
                # Save file
                with open(full_path, 'wb+') as destination:
                    for chunk in image_file.chunks():
                        destination.write(chunk)
                
                # Add to results
                uploaded_images.append({
                    'index': idx,
                    'filename': image_file.name,
                    'url': _absolute_media_url(request, get_file_url(file_path)),
                    'path': file_path
                })
            
        except ValidationError as e:
            errors.append({
                'index': idx,
                'filename': image_file.name,
                'error': str(e)
            })
        except Exception as e:
            errors.append({
                'index': idx,
                'filename': image_file.name,
                'error': f'Upload failed: {str(e)}'
            })
    
    return Response({
        'message': f'Uploaded {len(uploaded_images)} of {len(images)} images',
        'uploaded': uploaded_images,
        'errors': errors
    }, status=status.HTTP_201_CREATED if uploaded_images else status.HTTP_400_BAD_REQUEST)
