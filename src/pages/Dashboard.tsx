
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  AlertTriangle,
  DollarSign
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const Dashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [
        { count: totalProducts },
        { data: lowStockProducts },
        { data: todaySales },
        { data: totalSalesValue }
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact' }),
        supabase.from('products').select('*').lt('stock_quantity', 10),
        supabase.from('sales').select('*').gte('created_at', new Date().toISOString().split('T')[0]),
        supabase.from('sales').select('total_amount')
      ]);

      const todayRevenue = todaySales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;
      const totalRevenue = totalSalesValue?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;

      return {
        totalProducts: totalProducts || 0,
        lowStockCount: lowStockProducts?.length || 0,
        todaySales: todaySales?.length || 0,
        todayRevenue,
        totalRevenue,
        lowStockProducts: lowStockProducts || []
      };
    },
  });

  const { data: recentSales } = useQuery({
    queryKey: ['recent-sales'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todaySales}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.todayRevenue || 0)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.lowStockCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Alert</CardTitle>
            <CardDescription>Products running low on stock</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.lowStockProducts?.length === 0 ? (
              <p className="text-muted-foreground">All products are well stocked!</p>
            ) : (
              <div className="space-y-2">
                {stats?.lowStockProducts?.slice(0, 5).map((product: any) => (
                  <div key={product.id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                    <span className="font-medium">{product.name}</span>
                    <span className="text-red-600 font-bold">{product.stock_quantity} left</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>Latest transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSales?.length === 0 ? (
              <p className="text-muted-foreground">No sales recorded yet</p>
            ) : (
              <div className="space-y-2">
                {recentSales?.map((sale) => (
                  <div key={sale.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <p className="font-medium">{sale.sale_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(sale.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-bold text-green-600">
                      {formatCurrency(Number(sale.total_amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
