
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface CartItem {
  product: any;
  quantity: number;
  customDiscount: number;
}

interface ReceiptFieldsConfig {
  showAmount: boolean;
  showDppFaktur: boolean;
  showDiscount: boolean;
  showPpn11: boolean;
  discountPercentage: number;
}

interface PreCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  onCartUpdate?: (updatedCart: CartItem[]) => void;
  onProceedToPayment: (config: ReceiptFieldsConfig) => void;
}

const PreCheckoutDialog = ({ open, onOpenChange, cart, onCartUpdate, onProceedToPayment }: PreCheckoutDialogProps) => {
  const [receiptConfig, setReceiptConfig] = useState<ReceiptFieldsConfig>({
    showAmount: true,
    showDppFaktur: false,
    showDiscount: false,
    showPpn11: false,
    discountPercentage: 0,
  });

  const calculateDetailedPricing = (item: CartItem) => {
    const price = Number(item.product.price);
    const quantity = item.quantity;
    
    // Use individual item discount instead of global discount
    const itemDiscount = item.customDiscount || 0;
    
    const amount = quantity * price;
    const dpp11 = (100 / 111) * price;
    const discount = (itemDiscount / 100) * dpp11;
    const dppFaktur = dpp11 - discount;
    const dppLain = (11 / 12) * dppFaktur;
    
    // PPN 11% and PPN 12% must return the same value
    const ppn11 = 0.11 * dppFaktur;
    const ppn12 = ppn11; // Same value as PPN 11%
    
    return {
      amount,
      dpp11: dpp11 * quantity,
      discount: discount * quantity,
      dppFaktur: dppFaktur * quantity,
      dppLain: dppLain * quantity,
      ppn11: ppn11 * quantity,
      ppn12: ppn12 * quantity,
    };
  };

  const calculateTotals = () => {
    return cart.reduce((totals, item) => {
      const itemCalc = calculateDetailedPricing(item);
      return {
        amount: totals.amount + itemCalc.amount,
        dpp11: totals.dpp11 + itemCalc.dpp11,
        discount: totals.discount + itemCalc.discount,
        dppFaktur: totals.dppFaktur + itemCalc.dppFaktur,
        dppLain: totals.dppLain + itemCalc.dppLain,
        ppn11: totals.ppn11 + itemCalc.ppn11,
        ppn12: totals.ppn12 + itemCalc.ppn12,
      };
    }, {
      amount: 0,
      dpp11: 0,
      discount: 0,
      dppFaktur: 0,
      dppLain: 0,
      ppn11: 0,
      ppn12: 0,
    });
  };

  const totals = calculateTotals();

  const handleProceed = () => {
    onProceedToPayment(receiptConfig);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pre-Checkout Pricing Breakdown (Special Customer)</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Global Discount Configuration - Now mainly for receipt display options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Global Discount Configuration (Receipt Display)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <Label htmlFor="discountPercentage">Global Discount Percentage (for receipt header):</Label>
                <Input
                  id="discountPercentage"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={receiptConfig.discountPercentage}
                  onChange={(e) => setReceiptConfig(prev => ({
                    ...prev,
                    discountPercentage: parseFloat(e.target.value) || 0
                  }))}
                  className="w-24"
                />
                <span>%</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This is for receipt display purposes. Individual item discounts are already applied above.
              </p>
            </CardContent>
          </Card>

          {/* Item-by-Item Breakdown with Editable Discounts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Item Breakdown (Edit Individual Discounts)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cart.map((item, index) => {
                  const calc = calculateDetailedPricing(item);
                  return (
                    <div key={item.product.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">
                          {item.product.name} (Qty: {item.quantity})
                        </h4>
                        <div className="flex items-center space-x-2">
                          <Label htmlFor={`special-discount-${item.product.id}`} className="text-sm">
                            Discount:
                          </Label>
                          <Input
                            id={`special-discount-${item.product.id}`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={item.customDiscount}
                            onChange={(e) => {
                              const newDiscount = parseFloat(e.target.value) || 0;
                              const updatedCart = cart.map(cartItem => 
                                cartItem.product.id === item.product.id 
                                  ? { ...cartItem, customDiscount: Math.max(0, Math.min(100, newDiscount)) }
                                  : cartItem
                              );
                              // Update parent cart state through callback
                              onCartUpdate?.(updatedCart);
                            }}
                            className="w-20 h-8 text-sm"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                      
                      {item.customDiscount > 0 && (
                        <div className="mb-2">
                          <span className="text-green-600 text-sm">- {item.customDiscount}% discount applied</span>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Amount:</span>
                          <div className="font-medium">{formatCurrency(calc.amount)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">DPP 11%:</span>
                          <div className="font-medium text-gray-500">{formatCurrency(calc.dpp11)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Discount ({item.customDiscount}%):</span>
                          <div className="font-medium">{formatCurrency(calc.discount)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">DPP Faktur:</span>
                          <div className="font-medium">{formatCurrency(calc.dppFaktur)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">DPP Lain:</span>
                          <div className="font-medium text-gray-500">{formatCurrency(calc.dppLain)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">PPN 11%:</span>
                          <div className="font-medium">{formatCurrency(calc.ppn11)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">PPN 12% (Same as 11%):</span>
                          <div className="font-medium">{formatCurrency(calc.ppn12)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Final Total:</span>
                          <div className="font-medium text-lg text-green-600">
                            {formatCurrency(calc.dppFaktur + calc.ppn11)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Summary Totals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{formatCurrency(totals.amount)}</div>
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{formatCurrency(totals.discount)}</div>
                  <div className="text-sm text-muted-foreground">Total Discount</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{formatCurrency(totals.dppFaktur)}</div>
                  <div className="text-sm text-muted-foreground">Total DPP Faktur</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(totals.dppFaktur + totals.ppn11)}
                  </div>
                  <div className="text-sm text-muted-foreground">Final Total</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Receipt Display Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Receipt Display Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showAmount"
                    checked={receiptConfig.showAmount}
                    onCheckedChange={(checked) => 
                      setReceiptConfig(prev => ({ ...prev, showAmount: checked as boolean }))
                    }
                  />
                  <Label htmlFor="showAmount">Show Amount</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showDppFaktur"
                    checked={receiptConfig.showDppFaktur}
                    onCheckedChange={(checked) => 
                      setReceiptConfig(prev => ({ ...prev, showDppFaktur: checked as boolean }))
                    }
                  />
                  <Label htmlFor="showDppFaktur">Show DPP Faktur</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showDiscount"
                    checked={receiptConfig.showDiscount}
                    onCheckedChange={(checked) => 
                      setReceiptConfig(prev => ({ ...prev, showDiscount: checked as boolean }))
                    }
                  />
                  <Label htmlFor="showDiscount">Show Discount Summary</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showPpn11"
                    checked={receiptConfig.showPpn11}
                    onCheckedChange={(checked) => 
                      setReceiptConfig(prev => ({ ...prev, showPpn11: checked as boolean }))
                    }
                  />
                  <Label htmlFor="showPpn11">Show PPN 11%</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleProceed}>
            Apply Configuration & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreCheckoutDialog;
