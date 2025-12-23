package com.virtualandroid.sms.data

import java.util.Date

data class Conversation(
    val threadId: Long,
    val address: String,
    val snippet: String,
    val date: Date,
    val messageCount: Int,
    val unreadCount: Int,
    val contactName: String? = null
) {
    val displayName: String
        get() = contactName ?: address

    val hasUnread: Boolean
        get() = unreadCount > 0
}
