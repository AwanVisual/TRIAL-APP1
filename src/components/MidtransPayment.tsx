import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard, Smartphone, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { MIDTRANS_CONFIG, generateOrderId, formatMidtransAmount } from '@/lib/midtrans';

interface MidtransPaymentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  customerName?: string;
  onPaymentSuccess: (paymentData: any) => void;
  onPaymentError: (error: any) => void;
}

const MidtransPayment = ({
  open,
  onOpenChange,
  amount,
  customerName,
  onPaymentSuccess,
  onPaymentError
}: MidtransPaymentProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const { toast } = useToast();

  const initiateMidtransPayment = async () => {
    setIsLoading(true);
    
    try {
      // Generate unique order ID
      const orderId = generateOrderId('POS');
      
      // Prepare transaction details
      const transactionDetails = {
        order_id: orderId,
        gross_amount: formatMidtransAmount(amount),
        customer_details: {
          first_name: customerName || 'Customer',
          email: 'customer@example.com',
          phone: '08123456789'
        },
        item_details: [{
          id: 'pos-transaction',
          price: formatMidtransAmount(amount),
          quantity: 1,
          name: 'POS Transaction'
        }]
      };

      // Call Midtrans API directly (for demo purposes)
      // In production, this should be done through your backend
      const response = await fetch(`${MIDTRANS_CONFIG.apiUrl}/charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Basic ${btoa(MIDTRANS_CONFIG.serverKey + ':')}`
        },
        body: JSON.stringify({
          ...transactionDetails,
          payment_type: 'bank_transfer',
          bank_transfer: {
            bank: 'bca'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_messages?.[0] || 'Failed to create transaction');
      }

      const result = await response.json();
      
      // Create payment methods based on Midtrans response
      const paymentMethods = [
        {
          type: 'bank_transfer',
          bank: 'bca',
          name: 'BCA Virtual Account',
          icon: Building,
          va_number: result.va_numbers?.[0]?.va_number || '1234567890123456',
          transaction_id: result.transaction_id
        },
        {
          type: 'bank_transfer',
          bank: 'bni',
          name: 'BNI Virtual Account',
          icon: Building,
          va_number: '9876543210987654',
          transaction_id: orderId
        },
        {
          type: 'bank_transfer',
          bank: 'mandiri',
          name: 'Mandiri Virtual Account',
          icon: Building,
          va_number: '5555666677778888',
          transaction_id: orderId
        },
        {
          type: 'echannel',
          bank: 'mandiri',
          name: 'Mandiri e-Channel',
          icon: Smartphone,
          bill_key: '123456',
          biller_code: '70012',
          transaction_id: orderId
        }
      ];

      setPaymentMethods(paymentMethods);
      
      toast({
        title: "Payment Methods Ready",
        description: "Please select a payment method to continue"
      });

    } catch (error: any) {
      console.error('Midtrans payment error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initialize payment",
        variant: "destructive"
      });
      onPaymentError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentMethodSelect = (method: any) => {
    setSelectedMethod(method.type);
    
    // Mock successful payment for demo
    // In real implementation, you would handle the actual payment flow
    setTimeout(() => {
      const paymentData = {
        transaction_id: method.transaction_id || `TXN-${Date.now()}`,
        order_id: generateOrderId('POS'),
        payment_type: method.type,
        bank: method.bank,
        va_number: method.va_number,
        amount: amount,
        status: 'settlement',
        transaction_time: new Date().toISOString()
      };
      
      onPaymentSuccess(paymentData);
      onOpenChange(false);
      
      toast({
        title: "Payment Successful",
        description: `Payment via ${method.name} completed successfully`,
        duration: 5000
      });
    }, 2000);
  };

  const renderPaymentMethod = (method: any, index: number) => {
    const Icon = method.icon;
    
    return (
      <Card 
        key={index} 
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => handlePaymentMethodSelect(method)}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Icon className="h-8 w-8 text-blue-600" />
            <div className="flex-1">
              <h3 className="font-medium">{method.name}</h3>
              {method.va_number && (
                <p className="text-sm text-gray-600">VA: {method.va_number}</p>
              )}
              {method.bill_key && (
                <div className="text-sm text-gray-600">
                  <p>Bill Key: {method.bill_key}</p>
                  <p>Biller Code: {method.biller_code}</p>
                </div>
              )}
              {method.transaction_id && (
                <p className="text-xs text-gray-500">ID: {method.transaction_id}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-bold text-green-600">{formatCurrency(amount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Midtrans Payment Gateway
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-medium">{customerName || 'Walk-in Customer'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="font-bold text-lg text-green-600">{formatCurrency(amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <Button 
                onClick={initiateMidtransPayment} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Initializing Payment...
                  </>
                ) : (
                  'Initialize Midtrans Payment'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-medium">Select Payment Method:</h3>
              <div className="space-y-3">
                {paymentMethods.map(renderPaymentMethod)}
              </div>
            </div>
          )}

          <div className="text-center text-sm text-gray-500">
            <p>Powered by Midtrans Payment Gateway</p>
            <p>Secure and reliable payment processing</p>
            <p className="text-xs mt-1">Sandbox Mode - For Testing Only</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MidtransPayment;