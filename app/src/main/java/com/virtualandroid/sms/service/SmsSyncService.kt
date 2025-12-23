package com.virtualandroid.sms.service

import android.app.Notification
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.virtualandroid.sms.R
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.data.ApiClient
import com.virtualandroid.sms.data.SyncMessage
import com.virtualandroid.sms.data.SyncRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class SmsSyncService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + Job())
    private var isRunning = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (isRunning) {
            return START_NOT_STICKY
        }

        isRunning = true
        startForeground(NOTIFICATION_ID, createNotification())

        serviceScope.launch {
            try {
                performSync()
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isRunning = false
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }

        return START_NOT_STICKY
    }

    private suspend fun performSync() {
        val app = application as SmsApplication
        val prefs = app.preferencesManager

        if (!prefs.syncEnabled || prefs.serverUrl.isBlank() || prefs.apiKey.isBlank()) {
            return
        }

        try {
            val apiService = ApiClient.getApiService(prefs.serverUrl)
            val lastSyncTime = prefs.lastSyncTime

            // Get messages since last sync
            val messages = app.smsRepository.getAllMessages(lastSyncTime)

            if (messages.isEmpty()) {
                prefs.lastSyncTime = System.currentTimeMillis()
                return
            }

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

            // Upload to server
            val request = SyncRequest(
                deviceId = prefs.deviceId,
                messages = syncMessages
            )

            val response = apiService.uploadMessages(
                apiKey = "Bearer ${prefs.apiKey}",
                request = request
            )

            if (response.isSuccessful && response.body()?.success == true) {
                prefs.lastSyncTime = System.currentTimeMillis()
                showSyncCompleteNotification(response.body()?.syncedCount ?: 0)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            showSyncFailedNotification(e.message ?: "Unknown error")
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, SmsApplication.CHANNEL_SYNC)
            .setSmallIcon(R.drawable.ic_sms)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.sync_in_progress))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun showSyncCompleteNotification(count: Int) {
        val notification = NotificationCompat.Builder(this, SmsApplication.CHANNEL_SYNC)
            .setSmallIcon(R.drawable.ic_check)
            .setContentTitle(getString(R.string.app_name))
            .setContentText("${getString(R.string.sync_complete)} ($count messages)")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setAutoCancel(true)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID_COMPLETE, notification)
    }

    private fun showSyncFailedNotification(error: String) {
        val notification = NotificationCompat.Builder(this, SmsApplication.CHANNEL_SYNC)
            .setSmallIcon(R.drawable.ic_sms)
            .setContentTitle(getString(R.string.app_name))
            .setContentText("${getString(R.string.error_sync_failed)}: $error")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setAutoCancel(true)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID_FAILED, notification)
    }

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val NOTIFICATION_ID_COMPLETE = 1002
        private const val NOTIFICATION_ID_FAILED = 1003

        fun start(context: Context) {
            val intent = Intent(context, SmsSyncService::class.java)
            context.startForegroundService(intent)
        }
    }
}
