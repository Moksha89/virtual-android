package com.virtualandroid.sms.receiver

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import com.virtualandroid.sms.R
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.ui.ConversationActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.WAP_PUSH_DELIVER_ACTION) {
            return
        }

        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val pduData = intent.getByteArrayExtra("data")
                val contentType = intent.type ?: "application/vnd.wap.mms-message"

                if (pduData != null) {
                    val mmsUri = writeMmsToProvider(context, pduData, contentType)

                    if (mmsUri != null) {
                        val app = context.applicationContext as SmsApplication
                        val sender = extractSenderFromPdu(pduData) ?: "Unknown"
                        val contactName = app.smsRepository.getContactName(sender) ?: sender

                        showNotification(context, contactName, "[MMS Message]")

                        if (app.preferencesManager.syncEnabled) {
                            // Trigger sync if enabled
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun writeMmsToProvider(context: Context, pduData: ByteArray, contentType: String): android.net.Uri? {
        try {
            val values = ContentValues().apply {
                put(Telephony.Mms.MESSAGE_BOX, Telephony.Mms.MESSAGE_BOX_INBOX)
                put(Telephony.Mms.READ, 0)
                put(Telephony.Mms.DATE, System.currentTimeMillis() / 1000)
                put(Telephony.Mms.CONTENT_TYPE, contentType)
            }

            val uri = context.contentResolver.insert(Telephony.Mms.CONTENT_URI, values)

            if (uri != null) {
                val mmsId = uri.lastPathSegment?.toLongOrNull()
                if (mmsId != null) {
                    writePduParts(context, mmsId, pduData)
                }
            }

            return uri
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    private fun writePduParts(context: Context, mmsId: Long, pduData: ByteArray) {
        try {
            val partUri = android.net.Uri.parse("content://mms/$mmsId/part")

            val values = ContentValues().apply {
                put(Telephony.Mms.Part.MSG_ID, mmsId)
                put(Telephony.Mms.Part.CONTENT_TYPE, "application/vnd.wap.mms-message")
                put(Telephony.Mms.Part._DATA, pduData)
            }

            context.contentResolver.insert(partUri, values)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun extractSenderFromPdu(pduData: ByteArray): String? {
        try {
            var i = 0
            while (i < pduData.size - 1) {
                val header = pduData[i].toInt() and 0xFF

                if (header == 0x89) {
                    i++
                    val length = pduData[i].toInt() and 0xFF
                    i++

                    if (i + length <= pduData.size) {
                        val addressBytes = pduData.copyOfRange(i, i + length)
                        var address = String(addressBytes, Charsets.UTF_8)
                        address = address.replace("/TYPE=PLMN", "")
                            .replace("+", "")
                            .trim()
                        if (address.isNotEmpty()) {
                            return address
                        }
                    }
                    break
                }
                i++
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return null
    }

    private fun showNotification(context: Context, sender: String, body: String) {
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
            .setContentTitle(sender)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(sender.hashCode() + 1000, notification)
    }
}
