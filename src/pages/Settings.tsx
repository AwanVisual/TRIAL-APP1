import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Settings as SettingsIcon,
  Store,
  Receipt,
  Users,
  Bell,
  Upload,
} from "lucide-react";

const Settings = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*");
      // Convert the data array into an object
      const settingsObject = data
        ? data.reduce((obj: any, item: any) => {
            obj[item.key] = item.value;
            return obj;
          }, {})
        : {};
      return settingsObject || {};
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("settings")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Success", description: "Settings updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("company-assets").getPublicUrl(fileName);

      // Update the company_logo setting
      await updateSettingMutation.mutateAsync({
        key: "company_logo",
        value: publicUrl,
      });

      return publicUrl;
    },
    onSuccess: () => {
      setLogoFile(null);
      toast({ title: "Success", description: "Logo uploaded successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getSetting = (key: string) => {
    return settings?.[key] || "";
  };

  const handleSettingUpdate = (key: string, value: string) => {
    updateSettingMutation.mutate({ key, value });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Update all form settings
    const updates = Array.from(formData.entries()).map(([key, value]) => ({
      key,
      value: value.toString(),
    }));

    updates.forEach((update) => {
      updateSettingMutation.mutate(update);
    });
  };

  const handleLogoUpload = () => {
    if (logoFile) {
      uploadLogoMutation.mutate(logoFile);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600">Configure your POS system</p>
        </div>
      </div>

      <Tabs defaultValue="store" className="space-y-4">
        <TabsList>
          <TabsTrigger value="store">Store Info</TabsTrigger>
          <TabsTrigger value="receipt">Receipt</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="store">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Store Information
              </CardTitle>
              <CardDescription>
                Basic information about your store
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="store_name">Store Name</Label>
                    <Input
                      id="store_name"
                      name="store_name"
                      defaultValue={getSetting("store_name")}
                      placeholder="Your Store Name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="store_phone">Phone Number</Label>
                    <Input
                      id="store_phone"
                      name="store_phone"
                      defaultValue={getSetting("store_phone")}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="store_address">Address</Label>
                  <Textarea
                    id="store_address"
                    name="store_address"
                    defaultValue={getSetting("store_address")}
                    placeholder="123 Main St, City, State 12345"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="store_email">Email</Label>
                    <Input
                      id="store_email"
                      name="store_email"
                      type="email"
                      defaultValue={getSetting("store_email")}
                      placeholder="store@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="store_website">Website</Label>
                    <Input
                      id="store_website"
                      name="store_website"
                      defaultValue={getSetting("store_website")}
                      placeholder="www.yourstore.com"
                    />
                  </div>
                </div>

                {/* Logo Upload Section */}
                <div className="space-y-4 border-t pt-4">
                  <Label>Company Logo</Label>
                  {getSetting("company_logo") && (
                    <div className="mb-4">
                      <img
                        src={getSetting("company_logo")}
                        alt="Current Logo"
                        className="max-h-20 object-contain border rounded"
                      />
                      <p className="text-sm text-gray-600 mt-1">Current logo</p>
                    </div>
                  )}
                  <div className="flex items-center space-x-4">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleLogoUpload}
                      disabled={!logoFile || uploadLogoMutation.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadLogoMutation.isPending
                        ? "Uploading..."
                        : "Upload Logo"}
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600">
                    Upload a logo for your receipts. Recommended size: 200x60px
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={updateSettingMutation.isPending}
                >
                  Save Store Information
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipt">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Receipt Settings
              </CardTitle>
              <CardDescription>
                Customize how receipts appear to customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="receipt_header">Receipt Header</Label>
                  <Textarea
                    id="receipt_header"
                    name="receipt_header"
                    defaultValue={getSetting("receipt_header")}
                    placeholder="Thank you for shopping with us!"
                  />
                </div>

                <div>
                  <Label htmlFor="receipt_footer">Receipt Footer</Label>
                  <Textarea
                    id="receipt_footer"
                    name="receipt_footer"
                    defaultValue={getSetting("receipt_footer")}
                    placeholder="Visit us again soon!"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 border-t pt-4">
                  <h4 className="font-medium">Payment Note Settings</h4>
                  <div>
                    <Label htmlFor="payment_note_line1">
                      Payment Note Line 1
                    </Label>
                    <Input
                      id="payment_note_line1"
                      name="payment_note_line1"
                      defaultValue={getSetting("payment_note_line1")}
                      placeholder="Bank: [amount]/ USERNAME"
                    />
                  </div>
                  <div>
                    <Label htmlFor="payment_note_line2">
                      Payment Note Line 2
                    </Label>
                    <Input
                      id="payment_note_line2"
                      name="payment_note_line2"
                      defaultValue={getSetting("payment_note_line2")}
                      placeholder="No. Rekening: 123456789"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="print_receipt_auto"
                    defaultChecked={getSetting("print_receipt_auto") === "true"}
                    onCheckedChange={(checked) =>
                      handleSettingUpdate(
                        "print_receipt_auto",
                        checked.toString(),
                      )
                    }
                  />
                  <Label htmlFor="print_receipt_auto">
                    Auto-print receipt after sale
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={updateSettingMutation.isPending}
                >
                  Save Receipt Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure alerts and notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Low stock alerts</Label>
                    <p className="text-sm text-gray-600">
                      Get notified when products are running low
                    </p>
                  </div>
                  <Switch
                    defaultChecked={getSetting("low_stock_alerts") === "true"}
                    onCheckedChange={(checked) =>
                      handleSettingUpdate(
                        "low_stock_alerts",
                        checked.toString(),
                      )
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Daily sales summary</Label>
                    <p className="text-sm text-gray-600">
                      Receive daily sales reports via email
                    </p>
                  </div>
                  <Switch
                    defaultChecked={
                      getSetting("daily_sales_summary") === "true"
                    }
                    onCheckedChange={(checked) =>
                      handleSettingUpdate(
                        "daily_sales_summary",
                        checked.toString(),
                      )
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="low_stock_threshold">
                    Low Stock Threshold
                  </Label>
                  <Input
                    id="low_stock_threshold"
                    type="number"
                    min="1"
                    defaultValue={getSetting("low_stock_threshold") || "10"}
                    onChange={(e) =>
                      handleSettingUpdate("low_stock_threshold", e.target.value)
                    }
                    placeholder="10"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Alert when stock quantity is below this number
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
