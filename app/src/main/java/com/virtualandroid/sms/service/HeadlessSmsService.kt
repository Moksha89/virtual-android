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
        val phoneNumber = intent.dataString?.replace("smsto:", "")?.replace("sms:", "")
        val message = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)

        if (!phoneNumber.isNullOrBlank() && !message.isNullOrBlank()) {
            SmsSender.sendSms(this, phoneNumber, message)
        }

        stopSelf()
        return START_NOT_STICKY
    }
}
