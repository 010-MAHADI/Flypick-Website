import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Bell, ShoppingCart, Package } from 'lucide-react';
import { apiGet, apiPut } from '@/utils/api';

interface EmailPreferences {
  welcome_emails: boolean;
  order_confirmations: boolean;
  order_updates: boolean;
  promotional_emails: boolean;
  new_order_alerts: boolean;
  stock_alerts: boolean;
  low_stock_threshold: number;
}

const EmailPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<EmailPreferences>({
    welcome_emails: true,
    order_confirmations: true,
    order_updates: true,
    promotional_emails: true,
    new_order_alerts: true,
    stock_alerts: true,
    low_stock_threshold: 5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await apiGet('/emails/preferences/');

      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
      } else {
        throw new Error('Failed to fetch preferences');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load email preferences',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const response = await apiPut('/emails/preferences/', preferences);

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Email preferences updated successfully',
        });
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save email preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchChange = (key: keyof EmailPreferences, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleThresholdChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    setPreferences(prev => ({
      ...prev,
      low_stock_threshold: numValue,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Preferences</h1>
        <p className="text-gray-600">
          Manage your email notification preferences. You can choose which types of emails you'd like to receive.
        </p>
      </div>

      <div className="space-y-6">
        {/* Customer Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Customer Notifications
            </CardTitle>
            <CardDescription>
              Email notifications related to your account and orders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Welcome Emails</Label>
                <p className="text-sm text-gray-500">
                  Receive welcome emails when you create an account
                </p>
              </div>
              <Switch
                checked={preferences.welcome_emails}
                onCheckedChange={(checked) => handleSwitchChange('welcome_emails', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Order Confirmations</Label>
                <p className="text-sm text-gray-500">
                  Get notified when your orders are confirmed
                </p>
              </div>
              <Switch
                checked={preferences.order_confirmations}
                onCheckedChange={(checked) => handleSwitchChange('order_confirmations', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Order Updates</Label>
                <p className="text-sm text-gray-500">
                  Receive updates when your order status changes
                </p>
              </div>
              <Switch
                checked={preferences.order_updates}
                onCheckedChange={(checked) => handleSwitchChange('order_updates', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Promotional Emails</Label>
                <p className="text-sm text-gray-500">
                  Receive promotional offers and marketing emails
                </p>
              </div>
              <Switch
                checked={preferences.promotional_emails}
                onCheckedChange={(checked) => handleSwitchChange('promotional_emails', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Seller Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Seller Notifications
            </CardTitle>
            <CardDescription>
              Email notifications for your seller activities (if you're a seller)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">New Order Alerts</Label>
                <p className="text-sm text-gray-500">
                  Get notified when you receive new orders
                </p>
              </div>
              <Switch
                checked={preferences.new_order_alerts}
                onCheckedChange={(checked) => handleSwitchChange('new_order_alerts', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Stock Alerts</Label>
                <p className="text-sm text-gray-500">
                  Receive alerts when your products are low on stock or out of stock
                </p>
              </div>
              <Switch
                checked={preferences.stock_alerts}
                onCheckedChange={(checked) => handleSwitchChange('stock_alerts', checked)}
              />
            </div>

            {preferences.stock_alerts && (
              <div className="space-y-2">
                <Label htmlFor="threshold" className="text-base font-medium">
                  Low Stock Threshold
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="threshold"
                    type="number"
                    min="1"
                    max="100"
                    value={preferences.low_stock_threshold}
                    onChange={(e) => handleThresholdChange(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-500">
                    units (alert when stock falls below this number)
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={savePreferences} disabled={saving} className="min-w-[120px]">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmailPreferences;