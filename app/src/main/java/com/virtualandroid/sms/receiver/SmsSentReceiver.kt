package com.virtualandroid.sms.receiver

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.SmsManager
import android.widget.Toast
import com.virtualandroid.sms.R
import com.virtualandroid.sms.util.SmsSender

class SmsSentReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val messageId = intent.getLongExtra(SmsSender.EXTRA_MESSAGE_ID, -1)

        when (intent.action) {
            SmsSender.ACTION_SMS_SENT -> handleSmsSent(context, resultCode, messageId)
            SmsSender.ACTION_SMS_DELIVERED -> handleSmsDelivered(context, resultCode, messageId)
        }
    }

    private fun handleSmsSent(context: Context, resultCode: Int, messageId: Long) {
        when (resultCode) {
            Activity.RESULT_OK -> {
                // Message sent successfully
                // Could update UI or database here
            }
            SmsManager.RESULT_ERROR_GENERIC_FAILURE -> {
                Toast.makeText(context, R.string.message_failed, Toast.LENGTH_SHORT).show()
            }
            SmsManager.RESULT_ERROR_NO_SERVICE -> {
                Toast.makeText(context, "No service", Toast.LENGTH_SHORT).show()
            }
            SmsManager.RESULT_ERROR_NULL_PDU -> {
                Toast.makeText(context, "Null PDU", Toast.LENGTH_SHORT).show()
            }
            SmsManager.RESULT_ERROR_RADIO_OFF -> {
                Toast.makeText(context, "Radio off", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun handleSmsDelivered(context: Context, resultCode: Int, messageId: Long) {
        when (resultCode) {
            Activity.RESULT_OK -> {
                // Message delivered successfully
                // Could update message status in database
            }
            Activity.RESULT_CANCELED -> {
                // Message not delivered
            }
        }
    }
}
