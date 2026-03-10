import { useState, useRef, useEffect } from "react";
import { User, Package, Heart, MapPin, Settings, LogOut, ChevronRight, ArrowLeft, Plus, Trash2, Star, X, Pencil, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/context/AuthContext";
import { useAddress, Address } from "@/context/AddressContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Account = () => {
  const { isLoggedIn, user, userName, profilePhoto, setProfilePhoto, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { addresses, addAddress, removeAddress, setDefaultAddress, updateAddress } = useAddress();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [newAddr, setNewAddr] = useState({ full_name: "", phone: "", street: "", city: "", state: "", zip_code: "", country: "Bangladesh" });
  const [profileData, setProfileData] = useState({
    first_name: user?.customer_profile?.first_name || "",
    last_name: user?.customer_profile?.last_name || "",
    phone: user?.customer_profile?.phone || "",
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isLoggedIn) {
    navigate("/auth");
    return null;
  }

  // Handle navigation to orders page when orders section is selected
  useEffect(() => {
    if (activeSection === "orders") {
      navigate("/orders");
    }
  }, [activeSection, navigate]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await setProfilePhoto(reader.result as string);
      } catch (error) {
        alert("Failed to update profile photo");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await updateProfile(profileData);
      alert("Profile updated successfully!");
    } catch (error) {
      alert("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const ProfileAvatar = ({ size = "sm", showEdit = false }: { size?: "sm" | "lg"; showEdit?: boolean }) => {
    const sizeClasses = size === "lg" ? "w-20 h-20" : "w-12 h-12";
    const iconSize = size === "lg" ? "w-10 h-10" : "w-6 h-6";

    return (
      <div className="relative group">
        <div
          className={`${sizeClasses} rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0 ${showEdit ? "cursor-pointer" : ""}`}
          onClick={showEdit ? () => fileInputRef.current?.click() : undefined}
        >
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User className={`${iconSize} text-primary`} />
          )}
        </div>
        {showEdit && !profilePhoto && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 transition-opacity"
          >
            <Camera className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  const menuItems = [
    { id: "profile", label: "My Profile", icon: User, desc: "Edit your personal info" },
    { id: "orders", label: "My Orders", icon: Package, desc: "Track and manage orders" },
    { id: "wishlist", label: "Wishlist", icon: Heart, desc: "Items you've saved" },
    { id: "addresses", label: "Addresses", icon: MapPin, desc: "Manage delivery addresses" },
    { id: "settings", label: "Settings", icon: Settings, desc: "Preferences & privacy" },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "profile":
        return (
          <div>
            <h2 className="text-lg font-bold mb-4">Profile Information</h2>
            {/* Profile photo upload */}
            <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-muted/50 border border-border">
              <ProfileAvatar size="lg" showEdit />
              <div>
                <p className="text-sm font-medium text-foreground">Profile Photo</p>
                <p className="text-xs text-muted-foreground mb-2">JPG, PNG under 2MB</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 font-medium"
                  >
                    Upload Photo
                  </button>
                  {profilePhoto && (
                    <button
                      onClick={() => setProfilePhoto("")}
                      className="text-xs text-destructive border border-destructive/30 px-3 py-1.5 rounded-lg hover:bg-destructive/10 font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">First Name</label>
                <input 
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background" 
                  placeholder="Enter first name"
                  value={profileData.first_name}
                  onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Last Name</label>
                <input 
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background" 
                  placeholder="Enter last name"
                  value={profileData.last_name}
                  onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-muted-foreground block mb-1">Email</label>
                <input 
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background" 
                  placeholder="guest@flypick.com"
                  value={user?.email || ""}
                  disabled
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-muted-foreground block mb-1">Phone</label>
                <input 
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background" 
                  placeholder="+880 1XXX XXXXXX"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <button 
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full sm:w-auto bg-primary text-primary-foreground font-medium px-6 py-2.5 rounded-lg hover:opacity-90 text-sm disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        );
      case "orders":
        // Navigate to orders page when this section is selected
        // Use useEffect or handle in the button click instead
        return (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">Redirecting to orders page...</p>
          </div>
        );
      case "wishlist":
        return (
          <div className="text-center py-12">
            <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-1">Your wishlist is empty</h2>
            <p className="text-sm text-muted-foreground">Save items you love to your wishlist.</p>
          </div>
        );
      case "addresses":
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Saved Addresses</h2>
              <button onClick={() => setShowAddressForm(true)} className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add New
              </button>
            </div>

            {showAddressForm && (
              <div className="border-2 border-primary/20 rounded-xl p-4 mb-4 bg-primary/5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold">{editingAddressId ? "Edit Address" : "New Address"}</h3>
                  <button onClick={() => { setShowAddressForm(false); setEditingAddressId(null); setNewAddr({ full_name: "", phone: "", street: "", city: "", state: "", zip_code: "", country: "Bangladesh" }); }} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Full Name *</Label>
                    <Input value={newAddr.full_name} onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })} placeholder="John Doe" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Phone *</Label>
                    <Input value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} placeholder="+880 1XXX-XXXXXX" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1">Street Address *</Label>
                    <Input value={newAddr.street} onChange={(e) => setNewAddr({ ...newAddr, street: e.target.value })} placeholder="House #, Road #, Area" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">City *</Label>
                    <Input value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} placeholder="Dhaka" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">State / Division</Label>
                    <Input value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} placeholder="Dhaka Division" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Zip Code</Label>
                    <Input value={newAddr.zip_code} onChange={(e) => setNewAddr({ ...newAddr, zip_code: e.target.value })} placeholder="1200" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Country</Label>
                    <Input value={newAddr.country} onChange={(e) => setNewAddr({ ...newAddr, country: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2 pb-4">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newAddr.full_name || !newAddr.phone || !newAddr.street || !newAddr.city) return;
                        try {
                          if (editingAddressId) {
                            await updateAddress(editingAddressId, newAddr);
                          } else {
                            await addAddress(newAddr);
                          }
                          setNewAddr({ full_name: "", phone: "", street: "", city: "", state: "", zip_code: "", country: "Bangladesh" });
                          setShowAddressForm(false);
                          setEditingAddressId(null);
                        } catch (error) {
                          alert("Failed to save address");
                        }
                      }}
                      className="bg-primary text-primary-foreground font-medium px-6 py-3 rounded-lg hover:opacity-90 text-sm w-full sm:w-auto active:scale-95 transition-transform"
                    >
                      {editingAddressId ? "Update Address" : "Save Address"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {addresses.length === 0 && !showAddressForm ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No saved addresses.</p>
                <button onClick={() => setShowAddressForm(true)} className="text-sm text-primary font-medium hover:underline">
                  Add your first address
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <div key={addr.id} className={`border rounded-xl p-4 relative ${addr.is_default ? "border-primary bg-primary/5" : "border-border"}`}>
                    {addr.is_default && (
                      <span className="absolute top-3 right-3 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded">DEFAULT</span>
                    )}
                    <p className="font-semibold text-sm">{addr.full_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{addr.phone}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{addr.street}, {addr.city}{addr.state ? `, ${addr.state}` : ""} {addr.zip_code}</p>
                    <p className="text-xs text-muted-foreground">{addr.country}</p>
                    <div className="flex gap-3 mt-3">
                      {!addr.is_default && (
                        <button onClick={async () => {
                          try {
                            await setDefaultAddress(addr.id);
                          } catch (error) {
                            alert("Failed to set default address");
                          }
                        }} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                          <Star className="w-3 h-3" /> Set as default
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingAddressId(addr.id);
                          setNewAddr({ full_name: addr.full_name, phone: addr.phone, street: addr.street, city: addr.city, state: addr.state, zip_code: addr.zip_code, country: addr.country });
                          setShowAddressForm(true);
                        }}
                        className="text-xs text-foreground font-medium hover:underline flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={async () => {
                        try {
                          await removeAddress(addr.id);
                        } catch (error) {
                          alert("Failed to remove address");
                        }
                      }} className="text-xs text-destructive font-medium hover:underline flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case "settings":
        return (
          <div>
            <h2 className="text-lg font-bold mb-4">Settings</h2>
            <div className="space-y-0">
              <div className="flex items-center justify-between py-4 border-b border-border">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive order updates via email</p>
                </div>
                <button className="w-10 h-5 bg-primary rounded-full relative flex-shrink-0">
                  <span className="absolute right-0.5 top-0.5 w-4 h-4 bg-primary-foreground rounded-full" />
                </button>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-border">
                <div>
                  <p className="text-sm font-medium">Language</p>
                  <p className="text-xs text-muted-foreground">English</p>
                </div>
                <button className="text-xs text-primary">Change</button>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-border">
                <div>
                  <p className="text-sm font-medium">Currency</p>
                  <p className="text-xs text-muted-foreground">BDT (৳)</p>
                </div>
                <button className="text-xs text-primary">Change</button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePhotoUpload}
      />
      <main className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        {activeSection && (
          <button
            onClick={() => setActiveSection(null)}
            className="lg:hidden flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Account
          </button>
        )}

        <h1 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${activeSection ? "hidden lg:block" : ""}`}>My Account</h1>

        <div className="grid lg:grid-cols-[250px_1fr] gap-4 sm:gap-6">
          <div className={`${activeSection ? "hidden lg:block" : "block"}`}>
            <div className="border border-border rounded-xl p-4 mb-3 lg:mb-0">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                <ProfileAvatar size="sm" showEdit />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground">Logged in</p>
                </div>
              </div>

              <nav className="space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                      activeSection === item.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      activeSection === item.id ? "bg-primary/20" : "bg-muted"
                    }`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground lg:hidden">{item.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground lg:hidden flex-shrink-0" />
                  </button>
                ))}
                <button
                  onClick={() => { logout(); navigate("/"); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-destructive hover:bg-destructive/10"
                >
                  <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span className="font-medium">Sign Out</span>
                </button>
              </nav>
            </div>
          </div>

          <div className={`${!activeSection ? "hidden lg:block" : "block"}`}>
            <div className="border border-border rounded-xl p-4 sm:p-6">
              {activeSection ? renderContent() : (
                <div className="text-center py-12">
                  <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h2 className="text-lg font-bold mb-1">Welcome, {userName}</h2>
                  <p className="text-sm text-muted-foreground">Select a section from the menu to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Account;