import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Minus,
  ShoppingCart,
  Trash2,
  Receipt,
  Calculator,
  Percent,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import PreCheckoutDialog from "@/components/PreCheckoutDialog";
import MidtransPayment from "@/components/MidtransPayment";

interface CartItem {
  product: any;
  quantity: number;
  customDiscount: number; // Percentage discount for this specific item
}

interface ReceiptFieldsConfig {
  showAmount: boolean;
  showDppFaktur: boolean;
  showDiscount: boolean;
  showPpn11: boolean;
  discountPercentage: number;
}

const Cashier = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentReceived, setPaymentReceived] = useState<number>(0);
  const [bankDetails, setBankDetails] = useState("");
  const [showPreCheckout, setShowPreCheckout] = useState(false);
  const [showMidtransPayment, setShowMidtransPayment] = useState(false);
  const [receiptConfig, setReceiptConfig] = useState<ReceiptFieldsConfig>({
    showAmount: true,
    showDppFaktur: false,
    showDiscount: false,
    showPpn11: false,
    discountPercentage: 0,
  });
  const [selectedCashier, setSelectedCashier] = useState<string>("");

  const handleMidtransPaymentSuccess = (paymentData: any) => {
    const bankInfo = paymentData.va_number 
      ? `${paymentData.bank?.toUpperCase()} VA: ${paymentData.va_number}`
      : `${paymentData.payment_type}`;
    
    setBankDetails(`Midtrans - ${bankInfo} (${paymentData.transaction_id})`);
    setPaymentReceived(total);
    setShowMidtransPayment(false);
    
    toast({
      title: "Midtrans Payment Received",
      description: `Payment processed successfully via ${paymentData.payment_type}`,
      duration: 5000,
    });
    
    // Auto-process the sale after successful payment
    setTimeout(() => {
      processSaleMutation.mutate();
    }, 1000);
  };

  const handleMidtransPaymentError = (error: any) => {
    console.error('Midtrans payment failed:', error);
    setShowMidtransPayment(false);
  };

  // Update payment received when payment method changes
  useEffect(() => {
    if (paymentMethod !== "cash") {
      const totalAmount = calculateFinalTotal();
      setPaymentReceived(totalAmount);
    } else {
      setPaymentReceived(0);
    }
  }, [paymentMethod, cart]);

  const calculateDetailedPricing = (item: CartItem) => {
    const price = Number(item.product.price);
    const quantity = item.quantity;
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
      finalItemTotal: (dppFaktur + ppn11) * quantity,
    };
  };

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .gt("stock_quantity", 0);
      return data || [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*");
      const settingsMap =
        data?.reduce(
          (acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
          },
          {} as Record<string, string>,
        ) || {};
      return settingsMap;
    },
  });

  const { data: cashiers } = useQuery({
    queryKey: ["cashiers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["cashier", "admin", "stockist"])
        .order("full_name");
      return data || [];
    },
  });

  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  );

  // Calculate final total using DPP Faktur + PPN 11% with per-item discounts
  const calculateFinalTotal = () => {
    return cart.reduce((sum, item) => {
      const itemCalc = calculateDetailedPricing(item);
      return sum + itemCalc.finalItemTotal;
    }, 0);
  };

  const total = calculateFinalTotal();
  const effectivePaymentReceived = paymentMethod !== "cash" ? total : paymentReceived;
  const change = effectivePaymentReceived - total;

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity < product.stock_quantity) {
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        } else {
          toast({
            title: "Error",
            description: "Not enough stock",
            variant: "destructive",
          });
          return prev;
        }
      }
      return [...prev, { product, quantity: 1, customDiscount: 0 }];
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          if (newQuantity <= item.product.stock_quantity) {
            return { ...item, quantity: newQuantity };
          } else {
            toast({
              title: "Error",
              description: "Not enough stock",
              variant: "destructive",
            });
          }
        }
        return item;
      }),
    );
  };

  const updateItemDiscount = (productId: string, discount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, customDiscount: Math.max(0, Math.min(100, discount)) }
          : item,
      ),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handlePreCheckoutProceed = (config: ReceiptFieldsConfig) => {
    setReceiptConfig(config);
    setShowPreCheckout(false);
    toast({
      title: "Special Customer Pricing Applied",
      description: `Global discount: ${config.discountPercentage}%. You can now complete the sale with the configured pricing.`,
    });
  };

  const processSaleMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Cart is empty");

      const totalAmount = total;

      // For non-cash payments, ensure payment received equals total amount
      const effectivePaymentReceived = paymentMethod !== "cash" ? totalAmount : paymentReceived;

      console.log("Payment validation:", {
        paymentReceived: effectivePaymentReceived,
        totalAmount,
        paymentMethod,
        sufficient: effectivePaymentReceived >= totalAmount,
      });

      if (effectivePaymentReceived < totalAmount) {
        throw new Error(
          `Insufficient payment. Required: ${formatCurrency(totalAmount)}, Received: ${formatCurrency(effectivePaymentReceived)}`,
        );
      }

      // Generate sale number
      const { data: saleNumber } = await supabase.rpc("generate_sale_number");

      // Create sale record with bank details if applicable
      const saleData: any = {
        sale_number: saleNumber,
        customer_name: customerName || null,
        subtotal,
        tax_amount: 0,
        total_amount: totalAmount,
        payment_method: paymentMethod as any,
        payment_received: effectivePaymentReceived,
        change_amount: Math.max(0, effectivePaymentReceived - totalAmount),
        created_by: user?.id,
        cashier_id: user?.id,
        notes: selectedCashier ? `Sales: ${selectedCashier}${bankDetails ? ` | Bank Details: ${bankDetails}` : ''}` : (bankDetails ? `Bank Details: ${bankDetails}` : null),
        invoice_status: paymentMethod === 'credit' ? 'belum_bayar' : 'lunas',
      };

      

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert(saleData)
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items with individual discount information
      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: Number(item.product.price),
        subtotal: Number(item.product.price) * item.quantity,
        discount: item.customDiscount, // Save the item discount percentage
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Create stock movements for each item
      const stockMovements = cart.map((item) => ({
        product_id: item.product.id,
        transaction_type: "outbound" as any,
        quantity: item.quantity,
        reference_number: saleNumber,
        notes: `Sale: ${saleNumber}`,
        created_by: user?.id,
      }));

      const { error: stockError } = await supabase
        .from("stock_movements")
        .insert(stockMovements);

      if (stockError) throw stockError;

      return sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setCart([]);
      setCustomerName("");
      setPaymentReceived(0);
      setBankDetails("");
      setSelectedCashier("");
      toast({
        title: "Success",
        description: `Sale ${sale.sale_number} completed successfully!`,
      });

      // Generate and download receipt with updated settings
      generateReceipt(sale);
    },
    onError: (error: any) => {
      console.error("Sale processing error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateReceipt = async (sale: any) => {
    const logoUrl = settings?.company_logo ? settings.company_logo : "";
    const storeName = settings?.store_name || "";
    const storeAddress = settings?.store_address || "";
    const storePhone = settings?.store_phone || "";
    const storeEmail = settings?.store_email || "";
    const storeWebsite = settings?.store_website || "";
    const receiptHeader = settings?.receipt_header || "";
    const receiptFooter = settings?.receipt_footer || "";

    // Get sales name
    const salesName = selectedCashier || user?.email || "Unknown";

    // Calculate detailed pricing totals for receipt using individual item discounts
    const detailedTotals = cart.reduce(
      (totals, item) => {
        const itemCalc = calculateDetailedPricing(item);
        return {
          amount: totals.amount + itemCalc.amount,
          discount: totals.discount + itemCalc.discount,
          dppFaktur: totals.dppFaktur + itemCalc.dppFaktur,
          ppn11: totals.ppn11 + itemCalc.ppn11,
        };
      },
      { amount: 0, discount: 0, dppFaktur: 0, ppn11: 0 },
    );

    // Import jsPDF dynamically
    const { jsPDF } = await import('jspdf');
    
    // Create PDF with custom 24x16cm format (landscape)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'cm',
      format: [16, 24] // 16cm height x 24cm width
    });

    // Set font
    pdf.setFont('helvetica');

    let yPosition = 1.0;
    const leftMargin = 0.5; // Left margin for 24cm width
    const rightMargin = 23.5; // Right margin for 24cm width
    const pageWidth = 24; // 24cm width
    const pageHeight = 16; // 16cm height
    const contentWidth = pageWidth - 1.0; // Content width
    const maxYPosition = pageHeight - 1.0;

    // Function to check if we need a new page
    const checkPageBreak = (requiredSpace: number = 0.5) => {
      if (yPosition + requiredSpace > maxYPosition) {
        pdf.addPage();
        yPosition = 1.0;
        return true;
      }
      return false;
    };

    // Header with logo and company info
    if (logoUrl) {
      try {
        // Create a new image to get natural dimensions
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = logoUrl;
        });
        
        // Calculate logo dimensions maintaining aspect ratio
        const maxLogoWidth = 3.0;
        const maxLogoHeight = 2.0;
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        
        let logoWidth, logoHeight;
        
        // Maintain aspect ratio without stretching
        if (aspectRatio > 1) {
          // Logo is wider - fit to width
          logoWidth = Math.min(maxLogoWidth, maxLogoHeight * aspectRatio);
          logoHeight = logoWidth / aspectRatio;
        } else {
          // Logo is taller or square - fit to height
          logoHeight = Math.min(maxLogoHeight, maxLogoWidth / aspectRatio);
          logoWidth = logoHeight * aspectRatio;
        }
        
        pdf.addImage(logoUrl, 'PNG', leftMargin, yPosition, logoWidth, logoHeight, undefined, 'FAST');
      } catch (error) {
        console.log('Logo could not be added to PDF');
      }
    }

    // Company info on the right
    checkPageBreak(1.5);
    pdf.setFontSize(18); // Adjusted font for 24x16cm
    pdf.setFont('helvetica', 'bold');
    pdf.text('INVOICE', rightMargin, yPosition + 0.3, { align: 'right' });

    yPosition += 1.0;
    pdf.setFontSize(10); // Smaller font for company info
    pdf.setFont('helvetica', 'normal');
    if (storeName) {
      checkPageBreak(0.4);
      pdf.text(storeName, pageWidth - 0.8, yPosition, { align: 'right' });
      yPosition += 0.4;
    }
    if (storeAddress) {
      checkPageBreak(0.4);
      pdf.text(storeAddress, pageWidth - 0.8, yPosition, { align: 'right' });
      yPosition += 0.4;
    }
    if (storePhone) {
      checkPageBreak(0.4);
      pdf.text(storePhone, pageWidth - 0.8, yPosition, { align: 'right' });
      yPosition += 0.4;
    }
    if (storeEmail) {
      checkPageBreak(0.4);
      pdf.text(storeEmail, pageWidth - 0.8, yPosition, { align: 'right' });
      yPosition += 0.4;
    }
    if (storeWebsite) {
      checkPageBreak(0.4);
      pdf.text(storeWebsite, pageWidth - 0.8, yPosition, { align: 'right' });
      yPosition += 0.4;
    }

    // Line separator
    yPosition += 0.4;
    checkPageBreak(0.8);
    pdf.setLineWidth(0.02);
    pdf.line(leftMargin, yPosition, rightMargin, yPosition);
    yPosition += 0.4;

    // Invoice details
    checkPageBreak(1.6);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`NO INVOICE: ${sale.sale_number}`, leftMargin, yPosition);
    yPosition += 0.5;
    checkPageBreak(0.5);
    pdf.text(`TANGGAL: ${new Date(sale.created_at).toLocaleDateString("id-ID")}`, leftMargin, yPosition);
    yPosition += 0.5;
    if (sale.customer_name) {
      checkPageBreak(0.5);
      pdf.text(`KEPADA: ${sale.customer_name}`, leftMargin, yPosition);
      yPosition += 0.5;
    }
    checkPageBreak(0.5);
    pdf.text(`NAMA SALES: ${salesName}`, leftMargin, yPosition);
    yPosition += 0.6;

    // Table header
    checkPageBreak(0.8);
    pdf.setFontSize(10); // Adjusted header font for landscape
    pdf.setFont('helvetica', 'bold');
    pdf.text('KETERANGAN', leftMargin, yPosition);
    pdf.text('QTY', leftMargin + 12.0, yPosition, { align: 'center' }); // Adjusted spacing for 24cm width
    pdf.text('HARGA', leftMargin + 16.0, yPosition, { align: 'right' }); // Adjusted positioning
    pdf.text('DISC', leftMargin + 19.0, yPosition, { align: 'right' }); // Adjusted spacing
    pdf.text('TOTAL', leftMargin + 22.0, yPosition, { align: 'right' }); // Adjusted for 24cm width

    yPosition += 0.2;
    pdf.line(leftMargin, yPosition, rightMargin, yPosition);
    yPosition += 0.4;

    // Table items
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9); // Adjusted font size for landscape
    cart.forEach((item) => {
      checkPageBreak(0.5);
      const itemCalc = calculateDetailedPricing(item);
      
      // Product name (wrap if too long) - adjusted for 24cm width
      const productName = item.product.name.length > 50 ? 
        item.product.name.substring(0, 50) + '...' : 
        item.product.name;
      
      pdf.text(productName, leftMargin, yPosition);
      pdf.text(item.quantity.toString(), leftMargin + 12.0, yPosition, { align: 'center' });
      pdf.text(formatCurrency(Number(item.product.price)), leftMargin + 16.0, yPosition, { align: 'right' });
      
      if (item.customDiscount > 0) {
        pdf.text(`${item.customDiscount}%`, leftMargin + 19.0, yPosition, { align: 'right' });
      } else {
        pdf.text('-', leftMargin + 19.0, yPosition, { align: 'right' });
      }
      
      pdf.text(formatCurrency(itemCalc.finalItemTotal), leftMargin + 22.0, yPosition, { align: 'right' });
      yPosition += 0.5; // Adjusted line spacing
    });

    // Line separator
    yPosition += 0.3;
    checkPageBreak(1.8);
    pdf.line(leftMargin, yPosition, rightMargin, yPosition);
    yPosition += 0.5;

    // Payment note section
    checkPageBreak(1.2);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CATATAN PEMBAYARAN:', leftMargin, yPosition);
    yPosition += 0.5;
    checkPageBreak(0.4);
    pdf.setFont('helvetica', 'normal');
    pdf.text(settings?.payment_note_line1 || `Harga BCA : ${formatCurrency(Math.round(detailedTotals.dppFaktur / cart.length))}/PUTRA INDRAWAN`, leftMargin, yPosition);
    yPosition += 0.4;
    checkPageBreak(0.4);
    pdf.text(settings?.payment_note_line2 || "No. Rekening: 7840656905", leftMargin, yPosition);

    // Totals section
    yPosition += 0.8;
    checkPageBreak(2.0);
    pdf.setFontSize(10); // Adjusted font size for totals
    pdf.setFont('helvetica', 'normal');

    if (receiptConfig.showAmount) {
      pdf.text('SUB TOTAL:', leftMargin + 14.0, yPosition);
      pdf.text(formatCurrency(detailedTotals.amount), rightMargin - 0.5, yPosition, { align: 'right' });
      yPosition += 0.5;
    }

    if (detailedTotals.discount > 0) {
      checkPageBreak(0.5);
      pdf.text('Total Discount:', leftMargin + 14.0, yPosition);
      pdf.text(`-${formatCurrency(detailedTotals.discount)}`, rightMargin - 0.5, yPosition, { align: 'right' });
      yPosition += 0.5;
    }

    if (receiptConfig.showDppFaktur) {
      checkPageBreak(0.5);
      pdf.text('DPP Faktur:', leftMargin + 14.0, yPosition);
      pdf.text(formatCurrency(detailedTotals.dppFaktur), rightMargin - 0.5, yPosition, { align: 'right' });
      yPosition += 0.5;
    }

    if (receiptConfig.showPpn11) {
      checkPageBreak(0.5);
      pdf.text('PPN 11%:', leftMargin + 14.0, yPosition);
      pdf.text(formatCurrency(detailedTotals.ppn11), rightMargin - 0.5, yPosition, { align: 'right' });
      yPosition += 0.5;
    }

    // Final total
    yPosition += 0.4;
    checkPageBreak(0.7);
    pdf.line(leftMargin + 14.0, yPosition, rightMargin - 0.5, yPosition);
    yPosition += 0.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12); // Adjusted total font size
    pdf.text('TOTAL:', leftMargin + 14.0, yPosition);
    pdf.text(formatCurrency(total), rightMargin - 0.5, yPosition, { align: 'right' });

    // Footer
    if (receiptHeader || receiptFooter) {
      yPosition += 1.0;
      checkPageBreak(1.0);
      pdf.line(leftMargin, yPosition, rightMargin, yPosition);
      yPosition += 0.4;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      if (receiptHeader) {
        checkPageBreak(0.4);
        pdf.text(receiptHeader, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 0.4;
      }
      if (receiptFooter) {
        checkPageBreak(0.4);
        pdf.text(receiptFooter, pageWidth / 2, yPosition, { align: 'center' });
      }
    }

    // Save PDF
    pdf.save(`Invoice-${sale.sale_number}.pdf`);
    
    // Auto-print the PDF with better user control
    try {
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Show user-friendly notification
      toast({
        title: "PDF Generated Successfully",
        description: "PDF will open in a new window for printing. Please allow popups if prompted.",
        duration: 3000,
      });
      
      // Open print window with better timing control
      const printWindow = window.open(pdfUrl, '_blank', 'width=1200,height=900,scrollbars=yes,resizable=yes,menubar=yes,toolbar=yes');
      if (printWindow) {
        // Wait for PDF to fully load before showing print dialog
        printWindow.addEventListener('load', () => {
          setTimeout(() => {
            try {
              printWindow.focus();
              printWindow.print();
              
              // Show helpful message after print dialog appears
              setTimeout(() => {
                if (!printWindow.closed) {
                  toast({
                    title: "Print Dialog Ready",
                    description: "Select your printer and settings. The window will remain open for your convenience.",
                    duration: 10000,
                  });
                }
              }, 3000);
              
            } catch (e) {
              console.log('Print dialog error:', e);
              toast({
                title: "Manual Print Required",
                description: "Please use Ctrl+P or Cmd+P in the opened window to print.",
                duration: 6000,
              });
            }
          }, 3000); // Wait 3 seconds for PDF to fully render
        });
        
        // Clean up URL when window is closed
        const checkClosed = setInterval(() => {
          if (printWindow.closed) {
            clearInterval(checkClosed);
            URL.revokeObjectURL(pdfUrl);
          }
        }, 1000);
        
        // Failsafe cleanup after 10 minutes
        setTimeout(() => {
          clearInterval(checkClosed);
          URL.revokeObjectURL(pdfUrl);
        }, 600000);
        
      } else {
        // Popup blocked - show helpful message
        toast({
          title: "Popup Blocked",
          description: "Please allow popups for this site, then try again. PDF has been downloaded as backup.",
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error) {
      console.log('Print failed:', error);
      toast({
        title: "Print Error",
        description: "Could not open print window. PDF has been downloaded to your computer instead.",
        variant: "destructive",
        duration: 6000,
      });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Cashier</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {products?.map((product) => (
                <div
                  key={product.id}
                  className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => addToCart(product)}
                >
                  <h3 className="font-medium">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">{product.sku}</p>
                  <p className="font-bold text-lg">
                    {formatCurrency(Number(product.price))}
                  </p>
                  <Badge
                    variant={
                      product.stock_quantity <= product.min_stock_level
                        ? "destructive"
                        : "default"
                    }
                  >
                    Stock: {product.stock_quantity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cart & Checkout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ShoppingCart className="h-5 w-5 mr-2" />
              Shopping Cart
              {receiptConfig.discountPercentage > 0 && (
                <Badge variant="secondary" className="ml-2">
                  Global Discount: {receiptConfig.discountPercentage}%
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Cart is empty
              </p>
            ) : (
              <>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cart.map((item) => {
                    const itemCalc = calculateDetailedPricing(item);
                    return (
                      <div
                        key={item.product.id}
                        className="border rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{item.product.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(Number(item.product.price))} each
                            </p>
                            {item.customDiscount > 0 && (
                              <p className="text-sm text-green-600">
                                Discount: {item.customDiscount}% (-{formatCurrency(itemCalc.discount)})
                              </p>
                            )}
                            <p className="text-sm font-medium">
                              Total: {formatCurrency(itemCalc.finalItemTotal)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity - 1)
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity + 1)
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeFromCart(item.product.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Item Discount Input */}
                        <div className="flex items-center space-x-2">
                          <Percent className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor={`discount-${item.product.id}`} className="text-sm">
                            Item Discount:
                          </Label>
                          <Input
                            id={`discount-${item.product.id}`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={item.customDiscount}
                            onChange={(e) =>
                              updateItemDiscount(
                                item.product.id,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-16 h-8 text-sm"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {cart.some(item => item.customDiscount > 0) && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Total Discount:</span>
                      <span>-{formatCurrency(cart.reduce((sum, item) => sum + calculateDetailedPricing(item).discount, 0))}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <div>
                    <Label htmlFor="customerName">
                      Customer Name (Optional)
                    </Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="salesName">Nama Sales</Label>
                    <Input
                      id="salesName"
                      value={selectedCashier}
                      onChange={(e) => setSelectedCashier(e.target.value)}
                      placeholder="Masukkan nama sales"
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentMethod !== "cash" && (
                    <div className="space-y-2">
                      <Label htmlFor="bankDetails">Bank Details</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="bankDetails"
                          value={bankDetails}
                          onChange={(e) => setBankDetails(e.target.value)}
                          placeholder="Enter bank name, account number, etc."
                          className="flex-1"
                        />
                        {paymentMethod === "transfer" && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowMidtransPayment(true)}
                            disabled={cart.length === 0}
                          >
                            Use Midtrans
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="paymentReceived">Payment Received</Label>
                    <Input
                      id="paymentReceived"
                      type="number"
                      step="0.01"
                      value={paymentReceived}
                      onChange={(e) =>
                        setPaymentReceived(parseFloat(e.target.value) || 0)
                      }
                      placeholder="Enter payment amount"
                    />
                    {paymentMethod !== "cash" && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Auto-filled with total amount for non-cash payments
                      </p>
                    )}
                  </div>

                  {paymentReceived > 0 && (
                    <div className="flex justify-between text-lg">
                      <span>Change:</span>
                      <span
                        className={
                          change < 0 ? "text-red-600" : "text-green-600"
                        }
                      >
                        {formatCurrency(Math.max(0, change))}
                      </span>
                      {change < 0 && (
                        <span className="text-red-600 text-sm">
                          Insufficient: {formatCurrency(Math.abs(change))} short
                        </span>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setShowPreCheckout(true)}
                      disabled={cart.length === 0}
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      Special Customer Pricing (Optional)
                    </Button>

                    <Button
                      className="w-full"
                      onClick={() => processSaleMutation.mutate()}
                      disabled={
                        cart.length === 0 ||
                        (paymentMethod === "cash" && paymentReceived < total) ||
                        processSaleMutation.isPending
                      }
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      {processSaleMutation.isPending
                        ? "Processing..."
                        : "Complete Sale"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <PreCheckoutDialog
        open={showPreCheckout}
        onOpenChange={setShowPreCheckout}
        cart={cart}
        onCartUpdate={setCart}
        onProceedToPayment={handlePreCheckoutProceed}
      />

      <MidtransPayment
        open={showMidtransPayment}
        onOpenChange={setShowMidtransPayment}
        amount={total}
        customerName={customerName}
        onPaymentSuccess={handleMidtransPaymentSuccess}
        onPaymentError={handleMidtransPaymentError}
      />
    </div>
  );
};

export default Cashier;