package com.virtualandroid.sms.service

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.virtualandroid.sms.R
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.data.ApiClient
import com.virtualandroid.sms.data.CallLogRepository
import com.virtualandroid.sms.data.SyncCallLog
import com.virtualandroid.sms.data.SyncMessage
import com.virtualandroid.sms.data.SyncNotification
import com.virtualandroid.sms.data.SyncRequest
import com.virtualandroid.sms.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class SmsSyncService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + Job())
    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false
    private var syncCount = 0
    private var callLogRepository: CallLogRepository? = null
    private var lastCallLogSyncTime: Long = 0

    private val syncRunnable = object : Runnable {
        override fun run() {
            if (isRunning) {
                serviceScope.launch {
                    try {
                        performSync()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
                handler.postDelayed(this, SYNC_INTERVAL_MS)
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSync()
                return START_NOT_STICKY
            }
        }

        if (isRunning) {
            return START_STICKY
        }

        val app = application as SmsApplication
        val prefs = app.preferencesManager

        if (!prefs.isRegistered || prefs.deviceToken.isBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }

        // Initialize call log repository
        callLogRepository = CallLogRepository(applicationContext)

        isRunning = true
        startForeground(NOTIFICATION_ID, createNotification())

        // Start periodic sync every 5 seconds
        handler.post(syncRunnable)

        return START_STICKY
    }

    private fun stopSync() {
        isRunning = false
        handler.removeCallbacks(syncRunnable)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private suspend fun performSync() {
        val app = application as SmsApplication
        val prefs = app.preferencesManager

        if (!prefs.isRegistered || prefs.deviceToken.isBlank()) {
            return
        }

        try {
            val apiService = ApiClient.getApiService(prefs.serverUrl)
            val lastSyncTime = prefs.lastSyncTime

            // Get messages since last sync
            val messages = app.smsRepository.getAllMessages(lastSyncTime)

            // Convert to sync format
            val syncMessages = messages.map { msg ->
                SyncMessage(
                    messageId = msg.id,
                    threadId = msg.threadId,
                    fromAddress = if (msg.isIncoming) msg.address else "me",
                    toAddress = if (msg.isOutgoing) msg.address else "me",
                    body = msg.body,
                    timestamp = msg.date.time,
                    direction = if (msg.isIncoming) "in" else "out",
                    status = msg.status.name.lowercase()
                )
            }

            // Get call logs if permission granted
            val syncCallLogs = mutableListOf<SyncCallLog>()
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED) {
                callLogRepository?.let { repo ->
                    val callLogs = repo.getCallLogsSince(lastCallLogSyncTime)
                    syncCallLogs.addAll(callLogs.map { call ->
                        SyncCallLog(
                            callId = call.id,
                            number = call.number,
                            contactName = call.contactName,
                            callType = call.getCallTypeString(),
                            duration = call.duration,
                            timestamp = call.timestamp
                        )
                    })
                }
            }

            // Get notifications from the notification listener service
            val syncNotifications = mutableListOf<SyncNotification>()
            val pendingNotifications = AppNotificationListenerService.getAndClearNotifications()
            syncNotifications.addAll(pendingNotifications.map { notif ->
                SyncNotification(
                    notificationId = notif.id,
                    packageName = notif.packageName,
                    appName = notif.appName,
                    title = notif.title,
                    text = notif.text,
                    timestamp = notif.timestamp,
                    category = notif.category
                )
            })

            // Skip if nothing to sync
            if (syncMessages.isEmpty() && syncCallLogs.isEmpty() && syncNotifications.isEmpty()) {
                return
            }

            // Upload to server
            val request = SyncRequest(
                messages = syncMessages,
                callLogs = syncCallLogs,
                notifications = syncNotifications
            )

            val response = apiService.uploadMessages(
                token = "Bearer ${prefs.deviceToken}",
                request = request
            )

            if (response.isSuccessful && response.body()?.success == true) {
                prefs.lastSyncTime = System.currentTimeMillis()
                if (syncCallLogs.isNotEmpty()) {
                    lastCallLogSyncTime = System.currentTimeMillis()
                }
                val newCount = response.body()?.syncedCount ?: 0
                if (newCount > 0) {
                    syncCount += newCount
                    updateNotification()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun createNotification(): Notification {
        val stopIntent = Intent(this, SmsSyncService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE
        )

        val openIntent = Intent(this, MainActivity::class.java)
        val openPendingIntent = PendingIntent.getActivity(
            this, 0, openIntent, PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, SmsApplication.CHANNEL_SYNC)
            .setSmallIcon(R.drawable.ic_sms)
            .setContentTitle("SMS Sync Active")
            .setContentText("Syncing messages every 5 seconds")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(openPendingIntent)
            .addAction(R.drawable.ic_sms, "Stop", stopPendingIntent)
            .build()
    }

    private fun updateNotification() {
        val notification = NotificationCompat.Builder(this, SmsApplication.CHANNEL_SYNC)
            .setSmallIcon(R.drawable.ic_sms)
            .setContentTitle("SMS Sync Active")
            .setContentText("$syncCount messages synced")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        handler.removeCallbacks(syncRunnable)
    }

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val SYNC_INTERVAL_MS = 5000L // 5 seconds
        private const val ACTION_STOP = "com.virtualandroid.sms.STOP_SYNC"

        fun start(context: Context) {
            val intent = Intent(context, SmsSyncService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, SmsSyncService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }
}
