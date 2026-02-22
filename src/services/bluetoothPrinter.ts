/**
 * Bluetooth Thermal Printer Service
 * Supports ESC/POS protocol for 58mm/80mm thermal printers
 * Uses Web Bluetooth API (Chrome on Android)
 */

export type PrinterStatusType = 'disconnected' | 'connecting' | 'connected' | 'printing' | 'error';

type StatusCallback = (status: PrinterStatusType) => void;

// Common Bluetooth printer service UUIDs
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

const PRINTER_CHARACTERISTIC_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

class BluetoothPrinterService {
  private device: any = null;
  private characteristic: any = null;
  private statusCallback: StatusCallback | null = null;
  private _status: PrinterStatusType = 'disconnected';

  get status(): PrinterStatusType {
    return this._status;
  }

  get deviceName(): string | null {
    return this.device?.name || null;
  }

  get isConnected(): boolean {
    return this._status === 'connected' && !!this.characteristic;
  }

  onStatusChange(callback: StatusCallback) {
    this.statusCallback = callback;
  }

  private setStatus(status: PrinterStatusType) {
    this._status = status;
    this.statusCallback?.(status);
  }

  async scan(): Promise<any | null> {
    const nav = navigator as any;
    if (!nav.bluetooth) {
      throw new Error('Web Bluetooth غير مدعوم في هذا المتصفح. استخدم Chrome على Android.');
    }

    try {
      this.setStatus('connecting');
      let device: any;
      try {
        device = await nav.bluetooth.requestDevice({
          filters: PRINTER_SERVICE_UUIDS.map(u => ({ services: [u] })),
          optionalServices: PRINTER_SERVICE_UUIDS,
        });
      } catch {
        device = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: PRINTER_SERVICE_UUIDS,
        });
      }
      return device;
    } catch (error: any) {
      this.setStatus('disconnected');
      if (error.name === 'NotFoundError') return null;
      throw error;
    }
  }

  async connect(device?: any): Promise<boolean> {
    try {
      this.setStatus('connecting');
      const targetDevice = device || this.device;
      if (!targetDevice) throw new Error('لا يوجد جهاز محدد');

      this.device = targetDevice;

      this.device.addEventListener('gattserverdisconnected', () => {
        this.setStatus('disconnected');
        this.characteristic = null;
        setTimeout(() => this.reconnect(), 2000);
      });

      const server = await this.device.gatt.connect();
      
      for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          for (const charUuid of PRINTER_CHARACTERISTIC_UUIDS) {
            try {
              const char = await service.getCharacteristic(charUuid);
              if (char.properties.write || char.properties.writeWithoutResponse) {
                this.characteristic = char;
                this.setStatus('connected');
                if (this.device.name) {
                  localStorage.setItem('bt_printer_name', this.device.name);
                  localStorage.setItem('bt_printer_id', this.device.id);
                }
                return true;
              }
            } catch { /* try next */ }
          }
        } catch { /* try next service */ }
      }

      throw new Error('لم يتم العثور على خاصية الكتابة في الطابعة');
    } catch (error: any) {
      this.setStatus('error');
      throw error;
    }
  }

  async reconnect(): Promise<boolean> {
    if (this.isConnected) return true;
    if (!this.device) return false;
    try {
      return await this.connect(this.device);
    } catch {
      return false;
    }
  }

  disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
    this.setStatus('disconnected');
    localStorage.removeItem('bt_printer_name');
    localStorage.removeItem('bt_printer_id');
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.characteristic) throw new Error('الطابعة غير متصلة');

    this.setStatus('printing');
    try {
      const chunkSize = 100;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        if (this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
        await new Promise(r => setTimeout(r, 20));
      }
      this.setStatus('connected');
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();
