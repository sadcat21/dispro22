import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkerPermissions } from '@/hooks/usePermissions';
import { useIsElementHidden } from '@/hooks/useUIOverrides';
import ProductGrid from '@/components/promo/ProductGrid';
import AddPromoDialog from '@/components/promo/AddPromoDialog';
import DirectSaleDialog from '@/components/warehouse/DirectSaleDialog';
import CustomerActionDialog from '@/components/orders/CustomerActionDialog';
import CreateOrderDialog from '@/components/orders/CreateOrderDialog';
import { useTrackVisit } from '@/hooks/useVisitTracking';
import { Customer } from '@/types/database';
import { toast } from 'sonner';
import { ShoppingCart, Gift, Loader2, ShoppingBag, Truck, Package, Banknote, Users, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const WorkerHome: React.FC = () => {
  const { user, workerId } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: permissions = [], isLoading: permissionsLoading } = useWorkerPermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [showDirectSaleDialog, setShowDirectSaleDialog] = useState(false);
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [selectedCustomerForAction, setSelectedCustomerForAction] = useState<Customer | null>(null);

  const { trackVisit } = useTrackVisit();
  const isDirectSaleHidden = useIsElementHidden('button', 'home_direct_sale');
  const isCreateOrderHidden = useIsElementHidden('button', 'home_orders');
  const isAddCustomerHidden = useIsElementHidden('button', 'home_customers');
  const isAddPromoHidden = useIsElementHidden('button', 'home_promos');
  const isCollectDebtHidden = useIsElementHidden('button', 'home_debts');
  const isDeliveriesHidden = useIsElementHidden('button', 'home_deliveries');
  const isMyStockHidden = useIsElementHidden('button', 'home_my_stock');
  const isExpensesHidden = useIsElementHidden('button', 'home_expenses');
  const isOrdersPageHidden = useIsElementHidden('page', '/orders');
  const isDeliveriesPageHidden = useIsElementHidden('page', '/my-deliveries');
  const isMyStockPageHidden = useIsElementHidden('page', '/my-stock');
  const isCustomersPageHidden = useIsElementHidden('page', '/customers');
  const isExpensesPageHidden = useIsElementHidden('page', '/expenses');
  const isMyPromosPageHidden = useIsElementHidden('page', '/my-promos');
  const isDebtsPageHidden = useIsElementHidden('page', '/customer-debts');

  const { data: stockItems } = useQuery({
    queryKey: ['my-worker-stock', workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_stock')
        .select('*, product:products(*)')
        .eq('worker_id', workerId!)
        .gt('quantity', 0);
      if (error) throw error;
      return data;
    },
    enabled: !!workerId,
  });

  // Check permissions
  const hasPromoAccess = permissions.some(p =>
    ['view_promos', 'create_promos', 'page_promos'].includes(p.permission_code)
  );
  const hasOrdersAccess = permissions.some(p =>
    ['view_orders', 'create_orders', 'page_orders'].includes(p.permission_code)
  );
  const hasDeliveryAccess = permissions.some(p =>
    ['view_assigned_orders', 'update_order_status'].includes(p.permission_code)
  );
  const hasDebtAccess = permissions.some(p =>
    ['page_customer_debts', 'view_customer_debts', 'collect_debts'].includes(p.permission_code)
  );
  const hasCustomerAccess = permissions.some(p =>
    ['page_customers'].includes(p.permission_code)
  );
  const hasExpenseAccess = true; // All workers can access expenses

  useEffect(() => {
    if (!permissionsLoading && hasPromoAccess) {
      fetchProducts();
    } else if (!permissionsLoading) {
      setIsLoading(false);
    }
  }, [hasPromoAccess, permissionsLoading]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error(t('products.loading_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setShowPromoDialog(true);
  };

  // Determine welcome message based on permissions
  const getWelcomeMessage = () => {
    if (permissionsLoading) return t('common.loading_permissions');
    if (hasPromoAccess) {
      return t('products.choose');
    }
    if (hasOrdersAccess) {
      return t('orders.manage');
    }
    return t('common.welcome');
  };

  // Loading skeleton for permissions
  if (permissionsLoading) {
    return (
      <div className="pb-4">
        {/* Welcome Section */}
        <div className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground p-6">
          <h2 className="text-xl font-bold mb-1">{t('common.welcome')} {user?.full_name} 👋</h2>
          <p className="text-primary-foreground/80 text-sm">{t('common.loading_permissions')}</p>
        </div>

        {/* Loading Skeleton */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Welcome Section */}
      <div className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground p-6">
        <h2 className="text-xl font-bold mb-1">{t('common.welcome')} {user?.full_name} 👋</h2>
        <p className="text-primary-foreground/80 text-sm">
          {getWelcomeMessage()}
        </p>
      </div>

      {/* Content based on permissions */}
      {hasPromoAccess ? (
        <>
          {/* Products Section for Promo */}
          <div className="mt-4">
            <div className="px-4 mb-2">
              <h3 className="text-lg font-bold">{t('products.list')}</h3>
            </div>
            <ProductGrid
              products={products}
              onProductSelect={handleProductSelect}
              isLoading={isLoading}
            />
          </div>

          {/* Add Promo Dialog */}
          <AddPromoDialog
            open={showPromoDialog}
            onOpenChange={setShowPromoDialog}
            product={selectedProduct}
            onSuccess={() => {
              // Optionally refresh data
            }}
          />
        </>
      ) : (hasOrdersAccess || hasDeliveryAccess || hasDebtAccess) ? (
        (() => {
          // Build visible actions dynamically
          const quickActions: { key: string; icon: React.ReactNode; label: string; onClick: () => void; variant: 'primary' | 'secondary' | 'outline' | 'destructive' }[] = [];

          if (hasDeliveryAccess && !isDeliveriesPageHidden && !isDeliveriesHidden) {
            quickActions.push({ key: 'deliveries', icon: <Truck className="w-5 h-5" />, label: t('deliveries.title'), onClick: () => navigate('/my-deliveries'), variant: 'primary' });
          }
          if (hasDeliveryAccess && !isDirectSaleHidden) {
            quickActions.push({ key: 'direct-sale', icon: <ShoppingBag className="w-5 h-5 text-primary" />, label: t('stock.direct_sale'), onClick: () => setShowActionDialog(true), variant: 'secondary' });
          }
          if (hasDeliveryAccess && !isMyStockPageHidden && !isMyStockHidden) {
            quickActions.push({ key: 'my-stock', icon: <Package className="w-5 h-5 text-foreground" />, label: t('stock.my_stock'), onClick: () => navigate('/my-stock'), variant: 'outline' });
          }
          if (hasOrdersAccess && !isOrdersPageHidden && !isCreateOrderHidden) {
            quickActions.push({ key: 'orders', icon: <ShoppingCart className="w-5 h-5" />, label: t('orders.manage'), onClick: () => navigate('/orders'), variant: 'primary' });
          }
          if (hasOrdersAccess && !hasDeliveryAccess && !isMyPromosPageHidden) {
            quickActions.push({ key: 'promos', icon: <Gift className="w-5 h-5 text-primary" />, label: t('promos.add_new'), onClick: () => navigate('/my-promos'), variant: 'secondary' });
          }
          if (hasDebtAccess && !isCollectDebtHidden && !isDebtsPageHidden) {
            quickActions.push({ key: 'debts', icon: <Banknote className="w-5 h-5 text-destructive" />, label: t('debts.title'), onClick: () => navigate('/customer-debts'), variant: 'destructive' });
          }
          if (hasCustomerAccess && !isCustomersPageHidden && !isAddCustomerHidden) {
            quickActions.push({ key: 'customers', icon: <Users className="w-5 h-5 text-foreground" />, label: t('nav.customers'), onClick: () => navigate('/customers'), variant: 'outline' });
          }
          if (hasExpenseAccess && !isExpensesPageHidden && !isExpensesHidden) {
            quickActions.push({ key: 'expenses', icon: <Wallet className="w-5 h-5 text-foreground" />, label: t('expenses.my_expenses'), onClick: () => navigate('/expenses'), variant: 'outline' });
          }

          const variantStyles: Record<string, { container: string; iconBg: string }> = {
            primary: { container: 'bg-gradient-to-l from-primary to-primary/85 text-primary-foreground', iconBg: 'bg-primary-foreground/20' },
            secondary: { container: 'bg-secondary text-secondary-foreground', iconBg: 'bg-primary/20' },
            outline: { container: 'border border-border bg-card text-card-foreground', iconBg: 'bg-muted' },
            destructive: { container: 'bg-destructive/10 border border-destructive/30 text-foreground', iconBg: 'bg-destructive/20' },
          };

          // Determine grid cols based on count
          const gridCols = quickActions.length === 1 ? 'grid-cols-1' : quickActions.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

          return quickActions.length > 0 ? (
            <div className="p-4 space-y-4">
              <h3 className="text-base font-bold">{t('common.quick_actions')}</h3>
              <div className={`grid ${gridCols} gap-2`}>
                {quickActions.map((action) => {
                  const style = variantStyles[action.variant];
                  return (
                    <button
                      key={action.key}
                      onClick={action.onClick}
                      className={`rounded-xl p-3 flex flex-col items-center justify-center gap-2 shadow-md active:scale-[0.97] transition-all duration-200 group ${style.container}`}
                    >
                      <div className={`${style.iconBg} rounded-lg p-2 group-hover:scale-110 transition-transform duration-200`}>
                        {action.icon}
                      </div>
                      <span className="text-xs font-bold">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null;
        })()
      ) : (
        /* No specific permissions */
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Gift className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-lg font-medium">{t('common.no_permissions')}</p>
          <p className="text-sm">{t('common.contact_admin')}</p>
        </div>
      )}

      <DirectSaleDialog
        open={showDirectSaleDialog}
        onOpenChange={setShowDirectSaleDialog}
        initialCustomerId={selectedCustomerForAction?.id}
        stockItems={(stockItems || []).map(s => ({
          id: s.id,
          product_id: s.product_id,
          quantity: s.quantity,
          product: (s as any).product,
        }))}
      />

      <CreateOrderDialog
        open={showCreateOrderDialog}
        onOpenChange={setShowCreateOrderDialog}
        initialCustomerId={selectedCustomerForAction?.id}
      />

      <CustomerActionDialog
        open={showActionDialog}
        onOpenChange={setShowActionDialog}
        onSale={(customer) => {
          setSelectedCustomerForAction(customer);
          setShowDirectSaleDialog(true);
        }}
        directAction="sale"
        allowedActions={['sale']}
      />
    </div>
  );
};

export default WorkerHome;
