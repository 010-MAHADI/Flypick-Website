import type { Product } from "@/hooks/useProducts";

interface Props {
  product: Product;
}

const ProductDescription = ({ product }: Props) => {
  const hasDescription = product.description || product.short_description;
  const hasGuides = product.variants?.guides && product.variants.guides.length > 0;

  if (!hasDescription && !hasGuides) {
    return null;
  }

  return (
    <div>
      {hasDescription && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Description</h3>
            <button className="text-xs text-muted-foreground hover:text-foreground">report</button>
          </div>
          <div className="text-sm text-foreground space-y-3 leading-relaxed">
            {product.short_description && (
              <p className="font-medium text-base">{product.short_description}</p>
            )}
            {product.description && (
              <div className="whitespace-pre-wrap">{product.description}</div>
            )}
          </div>
        </>
      )}

      {hasGuides && (
        <div className={`${hasDescription ? 'border-t border-border mt-8 pt-6' : ''}`}>
          <h4 className="text-lg font-bold mb-3">Item guides & documents</h4>
          <div className="space-y-2">
            {product.variants.guides.map((guide, index) => (
              <div 
                key={index}
                className="flex items-center justify-between border border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span>
                    {guide.type.toLowerCase().includes('pdf') ? '📄' : 
                     guide.type.toLowerCase().includes('image') ? '🖼️' : 
                     guide.type.toLowerCase().includes('video') ? '🎥' : '📎'}
                  </span>
                  <span className="font-medium">{guide.name}</span>
                  <span className="text-xs text-muted-foreground">({guide.type})</span>
                </div>
                <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                  View →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDescription;
