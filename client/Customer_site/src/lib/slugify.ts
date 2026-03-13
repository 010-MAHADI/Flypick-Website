/**
 * Utility functions for generating and parsing product URLs with slugs
 */

/**
 * Convert a string to a URL-friendly slug
 */
export function slugify(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') {
    return 'untitled';
  }
  
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate a product URL with slug
 */
export function generateProductUrl(product: { id: number; title?: string | null; name?: string | null }): string {
  const productName = product.title || product.name;
  const slug = slugify(productName);
  return `/product/${product.id}/${slug}`;
}

/**
 * Extract product ID from a URL slug
 */
export function extractProductId(url: string): number | null {
  // Handle both formats: /product/123/slug and /product/123
  const match = url.match(/\/product\/(\d+)(?:\/.*)?$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Generate a category URL with slug
 */
export function generateCategoryUrl(category: { id: number; name?: string | null }): string {
  const slug = slugify(category.name);
  return `/category/${category.id}/${slug}`;
}

/**
 * Extract category ID from a URL slug
 */
export function extractCategoryId(url: string): number | null {
  const match = url.match(/\/category\/(\d+)(?:\/.*)?$/);
  return match ? parseInt(match[1], 10) : null;
}