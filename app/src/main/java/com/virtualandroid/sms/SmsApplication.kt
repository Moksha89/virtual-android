package com.virtualandroid.sms

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.virtualandroid.sms.data.SmsRepository
import com.virtualandroid.sms.util.PreferencesManager

class SmsApplication : Application() {

    lateinit var preferencesManager: PreferencesManager
        private set

    lateinit var smsRepository: SmsRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        preferencesManager = PreferencesManager(this)
        smsRepository = SmsRepository(this)

        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)

            // Messages channel
            val messagesChannel = NotificationChannel(
                CHANNEL_MESSAGES,
                getString(R.string.notification_channel_messages),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for new SMS messages"
                enableVibration(true)
                enableLights(true)
            }
            notificationManager.createNotificationChannel(messagesChannel)

            // Sync channel
            val syncChannel = NotificationChannel(
                CHANNEL_SYNC,
                getString(R.string.notification_channel_sync),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifications for SMS sync status"
            }
            notificationManager.createNotificationChannel(syncChannel)
        }
    }

    companion object {
        const val CHANNEL_MESSAGES = "messages"
        const val CHANNEL_SYNC = "sync"

        lateinit var instance: SmsApplication
            private set
    }
}
