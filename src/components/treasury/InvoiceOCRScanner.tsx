import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Upload, ClipboardPaste, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ExtractedData {
  amount?: string;
  invoice_number?: string;
  customer_name?: string;
  check_number?: string;
  check_bank?: string;
  check_date?: string;
  receipt_number?: string;
  transfer_reference?: string;
  raw_text?: string;
}

interface InvoiceOCRScannerProps {
  onDataExtracted: (data: ExtractedData) => void;
  paymentMethod: string;
}

const InvoiceOCRScanner = ({ onDataExtracted, paymentMethod }: InvoiceOCRScannerProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  const processImage = useCallback(async (imageSource: File | Blob | string) => {
    // Show preview
    let base64Data: string;
    if (typeof imageSource === 'string') {
      setPreview(imageSource);
      base64Data = imageSource.replace(/^data:image\/[^;]+;base64,/, '');
    } else {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(imageSource);
      });
      setPreview(dataUrl);
      base64Data = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-invoice', {
        body: { image_base64: base64Data, payment_method: paymentMethod }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        const extracted: ExtractedData = data.data;
        if (extracted.amount || extracted.invoice_number || extracted.customer_name || extracted.check_number) {
          onDataExtracted(extracted);
          toast.success('تم استخراج البيانات من الصورة');
        } else {
          toast.warning('لم يتم العثور على بيانات واضحة، حاول صورة أوضح');
          onDataExtracted({ raw_text: data.raw_text || '' });
        }
      } else {
        toast.warning('لم يتم العثور على بيانات واضحة');
        onDataExtracted({ raw_text: data?.raw_text || '' });
      }
    } catch (err) {
      console.error('OCR Error:', err);
      toast.error('فشل في قراءة الصورة');
    } finally {
      setIsProcessing(false);
    }
  }, [paymentMethod, onDataExtracted]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImage(file);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleOpenLiveCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        toast.error('تم رفض إذن الكاميرا، تحقق من إعدادات المتصفح');
      } else {
        cameraInputRef.current?.click();
      }
    }
  };

  const handleCaptureFrame = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    stopCamera();
    canvas.toBlob(async (blob) => {
      if (blob) await processImage(blob);
    }, 'image/jpeg', 0.9);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) { await processImage(file); break; }
      }
    }
  }, [processImage]);

  const handlePasteButton = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          await processImage(blob);
          return;
        }
      }
      toast.info('لا توجد صورة في الحافظة');
    } catch {
      toast.error('لا يمكن الوصول للحافظة، جرب لصق (Ctrl+V) في هذا المكان');
    }
  };

  useEffect(() => {
    const el = pasteAreaRef.current;
    if (el) {
      el.addEventListener('paste', handlePaste as EventListener);
      return () => el.removeEventListener('paste', handlePaste as EventListener);
    }
  }, [handlePaste]);

  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  return (
    <div className="space-y-2" ref={pasteAreaRef} tabIndex={0}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />

      {showCamera && (
        <div className="relative rounded-lg overflow-hidden border bg-black">
          <video ref={videoRef} className="w-full h-48 object-cover" autoPlay playsInline muted />
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
            <Button size="sm" onClick={handleCaptureFrame} className="gap-1">
              <Camera className="w-4 h-4" /> التقاط
            </Button>
            <Button size="sm" variant="destructive" onClick={stopCamera}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {!showCamera && !isProcessing && (
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" /> رفع صورة
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={handleOpenLiveCamera}>
            <Camera className="w-3.5 h-3.5" /> كاميرا
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={handlePasteButton}>
            <ClipboardPaste className="w-3.5 h-3.5" /> لصق
          </Button>
        </div>
      )}

      {isProcessing && (
        <Button type="button" variant="outline" className="w-full gap-2" disabled>
          <Loader2 className="w-4 h-4 animate-spin" /> جاري تحليل الصورة بالذكاء الاصطناعي...
        </Button>
      )}

      {preview && !showCamera && (
        <div className="relative rounded-lg overflow-hidden border max-h-32">
          <img src={preview} alt="معاينة" className="w-full h-32 object-cover" />
          {isProcessing && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        يمكنك أيضاً لصق صورة مباشرة (Ctrl+V) في هذا المكان
      </p>
    </div>
  );
};

export default InvoiceOCRScanner;
