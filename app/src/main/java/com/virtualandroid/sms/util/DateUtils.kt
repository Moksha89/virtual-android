package com.virtualandroid.sms.util

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object DateUtils {

    private val timeFormat = SimpleDateFormat("h:mm a", Locale.getDefault())
    private val dateFormat = SimpleDateFormat("MMM d", Locale.getDefault())
    private val fullDateFormat = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
    private val dayFormat = SimpleDateFormat("EEEE", Locale.getDefault())

    fun formatConversationTime(date: Date): String {
        val now = Calendar.getInstance()
        val messageTime = Calendar.getInstance().apply { time = date }

        return when {
            isSameDay(now, messageTime) -> timeFormat.format(date)
            isYesterday(now, messageTime) -> "Yesterday"
            isSameWeek(now, messageTime) -> dayFormat.format(date)
            isSameYear(now, messageTime) -> dateFormat.format(date)
            else -> fullDateFormat.format(date)
        }
    }

    fun formatMessageTime(date: Date): String {
        return timeFormat.format(date)
    }

    fun formatFullDate(date: Date): String {
        return fullDateFormat.format(date)
    }

    fun formatSyncTime(timestamp: Long): String {
        if (timestamp == 0L) return "Never"
        return fullDateFormat.format(Date(timestamp)) + " " + timeFormat.format(Date(timestamp))
    }

    private fun isSameDay(cal1: Calendar, cal2: Calendar): Boolean {
        return cal1.get(Calendar.YEAR) == cal2.get(Calendar.YEAR) &&
                cal1.get(Calendar.DAY_OF_YEAR) == cal2.get(Calendar.DAY_OF_YEAR)
    }

    private fun isYesterday(now: Calendar, other: Calendar): Boolean {
        val yesterday = Calendar.getInstance().apply {
            time = now.time
            add(Calendar.DAY_OF_YEAR, -1)
        }
        return isSameDay(yesterday, other)
    }

    private fun isSameWeek(now: Calendar, other: Calendar): Boolean {
        return now.get(Calendar.YEAR) == other.get(Calendar.YEAR) &&
                now.get(Calendar.WEEK_OF_YEAR) == other.get(Calendar.WEEK_OF_YEAR)
    }

    private fun isSameYear(now: Calendar, other: Calendar): Boolean {
        return now.get(Calendar.YEAR) == other.get(Calendar.YEAR)
    }
}
