package com.virtualandroid.sms.data

data class CallLogEntry(
    val id: Long,
    val number: String,
    val contactName: String?,
    val callType: Int,
    val duration: Long,
    val timestamp: Long,
    val isNew: Boolean = false
) {
    companion object {
        const val TYPE_INCOMING = 1
        const val TYPE_OUTGOING = 2
        const val TYPE_MISSED = 3
        const val TYPE_VOICEMAIL = 4
        const val TYPE_REJECTED = 5
        const val TYPE_BLOCKED = 6
    }
    
    fun getCallTypeString(): String {
        return when (callType) {
            TYPE_INCOMING -> "incoming"
            TYPE_OUTGOING -> "outgoing"
            TYPE_MISSED -> "missed"
            TYPE_VOICEMAIL -> "voicemail"
            TYPE_REJECTED -> "rejected"
            TYPE_BLOCKED -> "blocked"
            else -> "unknown"
        }
    }
}
