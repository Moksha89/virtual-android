package com.virtualandroid.sms.data

import java.util.Date

data class MmsMessage(
    val id: Long,
    val threadId: Long,
    val address: String,
    val subject: String?,
    val date: Date,
    val type: MessageType,
    val read: Boolean,
    val contentType: String?,
    val textParts: List<String> = emptyList(),
    val imageParts: List<MmsPart> = emptyList(),
    val contactName: String? = null
) {
    enum class MessageType(val value: Int) {
        INBOX(1),
        SENT(2),
        DRAFT(3),
        OUTBOX(4);

        companion object {
            fun fromValue(value: Int): MessageType {
                return entries.find { it.value == value } ?: INBOX
            }
        }
    }

    val isIncoming: Boolean
        get() = type == MessageType.INBOX

    val isOutgoing: Boolean
        get() = type == MessageType.SENT || type == MessageType.OUTBOX || type == MessageType.DRAFT

    val displayText: String
        get() = textParts.joinToString("\n").ifEmpty { subject ?: "[MMS]" }
}

data class MmsPart(
    val id: Long,
    val contentType: String,
    val data: ByteArray?,
    val text: String?,
    val fileName: String?
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as MmsPart
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()
}
