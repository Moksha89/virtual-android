package com.virtualandroid.sms.receiver

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import com.virtualandroid.sms.R
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.data.SmsMessage
import com.virtualandroid.sms.ui.ConversationActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_DELIVER_ACTION) {
            return
        }

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Group messages by sender (for multipart messages)
                val messageMap = mutableMapOf<String, StringBuilder>()
                var sender = ""

                for (smsMessage in messages) {
                    sender = smsMessage.displayOriginatingAddress ?: smsMessage.originatingAddress ?: ""
                    val body = smsMessage.messageBody ?: ""

                    if (messageMap.containsKey(sender)) {
                        messageMap[sender]?.append(body)
                    } else {
                        messageMap[sender] = StringBuilder(body)
                    }
                }

                // Process each complete message
                for ((address, bodyBuilder) in messageMap) {
                    val body = bodyBuilder.toString()

                    // Insert message into SMS database
                    val app = context.applicationContext as SmsApplication
                    app.smsRepository.insertMessage(
                        address = address,
                        body = body,
                        type = SmsMessage.MessageType.INBOX
                    )

                    // Show notification
                    showNotification(context, address, body)

                    // Trigger sync if enabled
                    if (app.preferencesManager.syncEnabled) {
                        // TODO: Trigger sync service
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun showNotification(context: Context, sender: String, body: String) {
        val app = context.applicationContext as SmsApplication
        val contactName = app.smsRepository.getContactName(sender) ?: sender

        val intent = Intent(context, ConversationActivity::class.java).apply {
            putExtra(ConversationActivity.EXTRA_ADDRESS, sender)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            sender.hashCode(),
            intent,
            flags
        )

        val notification = NotificationCompat.Builder(context, SmsApplication.CHANNEL_MESSAGES)
            .setSmallIcon(R.drawable.ic_sms)
            .setContentTitle(contactName)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(sender.hashCode(), notification)
    }
}
