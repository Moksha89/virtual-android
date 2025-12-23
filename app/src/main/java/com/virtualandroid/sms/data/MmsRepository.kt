package com.virtualandroid.sms.data

import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.ContactsContract
import android.provider.Telephony
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.util.Date

class MmsRepository(private val context: Context) {

    private val contentResolver: ContentResolver = context.contentResolver

    suspend fun getMmsMessages(threadId: Long): List<MmsMessage> = withContext(Dispatchers.IO) {
        val messages = mutableListOf<MmsMessage>()

        try {
            val projection = arrayOf(
                Telephony.Mms._ID,
                Telephony.Mms.THREAD_ID,
                Telephony.Mms.DATE,
                Telephony.Mms.MESSAGE_BOX,
                Telephony.Mms.READ,
                Telephony.Mms.SUBJECT,
                Telephony.Mms.CONTENT_TYPE
            )

            contentResolver.query(
                Telephony.Mms.CONTENT_URI,
                projection,
                "${Telephony.Mms.THREAD_ID} = ?",
                arrayOf(threadId.toString()),
                "${Telephony.Mms.DATE} ASC"
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val mmsId = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Mms._ID))
                    val address = getMmsAddress(mmsId)
                    val contactName = getContactName(address)
                    val parts = getMmsParts(mmsId)

                    messages.add(
                        MmsMessage(
                            id = mmsId,
                            threadId = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Mms.THREAD_ID)),
                            address = address,
                            subject = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Mms.SUBJECT)),
                            date = Date(cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Mms.DATE)) * 1000),
                            type = MmsMessage.MessageType.fromValue(
                                cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Mms.MESSAGE_BOX))
                            ),
                            read = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Mms.READ)) == 1,
                            contentType = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Mms.CONTENT_TYPE)),
                            textParts = parts.filter { it.contentType.startsWith("text/") }.mapNotNull { it.text },
                            imageParts = parts.filter { it.contentType.startsWith("image/") },
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

    suspend fun getAllMmsMessages(since: Long = 0): List<MmsMessage> = withContext(Dispatchers.IO) {
        val messages = mutableListOf<MmsMessage>()

        try {
            val projection = arrayOf(
                Telephony.Mms._ID,
                Telephony.Mms.THREAD_ID,
                Telephony.Mms.DATE,
                Telephony.Mms.MESSAGE_BOX,
                Telephony.Mms.READ,
                Telephony.Mms.SUBJECT,
                Telephony.Mms.CONTENT_TYPE
            )

            val sinceSeconds = since / 1000
            val selection = if (sinceSeconds > 0) "${Telephony.Mms.DATE} > ?" else null
            val selectionArgs = if (sinceSeconds > 0) arrayOf(sinceSeconds.toString()) else null

            contentResolver.query(
                Telephony.Mms.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                "${Telephony.Mms.DATE} DESC"
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val mmsId = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Mms._ID))
                    val address = getMmsAddress(mmsId)
                    val parts = getMmsParts(mmsId)

                    messages.add(
                        MmsMessage(
                            id = mmsId,
                            threadId = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Mms.THREAD_ID)),
                            address = address,
                            subject = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Mms.SUBJECT)),
                            date = Date(cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Mms.DATE)) * 1000),
                            type = MmsMessage.MessageType.fromValue(
                                cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Mms.MESSAGE_BOX))
                            ),
                            read = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Mms.READ)) == 1,
                            contentType = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Mms.CONTENT_TYPE)),
                            textParts = parts.filter { it.contentType.startsWith("text/") }.mapNotNull { it.text },
                            imageParts = parts.filter { it.contentType.startsWith("image/") }
                        )
                    )
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        messages
    }

    private fun getMmsAddress(mmsId: Long): String {
        val uri = Uri.parse("content://mms/$mmsId/addr")

        try {
            contentResolver.query(
                uri,
                arrayOf(Telephony.Mms.Addr.ADDRESS, Telephony.Mms.Addr.TYPE),
                "${Telephony.Mms.Addr.TYPE} = ?",
                arrayOf(PduHeaders.FROM.toString()),
                null
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val address = cursor.getString(0)
                    if (!address.isNullOrBlank() && address != "insert-address-token") {
                        return address
                    }
                }
            }

            contentResolver.query(
                uri,
                arrayOf(Telephony.Mms.Addr.ADDRESS, Telephony.Mms.Addr.TYPE),
                null,
                null,
                null
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val address = cursor.getString(0)
                    if (!address.isNullOrBlank() && address != "insert-address-token") {
                        return address
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return ""
    }

    private fun getMmsParts(mmsId: Long): List<MmsPart> {
        val parts = mutableListOf<MmsPart>()
        val uri = Uri.parse("content://mms/part")

        try {
            contentResolver.query(
                uri,
                arrayOf(
                    Telephony.Mms.Part._ID,
                    Telephony.Mms.Part.CONTENT_TYPE,
                    Telephony.Mms.Part.TEXT,
                    Telephony.Mms.Part.NAME,
                    Telephony.Mms.Part._DATA
                ),
                "${Telephony.Mms.Part.MSG_ID} = ?",
                arrayOf(mmsId.toString()),
                null
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val partId = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Mms.Part._ID))
                    val contentType = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Mms.Part.CONTENT_TYPE)) ?: ""
                    val text = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Mms.Part.TEXT))
                    val fileName = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Mms.Part.NAME))

                    val data = if (contentType.startsWith("image/") || contentType.startsWith("video/")) {
                        getPartData(partId)
                    } else {
                        null
                    }

                    parts.add(
                        MmsPart(
                            id = partId,
                            contentType = contentType,
                            data = data,
                            text = text,
                            fileName = fileName
                        )
                    )
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return parts
    }

    private fun getPartData(partId: Long): ByteArray? {
        val uri = Uri.parse("content://mms/part/$partId")

        try {
            contentResolver.openInputStream(uri)?.use { inputStream ->
                val buffer = ByteArrayOutputStream()
                val data = ByteArray(1024)
                var count: Int
                while (inputStream.read(data).also { count = it } != -1) {
                    buffer.write(data, 0, count)
                }
                return buffer.toByteArray()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return null
    }

    suspend fun insertMms(
        address: String,
        subject: String?,
        textContent: String,
        type: MmsMessage.MessageType
    ): Uri? = withContext(Dispatchers.IO) {
        try {
            val values = ContentValues().apply {
                put(Telephony.Mms.MESSAGE_BOX, type.value)
                put(Telephony.Mms.READ, 1)
                put(Telephony.Mms.DATE, System.currentTimeMillis() / 1000)
                put(Telephony.Mms.SUBJECT, subject)
                put(Telephony.Mms.CONTENT_TYPE, "application/vnd.wap.multipart.related")
            }

            val mmsUri = contentResolver.insert(Telephony.Mms.CONTENT_URI, values)

            if (mmsUri != null) {
                val mmsId = mmsUri.lastPathSegment?.toLongOrNull()
                if (mmsId != null) {
                    insertMmsAddress(mmsId, address, type)
                    insertMmsPart(mmsId, textContent)
                }
            }

            mmsUri
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun insertMmsAddress(mmsId: Long, address: String, type: MmsMessage.MessageType) {
        val uri = Uri.parse("content://mms/$mmsId/addr")
        val addressType = if (type == MmsMessage.MessageType.INBOX) PduHeaders.FROM else PduHeaders.TO

        val values = ContentValues().apply {
            put(Telephony.Mms.Addr.ADDRESS, address)
            put(Telephony.Mms.Addr.TYPE, addressType)
            put(Telephony.Mms.Addr.CHARSET, 106)
        }

        contentResolver.insert(uri, values)
    }

    private fun insertMmsPart(mmsId: Long, text: String) {
        val uri = Uri.parse("content://mms/$mmsId/part")

        val values = ContentValues().apply {
            put(Telephony.Mms.Part.MSG_ID, mmsId)
            put(Telephony.Mms.Part.CONTENT_TYPE, "text/plain")
            put(Telephony.Mms.Part.TEXT, text)
        }

        contentResolver.insert(uri, values)
    }

    private fun getContactName(phoneNumber: String): String? {
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

    private object PduHeaders {
        const val FROM = 137
        const val TO = 151
    }
}
