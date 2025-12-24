package com.virtualandroid.sms.service

import android.app.Notification
import android.content.pm.PackageManager
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.virtualandroid.sms.data.AppNotification
import com.virtualandroid.sms.util.PreferencesManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentLinkedQueue

class AppNotificationListenerService : NotificationListenerService() {
    
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    companion object {
        private val notificationQueue = ConcurrentLinkedQueue<AppNotification>()
        private var notificationIdCounter = 0L
        
        // Apps to monitor for notifications
        private val MONITORED_APPS = setOf(
            "com.whatsapp",
            "com.whatsapp.w4b",
            "org.telegram.messenger",
            "com.facebook.orca",
            "com.instagram.android",
            "com.snapchat.android",
            "com.twitter.android",
            "com.google.android.gm",
            "com.linkedin.android",
            "com.viber.voip",
            "com.skype.raider",
            "jp.naver.line.android",
            "com.discord"
        )
        
        fun getAndClearNotifications(): List<AppNotification> {
            val notifications = mutableListOf<AppNotification>()
            while (notificationQueue.isNotEmpty()) {
                notificationQueue.poll()?.let { notifications.add(it) }
            }
            return notifications
        }
        
        fun getPendingNotifications(): List<AppNotification> {
            return notificationQueue.toList()
        }
    }
    
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName
        
        // Only monitor specific apps
        if (packageName !in MONITORED_APPS) return
        
        // Check if sync is enabled
        val prefs = PreferencesManager.getInstance(applicationContext)
        if (!prefs.isRegistered()) return
        
        val notification = sbn.notification
        val extras = notification.extras
        
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
        
        // Skip empty notifications
        if (title.isNullOrBlank() && text.isNullOrBlank()) return
        
        // Skip ongoing notifications (like media players)
        if (notification.flags and Notification.FLAG_ONGOING_EVENT != 0) return
        
        val appName = try {
            val appInfo = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(appInfo).toString()
        } catch (e: PackageManager.NameNotFoundException) {
            packageName
        }
        
        val category = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            notification.category
        } else {
            null
        }
        
        val appNotification = AppNotification(
            id = ++notificationIdCounter,
            packageName = packageName,
            appName = appName,
            title = title,
            text = text,
            timestamp = sbn.postTime,
            category = category
        )
        
        notificationQueue.offer(appNotification)
        
        // Limit queue size to prevent memory issues
        while (notificationQueue.size > 1000) {
            notificationQueue.poll()
        }
    }
    
    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        // Optional: track when notifications are dismissed
    }
    
    override fun onListenerConnected() {
        super.onListenerConnected()
        // Service is connected and ready to receive notifications
    }
    
    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        // Service disconnected
    }
}
