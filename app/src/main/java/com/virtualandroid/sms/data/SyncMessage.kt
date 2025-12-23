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

data class SyncRequest(
    @SerializedName("device_id")
    val deviceId: String,

    @SerializedName("messages")
    val messages: List<SyncMessage>
)

data class SyncResponse(
    @SerializedName("success")
    val success: Boolean,

    @SerializedName("synced_count")
    val syncedCount: Int,

    @SerializedName("message")
    val message: String? = null
)
