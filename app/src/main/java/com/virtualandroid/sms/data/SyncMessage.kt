package com.virtualandroid.sms.data

import com.google.gson.annotations.SerializedName

data class SyncMessage(
    @SerializedName("message_id")
    val messageId: Long,

    @SerializedName("thread_id")
    val threadId: Long,

    @SerializedName("from_address")
    val fromAddress: String,

    @SerializedName("to_address")
    val toAddress: String,

    @SerializedName("body")
    val body: String,

    @SerializedName("timestamp")
    val timestamp: Long,

    @SerializedName("direction")
    val direction: String,

    @SerializedName("status")
    val status: String,

    @SerializedName("source")
    val source: String = "default-sms"
)

data class SyncCallLog(
    @SerializedName("call_id")
    val callId: Long,

    @SerializedName("number")
    val number: String,

    @SerializedName("contact_name")
    val contactName: String?,

    @SerializedName("call_type")
    val callType: String,

    @SerializedName("duration")
    val duration: Long,

    @SerializedName("timestamp")
    val timestamp: Long
)

data class SyncNotification(
    @SerializedName("notification_id")
    val notificationId: Long,

    @SerializedName("package_name")
    val packageName: String,

    @SerializedName("app_name")
    val appName: String,

    @SerializedName("title")
    val title: String?,

    @SerializedName("text")
    val text: String?,

    @SerializedName("timestamp")
    val timestamp: Long,

    @SerializedName("category")
    val category: String?
)

data class SyncRequest(
    @SerializedName("messages")
    val messages: List<SyncMessage> = emptyList(),

    @SerializedName("call_logs")
    val callLogs: List<SyncCallLog> = emptyList(),

    @SerializedName("notifications")
    val notifications: List<SyncNotification> = emptyList()
)

data class SyncResponse(
    @SerializedName("success")
    val success: Boolean,

    @SerializedName("synced_count")
    val syncedCount: Int,

    @SerializedName("message")
    val message: String? = null
)
