import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CheckCircle,
  DoorClosed,
  Eye,
  EyeOff,
  Printer,
  Search,
  ShoppingBag,
  UserX,
  XCircle,
} from "lucide-react"
import { useState } from "react"
import { CustomerList } from "../customer/CustomerList"
import { Customer } from "@/types"
import { useSearchParams } from "next/navigation"
import { Sector } from "@/types"

interface SectorCustomersPopoverProps {
  sectors: Sector[]
  deliveryNotDone: Customer[]
  deliveryNotReceived: Customer[]
  deliveryReceived: Customer[]
  salesNotVisited: Customer[]
  salesVisitedOnly: Customer[]
  salesWithOrders: Customer[]
  salesUnavailable: Customer[]
  salesClosed: Customer[]
  directSalePending: Customer[]
  directSaleSold: Customer[]
  directSaleNoSale: Customer[]
  checkingLocationFor?: string
  loadingDeliveryFor?: string
  handleCustomerClick: (customer: Customer, type: 'delivery' | 'sales' | 'directSale') => void
  handleShowOrderDetails: (customer: Customer) => void
  handleShowDeliveredOrderDetails: (customer: Customer) => void
  handleShowDirectSaleDetails: (customer: Customer) => void
  handlePrintDeliveredOrder: (customer: Customer) => void
  handlePrintDirectSale: (customer: Customer) => void
  handleVisitWithoutOrder: (customer: Customer) => void
  handleDeliveryVisitWithoutDelivery: (customer: Customer) => void
  handleCustomerClosed: (customer: Customer) => void
  handleCustomerUnavailable: (customer: Customer) => void
  handleDirectSaleClick: (customer: Customer) => void
  handleDirectSaleClosed: (customer: Customer) => void
  handleDirectSaleUnavailable: (customer: Customer) => void
  handleDirectSaleNoSale: (customer: Customer) => void
}

export function SectorCustomersPopover({
  sectors,
  deliveryNotDone,
  deliveryNotReceived,
  deliveryReceived,
  salesNotVisited,
  salesVisitedOnly,
  salesWithOrders,
  salesUnavailable,
  salesClosed,
  directSalePending,
  directSaleSold,
  directSaleNoSale,
  checkingLocationFor,
  loadingDeliveryFor,
  handleCustomerClick,
  handleShowOrderDetails,
  handleShowDeliveredOrderDetails,
  handleShowDirectSaleDetails,
  handlePrintDeliveredOrder,
  handlePrintDirectSale,
  handleVisitWithoutOrder,
  handleDeliveryVisitWithoutDelivery,
  handleCustomerClosed,
  handleCustomerUnavailable,
  handleDirectSaleClick,
  handleDirectSaleClosed,
  handleDirectSaleUnavailable,
  handleDirectSaleNoSale,
}: SectorCustomersPopoverProps) {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Search className="w-4 h-4 mr-2" />
          بحث عن عميل
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[80%] lg:max-w-[70%] xl:max-w-[60%] 2xl:max-w-[50%] shadow-xl">
        <DialogHeader>
          <DialogTitle>قائمة العملاء</DialogTitle>
          <Separator className="my-2" />
          <Input
            type="search"
            placeholder="ابحث عن اسم العميل..."
            className="w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </DialogHeader>

        <ScrollArea className="h-[75vh] rounded-md border p-2">
          <Tabs defaultValue="delivery" className="flex flex-col h-full">
            <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5">
              <TabsTrigger value="delivery" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
                <ShoppingBag className="w-3 h-3" />
                توصيل
                {(deliveryNotDone.length + deliveryNotReceived.length) > 0 && <Badge className="text-[9px] px-1 h-4 bg-blue-500">{(deliveryNotDone.length + deliveryNotReceived.length)}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
                <Eye className="w-3 h-3" />
                مبيعات
                {(salesNotVisited.length + salesVisitedOnly.length) > 0 && <Badge className="text-[9px] px-1 h-4 bg-orange-500">{(salesNotVisited.length + salesVisitedOnly.length)}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="direct-sale" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                <ShoppingBag className="w-3 h-3" />
                بيع مباشر
                {directSalePending.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-green-500">{directSalePending.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* Delivery Tab */}
            <TabsContent value="delivery" className="m-0 flex-1 min-h-0">
            <Tabs defaultValue="not-delivered" className="flex flex-col h-full min-h-0">
              <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5">
                <TabsTrigger value="not-delivered" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
                  <ShoppingBag className="w-3 h-3" />
                  بدون توصيل
                  {deliveryNotDone.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-blue-500">{deliveryNotDone.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="not-received" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
                  <EyeOff className="w-3 h-3" />
                  بدون استلام
                  {deliveryNotReceived.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-purple-500">{deliveryNotReceived.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="received" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                  <CheckCircle className="w-3 h-3" />
                  تم التوصيل
                  {deliveryReceived.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-green-500">{deliveryReceived.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="not-delivered" className="m-0 flex-1 min-h-0" style={{ overflow: 'auto', maxHeight: '45vh' }}>
                <CustomerList customers={deliveryNotDone} emptyMessage="تم توصيل جميع العملاء ✓" onCustomerClick={(c) => handleCustomerClick(c, 'delivery')} onVisitWithoutOrder={handleDeliveryVisitWithoutDelivery} onClosed={handleCustomerClosed} onUnavailable={handleCustomerUnavailable} showVisitButton visitButtonLabel="بدون تسليم" showActionButtons checkingLocationFor={checkingLocationFor} loadingFor={loadingDeliveryFor} searchQuery={searchQuery} sectors={sectors} />
              </TabsContent>
              <TabsContent value="not-received" className="m-0 flex-1 min-h-0" style={{ overflow: 'auto', maxHeight: '45vh' }}>
                <CustomerList customers={deliveryNotReceived} emptyMessage="لا توجد زيارات بدون تسليم" onCustomerClick={(c) => handleCustomerClick(c, 'delivery')} showActionButtons onClosed={handleCustomerClosed} onUnavailable={handleCustomerUnavailable} checkingLocationFor={checkingLocationFor} loadingFor={loadingDeliveryFor} searchQuery={searchQuery} sectors={sectors} />
              </TabsContent>
              <TabsContent value="received" className="m-0 flex-1 min-h-0" style={{ overflow: 'auto', maxHeight: '45vh' }}>
                <CustomerList customers={deliveryReceived} emptyMessage="لا توجد توصيلات بعد" onCustomerClick={handleShowDeliveredOrderDetails} showPrintButton onPrint={handlePrintDeliveredOrder} checkingLocationFor={checkingLocationFor} loadingFor={loadingDeliveryFor} searchQuery={searchQuery} sectors={sectors} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales" className="m-0 flex-1 min-h-0">
            <Tabs defaultValue="not-visited" className="flex flex-col h-full min-h-0">
              <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5">
                <TabsTrigger value="not-visited" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
                  <EyeOff className="w-3 h-3" />
                  بدون زيارة
                  {salesNotVisited.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-orange-500">{salesNotVisited.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="visited-no-order" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700">
                  <Eye className="w-3 h-3" />
                  بدون طلبية
                  {salesVisitedNoOrder.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-amber-500">{salesVisitedNoOrder.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="with-orders" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                  <CheckCircle className="w-3 h-3" />
                  تم الطلب
                  {salesWithOrders.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-green-500">{salesWithOrders.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="not-visited" className="m-0 flex-1 min-h-0" style={{ overflow: 'auto', maxHeight: '45vh' }}>
                <CustomerList customers={salesNotVisited} emptyMessage="تمت زيارة جميع العملاء ✓" onCustomerClick={(c) => handleCustomerClick(c, 'sales')} onVisitWithoutOrder={handleVisitWithoutOrder} onClosed={handleCustomerClosed} onUnavailable={handleCustomerUnavailable} showVisitButton showActionButtons checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} />
              </TabsContent>
              <TabsContent value="visited-no-order" className="m-0 flex-1 min-h-0">
                <Tabs defaultValue="visit-only" className="flex flex-col h-full min-h-0">
                  <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5 bg-amber-50">
                    <TabsTrigger value="visit-only" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-amber-200 data-[state=active]:text-amber-800">
                      <Eye className="w-3 h-3" />
                      زيارة
                      {salesVisitedOnly.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-amber-500">{salesVisitedOnly.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="unavailable" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-yellow-200 data-[state=active]:text-yellow-800">
                      <UserX className="w-3 h-3" />
                      غير متاح
                      {salesUnavailable.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-yellow-500">{salesUnavailable.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="closed" className="flex-1 gap-1 text-[10px] px-1 py-1 data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
                      <DoorClosed className="w-3 h-3" />
                      مغلق
                      {salesClosed.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-red-500">{salesClosed.length}</Badge>}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="visit-only" className="m-0 flex-1 min-h-0" style={{ overflow: 'auto', maxHeight: '40vh' }}>
                    <CustomerList customers={salesVisitedOnly} emptyMessage="لا توجد زيارات بدون طلبيات" onCustomerClick={(c) => handleCustomerClick(c, 'sales')} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} />
                  </TabsContent>
                  <TabsContent value="unavailable" className="m-0 flex-1 min-h-0" style={{ overflow: 'auto', maxHeight: '40vh' }}>
                    <CustomerList customers={salesUnavailable} emptyMessage="لا يوجد عملاء غير متاحين" onCustomerClick={(c) => handleCustomerClick(c, 'sales')} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} />
                  </TabsContent>
                  <TabsContent value="closed" className="m-0 flex-1 min-h-0" style={{ overflow: 'auto', maxHeight: '40vh' }}>
                    <CustomerList customers={salesClosed} emptyMessage="لا يوجد عملاء مغلقين" onCustomerClick={(c) => handleCustomerClick(c, 'sales')} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} />
                  </TabsContent>
                </Tabs>
              </TabsContent>
              <TabsContent value="with-orders" className="m-0 flex-1 min-h-0" style={{ overflow: 'auto', maxHeight: '45vh' }}>
                <CustomerList customers={salesWithOrders} emptyMessage="لا توجد طلبيات بعد" onCustomerClick={handleShowOrderDetails} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Direct Sale Tab */}
          <TabsContent value="direct-sale" className="m-0 flex-1 min-h-0">
            <Tabs defaultValue="pending" className="flex flex-col h-full min-h-0">
              <TabsList className="w-full rounded-none border-b shrink-0 h-auto p-0.5 gap-0.5">
                <TabsTrigger value="pending" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
                  <ShoppingBag className="w-3 h-3" />
                  العملاء
                  {directSalePending.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-orange-500">{directSalePending.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="sold" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                  <CheckCircle className="w-3 h-3" />
                  تم البيع
                  {directSaleSold.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-green-500">{directSaleSold.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="no-sale" className="flex-1 gap-1 text-[10px] px-1.5 py-1.5 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700">
                  <XCircle className="w-3 h-3" />
                  بدون بيع
                  {directSaleNoSale.length > 0 && <Badge className="text-[9px] px-1 h-4 bg-amber-500">{directSaleNoSale.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="m-0 flex-1 min-h-0" style={{ overflow: 'auto', maxHeight: '45vh' }}>
                <CustomerList customers={directSalePending} emptyMessage="لا توجد محلات متاحة للبيع المباشر" onCustomerClick={handleDirectSaleClick} onClosed={handleDirectSaleClosed} onUnavailable={handleDirectSaleUnavailable} onNoSale={handleDirectSaleNoSale} showActionButtons showNoSaleButton checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} />
              </TabsContent>
              <TabsContent value="sold" className="m-0 flex-1 min-h-0" style={{ overflow: 'auto', maxHeight: '45vh' }}>
                <CustomerList customers={directSaleSold} emptyMessage="لا توجد مبيعات بعد" onCustomerClick={handleShowDirectSaleDetails} showPrintButton onPrint={handlePrintDirectSale} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} />
              </TabsContent>
              <TabsContent value="no-sale" className="m-0 flex-1 min-h-0" style={{ overflow: 'auto', maxHeight: '45vh' }}>
                <CustomerList customers={directSaleNoSale} emptyMessage="لا توجد زيارات بدون بيع" onCustomerClick={handleDirectSaleClick} checkingLocationFor={checkingLocationFor} searchQuery={searchQuery} sectors={sectors} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </DialogContent>
  </Dialog>
)
}
