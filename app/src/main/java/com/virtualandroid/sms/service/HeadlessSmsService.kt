package com.virtualandroid.sms.service

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.telephony.TelephonyManager
import com.virtualandroid.sms.util.SmsSender

class HeadlessSmsService : Service() {

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        // Handle "respond via message" from incoming call screen
        // The phone number comes from the intent data URI (sms: or smsto:)
        // The message body comes from Intent.EXTRA_TEXT
        val phoneNumber = intent.dataString
            ?.replace("smsto:", "")
            ?.replace("sms:", "")
            ?.replace("mms:", "")
            ?.replace("mmsto:", "")
            ?.trim()
        
        val message = intent.getStringExtra(Intent.EXTRA_TEXT)
            ?: intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()

        if (!phoneNumber.isNullOrBlank() && !message.isNullOrBlank()) {
            SmsSender.sendSms(this, phoneNumber, message)
        }

        stopSelf()
        return START_NOT_STICKY
    }
}
