import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";

export interface Address {
  id: string;
  full_name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_default: boolean;
}

interface AddressContextType {
  addresses: Address[];
  defaultAddress: Address | null;
  loading: boolean;
  addAddress: (address: Omit<Address, "id" | "is_default">, setAsDefault?: boolean) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  updateAddress: (id: string, address: Omit<Address, "id" | "is_default">) => Promise<void>;
  refreshAddresses: () => Promise<void>;
}

const AddressContext = createContext<AddressContextType>({
  addresses: [],
  defaultAddress: null,
  loading: false,
  addAddress: async () => {},
  removeAddress: async () => {},
  setDefaultAddress: async () => {},
  updateAddress: async () => {},
  refreshAddresses: async () => {},
});

export const useAddress = () => useContext(AddressContext);

export const AddressProvider = ({ children }: { children: ReactNode }) => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAddresses = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      setLoading(true);
      const response = await api.get("/auth/addresses/");
      // Handle both paginated and direct array responses
      const data = response.data?.results || response.data || [];
      setAddresses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch addresses:", error);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const defaultAddress = Array.isArray(addresses) && addresses.length > 0 
    ? (addresses.find((a) => a.is_default) || addresses[0]) 
    : null;

  const addAddress = async (addr: Omit<Address, "id" | "is_default">, setAsDefault = false) => {
    try {
      await api.post("/auth/addresses/", {
        ...addr,
        is_default: setAsDefault || addresses.length === 0,
      });
      await fetchAddresses();
    } catch (error) {
      console.error("Failed to add address:", error);
      throw error;
    }
  };

  const removeAddress = async (id: string) => {
    try {
      await api.delete(`/auth/addresses/${id}/`);
      await fetchAddresses();
    } catch (error) {
      console.error("Failed to remove address:", error);
      throw error;
    }
  };

  const setDefaultAddress = async (id: string) => {
    try {
      await api.post(`/auth/addresses/${id}/set_default/`);
      await fetchAddresses();
    } catch (error) {
      console.error("Failed to set default address:", error);
      throw error;
    }
  };

  const updateAddress = async (id: string, addr: Omit<Address, "id" | "is_default">) => {
    try {
      await api.patch(`/auth/addresses/${id}/`, addr);
      await fetchAddresses();
    } catch (error) {
      console.error("Failed to update address:", error);
      throw error;
    }
  };

  return (
    <AddressContext.Provider value={{ 
      addresses, 
      defaultAddress, 
      loading,
      addAddress, 
      removeAddress, 
      setDefaultAddress, 
      updateAddress,
      refreshAddresses: fetchAddresses
    }}>
      {children}
    </AddressContext.Provider>
  );
};
