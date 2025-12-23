package com.virtualandroid.sms.data

import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.provider.ContactsContract
import android.provider.Telephony
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Date

class SmsRepository(private val context: Context) {

    private val contentResolver: ContentResolver = context.contentResolver

    suspend fun getConversations(): List<Conversation> = withContext(Dispatchers.IO) {
        val conversations = mutableListOf<Conversation>()
        val projection = arrayOf(
            Telephony.Sms.Conversations.THREAD_ID,
            Telephony.Sms.Conversations.SNIPPET,
            Telephony.Sms.Conversations.MESSAGE_COUNT
        )

        try {
            contentResolver.query(
                Telephony.Sms.Conversations.CONTENT_URI,
                projection,
                null,
                null,
                "date DESC"
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val threadId = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.Conversations.THREAD_ID))
                    val snippet = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.Conversations.SNIPPET)) ?: ""
                    val messageCount = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.Conversations.MESSAGE_COUNT))

                    // Get additional info from the thread
                    val threadInfo = getThreadInfo(threadId)
                    if (threadInfo != null) {
                        val contactName = getContactName(threadInfo.address)
                        conversations.add(
                            Conversation(
                                threadId = threadId,
                                address = threadInfo.address,
                                snippet = snippet,
                                date = threadInfo.date,
                                messageCount = messageCount,
                                unreadCount = threadInfo.unreadCount,
                                contactName = contactName
                            )
                        )
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        conversations
    }

    private fun getThreadInfo(threadId: Long): ThreadInfo? {
        val projection = arrayOf(
            Telephony.Sms.ADDRESS,
            Telephony.Sms.DATE,
            Telephony.Sms.READ
        )

        try {
            contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                projection,
                "${Telephony.Sms.THREAD_ID} = ?",
                arrayOf(threadId.toString()),
                "${Telephony.Sms.DATE} DESC"
            )?.use { cursor ->
                var address = ""
                var date = Date()
                var unreadCount = 0

                while (cursor.moveToNext()) {
                    if (address.isEmpty()) {
                        address = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)) ?: ""
                        date = Date(cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)))
                    }
                    val read = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.READ))
                    if (read == 0) unreadCount++
                }

                if (address.isNotEmpty()) {
                    return ThreadInfo(address, date, unreadCount)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return null
    }

    suspend fun getMessages(threadId: Long): List<SmsMessage> = withContext(Dispatchers.IO) {
        val messages = mutableListOf<SmsMessage>()
        val projection = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.THREAD_ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.TYPE,
            Telephony.Sms.READ,
            Telephony.Sms.STATUS
        )

        try {
            contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                projection,
                "${Telephony.Sms.THREAD_ID} = ?",
                arrayOf(threadId.toString()),
                "${Telephony.Sms.DATE} ASC"
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val address = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)) ?: ""
                    val contactName = getContactName(address)

                    messages.add(
                        SmsMessage(
                            id = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms._ID)),
                            threadId = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.THREAD_ID)),
                            address = address,
                            body = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)) ?: "",
                            date = Date(cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE))),
                            type = SmsMessage.MessageType.fromValue(
                                cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.TYPE))
                            ),
                            read = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.READ)) == 1,
                            status = SmsMessage.MessageStatus.fromValue(
                                cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.STATUS))
                            ),
                            contactName = contactName
                        )
                    )
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        messages
    }

    suspend fun getAllMessages(since: Long = 0): List<SmsMessage> = withContext(Dispatchers.IO) {
        val messages = mutableListOf<SmsMessage>()
        val projection = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.THREAD_ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.TYPE,
            Telephony.Sms.READ,
            Telephony.Sms.STATUS
        )

        val selection = if (since > 0) "${Telephony.Sms.DATE} > ?" else null
        val selectionArgs = if (since > 0) arrayOf(since.toString()) else null

        try {
            contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                "${Telephony.Sms.DATE} DESC"
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val address = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)) ?: ""

                    messages.add(
                        SmsMessage(
                            id = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms._ID)),
                            threadId = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.THREAD_ID)),
                            address = address,
                            body = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)) ?: "",
                            date = Date(cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE))),
                            type = SmsMessage.MessageType.fromValue(
                                cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.TYPE))
                            ),
                            read = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.READ)) == 1,
                            status = SmsMessage.MessageStatus.fromValue(
                                cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.STATUS))
                            )
                        )
                    )
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        messages
    }

    suspend fun insertMessage(
        address: String,
        body: String,
        type: SmsMessage.MessageType,
        date: Long = System.currentTimeMillis()
    ): Uri? = withContext(Dispatchers.IO) {
        val values = ContentValues().apply {
            put(Telephony.Sms.ADDRESS, address)
            put(Telephony.Sms.BODY, body)
            put(Telephony.Sms.TYPE, type.value)
            put(Telephony.Sms.DATE, date)
            put(Telephony.Sms.READ, 1)
        }

        try {
            contentResolver.insert(Telephony.Sms.CONTENT_URI, values)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun markAsRead(threadId: Long) = withContext(Dispatchers.IO) {
        val values = ContentValues().apply {
            put(Telephony.Sms.READ, 1)
        }

        try {
            contentResolver.update(
                Telephony.Sms.CONTENT_URI,
                values,
                "${Telephony.Sms.THREAD_ID} = ? AND ${Telephony.Sms.READ} = 0",
                arrayOf(threadId.toString())
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun deleteConversation(threadId: Long): Int = withContext(Dispatchers.IO) {
        try {
            contentResolver.delete(
                Telephony.Sms.CONTENT_URI,
                "${Telephony.Sms.THREAD_ID} = ?",
                arrayOf(threadId.toString())
            )
        } catch (e: Exception) {
            e.printStackTrace()
            0
        }
    }

    suspend fun deleteMessage(messageId: Long): Int = withContext(Dispatchers.IO) {
        try {
            contentResolver.delete(
                Telephony.Sms.CONTENT_URI,
                "${Telephony.Sms._ID} = ?",
                arrayOf(messageId.toString())
            )
        } catch (e: Exception) {
            e.printStackTrace()
            0
        }
    }

    fun getContactName(phoneNumber: String): String? {
        if (phoneNumber.isBlank()) return null

        val uri = Uri.withAppendedPath(
            ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
            Uri.encode(phoneNumber)
        )

        try {
            contentResolver.query(
                uri,
                arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                null,
                null,
                null
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    return cursor.getString(0)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return null
    }

    private data class ThreadInfo(
        val address: String,
        val date: Date,
        val unreadCount: Int
    )
}
