package com.virtualandroid.sms.data

data class AppNotification(
    val id: Long,
    val packageName: String,
    val appName: String,
    val title: String?,
    val text: String?,
    val timestamp: Long,
    val category: String?
) {
    fun getAppDisplayName(): String {
        return when (packageName) {
            "com.whatsapp" -> "WhatsApp"
            "com.whatsapp.w4b" -> "WhatsApp Business"
            "org.telegram.messenger" -> "Telegram"
            "com.facebook.orca" -> "Messenger"
            "com.instagram.android" -> "Instagram"
            "com.snapchat.android" -> "Snapchat"
            "com.twitter.android" -> "Twitter/X"
            "com.google.android.gm" -> "Gmail"
            else -> appName
        }
    }
}
