import { Product } from "@/hooks/useProducts";

interface ProductSpecificationsProps {
  product: Product;
}

const defaultSpecs = [
  { key: "Brand", value: "Generic" },
  { key: "Material", value: "ABS + Electronic Components" },
  { key: "Voltage", value: "5V" },
  { key: "Power", value: "2W" },
  { key: "Connectivity", value: "USB / WiFi / Bluetooth" },
  { key: "Origin", value: "Mainland China" },
  { key: "Certification", value: "CE" },
  { key: "Weight", value: "150g" },
];

const ProductSpecifications = ({ product }: ProductSpecificationsProps) => {
  // Use product specifications if available, otherwise use defaults
  const specs = product.variants?.specifications && product.variants.specifications.length > 0
    ? product.variants.specifications
    : defaultSpecs;

  // Add product-specific specs if available
  const additionalSpecs = [];
  if (product.weight && product.weight_unit) {
    additionalSpecs.push({ key: "Weight", value: `${product.weight}${product.weight_unit}` });
  }

  // Combine specifications, removing duplicates
  const allSpecs = [...specs, ...additionalSpecs].filter((spec, index, self) =>
    index === self.findIndex((s) => s.key === spec.key)
  );

  if (allSpecs.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-xl font-bold mb-4">Specifications</h3>
      <table className="w-full border border-border text-sm">
        <tbody>
          {allSpecs.map((spec, i) => (
            <tr key={spec.key} className={i % 2 === 0 ? "bg-muted/50" : "bg-card"}>
              <td className="px-4 py-3 font-medium text-muted-foreground w-48 border-r border-border">{spec.key}</td>
              <td className="px-4 py-3 text-foreground">{spec.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductSpecifications;
