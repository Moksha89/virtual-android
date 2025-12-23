package com.virtualandroid.sms.util

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.SmsManager
import com.virtualandroid.sms.receiver.SmsSentReceiver

object SmsSender {

    const val ACTION_SMS_SENT = "com.virtualandroid.sms.SMS_SENT"
    const val ACTION_SMS_DELIVERED = "com.virtualandroid.sms.SMS_DELIVERED"
    const val EXTRA_MESSAGE_ID = "message_id"

    fun sendSms(
        context: Context,
        phoneNumber: String,
        message: String,
        messageId: Long = System.currentTimeMillis()
    ): Boolean {
        return try {
            val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            val parts = smsManager.divideMessage(message)

            if (parts.size == 1) {
                // Single part message
                val sentIntent = createSentIntent(context, messageId)
                val deliveredIntent = createDeliveredIntent(context, messageId)

                smsManager.sendTextMessage(
                    phoneNumber,
                    null,
                    message,
                    sentIntent,
                    deliveredIntent
                )
            } else {
                // Multipart message
                val sentIntents = ArrayList<PendingIntent>()
                val deliveredIntents = ArrayList<PendingIntent>()

                for (i in parts.indices) {
                    sentIntents.add(createSentIntent(context, messageId, i))
                    deliveredIntents.add(createDeliveredIntent(context, messageId, i))
                }

                smsManager.sendMultipartTextMessage(
                    phoneNumber,
                    null,
                    parts,
                    sentIntents,
                    deliveredIntents
                )
            }

            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    private fun createSentIntent(context: Context, messageId: Long, partIndex: Int = 0): PendingIntent {
        val intent = Intent(ACTION_SMS_SENT).apply {
            setPackage(context.packageName)
            putExtra(EXTRA_MESSAGE_ID, messageId)
            putExtra("part_index", partIndex)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        return PendingIntent.getBroadcast(
            context,
            (messageId + partIndex).toInt(),
            intent,
            flags
        )
    }

    private fun createDeliveredIntent(context: Context, messageId: Long, partIndex: Int = 0): PendingIntent {
        val intent = Intent(ACTION_SMS_DELIVERED).apply {
            setPackage(context.packageName)
            putExtra(EXTRA_MESSAGE_ID, messageId)
            putExtra("part_index", partIndex)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        return PendingIntent.getBroadcast(
            context,
            (messageId + partIndex + 1000).toInt(),
            intent,
            flags
        )
    }
}
