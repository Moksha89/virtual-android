package com.virtualandroid.sms.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.service.SmsSyncService

class BootReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            
            val app = context.applicationContext as SmsApplication
            val prefs = app.preferencesManager
            
            // Only start services if registered and setup is complete
            if (prefs.isRegistered && prefs.deviceToken.isNotBlank() && prefs.setupComplete) {
                // Start the SMS sync service
                SmsSyncService.start(context)
                
                // Note: Screen capture cannot be auto-started on boot because
                // MediaProjection requires user consent each time the app starts.
                // The user will need to manually start screen sharing after reboot.
            }
        }
    }
}
