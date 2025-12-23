package com.virtualandroid.sms.data

import java.util.Date

data class SmsMessage(
    val id: Long,
    val threadId: Long,
    val address: String,
    val body: String,
    val date: Date,
    val type: MessageType,
    val read: Boolean,
    val status: MessageStatus = MessageStatus.NONE,
    val contactName: String? = null
) {
    enum class MessageType(val value: Int) {
        INBOX(1),
        SENT(2),
        DRAFT(3),
        OUTBOX(4),
        FAILED(5),
        QUEUED(6);

        companion object {
            fun fromValue(value: Int): MessageType {
                return entries.find { it.value == value } ?: INBOX
            }
        }
    }

    enum class MessageStatus(val value: Int) {
        NONE(-1),
        COMPLETE(0),
        PENDING(32),
        FAILED(64);

        companion object {
            fun fromValue(value: Int): MessageStatus {
                return entries.find { it.value == value } ?: NONE
            }
        }
    }

    val isIncoming: Boolean
        get() = type == MessageType.INBOX

    val isOutgoing: Boolean
        get() = type == MessageType.SENT || type == MessageType.OUTBOX || 
                type == MessageType.DRAFT || type == MessageType.QUEUED ||
                type == MessageType.FAILED
}
