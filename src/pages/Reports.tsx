import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BarChart3, Download, TrendingUp, Package, ShoppingCart, Calendar, Edit, Printer, Save, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { toast } from '@/hooks/use-toast';

const Reports = () => {
  const [dateRange, setDateRange] = useState('today');
  const [selectedTab, setSelectedTab] = useState('sales');
  const [editingSale, setEditingSale] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const queryClient = useQueryClient();
  const [editingItems, setEditingItems] = useState<string | null>(null);
  const [editItemsData, setEditItemsData] = useState<any[]>([]);

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'week':
        const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: weekStart, end: now };
      case 'month':
        const monthStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start: monthStart, end: now };
      default:
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    }
  };

  const { start, end } = getDateRange();

  // Fetch sales data
  const { data: salesData } = useQuery({
    queryKey: ['sales-reports', dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select(`
          *,
          sale_items (
            *,
            products (name, sku, price)
          ),
          cashier:profiles!cashier_id (
            full_name
          )
        `)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

    // Fetch all products
    const { data: allProducts } = useQuery({
      queryKey: ['products'],
      queryFn: async () => {
        const { data } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true });
        return data || [];
      },
    });

  // Fetch product inventory data
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory-reports'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('stock_quantity', { ascending: true });
      return data || [];
    },
  });

  // Fetch stock movements
  const { data: stockMovements } = useQuery({
    queryKey: ['stock-movements', dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from('stock_movements')
        .select('*, products(name, sku)')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Fetch settings for receipt printing
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*');
      const settingsMap: Record<string, string> = {};
      data?.forEach(setting => {
        settingsMap[setting.key] = setting.value || '';
      });
      return settingsMap;
    },
  });

  // Update sale mutation
  const updateSaleMutation = useMutation({
    mutationFn: async (updatedSale: any) => {
      const { error } = await supabase
        .from('sales')
        .update({
          customer_name: updatedSale.customer_name,
          payment_method: updatedSale.payment_method,
          invoice_status: updatedSale.invoice_status,
          notes: updatedSale.notes,
        })
        .eq('id', updatedSale.id);

      if (error) throw error;
      return updatedSale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-reports'] });
      setEditingSale(null);
      toast({
        title: "Success",
        description: "Sale updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update sale items mutation
  const updateSaleItemsMutation = useMutation({
    mutationFn: async (updatedItems: any[]) => {
      // Delete existing items
      const { error: deleteError } = await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', editingItems);

      if (deleteError) throw deleteError;

      // Insert updated items
      const { error: insertError } = await supabase
        .from('sale_items')
        .insert(
          updatedItems.map(item => {
            const price = Number(item.unit_price);
            const quantity = item.quantity;
            const discount = item.discount || 0;
            const dpp11 = (100 / 111) * price;
            const discountAmount = (discount / 100) * dpp11;
            const dppFaktur = dpp11 - discountAmount;
            const ppn11 = 0.11 * dppFaktur;
            const subtotal = (dppFaktur + ppn11) * quantity;

            return {
              sale_id: editingItems,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount: item.discount,
              subtotal: subtotal,
            };
          })
        );

      if (insertError) throw insertError;
      return updatedItems;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-reports'] });
      setEditingItems(null);
      toast({
        title: "Success",
        description: "Sale items updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate sales metrics
  const totalSales = salesData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;
  const totalTransactions = salesData?.length || 0;
  const averageSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;
  const totalItemsSold = salesData?.reduce((sum, sale) => 
    sum + (sale.sale_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0
  ) || 0;

  // Prepare chart data
  const chartData = salesData?.reduce((acc, sale) => {
    const date = new Date(sale.created_at!).toLocaleDateString();
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.amount += Number(sale.total_amount);
      existing.transactions += 1;
    } else {
      acc.push({
        date,
        amount: Number(sale.total_amount),
        transactions: 1,
      });
    }
    return acc;
  }, [] as Array<{ date: string; amount: number; transactions: number }>) || [];

  // Low stock products
  const lowStockProducts = inventoryData?.filter(product => 
    product.stock_quantity <= (product.min_stock_level || 10)
  ) || [];

  // Handle edit sale
  const handleEditSale = (sale: any) => {
    setEditingSale(sale.id);
    setEditFormData({
      id: sale.id,
      customer_name: sale.customer_name || '',
      payment_method: sale.payment_method,
      invoice_status: sale.invoice_status || 'lunas',
      notes: sale.notes || '',
    });
  };

  const handleSaveEdit = () => {
    updateSaleMutation.mutate(editFormData);
  };

  const handleCancelEdit = () => {
    setEditingSale(null);
    setEditFormData({});
  };

  // Handle edit items
  const handleEditItems = (sale: any) => {
    setEditingItems(sale.id);
    setEditItemsData(sale.sale_items || []);
  };

  const handleSaveItems = () => {
    updateSaleItemsMutation.mutate(editItemsData);
  };

  const handleCancelEditItems = () => {
    setEditingItems(null);
    setEditItemsData([]);
  };

  const updateEditItem = (index: number, key: string, value: any) => {
    const updatedItems = [...editItemsData];
    updatedItems[index][key] = value;
    setEditItemsData(updatedItems);
  };

  const addEditItem = () => {
    setEditItemsData([
      ...editItemsData,
      {
        product_id: '',
        quantity: 1,
        unit_price: 0,
        discount: 0,
        subtotal: 0,
      },
    ]);
  };

  const removeEditItem = (index: number) => {
    const updatedItems = [...editItemsData];
    updatedItems.splice(index, 1);
    setEditItemsData(updatedItems);
  };

  // Print receipt function
  const printReceipt = async (sale: any) => {
    const logoUrl = settings?.company_logo ? settings.company_logo : "";
    const storeName = settings?.store_name || "";
    const storeAddress = settings?.store_address || "";
    const storePhone = settings?.store_phone || "";
    const storeEmail = settings?.store_email || "";
    const storeWebsite = settings?.store_website || "";
    const receiptHeader = settings?.receipt_header || "";
    const receiptFooter = settings?.receipt_footer || "";

    const salesName = (() => {
      if (sale.notes && sale.notes.includes('Sales: ')) {
        const salesMatch = sale.notes.match(/Sales: ([^|]+)/);
        return salesMatch ? salesMatch[1].trim() : 'Unknown';
      }
      return sale.cashier?.full_name || 'Unknown';
    })();

    // Calculate detailed pricing for each item (matching cashier calculation exactly)
    const calculateItemPricing = (item: any) => {
      const price = Number(item.unit_price);
      const quantity = item.quantity;
      const itemDiscount = item.discount || 0;

      const amount = quantity * price;
      const dpp11 = (100 / 111) * price;
      const discount = (itemDiscount / 100) * dpp11;
      const dppFaktur = dpp11 - discount;

      // PPN 11% calculation
      const ppn11 = 0.11 * dppFaktur;

      return {
        amount,
        discount: discount * quantity,
        dppFaktur: dppFaktur * quantity,
        ppn11: ppn11 * quantity,
        finalItemTotal: (dppFaktur + ppn11) * quantity,
      };
    };

    // Calculate totals using the same logic as cashier
    const detailedTotals = sale.sale_items?.reduce(
      (totals: any, item: any) => {
        const itemCalc = calculateItemPricing(item);
        return {
          amount: totals.amount + itemCalc.amount,
          discount: totals.discount + itemCalc.discount,
          dppFaktur: totals.dppFaktur + itemCalc.dppFaktur,
          ppn11: totals.ppn11 + itemCalc.ppn11,
        };
      },
      { amount: 0, discount: 0, dppFaktur: 0, ppn11: 0 },
    ) || { amount: 0, discount: 0, dppFaktur: 0, ppn11: 0 };

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
    sale.sale_items?.forEach((item: any) => {
      checkPageBreak(0.5);
      const itemCalc = calculateItemPricing(item);

      // Product name (wrap if too long) - adjusted for 24cm width
      const productName = (item.products?.name || 'Unknown Product').length > 50 ? 
        (item.products?.name || 'Unknown Product').substring(0, 50) + '...' : 
        (item.products?.name || 'Unknown Product');

      pdf.text(productName, leftMargin, yPosition);
      pdf.text(item.quantity.toString(), leftMargin + 12.0, yPosition, { align: 'center' });
      pdf.text(formatCurrency(item.unit_price), leftMargin + 16.0, yPosition, { align: 'right' });

      if (item.discount > 0) {
        pdf.text(`${item.discount}%`, leftMargin + 19.0, yPosition, { align: 'right' });
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
    pdf.text(settings?.payment_note_line1 || `Harga BCA : ${formatCurrency(Math.round(detailedTotals.dppFaktur / (sale.sale_items?.length || 1)))}/PUTRA INDRAWAN`, leftMargin, yPosition);
    yPosition += 0.4;
    checkPageBreak(0.4);
    pdf.text(settings?.payment_note_line2 || "No. Rekening: 7840656905", leftMargin, yPosition);

    // Totals section
    yPosition += 0.8;
    checkPageBreak(2.0);
    pdf.setFontSize(10); // Adjusted font size for totals
    pdf.setFont('helvetica', 'normal');

    checkPageBreak(0.5);
    pdf.text('SUB TOTAL:', leftMargin + 14.0, yPosition);
    pdf.text(formatCurrency(detailedTotals.amount), rightMargin - 0.5, yPosition, { align: 'right' });
    yPosition += 0.5;

    if (detailedTotals.discount > 0) {
      checkPageBreak(0.5);
      pdf.text('Total Discount:', leftMargin + 14.0, yPosition);
      pdf.text(`-${formatCurrency(detailedTotals.discount)}`, rightMargin - 0.5, yPosition, { align: 'right' });
      yPosition += 0.5;
    }

    checkPageBreak(0.5);
    pdf.text('DPP Faktur:', leftMargin + 14.0, yPosition);
    pdf.text(formatCurrency(detailedTotals.dppFaktur), rightMargin - 0.5, yPosition, { align: 'right' });
    yPosition += 0.5;

    checkPageBreak(0.5);
    pdf.text('PPN 11%:', leftMargin + 14.0, yPosition);
    pdf.text(formatCurrency(detailedTotals.ppn11), rightMargin - 0.5, yPosition, { align: 'right' });

    // Final total
    yPosition += 0.4;
    checkPageBreak(0.7);
    pdf.line(leftMargin + 14.0, yPosition, rightMargin - 0.5, yPosition);
    yPosition += 0.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12); // Adjusted total font size
    pdf.text('TOTAL:', leftMargin + 14.0, yPosition);
    pdf.text(formatCurrency(detailedTotals.dppFaktur + detailedTotals.ppn11), rightMargin - 0.5, yPosition, { align: 'right' });

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

  // Export functionality
  const exportData = () => {
    // Import xlsx library dinamically
    import('xlsx').then((XLSX) => {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = [
        ['Report Summary', ''],
        ['Date Range', dateRange],
        ['Export Date', new Date().toLocaleDateString()],
        ['Total Sales', formatCurrency(totalSales)],
        ['Total Transactions', totalTransactions],
        ['Average Sale', formatCurrency(averageSale)],
        ['Total Items Sold', totalItemsSold],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // Sales Sheet
      if (salesData && salesData.length > 0) {
        const salesHeaders = ['Sale Number', 'Date', 'Customer', 'Nama Sales', 'Payment Method', 'Invoice Status', 'Bank Details', 'Total Amount', 'Items Count'];
        const salesRows = salesData.map(sale => [
          sale.sale_number,
          new Date(sale.created_at!).toLocaleDateString(),
          sale.customer_name || 'Walk-in Customer',
          (() => {
            if (sale.notes && sale.notes.includes('Sales: ')) {
              const salesMatch = sale.notes.match(/Sales: ([^|]+)/);
              return salesMatch ? salesMatch[1].trim() : 'Unknown';
            }
            return sale.cashier?.full_name || 'Unknown';
          })(),
          sale.payment_method,
          sale.invoice_status || 'lunas',
          (() => {
            if (sale.payment_method === 'transfer' && sale.notes) {
              if (sale.notes.includes('Bank Details: ')) {
                const bankMatch = sale.notes.match(/Bank Details: (.+)/);
                return bankMatch ? bankMatch[1].trim() : '-';
              }
            }
            return '-';
          })(),
          Number(sale.total_amount),
          sale.sale_items?.length || 0
        ]);
        const salesSheet = XLSX.utils.aoa_to_sheet([salesHeaders, ...salesRows]);
        XLSX.utils.book_append_sheet(wb, salesSheet, 'Sales');
      }

      // Inventory Sheet
      if (inventoryData && inventoryData.length > 0) {
        const inventoryHeaders = ['Product Name', 'SKU', 'Category', 'Stock Quantity', 'Min Level', 'Cost', 'Price', 'Stock Value', 'Status'];
        const inventoryRows = inventoryData.map(product => [
          product.name,
          product.sku,
          product.categories?.name || 'No Category',
          product.stock_quantity,
          product.min_stock_level,
          Number(product.cost),
          Number(product.price),
          Number(product.cost) * product.stock_quantity,
          product.stock_quantity <= (product.min_stock_level || 10) ? 'Low Stock' : 'In Stock'
        ]);
        const inventorySheet = XLSX.utils.aoa_to_sheet([inventoryHeaders, ...inventoryRows]);
        XLSX.utils.book_append_sheet(wb, inventorySheet, 'Inventory');
      }

      // Stock Movements Sheet
      if (stockMovements && stockMovements.length > 0) {
        const movementsHeaders = ['Date', 'Product Name', 'SKU', 'Type', 'Quantity', 'Reference', 'Notes'];
        const movementsRows = stockMovements.map(movement => [
          new Date(movement.created_at!).toLocaleDateString(),
          movement.products?.name || '',
          movement.products?.sku || '',
          movement.transaction_type,
          movement.quantity,
          movement.reference_number || '',
          movement.notes || ''
        ]);
        const movementsSheet = XLSX.utils.aoa_to_sheet([movementsHeaders, ...movementsRows]);
        XLSX.utils.book_append_sheet(wb, movementsSheet, 'Stock Movements');
      }

      // Write file
      const fileName = `pos-reports-${dateRange}-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    });
  };

  const getInvoiceStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'lunas': return 'default';
      case 'dp': return 'secondary';
      case 'belum_bayar': return 'destructive';
      default: return 'default';
    }
  };

  const getInvoiceStatusLabel = (status: string) => {
    switch (status) {
      case 'lunas': return 'Lunas';
      case 'dp': return 'DP';
      case 'belum_bayar': return 'Belum Bayar';
      default: return 'Lunas';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-gray-600">View sales and inventory reports</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportData} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Reports
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sales">Sales Reports</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Reports</TabsTrigger>
          <TabsTrigger value="movements">Stock Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
                <p className="text-xs text-muted-foreground">
                  {dateRange === 'today' ? 'Today' : `Last ${dateRange === 'week' ? '7' : '30'} days`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalTransactions}</div>
                <p className="text-xs text-muted-foreground">Total transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Sale</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(averageSale)}</div>
                <p className="text-xs text-muted-foreground">Per transaction</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Items Sold</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalItemsSold}</div>
                <p className="text-xs text-muted-foreground">Total quantity</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sales Trend</CardTitle>
                <CardDescription>Daily sales over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Sales']} />
                    <Line type="monotone" dataKey="amount" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction Volume</CardTitle>
                <CardDescription>Number of transactions per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="transactions" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
              <CardDescription>Latest transactions from the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Nama Sales</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Invoice Status</TableHead>
                    <TableHead>Bank Details</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData?.slice(0, 10).map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.sale_number}</TableCell>
                      <TableCell>{formatDate(sale.created_at!)}</TableCell>
                      <TableCell>
                        {editingSale === sale.id ? (
                          <Input
                            value={editFormData.customer_name}
                            onChange={(e) => setEditFormData({...editFormData, customer_name: e.target.value})}
                            placeholder="Customer name"
                          />
                        ) : (
                          sale.customer_name || 'Walk-in Customer'
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          if (sale.notes && sale.notes.includes('Sales: ')) {
                            const salesMatch = sale.notes.match(/Sales: ([^|]+)/);
                            return salesMatch ? salesMatch[1].trim() : 'Unknown';
                          }
                          return sale.cashier?.full_name || 'Unknown';
                        })()}
                      </TableCell>
                      <TableCell>
                        {editingSale === sale.id ? (
                          <Select
                            value={editFormData.payment_method}
                            onValueChange={(value) => setEditFormData({...editFormData, payment_method: value})}
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
                        ) : (
                          <Badge variant="outline">{sale.payment_method}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingSale === sale.id ? (
                          <Select
                            value={editFormData.invoice_status}
                            onValueChange={(value) => setEditFormData({...editFormData, invoice_status: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lunas">Lunas</SelectItem>
                              <SelectItem value="dp">DP</SelectItem>
                              <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={getInvoiceStatusBadgeVariant(sale.invoice_status || 'lunas')}>
                            {getInvoiceStatusLabel(sale.invoice_status || 'lunas')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingSale === sale.id ? (
                          <Input
                            value={editFormData.notes}
                            onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                            placeholder="Bank details"
                          />
                        ) : (
                          (() => {
                            if (sale.payment_method === 'transfer' && sale.notes && sale.notes.includes('Bank Details: ')) {
                              const bankMatch = sale.notes.match(/Bank Details: (.+)/);
                              return bankMatch ? (
                                <div className="text-sm">
                                  {bankMatch[1].trim()}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              );
                            }
                            return <span className="text-muted-foreground">-</span>;
                          })()
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(Number(sale.total_amount))}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {editingSale === sale.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={updateSaleMutation.isPending}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditSale(sale)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => printReceipt(sale)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditItems(sale)}
                              >
                                Edit Items
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Edit Items Dialog */}
          <Dialog open={!!editingItems} onOpenChange={() => setEditingItems(null)}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Sale Items</DialogTitle>
                <DialogDescription>
                  Modify the items, quantities, and discounts for this sale
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Sale Items</h4>
                  <Button size="sm" onClick={addEditItem}>
                    Add Item
                  </Button>
                </div>

                <div className="space-y-2">
                  {editItemsData.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-6 gap-2 items-end p-2 border rounded">
                      <div>
                        <label className="text-sm font-medium">Product</label>
                        <Select
                          value={item.product_id}
                          onValueChange={(value) => updateEditItem(index, 'product_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {allProducts?.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} - {formatCurrency(product.price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Quantity</label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateEditItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Unit Price</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateEditItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Discount (%)</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.discount}
                          onChange={(e) => updateEditItem(index, 'discount', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Subtotal</label>
                        <div className="p-2 bg-gray-50 rounded text-sm">
                          {formatCurrency(
                            (() => {
                              const price = Number(item.unit_price);
                              const quantity = item.quantity;
                              const discount = item.discount || 0;
                              const dpp11 = (100 / 111) * price;
                              const discountAmount = (discount / 100) * dpp11;
                              const dppFaktur = dpp11 - discountAmount;
                              const ppn11 = 0.11 * dppFaktur;
                              return (dppFaktur + ppn11) * quantity;
                            })()
                          )}
                        </div>
                      </div>

                      <div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeEditItem(index)}
                          disabled={editItemsData.length === 1}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <div className="text-right space-y-2">
                    <div className="text-lg font-semibold">
                      Total: {formatCurrency(
                        editItemsData.reduce((total, item) => {
                          const price = Number(item.unit_price);
                          const quantity = item.quantity;
                          const discount = item.discount || 0;
                          const dpp11 = (100 / 111) * price;
                          const discountAmount = (discount / 100) * dpp11;
                          const dppFaktur = dpp11 - discountAmount;
                          const ppn11 = 0.11 * dppFaktur;
                          return total + (dppFaktur + ppn11) * quantity;
                        }, 0)
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCancelEditItems}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveItems}
                  disabled={updateSaleItemsMutation.isPending || editItemsData.some(item => !item.product_id)}
                >
                  {updateSaleItemsMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Low Stock Alert</CardTitle>
                <CardDescription>Products below minimum stock level</CardDescription>
              </CardHeader>
              <CardContent>
                {lowStockProducts.length > 0 ? (
                  <div className="space-y-2">
                    {lowStockProducts.map((product) => (
                      <div key={product.id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-600">{product.sku}</p>
                        </div>
                        <Badge variant="destructive">
                          {product.stock_quantity} left
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">All products have sufficient stock</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Summary</CardTitle>
                <CardDescription>Overview of current stock levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Products</span>
                    <span className="font-medium">{inventoryData?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Low Stock Products</span>
                    <span className="font-medium text-red-600">{lowStockProducts.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Stock Value</span>
                    <span className="font-medium">
                      {formatCurrency(
                        inventoryData?.reduce((sum, product) => 
                          sum + (Number(product.cost) * product.stock_quantity), 0
                        ) || 0
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Inventory Details</CardTitle>
              <CardDescription>Complete product inventory status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Min Level</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryData?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.categories?.name || 'No Category'}</TableCell>
                      <TableCell>{product.stock_quantity}</TableCell>
                      <TableCell>{product.min_stock_level}</TableCell>
                      <TableCell>
                        {formatCurrency(Number(product.cost) * product.stock_quantity)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            product.stock_quantity <= (product.min_stock_level || 10)
                              ? "destructive"
                              : "default"
                          }
                        >
                          {product.stock_quantity <= (product.min_stock_level || 10)
                            ? "Low Stock"
                            : "In Stock"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock Movement History</CardTitle>
              <CardDescription>Track all inventory changes for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockMovements?.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{formatDate(movement.created_at!)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{movement.products?.name}</p>
                          <p className="text-sm text-gray-600">{movement.products?.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            movement.transaction_type === 'inbound'
                              ? "default"
                              : movement.transaction_type === 'outbound'
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {movement.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={
                          movement.transaction_type === 'inbound'
                            ? "text-green-600"
                            : movement.transaction_type === 'outbound'
                            ? "text-red-600"
                            : "text-blue-600"
                        }>
                          {movement.transaction_type === 'inbound' ? '+' : 
                           movement.transaction_type === 'outbound' ? '-' : ''}
                          {movement.quantity}
                        </span>
                      </TableCell>
                      <TableCell>{movement.reference_number || '-'}</TableCell>
                      <TableCell>{movement.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;