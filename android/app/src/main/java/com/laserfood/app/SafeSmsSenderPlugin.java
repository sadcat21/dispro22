package com.laserfood.app;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.telephony.SmsManager;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.SubscriptionManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
        name = "SafeSmsSender",
        permissions = {
                @Permission(alias = "send_sms", strings = {Manifest.permission.SEND_SMS}),
                @Permission(alias = "read_phone_state", strings = {Manifest.permission.READ_PHONE_STATE})
        }
)
public class SafeSmsSenderPlugin extends Plugin {

    private String smsSentAction;
    private String smsDeliveredAction;
    private BroadcastReceiver sendReceiver;
    private BroadcastReceiver deliveredReceiver;

    @Override
    public void load() {
        smsSentAction = getContext().getPackageName() + ".SMS_SENT";
        smsDeliveredAction = getContext().getPackageName() + ".SMS_DELIVERED";

        sendReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                try {
                    JSObject ret = new JSObject();
                    ret.put("id", intent != null ? intent.getIntExtra("id", -1) : -1);
                    ret.put("res_status", getResultCode());
                    ret.put("status", getResultCode() == Activity.RESULT_OK ? "SENT" : "FAILED");
                    notifyListeners("smsSenderStatusUpdated", ret);
                } catch (Throwable ignored) {
                    // لا نسمح لأي خطأ في BroadcastReceiver بإسقاط التطبيق
                }
            }
        };

        deliveredReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                try {
                    JSObject ret = new JSObject();
                    ret.put("id", intent != null ? intent.getIntExtra("id", -1) : -1);
                    ret.put("res_status", getResultCode());
                    ret.put("status", getResultCode() == Activity.RESULT_OK ? "DELIVERED" : "FAILED");
                    notifyListeners("smsSenderStatusUpdated", ret);
                } catch (Throwable ignored) {
                    // لا نسمح لأي خطأ في BroadcastReceiver بإسقاط التطبيق
                }
            }
        };

        registerReceiverSafely(sendReceiver, new IntentFilter(smsSentAction));
        registerReceiverSafely(deliveredReceiver, new IntentFilter(smsDeliveredAction));
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        unregisterReceiverSafely(sendReceiver);
        unregisterReceiverSafely(deliveredReceiver);
    }

    private void registerReceiverSafely(BroadcastReceiver receiver, IntentFilter filter) {
        if (receiver == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }
    }

    private void unregisterReceiverSafely(BroadcastReceiver receiver) {
        if (receiver == null) return;
        try {
            getContext().unregisterReceiver(receiver);
        } catch (IllegalArgumentException ignored) {
            // already unregistered
        }
    }

    @PluginMethod
    public void send(PluginCall call) {
        if (!hasRequiredPermissions()) {
            call.reject("Requested permission is not granted");
            return;
        }

        if (!hasNativePermissionGranted(Manifest.permission.SEND_SMS)) {
            call.reject("SEND_SMS permission is not granted at runtime");
            return;
        }

        Integer idBoxed = call.getInt("id");
        String text = call.getString("text", "").trim();
        String phone = call.getString("phone", "").trim();
        int simSlot = call.getInt("sim", 0);

        if (idBoxed == null) {
            call.reject("SMS id is required");
            return;
        }

        if (phone.isEmpty() || text.isEmpty()) {
            call.reject("phone and text are required");
            return;
        }

        final int id = idBoxed;
        final int safeSimSlot = Math.max(0, simSlot);
        final String cleanPhone = phone.replaceAll("\\s+", "");

        Runnable sendRunnable = () -> {
            try {
                // استخدام Service للإرسال الخلفي لتجنب إغلاق التطبيق
                Intent serviceIntent = new Intent(getContext(), SmsSendService.class);
                serviceIntent.putExtra("phone", cleanPhone);
                serviceIntent.putExtra("text", text);
                serviceIntent.putExtra("sim", safeSimSlot);
                serviceIntent.putExtra("id", id);

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        getContext().startForegroundService(serviceIntent);
                    } else {
                        getContext().startService(serviceIntent);
                    }
                } catch (Throwable serviceErr) {
                    // إذا فشل بدء الخدمة، حاول الإرسال المباشر كاحتياط
                    SmsManager manager = getSmsManagerForSlot(safeSimSlot);
                    if (manager != null) {
                        manager.sendTextMessage(cleanPhone, null, text, null, null);
                    }
                }

                JSObject ret = new JSObject();
                ret.put("id", id);
                ret.put("status", "PENDING");
                ret.put("parts", 1); // افتراضي للرسالة الواحدة
                call.resolve(ret);
            } catch (Throwable t) {
                call.reject("Failed to start SMS service: " + t.getClass().getSimpleName() + " - " + t.getMessage());
            }
        };

        if (Looper.myLooper() == Looper.getMainLooper()) {
            sendRunnable.run();
        } else {
            new Handler(Looper.getMainLooper()).post(sendRunnable);
        }
    }

    private boolean hasNativePermissionGranted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }

    private PendingIntent createSmsPendingIntent(int requestCode, Intent intent, int flags) {
        return PendingIntent.getBroadcast(getContext(), Math.max(1, requestCode), intent, flags);
    }

    private ArrayList<PendingIntent> buildPendingIntents(int messageId, int flags, String action, int count, int startOffset) {
        ArrayList<PendingIntent> pendingIntents = new ArrayList<>(count);

        for (int i = 0; i < count; i++) {
            Intent intent = new Intent(action).setPackage(getContext().getPackageName());
            intent.putExtra("id", messageId);
            intent.putExtra("part_index", i);
            int requestCode = requestCodeSafeAdd(messageId, startOffset + i);
            pendingIntents.add(createSmsPendingIntent(requestCode, intent, flags));
        }

        return pendingIntents;
    }

    private int requestCodeSafeAdd(int base, int delta) {
        long sum = (long) base + (long) delta;
        if (sum > Integer.MAX_VALUE) {
            return (int) (sum % Integer.MAX_VALUE);
        }
        if (sum < 1) {
            return 1;
        }
        return (int) sum;
    }

    @Nullable
    private SmsManager getSmsManagerForSlot(int simSlot) {
        final Context context = getContext();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1 && hasNativePermissionGranted(Manifest.permission.READ_PHONE_STATE)) {
                SubscriptionManager subManager = context.getSystemService(SubscriptionManager.class);
                if (subManager != null) {
                    List<SubscriptionInfo> subs = subManager.getActiveSubscriptionInfoList();
                    if (subs != null && !subs.isEmpty()) {
                        SubscriptionInfo selected = null;

                        for (SubscriptionInfo info : subs) {
                            if (info != null && info.getSimSlotIndex() == simSlot) {
                                selected = info;
                                break;
                            }
                        }

                        if (selected == null && simSlot >= 0 && simSlot < subs.size()) {
                            selected = subs.get(simSlot);
                        }

                        if (selected == null) {
                            selected = subs.get(0);
                        }

                        int subId = selected.getSubscriptionId();
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            SmsManager systemSms = context.getSystemService(SmsManager.class);
                            if (systemSms != null) {
                                return systemSms.createForSubscriptionId(subId);
                            }
                        }
                        return SmsManager.getSmsManagerForSubscriptionId(subId);
                    }
                }
            }
        } catch (Throwable ignored) {
            // fallback below
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            SmsManager systemSms = context.getSystemService(SmsManager.class);
            if (systemSms != null) return systemSms;
        }

        return SmsManager.getDefault();
    }

    public static class SmsSendService extends Service {
        private static final String CHANNEL_ID = "sms_send_channel";
        private static final int NOTIFICATION_ID = 1001;
        private PowerManager.WakeLock wakeLock;

        @Override
        public void onCreate() {
            super.onCreate();

            // إنشاء قناة الإشعارات للإصدارات الحديثة
            createNotificationChannel();

            // إنشاء إشعار أمامي
            Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setContentTitle("إرسال رسالة")
                    .setContentText("جاري إرسال الرسالة...")
                    .setSmallIcon(android.R.drawable.ic_dialog_email)
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setOngoing(true)
                    .build();

            startForeground(NOTIFICATION_ID, notification);

            // الحصول على WakeLock
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SmsSendService::WakeLock");
            wakeLock.acquire(30000); // 30 ثانية كحد أقصى
        }

        private void createNotificationChannel() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "إرسال الرسائل",
                        NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("إشعارات إرسال الرسائل النصية");
                channel.setShowBadge(false);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);

                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) {
                    manager.createNotificationChannel(channel);
                }
            }
        }

        @Override
        public int onStartCommand(Intent intent, int flags, int startId) {
            if (intent != null) {
                String phone = intent.getStringExtra("phone");
                String text = intent.getStringExtra("text");
                int simSlot = intent.getIntExtra("sim", 0);
                int id = intent.getIntExtra("id", -1);

                if (phone != null && text != null && id != -1) {
                    sendSmsInBackground(phone, text, simSlot, id);
                }
            }

            return START_NOT_STICKY;
        }

        private void sendSmsInBackground(String phone, String text, int simSlot, int id) {
            try {
                SmsManager manager = getSmsManagerForSlot(this, simSlot);
                if (manager == null) return;

                ArrayList<String> parts = manager.divideMessage(text);
                if (parts == null || parts.isEmpty()) return;

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }

                if (parts.size() == 1) {
                    manager.sendTextMessage(phone, null, parts.get(0), null, null);
                } else {
                    manager.sendMultipartTextMessage(phone, null, parts, null, null);
                }
            } catch (Throwable ignored) {
                // Silent failure in background
            } finally {
                if (wakeLock != null && wakeLock.isHeld()) {
                    wakeLock.release();
                }
                stopSelf();
            }
        }

        @Nullable
        private SmsManager getSmsManagerForSlot(Context context, int simSlot) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                    SubscriptionManager subManager = context.getSystemService(SubscriptionManager.class);
                    if (subManager != null) {
                        List<SubscriptionInfo> subs = subManager.getActiveSubscriptionInfoList();
                        if (subs != null && !subs.isEmpty()) {
                            SubscriptionInfo selected = null;

                            for (SubscriptionInfo info : subs) {
                                if (info != null && info.getSimSlotIndex() == simSlot) {
                                    selected = info;
                                    break;
                                }
                            }

                            if (selected == null && simSlot >= 0 && simSlot < subs.size()) {
                                selected = subs.get(simSlot);
                            }

                            if (selected == null) {
                                selected = subs.get(0);
                            }

                            int subId = selected.getSubscriptionId();
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                                SmsManager systemSms = context.getSystemService(SmsManager.class);
                                if (systemSms != null) {
                                    return systemSms.createForSubscriptionId(subId);
                                }
                            }
                            return SmsManager.getSmsManagerForSubscriptionId(subId);
                        }
                    }
                }
            } catch (Throwable ignored) {}

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                SmsManager systemSms = context.getSystemService(SmsManager.class);
                if (systemSms != null) return systemSms;
            }

            return SmsManager.getDefault();
        }

        @Nullable
        @Override
        public IBinder onBind(Intent intent) {
            return null;
        }

        @Override
        public void onDestroy() {
            super.onDestroy();
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            // إزالة الإشعار
            stopForeground(true);
        }
    }
}

