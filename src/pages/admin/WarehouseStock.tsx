import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Package, Users, Loader2, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWarehouseStock } from '@/hooks/useWarehouseStock';
import DirectSaleDialog from '@/components/warehouse/DirectSaleDialog';

const WarehouseStock: React.FC = () => {
  const { t } = useLanguage();
  const { warehouseStock, workerStocksByWorker, isLoading } = useWarehouseStock();
  const [showSaleDialog, setShowSaleDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasStock = warehouseStock.length > 0;

  // Map warehouse stock to the format DirectSaleDialog expects
  const stockItemsForSale = warehouseStock.map(s => ({
    id: s.id,
    product_id: s.product_id,
    quantity: s.quantity,
    product: s.product,
  }));

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('stock.warehouse_stock')}</h2>
        {hasStock && (
          <Button size="sm" onClick={() => setShowSaleDialog(true)}>
            <ShoppingBag className="w-4 h-4 ml-1" />
            {t('stock.direct_sale')}
          </Button>
        )}
      </div>

      {/* Warehouse Stock */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-primary" />
          {t('stock.warehouse_stock')}
        </h3>
        {warehouseStock.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('stock.no_stock')}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {warehouseStock.map(item => (
              <Card key={item.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="font-medium">{item.product?.name}</span>
                  <span className="text-primary font-bold">{item.quantity}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Worker Stocks */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-primary" />
          {t('stock.worker_stock')}
        </h3>
        {Object.keys(workerStocksByWorker).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('stock.no_stock')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {Object.entries(workerStocksByWorker).map(([workerId, data]) => (
              <Card key={workerId}>
                <CardContent className="p-3">
                  <div className="font-semibold text-sm mb-2 text-primary">
                    {data.worker?.full_name || t('common.unknown')}
                  </div>
                  <div className="space-y-1">
                    {data.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{item.product?.name}</span>
                        <span className="font-medium">{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <DirectSaleDialog
        open={showSaleDialog}
        onOpenChange={setShowSaleDialog}
        stockItems={stockItemsForSale}
        stockSource="warehouse"
      />
    </div>
  );
};

export default WarehouseStock;
