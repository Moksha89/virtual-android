package com.virtualandroid.sms.data

import android.content.Context
import android.database.Cursor
import android.provider.CallLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CallLogRepository(private val context: Context) {
    
    suspend fun getCallLogs(limit: Int = 500): List<CallLogEntry> = withContext(Dispatchers.IO) {
        val callLogs = mutableListOf<CallLogEntry>()
        
        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DURATION,
            CallLog.Calls.DATE,
            CallLog.Calls.NEW
        )
        
        val sortOrder = "${CallLog.Calls.DATE} DESC"
        
        try {
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null,
                null,
                "$sortOrder LIMIT $limit"
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    callLogs.add(cursorToCallLogEntry(cursor))
                }
            }
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
        
        callLogs
    }
    
    suspend fun getCallLogsSince(timestamp: Long): List<CallLogEntry> = withContext(Dispatchers.IO) {
        val callLogs = mutableListOf<CallLogEntry>()
        
        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DURATION,
            CallLog.Calls.DATE,
            CallLog.Calls.NEW
        )
        
        val selection = "${CallLog.Calls.DATE} > ?"
        val selectionArgs = arrayOf(timestamp.toString())
        val sortOrder = "${CallLog.Calls.DATE} DESC"
        
        try {
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                sortOrder
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    callLogs.add(cursorToCallLogEntry(cursor))
                }
            }
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
        
        callLogs
    }
    
    private fun cursorToCallLogEntry(cursor: Cursor): CallLogEntry {
        return CallLogEntry(
            id = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls._ID)),
            number = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)) ?: "",
            contactName = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)),
            callType = cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)),
            duration = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)),
            timestamp = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)),
            isNew = cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.NEW)) == 1
        )
    }
}
