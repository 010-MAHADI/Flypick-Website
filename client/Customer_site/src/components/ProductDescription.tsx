import type { Product } from "@/hooks/useProducts";
import { looksLikeHtml, sanitizeHtml } from "@/lib/safeHtml";

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
              looksLikeHtml(product.description) ? (
                // imported descriptions arrive as sanitized HTML — render it
                <div
                  className="product-description-html [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_p]:my-2 [&_table]:w-full [&_table]:border [&_table]:border-border [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_img]:max-w-full [&_img]:rounded-lg [&_a]:text-primary [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
                />
              ) : (
                <div className="whitespace-pre-wrap">{product.description}</div>
              )
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
